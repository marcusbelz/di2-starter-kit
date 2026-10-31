# Test-Case Catalog (manual UI test cases)

> Repeatable test cases that a human executes on screen, plus the protocols of their runs. Purpose:
> after a change and before a deployment, run a defined set of manual checks instead of
> reinventing them each time - and record what was actually observed.
>
> **Scope boundary:** the catalog only takes what can be checked **on screen alone** - the moment
> a message appears, the behavior of a page on a small screen, a user's path through several
> views. Everything a program can reliably check by itself belongs in the automated tests next to
> the code (commands in [`.claude/rules/stack.md`](../../.claude/rules/stack.md)): they run on
> every change, a test case only runs when someone clicks.
>
> **Only in projects with a UI** (`ui` is not `none` in `stack.md`) - `/init` removes the catalog
> and its guard otherwise. Files whose title ends in *(sample)* are shipped examples tied to the
> sample feature `feat-0002`; `/init` deletes them and resets [INDEX.md](INDEX.md).

## Table of Contents

1. [Why declaration and run are kept apart](#why-declaration-and-run-are-kept-apart)
2. [Layout](#layout)
3. [IDs and file names](#ids-and-file-names)
4. [Test cases never move](#test-cases-never-move)
5. [Test-case template](#test-case-template)
6. [When a test case is written](#when-a-test-case-is-written)
   - [Who writes it, and by when](#who-writes-it-and-by-when)
   - [The four writing rules](#the-four-writing-rules)
   - [Not every AC becomes a test case: the marker](#not-every-ac-becomes-a-test-case-the-marker)
   - [The Reference field](#the-reference-field)
   - [Origin: spec or bug](#origin-spec-or-bug)
7. [Checklist while writing](#checklist-while-writing)
8. [Suites](#suites)
9. [Coverage: which test cases are due after a change](#coverage-which-test-cases-are-due-after-a-change)
10. [Run classes](#run-classes)
11. [When a new classification field is added](#when-a-new-classification-field-is-added)
12. [Baseline convention (test data)](#baseline-convention-test-data)
13. [Run protocols](#run-protocols)
    - [The run is the evidence](#the-run-is-the-evidence)
14. [What a test case is not](#what-a-test-case-is-not)
15. [Five questions before a case enters the catalog](#five-questions-before-a-case-enters-the-catalog)
16. [The guard](#the-guard)
17. [Cross-references](#cross-references)
18. [Further reading](#further-reading)

## Why declaration and run are kept apart

A test case is **declared once** and **executed any number of times**. The two are strictly
separate files:

- **Declaration** (`cases/*.md`) - what is checked, from which starting state, with which expected
  result. It contains **no** date, **no** result, **no** environment. It changes only when the
  expected behavior changes.
- **Run protocol** (`runs/*.md`) - who executed which test cases when, on which environment, and
  what was observed.

A result written into the test case spoils it for the next run: whoever reads the old result
confirms it without noticing. That is the whole reason for the split.

## Layout

```
docs/test-cases/
├── README.md                          # this file - the convention
├── INDEX.md                           # derived view: status block, suites, test cases
├── cases/
│   └── test-NNNN-<slug>.md            # ONE test case per file, flat, never moved
├── suites/
│   └── suite-NNN-<name>.md            # overview per suite (focus, baseline, execution, order)
└── runs/
    └── YYYY-MM-DD-<env>[-<suffix>].md # protocol of one run
```

- **`cases/` is flat - deliberately and for good.** No subdirectories per area (areas change, the
  file would have to move), no number ranges (`0001-0100/`) - they cost a calculation on every
  lookup and buy nothing that `ls` or `grep` cannot do.
- **`suites/` holds no test cases**, only overviews. Membership lives in the test case itself
  (field `Suites:`) - see [Suites](#suites).
- Each directory keeps a `.gitkeep`, so the structure survives when it is empty.

## IDs and file names

- **`TEST-NNNN`**, four digits, sequential across the **whole** catalog (not per area) - read the
  same way as `BUG-NNNN` and the feature IDs. The next free ID is in the status block of
  [INDEX.md](INDEX.md).
- **File name `test-NNNN-<kebab-slug>.md`** in `cases/`, like `docs/bugs/bug-NNNN-<slug>.md`.
- **Run protocols reference only the `TEST-NNNN` number** - never the title. Titles may sharpen;
  the number stays, so old runs keep their reference.
- IDs are **never reused** and **never renumbered** - not even when a case is dropped (it gets
  status `Retired (<reason>)` instead).
- Why flat IDs: a test case drifts between areas over time (screens get rebuilt, features move).
  An area-bound ID (`TEST-LIST-003`) would then be wrong or rewritten - and every run referencing
  it would go dead.

## Test cases never move

A test case is **not a process that ends** but a permanent piece of the repository: it can become
due again any time a fix touches its subject. Hence one hard rule:

> **A file under `cases/` keeps its path forever.**

- **No archive.** Unlike bugs (`docs/bugs/archive/<quarter>/`) and features
  (`features/archive/<quarter>/`), a test case has no end state that justifies a move. A dropped
  case gets `Status: Retired (<reason>)` and stays where it is.
- **No area or suite folders.** When the grouping changes, the `Suites:` field changes, not the
  path.
- The rule "archiving pulls the links along"
  ([documentation.md](../../.claude/rules/documentation.md)) therefore never applies here - there
  is nothing to archive. A run from this year still resolves in two years, and a bug report may
  point to "TEST-0001 covers this" for good.

## Test-case template

Every file in `cases/` follows exactly this structure:

```markdown
# TEST-NNNN: <title>

- **Suites:** SUITE-NNN[, SUITE-NNN …]
- **Run class:** Smoke | Regression
- **Status:** Active | Retired (<reason>)
- **Reference:** <spec ID + AC numbers, and/or BUG-NNNN - see "The Reference field">
- **Coverage:**
  - [path/to/file](../../../path/to/file)

**Goal:** <What is this test case meant to show? One sentence.>

**Precondition:** <State from which the test case starts.>

**Steps:**

| # | Step | Expected result |
|---|------|-----------------|
| 1 | <click step> | <what has to be visible at that step> |

**Expected throughout:**
- <statement that belongs to no single step>

**Cleanup:** <How the starting state is restored.>
```

**Step and expected result sit side by side in one table, not in separate sections.** Whoever
works through the case reads one row and knows what has to happen - no jumping between two lists
while keeping the numbers in mind. The table also shows when a step lacks its expectation or an
expectation lacks its step. A test case is a document to *work through*, not to read.

- **The `#` column is the handle.** Run protocols and bug reports refer to "step 4", not to a
  paragraph. Rows are numbered 1..n without gaps.
- **A step without an observation of its own** gets a `-` in the result column. That is more
  honest than inventing an expectation.
- **`Expected throughout`** holds what belongs to no single step - invariants ("no page reload at
  any step"), boundaries ("the close button of the panel is not a violation"), tolerances ("the
  position is only roughly the same - not a failure"). Omit the section when there is none.
- **Explanatory notes** (why a detour is needed, which trap exists, which question is deliberately
  not covered) go in a `>` block **before** the table, never into a cell.
- **The expected result must be observable.** "The message appears" can be checked; "the system
  behaves correctly" cannot. Where the point in time is part of the expectation, it is written
  down (see the [writing rules](#the-four-writing-rules)).
- **Every test case runs on its own.** The precondition **never** refers to the end state of
  another test case - whatever the case needs is an explicit setup step in its own table.
  Otherwise a suite only runs in one fixed order, a single case cannot be repeated, and a
  forgotten setup step looks like a bug in the application.

## When a test case is written

The file under `cases/` is written **before the code** - in `/ux`, as soon as the mockups are
approved. That is the earliest point at which both halves of a test case exist:

| Part of the test case | Source | Settled in |
|---|---|---|
| **Goal** + **Expected result** | the acceptance criterion (AC) of the spec | `/requirements` (in the spec text) |
| **Precondition** + **Steps** + **Cleanup** | the approved mockups | `/ux` |

> The test case **copies** the expectation from the AC - it never rewords it from the finished
> code.

Whoever derives the expected result from the diff writes down what the application *does*; such a
case can hardly fail. Whoever takes it from the AC writes down what the application is *supposed*
to do. The difference shows exactly in the interesting case - when the two diverge.

In a classic setup the role split "tester is not the developer" keeps the expectation from being
written along the implementation. With a coding agent that split does not exist: the same agent
writes the spec, the code, and the test case. The separation is therefore made **in time** instead
of by person - the expectation is on paper before the code exists. A separation in time only holds
when it has a **deadline**; the table below sets it.

### Who writes it, and by when

| Role | Who | What |
|---|---|---|
| **Author** | [`/ux`](../../.claude/skills/ux/SKILL.md) | writes a case for every marked AC as soon as the mockups are approved |
| **Deadline** | `/backend` + [`/frontend`](../../.claude/skills/frontend/SKILL.md) | do **not** start while the spec has a marked AC without a case (bug-fix mode is exempt) |
| **Consumer** | [`/qa`](../../.claude/skills/qa/SKILL.md) | runs the declared cases and writes a run protocol - or records why not; it does **not** write feature cases |
| **Net** | `node scripts/check-testcases.mjs`, rule `[manual-ac]` | AC-level parity spec ↔ catalog, blocking in CI |

**Why `/ux` and not `/qa`:** `/qa` runs **after** the code. A case written there is derived from the
diff, not from the AC - and the only role separation the project has is gone. A gate at that point
would check whether a **file exists**, not whether the **expectation came about independently**;
in any count the two are indistinguishable. `/ux` is the earliest possible point: after
`/requirements` the criterion exists, but not yet *where* one clicks - screens, labels, and dialogs
are decided by `/ux`.

**What may change after implementation:** labels, paths, and orders that differ in the finished
screen from the mockup - as a **correction of the steps**. The *Expected result* column stays
untouched; if the application differs from it, that is a finding (a bug, or a spec change the user
decides), never an edit of the case.

### The four writing rules

1. **The expectation comes from the requirement, not from the diff.** `Reference:` names the AC (or
   the bug, see [Origin](#origin-spec-or-bug)), and the expected result can be traced back to it.
   If writer and implementer cannot be kept apart in one pass, derive the expectation in a step of
   its own that does **not** see the diff.
2. **No implementation vocabulary in the expected result.** The case is executed by a human at the
   screen, not by the author of the code. A name that appears nowhere on the screen (a procedure,
   a view, an internal status code, a database column, an endpoint) makes the case impossible to
   judge independently - it is worded wrongly. Terms the user interface itself uses are explicitly
   allowed.
3. **At least one "must not" statement.** A case written along the implementation describes the
   path that exists. The enforced negation brings back part of the rest ("**no** confirmation
   dialog", "**not** offered", "still exactly **one** row"). A negation that only satisfies the
   rule is worthless - it has to rule out something that could plausibly happen with this feature.
4. **Name the point in time where it matters.** "The message appears" invites the question: when?
   Immediately, after reloading, or only after leaving and re-entering the view? Write the answer
   into the expectation - that question is often what makes a bug visible.

### Not every AC becomes a test case: the marker

The catalog only covers what can be checked on screen alone (see the head of this file). The
decision "which AC belongs in it?" is made in
[`/requirements`](../../.claude/skills/requirements/SKILL.md) - while the spec is written, not
later when a bug forces it. Every other AC stays an AC in the spec and is locked by automated
tests where possible.

A manual-only AC is **numbered** and carries a marker **at its end** (on its last line when the AC
wraps). The marker has **exactly two valid forms**:

```markdown
- [ ] **AC 3:** <observable expected result> *(manual-AC)*
- [ ] **AC 4:** <observable expected result> *(manual-AC: <what to do on screen>)*
```

Any other spelling (`*(Manual AC)*`, `*(manual-ac)*`, a marker in the middle of the text, a marker
on an unnumbered AC) is a finding of the guard. The form is checked for a concrete reason: in the
project this catalog comes from, the marker once existed in two spellings, and an exact counter
reported nine marked criteria instead of ten - and stayed green. A counter with a blind spot is
worse than none, because it looks like a measurement. (The text after the colon contains no
parentheses.)

### The Reference field

`Reference:` names what the case proves, as plain IDs (no links - IDs never change, files move to
the archive):

| Form | Meaning |
|---|---|
| `feat-0002 AC 1` | one AC of a spec |
| `feat-0002 AC 1, AC 3` | several ACs of a spec |
| `feat-0002 AC 1-3` | a range of ACs |
| `feat-0002 AC 4; feat-0005 AC 2` | ACs of several specs, separated by `;` |
| `feat-0002 AC 4; BUG-0012` | an AC plus the bug the case also locks |
| `BUG-0012` | a bug-derived case |

Feature IDs are lower case (`<prefix>-XXXX`, prefix from `stack.md`). Nothing else goes in the
field - the goal sentence says what the case proves. The guard reads this field for the AC parity
(an active case counts for exactly the AC numbers it names) and checks that every named spec, AC,
and bug exists.

### Origin: spec or bug

A test case has exactly two possible occasions, and they are worth different things:

- **From the spec** - it checks a promise. It can find something nobody has seen yet.
- **From a bug** (`Reference:` contains `BUG-NNNN`) - it locks a known damage. By definition it
  mainly finds recurrences.

Both are legitimate, but the ratio says something about the catalog: if it consists almost only of
bug-derived cases, it is a pure regression net and structurally finds little that is new. That is
why the ratio is a derived line in the status block of [INDEX.md](INDEX.md) ("From a bug: x of y",
active cases only), recalculated by the guard - it is **not** a field in the case, it follows from
`Reference:`.

A bug-derived case is written only when the reproduction is UI-only and no automated test can lock
it; everything else gets an automated regression test with the fix. A bug-derived case is
`Regression` by default.

## Checklist while writing

A list of **ideas while writing** a case - **not** a field in its header (why:
[When a new classification field is added](#when-a-new-classification-field-is-added)). It answers
"what have I not thought of yet?", not "how do I classify this?".

| Question | Ask |
|---|---|
| **Main path** | Does the feature do what it was built for? |
| **Reverse direction** | Does the state go back again as well? |
| **Blocked path** | Is what should be forbidden actually forbidden? |
| **Point in time** | When does the result become visible - immediately, after reloading, or only on entering the view again? |
| **Screen size** | Does the page behave differently on a small screen? |
| **Permission** | Do different roles see different things, and may they do different things? |
| **Language** | Is it right in every language the UI ships? |
| **Boundary value** | What happens exactly at the threshold, not just far above it? |
| **Failure case** | What does the user see when the call in the background fails? |

**Every hit that needs a path of its own becomes a test case of its own**, not another item in an
existing one. Otherwise it is unclear on a `FAIL` which statement broke, and the case cannot be
repeated selectively. Deliberately not covering a question is fine - then the decision goes into
the case as a sentence (a `>` note before the table), so the next reader does not take it for an
oversight.

Deliberately not on the list: security (project-wide in `/security`), performance, accessibility
audits, browser matrices - as long as the project has no procedure for them, a case claiming them
promises something nobody delivers. Anything pure and deterministic belongs in the automated tests
(see [What a test case is not](#what-a-test-case-is-not)).

## Suites

A **suite** is a numbered set of test cases that is **run in one session in one go** - on a shared
baseline, in a fixed order. It is not a topic drawer: "which cases touch the task list?" is answered
by the `Coverage:` field, not by a suite.

**File and ID**

- **File:** `suites/suite-NNN-<kebab-name>.md`. Nothing else lives in `suites/` (except `.gitkeep`).
- **Suite ID:** `SUITE-NNN`, three digits. The number appears in exactly two places - the file name
  and the title `# SUITE-NNN: <name>` - and is the same in both.
- **Assignment:** sequential in the order suites are created; the next free number is in the status
  block of [INDEX.md](INDEX.md). Numbers are **never reassigned or reused**, not even when a suite
  is given up. If two branches claim the same next number, the guard reports the duplicate; the
  suite merged later moves up one number.
- **The name in the file name is only a reading aid.** It may sharpen; no test case carries it.

**Where what lives**

| Information | Lives in | Maintained? |
|---|---|---|
| Membership of a test case | field `Suites:` in the case, values `SUITE-NNN`, ascending, comma-separated | **yes - the truth** |
| Focus, baseline, execution | suite file | yes |
| Order of the cases | table of the suite file | yes - a property of the suite (one case can sit at different positions in two suites) |
| ID, title, run class, other suites in the suite table | derived from the case | copied, compared by the guard |
| Suite table and active-case count in the INDEX | derived | copied, compared by the guard |

A case may belong to several suites (n:m) - which folders cannot do, the main reason against
grouping by directory. It never changes its path for that.

**Layout of a suite file** - every active suite has exactly these sections in this order, and no
other `##` headings:

```markdown
# SUITE-NNN: <name>

> **Status:** Active
>
> Test cases carry `SUITE-NNN` in their `Suites:` field. This file is an overview, not a container.

## Focus

<What the suite checks, and why that needs manual cases.>

## Baseline

<Starting state for all cases. Where it differs from the project baseline, it says so here.>

## Execution

**Order:** ascending by `TEST-NNNN`.

<Particulars - or "No particulars.">

## Test cases

| # | ID | Title | Run class | Other suites |
|---|----|-------|-----------|--------------|
| 1 | [TEST-NNNN](../cases/test-NNNN-<slug>.md) | <title> | Regression | [SUITE-MMM](suite-MMM-<name>.md) |
| - | [TEST-NNNN](../cases/test-NNNN-<slug>.md) | ~~<title>~~ (retired) | Regression | - |
```

- **Head:** `> **Status:** Active` or `> **Status:** Retired (<reason, successor>)` as the first line
  after the title.
- **Execution** holds everything about the run: order, cases that change data, a second account,
  the preferred environment, pointers to related cases in another suite. No extra "Notes" section.
- **Other suites** lists the case's remaining suites as links, ascending; `-` if there are none.

**Order of the cases**

- The table is in **execution order**; the `#` column counts 1..n without gaps.
- **Default:** ascending by `TEST-NNNN`, stated as the first line of "Execution" (wording as above).
- **A different order only with a reason:** `**Order:** deviating - <reason>`. The guard checks
  "ascending" strictly and requires the reason for "deviating".
- **Retired cases** stand without a position (`-`) at the end of the table.
- The order saves walking; it never carries preconditions - every case still runs on its own.

**Cut rule: when a case belongs to a suite**

> **A test case belongs only to suites whose baseline it can run on in the same session.**

If a case needs a different baseline (a second account, a large data set), it belongs to the suite
of that baseline - even if it fits the other suite by topic. Otherwise it is skipped there on every
run. The topical suite points to it in its "Execution" section. After every change: each active
case belongs to at least one suite, and no active suite is empty.

**When a new suite is created:** several cases share a baseline or a constraint (they change data,
need a second account) that no existing suite carries; or a screen/feature gets its first cases and
fits no existing session. Not for a single case that fits an existing suite, and not as a second
view of the same session. Procedure: take the next free number from the INDEX, create the file per
the layout above, set `Suites:` in the cases, update the suite table and "Next free suite number" in
the INDEX, run the guard and the link check.

**Rename and retire**

- **Rename:** `git mv` the file, adjust the title, update incoming links in the same commit. The ID
  stays; no case is touched.
- **Retire:** the file stays, the head becomes `> **Status:** Retired (<reason>, successor
  SUITE-NNN)`, the INDEX shows `-` for active cases. No active case points to it any more. Old run
  protocols keep resolving.

**Don'ts:** a name instead of the number in `Suites:` · reassigning or renumbering suite numbers ·
deleting a suite file (retire it) · maintaining membership in the suite file and forgetting the case
(the case wins, the guard reports the difference) · a "position" field in the case (the order
belongs to the suite) · extra sections in a suite file · assigning a case to a suite whose baseline
it cannot run on · moving or renaming cases because of a suite.

## Coverage: which test cases are due after a change

The run class `Regression` says "after changes in the affected area" - but not **which area was
affected**. For that, every case declares under `Coverage:` the files it targets. The selection
becomes mechanical instead of tribal knowledge:

```bash
# Which test cases declare a file that changed since the code state of the environment?
git diff --name-only <env-sha>..HEAD | grep -l -F -f - docs/test-cases/cases/*.md
```

(Retired cases in the result are dropped; the environment's SHA is in its last run protocol or
its version endpoint.)

A case that already passed becomes **due again** as soon as one of its coverage files was touched.
That is the purpose: a fix collects the affected older cases by itself instead of relying on
someone remembering them.

- **The entries are markdown links** with the repo-relative path as link text.
  `node scripts/check-md-links.mjs` checks on every push that they exist - when code moves, stale
  coverage shows up at once instead of silently going wrong.
- **Written before the code:** `/ux` lists the files that already exist and that the case targets.
  For a screen that does not exist yet, the feature spec stands in as the only entry; `/frontend`
  replaces it with the real files in the commit that creates them.
- **The result is a minimum, not a proof of completeness.** A UI case exercises more than the files
  it names. Coverage prevents *forgetting* in daily work; it does **not** replace the full run of
  all `Regression` cases before `/deploy prod`.

## Run classes

| Class | When to run | Selection criterion |
|---|---|---|
| **Smoke** | on **every** deployment to any environment | the core path of a feature; a failure means "do not ship like this". Keep the set small. |
| **Regression** | when its [coverage](#coverage-which-test-cases-are-due-after-a-change) was touched, before `/deploy prod` (the full set), and periodically (e.g. quarterly) | edge cases and closed bugs whose return would be expensive |

## When a new classification field is added

The header of a case carries **one** classification axis: `Run class`. Textbook taxonomies know
many more (test objective, test level, priority, …). For this catalog the bar is deliberately high:

> A new field enters the header only when **both** hold:
>
> 1. at least **two** existing cases would get **different** values, **and**
> 2. the value changes **when** or **where** a case is run.
>
> Otherwise the distinction stays prose in the case.

- **A constant field says nothing.** A "test level" would be "system/E2E" for every case - the
  catalog only holds what is checked on screen.
- **A priority would duplicate.** "What has to run?" is already answered by the run class (Smoke =
  a failure means "do not ship") and by coverage (what this change touched). A third answer,
  maintained by hand, drifts away from the first two.
- **A field costs five places:** the header of every case, the guard, a column in the INDEX with its
  comparison, this README, and the retrofit of all existing cases.

The argument is one of effort, not of principle: it holds for a few dozen cases and one maintainer.
With hundreds of cases and several teams the calculation can come out differently.

## Baseline convention (test data)

To be repeatable, cases need a **defined starting state** - the data a case works on, the role it
is signed in with, the screen width. The project sets **one** baseline here, and every case
restores it in its `Cleanup`, so the next run starts without leftovers:

> **Project baseline:** _not set yet - `/ux` proposes it with the project's first test case, the
> user decides, and it is recorded here (data set, signed-in role, screen width, what every case
> restores at the end)._

Deviations from the baseline go explicitly into the case's `Precondition` and into the suite's
"Baseline" section.

## Run protocols

One file per run: `runs/YYYY-MM-DD-<env>[-<suffix>].md`. `<env>` is an environment name from
`env_stages` in `stack.md` (e.g. `dev`, `test`, `prod`) or `local` for a developer workstation; the
optional suffix (`retest`, a feature ID) separates several runs on the same day and environment.

```markdown
# Run YYYY-MM-DD - <env>

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Environment | <env> (<URL or "local workstation">) |
| Code state | `<git SHA>` (branch `<branch>`) |
| Executed by | <who clicked> (<who guided, if anyone>) |
| Occasion | <why this run: /qa <feature ID>, /deploy <env>, a bug re-test, …> |

## Results

| Test case | Step | Result | Note |
|-----------|------|--------|------|
| [TEST-NNNN](../cases/test-NNNN-<slug>.md) | 1 | PASS | <what was observed> |
| [TEST-NNNN](../cases/test-NNNN-<slug>.md) | 2 | FAIL | BUG-NNNN - <one line> |
| [TEST-NNNN](../cases/test-NNNN-<slug>.md) | 3-5 | SKIP | <reason> |

**Summary:** <n> test cases - <x> PASS, <y> FAIL, <z> SKIP. <What stays due.>
```

- **Results are recorded at step level.** `PASS` and `FAIL` name a **single** step that was actually
  observed - a "pass" claimed for several steps at once is a claim, not an observation. `SKIP` may
  name a step, a range (`3-5`), or `-` for the whole case.
- **`SKIP` needs a reason** in the note (environment missing, depends on a failed step, …).
- **`FAIL` needs a bug reference** (`BUG-NNNN`). Findings are filed via `/bug`, not written out in
  the protocol - the protocol only points to them.
- Further sections (`## Notes`: hints for the next run, observations without a finding) are free.
- **A run is never rewritten afterwards.** A re-test after a fix is a **new** run with its own file -
  the old `FAIL` stays as the record. Same reasoning as the no-reopen rule for bugs
  ([general.md](../../.claude/rules/general.md)): the audit trail stays linear. (Pure link
  maintenance after a rename changes targets, not results, and is allowed.)

### The run is the evidence

A test case that is only written is a **promise**; only the protocol of a run shows that it was
executed and what was visible while doing so. The first run tests the test case itself, too: it
often reveals a path that does not exist or an expectation nobody can observe on screen.

A hard block ("no close without a run") is the wrong answer - a case on screen needs an environment
where someone can click, which is not always at hand. Workable is: **run it, or record the backlog
visibly** - in the QA results of the spec or in the bug file, naming the `TEST-NNNN` that is still
due. A backlog buried in running text only surfaces when someone asks. The guard prints the active
cases that never appear in a run with a `PASS` or `FAIL` as a non-blocking note.

## What a test case is not

- ❌ Not a replacement for an automated test. Whatever is pure and deterministic belongs in the
  automated tests - there it runs on every change, here only when someone clicks.
- ❌ Not a bug description. A found defect becomes a bug; the case keeps describing the **expected**
  behavior.
- ❌ Not the click log of one session. Cases are written free of dates and environments.
- ❌ Not a classification exercise. One axis (`Run class`) until two cases need a second one.

## Five questions before a case enters the catalog

| Question | How to check it |
|---|---|
| Does the expectation come from the requirement? | `Reference:` names the AC, and the expected result can be traced back to it. |
| Do step and expectation sit side by side? | Every row of the table has both, or deliberately a `-`. |
| Is the point in time named where it matters? | The expectation says *when* something becomes visible, not just *that* it does. |
| Is there a statement about what must not happen? | At least one expectation is a negation. |
| Has the case run once? | It appears in a run protocol. |

## The guard

`node scripts/check-testcases.mjs` (dependency-free, blocking in CI) compares the three lists -
case files, suite files, INDEX - against each other and the catalog against the specs: file names
and IDs, required fields and values, the steps table, INDEX rows and counts (incl. next free IDs
and the bug-derived ratio), suite layout and order, run-protocol form, and the `[manual-ac]` parity
(every marked AC of a spec that has reached `/ux` - or at the latest `In Review` - is named by an
active case). The rule list with fix hints is in the header of the script.

It checks **form, not content**: whether a case was written before the code, whether its
expectation is independent, whether the described path exists - that is judgment, owned by the
skills and the first run. Whether coverage links resolve is checked by
`node scripts/check-md-links.mjs`.

## Cross-references

- [INDEX.md](INDEX.md) - derived view of all cases and suites, compared against the files by the
  guard.
- [scripts/check-testcases.mjs](../../scripts/check-testcases.mjs) - the guard.
- [`/requirements`](../../.claude/skills/requirements/SKILL.md) - marks manual-only ACs.
- [`/ux`](../../.claude/skills/ux/SKILL.md) - writes the cases and, when needed, a suite.
- [`/qa`](../../.claude/skills/qa/SKILL.md) - runs the cases and writes the run protocol.
- [docs/bugs/INDEX.md](../bugs/INDEX.md) - bug tracking; the target of every `FAIL`.
- [.claude/rules/documentation.md](../../.claude/rules/documentation.md) - where which doc lives.

## Further reading

The conventions here are described in depth, with the numbers from the project they come from, in
a series of articles:

- [How to Write Manual Test Cases](https://sql.marcus-belz.de/en/how-to-write-manual-test-cases/) -
  the template, the four writing rules, origin, field frugality, the run as evidence.
- [The First Run Tests the Test Case](https://sql.marcus-belz.de/en/test-case-dry-run/) - why a
  declaration can be wrong unnoticed, step-level protocols, retiring instead of deleting.
- [The Green Test That Proves Nothing](https://sql.marcus-belz.de/en/tests-pass-but-bug-still-there/) -
  the automated counterpart: a green test at first only confirms its own assumptions.
- [Unit Test Passes, Integration Fails](https://sql.marcus-belz.de/en/unit-test-passes-integration-fails/) -
  why a tested function says nothing about whether it is called.
