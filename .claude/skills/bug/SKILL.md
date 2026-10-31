---
name: bug
description: Document a bug as a single file under docs/bugs/. Use to report new bugs or update the status of existing ones.
argument-hint: "<bug description> | update <BUG-ID> | close <BUG-ID>"
user-invocable: true
---

# Bug Reporter

## Role
You are a bug tracker. You document reported bugs as **one file per bug** under `docs/bugs/`. You do
NOT fix bugs yourself — you document them precisely so they can be fixed later in a targeted way.

---

## Position in the workflow / bug-loop
`/bug` is **not** a fixed step in the linear feature workflow — it's a loop you can trigger anytime.

**Triggers:** `/qa` finds a bug during acceptance testing; a user reports a bug ad-hoc (including
after `/deploy`, from production); a developer spots an unrelated bug during `/frontend` / `/backend`.

**What `/bug` produces:** a file `docs/bugs/bug-NNNN-<slug>.md` (severity, root-cause hypothesis,
affected files, repro steps, proposed fix), status `Open`, and a new row in `docs/bugs/INDEX.md`.

**Fix phase (after `/bug`):**
- UI / Interaction / Layout / Client-state → `/frontend BUG-NNNN`
- API / DB / Auth / Server logic → `/backend BUG-NNNN`
- Login / Session / OIDC / Auth provider → `/auth BUG-NNNN`
- Each fix skill reads the bug file, fixes it **without scope-creep**, and commits per the bug-fix
  convention in `.claude/rules/general.md` (`fix(<prefix>-XXXX): BUG-NNNN; …`).

**Closing:** `/qa BUG-NNNN` re-tests against the original repro (narrow mandate — observations go
into the bug file's `**Follow-up findings:**`, not into new bugs). On success, `/bug close BUG-NNNN`
resolves the follow-up findings with the user, appends the `**Solution:**` block and `git mv`s the
file into the quarterly archive (`docs/bugs/archive/YYYY-QN/`). A feature only moves on once it has
no open Critical/High bugs. **Threshold and reach** of the loop (only Critical/High fixed right
away, pre-existing findings separate, chain depth max two generations):
`.claude/rules/general.md` → "Bug Loop — Threshold and Reach".

---

## Directory layout
```
docs/bugs/
├── INDEX.md                       # Master table: ID, title, dates, status, source
├── bug-NNNN-<slug>.md             # open bugs, flat in the directory
└── archive/
    └── YYYY-QN/                   # by close-date quarter
        └── bug-NNNN-<slug>.md     # closed bugs (Fixed / Won't Fix)
```

**Filename convention:** `bug-NNNN-<slug>.md` (kebab-case slug). The slug is fixed at creation and
never changes — even when archived it keeps its name.

**Slug algorithm:** strip any `<prefix>-NNNN:` from the title; lowercase + normalize umlauts
(`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`); pick 2–4 salient words (skip stopwords + words < 2 chars);
kebab-join, max ~50 chars.

---

## Parameter handling

### `/bug <description>` (new bug)
Document a new bug — see **Filing a new bug** below.

### `/bug update <BUG-ID>` (status change)
1. **Pre-check (MANDATORY — "No Reopens"):** `Glob` for `docs/bugs/archive/**/bug-NNNN-*.md`. If a
   file exists there, the bug is already closed → **abort** and tell the user: "BUG-NNNN is already
   closed (`<status>` since `<date>`, archive `<path>`). Reopens are not allowed — file a new bug
   with `/bug <description>` and reference BUG-NNNN as predecessor." No file change.
2. `Glob` for `docs/bugs/bug-NNNN-*.md`. If not found → "BUG-NNNN does not exist."
3. Ask: set status to `Fixed` or `Won't Fix`?
4. `Fixed` → ask for the solution steps. `Won't Fix` → ask for the rationale.
5. Continue in the **close path** below from step 3.

### `/bug close <BUG-ID>` (close as fixed)
> **Precondition:** `/bug close` assumes the fix is **already implemented and visible in the working
> tree**. This skill documents + archives an already-done fix — it does not perform the fix. If the
> fix isn't there yet, it refuses (step 3a) and points to the right fix skill (`/frontend`,
> `/backend`, `/auth`). The loop deliberately separates filing (`/bug`), fixing (dev skill), and
> closing (`/bug close`) into three phases so mid-stream aborts stay clean.

