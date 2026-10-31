#!/usr/bin/env node
// scripts/check-bugs.mjs
// Bug index guard - a dependency-free check of docs/bugs/.
// Blocking CI step in .github/workflows/ci.yml; locally: `node scripts/check-bugs.mjs`.
//
// The truth is the bug FILES plus the "Bug history" table in docs/bugs/INDEX.md;
// the Status block at the top of INDEX.md is a DERIVED view of that table.
// Hand-maintained counters drift: a skill that bumps "+1 open / -1 open" on every
// write has no way back once a single write is missed or doubled, and the header
// then contradicts the table without anyone noticing. The /bug skill recounts the
// block from the table on every write; this guard makes that consistency (and
// every other fact that is written down twice: row <-> file, status <-> location)
// machine-checked instead of merely conventional.
//
// Rules:
//   [table]   the history table is readable: a header row "| ID | ..." with the
//             columns "Closed on" and "Close note"; every row starts with
//             "| [BUG-NNNN](<path>) |" at the very start of the line and has the
//             header's cell count; the Close note starts with exactly one status
//             (Open / Fixed / Won't Fix); "Closed on" is "-" for Open and a
//             YYYY-MM-DD date for Fixed / Won't Fix
//   [dup]     every BUG ID has at most one history row
//   [sort]    history rows are sorted by ID descending (newest on top)
//   [counts]  the Status block (Open bugs / Fixed bugs / Won't Fix) equals the rows
//             per status, recounted from the table; an optional
//             "Next Available ID: BUG-NNNN" line equals the highest ID + 1
//   [place]   status <-> location: Open = flat in docs/bugs/, Fixed / Won't Fix =
//             docs/bugs/archive/<YYYY-QN>/ with QN = quarter of the close date;
//             also bug files in any other place, quarter folders not named
//             YYYY-QN, and file names that are not bug-NNNN-<slug>.md
//   [parity]  table <-> files in both directions: every row's link resolves to the
//             bug file of that ID, every bug file has a row, one file per ID
//   [status]  the **Status:** field IN the bug file matches the row, incl. the
//             close date ("Fixed (YYYY-MM-DD)" vs. "Closed on"). ALL top-level
//             "**Status:**" lines outside code blocks are read and must agree -
//             reading only the first one would let a second, contradicting line
//             (e.g. a summary inserted above the header block) go unnoticed
//
// Why columns and not "a status word anywhere in the row": the status words are
// plain English and also appear in titles and notes. The status is therefore read
// from the start of the "Close note" cell, located by its header name - a project
// may add columns (e.g. Severity). Cells split on unescaped "|" exactly like
// GitHub's table renderer splits them - also inside code spans; a literal pipe in
// a cell is written "\|".
//
// Two data sources, the same rules:
//   (no argument)      the working tree - the default, and what CI runs
//   --commit [<rev>]   the tree of a commit (default HEAD), read via git
// Why the commit mode: `git commit --only <paths>` commits the working-tree state
// of the NAMED paths, regardless of the index and of what was checked before.
// When parallel sessions share one working tree and both touch the shared
// INDEX.md, a history row and its bug file can land in different commits: the
// working tree is consistent, the commit is not. In CI the working tree equals
// the pushed commit, so the gap exists only locally - exactly where commits are
// made. A pre-commit hook cannot close it (it runs before the commit's tree
// exists), a --staged mode neither (--only bypasses the index); only a check of
// the finished commit can: `node scripts/check-bugs.mjs --commit` after committing.
//
// File set = git's view: in the working tree tracked plus untracked-but-not-
// ignored files minus locally deleted ones (a new bug file counts before
// `git add`); in commit mode the commit's tree. No docs/bugs/INDEX.md and no bug
// files (a project without bug tracking) -> nothing to check, exit 0 with a note.
// Exit codes: 0 clean, 1 findings, 2 environment problem (not a git checkout,
// unknown revision, unknown argument).
//
// Convention: .claude/skills/bug/SKILL.md. Out of scope (deliberately): links
// inside the bug files (scripts/check-md-links.mjs), the bug-file format beyond
// the **Status:** field, the "Last updated" date.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."))
const BUGS = "docs/bugs"
const ARCHIVE = `${BUGS}/archive/`
const INDEX = `${BUGS}/INDEX.md`
const CONVENTION = ".claude/skills/bug/SKILL.md"
const TITLE = "Bug index check"

