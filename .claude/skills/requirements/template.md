# <prefix>-XXXX: Feature Name

## Status: Planned
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

## Dependencies
- None

## Skill Commands (copy-paste)
> The workflow commands for THIS feature, in build order. Copy the next open one into a Claude
> Code session. `/requirements` fills in the real feature ID and deletes the lines that don't
> apply (no UI → no `/ux` + `/frontend`; feature needs no backend → no `/backend`; no deploy
> target → no `/deploy`).

```
/architecture <prefix>-XXXX
/ux <prefix>-XXXX
/backend <prefix>-XXXX
/frontend <prefix>-XXXX
/qa <prefix>-XXXX
/review <prefix>-XXXX
/security
/deploy <env>
```

Bug-loop, when QA (or production) finds a defect in this feature:

```
/bug <description>
/backend BUG-NNNN     (or /frontend BUG-NNNN / /auth BUG-NNNN, by area)
/qa BUG-NNNN
/bug close BUG-NNNN
```

## User Stories
- As a [user type], I want to [action] so that [goal]

## Acceptance Criteria
> Numbered — test cases, QA results and review findings cite `AC n`. An AC that only a human at the
> screen can verify ends with `*(manual-AC)*` or `*(manual-AC: <what to do>)*` (exactly these two
> forms; UI projects only) — `/ux` writes its test case before the code.

- [ ] **AC 1:** <observable criterion>
- [ ] **AC 2:** <observable criterion, incl. what must NOT happen and when the result shows> *(manual-AC: <what to click>)*

## Edge Cases
- What happens when...?
- How do we handle...?

## Technical Requirements (optional)
- Performance: e.g. < 200ms response time
- Security: e.g. authentication required
- Compatibility: e.g. supported clients / platforms

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## UX Design (Mockups & Key Decisions)
_To be added by /ux — only for features with a UI. Pointer(s) to mockup file(s) + key design
decisions (layout density, empty/loading/error states, bulk actions, form patterns). No code dump._

## QA Test Results
_To be added by /qa_

## Code Review
_To be added by /review_

## Deployment
_To be added by /deploy_
