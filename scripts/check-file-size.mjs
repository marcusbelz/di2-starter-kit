#!/usr/bin/env node
// scripts/check-file-size.mjs
// File-size guard - dependency-free, blocking CI step in .github/workflows/ci.yml;
// locally: `node scripts/check-file-size.mjs`.
//
// Why: in the project this guard comes from, one UI module grew to about 7,000
// lines until no diff showed an interaction any more - a fix broke something
// the diff did not contain. Nobody decided that; every single addition was
// small. The guard makes the growth visible before it gets there: no source
// file above LINE_LIMIT lines, and files that already are (the baseline) may
// only shrink.
//
// Scope: every file under SOURCE_ROOTS whose name matches SOURCE_EXT - tests
// INCLUDED (a 2,000-line test is the same finding). Counted are physical lines
// (newlines plus an unterminated last line, like `wc -l`).
//
// ADAPT: /init sets SOURCE_ROOTS to the project's source layout (stack.md).
// Without any matching file the guard reports 0 files and passes.
//
// Rules:
//   [size]   a file above LINE_LIMIT that is not in the baseline -> split it;
//            or a baseline file that grew more than GROWTH_TOLERANCE above its
//            recorded count (the tolerance lets bug fixes through, not features)
//   [stale]  a baseline entry whose file is gone or back under the limit ->
//            regenerate the baseline
//   note     (non-blocking) a baseline file shrank - `--update-baseline` lowers
//            the entry so the tolerance applies to the new count
//
// File set = git's view: tracked plus untracked-but-not-ignored files, minus
// locally deleted ones - a local run counts the same set as CI.
//
// Baseline: scripts/file-size-baseline.txt, one line "<file>|<lines>". Comment
// lines ("# ...") directly above an entry belong to it (the reason) and survive
// a regeneration. `--update-baseline` only LOWERS: it removes entries without a
// finding and writes shrunk counts. A higher count or a new entry is a manual
// edit with a reason line - visible in the diff, never a side effect. Only
// exception: if no baseline exists yet, the first `--update-baseline` run writes
// the existing backlog (do that once when adopting the guard on an existing
// code base). `--top` lists the ten largest files.
// Exit codes: 0 clean, 1 findings, 2 environment problem.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// --- ADAPT: scope and thresholds -------------------------------------------------
const SOURCE_ROOTS = ["src/", "app/", "lib/", "cmd/", "internal/", "pkg/"] // repo-relative prefixes
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rs|java|kt|cs|rb|php|swift)$/
const LINE_LIMIT = 1_000 // physical lines per file
const GROWTH_TOLERANCE = 0.02 // allowed growth of a baseline file

const REPO_ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."))
const BASELINE = join(REPO_ROOT, "scripts", "file-size-baseline.txt")
const UPDATE = process.argv.includes("--update-baseline")
const TOP = process.argv.includes("--top")

const fmt = (n) => n.toLocaleString("en-US")
const allowedFor = (recorded) => Math.floor(recorded * (1 + GROWTH_TOLERANCE))

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
    console.error("File-size check: `git ls-files` failed - the guard needs a git checkout.")
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

/** Physical lines: newlines plus an unterminated last line. */
function physicalLines(text) {
  if (text.length === 0) return 0
  let n = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return text.endsWith("\n") ? n : n + 1
}

// --- Count -------------------------------------------------------------------------
const deletedFiles = new Set(gitLsFiles(["--deleted"]))
const sourceFiles = gitLsFiles(["--cached", "--others", "--exclude-standard"])
  .filter((p) => SOURCE_ROOTS.some((r) => p.startsWith(r)) && SOURCE_EXT.test(p) && !deletedFiles.has(p))
  .sort()
const lines = new Map(sourceFiles.map((p) => [p, physicalLines(readFileSync(join(REPO_ROOT, p), "utf8"))]))

// --- Baseline ----------------------------------------------------------------------
// { header: string[], entries: { file, recorded, comments: string[] }[] }
function readBaseline() {
  if (!existsSync(BASELINE)) return null
  const raw = readFileSync(BASELINE, "utf8").split(/\r?\n/)
  const header = []
  const entries = []
  let i = 0
  // Header = the first comment block up to the first blank line.
  while (i < raw.length && raw[i].startsWith("#")) header.push(raw[i++])
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
    const m = /^(.+)\|(\d+)$/.exec(line)
    if (!m) {
      console.error(`File-size check: unreadable baseline line ${i + 1}: ${line}`)
      process.exit(2)
    }
    entries.push({ file: m[1].trim(), recorded: Number(m[2]), comments: pending })
    pending = []
  }
  return { header, entries }
}

