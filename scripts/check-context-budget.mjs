#!/usr/bin/env node
// scripts/check-context-budget.mjs
// Context-budget guard - dependency-free, blocking CI step in .github/workflows/ci.yml;
// locally: `node scripts/check-context-budget.mjs` (`--top`, `--update-baseline`).
//
// Why: Claude Code loads part of the project instructions into EVERY session,
// before the first prompt - CLAUDE.md, every file it @-imports (recursively),
// and every .claude/rules/**/*.md WITHOUT a `paths:` frontmatter. A rule WITH
// `paths:` loads lazily, only when a matching file is read, written or edited.
// In the project this guard comes from, that fixed cost grew within four months
// to more than twice a 200k context window - before the first prompt; a
// subagent with a 200k window could no longer start. Nobody decided that; it
// was the sum of sensible maintenance duties. The guard prints the fixed cost
// on every run and fails before it gets there again. Write-up:
// https://sql.marcus-belz.de/en/context-window-full-before-first-prompt/
//
// Measured (the repo's own share): CLAUDE.md, its @-imports, the unscoped rule
// files and THEIR @-imports. Not measured: system prompt, tool definitions,
// skill and agent descriptions - `/context` in a session shows the full picture.
//
// Rules:
//   [fixed-cost]  the estimated tokens of everything loaded in every session
//                 exceed BUDGET_TOKENS. `--top` lists the largest contributors.
//   [size]        one always-loaded rule file above MAX_RULE_TOKENS -> scope it
//                 with `paths:`, or move records (inventories, histories, long
//                 worked examples) to docs/ and name the path in the rule
//   [frontmatter] a rule file starts with `---` but its frontmatter cannot be
//                 read: not closed, no `paths:` key, `paths:` without entries,
//                 or an entry that is not valid YAML (e.g. an unquoted glob that
//                 starts with `*`). Claude Code then loads the rule silently in
//                 every session - or not at all. Quote every glob.
//   [map]         the rule map in CLAUDE.md and the scoped rules disagree: a
//                 scoped rule without a map line, a duplicate line, a line for a
//                 missing or unscoped file, or scoped rules but no map section.
//                 A scoped rule arrives with the RESULT of a matching Read/Edit -
//                 too late for a question without a file or for creating a new
//                 file; the map is how the agent learns beforehand that it exists.
//   [stale]       a baseline entry that no longer matches a finding -> regenerate
//
// Rule map format (CLAUDE.md): a section headed `## Rule map (path-scoped rules)`;
// up to the next `#`/`##` heading, every bullet that starts with a backticked
// `.claude/rules/...` path is a map line - one line per scoped FILE, no directory
// entries:   - `.claude/rules/sql/postgres/sql.md` — <what it covers, which paths>
// Other lines in the section (prose) are ignored.
//
// Frontmatter format: `paths:` as a block list (`paths:` then `  - "db/**"` lines)
// or inline (`paths: ["db/**", "src/**/*.{ts,tsx}"]`); a single scalar is read as
// a comma-separated list. Quoting every glob avoids the YAML traps (`*` starts an
// alias, `{`/`[` start a flow collection, `\` in double quotes is an escape).
//
// @-imports: a token `@<path>` at line start or after whitespace, outside fenced
// code blocks and code spans, resolved relative to the importing file, followed
// up to IMPORT_MAX_HOPS hops and counted once. Only tokens that resolve to a file
// in the repo count - e-mail addresses (no whitespace before `@`), `@name`
// mentions and paths outside the repo (`~/`, absolute, above the root) are not
// the repo's share and are ignored.
//
// Token estimate: UTF-8 bytes / BYTES_PER_TOKEN, line endings normalized to LF
// (a CRLF checkout counts like CI). 3.5 is an UNCALIBRATED default for English
// markdown. Calibrate once per project: in a fresh session run `/context`, divide
// the bytes `--top` prints for the memory files by the tokens `/context` reports
// for them, and set the factor. Calibrate only against the method you will later
// compare with - in the origin project a factor taken from another source halved
// every number (its German text measured about 2 bytes per token).
//
// Not included (project-specific): the origin project also checked the share of
// inventory tables (one row per file or user - a record, not a rule) inside rule
// files. If your project keeps inventories in rule files, add such a rule here.
//
// Baseline: scripts/context-budget-baseline.txt, one line "<rule>|<file>";
// comment lines directly above an entry are its reason. Only [size] can be
// baselined (an oversized rule file is real work); [fixed-cost], [frontmatter]
// and [map] are fixed at once - or BUDGET_TOKENS is raised in a visible edit.
// The baseline only shrinks: an entry without a finding is [stale], and
// `--update-baseline` removes such entries and never adds one. Only exception:
// if no baseline exists yet, the first `--update-baseline` run writes the
// existing backlog (adoption on an existing project). A new entry is a manual
// edit with a reason line.
//
// File set = git's view: tracked plus untracked-but-not-ignored files, minus
// locally deleted ones - a local run measures what a fresh CI checkout would.
// Without any .claude/rules/**/*.md the guard notes that and passes.
// Exit codes: 0 clean, 1 findings, 2 environment problem (not a git checkout,
// unreadable baseline).

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// --- ADAPT: budget and thresholds ----------------------------------------------------
// /init may tighten BUDGET_TOKENS after pruning (a pruned project sits well below the
// template default); raising it is a deliberate edit, visible in the diff.
const BUDGET_TOKENS = 40_000 // estimated tokens loaded in every session
const MAX_RULE_TOKENS = 8_000 // estimated tokens of one always-loaded rule file
const BYTES_PER_TOKEN = 3.5 // UNCALIBRATED default for English markdown - see header

