#!/usr/bin/env node
// scripts/check-testcases.mjs
// Test-case catalog guard - a dependency-free check of docs/test-cases/ and of the
// manual-only acceptance criteria in features/. Blocking CI step in
// .github/workflows/ci.yml; locally: `node scripts/check-testcases.mjs`.
//
// The truth is the file under cases/; INDEX.md and the suite overviews are DERIVED
// views. This guard compares the three lists in both directions - without it they
// drift apart reliably (every hand-maintained second list does). It also holds the
// catalog against the specs: an AC marked manual-only needs a DECLARED test case.
//
// Rules:
//   [naming]       cases/test-NNNN-<kebab-slug>.md, first line "# TEST-NNNN: <title>"
//                  with the same ID; IDs unique and without gaps (cases are retired,
//                  never deleted); nothing but test-*.md and .gitkeep in cases/
//   [immutable]    no subdirectory under cases/, no docs/test-cases/archive/ - test
//                  cases never move
//   [fields]       Suites / Run class (Smoke | Regression) / Status (Active |
//                  Retired (<reason>)) / Reference / Coverage (>= 1 entry, each a
//                  markdown link)
//   [format]       Goal / Precondition / Steps / Cleanup; the Steps table
//                  "| # | Step | Expected result |" with rows numbered 1..n and both
//                  cells filled ("-" for a step without an observation of its own)
//   [reference]    an active case's Reference names a spec ID or a BUG-NNNN; every spec
//                  ID has a spec file under features/, every "AC n" exists there as a
//                  numbered AC, every BUG-NNNN has a bug file under docs/bugs/
//   [suite-naming] suites/suite-NNN-<kebab-name>.md, first line "# SUITE-NNN: <name>"
//                  with the same number; no duplicate, no gap (suites are retired,
//                  never deleted)
//   [suite-layout] head "> **Status:** Active | Retired (<reason>)"; an active suite has
//                  exactly the sections Focus / Baseline / Execution / Test cases, the
//                  order line first in Execution, the table head
//                  "| # | ID | Title | Run class | Other suites |"
//   [suite-order]  positions 1..n in row order; ascending IDs when declared
//                  "ascending"; retired cases without position at the end; an active
//                  suite is not empty
//   [suite]        Suites: values have the form SUITE-NNN, ascending, with a file; an
//                  active case has >= 1 suite and none of them is retired
//   [overview]     suite table <-> cases in both directions (the case's Suites: field
//                  wins), plus link, title, run class and "Other suites" per row
//   [index]        INDEX tables <-> cases/ and suites/ in both directions: link, title,
//                  suites, run class, reference, status; suite link and name
//   [counts]       INDEX status block (active / retired / next free ID / from a bug /
//                  next free suite number) and active cases per suite
//   [run]          runs/YYYY-MM-DD-<env>[-<suffix>].md; head rows Date (= file date),
//                  Environment, Code state, Executed by, Occasion; a Results table
//                  "| Test case | Step | Result | Note |" whose rows name an existing case,
//                  PASS | FAIL | SKIP, PASS/FAIL on a single step (step level), FAIL with
//                  an existing BUG-NNNN, SKIP with a reason
//   [manual-ac]    (a) form: a manual-AC marker sits on a numbered AC and is exactly
//                  "*(manual-AC)*" or "*(manual-AC: <what to do>)*" at the end of the AC;
//                  (b) parity: once a spec has reached /ux (filled "## UX Design"
//                  section) - at the latest at status In Review / Deployed - every marked
//                  AC is named ("<spec ID> AC n") in the Reference of an ACTIVE case.
//                  AC-level, not spec-level: one alibi case for ten criteria fulfills
//                  nothing.
//   [ac-number]    numbered ACs of a spec are unique, and a spec does not mix numbered
//                  and unnumbered checkbox ACs (an unnumbered AC cannot be marked or
//                  referenced)
//   note           (non-blocking) active cases that appear in no run with PASS or FAIL -
//                  a written case is a promise, the backlog stays visible
//
// Not checked (deliberately): the existence of the Coverage targets and of every other
// link - that is `node scripts/check-md-links.mjs`; the four writing rules and whether a
// case was written before the code - judgment, owned by /ux and its build-gate deadline
// in /backend + /frontend (a check after the build sees that a file exists, not that the
// expectation came about independently).
//
// Gate mode: `node scripts/check-testcases.mjs --gate <spec-id>` (e.g. `--gate feat-0002`)
// is the build gate of /backend and /frontend. For THAT spec the [manual-ac] parity runs
// regardless of its status and of whether its "## UX Design" section is filled - /ux may
// have been skipped, and the build must still not start with a marked AC that has no
// ACTIVE case. All other checks run as usual. The last line is the gate result
// ("gate <spec-id>: N manual-only AC, all covered" or the uncovered AC numbers); exit 1
// when a marked AC of that spec is uncovered (or any other finding exists). Exit 2 for an
// unknown spec ID or a missing argument - and when there is no catalog at all: a gate is
// only requested by a project with a UI, and such a project must have one.
//
// No catalog: when docs/test-cases/ does not exist (a project without a UI - /init prunes
// it), the plain run reports that and exits 0; with --gate it exits 2 (see above).
//
// Convention: docs/test-cases/README.md. File set = git's view: tracked plus
// untracked-but-not-ignored files, minus locally deleted ones - a local run checks what a
// fresh CI checkout would. Exit codes: 0 clean, 1 findings, 2 environment problem or
// invalid --gate request.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."))
const CATALOG = "docs/test-cases"
const README_REF = "docs/test-cases/README.md"