1. **Pre-check** as in `/bug update` step 1.
2. `Glob` for `docs/bugs/bug-NNNN-*.md`. If not found → error.
3. **Fix-verification check (MANDATORY):** read the bug file, extract the paths from its `**Fix:**`
   / `**Affected file(s):**` blocks. Check via `git status` + `git diff --stat` whether those
   files are changed (uncommitted) OR were changed in a commit after the bug's filing date
   (`git log --since=<date> -- <path>`).
   - **At least one named file changed** → continue to step 4.
   - **None changed** → **abort**: "BUG-NNNN can't be closed — none of the files in the fix block
     show changes since `<filed>`. `/bug close` is the document-and-archive phase and assumes an
     implemented fix. Next: implement via `/frontend BUG-NNNN`, `/backend BUG-NNNN`, or
     `/auth BUG-NNNN`, then re-test with `/qa`, then come back to `/bug close`." Write nothing.
   - **Edge case** (pure doc/spec fix, no code): ask the user to confirm "doc-fix / spec-fix /
     won't-fix" before archiving.
4. Ask for the solution steps (changed files + lines, the concrete change, why it fixes the bug). If
   step 3 already inspected the diff, you may derive these and present them for confirmation.
5. **Follow-up findings & evidence (MANDATORY before archiving):**
   - **`**Follow-up findings:**` block not empty** → show the lines to the user **once, together**,
     each with a one-word recommendation — `own bug` / `resolves itself` / `drop` — and the reason.
     Default is: none becomes a bug. For each line the user picks, file a new bug (`/bug …`) —
     respecting the chain-depth rule (`.claude/rules/general.md` → "Bug Loop"): if *this* bug
     already has a `**Predecessor:**`, a new bug from its follow-up findings gets **no**
     Predecessor line (standalone, own description) and only when it is Critical/High or the user
     explicitly continues the chain. Mark each line in the block with the outcome
     (`→ BUG-NNNN` / `→ dropped` / `→ resolved by the fix`); the block moves into the archive with the file.
   - **Test-case evidence** (projects with a test-case catalog): if the bug file names a test case
     (`TEST-NNNN`, e.g. a case derived from this bug), that case must appear in a run protocol under
     `docs/test-cases/runs/` dated **after** the fix — or the backlog is recorded visibly in the
     `**Solution:**` block (`TEST-NNNN not yet run: <reason>`). A written case is a promise; only a
     logged run is evidence.
   - **Re-test on record:** the `/qa BUG-NNNN` result (`**Re-test:**` block) is in the file and
     already committed — if not, stop and run the re-test first.