// Status vocabulary. Order = order of the counter rows in the Status block.
const STATES = [
  { key: "open", word: "Open", label: "Open bugs", closed: false },
  { key: "fixed", word: "Fixed", label: "Fixed bugs", closed: true },
  { key: "wontfix", word: "Won't Fix", label: "Won't Fix", closed: true },
]
const WORDS = STATES.map((s) => s.word).join(" / ")
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// A status word must stand alone: "Fixed - <note>" counts, "Fixedness" does not.
const STATUS_SRC = `^(${STATES.map((s) => escapeRe(s.word)).join("|")})(?![\\w'])`
const STATUS_AT_START = new RegExp(STATUS_SRC)
// In the bug file: "Open", "Fixed (YYYY-MM-DD)", "Won't Fix (YYYY-MM-DD)".
const FILE_STATUS = new RegExp(`${STATUS_SRC}(?:\\s*\\((\\d{4}-\\d{2}-\\d{2})\\))?`)
const stateOf = (word) => STATES.find((s) => s.word === word)

// -----------------------------------------------------------------------------
// Arguments
// -----------------------------------------------------------------------------
const USAGE = `Usage:
  node scripts/check-bugs.mjs                 check the working tree (default)
  node scripts/check-bugs.mjs --commit        check the tree of HEAD
  node scripts/check-bugs.mjs --commit <rev>  check the tree of <rev>`

const envFail = (msg) => {
  console.error(`${TITLE}: ${msg}`)
  process.exit(2)
}

let commitRef = null
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (arg === "-h" || arg === "--help") {
    console.log(USAGE)
    process.exit(0)
  }
  if (arg === "--commit") {
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith("-")) {
      commitRef = next
      i += 1
    } else {
      commitRef = "HEAD"
    }
    continue
  }
  if (arg.startsWith("--commit=")) {
    commitRef = arg.slice("--commit=".length) || "HEAD"
    continue
  }
  // Unknown arguments are an error, never ignored: a typo ("--comit HEAD") would
  // otherwise silently check the working tree and report green - a promise the
  // guard would not keep at exactly the point it was asked for.
  envFail(`unknown argument '${arg}'.\n\n${USAGE}`)
}

// -----------------------------------------------------------------------------
// Data sources - both deliver the same shape: the repo-relative paths under
// docs/bugs/ and a reader for their contents. Every rule below works on that
// shape only and does not know where it came from.
// -----------------------------------------------------------------------------
const git = (args, opts = {}) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: REPO_ROOT,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  })
// `-z` is mandatory: without NUL separation git quotes non-ASCII names in octal.
const gitPaths = (args) =>
  git(args, { encoding: "utf8" })
    .split("\0")
    .filter((p) => p !== "")
const gitError = (err) => String(err?.stderr || err?.message || err).trim()

