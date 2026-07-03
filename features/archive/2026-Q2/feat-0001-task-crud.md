# feat-0001: Task CRUD

> **Sample feature.** Ships with the starter kit to illustrate the spec format and a **completed**
> lifecycle (`Deployed`). Not a real feature of your project — `/init` deletes the `feat-000X`
> samples and resets the ID counter. The invented product is a minimal task manager.

## Status: Deployed
**Created:** 2026-06-01
**Last Updated:** 2026-06-20

## Dependencies
- None

## Skill Commands (copy-paste)
> The workflow commands for THIS feature, in build order. Copy the next open one into a Claude
> Code session. (All completed for this sample — shown as a filled example.)

```
/architecture feat-0001
/ux feat-0001
/backend feat-0001
/frontend feat-0001
/qa feat-0001
/review feat-0001
/security
/deploy prod
```

Bug-loop, when QA (or production) finds a defect in this feature:

```
/bug <description>
/backend BUG-NNNN     (or /frontend BUG-NNNN / /auth BUG-NNNN, by area)
/qa feat-0001
/bug close BUG-NNNN
```

## User Stories
- As a user, I want to create a task with a title and optional description so that I can capture work.
- As a user, I want to see my tasks in a list so that I know what is open.
- As a user, I want to edit a task's title/description so that I can correct or refine it.
- As a user, I want to delete a task so that obsolete entries disappear.

## Acceptance Criteria
- [x] Creating a task with a non-empty title (≤ 200 chars) adds it to the list immediately.
- [x] The list shows title, created date, and status; newest first; paginated (bounded query).
- [x] Editing persists and updates `modified_on`/`modified_by`.
- [x] Deleting asks for confirmation (ConfirmDialog) and removes the row.
- [x] All endpoints reject unauthenticated requests.

## Edge Cases
- Empty / whitespace-only title → validation error under the field, no request sent.
- Two users editing the same task → last write wins; `modified_by` shows who.
- Deleting an already-deleted task (stale list) → clear error toast, list refreshes.

## Technical Requirements (optional)
- Performance: list responds < 200ms at 10k tasks (index on `created_on`).
- Security: authentication required on every endpoint; RLS on the `task` table.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
Backend: REST endpoints `POST/GET/PUT/DELETE /api/tasks` against table `app.task`
(`id bigint identity`, `title`, `description`, audit columns per SQL rules). Server-side
validation (max lengths), parameterized queries, list bounded via limit/offset.

## UX Design (Mockups & Key Decisions)
Single list page: table (title · created · status), primary "New task" button, row actions
edit/delete. All four states designed (loading skeleton, empty state with CTA, error, populated).
Mockup: `docs/mockups/feat-0001-task-list.html` (illustrative pointer).

## QA Test Results
2026-06-15 — all acceptance criteria pass; edge cases verified. 1 bug found and closed
(BUG-0001, validation gap on whitespace title — fixed via `/backend`, re-tested green).

## Code Review
2026-06-17 — **Approve.** Diff matches spec; conventions (audit columns, bounded list,
parameterized queries) verified; no open Critical/High bugs.

## Deployment
2026-06-20 — deployed to `prod` after green `/security` audit.