6. **Update the bug file:** flip `**Status:** Open` → `**Status:** Fixed (YYYY-MM-DD)` (or
   `Won't Fix`); append the `**Solution:**` block; adjust the relative markdown links **two** levels
   deeper (`](../../` → `](../../../../`) because the file moves from `docs/bugs/` (depth 2) into
   `docs/bugs/archive/<quarter>/` (depth 4) — details and the neighbour links in
   [Path adjustment on close](#on-closing--the-solution-block-appended-at-the-end) below.
7. **`git mv`** into the quarterly archive (quarter from the **close date** — see below; `mkdir -p`
   the quarter dir first if needed):
   ```bash
   git mv docs/bugs/bug-NNNN-<slug>.md docs/bugs/archive/<quarter>/bug-NNNN-<slug>.md
   ```
   **Precondition:** a QA protocol that `/qa` wrote into the bug file is committed **before** the
   close — see [Git Commit Convention](#git-commit-convention) for why.
8. **Incoming links:** find references to the old path elsewhere in the repo
   (`git grep -n "bug-NNNN-<slug>.md" -- '*.md'`) and rewrite them to the archive path, relative to
   each linking file (rules: `.claude/rules/documentation.md` → "Archiving pulls the links along").
   Then `node scripts/check-md-links.mjs` must report 0 findings.
9. **Update `docs/bugs/INDEX.md`:** find the row with `grep -n "BUG-NNNN" docs/bugs/INDEX.md` and
   read only that range; repoint the ID link to `archive/<quarter>/…`; set "Closed on" (the close
   date, matching the `Fixed (YYYY-MM-DD)` in the file and the archive quarter); the `Close note`
   **starts with the status word** (`Fixed — <one-line summary>` / `Won't Fix — <reason>`). The row stays in place (only its content changes). **Recount** the status block
   from the history table — never "+1 / −1" (hand-kept counters drift) — and run
   `node scripts/check-bugs.mjs`: 0 findings.

---

## Filing a new bug

### Step 1 — Prep
1. **Next ID** — read the index selectively, not the whole file: the newest row is the first data
   row (`grep -m1 "^| \[BUG-" docs/bugs/INDEX.md`); next ID = that number + 1, and no
   `docs/bugs/**/bug-<next>-*.md` may exist yet. If `INDEX.md` doesn't exist, create it (see
   structure below) starting at `BUG-0001`.
2. Read the affected files named in the argument (if any).

### Step 2 — Analyze
- **Title** (≤ 60 chars), **Area** (component/script/file), **Severity** (`Critical` / `High` /
  `Medium` / `Low`), **Status** `Open`, **Source** (exactly one of the 8 tokens below).
- **Description** (what happens / what should happen), **Root Cause** (technical cause if known),
  **Affected file(s)** (path + lines), **Repro** steps, **Proposed Fix**, **Fix commands** (which
  skill fixes it, derived from the Area).
- **Pre-existing?** If the defect also occurs on the state before the change under test (same probe,
  same result), say so in the Description: `pre-existing, not a regression` — it is its own bug,
  not part of the current fix (`.claude/rules/general.md` → "Bug Loop", rule 2).
- **Predecessor / chain depth:** a regression or refinement of a closed bug gets a
  `**Predecessor:**` line — **unless that predecessor itself has one** (chain depth max two
  generations). Then: below High → no new bug; if the chain's last bug is still **open**, the
  finding becomes a line in its `**Follow-up findings:**` block (closed files are immutable — never
  write into the archive), otherwise report it to the user and stop; Critical/High → a standalone
  bug **without** Predecessor line, described on its own. Continuing a chain beyond two generations
  is the user's decision — ask.
- **Fix timing:** only Critical/High are fixed right away; a lower severity is filed and waits for
  prioritization (exception: a regression inside the diff currently being worked on). Say which
  applies in the summary.

### Step 3 — Derive the slug (algorithm above).

### Step 4 — Show a summary for confirmation
```
BUG-NNNN: [Title]
File:        docs/bugs/bug-NNNN-<slug>.md
Severity:    [Critical/High/Medium/Low]
Source:      [spec/dev/qa/review/security/deploy/production/manual]
Area:        [Area]
Root Cause:  [cause]
Fix:         [description]
Fix-commands: /<frontend|backend|auth> BUG-NNNN → /qa → /bug close BUG-NNNN
```
Ask: "Document this bug as shown? (yes / corrections)"

### Step 5 — Write file + INDEX
1. Write `docs/bugs/bug-NNNN-<slug>.md` (format below).
2. Add a history row at the **top** of the table (ID descending, newest first) — `Closed on` is
   `-` and `Close note` is `Open` while the bug is open; **recount** the
   header status table from the history rows (not "+1") and set `Last updated` to today.
3. **Collision check after writing** (parallel sessions share the counter): `ls docs/bugs/**/bug-NNNN-*`
   must show exactly your file, and `node scripts/check-bugs.mjs` must report 0 findings. On a
   duplicate ID: the slug that sorts first alphabetically keeps the number, the other moves to the
   next free one — announce it (`.claude/rules/general.md` → "Parallel Sessions"). Commit only your
   own paths (`git commit --only docs/bugs/INDEX.md docs/bugs/bug-NNNN-<slug>.md`).

---

## Bug-file format
```markdown
# BUG-NNNN: <Title>
- **Area:** <component / script / file, with markdown links — relative paths from docs/bugs/ = `](../../...)`>
- **Status:** Open
- **Severity:** Critical / High / Medium / Low
- **Source:** <spec | dev | qa | review | security | deploy | production | manual>

**Description:** <what happens / what should happen instead>

**Root Cause:** <technical cause>

**Affected file(s):**
- [path/to/file.ext](../../path/to/file.ext) line(s) XX–XX

**Reproduction:**
1. <step 1>
2. <step 2>

**Fix:** <concrete description of the fix>

**Fix commands:** <skill workflow to fix + close — MANDATORY on every new bug>
1. `/<frontend|backend|auth> BUG-NNNN` — implement the fix. Put the ONE skill matching the Area
   (not all variants): `/frontend` for UI/interaction/layout/client-state, `/backend` for
   API/DB/server logic, `/auth` for login/session/OIDC. For cross-cutting/doc bugs with no clear
   fix skill: describe what to do in prose.
2. `/qa BUG-NNNN` — narrow re-test against the repro above.
3. `/bug close BUG-NNNN` — close + move into the quarterly archive.
```

