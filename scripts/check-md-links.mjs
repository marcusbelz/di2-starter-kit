#!/usr/bin/env node
// scripts/check-md-links.mjs
// Markdown link check - a dependency-free guard over every *.md in the repo.
// Blocking CI step in .github/workflows/ci.yml; locally: `node scripts/check-md-links.mjs`.
//
// It checks one thing only: that the TARGET of every relative markdown link
// `](<path>)` EXISTS, resolved from the file that contains the link. New dead
// links fail the run; a known backlog may live in the baseline and is tolerated
// until it is worked off.
//
// A dead link is classified and the fix is printed with it:
//   [depth]    resolves with a different number of ../  -> the FILE was moved,
//              its outgoing links were not adjusted
//   [moved]    target exists under a new path (basename unique in the repo)
//              -> the TARGET was moved, incoming links were not adjusted
//   [gone]     target exists nowhere (or the basename is ambiguous) -> check by hand
//   [absolute] target starts with "/" -> resolves in no checkout (GitHub reads it
//              repo-root-relative, an editor file-system-absolute); write it
//              relative to the source file
//   [stale]    a baseline entry whose link resolves again -> regenerate the baseline
//
// Rule: .claude/rules/documentation.md, section "Archiving pulls the links along".
//
// Baseline: scripts/md-links-baseline.txt (one line "<file>|<target>").
// Regenerate after a sweep: `node scripts/check-md-links.mjs --update-baseline`.
// The baseline only shrinks: an entry whose link lives again is itself a
// finding ([stale]), so adding a line is always a deliberate decision.
//
// Out of scope (deliberately): anchor targets ("#section"), external URLs, HTML
// anchor tags, links inside code blocks and code spans (those are examples, not
// references).
//
// File set = git's view: tracked plus untracked-but-not-ignored files
// (`git ls-files --cached --others --exclude-standard`, minus locally deleted
// ones). Ignored paths are invisible to the guard in both directions - as a
// SOURCE (their *.md are not scanned) and as a TARGET (a link to an ignored file
// is dead even if the file exists on this machine). A local run therefore gives
// the same result as a fresh CI checkout. Exit codes: 0 clean, 1 findings,
// 2 environment problem (not a git checkout).

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."))
const BASELINE = join(REPO_ROOT, "scripts", "md-links-baseline.txt")
const UPDATE = process.argv.includes("--update-baseline")

const MAX_DEPTH_PROBE = 6

// -----------------------------------------------------------------------------
// Repo index - paths repo-relative and POSIX (git returns them that way, also
// on Windows). `-z` is mandatory: without NUL separation git quotes non-ASCII
// names in octal and the path would not be found again.
// -----------------------------------------------------------------------------
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
    console.error("Markdown link check: `git ls-files` failed - the guard needs a git checkout.")
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

// Untracked nested checkouts are listed by git as "<dir>/" (one entry, not their
// content) - not a file entry, dropped here. Untracked files WITHOUT their own
// checkout stay in the scan on purpose: a new doc file is checked before `git add`.
const deleted = new Set(gitLsFiles(["--deleted"]))
const files = new Set(
  gitLsFiles(["--cached", "--others", "--exclude-standard"]).filter(
    (p) => !p.endsWith("/") && !deleted.has(p),
  ),
)

// For git, directories exist only implicitly (as a prefix of a file) - exactly
// like in a fresh checkout, where empty directories do not exist.
const dirs = new Set(["."])
for (const f of files) {
  for (let d = posix.dirname(f); d !== "." && !dirs.has(d); d = posix.dirname(d)) dirs.add(d)
}

const byBasename = new Map()
for (const f of files) {
  const base = posix.basename(f)
  if (!byBasename.has(base)) byBasename.set(base, [])
  byBasename.get(base).push(f)
}

const mdFiles = [...files].filter((f) => f.endsWith(".md")).sort()