const IMPORT_MAX_HOPS = 5 // Claude Code follows @-imports up to five hops deep
const TOP_N = 10
const RULES_DIR = ".claude/rules/"
const CLAUDE_MD = "CLAUDE.md"
const MAP_HEADING = "## Rule map (path-scoped rules)"
const BASELINE_REL = "scripts/context-budget-baseline.txt"
const BASELINEABLE = new Set(["size"])
const SELF = "node scripts/check-context-budget.mjs"

const REPO_ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."))
const BASELINE = join(REPO_ROOT, BASELINE_REL)
const UPDATE = process.argv.includes("--update-baseline")
const TOP = process.argv.includes("--top")

const fmt = (n) => n.toLocaleString("en-US")

function gitLsFiles(args) {
  try {
    return execFileSync("git", ["ls-files", "-z", ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter((p) => p !== "")
  } catch (err) {
    console.error("Context-budget check: `git ls-files` failed - the guard needs a git checkout.")
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

// Repo-relative POSIX paths, as a fresh checkout has them. Untracked nested
// checkouts are listed as "<dir>/" - not a file entry, dropped.
const deletedFiles = new Set(gitLsFiles(["--deleted"]))
const repoFiles = new Set(
  gitLsFiles(["--cached", "--others", "--exclude-standard"]).filter((p) => !p.endsWith("/") && !deletedFiles.has(p)),
)

const texts = new Map()
function textOf(rel) {
  let text = texts.get(rel)
  if (text === undefined) {
    text = readFileSync(join(REPO_ROOT, rel), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n")
    texts.set(rel, text)
  }
  return text
}
const bytesOf = (rel) => Buffer.byteLength(textOf(rel), "utf8")
const tokensOf = (rel) => Math.ceil(bytesOf(rel) / BYTES_PER_TOKEN)

// --- Markdown: fenced blocks and code spans --------------------------------------------
// `@` and headings inside code are examples, not imports or sections.
const FENCE = /^\s*(```|~~~)/
const BACKTICK = "`"

/** Per line: true when the line belongs to a fenced code block (fence lines included). */
function fencedFlags(lines) {
  const flags = []
  let fence = null
  for (const line of lines) {
    const m = FENCE.exec(line)
    if (m) {
      if (fence === null) fence = m[1]
      else if (m[1] === fence) fence = null
      flags.push(true)
      continue
    }
    flags.push(fence !== null)
  }
  return flags
}

function maskCodeSpans(line) {
  let out = ""
  let i = 0
  while (i < line.length) {
    if (line[i] === BACKTICK) {
      let j = i
      while (j < line.length && line[j] === BACKTICK) j++
      const tick = line.slice(i, j)
      const close = line.indexOf(tick, j)
      if (close !== -1) {
        out += " ".repeat(close + tick.length - i)
        i = close + tick.length
        continue
      }
    }
    out += line[i]
    i++
  }
  return out
}

// --- @-imports -----------------------------------------------------------------------------
const IMPORT = /(?:^|\s)@(\S+)/g

/** Repo-relative path of an import token, or null when it is no repo file. */
function resolveImport(fromDir, raw) {
  // Trailing prose punctuation ("see @docs/x.md.") is not part of the path.
  for (const cand of new Set([raw, raw.replace(/[.,;:!?)\]}>'"]+$/, "")])) {
    if (!cand || cand.startsWith("/") || cand.startsWith("~")) continue
    const p = posix.normalize(posix.join(fromDir, cand))
    if (p !== ".." && !p.startsWith("../") && repoFiles.has(p)) return p
  }
  return null
}

function importsOf(rel) {
  if (!rel.endsWith(".md")) return []
  const lines = textOf(rel).split("\n")
  const fenced = fencedFlags(lines)
  const dir = posix.dirname(rel)
  const out = []
  lines.forEach((line, i) => {
    if (fenced[i]) return
    for (const m of maskCodeSpans(line).matchAll(IMPORT)) {
      const target = resolveImport(dir, m[1])
      if (target) out.push(target)
    }
  })
  return out
}

// --- Frontmatter -----------------------------------------------------------------------------
// Not a YAML parser: it reads exactly the `paths:` shapes rules use and rejects the
// entries a YAML parser would choke on - an unreadable frontmatter is the silent case.

/** Index after a quoted scalar that starts at s[0], or -1 when the quote is not closed. */
function quotedEnd(s) {
  const q = s[0]
  for (let i = 1; i < s.length; i++) {
    if (q === '"' && s[i] === "\\") {
      i++
      continue
    }
    if (s[i] === q) {
      if (q === "'" && s[i + 1] === "'") {
        i++
        continue
      }
      return i + 1
    }
  }
  return -1
}

/** Drop a trailing YAML comment (`#` at the start or after whitespace, outside quotes). */
function stripComment(s) {
  let q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (q === '"' && c === "\\") i++
      else if (q === "'" && c === "'" && s[i + 1] === "'") i++
      else if (c === q) q = null
      continue
    }
    if ((c === '"' || c === "'") && (i === 0 || /[\s,[{]/.test(s[i - 1]))) q = c
    else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i)
  }
  return s
}

/** Split at top-level commas - outside quotes and outside {…}/[…] (brace globs). */
function splitTopLevel(s) {
  const items = []
  let depth = 0
  let q = null
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (q === '"' && c === "\\") i++
      else if (q === "'" && c === "'" && s[i + 1] === "'") i++
      else if (c === q) q = null
      continue
    }
    if ((c === '"' || c === "'") && s.slice(start, i).trim() === "") q = c
    else if (c === "{" || c === "[") depth++
    else if (c === "}" || c === "]") depth--
    else if (c === "," && depth === 0) {
      items.push(s.slice(start, i))
      start = i + 1
    }
  }
  items.push(s.slice(start))
  if (items.length > 1 && items[items.length - 1].trim() === "") items.pop() // trailing comma is valid
  return items
}

const PLAIN_BAD_START = /^([,[\]{}#&*!|>'"%@`]|[-?:](\s|$))/
const BAD_DQ_ESCAPE = /\\[^0abtnvfre "/\\N_LPxuU\t]/

/** One YAML scalar -> { value } or { error }. `flow` = item of an inline [ … ] list. */
function scalar(raw, flow) {
  const s = raw.trim()
  if (s === "") return { error: "empty entry" }
  if (s[0] === '"' || s[0] === "'") {
    const end = quotedEnd(s)
    if (end < 0) return { error: `unclosed quote: ${s}` }
    if (s.slice(end).trim() !== "") return { error: `text after the closing quote: ${s}` }
    const body = s.slice(1, end - 1)
    if (s[0] === '"' && BAD_DQ_ESCAPE.test(body)) return { error: `invalid escape in double quotes (use single quotes): ${s}` }
    const value = s[0] === "'" ? body.replace(/''/g, "'") : body.replace(/\\(.)/g, "$1")
    return value.trim() ? { value } : { error: `empty entry: ${s}` }
  }
  if (PLAIN_BAD_START.test(s)) return { error: `unquoted entry starts with a YAML indicator: ${s}` }
  if (/:(\s|$)/.test(s)) return { error: `unquoted entry contains ": " (read as a mapping): ${s}` }
  if (flow && /[[\]{}]/.test(s)) return { error: `unquoted entry with [ ] { } inside an inline list: ${s}` }
  return { value: s }
}

/**
 * { state: "none" } - no frontmatter (the rule loads in every session)
 * { state: "ok", line, paths } - scoped
 * { state: "broken", line, problem } - Claude Code cannot read the scope
 */
function parseFrontmatter(text) {
  const lines = text.split("\n")
  if (lines[0].trimEnd() !== "---") return { state: "none" }
  const broken = (line, problem) => ({ state: "broken", line, problem })
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---")
  if (end < 0) return broken(1, "frontmatter opened with `---` but never closed")
  const key = lines.findIndex((l, i) => i > 0 && i < end && /^paths\s*:/.test(l))
  if (key < 0) return broken(1, "frontmatter without a `paths:` key")
  const rest = stripComment(lines[key].replace(/^paths\s*:/, "")).trim()
  const values = []
  const errors = []
  const take = (raw, flow) => {
    const r = scalar(raw, flow)
    if (r.error) errors.push(r.error)
    else values.push(r.value)
  }
  if (rest === "") {
    // Block list: `- <entry>` lines up to the first line that is not one.
    for (let i = key + 1; i < end; i++) {
      const l = stripComment(lines[i])
      if (l.trim() === "") continue
      const m = /^\s*-(?:\s+(.*)|\s*)$/.exec(l)
      if (!m) break
      take(m[1] ?? "", false)
    }
  } else if (rest.startsWith("[")) {
    if (!rest.endsWith("]")) return broken(key + 1, "inline `paths: [` list not closed on the same line")
    const inner = rest.slice(1, -1)
    if (inner.trim() !== "") for (const item of splitTopLevel(inner)) take(item, true)
  } else {
    // Single scalar: a comma-separated list of globs.
    const r = scalar(rest, false)
    if (r.error) errors.push(r.error)
    else for (const g of splitTopLevel(r.value)) if (g.trim()) values.push(g.trim())
  }
  if (errors.length > 0) return broken(key + 1, `\`paths:\` entry is not valid YAML (${errors.join(" | ")})`)
  if (values.length === 0) return broken(key + 1, "`paths:` without entries")
  return { state: "ok", line: key + 1, paths: values }
}

// --- Rule files ------------------------------------------------------------------------------
const ruleFiles = [...repoFiles].filter((p) => p.startsWith(RULES_DIR) && p.endsWith(".md")).sort()
if (ruleFiles.length === 0) {
  const own = repoFiles.has(CLAUDE_MD) ? ` (CLAUDE.md alone ~${fmt(tokensOf(CLAUDE_MD))} tokens)` : ""
  console.log(`Context-budget check: no ${RULES_DIR}**/*.md in the repo - nothing to check${own}`)
  process.exit(0)
}
const ruleSet = new Set(ruleFiles)
const rules = ruleFiles.map((path) => ({ path, tokens: tokensOf(path), fm: parseFrontmatter(textOf(path)) }))
const scoped = rules.filter((r) => r.fm.state === "ok")
// A broken frontmatter counts as always loaded - the conservative reading.
const unscoped = rules.filter((r) => r.fm.state !== "ok")

const findings = [] // { rule, file, line, msg, hint, key }
const add = (rule, file, line, msg, hint) => findings.push({ rule, file, line, msg, hint, key: `${rule}|${file}` })

// --- [frontmatter] / [size] ------------------------------------------------------------------
for (const r of rules) {
  if (r.fm.state === "broken") {
    add(
      "frontmatter",
      r.path,
      r.fm.line,
      `${r.fm.problem} - Claude Code cannot read the scope; the rule loads in every session or not at all`,
      'write the scope as a list of quoted globs:  ---  paths:  - "db/**"  ---  (or remove the frontmatter if the rule is meant to load always)',
    )
  }
}
for (const r of unscoped) {
  if (r.tokens > MAX_RULE_TOKENS) {
    add(
      "size",
      r.path,
      1,
      `~${fmt(r.tokens)} tokens in one always-loaded rule file (limit ${fmt(MAX_RULE_TOKENS)})`,
      "scope it with a `paths:` frontmatter (+ a rule-map line in CLAUDE.md), or move records (inventories, histories, long examples) to docs/ and name the path",
    )
  }
}

// --- [fixed-cost] ----------------------------------------------------------------------------
// CLAUDE.md + unscoped rules, then the @-imports of each (breadth-first, so a file is
// reached at its shortest hop distance). Every file counts once.
const fixed = new Map() // path -> how it loads
if (repoFiles.has(CLAUDE_MD)) fixed.set(CLAUDE_MD, "CLAUDE.md")
for (const r of unscoped) fixed.set(r.path, r.fm.state === "broken" ? "rule, unreadable paths:" : "rule without paths:")
for (const root of [...fixed.keys()]) {
  const queue = [[root, 0]]
  const seen = new Set([root])
  while (queue.length > 0) {
    const [rel, hops] = queue.shift()
    if (hops >= IMPORT_MAX_HOPS) continue
    for (const target of importsOf(rel)) {
      if (seen.has(target)) continue
      seen.add(target)
      if (!fixed.has(target)) fixed.set(target, `@-import from ${rel}`)
      queue.push([target, hops + 1])
    }
  }
}
const parts = [...fixed].map(([path, via]) => ({ path, via, bytes: bytesOf(path), tokens: tokensOf(path) }))
const total = parts.reduce((s, p) => s + p.tokens, 0)
const importCount = parts.filter((p) => p.via.startsWith("@-import")).length
const byTokens = [...parts].sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path))
if (total > BUDGET_TOKENS) {
  const largest = byTokens
    .slice(0, 3)
    .map((p) => `${p.path} ~${fmt(p.tokens)}`)
    .join(", ")
  add(
    "fixed-cost",
    CLAUDE_MD,
    1,
    `~${fmt(total)} tokens loaded in every session > budget ${fmt(BUDGET_TOKENS)}`,
    `largest: ${largest} (\`--top\` for more) - scope rules with \`paths:\`, move records out of rule files, name large files instead of @-importing them; or raise BUDGET_TOKENS deliberately`,
  )
}

// --- [map] -----------------------------------------------------------------------------------
function readRuleMap() {
  if (!repoFiles.has(CLAUDE_MD)) return null
  const lines = textOf(CLAUDE_MD).split("\n")
  const fenced = fencedFlags(lines)
  const start = lines.findIndex((l, i) => !fenced[i] && /^##\s+Rule map\b/.test(l))
  if (start < 0) return null
  const entries = []
  for (let i = start + 1; i < lines.length; i++) {
    if (fenced[i]) continue
    if (/^#{1,2}\s/.test(lines[i])) break
    const m = /^\s*[-*+]\s+`(?:\.\/)?([^`]+)`/.exec(lines[i])
    if (m && m[1].startsWith(RULES_DIR)) entries.push({ path: m[1], line: i + 1 })
  }
  return { line: start + 1, entries }
}

const mapLineFor = (p) => `- \`${p}\` — <what it covers, which paths>`
const map = readRuleMap()
const scopedPaths = new Set(scoped.map((r) => r.path))
const brokenPaths = new Set(rules.filter((r) => r.fm.state === "broken").map((r) => r.path))
if (map === null) {
  if (scoped.length > 0) {
    add(
      "map",
      CLAUDE_MD,
      1,
      `${scoped.length} scoped rule(s) but no \`${MAP_HEADING}\` section in CLAUDE.md`,
      `add the section with one line per scoped rule, e.g.  ${mapLineFor(scoped[0].path)}`,
    )
  }
} else {
  const mapped = new Map() // path -> first map line
  for (const e of map.entries) {
    if (brokenPaths.has(e.path)) {
      mapped.set(e.path, e.line) // reported as [frontmatter]; parity is checked once it reads
      continue
    }
    if (!ruleSet.has(e.path)) {
      const isFile = e.path.endsWith(".md")
      add(
        "map",
        CLAUDE_MD,
        e.line,
        `rule-map line for \`${e.path}\` - ${isFile ? "no such rule file" : "not a rule file"}`,
        isFile ? "fix the path or remove the line" : "one line per scoped rule FILE - directory entries are not used",
      )
    } else if (!scopedPaths.has(e.path)) {
      add(
        "map",
        CLAUDE_MD,
        e.line,
        `rule-map line for \`${e.path}\` - the rule has no \`paths:\` frontmatter and loads in every session`,
        "remove the line, or scope the rule with `paths:`",
      )
    } else if (mapped.has(e.path)) {
      add("map", CLAUDE_MD, e.line, `duplicate rule-map line for \`${e.path}\` (first in line ${mapped.get(e.path)})`, "keep one line per scoped rule")
    } else {
      mapped.set(e.path, e.line)
    }
  }
  for (const r of scoped) {
    if (!mapped.has(r.path)) {
      add(
        "map",
        r.path,
        r.fm.line,
        "scoped rule without a line in the rule map of CLAUDE.md",
        `add under "${MAP_HEADING}" (CLAUDE.md line ${map.line}):  ${mapLineFor(r.path)}`,
      )
    }
  }
}

// --- Baseline --------------------------------------------------------------------------------
// { header: string[], entries: { key, line, comments: string[] }[] }
function readBaseline() {
  if (!existsSync(BASELINE)) return null
  const raw = readFileSync(BASELINE, "utf8").split(/\r?\n/)
  const header = []
  let i = 0
  // Header = the first comment block up to the first blank line.
  while (i < raw.length && raw[i].startsWith("#")) header.push(raw[i++])
  const entries = []
  let pending = []
  for (; i < raw.length; i++) {
    const line = raw[i].trim()
    if (line === "") {
      pending = []
      continue
    }
    if (line.startsWith("#")) {
      pending.push(line)
      continue
    }
    if (!/^[a-z-]+\|\S/.test(line)) {
      console.error(`Context-budget check: unreadable baseline line ${i + 1}: ${line}`)
      process.exit(2)
    }
    entries.push({ key: line, line: i + 1, comments: pending })
    pending = []
  }
  return { header, entries }
}

const DEFAULT_HEADER = [
  `# ${BASELINE_REL}`,
  `# Tolerated backlog of the context-budget guard: always-loaded rule files above ${fmt(MAX_RULE_TOKENS)} tokens.`,
  "# One line <rule>|<file>; comments directly above an entry are its reason. The file only shrinks:",
  `# \`${SELF} --update-baseline\` removes resolved entries;`,
  "# a new entry is a manual edit with a reason line.",
]

function writeBaseline(header, entries) {
  const out = [...header, ""]
  for (const e of entries) out.push(...e.comments, e.key)
  out.push("")
  writeFileSync(BASELINE, out.join("\n"))
}

const baselineableKeys = new Set(findings.filter((f) => BASELINEABLE.has(f.rule)).map((f) => f.key))
let baseline = readBaseline()

if (UPDATE) {
  if (baseline === null) {
    // First run: write the existing backlog - never automatically again.
    const keys = [...baselineableKeys].sort()
    if (keys.length === 0) {
      console.log("Baseline not written: no [size] finding to tolerate")
    } else {
      writeBaseline(
        DEFAULT_HEADER,
        keys.map((key) => ({ key, comments: [] })),
      )
      console.log(`Baseline created: ${keys.length} entries (${BASELINE_REL})`)
    }
  } else {
    const kept = baseline.entries.filter((e) => baselineableKeys.has(e.key))
    writeBaseline(baseline.header.length > 0 ? baseline.header : DEFAULT_HEADER, kept)
    console.log(`Baseline updated: ${baseline.entries.length - kept.length} removed, ${kept.length} entries (${BASELINE_REL})`)
  }
  baseline = readBaseline()
}

const entries = baseline?.entries ?? []
const tolerated = new Set(entries.map((e) => e.key))
const RANK = { "fixed-cost": 0, size: 1, frontmatter: 2, map: 3 }
const fresh = findings
  .filter((f) => !(BASELINEABLE.has(f.rule) && tolerated.has(f.key)))
  .sort((a, b) => RANK[a.rule] - RANK[b.rule] || a.file.localeCompare(b.file) || a.line - b.line)
const stale = entries.filter((e) => !baselineableKeys.has(e.key))

// --- Report ----------------------------------------------------------------------------------
const pct = Math.round((total / BUDGET_TOKENS) * 100)
console.log(
  `Context budget: ~${fmt(total)} tokens loaded in every session, ${pct} % of budget ${fmt(BUDGET_TOKENS)} ` +
    `(estimate at ${BYTES_PER_TOKEN} bytes/token; calibrate with /context) - ` +
    `${repoFiles.has(CLAUDE_MD) ? "CLAUDE.md, " : ""}${importCount} @-import(s), ` +
    `${unscoped.length} rule file(s) always loaded, ${scoped.length} scoped`,
)
if (TOP) {
  console.log(`Largest always-loaded files (top ${Math.min(TOP_N, byTokens.length)} of ${byTokens.length}):`)
  console.log(`  ${"~tokens".padStart(8)}  ${"bytes".padStart(7)}  file`)
  for (const p of byTokens.slice(0, TOP_N)) {
    console.log(`  ${fmt(p.tokens).padStart(8)}  ${fmt(p.bytes).padStart(7)}  ${p.path}  (${p.via})`)
  }
}

if (fresh.length === 0 && stale.length === 0) {
  console.log(
    `Context-budget check: 0 findings (${rules.length} rule files, ${scoped.length} scoped, ${entries.length} baseline entries)`,
  )
  process.exit(0)
}
if (fresh.length > 0) {
  console.error(`\nContext-budget check: ${fresh.length} finding(s)\n`)
  for (const f of fresh) {
    console.error(`${f.file}:${f.line}  [${f.rule}]  ${f.msg}`)
    console.error(`    -> ${f.hint}`)
  }
}
if (stale.length > 0) {
  console.error(`\nContext-budget check: ${stale.length} baseline entr${stale.length === 1 ? "y" : "ies"} without a finding\n`)
  for (const s of stale) {
    console.error(`${BASELINE_REL}:${s.line}  [stale]  ${s.key}`)
    console.error(`    -> ${SELF} --update-baseline`)
  }
}
console.error(`\nDetails: header of scripts/check-context-budget.mjs`)
process.exit(1)