Blocks added later in the bug's life (appended in this order, each only when it has content):
```markdown
**Re-test:** YYYY-MM-DD — repro holds: no (fixed) | yes; regression in the diff: none | <one line>;
test case: TEST-NNNN PASS in [runs/<file>](../test-cases/runs/<file>) | none

**Follow-up findings:** <observations from the bug-fix re-test — not work items yet; resolved at close>
- <one sentence: what was noticed> — [file.ext](../../path/file.ext)
```
`**Follow-up findings:**` lines are one sentence each — no root-cause analysis, no fix proposal.
`/bug close` resolves them with the user (own bug / resolves itself / drop).

**Path convention for links in bug files:**
- Open files live in `docs/bugs/` (**depth 2**) → repo-root targets need **two** `../`: `](../../<path>)`.
- Archived files live in `docs/bugs/archive/<quarter>/` (**depth 4**) → **four** `../`: `](../../../../<path>)`.
- **Rule of thumb:** number of `../` = depth of the directory the bug file lives in. Three `../` from
  the archive land in `docs/` — the link is dead.
- **Links to `docs/bugs/` neighbours** follow the same arithmetic, not the repo-root rule:

  | Target | from `docs/bugs/` (open) | from `docs/bugs/archive/<quarter>/` (closed) |
  |---|---|---|
  | `docs/bugs/INDEX.md` | `](INDEX.md)` | `](../../INDEX.md)` |
  | bug in the **same** quarter archive | `](archive/<quarter>/bug-XXXX-<slug>.md)` | `](bug-XXXX-<slug>.md)` |
  | bug in **another** quarter archive | `](archive/<quarter>/bug-XXXX-<slug>.md)` | `](../<quarter>/bug-XXXX-<slug>.md)` |
  | a still **open** bug | `](bug-XXXX-<slug>.md)` | `](../../bug-XXXX-<slug>.md)` |

**Predecessor on follow-up bugs (regression / refinement):** optional line right after `**Source:**`:
```markdown
- **Predecessor:** [BUG-XXXX](archive/<quarter>/bug-XXXX-<slug>.md) (Status: Fixed on YYYY-MM-DD) — regression / refinement of that fix.
```

---

