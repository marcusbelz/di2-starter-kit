---
name: review
description: Code review of a feature after a green QA and before the first deploy. Checks the diff against spec, conventions, tests, and code-level security; returns Approve / Request Changes.
argument-hint: [feature-spec-path]
user-invocable: true
---

# Code Reviewer

## Role
You review **the code changes of a single feature** after `/qa` reported "production-ready" and
**before** the first deploy (`/deploy <first-stage>`). Result: a clear recommendation — **Approve**,
**Approve with Comments**, or **Request Changes**.

## Position in the workflow
```
... → /qa (passed) → /review (HERE) → /deploy <first> → … → /security → /deploy prod
```
- **Predecessor:** `/qa` reported production-ready (no open Critical/High; QA section present).
- **Successor:** the first deploy stage.
- **Not `/security`:** review is code quality + local security smells on the diff; `/security` is the
  project-wide audit before prod.

## Scope Boundary
**In scope:** read the diff vs. `main`/last deploy; spec ↔ code match (every AC actually implemented,
no unmentioned side effects); conventions (`.claude/rules/general.md` + the stack-relevant rules:
the `sql/` rules if a SQL DB, `ui/` rules if a UI, `backend.md`, `security.md`); code quality (single
responsibility, readability, error handling, no dead code / stray logs / TODOs); typing & validation;
**lint + build green** (commands from `.claude/rules/stack.md`); code-level security smells (no
secrets, no injection paths, auth guards on new endpoints, input validation); migrations idempotent +
convention-conformant.

**Out of scope:** functional testing (`/qa`); project-wide security sweep / dependency audit
(`/security`); UX critique (`/ux`); API contract design (`/backend`).

## Before Starting
1. Read the feature spec (Acceptance Criteria, Tech Design, QA Test Results — passed?).
2. Read `.claude/rules/stack.md` for the build/lint commands and which convention rules apply.
3. `features/INDEX.md` status must be "In Review".
4. Collect the diff: `git log --oneline` since the feature branch / last deploy; `git diff <base>...HEAD`.

## Workflow
1. **Understand the diff** — do the changed files make sense for this feature? Anything unrelated?
2. **Spec ↔ code** — for each AC, show where in the diff it's implemented. Mismatch → Request Changes.
3. **Conventions** — `general.md` (status/tracking discipline); the stack-relevant rules; if a SQL DB
   is used, the `sql/<vendor>/` naming/layout; if a UI, the `ui/` rules (no hardcoded colors, components reused).
4. **Code quality** — small single-responsibility functions; error paths handled; no `console.log` /
   `print` debug / `TODO` without a ticket; resources closed; no obvious perf/re-render issues.
5. **Security on the diff** — new endpoint → auth + role check; no raw user input in queries
   (parameterized only); no hardcoded secrets/keys/hosts; safe output handling.
6. **Build / lint** — run the `lint` and `build` commands from `stack.md`; both must be green.
7. **Document** — append a `## Code Review` section to the feature spec: reviewer, date, commit
   range; findings by severity (**Blocker** → Request Changes, **Major** → Approve with Comments,
   **Minor** → nice-to-have) with file:line + suggestion; final recommendation.
8. **User review & handoff.**

## Recommendation logic
| Findings | Recommendation | Next step |
|---|---|---|
| None / only Minor | Approve | `/deploy <first stage>` |
| Major (no Blocker) | Approve with Comments | user decides: fix now or follow-up |
| ≥ 1 Blocker | Request Changes | back to `/frontend` / `/backend`, then `/qa` |

## Important
- **Never fix bugs yourself.** Document findings, then back to Frontend/Backend.
- Don't re-do `/qa` (functional testing) or `/security` (dependency/header audit). If a project-wide
  smell shows up on the diff, note it as a "Candidate for next `/security` run".

## Checklist
- [ ] Feature spec read; QA section present + production-ready
- [ ] Full diff reviewed; every AC located in code
- [ ] Conventions checked (general + stack-relevant rules); lint + build green
- [ ] Security smells on the diff checked; `## Code Review` section added; recommendation made
- [ ] User saw the recommendation and confirmed the follow-up

## Handoff
**Approve / Approve with Comments:**
> "Code review for <prefix>-XXXX done — [N] Major, [M] Minor. Next step: `/deploy <first stage>`."

**Request Changes:**
> "Code review for <prefix>-XXXX found [N] Blocker(s). Back to `/frontend` / `/backend`, then `/qa` and `/review`."

## Git Commit
```
chore(<prefix>-XXXX): Add code review results
```
