# SUITE-001: Task list *(sample)*

> **Status:** Active
>
> **Sample suite.** Ships with the starter kit together with the sample test case for the sample
> feature `feat-0002`. Not a real suite - `/init` deletes the samples.
>
> Test cases carry `SUITE-001` in their `Suites:` field. This file is an **overview**, not a
> container: the cases live flat under [`cases/`](../cases/) and never move
> ([README](../README.md#test-cases-never-move)).

## Focus

Status display and status changes in the task list (sample feature `feat-0002`): which next states
a task offers, and how fast the list shows a change.

Why this needs manual cases: whether a change takes "a single action on the row" and shows
"immediately" is judged at the screen. The transition rules themselves (which change is allowed,
what an invalid one returns) are locked by the automated tests.

## Baseline

Signed in as a regular user (no admin role) whose task list is empty; desktop browser window at
least 1280 px wide. Every case creates the tasks it needs as setup steps and deletes them in its
cleanup.

## Execution

**Order:** ascending by `TEST-NNNN`.

No particulars - the suite runs on any environment with one regular account.

## Test cases

| # | ID | Title | Run class | Other suites |
|---|----|-------|-----------|--------------|
| 1 | [TEST-0001](../cases/test-0001-status-change-offers-only-allowed-next-states.md) | Status change from the task row offers only the allowed next states *(sample)* | Smoke | - |