## On closing — the `**Solution:**` block (appended at the end)
```markdown
**Solution:**
- **Root Cause (confirmed):** <final confirmed cause>
- **Changed files:**
  - [path/to/file.ext](../../../../path/to/file.ext) line(s) XX–XX: <what changed>
- **Solution steps:**
  1. <step 1>
  2. <step 2>
- **Why it works:** <rationale>
```
**Path adjustment on close (MANDATORY):** the file moves from `docs/bugs/` (depth 2) to
`docs/bugs/archive/<quarter>/` (depth 4) — **two** levels deeper:
- Repo-root targets: `](../../<path>)` → `](../../../../<path>)` (two `../` added, not one).
- `docs/bugs/` neighbours per the table under "Path convention" above: `](INDEX.md)` →
  `](../../INDEX.md)`, `](archive/<quarter>/bug-XXXX-….md)` → `](bug-XXXX-….md)` (same quarter) or
  `](../<quarter>/bug-XXXX-….md)` (other quarter).
- Link syntax that appears only as an **example** inside backticks or code blocks: leave it alone.
- Absolute URLs and anchor-only links (`#…`): leave them alone.

New links in the `**Solution:**` block are written with archive depth (`](../../../../…)`) directly.

**Verification (MANDATORY, five seconds):** after the `git mv`, check that no link points nowhere:
```bash
cd docs/bugs/archive/<quarter>
awk '/^[[:space:]]*```/{f=!f; next} !f' bug-NNNN-<slug>.md \
  | sed 's/`[^`]*`//g' \
  | grep -o '](\([^)]*\))' | sed 's/^](//;s/)$//' \
  | grep -v '^http\|^mailto:\|^#' \
  | while read -r t; do [ -e "${t%%#*}" ] || echo "DEAD: $t"; done
```
Expected: no output (exception: targets deleted or renamed since the bug was filed — leave those
links, they document the state at the time). The `awk` drops code blocks and the `sed` drops code
spans, otherwise the example link syntax in the bug file reports as dead; `${t%%#*}` strips anchors.

---

## Quarter calculation (from the **close** date)
| Month | Quarter |
|-------|---------|
| 1–3 | Q1 | 4–6 | Q2 | 7–9 | Q3 | 10–12 | Q4 |

Closed on `2026-08-15` → `docs/bugs/archive/2026-Q3/…`. A bug filed in Q2 and closed in Q3 goes to
the Q3 archive (no cross-quarter split). `mkdir -p` the quarter dir before `git mv` if missing.

---

## `docs/bugs/INDEX.md` — initial structure
```markdown
# Bug Index

<!-- Auto-maintained by /bug. One file per bug in docs/bugs/. Status: Open / Fixed / Won't Fix. -->

## Status

| Field | Value |
|-------|-------|
| Last updated | YYYY-MM-DD |
| Open bugs | 0 |
| Fixed bugs | 0 |
| Won't Fix | 0 |

## Bug history

> Sorted by ID descending (newest first). One row per bug. Link points directly to the bug file.

| ID | Title | Filed on | Closed on | Close note | Source |
|----|-------|----------|-----------|------------|--------|
```

---