// -----------------------------------------------------------------------------
// Link extraction - code blocks and code spans are masked so that example link
// syntax in backticks does not count as a reference.
// -----------------------------------------------------------------------------
const FENCE = /^\s*(```|~~~)/
// A target may contain balanced parentheses (CommonMark; file names like
// "… (3D, Whirl).html") - one level deep; an unbalanced ")" ends the link.
const LINK = /\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g
const BACKTICK = "`"

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

function* linksOf(file) {
  const lines = readFileSync(file, "utf8").split("\n")
  let inFence = false
  let fenceTok = null
  for (let idx = 0; idx < lines.length; idx++) {
    const m = FENCE.exec(lines[idx])
    if (m) {
      if (!inFence) {
        inFence = true
        fenceTok = m[1]
      } else if (m[1] === fenceTok) {
        inFence = false
        fenceTok = null
      }
      continue
    }
    if (inFence) continue
    const masked = maskCodeSpans(lines[idx])
    LINK.lastIndex = 0
    let lm
    while ((lm = LINK.exec(masked)) !== null) yield { line: idx + 1, target: lm[1] }
  }
}

const isExternal = (t) => /^(https?:|mailto:|#|<)/.test(t)

// Link target relative to the source file -> repo-relative POSIX path. `null`
// when the target leaves the repo (`../` above the root) or is absolute - both
// can never resolve in a checkout. A target with a trailing `/` must be a
// directory (that is also how `existsSync` behaves on Linux).
function targetOf(fromDir, rel) {
  let decoded
  try {
    decoded = decodeURIComponent(rel)
  } catch {
    decoded = rel
  }
  if (decoded.startsWith("/")) return null
  const wantsDir = decoded.endsWith("/")
  const path = posix.normalize(posix.join(fromDir, decoded)).replace(/\/+$/, "") || "."
  if (path === ".." || path.startsWith("../")) return null
  return { path, wantsDir }
}

function resolves(fromDir, rel) {
  const t = targetOf(fromDir, rel)
  if (t === null) return false
  if (t.wantsDir) return dirs.has(t.path)
  return files.has(t.path) || dirs.has(t.path)
}

// -----------------------------------------------------------------------------
// Classifying a dead link
// -----------------------------------------------------------------------------
// Link text for a suggestion: relative to the source file, square brackets
// URL-encoded (route folders like "[id]" would otherwise break the link syntax).
const relLink = (fromDir, target) =>
  posix.relative(fromDir, target).replace(/\[/g, "%5B").replace(/\]/g, "%5D")

function classify(fromDir, pathPart) {
  // Absolute target ("/README.md"): resolves in no checkout. If it exists from
  // the repo root, suggest the relative link; otherwise treat it like a missing
  // target (the rest of the classification then sees it without the leading "/").
  if (pathPart.startsWith("/")) {
    const rootRel = pathPart.replace(/^\/+/, "")
    const t = targetOf(".", rootRel)
    if (t !== null && resolves(".", rootRel)) {
      return {
        rule: "absolute",
        hint: `an absolute target resolves in no checkout - relative to the source file it would be: ](${relLink(fromDir, t.path)}${t.wantsDir ? "/" : ""})`,
      }
    }
    return classify(fromDir, rootRel)
  }

  const ups = /^((?:\.\.\/)*)(.*)$/.exec(pathPart)
  const current = ups[1].length / 3
  const rest = ups[2]

  const depthHits = []
  for (let k = 0; k <= MAX_DEPTH_PROBE; k++) {
    if (k !== current && resolves(fromDir, "../".repeat(k) + rest)) depthHits.push(k)
  }
  if (depthHits.length === 1) {
    return { rule: "depth", hint: `correct would be: ](${"../".repeat(depthHits[0])}${rest})` }
  }

  let base
  try {
    base = decodeURIComponent(pathPart)
  } catch {
    base = pathPart
  }
  base = base.split("/").pop()
  const cand = byBasename.get(base) ?? []
  if (cand.length === 1) {
    return { rule: "moved", hint: `correct would be: ](${relLink(fromDir, cand[0])})` }
  }
  if (cand.length > 1) {
    return { rule: "gone", hint: `basename ambiguous (${cand.length} hits) - determine the target by hand` }
  }
  return { rule: "gone", hint: "target exists nowhere in the repo - check or remove the link" }
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------
const baseline = new Set(
  existsSync(BASELINE)
    ? readFileSync(BASELINE, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [],
)

const dead = []
const seenKeys = new Set()
let linkCount = 0

for (const rel of mdFiles) {
  const fromDir = posix.dirname(rel)
  for (const { line, target } of linksOf(join(REPO_ROOT, rel))) {
    if (isExternal(target)) continue
    const pathPart = target.split("#")[0]
    if (!pathPart) continue
    linkCount++
    if (resolves(fromDir, pathPart)) continue
    const key = `${rel}|${pathPart}`
    seenKeys.add(key)
    dead.push({ file: rel, line, target: pathPart, key, ...classify(fromDir, pathPart) })
  }
}

if (UPDATE) {
  const keys = [...seenKeys].sort()
  const header = [
    "# scripts/md-links-baseline.txt",
    "# Known backlog of dead markdown links. One line per dead link: \"<file>|<target>\".",
    "# New dead links fail `node scripts/check-md-links.mjs`; the ones listed here are",
    "# tolerated until they are worked off. Regenerate after a sweep with",
    "# `node scripts/check-md-links.mjs --update-baseline` (the file shrinks - add",
    "# lines only after a deliberate decision).",
    "",
  ].join("\n")
  writeFileSync(BASELINE, `${header}${keys.join("\n")}${keys.length ? "\n" : ""}`, "utf8")
  console.log(`Baseline written: ${keys.length} known dead link(s) (scripts/md-links-baseline.txt)`)
  process.exit(0)
}

const fresh = dead.filter((d) => !baseline.has(d.key))
const stale = [...baseline].filter((k) => !seenKeys.has(k))

if (fresh.length === 0 && stale.length === 0) {
  console.log(
    `Markdown link check: 0 findings (${linkCount} links in ${mdFiles.length} files, ${baseline.size} known dead link(s) in the baseline)`,
  )
  process.exit(0)
}

if (fresh.length > 0) {
  console.error(`Markdown link check: ${fresh.length} new dead link(s)\n`)
  for (const f of fresh) {
    console.error(`${f.file}:${f.line}  [${f.rule}]  ](${f.target})`)
    console.error(`    -> ${f.hint}`)
  }
  console.error(`\nRule: .claude/rules/documentation.md, section "Archiving pulls the links along".`)
}

if (stale.length > 0) {
  console.error(
    `\nMarkdown link check: ${stale.length} baseline entr${stale.length === 1 ? "y resolves" : "ies resolve"} again - update the baseline:\n    node scripts/check-md-links.mjs --update-baseline\n`,
  )
  for (const k of stale.slice(0, 20)) console.error(`    [stale]  ${k}`)
  if (stale.length > 20) console.error(`    ... and ${stale.length - 20} more`)
}

process.exit(1)