const RUN_CLASSES = new Set(["Smoke", "Regression"])
const CASE_SECTIONS = ["Goal", "Precondition", "Cleanup"] // one-line labels with text
const STEPS_HEAD = ["#", "Step", "Expected result"]
const SUITE_SECTIONS = ["Focus", "Baseline", "Execution", "Test cases"]
const SUITE_HEAD = ["#", "ID", "Title", "Run class", "Other suites"]
const RUN_HEAD = ["Test case", "Step", "Result", "Note"]
const RUN_FIELDS = ["Date", "Environment", "Code state", "Executed by", "Occasion"]
const RUN_RESULTS = new Set(["PASS", "FAIL", "SKIP"])
// The two canonical marker forms, at the very end of the AC. The colon text holds no
// parentheses, so the form stays unambiguous.
const CANONICAL_MARK = /\*\(manual-AC(?:: [^()\s][^()]*)?\)\*$/
// Any spelling that looks like the marker - a counter that misses a variant reports
// too little and never turns red, so every variant is found and judged.
const MARK_MENTION = /\bmanual[\s_-]*ac\b/gi
// In scope for the parity once /ux ran (filled UX section) or at the latest here.
const PARITY_STATUSES = /^(In Review|Deployed)\b/

// -----------------------------------------------------------------------------
// Arguments: [--gate <spec-id>]
// -----------------------------------------------------------------------------
const USAGE = "usage: node scripts/check-testcases.mjs [--gate <spec-id>]   (e.g. --gate feat-0002)"
let GATE = null
{
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    let value
    if (a === "--gate") value = args[++i]
    else if (a.startsWith("--gate=")) value = a.slice("--gate=".length)
    else {
      console.error(`Test-case catalog: unknown argument '${a}'.\n${USAGE}`)
      process.exit(2)
    }
    if (!value || value.startsWith("-")) {
      console.error(`Test-case catalog: --gate needs a spec ID.\n${USAGE}`)
      process.exit(2)
    }
    if (GATE !== null) {
      console.error(`Test-case catalog: --gate given twice - one spec per gate run.\n${USAGE}`)
      process.exit(2)
    }
    GATE = value.toLowerCase()
  }
}

// -----------------------------------------------------------------------------
// File set (git's view) and helpers
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
    console.error("Test-case catalog: `git ls-files` failed - the guard needs a git checkout.")
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

const deleted = new Set(gitLsFiles(["--deleted"]))
const files = gitLsFiles(["--cached", "--others", "--exclude-standard"])
  .filter((p) => !p.endsWith("/") && !deleted.has(p))
  .sort()

const catalogFiles = files.filter((p) => p.startsWith(`${CATALOG}/`))
if (catalogFiles.length === 0) {
  if (GATE !== null) {
    console.error(`Test-case catalog: gate requested for ${GATE}, but there is no test-case catalog (docs/test-cases/).`)
    console.error("    -> a project with a UI keeps the catalog (/init prunes it only for ui == none); without a UI, drop the gate call.")
    process.exit(2)
  }
  console.log("Test-case catalog: no docs/test-cases/ - project without a UI catalog, nothing to check.")
  process.exit(0)
}

function read(rel) {
  try {
    return readFileSync(join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n")
  } catch (err) {
    console.error(`Test-case catalog: cannot read ${rel}.`)
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

const findings = []
const add = (rule, file, line, msg, fix) => findings.push({ rule, file, line, msg, fix })
const lineAt = (text, index) => text.slice(0, index).split("\n").length
const pad = (n, w) => String(n).padStart(w, "0")
const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l)
const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
const sameCells = (a, b) => a.length === b.length && a.every((c, i) => c === b[i])
const LINK_CELL = /^\[([^\]]+)\]\(([^)]+)\)$/

