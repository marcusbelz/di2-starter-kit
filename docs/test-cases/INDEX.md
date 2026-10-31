# Test-Case Index

> **Derived view.** The truth is each file under [`cases/`](cases/) - suites, run class, status
> and reference live in its header. This index summarizes them and is compared against the files
> by `node scripts/check-testcases.mjs` (blocking in CI). Convention: [README.md](README.md).
>
> **The rows below are shipped samples** (tied to the sample feature `feat-0002`). `/init` deletes
> them and resets the counters (`TEST-0001`, `SUITE-001`).

## Status

| Field | Value |
|-------|-------|
| Last updated | 2026-06-12 |
| Active test cases | 1 |
| Retired | 0 |
| Next free ID | TEST-0002 |
| From a bug | 0 of 1 |
| Next free suite number | SUITE-002 |

> **"From a bug"** is derived from the `Reference:` field (it names a `BUG-NNNN` = the case locks a
> known damage instead of checking a promise of the spec), active cases only. Not a quality flaw,
> but a statement about the catalog: the closer it gets to the total, the more the catalog is a pure
> regression net. Background: [README - Origin](README.md#origin-spec-or-bug).

## Suites

> A test case may belong to several suites (n:m). Membership lives in the `Suites:` field of the
> case (value `SUITE-NNN`), not in the directory tree. File layout, order and cut rule:
> [README - Suites](README.md#suites).

| Suite ID | Overview | Focus | Active test cases |
|---|---|---|---|
| SUITE-001 | [Task list *(sample)*](suites/suite-001-task-list.md) | Status display and status changes in the task list (sample feature `feat-0002`) | 1 |

## Test cases

> Sorted by ID ascending. `Smoke` = run on every deployment, `Regression` = run when its
> [coverage](README.md#coverage-which-test-cases-are-due-after-a-change) was touched, before
> `/deploy prod`, and periodically.

| ID | Title | Suites | Run class | Reference | Status |
|----|-------|--------|-----------|-----------|--------|
| [TEST-0001](cases/test-0001-status-change-offers-only-allowed-next-states.md) | Status change from the task row offers only the allowed next states *(sample)* | SUITE-001 | Smoke | feat-0002 AC 1 | Active |