## Source — systematic enum (MANDATORY, exactly one per bug)
The source marks **the workflow position where the bug was discovered** — not the broken component
(that's "Area"). Filter axis for retrospectives ("how many bugs caught in QA vs. only in prod?").

| Token | When |
|-------|------|
| `spec` | Before implementation — spec drift, contradictory/missing AC. Skills: `/requirements`, `/architecture`, `/ux`. |
| `dev` | During implementation, an **unrelated** bug spotted. Skills: `/backend`, `/frontend`. |
| `qa` | `/qa` acceptance test / edge case / feature-scoped security check found it. |
| `review` | `/review` found it in the diff. |
| `security` | Project-wide `/security` audit found it. |
| `deploy` | During/after `/deploy` — env drift, schema drift, CI workflow bug, auth mismatch, proxy config. |
| `production` | User report from live env **after a successful deploy** — no active skill involved. |
| `manual` | Catch-all — ad-hoc spotting, doc drift, "noticed in passing". |

**Auto-derive:** when `/bug` is called from another skill, the source derives from the calling skill
(`/qa → qa`, `/review → review`, `/deploy → deploy`, `/backend|/frontend → dev`, requirements/arch/ux → spec).
The source is the **detecting** skill (composite: `/qa` finding a spec defect is still `qa`).
**Direct user call:** ask explicitly; default `manual`. For `/auth` diagnosis or `/check-updates`
findings: no own token — assign by discovery position (`production` / `deploy` / `manual`).

---

## No Reopens — new bug on regression or refinement (MANDATORY)
A closed bug file is **immutable**. There is no reopen path. A follow-up problem → **always** a new
`BUG-NNNN` referencing the predecessor in its body. Why: the history table is one row per bug
(opened/closed); reopens make it ambiguous, the audit trail must stay linear, and the filesystem
enforces it (archived files never move back to flat — the `/bug update` pre-check actively refuses).

**Never:** move an archived file back to `docs/bugs/`; add a "Reopened" note; add a second close row.

---

## Rules
- Bug IDs are sequential, never reused. One file per bug, never multiple bugs per file.
- Never delete a bug file — only change status and/or move to archive.
- Always update `docs/bugs/INDEX.md` after a new bug or status change; recount the status block
  from the table and run `node scripts/check-bugs.mjs` (0 findings) instead of re-reading by eye.
- History is one row per bug, ID descending; on update the existing row changes in place.
- Estimate severity conservatively (one level higher rather than too low).
- Use `git mv` (not raw move) when archiving, so `git log --follow` keeps the trail.

## Git Commit Convention
Bug fixes commit with: line 1 the ID, from line 2 the full solution writeup. If no feature applies,
use `NA`:
```
fix(<prefix>-XXXX): BUG-NNNN; <short description>

Root Cause: <confirmed cause>

Changed files:
- <path/file.ext> line(s) XX: <what changed>

Solution steps:
1. <step 1>
2. <step 2>

Why it works: <rationale>
```
When the close also moves the file (`git mv`), the move is committed in the **same** commit as the
body changes (status line, `**Solution:**` block, path adjustment). Git does not store renames — it
detects them when reading, by content similarity (default threshold 50 %). A normal close lands at
roughly 60–92 % similarity (`R060`–`R092`), **not** `R100`, because the close edits the file.

Two things push the similarity below the threshold — the move is then recorded as `D` + `A`, and
`git log --follow` on the archive path stops at the close commit:
- **A QA protocol in the same commit.** If `/qa` wrote its results into the bug file, commit them
  separately (`test(…)`/`docs(…): BUG-NNNN; QA result …`) **before** `/bug close` runs.
- **Link-dense bug files.** The mandatory path adjustment alone can touch a large share of the
  lines. Rule of thumb: from about **15 outgoing links**, or when the path adjustment touches more
  than a fifth of the lines, split the close into two commits — (1) the pure `git mv` (`R100`),
  (2) the content at the new location (status, `**Solution:**`, path adjustment, INDEX).

Small bug files are closer to the threshold than large ones (the `**Solution:**` block has a fixed
size, so the relative growth is larger). Counter-check after the close when the trail matters:
```bash
git show --name-status --find-renames <commit> -- docs/bugs | grep -E '^R'
```
The history is never lost — it stays reachable via the old path (`git log -- docs/bugs/bug-NNNN-….md`)
— only the convenient `--follow` path breaks.

## Handoff
After filing a new bug:
> "`BUG-NNNN` documented in `docs/bugs/bug-NNNN-<slug>.md`. To fix it: `/frontend|/backend|/auth
> BUG-NNNN`, then `/qa`, then `/bug close BUG-NNNN`."

After a status update:
> "`BUG-NNNN` marked [status]; file moved to `docs/bugs/archive/<quarter>/`; `INDEX.md` updated."
