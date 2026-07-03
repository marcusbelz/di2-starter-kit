# feat-0003: Task Search & Filter

> **Sample feature.** Ships with the starter kit to illustrate the spec format at the **start** of
> the lifecycle (`Planned`): only `/requirements` has run — no tech design, no implementation yet.
> Not a real feature — `/init` deletes the `feat-000X` samples.

## Status: Planned
**Created:** 2026-07-03
**Last Updated:** 2026-07-03

## Dependencies
- Requires: feat-0001 (Task CRUD) — searches over existing tasks
- Requires: feat-0002 (Task Status Workflow) — status is a filter dimension

## Skill Commands (copy-paste)
> The workflow commands for THIS feature, in build order. Copy the next open one into a Claude
> Code session. Nothing has run yet — **next: `/architecture feat-0003`.**

```
/architecture feat-0003
/ux feat-0003
/backend feat-0003
/frontend feat-0003
/qa feat-0003
/review feat-0003
/security
/deploy prod
```

Bug-loop, when QA (or production) finds a defect in this feature:

```
/bug <description>
/backend BUG-NNNN     (or /frontend BUG-NNNN / /auth BUG-NNNN, by area)
/qa feat-0003
/bug close BUG-NNNN
```

## User Stories
- As a user, I want to search tasks by title text so that I can find a task quickly.
- As a user, I want to filter the list by status so that I see only relevant tasks.
- As a user, I want search and filter to combine so that I can narrow results precisely.

## Acceptance Criteria
- [ ] Text search matches case-insensitively against title and description.
- [ ] Status filter offers the three states + "all"; default is "all".
- [ ] Search + filter combine (AND) and survive pagination.
- [ ] Empty result shows an empty state explaining the active criteria, with a "clear filters" action.

## Edge Cases
- Search term with only whitespace → treated as no search, not as an error.
- Very long search input → capped at a max length, validated server-side.
- Filter set while on page N with fewer results → reset to page 1.

## Technical Requirements (optional)
- Performance: search stays < 300ms at 10k tasks (index strategy decided by /architecture).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## UX Design (Mockups & Key Decisions)
_To be added by /ux — only for features with a UI._

## QA Test Results
_To be added by /qa_

## Code Review
_To be added by /review_

## Deployment
_To be added by /deploy_
