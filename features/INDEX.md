# Feature Index

> Central tracking for all features. Updated by skills automatically. Empty until `/requirements`
> creates the first feature spec.

## Status Legend
- **Planned** - Requirements written, ready for development
- **In Progress** - Currently being built
- **In Review** - QA testing in progress
- **Deployed** - Live in production
- **Superseded** - Replaced by another spec; not implemented

**Deployed** and **Superseded** are terminal statuses: the spec file is `git mv`'d to the
quarterly archive `features/archive/<YYYY-QN>/` (quarter of the prod deploy / supersede date) and
its row moves to the [archived table](#features-archived) below. Feature IDs are never reassigned,
and an archived spec never moves back — follow-up work gets a new feature ID.

## Features (active)

> Feature-ID scheme: `<prefix>-XXXX` (the prefix is set by `/init`, default `feat`; see
> `.claude/rules/stack.md` → `feature_id_prefix`). One file per feature in
> `features/<prefix>-XXXX-name.md`.
>
> **The rows below are shipped samples** (an invented task manager) — one per lifecycle
> stage, illustrating the spec format incl. the copy-paste "Skill Commands" section. They do
> **not** mean the project is initialized (that signal is `.claude/rules/stack.md` /
> `docs/PRD.md`). `/init` deletes them (incl. the archived one) and resets the ID counter to
> `<prefix>-0001`.

| ID | Feature | Status | Spec | Created |
|----|---------|--------|------|---------|
| feat-0002 | Task Status Workflow *(sample)* | In Progress | [feat-0002-task-status-workflow.md](feat-0002-task-status-workflow.md) | 2026-06-10 |
| feat-0003 | Task Search & Filter *(sample)* | Planned | [feat-0003-task-search-filter.md](feat-0003-task-search-filter.md) | 2026-07-03 |

## Features (archived)

> Completed features (Deployed / Superseded). One row per feature; the spec keeps its filename and
> lives in `archive/<YYYY-QN>/` — links from elsewhere reference the feature ID, which never changes.

| ID | Feature | Status | Spec | Completed |
|----|---------|--------|------|-----------|
| feat-0001 | Task CRUD *(sample)* | Deployed | [archive/2026-Q2/feat-0001-task-crud.md](archive/2026-Q2/feat-0001-task-crud.md) | 2026-06-20 |

## Next Available ID: feat-0004 (samples included — resets to `<prefix>-0001` after `/init` removes them)
