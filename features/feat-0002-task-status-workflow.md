# feat-0002: Task Status Workflow

> **Sample feature.** Ships with the starter kit to illustrate the spec format **mid-lifecycle**
> (`In Progress`): requirements + tech design exist, implementation is underway, QA/review/deploy
> are still open. Not a real feature — `/init` deletes the `feat-000X` samples.

## Status: In Progress
**Created:** 2026-06-10
**Last Updated:** 2026-07-03

## Dependencies
- Requires: feat-0001 (Task CRUD) — status transitions operate on existing tasks

## Skill Commands (copy-paste)
> The workflow commands for THIS feature, in build order. Copy the next open one into a Claude
> Code session. Done so far: `/architecture`, `/ux`, `/backend`. **Next: `/frontend feat-0002`.**

```
/frontend feat-0002
/qa feat-0002
/review feat-0002
/security
/deploy prod
```

Bug-loop, when QA (or production) finds a defect in this feature:

```
/bug <description>
/backend BUG-NNNN     (or /frontend BUG-NNNN / /auth BUG-NNNN, by area)
/qa feat-0002
/bug close BUG-NNNN
```

## User Stories
- As a user, I want to move a task through `open → in progress → done` so that its state is visible.
- As a user, I want to reopen a done task so that recurring work can be tracked again.
- As a user, I want invalid transitions blocked so that the board stays consistent.

## Acceptance Criteria
- [ ] Status changes via a single action on the task row; allowed transitions only
      (`open ↔ in progress → done → open`).
- [ ] Every transition is persisted with actor + timestamp (audit columns).
- [ ] An invalid transition returns a clear error and does not change state.
- [ ] The list from feat-0001 shows the current status and can be visually distinguished per state.

## Edge Cases
- Concurrent transition on the same task → second request gets a state-conflict error, UI refreshes.
- Transition on a deleted task → clear error, row disappears on refresh.
- Bulk status change (future) is explicitly out of scope → own feature.

## Technical Requirements (optional)
- Security: transition endpoint checks authentication + ownership (no IDOR).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
New column `status` on `app.task` (check constraint on the three values, default `open`).
Transition endpoint `POST /api/tasks/{id}/status` validating the transition matrix server-side;
procedure `sp_upd_task_status` per SQL rules. Implementation note (2026-07-03): backend done and
smoke-tested; frontend pending.

## UX Design (Mockups & Key Decisions)
Status as a compact badge in the list + dropdown with only the allowed next states (invalid
transitions are not offered, not just rejected).

## QA Test Results
_To be added by /qa_

## Code Review
_To be added by /review_

## Deployment
_To be added by /deploy_