/** "- **Name:** value" anywhere in the body -> { value, line } or null */
function field(body, name) {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\*[ \\t]*(.*)$`, "m").exec(body)
  return m ? { value: m[1].trim(), line: lineAt(body, m.index) } : null
}

/** Body of a "## <name>" section (without the heading) -> { text, line } or null */
function section(body, name) {
  const m = new RegExp(`^## ${name}[ \\t]*$`, "m").exec(body)
  if (!m) return null
  const rest = body.slice(m.index + m[0].length)
  const end = rest.search(/^## /m)
  return { text: end < 0 ? rest : rest.slice(0, end), line: lineAt(body, m.index) }
}

/** Table rows (with absolute line numbers) of the first table after `fromLine`. */
function tableAfter(lines, fromLine) {
  let i = fromLine
  while (i < lines.length && !isTableRow(lines[i])) i++
  if (i >= lines.length) return null
  const head = { cells: cells(lines[i]), line: i + 1 }
  const rows = []
  for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push({ cells: cells(lines[i]), line: i + 1 })
  return { head, rows }
}

// -----------------------------------------------------------------------------
// Specs and bugs (for [reference] and [manual-ac])
// -----------------------------------------------------------------------------
const bugIds = new Set()
for (const f of files) {
  const m = /^docs\/bugs\/(?:archive\/.+\/)?bug-(\d{4})-[^/]*\.md$/.exec(f)
  if (m) bugIds.add(`BUG-${m[1]}`)
}

/** AC items of the "## Acceptance Criteria" section: a top-level "- " line plus its indented continuation lines. */
function acItems(body) {
  const lines = body.split("\n")
  const start = lines.findIndex((l) => /^## Acceptance Criteria\b/.test(l))
  if (start < 0) return []
  const items = []
  let cur = null
  let inFence = false
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (/^## /.test(l) || /^---\s*$/.test(l)) break
    if (/^\s*(```|~~~)/.test(l)) {
      inFence = !inFence
      cur = null
      continue
    }
    if (inFence) continue
    if (/^- /.test(l)) {
      cur = { lines: [{ text: l, line: i + 1 }] }
      items.push(cur)
    } else if (cur && /^\s+\S/.test(l)) {
      cur.lines.push({ text: l, line: i + 1 })
    } else {
      cur = null
    }
  }
  return items.map((it) => {
    const first = it.lines[0].text
    const numbered = /^- \[[ xX]\] \*\*AC (\d+):\*\*/.exec(first)
    const mentionLine = it.lines.find((x) => new RegExp(MARK_MENTION.source, "i").test(x.text))
    const text = it.lines.map((x) => x.text.trim()).join(" ")
    return {
      line: it.lines[0].line,
      markLine: mentionLine?.line ?? it.lines[0].line,
      checkbox: /^- \[[ xX]\] /.test(first),
      number: numbered ? Number(numbered[1]) : null,
      text,
      mentions: (text.match(MARK_MENTION) ?? []).length,
    }
  })
}

function uxFilled(body) {
  const m = /^## UX Design\b.*$/m.exec(body)
  if (!m) return false
  const rest = body.slice(m.index + m[0].length)
  const end = rest.search(/^(## |---\s*$)/m)
  const text = (end < 0 ? rest : rest.slice(0, end)).replace(/<!--[\s\S]*?-->/g, "").trim()
  return text !== "" && !/^_[\s\S]*_$/.test(text) // the template ships an italic placeholder
}

const specs = new Map() // spec ID -> { rel, body, status, ux, items }
for (const f of files) {
  if (!/^features\/(?:archive\/.+\/)?[^/]+\.md$/.test(f)) continue
  const base = posix.basename(f)
  if (base === "INDEX.md" || base === "README.md") continue
  const id = /^([a-z][a-z0-9]*-\d{4})-/.exec(base)?.[1]
  if (!id) continue
  const body = read(f)
  const status = (/^## Status:\s*(.+?)\s*$/m.exec(body) ?? /^(?:- )?\*\*Status:\*\*\s*(.+?)\s*$/m.exec(body))?.[1] ?? ""
  specs.set(id, { rel: f, body, status, ux: uxFilled(body), items: acItems(body) })
}
if (GATE !== null && !specs.has(GATE)) {
  console.error(`Test-case catalog: gate requested for unknown spec ID '${GATE}' - no features/${GATE}-<name>.md (archive included).`)
  console.error("    -> pass the feature ID exactly as in features/INDEX.md, e.g. --gate feat-0002.")
  process.exit(2)
}

/** Reference value -> { specs: Map(spec ID -> Set(AC n)), bugs: Set } */
function parseReference(value) {
  const out = { specs: new Map(), bugs: new Set() }
  const tokens = [...value.matchAll(/\b([a-z][a-z0-9]*-\d{4})\b|\b(BUG-\d{4})\b/g)]
  tokens.forEach((t, i) => {
    if (t[2]) {
      out.bugs.add(t[2])
      return
    }
    const end = i + 1 < tokens.length ? tokens[i + 1].index : value.length
    const seg = value.slice(t.index + t[0].length, end)
    const acs = out.specs.get(t[1]) ?? new Set()
    for (const m of seg.matchAll(/\bAC (\d+)(?:\s*[-–]\s*(\d+))?/g)) {
      const a = Number(m[1])
      const b = m[2] ? Number(m[2]) : a
      for (let n = Math.min(a, b); n <= Math.min(Math.max(a, b), a + 500); n++) acs.add(n)
    }
    out.specs.set(t[1], acs)
  })
  return out
}

// -----------------------------------------------------------------------------
// [immutable] - test cases never move
// -----------------------------------------------------------------------------
for (const f of catalogFiles) {
  if (f.startsWith(`${CATALOG}/archive/`)) {
    add("immutable", f, 1, "an archive under docs/test-cases/ contradicts the convention - test cases never move.",
      "dissolve it; a dropped case gets 'Status: Retired (<reason>)' and stays in cases/.")
  } else if (/^docs\/test-cases\/cases\/[^/]+\/.+/.test(f)) {
    add("immutable", f, 1, "subdirectory under cases/ - cases/ is flat, a case keeps its path forever.",
      "move it back to cases/ (git mv); grouping is the Suites: field, not a folder.")
  }
}

// -----------------------------------------------------------------------------
// suites/: [suite-naming] + [suite-layout]
// -----------------------------------------------------------------------------
const suites = new Map() // SUITE-NNN -> { id, file, rel, name, active, ascending, rows }
for (const f of catalogFiles.filter((p) => /^docs\/test-cases\/suites\/[^/]+$/.test(p))) {
  const file = posix.basename(f)
  if (file === ".gitkeep") continue
  const nameMatch = /^suite-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(file)
  if (!nameMatch) {
    add("suite-naming", f, 1, "file name does not follow suite-NNN-<kebab-name>.md.",
      "rename it (git mv); suites/ holds suite overviews only.")
    continue
  }
  const id = `SUITE-${nameMatch[1]}`
  const body = read(f)
  const lines = body.split("\n")
  const h1 = /^# (SUITE-\d{3}): (.+)$/.exec(lines[0])
  if (!h1) {
    add("suite-naming", f, 1, "the first line is not a title '# SUITE-NNN: <name>'.", "make the title the first line of the file.")
    continue
  }
  if (h1[1] !== id) {
    add("suite-naming", f, 1, `number in the file name (${id}) and in the title (${h1[1]}) differ.`,
      "align both - suite numbers are never reassigned.")
    continue
  }
  if (suites.has(id)) {
    add("suite-naming", f, 1, `${id} is assigned twice (also ${suites.get(id).rel}).`,
      "the suite created later takes the next free number (INDEX status block).")
    continue
  }

  const statusIdx = lines.findIndex((l, i) => i > 0 && l.trim() !== "")
  const statusLine = /^> \*\*Status:\*\* (Active|Retired \(.+\))\s*$/.exec(lines[statusIdx] ?? "")
  if (!statusLine) {
    add("suite-layout", f, statusIdx + 1, "head without '> **Status:** Active' or '> **Status:** Retired (<reason, successor>)'.",
      "put the status line directly below the title.")
  }
  const active = !statusLine || statusLine[1] === "Active"

  let ascending = true
  const rows = []
  if (active) {
    const h2 = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
    if (h2.join(" | ") !== SUITE_SECTIONS.join(" | ")) {
      add("suite-layout", f, 1, `sections are '${h2.join(", ")}' instead of '${SUITE_SECTIONS.join(", ")}'.`,
        "exactly these four sections in this order; particulars go under 'Execution', not into a section of their own.")
    }
    const exec = section(body, "Execution")
    if (exec) {
      const first = exec.text.split("\n").find((l) => l.trim() !== "") ?? ""
      const order = /^\*\*Order:\*\* (ascending\b|deviating - \S)/.exec(first)
      if (!order) {
        add("suite-layout", f, exec.line, "section 'Execution' does not start with the order line.",
          "first line: '**Order:** ascending by `TEST-NNNN`.' or '**Order:** deviating - <reason>'.")
      } else {
        ascending = order[1].startsWith("ascending")
      }
    }
    const tc = section(body, "Test cases")
    if (tc) {
      const table = tableAfter(lines, tc.line)
      if (!table || !sameCells(table.head.cells, SUITE_HEAD)) {
        add("suite-layout", f, table?.head.line ?? tc.line, `section 'Test cases' without the table head '| ${SUITE_HEAD.join(" | ")} |'.`,
          "write the column heads exactly like this - every suite has the same columns.")
      } else {
        for (const r of table.rows) {
          const link = LINK_CELL.exec(r.cells[1] ?? "")
          if (r.cells.length !== 5 || !link || !/^TEST-\d{4}$/.test(link[1])) {
            add("suite-layout", f, r.line, `row does not have the columns '| ${SUITE_HEAD.join(" | ")} |' with a linked TEST-NNNN.`,
              "add the position and 'Other suites' ('-' when empty); link the ID to the case file.")
            continue
          }
          rows.push({ pos: r.cells[0], id: link[1], target: link[2], title: r.cells[2], klass: r.cells[3], others: r.cells[4], line: r.line })
        }
      }
    }
  }
  suites.set(id, { id, file, rel: f, name: h1[2].trim(), active, ascending, rows })
}
const suiteNumbers = [...suites.keys()].map((id) => Number(id.slice(6))).sort((a, b) => a - b)
{
  const gap = suiteNumbers.findIndex((n, i) => n !== i + 1)
  if (gap >= 0) {
    add("suite-naming", `${CATALOG}/suites/`, 1, `gap before SUITE-${pad(suiteNumbers[gap], 3)}: number ${pad(gap + 1, 3)} is missing.`,
      "numbers are sequential and suite files are never deleted - a given-up suite stays with 'Status: Retired (…)'.")
  }
}

// -----------------------------------------------------------------------------
// cases/: [naming] + [fields] + [format] + [suite] + [reference]
// -----------------------------------------------------------------------------
const cases = new Map() // TEST-NNNN -> { id, rel, file, title, suites, klass, status, active, reference }
for (const f of catalogFiles.filter((p) => /^docs\/test-cases\/cases\/[^/]+$/.test(p))) {
  const file = posix.basename(f)
  if (file === ".gitkeep") continue
  const nameMatch = /^test-(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(file)
  if (!nameMatch) {
    add("naming", f, 1, "file name does not follow test-NNNN-<kebab-slug>.md.", "rename it (README, 'IDs and file names').")
    continue
  }
  const id = `TEST-${nameMatch[1]}`
  const body = read(f)
  const lines = body.split("\n")
  const h1 = /^# (TEST-\d{4}): (.+)$/.exec(lines[0])
  if (!h1) {
    add("naming", f, 1, "the first line is not a title '# TEST-NNNN: <title>'.", "make the title the first line of the file.")
    continue
  }
  if (h1[1] !== id) {
    add("naming", f, 1, `ID in the file name (${id}) and in the title (${h1[1]}) differ.`, "align both - IDs are never renumbered.")
    continue
  }
  if (cases.has(id)) {
    add("naming", f, 1, `${id} is assigned twice (also ${cases.get(id).rel}).`, "IDs are unique and never reused - take the next free ID.")
    continue
  }

  // Header fields
  const suitesF = field(body, "Suites")
  const klassF = field(body, "Run class")
  const statusF = field(body, "Status")
  const refF = field(body, "Reference")
  if (!suitesF || suitesF.value === "") add("fields", f, 1, "required field 'Suites:' is missing or empty.", "e.g. '- **Suites:** SUITE-001'.")
  if (!klassF) add("fields", f, 1, "required field 'Run class:' is missing.", "Smoke or Regression.")
  else if (!RUN_CLASSES.has(klassF.value)) add("fields", f, klassF.line, `run class '${klassF.value}' is unknown.`, "allowed: Smoke, Regression.")
  let active = false
  if (!statusF) add("fields", f, 1, "required field 'Status:' is missing.", "Active or 'Retired (<reason>)'.")
  else if (statusF.value === "Active") active = true
  else if (/^Retired\b/.test(statusF.value) && !/^Retired \(.+\)$/.test(statusF.value)) {
    add("fields", f, statusF.line, "'Retired' without a reason.", "write 'Retired (<reason>)' - a retired case stays in cases/ with its reason.")
  } else if (!/^Retired \(.+\)$/.test(statusF.value)) {
    add("fields", f, statusF.line, `status '${statusF.value}' is unknown.`, "allowed: Active, Retired (<reason>).")
  }
  if (!refF || refF.value === "") add("fields", f, 1, "required field 'Reference:' is missing or empty.", "e.g. 'feat-0002 AC 1' or 'BUG-0012' (README, 'The Reference field').")

  const covM = /^- \*\*Coverage:\*\*[ \t]*$/m.exec(body)
  if (!covM) {
    add("fields", f, 1, "required field 'Coverage:' is missing.",
      "list the targeted files as '  - [path](../../../path)' below it - the selection after a change depends on it (README, 'Coverage').")
  } else {
    const covLine = lineAt(body, covM.index)
    let entries = 0
    for (let i = covLine; i < lines.length && /^ {2,}- /.test(lines[i]); i++) {
      entries++
      if (!/^ {2,}- \[[^\]]+\]\([^)]+\)/.test(lines[i])) {
        add("fields", f, i + 1, "coverage entry is not a markdown link.", "write '  - [path](../../../path)' - the link check keeps it alive.")
      }
    }
    if (entries === 0) {
      add("fields", f, covLine, "field 'Coverage:' has no entry.",
        "at least one '  - [path](../../../path)'; before the code exists the feature spec stands in (README, 'Coverage').")
    }
  }

  // Body sections and the steps table
  for (const label of CASE_SECTIONS) {
    if (!new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*\\S`, "m").test(body)) {
      add("format", f, 1, `'**${label}:**' is missing or empty.`, "see the template in the README ('Test-case template').")
    }
  }
  const stepsM = /^\*\*Steps:\*\*[ \t]*$/m.exec(body)
  if (!stepsM) {
    add("format", f, 1, "no '**Steps:**' section.", `step and expected result belong side by side in one table '| ${STEPS_HEAD.join(" | ")} |'.`)
  } else {
    const table = tableAfter(lines, lineAt(body, stepsM.index))
    if (!table || !sameCells(table.head.cells, STEPS_HEAD)) {
      add("format", f, table?.head.line ?? lineAt(body, stepsM.index), `the steps table does not have the head '| ${STEPS_HEAD.join(" | ")} |'.`,
        "one table, step next to expected result (README, 'Test-case template').")
    } else if (table.rows.length === 0) {
      add("format", f, table.head.line, "the steps table has no rows.", "at least one step.")
    } else {
      table.rows.forEach((r, i) => {
        if (r.cells.length !== 3) {
          add("format", f, r.line, "step row does not have three cells.", "'| <n> | <step> | <expected result> |'.")
        } else if (r.cells[0] !== String(i + 1)) {
          add("format", f, r.line, `step number '${r.cells[0]}', expected ${i + 1}.`, "number the rows 1..n without gaps - runs and bugs refer to 'step n'.")
        } else if (r.cells[1] === "" || r.cells[2] === "") {
          add("format", f, r.line, `step ${i + 1} lacks its ${r.cells[1] === "" ? "step text" : "expected result"}.`,
            "every row has both - a step without an observation of its own gets '-' as expected result.")
        }
      })
    }
  }

  // Suites values
  const suiteIds = suitesF ? suitesF.value.split(",").map((s) => s.trim()).filter(Boolean) : []
  for (const s of suiteIds) {
    if (!/^SUITE-\d{3}$/.test(s)) {
      add("suite", f, suitesF.line, `Suites value '${s}' does not have the form SUITE-NNN.`, "the suite ID is the number, not the name.")
    } else if (!suites.has(s)) {
      add("suite", f, suitesF.line, `${s} has no overview suites/suite-${s.slice(6)}-<name>.md.`, "create the suite file or correct the ID.")
    } else if (active && !suites.get(s).active) {
      add("suite", f, suitesF.line, `active case points to the retired ${s}.`, "move it to the successor suite (named in the retired suite's head).")
    }
  }
  if (suiteIds.join(",") !== [...new Set(suiteIds)].sort().join(",")) {
    add("suite", f, suitesF.line, `Suites '${suiteIds.join(", ")}' are not ascending or contain a duplicate.`, "ascending by number, each suite once.")
  }

  cases.set(id, {
    id, rel: f, file, title: h1[2].trim(), suites: suiteIds, klass: klassF?.value ?? "",
    status: statusF?.value ?? "", active, reference: refF?.value ?? "", refLine: refF?.line ?? 1,
  })
}
const caseNumbers = [...cases.keys()].map((id) => Number(id.slice(5))).sort((a, b) => a - b)
{
  const gap = caseNumbers.findIndex((n, i) => n !== i + 1)
  if (gap >= 0) {
    add("naming", `${CATALOG}/cases/`, 1, `gap before TEST-${pad(caseNumbers[gap], 4)}: TEST-${pad(gap + 1, 4)} has no file.`,
      "case files are never deleted - a dropped case stays with 'Status: Retired (<reason>)'.")
  }
}

// [reference] + coverage map for [manual-ac]
const covered = new Map() // spec ID -> Set(AC n), from ACTIVE cases only
for (const c of cases.values()) {
  if (!c.active || c.reference === "") continue
  const ref = parseReference(c.reference)
  if (ref.specs.size === 0 && ref.bugs.size === 0) {
    add("reference", c.rel, c.refLine, `Reference '${c.reference}' names neither a spec ID nor a BUG-NNNN.`,
      "e.g. 'feat-0002 AC 1' or 'BUG-0012' (README, 'The Reference field').")
  }
  for (const [specId, acs] of ref.specs) {
    const spec = specs.get(specId)
    if (!spec) {
      add("reference", c.rel, c.refLine, `${specId} has no spec file under features/.`, "correct the ID - feature IDs are lower case, e.g. 'feat-0002'.")
      continue
    }
    const numbers = new Set(spec.items.filter((it) => it.number !== null).map((it) => it.number))
    for (const n of acs) {
      if (!numbers.has(n)) {
        add("reference", c.rel, c.refLine, `${specId} has no numbered 'AC ${n}'.`,
          `correct the AC number (numbered ACs in ${spec.rel}: ${[...numbers].join(", ") || "none"}).`)
      }
    }
    if (!covered.has(specId)) covered.set(specId, new Set())
    for (const n of acs) covered.get(specId).add(n)
  }
  for (const b of ref.bugs) {
    if (!bugIds.has(b)) add("reference", c.rel, c.refLine, `${b} has no bug file under docs/bugs/.`, "correct the bug ID.")
  }
}

// -----------------------------------------------------------------------------
// INDEX.md <-> cases/ and suites/: [index] + [counts]
// -----------------------------------------------------------------------------
const INDEX = `${CATALOG}/INDEX.md`
const activeCount = new Map() // SUITE-NNN -> active cases declaring it
for (const s of suites.values()) {
  activeCount.set(s.id, [...cases.values()].filter((c) => c.active && c.suites.includes(s.id)).length)
}
const allCases = [...cases.values()]
const nActive = allCases.filter((c) => c.active).length
const nRetired = allCases.length - nActive
// Origin: a case naming a BUG locks a known damage; one without checks a promise of the
// spec. The ratio is a statement about the catalog (README, "Origin: spec or bug").
const nFromBug = allCases.filter((c) => c.active && /\bBUG-\d{4}\b/.test(c.reference)).length

if (!files.includes(INDEX)) {
  add("index", INDEX, 1, "INDEX.md is missing.", "recreate it (status block, suite table, case table) - see README.")
} else {
  const index = read(INDEX)
  const ilines = index.split("\n")
  const caseRows = new Map()
  const suiteRows = new Map()
  ilines.forEach((l, i) => {
    if (!isTableRow(l)) return
    const c = cells(l)
    const link = LINK_CELL.exec(c[0])
    if (link && /^TEST-\d{4}$/.test(link[1])) {
      if (c.length !== 6) {
        add("index", INDEX, i + 1, "case row does not have the columns '| ID | Title | Suites | Run class | Reference | Status |'.", "fix the row.")
      } else if (caseRows.has(link[1])) {
        add("index", INDEX, i + 1, `${link[1]} is listed twice.`, "one row per case.")
      } else {
        caseRows.set(link[1], { target: link[2], title: c[1], suites: c[2], klass: c[3], reference: c[4], status: c[5], line: i + 1 })
      }
    } else if (/^SUITE-\d{3}$/.test(c[0])) {
      const ov = LINK_CELL.exec(c[1] ?? "")
      if (c.length !== 4 || !ov) {
        add("index", INDEX, i + 1, "suite row does not have the columns '| Suite ID | Overview | Focus | Active test cases |' with a linked overview.", "fix the row.")
      } else {
        suiteRows.set(c[0], { label: ov[1], target: ov[2], count: c[3], line: i + 1 })
      }
    }
  })

  for (const c of cases.values()) {
    const row = caseRows.get(c.id)
    const fix = "the case file wins - update the INDEX row."
    if (!row) {
      add("index", INDEX, 1, `${c.id} is missing from the case table.`, `add a row for ${c.rel}.`)
      continue
    }
    if (row.target !== `cases/${c.file}`) add("index", INDEX, row.line, `${c.id} links '${row.target}' instead of 'cases/${c.file}'.`, "correct the link.")
    if (row.title !== c.title) add("index", INDEX, row.line, `${c.id}: title '${row.title}' != file '${c.title}'.`, fix)
    // A field missing in the case is already a [fields] finding - no echo here.
    if (c.klass && row.klass !== c.klass) add("index", INDEX, row.line, `${c.id}: run class '${row.klass}' != file '${c.klass}'.`, fix)
    if (c.reference && row.reference !== c.reference) add("index", INDEX, row.line, `${c.id}: reference '${row.reference}' != file '${c.reference}'.`, fix)
    if (c.status && row.status.split(" ")[0] !== c.status.split(" ")[0]) add("index", INDEX, row.line, `${c.id}: status '${row.status}' != file '${c.status}'.`, fix)
    const rowSuites = row.suites.split(",").map((s) => s.trim()).filter(Boolean).join(", ")
    if (c.suites.length > 0 && rowSuites !== c.suites.join(", ")) add("index", INDEX, row.line, `${c.id}: suites '${row.suites}' != file '${c.suites.join(", ")}'.`, fix)
  }
  for (const [id, row] of caseRows) {
    if (!cases.has(id)) add("index", INDEX, row.line, `${id} is listed, but has no file in cases/.`, "remove the ghost row or create the case.")
  }

  for (const s of suites.values()) {
    const row = suiteRows.get(s.id)
    if (!row) {
      add("index", INDEX, 1, `${s.id} is missing from the suite table.`, `add a row for ${s.rel}.`)
      continue
    }
    if (row.target !== `suites/${s.file}`) add("index", INDEX, row.line, `${s.id} links '${row.target}' instead of 'suites/${s.file}'.`, "correct the link.")
    if (row.label !== s.name) add("index", INDEX, row.line, `${s.id}: overview label '${row.label}' != suite name '${s.name}'.`, "the suite file wins.")
    const expected = s.active ? String(activeCount.get(s.id)) : "-"
    if (row.count !== expected) add("counts", INDEX, row.line, `${s.id}: 'Active test cases' is '${row.count}', derived is '${expected}'.`, "update the suite table.")
  }
  for (const [id, row] of suiteRows) {
    if (!suites.has(id)) add("index", INDEX, row.line, `${id} is listed, but has no file in suites/.`, "remove the ghost row or create the suite.")
  }

  const counters = [
    ["Active test cases", String(nActive)],
    ["Retired", String(nRetired)],
    ["Next free ID", `TEST-${pad((caseNumbers.at(-1) ?? 0) + 1, 4)}`],
    ["From a bug", `${nFromBug} of ${nActive}`],
    ["Next free suite number", `SUITE-${pad((suiteNumbers.at(-1) ?? 0) + 1, 3)}`],
  ]
  for (const [label, expected] of counters) {
    const m = new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, "m").exec(index)
    if (!m) add("counts", INDEX, 1, `status row '${label}' is missing.`, `add '| ${label} | ${expected} |' to the status block.`)
    else if (m[1] !== expected) add("counts", INDEX, lineAt(index, m.index), `'${label}' is '${m[1]}', derived is '${expected}'.`, "update the status block.")
  }
}

// -----------------------------------------------------------------------------
// Suite tables <-> cases/: [overview] + [suite-order] + active case without suite
// -----------------------------------------------------------------------------
for (const c of cases.values()) {
  if (c.active && c.suites.length === 0) {
    add("suite", c.rel, 1, "active case belongs to no suite.", "every active case belongs to at least one suite (README, 'Suites').")
  }
}
for (const s of suites.values()) {
  if (!s.active) continue
  const members = [...cases.values()].filter((c) => c.suites.includes(s.id))
  const should = new Set(members.map((c) => c.id))
  const listed = new Set(s.rows.map((r) => r.id))
  for (const id of should) {
    if (!listed.has(id)) add("overview", s.rel, 1, `${id} declares ${s.id} but is missing from the overview.`, "add the row at its position.")
  }
  for (const r of s.rows) {
    if (!should.has(r.id)) add("overview", s.rel, r.line, `${r.id} is listed, but does not declare ${s.id}.`, "add the suite to the case's Suites: field or remove the row.")
  }

  const seen = new Set()
  let expectedPos = 1
  let sawRetired = false
  let prev = 0
  for (const r of s.rows) {
    const c = cases.get(r.id)
    if (!c || !should.has(r.id)) continue
    if (seen.has(r.id)) {
      add("overview", s.rel, r.line, `${r.id} is listed more than once.`, "one row per case in a suite.")
      continue
    }
    seen.add(r.id)
    const expectedTitle = c.active ? c.title : `~~${c.title}~~ (retired)`
    if (r.title !== expectedTitle) add("overview", s.rel, r.line, `${r.id}: title '${r.title}' != '${expectedTitle}'.`, "the case wins; retired cases read '~~<title>~~ (retired)'.")
    if (r.target !== `../cases/${c.file}`) add("overview", s.rel, r.line, `${r.id} links '${r.target}' instead of '../cases/${c.file}'.`, "correct the link.")
    if (c.klass && r.klass !== c.klass) add("overview", s.rel, r.line, `${r.id}: run class '${r.klass}' != file '${c.klass}'.`, "the case wins.")
    // The whole cell is compared, not only the links found in it - otherwise extra text
    // next to a correct link passes.
    const others = c.suites.filter((x) => x !== s.id)
    if (others.every((x) => suites.has(x))) {
      const expectedCell = others.map((x) => `[${x}](${suites.get(x).file})`).join(", ") || "-"
      if (r.others !== expectedCell) {
        add("overview", s.rel, r.line, `${r.id}: 'Other suites' is '${r.others}', expected '${expectedCell}'.`,
          "exactly the case's other suites as links, ascending, separated by ', '; '-' if none.")
      }
    }
    if (c.active) {
      if (sawRetired) add("suite-order", s.rel, r.line, `${r.id} stands after a retired case.`, "retired cases stand without a position at the end of the table.")
      if (r.pos !== String(expectedPos)) add("suite-order", s.rel, r.line, `${r.id} has position '${r.pos}', expected ${expectedPos}.`, "positions 1..n without gaps, in row order.")
      expectedPos++
      const n = Number(r.id.slice(5))
      if (s.ascending && n < prev) {
        add("suite-order", s.rel, r.line, `${r.id} stands after TEST-${pad(prev, 4)}, but the suite declares 'ascending'.`,
          "sort the rows by TEST-NNNN - or declare '**Order:** deviating - <reason>' in 'Execution'.")
      }
      prev = Math.max(prev, n)
    } else {
      sawRetired = true
      if (r.pos !== "-") add("suite-order", s.rel, r.line, `retired ${r.id} has position '${r.pos}'.`, "position '-' and to the end of the table.")
    }
  }
  if (activeCount.get(s.id) === 0) {
    add("suite-order", s.rel, 1, `active ${s.id} has no active case.`, "retire the suite ('> **Status:** Retired (…)') or assign cases to it.")
  }
}

// -----------------------------------------------------------------------------
// runs/: [run]
// -----------------------------------------------------------------------------
const ran = new Set() // cases with at least one PASS or FAIL row
let runCount = 0
for (const f of catalogFiles.filter((p) => /^docs\/test-cases\/runs\/[^/]+$/.test(p))) {
  const file = posix.basename(f)
  if (file === ".gitkeep") continue
  const nm = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(file)
  const validDate = nm && !Number.isNaN(Date.parse(`${nm[1]}T00:00:00Z`)) && new Date(`${nm[1]}T00:00:00Z`).toISOString().slice(0, 10) === nm[1]
  if (!nm || !validDate) {
    add("run", f, 1, "file name does not follow YYYY-MM-DD-<env>[-<suffix>].md with a valid date.", "rename it (README, 'Run protocols').")
    continue
  }
  runCount++
  const body = read(f)
  const lines = body.split("\n")
  for (const label of RUN_FIELDS) {
    const m = new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, "m").exec(body)
    if (!m || m[1] === "" || m[1] === "-") {
      add("run", f, m ? lineAt(body, m.index) : 1, `head row '${label}' is missing or empty.`, `'| ${label} | <value> |' in the head table.`)
    } else if (label === "Date" && m[1] !== nm[1]) {
      add("run", f, lineAt(body, m.index), `Date '${m[1]}' differs from the file name (${nm[1]}).`, "align both - one file per run and day.")
    }
  }
  const res = section(body, "Results")
  const table = res ? tableAfter(lines, res.line) : null
  if (!table || !sameCells(table.head.cells, RUN_HEAD)) {
    add("run", f, table?.head.line ?? res?.line ?? 1, `no '## Results' table with the head '| ${RUN_HEAD.join(" | ")} |'.`, "see the run template in the README.")
    continue
  }
  if (table.rows.length === 0) add("run", f, table.head.line, "the results table has no rows.", "one row per executed step (or a SKIP with its reason).")
  for (const r of table.rows) {
    const link = LINK_CELL.exec(r.cells[0] ?? "")
    if (r.cells.length !== 4 || !link || !/^TEST-\d{4}$/.test(link[1])) {
      add("run", f, r.line, `row does not have the columns '| ${RUN_HEAD.join(" | ")} |' with a linked TEST-NNNN.`, "fix the row.")
      continue
    }
    const [, id, target] = link
    const c = cases.get(id)
    if (!c) add("run", f, r.line, `${id} has no file in cases/.`, "correct the ID - runs name existing cases only.")
    else if (posix.basename(target) !== c.file) add("run", f, r.line, `${id} links '${target}' instead of '../cases/${c.file}'.`, "correct the link.")
    const step = r.cells[1]
    const result = r.cells[2].replace(/\*/g, "")
    const note = r.cells[3]
    if (!/^(\d+|\d+-\d+|-)$/.test(step)) add("run", f, r.line, `step '${step}' is not a step number, a range 'n-m', or '-'.`, "name the step of the case's table.")
    if (!RUN_RESULTS.has(result)) {
      add("run", f, r.line, `result '${r.cells[2]}' is not PASS, FAIL or SKIP.`, "one of the three.")
      continue
    }
    if (result !== "SKIP" && !/^\d+$/.test(step)) {
      add("run", f, r.line, `${result} for '${step}' - PASS and FAIL name a single observed step.`,
        "one row per step: a pass claimed for several steps at once is a claim, not an observation (README, 'Run protocols').")
    }
    if (result === "FAIL") {
      const bugs = note.match(/\bBUG-\d{4}\b/g) ?? []
      if (bugs.length === 0) add("run", f, r.line, `FAIL of ${id} without a bug reference.`, "file the finding via /bug and name BUG-NNNN in the note.")
      for (const b of bugs) if (!bugIds.has(b)) add("run", f, r.line, `${b} has no bug file under docs/bugs/.`, "correct the bug ID.")
    }
    if (result === "SKIP" && (note === "" || note === "-")) {
      add("run", f, r.line, `SKIP of ${id} without a reason.`, "write why the step could not run - a silent SKIP hides a backlog.")
    }
    if (c && (result === "PASS" || result === "FAIL")) ran.add(id)
  }
}