const DEFAULT_HEADER = [
  "# scripts/file-size-baseline.txt",
  `# Tolerated backlog of the file-size guard: source files above ${fmt(LINE_LIMIT)} lines.`,
  "# One line <file>|<lines>; comments directly above an entry are its reason.",
  `# An entry may grow at most ${Math.round(GROWTH_TOLERANCE * 100)} % above its count. The file only shrinks:`,
  "# `node scripts/check-file-size.mjs --update-baseline` removes resolved entries and lowers shrunk counts;",
  "# a higher count or a new entry is a manual edit with a reason line.",
]

function writeBaseline(header, entries) {
  const out = [...header, ""]
  for (const e of entries) out.push(...e.comments, `${e.file}|${e.recorded}`)
  out.push("")
  writeFileSync(BASELINE, out.join("\n"))
}

// --- Evaluate ----------------------------------------------------------------------
function evaluate(entries) {
  const byFile = new Map(entries.map((e) => [e.file, e]))
  const findings = [] // { rule, file, msg }
  const shrunk = [] // { file, recorded, now }
  for (const [file, n] of lines) {
    const e = byFile.get(file)
    if (!e) {
      if (n > LINE_LIMIT) {
        findings.push({ rule: "size", file, msg: `${fmt(n)} lines > limit ${fmt(LINE_LIMIT)}, not in the baseline - split the file` })
      }
      continue
    }
    if (n > allowedFor(e.recorded)) {
      const pct = ((n / e.recorded - 1) * 100).toFixed(1)
      findings.push({
        rule: "size",
        file,
        msg: `${fmt(n)} lines, baseline ${fmt(e.recorded)} (+${pct} %, allowed up to ${fmt(allowedFor(e.recorded))}) - baseline files may only shrink`,
      })
    } else if (n < e.recorded && n > LINE_LIMIT) {
      shrunk.push({ file, recorded: e.recorded, now: n })
    }
  }
  for (const e of entries) {
    const n = lines.get(e.file)
    if (n === undefined) {
      findings.push({ rule: "stale", file: e.file, msg: "baseline entry without a file (deleted or renamed)" })
    } else if (n <= LINE_LIMIT) {
      findings.push({ rule: "stale", file: e.file, msg: `${fmt(n)} lines - back under the limit, remove the entry` })
    }
  }
  return { findings, shrunk }
}

let baseline = readBaseline()

if (UPDATE) {
  if (baseline === null) {
    // First run: write the existing backlog - never automatically again.
    const entries = [...lines]
      .filter(([, n]) => n > LINE_LIMIT)
      .sort((a, b) => b[1] - a[1])
      .map(([file, n]) => ({ file, recorded: n, comments: [] }))
    writeBaseline(DEFAULT_HEADER, entries)
    console.log(`Baseline created: ${entries.length} entries (scripts/file-size-baseline.txt)`)
  } else {
    const kept = []
    let removed = 0
    let lowered = 0
    for (const e of baseline.entries) {
      const n = lines.get(e.file)
      if (n === undefined || n <= LINE_LIMIT) {
        removed++
        continue
      }
      if (n < e.recorded) {
        lowered++
        kept.push({ ...e, recorded: n })
      } else {
        kept.push(e) // never raise - growth is a manual edit
      }
    }
    writeBaseline(baseline.header.length ? baseline.header : DEFAULT_HEADER, kept)
    console.log(`Baseline updated: ${removed} removed, ${lowered} lowered, ${kept.length} entries (scripts/file-size-baseline.txt)`)
  }
  baseline = readBaseline()
}

const entries = baseline?.entries ?? []
const { findings, shrunk } = evaluate(entries)

if (TOP) {
  const top = [...lines].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`Largest source files (${SOURCE_ROOTS.join(", ")}):`)
  for (const [file, n] of top) {
    const e = entries.find((x) => x.file === file)
    console.log(`  ${String(n).padStart(6)}  ${file}${e ? `  (baseline ${e.recorded})` : ""}`)
  }
}

const summary = `${fmt(lines.size)} source files, limit ${fmt(LINE_LIMIT)} lines, ${entries.length} baseline entries`
if (shrunk.length > 0) {
  console.log(`Note: ${shrunk.length} baseline file(s) shrank - \`node scripts/check-file-size.mjs --update-baseline\` lowers the entry:`)
  for (const s of shrunk) console.log(`    ${s.file}  ${fmt(s.recorded)} -> ${fmt(s.now)}`)
}
if (findings.length === 0) {
  console.log(`File-size check: 0 findings (${summary})`)
  process.exit(0)
}
console.error(`\nFile-size check: ${findings.length} finding(s) (${summary}):`)
for (const f of findings) console.error(`    [${f.rule}]  ${f.file}  - ${f.msg}`)
if (findings.some((f) => f.rule === "stale")) {
  console.error("  [stale] fix: node scripts/check-file-size.mjs --update-baseline")
}
process.exit(1)
