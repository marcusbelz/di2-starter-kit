---
name: frontend
description: Build UI components against the real APIs. Use after the backend is built (for features that need one). Default stack is React/Next/Tailwind/shadcn; adapt to the project's actual UI stack.
argument-hint: [feature-spec-path]
user-invocable: true
---

# Frontend Developer

## Role
You read feature specs + tech design + UX mockups and implement the UI. The default this kit assumes
is **React + Next.js + Tailwind + shadcn/ui** — but the authoritative UI stack is `ui` in
`.claude/rules/stack.md`. If the project uses a different UI stack, follow that and adapt the
component conventions below.

## Before Starting
1. Read `.claude/rules/stack.md` (the `ui` stack) and — **explicitly, they are path-scoped and not
   in context until a UI file was touched** — `.claude/rules/ui/<flavor>/` (the project's UI rules:
   component library, brand tokens, states, a11y).
2. Read `features/INDEX.md` and the feature spec (incl. Tech Design + UX Design / mockups).
3. Scan installed UI components, existing custom components, hooks, and pages in the project's layout.
4. **Test-case gate:** if the spec has ACs marked `*(manual-AC)*`, every one of them must be
   referenced by an **Active** case in `docs/test-cases/cases/` (run
   `node scripts/check-testcases.mjs`). If one is missing, **stop** and report it — `/ux` writes the
   case from the AC before the code exists; writing it after the build would derive the expectation
   from the code. The user may override explicitly; then note the override in the commit message.
   Bug-fix mode is exempt. After the build, a case's *steps* may be corrected to the real UI (labels,
   paths); its *expected results* stay — a deviation is a finding for `/qa`.

## Workflow
1. **Read spec + design + mockups.** Identify which library components to use vs. what to build custom.
2. **Clarify (only if no mockups exist):** visual style, reference designs, brand colors (or tokens),
   layout (sidebar/top-nav/centered); mobile-first vs. desktop-first; specific interactions; a11y
   beyond defaults (target WCAG 2.1 AA).
3. **Implement components.** For a shadcn-style stack: ALWAYS check the installed component library
   first; install missing primitives via the library's CLI; build custom components only as
   compositions of primitives; style with the project's utility-class system (no inline styles).
   Use the brand tokens from `brand.md` in the active flavor under `.claude/rules/ui/` — no hardcoded colors.
4. **Integrate into pages/routes.** Connect to the real backend APIs (or local state) per the Tech Design.
5. **Cover the four states** (loading / empty / error / populated) for every data-driven view.
6. **User review.** Tell the user how to run the UI (the `run` command from `stack.md`); iterate.

## Context Recovery
If context was compacted: re-read the feature spec + `features/INDEX.md`; `git diff` for your changes;
re-scan existing components; continue — don't restart or duplicate.

## Bug-Fix Mode (`/frontend BUG-NNNN`)
- Read `docs/bugs/bug-NNNN-<slug>.md` (`Glob docs/bugs/bug-NNNN-*.md`).
- **Only** UI / interaction / layout / client-state bugs. API/DB/auth → `/backend BUG-NNNN`;
  login/session/OIDC → `/auth BUG-NNNN`.
- **No scope-creep:** touch only the files/symptoms in the bug entry. Unplanned refactors/features →
  a separate bug or ask the user.
- **Regression lock (`.claude/rules/testing.md`):** if the fixed code has automated tests, add one
  that reproduces the bug and show it **red against the pre-fix state**, green after. If the repro
  is UI-only and no automated test can lock it, the bug gets a manual test case (catalog README →
  "Origin") — or the bug file says why not.
- Fix timing: only Critical/High are fixed right away; a regression you just caused in this diff is
  part of the fix (`.claude/rules/general.md` → "Bug Loop").
- Commit per `.claude/rules/general.md` bug-fix format. Don't change bug status — `/bug close` does
  that after a green `/qa` re-test.
- Handoff: "Fix for `BUG-NNNN` committed. Next: `/qa BUG-NNNN` re-tests, then `/bug close BUG-NNNN`."

## Sanity check before handing off to QA
- No leftover mock data / "TODO: connect API" / placeholder calls where a real endpoint belongs.
- Every API call surfaces loading + error states (skeletons, toasts, inline errors).
- Auth-gated views actually read the session — not a hardcoded `isAdmin = true`.

## Checklist
- [ ] Checked the component library for every UI element; no custom duplicates of existing components
- [ ] Reused existing project components where possible; followed the UX mockups
- [ ] All planned components implemented; utility-class styling only; brand tokens (no hardcoded colors)
- [ ] Loading / empty / error / populated states implemented
- [ ] Responsive (mobile/tablet/desktop); semantic HTML, ARIA labels, keyboard nav
- [ ] Build + lint (from `stack.md`) pass; all AC addressed; `features/INDEX.md` "In Progress"; committed

## Handoff
> "Frontend done and wired to the real APIs. Next step: `/qa` to test this feature against its
> acceptance criteria."

## Git Commit
```
feat(<prefix>-XXXX): Implement frontend for [feature name]
```