function worktreeSource() {
  let listed
  let deleted
  try {
    deleted = new Set(gitPaths(["ls-files", "-z", "--deleted", "--", BUGS]))
    listed = gitPaths(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", BUGS])
  } catch (err) {
    envFail(`\`git ls-files\` failed - the guard needs a git checkout.\n${gitError(err)}`)
  }
  return {
    label: "working tree",
    paths: [...new Set(listed)].filter((p) => !p.endsWith("/") && !deleted.has(p)),
    read: (paths) => {
      const out = new Map()
      for (const p of paths) {
        try {
          out.set(p, readFileSync(join(REPO_ROOT, p), "utf8"))
        } catch {
          // unreadable -> treated as missing by the caller
        }
      }
      return out
    },
  }
}

// One `git show` per file would be one process start per bug (seconds on
// Windows for a long history). `git cat-file --batch` reads the whole set in ONE
// process. Answer per request: "<sha> blob <size>" LF <size bytes> LF; for an
// unknown object "<request> missing" LF without content.
function gitBatchRead(sha, paths) {
  const out = new Map()
  if (paths.length === 0) return out
  const buf = git(["cat-file", "--batch"], { input: paths.map((p) => `${sha}:${p}`).join("\n") + "\n" })
  let pos = 0
  for (const p of paths) {
    const nl = buf.indexOf(0x0a, pos)
    if (nl === -1) break
    const m = / blob (\d+)$/.exec(buf.subarray(pos, nl).toString("utf8"))
    if (!m) {
      pos = nl + 1
      continue
    }
    const size = Number(m[1])
    out.set(p, buf.subarray(nl + 1, nl + 1 + size).toString("utf8"))
    pos = nl + 1 + size + 1
  }
  return out
}

function commitSource(rev) {
  let sha = ""
  try {
    sha = git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { encoding: "utf8" }).trim()
  } catch {
    // reported below
  }
  if (!sha) envFail(`cannot resolve commit '${rev}' - is this a git checkout, and is the revision known?`)
  const short = sha.slice(0, 10)
  let paths
  try {
    paths = gitPaths(["ls-tree", "-r", "-z", "--name-only", sha, "--", BUGS])
  } catch (err) {
    envFail(`\`git ls-tree\` failed for '${rev}'.\n${gitError(err)}`)
  }
  return {
    label: short.startsWith(rev) || rev.startsWith(short) ? `commit ${short}` : `commit ${rev} = ${short}`,
    paths,
    read: (ps) => gitBatchRead(sha, ps),
  }
}

const source = commitRef === null ? worktreeSource() : commitSource(commitRef)

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------
const findings = []
const add = (rule, path, line, msg, fix) => findings.push({ rule, path, line, msg, fix })
const clip = (t) => (t.length > 60 ? `${t.slice(0, 57)}...` : t)

