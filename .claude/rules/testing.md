<!-- Deliberately WITHOUT paths: frontmatter. It governs CREATING test files (location, gates,
     regression locks); a path-scoped rule only arrives with the result of a read/edit on a matching
     file - for a file that does not exist yet, that is too late. Do not scope it. -->
# Automated Tests (MANDATORY)

> Stack-agnostic test discipline. The concrete runner, file pattern and command come from
> `.claude/rules/stack.md` (`test:` command + the test-location note `/init` / `/architecture`
> record there). Manual checks that only a human at the screen can do live in the test-case
> catalog (`docs/test-cases/`, UI projects) — everything a program can check reliably belongs here.

## Where tests live
Decided once per project (by `/init` or the first `/architecture`) and written into `stack.md` →
"Project-specific stack notes" — e.g. **colocated** next to the source file (`x.ts` + `x.test.ts`;
a test moves with its file on refactors) or a mirrored `tests/` tree (Python, Go conventions).
Shared test infrastructure (setup, mocks, fixtures) has exactly one home. Tests need **no secrets
and no environment files** — they run identically on a laptop and in CI.

## The gate: green means complete
A test gate promises "**all** tests passed", not "the ones that started passed". Some runners exit
`0` while worker processes never started under load — whole test files silently missing. The gate
(CI step and every deploy workflow) therefore checks that every test file **ran** (compare the
runner's report against the test files on disk; a small wrapper script does it) — with a file
filter or `-t` selection, completeness does not apply and the check is skipped with a note.

**Every app-deploy workflow has a test job** running the `test` command from `stack.md`, and the
deploy job `needs:` it — red or incomplete tests = no deploy (`.github/workflows/README.md`).

## What gets tested
**Test (mandatory for new or changed logic of this kind):** pure functions with branching (classify,
validate, sort, compatibility), error/marker → user-message translations, small pure display
components, extracted hooks/helpers — and **every bug fix on tested code** (below).
**Deliberate non-goals are a project decision**, written into the spec that introduced the test
foundation (typical: snapshot tests — assert behavior instead; a coverage-% gate; click paths —
those are manual test cases).

## Bug fix ⇒ regression test with a negative control (MANDATORY)
A fix on tested code brings a test that reproduces the bug — and that test is run **once against
the pre-fix state** and must be **red** there. A test that is green before and after the fix tests
something else (a stub that plays an environment that does not exist, the right building block at
the wrong place, test data that shares the bug's mistake). No test possible? The bug file says why.
Background: https://sql.marcus-belz.de/en/tests-pass-but-bug-still-there/

## Wiring: the call site counts, not only the function
When logic is extracted into its own tested unit, also show that it is **called at the right place**
— by a test that drives the caller, or by a manual test case. Three questions anyone can answer
without reading the code: *where did the bug sit? does a test turn red when that place is put back
to the old state? is a missing test intent or oversight?*
Background: https://sql.marcus-belz.de/en/unit-test-passes-integration-fails/

## Deliberately unguarded invariants
A non-goal is a statement about **kinds** of tests, not about individual promises in the code — so
an invariant nobody checks because its file is excluded by convention looks exactly like one nobody
thought of. Whoever leaves a promise **deliberately** unguarded adds one row to
[`docs/inventories/unguarded-invariants.md`](../../docs/inventories/unguarded-invariants.md): what a
refactor could silently remove, why no net catches it, what closes the gap. No row = the net is
missing by accident. (SQL behavior belongs in the DB apply smoke, not in this list.)

## Determinism and flakes
- **No `retry` for flaky tests** — fix or remove them, never mask them.
- Time and network are faked (fake timers, stubbed clients) — determinism is mandatory.
- **Two time budgets must fit each other:** the per-test timeout must exceed the worst-case sum of
  the waits inside one test (+ a measured reserve). Derive one from the other in code instead of two
  independent literals that drift apart.
- **Local flake vs. defect:** a test red only in a full local run under CPU load, but green when its
  file runs **alone** (whole file, not one test), is load, not a defect; red alone = a real defect.
  CI is the authoritative instance.

## Load tests: pinned, capped, cleaned up, announced
Artificial CPU load is a legitimate tool (a load flake is only proven by reproducing it on the
pre-fix state) — but an agent sees exit codes, not a frozen desktop. All four, not three of them:
1. **Pinned** to a few cores (`taskset -c 0,1 …`), not machine-wide.
2. **Capped** — the number of burners is calibrated (find the reproduction threshold), not "more helps".
3. **Cleanup via `trap`**, not a last line: `trap 'kill $(jobs -p) 2>/dev/null' EXIT INT TERM`, plus a
   hard `timeout` on every run — a final `kill` does not run exactly when someone aborts.
4. **Announced beforehand** — whether the machine may be unusable for minutes is its owner's call.

## Don'ts
- ❌ Tests that need `.env*` files, secrets, or a live database/service (mock the boundary; DB
  behavior goes into the DB tests / apply smoke).
- ❌ Importing server/DB modules unmocked into unit tests.
- ❌ `retry`, snapshot noise, a green gate that does not check completeness.
- ❌ A new deploy workflow without the test-job gate.