// -----------------------------------------------------------------------------
// features/: [manual-ac] + [ac-number]
// -----------------------------------------------------------------------------
// A promise that can only be checked on screen needs a DECLARED case. Author is /ux (last
// step before the build, knows the click path), deadline are /backend + /frontend (they
// do not start with an uncovered marked AC). The plain run is the NET: it keeps a backlog
// visible in CI. The build skills call `--gate <spec-id>` as the mechanical half of their
// deadline - parity for that spec even before /ux (or without it). Neither mode can see
// whether a case was written before the code - that judgment stays with the skills.
let markedTotal = 0
let markedSpecs = 0
const gateResult = { marked: [], missing: [] } // AC numbers of the --gate spec
for (const [specId, spec] of specs) {
  const numbered = spec.items.filter((it) => it.number !== null)
  const seenNumbers = new Map()
  for (const it of numbered) {
    if (seenNumbers.has(it.number)) {
      add("ac-number", spec.rel, it.line, `AC ${it.number} is numbered twice (also line ${seenNumbers.get(it.number)}).`,
        "AC numbers are unique in a spec - test cases reference them.")
    } else {
      seenNumbers.set(it.number, it.line)
    }
  }
  if (numbered.length > 0) {
    for (const it of spec.items.filter((x) => x.checkbox && x.number === null)) {
      add("ac-number", spec.rel, it.line, "unnumbered AC in a spec with numbered ACs.", "write '- [ ] **AC n:** …' - an unnumbered AC cannot be marked or referenced.")
    }
  }

  const marked = []
  for (const it of spec.items) {
    if (it.mentions === 0) continue
    if (it.number === null) {
      add("manual-ac", spec.rel, it.markLine, "manual-AC marker on an AC without a number.",
        "number the AC ('- [ ] **AC n:** …') - test cases reference the number.")
      continue
    }
    marked.push(it)
    if (it.mentions !== 1 || !CANONICAL_MARK.test(it.text.trimEnd())) {
      add("manual-ac", spec.rel, it.markLine, `AC ${it.number} carries a manual-AC marker that is not in canonical form.`,
        "exactly '*(manual-AC)*' or '*(manual-AC: <what to do>)*', once, at the end of the AC - a counter that misses a spelling reports too little and never turns red.")
    }
  }
  if (marked.length === 0) continue
  markedTotal += marked.length
  markedSpecs++

  const gated = specId === GATE
  if (gated) gateResult.marked = marked.map((it) => it.number)
  // The gate spec is in scope regardless of status and UX section (see the header).
  if (!gated) {
    if (/^Superseded\b/.test(spec.status)) continue
    if (!spec.ux && !PARITY_STATUSES.test(spec.status)) continue
  }
  const have = covered.get(specId) ?? new Set()
  for (const it of marked) {
    if (have.has(it.number)) continue
    if (gated) gateResult.missing.push(it.number)
    add("manual-ac", spec.rel, it.line, `AC ${it.number} is manual-only, but no active test case names '${specId} AC ${it.number}' in its Reference.`,
      `/ux writes the case in docs/test-cases/cases/ BEFORE /backend and /frontend, with 'Reference: ${specId} AC ${it.number}' (README, 'Who writes it, and by when').`)
  }
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------
const neverRun = allCases.filter((c) => c.active && !ran.has(c.id)).map((c) => c.id)
const summary = `${cases.size} test case(s): ${nActive} active, ${nRetired} retired; ${suites.size} suite(s); ${runCount} run(s); ${markedTotal} manual-only AC in ${markedSpecs} spec(s)`
if (neverRun.length > 0) {
  console.log(`Note: ${neverRun.length} active case(s) appear in no run with PASS or FAIL yet - a written case is a promise, the run is the evidence:`)
  console.log(`    ${neverRun.join(", ")}`)
}

/** The one-line gate result - always the last line of a --gate run. */
function gateLine() {
  const { marked, missing } = gateResult
  if (marked.length === 0) return `gate ${GATE}: no manual-only AC - nothing to cover, PASS`
  const head = `gate ${GATE}: ${marked.length} manual-only AC`
  if (missing.length === 0) return `${head}, all covered by an active test case - PASS`
  const list = missing.map((n) => `AC ${n}`).join(", ")
  return `${head}, ${missing.length} without an active test case (${list}) - FAIL: /ux writes the case(s) before the build`
}

if (findings.length === 0) {
  console.log(`Test-case catalog: 0 findings (${summary})`)
  if (GATE !== null) console.log(gateLine())
  process.exit(0)
}
console.error(`Test-case catalog: ${findings.length} finding(s) (${summary})\n`)
for (const f of findings) {
  console.error(`${f.file}:${f.line}  [${f.rule}]  ${f.msg}`)
  console.error(`    -> ${f.fix}`)
}
console.error(`\nConvention: ${README_REF}`)
if (GATE !== null) {
  const line = gateLine()
  console.error(gateResult.missing.length === 0 ? `${line} (the findings above still fail the run)` : line)
}
process.exit(1)