function report(summary) {
  if (findings.length === 0) {
    console.log(`${TITLE} (${source.label}): 0 findings (${summary})`)
    process.exit(0)
  }
  findings.sort((a, b) => (a.path !== b.path ? (a.path < b.path ? -1 : 1) : (a.line ?? 0) - (b.line ?? 0)))
  console.error(`${TITLE} (${source.label}): ${findings.length} finding(s)\n`)
  for (const f of findings) {
    console.error(`${f.line ? `${f.path}:${f.line}` : f.path}  [${f.rule}]  ${f.msg}`)
    console.error(`    -> ${f.fix}`)
  }
  console.error(`\nConvention: ${CONVENTION}`)
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Bug files - the two locations of the convention: flat in docs/bugs/ (Open)
// and docs/bugs/archive/<YYYY-QN>/ (Fixed / Won't Fix). Anything else that is
// named like a bug file is a [place] finding, but still takes part in [parity]
// and [status], so one mistake does not hide a second one.
// -----------------------------------------------------------------------------
const LOOKS_LIKE_BUG = /^bug-.+\.md$/i
const ID_IN_NAME = /^bug-(\d{4})-/i
const FILE_NAME = /^bug-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const QUARTER = /^\d{4}-Q[1-4]$/

const candidates = []
for (const p of source.paths) {
  if (!p.startsWith(`${BUGS}/`)) continue
  const parts = p.slice(BUGS.length + 1).split("/")
  const name = parts[parts.length - 1]
  if (!LOOKS_LIKE_BUG.test(name)) continue
  const idm = ID_IN_NAME.exec(name)
  if (!idm) {
    add("place", p, null, `'${name}' is named like a bug file but does not start with 'bug-NNNN-'.`, "Name it bug-NNNN-<slug>.md, NNNN = the 4-digit ID of its history row.")
    continue
  }
  if (!FILE_NAME.test(name)) {
    add("place", p, null, `File name '${name}' does not follow bug-NNNN-<slug>.md (lowercase kebab-case slug).`, "Rename it with 'git mv' and update its link in docs/bugs/INDEX.md.")
  }
  let where = "elsewhere"
  if (parts.length === 1) {
    where = "flat"
  } else if (parts.length === 3 && parts[0] === "archive") {
    where = "archive"
    if (!QUARTER.test(parts[1])) {
      add("place", p, null, `Archive folder '${parts[1]}' is not a quarter (YYYY-QN, e.g. 2026-Q3).`, "Move the file into archive/<YYYY-QN>/ of its close date with 'git mv' and update its link in INDEX.md.")
    }
  } else {
    add("place", p, null, "Bug file outside the two locations of the convention.", "Open bugs live flat in docs/bugs/, closed ones in docs/bugs/archive/<YYYY-QN>/ - move it with 'git mv' and update its link in INDEX.md.")
  }
  candidates.push({ id: idm[1], path: p, where })
}

// Deterministic order (flat, archive, elsewhere; then by path) - both data
// sources give the same output for the same content. No localeCompare: the
// order must not follow the locale of the machine.
const RANK = { flat: 0, archive: 1, elsewhere: 2 }
candidates.sort((a, b) => RANK[a.where] - RANK[b.where] || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

const files = new Map() // id -> { path, where, state, entries }
for (const c of candidates) {
  const prev = files.get(c.id)
  if (prev) {
    add("parity", c.path, null, `BUG-${c.id} exists twice (also: ${prev.path}).`, "Remove one of the two files - exactly one file per bug.")
    continue
  }
  files.set(c.id, { path: c.path, where: c.where })
}

const hasIndex = source.paths.includes(INDEX)
const bodies = source.read([...(hasIndex ? [INDEX] : []), ...[...files.values()].map((f) => f.path)])

if (!hasIndex) {
  if (files.size === 0) {
    console.log(`${TITLE} (${source.label}): no ${INDEX} - nothing to check.`)
    process.exit(0)
  }
  add("parity", INDEX, null, `${files.size} bug file(s) under ${BUGS}/, but no INDEX.md.`, `Restore ${INDEX} (initial structure: ${CONVENTION}) with one history row per bug file.`)
  report("")
}
const indexText = bodies.get(INDEX)
if (indexText === undefined) envFail(`${INDEX} is listed but not readable.`)

// -----------------------------------------------------------------------------
// [status] (file side) - every top-level "**Status:**" line outside code blocks.
// Nested bullets are not status fields (they may describe something else).
// -----------------------------------------------------------------------------
const FENCE = /^\s*(```|~~~)/
const STATUS_LINE = /^(?:[-*+]\s+)?\*\*Status:\*\*\s*(.*)$/

function statusEntries(text) {
  const entries = []
  let fence = null
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((l, i) => {
      const f = FENCE.exec(l)
      if (f) {
        if (fence === null) fence = f[1]
        else if (f[1] === fence) fence = null
        return
      }
      if (fence !== null) return
      const m = STATUS_LINE.exec(l)
      if (!m) return
      const value = m[1].trim()
      const sm = FILE_STATUS.exec(value)
      entries.push({ line: i + 1, value, state: sm ? stateOf(sm[1]) : null, date: sm?.[2] ?? null })
    })
  return entries
}

for (const [id, file] of files) {
  const body = bodies.get(file.path)
  if (body === undefined) {
    add("parity", file.path, null, `BUG-${id}: the file is listed but not readable.`, "Check the file (permissions, encoding, a broken symlink).")
    continue
  }
  const entries = statusEntries(body)
  file.entries = entries
  if (entries.length === 0) {
    add("status", file.path, null, "No '**Status:**' field in the bug file.", "Add '- **Status:** Open' (or 'Fixed (YYYY-MM-DD)' / \"Won't Fix (YYYY-MM-DD)\") to the header block.")
    continue
  }
  for (const e of entries.filter((x) => x.state === null)) {
    add("status", file.path, e.line, `'**Status:** ${clip(e.value)}' does not start with a status (${WORDS}).`, "Start the field with exactly one status word.")
  }
  const distinct = [...new Set(entries.filter((e) => e.state).map((e) => e.state))]
  if (distinct.length > 1) {
    const list = distinct.map((s) => `'${s.word}' (line ${entries.find((e) => e.state === s).line})`).join(" vs. ")
    add("status", file.path, entries[0].line, `The '**Status:**' lines contradict each other: ${list}.`, "Bring every '**Status:**' line of the file to the same status - the guard reads all of them, not just the first.")
    continue
  }
  if (distinct.length === 0) continue
  file.state = distinct[0]
  if (file.state.closed) {
    for (const e of entries.filter((x) => x.state && !x.date)) {
      add("status", file.path, e.line, `'${file.state.word}' without its close date.`, `Write '**Status:** ${file.state.word} (YYYY-MM-DD)' - the date decides the archive quarter.`)
    }
  }
  // [place] (file side): the file's own status against the folder it sits in.
  if (file.where === "archive" && !file.state.closed) {
    add("place", file.path, entries[0].line, "An Open bug lies in the archive.", "Archived bugs never move back (no reopens): if it was closed, restore its closed status; for a follow-up problem file a new bug. A bug that was never closed belongs flat in docs/bugs/.")
  } else if (file.where === "flat" && file.state.closed) {
    add("place", file.path, entries[0].line, `A '${file.state.word}' bug still lies flat in docs/bugs/.`, "Move it with 'git mv' into docs/bugs/archive/<YYYY-QN>/ (quarter of the close date) and update its link in INDEX.md.")
  }
}

// -----------------------------------------------------------------------------
// INDEX.md - history table
// -----------------------------------------------------------------------------
const lines = indexText.replace(/^﻿/, "").split(/\r?\n/)

// Cells split on every unescaped "|" - like GitHub's renderer, code spans included.
function splitCells(line) {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1)
  const cells = []
  let cur = ""
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "\\|"
      i += 1
    } else if (s[i] === "|") {
      cells.push(cur.trim())
      cur = ""
    } else {
      cur += s[i]
    }
  }
  cells.push(cur.trim())
  return cells
}

const headerIdx = lines.findIndex((l) => l.startsWith("|") && splitCells(l)[0] === "ID")
if (headerIdx === -1) {
  add("table", INDEX, null, "No 'Bug history' table header found (a row starting with '| ID |').", `Restore the table header from the initial structure in ${CONVENTION}.`)
  report("")
}
const header = splitCells(lines[headerIdx])
const colClosed = header.indexOf("Closed on")
const colNote = header.indexOf("Close note")
for (const [col, name] of [[colClosed, "Closed on"], [colNote, "Close note"]]) {
  if (col === -1) add("table", INDEX, headerIdx + 1, `The history table header lacks the column '${name}'.`, `Restore the header from the initial structure in ${CONVENTION}.`)
}
if (colClosed === -1 || colNote === -1) report("")

const NO_DATE = new Set(["-", "–", "—", ""])
const isDate = (t) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const d = new Date(`${t}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t
}
const quarterOf = (date) => `${date.slice(0, 4)}-Q${Math.ceil(Number(date.slice(5, 7)) / 3)}`

function resolveHref(href) {
  let h = href.split("#")[0]
  try {
    h = decodeURIComponent(h)
  } catch {
    // keep as written
  }
  return posix.normalize(posix.join(BUGS, h))
}

// The pre-filter is deliberately WIDER than the form [table] demands: anything
// that LOOKS like a bug row (indented, escaped "\|", "Bug-", a short ID, no link)
// must also have the form - otherwise a malformed row would be invisible to
// [dup], [sort], [counts] and [parity], and a bug could vanish from the index.
const ROW = /^\|\s*\[BUG-(\d{4})\]\(([^)\s]+)\)\s*\|/
const ROW_LIKE = /^\s*\\?\|\s*\[?bug-\d/i
const rows = []
let rowsReadable = true
lines.forEach((l, i) => {
  if (!ROW_LIKE.test(l)) return
  const lineNo = i + 1
  const m = ROW.exec(l)
  if (!m) {
    rowsReadable = false
    add("table", INDEX, lineNo, "History row not parsable - its start deviates (indentation, escaped '|', 'BUG' spelling, 4-digit ID or the link).", "Form: '| [BUG-NNNN](<path>) | <title> | ... |' at the very start of the line.")
    return
  }
  const [, id, href] = m
  const row = { id, href, target: resolveHref(href), line: lineNo, state: null, closedOn: null }
  rows.push(row)
  const cells = splitCells(l)
  if (cells.length !== header.length) {
    rowsReadable = false
    add("table", INDEX, lineNo, `BUG-${id}: ${cells.length} cells, the header has ${header.length}.`, "A literal '|' inside a cell (also inside `code`) splits it - write it as '\\|'.")
    return
  }
  const note = cells[colNote]
  const sm = STATUS_AT_START.exec(note)
  if (!sm) {
    rowsReadable = false
    add("table", INDEX, lineNo, `BUG-${id}: Close note '${clip(note)}' does not start with a status (${WORDS}).`, "Start the Close note with exactly one status word, e.g. 'Fixed - <note>' - the counters are derived from it.")
    return
  }
  row.state = stateOf(sm[1])
  const closedOn = cells[colClosed]
  if (row.state.closed) {
    if (isDate(closedOn)) row.closedOn = closedOn
    else add("table", INDEX, lineNo, `BUG-${id} is '${row.state.word}', but 'Closed on' is '${clip(closedOn)}'.`, "A closed bug carries its close date (YYYY-MM-DD) in 'Closed on'.")
  } else if (!NO_DATE.has(closedOn)) {
    add("table", INDEX, lineNo, `BUG-${id} is 'Open', but 'Closed on' is '${clip(closedOn)}'.`, "An open bug has '-' in 'Closed on'. No reopens: a closed bug stays closed - a follow-up problem is a new bug.")
  }
})

// -----------------------------------------------------------------------------
// [dup] + [sort]
// -----------------------------------------------------------------------------
const byId = new Map()
for (const r of rows) {
  const prev = byId.get(r.id)
  if (prev) add("dup", INDEX, r.line, `BUG-${r.id} has a second history row (first one: line ${prev.line}).`, "Remove the duplicate row - one row per bug, changed in place.")
  else byId.set(r.id, r)
}
// Every misplacement is reported, not only the first: one misplaced row yields at
// most two findings, and a single run shows the whole picture.
for (let i = 1; i < rows.length; i++) {
  if (Number(rows[i].id) > Number(rows[i - 1].id)) {
    add("sort", INDEX, rows[i].line, `BUG-${rows[i].id} stands below BUG-${rows[i - 1].id} - the table is sorted by ID descending.`, "Move the row to its position (newest on top).")
  }
}

// -----------------------------------------------------------------------------
// [place] (row side) + [parity] row -> file + [status] row <-> file
// -----------------------------------------------------------------------------
for (const r of rows) {
  if (r.state) {
    const inArchive = r.target.startsWith(ARCHIVE)
    if (r.state.closed !== inArchive) {
      add(
        "place",
        INDEX,
        r.line,
        `BUG-${r.id} is '${r.state.word}', but the link points to '${r.href}'.`,
        r.state.closed
          ? "Closed bugs live in archive/<YYYY-QN>/ - 'git mv' the file there and update the link."
          : "Open bugs live flat in docs/bugs/ - the link is 'bug-NNNN-<slug>.md'.",
      )
    } else if (r.state.closed && r.closedOn) {
      const quarter = quarterOf(r.closedOn)
      const linked = r.target.slice(ARCHIVE.length).split("/")[0]
      if (linked !== quarter) {
        add("place", INDEX, r.line, `BUG-${r.id} was closed on ${r.closedOn} (quarter ${quarter}), but the link points to archive/${linked}/.`, `The archive quarter is the quarter of the close date - 'git mv' the file into archive/${quarter}/ and update the link.`)
      }
    }
  }

  const file = files.get(r.id)
  if (!file) {
    add("parity", INDEX, r.line, `BUG-${r.id} has a history row, but no bug file (the link '${r.href}' resolves to none).`, "Create the bug file, or correct the link to the existing file.")
    continue
  }
  if (file.path !== r.target) {
    add("parity", INDEX, r.line, `BUG-${r.id}: the link points to '${r.href}', the bug file is '${file.path.slice(BUGS.length + 1)}'.`, "Point the ID link at the actual file (path relative to docs/bugs/).")
  }
  if (!r.state || !file.state) continue
  const statusLine = file.entries[0].line
  if (file.state !== r.state) {
    add("status", file.path, statusLine, `The file says '${file.state.word}', the history row (${INDEX}:${r.line}) says '${r.state.word}'.`, "Bring both to the same status (closing a bug: /bug close).")
    continue
  }
  if (r.closedOn) {
    for (const e of file.entries.filter((x) => x.date && x.date !== r.closedOn)) {
      add("status", file.path, e.line, `The file closes on ${e.date}, the history row (${INDEX}:${r.line}) on ${r.closedOn}.`, "Use the same close date in both places.")
    }
  }
}

// -----------------------------------------------------------------------------
// [parity] file -> row
// -----------------------------------------------------------------------------
for (const [id, file] of files) {
  if (!byId.has(id)) {
    add("parity", file.path, null, `BUG-${id} has a bug file, but no history row in ${INDEX}.`, "Add its row to the Bug history (sorted by ID descending) and recount the Status block.")
  }
}

// -----------------------------------------------------------------------------
// [counts] - Status block (above the history table) recounted from the rows.
// Skipped while a row is unreadable: its status is unknown, so a recount would
// produce a misleading second finding for the same cause.
// -----------------------------------------------------------------------------
const counted = Object.fromEntries(STATES.map((s) => [s.key, rows.filter((r) => r.state === s).length]))
if (rowsReadable) {
  const counters = new Map()
  for (let i = 0; i < headerIdx; i++) {
    if (!lines[i].startsWith("|")) continue
    const c = splitCells(lines[i])
    if (c.length >= 2 && !counters.has(c[0])) counters.set(c[0], { value: c[1], line: i + 1 })
  }
  for (const s of STATES) {
    const expected = String(counted[s.key])
    const entry = counters.get(s.label)
    if (!entry) {
      add("counts", INDEX, null, `The Status block lacks the row '${s.label}'.`, `Add '| ${s.label} | ${expected} |' to the Status block.`)
    } else if (entry.value !== expected) {
      add("counts", INDEX, entry.line, `'${s.label}' says '${clip(entry.value)}', the history table counts ${expected}.`, "Derive the Status block from the table on every write (count the rows per status) - never bump it incrementally.")
    }
  }
}

// Optional: a "Next Available ID: BUG-NNNN" line (not part of the shipped INDEX).
const NEXT = /Next Available ID:\s*\**\s*BUG-(\d+)/i
const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id)), 0)
const nextId = `BUG-${String(maxId + 1).padStart(4, "0")}`
lines.forEach((l, i) => {
  const m = NEXT.exec(l)
  if (m && `BUG-${m[1]}` !== nextId) {
    add("counts", INDEX, i + 1, `'Next Available ID' says BUG-${m[1]}, the table's highest ID + 1 is ${nextId}.`, "Derive it from the table (highest ID + 1) - IDs are never reused.")
  }
})

// -----------------------------------------------------------------------------
// Output - the checked state is IN the message: a guard that does not say WHAT
// it checked invites reading a green working-tree run as "the commit is fine".
// -----------------------------------------------------------------------------
report(`${rows.length} bug(s): ${STATES.map((s) => `${counted[s.key]} ${s.word}`).join(", ")}`)
