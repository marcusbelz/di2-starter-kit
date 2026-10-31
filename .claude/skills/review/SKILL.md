---
name: review
description: Code review of a feature after a green QA and before the first deploy. Checks the diff against spec, conventions, tests, and code-level security; returns Approve / Request Changes.
argument-hint: [feature-spec-path]
user-invocable: true
---

# Code Reviewer

## Role
You review **the code changes of a single feature** after `/qa` reported "production-ready" and
**before** the first deploy (`/deploy <first-stage>`) — or, in a project without a deploy target,
before the release. Result: a clear recommendation — **Approve**, **Approve with Comments**, or
**Request Changes**.

## Position in the workflow
```
... → /qa (passed) → /review (HERE) → /deploy <first> → … → /security → /deploy prod
... → /qa (passed) → /review (HERE) → release: merge into main → Deployed (= released)   [deploy: none]
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
   Those two rule groups are **path-scoped** — reading the diff via `git diff` does not load them, so
   read the ones the diff touches explicitly (the "Rule map" in `CLAUDE.md` lists them).
   - **Trust the guards, review the logic:** where a machine check exists (CI lint/guards —
     `scripts/check-*.mjs`, the project's linters, and where present `db/scripts/lint-numbers.sh`
     and the deploy-twice DB apply smoke), confirm it ran **green on this diff** instead of re-checking its subject by
     hand; spend the review on logic, contracts, permission checks and what no guard sees.
   - **Not findings:** untouched existing code that predates a convention change, and exceptions a
     rule file documents as deliberate. New or substantially changed code must follow the current rule.
   - **Test placement:** a bug fix on tested code brings a test that is red against the pre-fix
     state; a newly extracted, tested building block is also shown to be wired in at its call site
     (a test or a manual case) — or the spec says why not.
4. **Code quality** — small single-responsibility functions; error paths handled; no `console.log` /
   `print` debug / `TODO` without a ticket; resources closed; no obvious perf/re-render issues.
5. **Security on the diff** — new endpoint → auth + role check; no raw user input in queries
   (parameterized only); no hardcoded secrets/keys/hosts; safe output handling.
6. **Build / lint** — run the `lint` and `build` commands from `stack.md`; both must be green.
7. **Document** — append a `## Code Review` section to the feature spec: reviewer, date, commit
   range; gates run (command → result); AC → code location table; findings by severity, **numbered**
   `B-1…` (**Blocker** → Request Changes), `M-1…` (**Major** → Approve with Comments), `m-1…`
   (**Minor** → nice-to-have), each with file:line + suggestion; candidates for `/security`; final
   recommendation. Fix commits cite the IDs (`fix(<prefix>-XXXX): review findings M-1, m-2 …`);
   after the fixes, add a short "Fixes after review" subsection (finding → commit → re-checked).
8. **User review & handoff.**

## Recommendation logic
| Findings | Recommendation | Next step |
|---|---|---|
| None / only Minor | Approve | `/deploy <first stage>` — or, without a deploy target, the release (below) |
| Major (no Blocker) | Approve with Comments | user decides: fix now or follow-up |
| ≥ 1 Blocker | Request Changes | back to the fix skill that owns the code (`/backend`, and `/frontend` in UI projects), then `/qa` |

**Projects without a deploy target (`deploy: none`, e.g. a library or CLI that is only released):**
after Approve, check the **security gate** exactly as `/deploy prod` would — `docs/security-audit.md`
exists, is not stale (≤ 30 days, no security-relevant change since), no open Critical/High, and
says `Go-Live recommendation: ✅ YES`; otherwise the next step is `/security` (or `/security
update`), not the release. Then the reviewed change goes onto the production branch per
`release_merge` in `stack.md` (`user`: you prepare delta + merge message, the user merges). Once it
is there (merged / tagged) and CI on that commit is green, set the spec and `features/INDEX.md` to
**Deployed** (= released), add a short "Release" note (date, commit/tag) and archive the spec
(`features/README.md`) — `/review` owns this step because there is no `/deploy`.

**Resuming the release:** when `/review <id>` runs on a spec that already has an approved
`## Code Review` section and no new commits on the feature since that review, do **not** review
again — go straight to the security gate and the release steps above. That is the path after the
gate sent the user to `/security` (typically for the first feature, when no audit exists yet).

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
> (Without a deploy target: "Next step: merge into the production branch — then I mark the
> feature Deployed (released) and archive it.")

**Request Changes:**
> "Code review for <prefix>-XXXX found [N] Blocker(s). Back to the fix skill (`/backend`, or
> `/frontend` for UI code), then `/qa` and `/review`."

## Git Commit
```
chore(<prefix>-XXXX): Add code review results
```
