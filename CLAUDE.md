# {{PROJECT_NAME}}

> {{ONE_LINE_DESCRIPTION}}

<!--
  This is a TEMPLATE file. On a fresh project, the `{{PLACEHOLDER}}` values below are
  still unfilled — that is the signal that the project has not been initialized yet.
  Run `/init` once: it asks for the product vision + tech-stack framework conditions,
  fills these placeholders, writes `.claude/rules/stack.md`, and prunes the skills/rules
  that this project does not need. See TEMPLATE.md for what `/init` does.
-->

## Tech Stack

{{TECH_STACK}}

<!--
  Until `/init` runs, the concrete stack is undefined. The authoritative, machine-readable
  stack lives in `.claude/rules/stack.md` (auto-loaded into every session). Skills that need
  to know "how do we build / test / deploy here?" read that file — they do NOT hard-code a stack.
-->

## Project Structure

```
.claude/
  rules/            Always-on conventions (auto-loaded each session)
  skills/           Workflow + cross-cutting skills (slash commands)
  hooks/            Claude Code hooks wired in .claude/settings.json (e.g. Bash inline-code guard)
.github/
  workflows/        CI + DB deploy workflows (manual dispatch; pruned by /init when not needed)
features/
  INDEX.md          Feature status overview (single source of truth for what's planned/built)
  archive/          Completed features (Deployed/Superseded), git mv'd per quarter (<YYYY-QN>/)
docs/
  PRD.md            Product Requirements Document
  bugs/             One file per bug (docs/bugs/bug-NNNN-<slug>.md) + INDEX.md + archive/
  test-cases/       Manual test cases (cases/test-NNNN-*.md, never moved) + suites/ + runs/ (UI projects)
  inventories/      Records behind rules (one row per file; read by search, not loaded each session)
  kb/               Knowledge-base / troubleshooting articles (kb-NNN-*.md)
  setup/            One-time setup guides (setup-NNN-*.md)
  production/       Generic production hardening guides
db/                 SQL DB artifacts (PostgreSQL): config/ · database/ · schemas/<schema>/ · scripts/ · tests/
                    (worked example slice; pruned by /init when database == none; tests/ is a
                    separate opt-out at /init even when a database is kept)
scripts/            Helper scripts (new project from this template) + repo guards run in CI
                    (dependency-free Node: markdown link check, file-size check)
```

The application source layout (`src/`, `app/`, `cmd/`, …) depends on the chosen stack and is
created by `/architecture` + `/backend` + `/frontend` against `.claude/rules/stack.md`.

## Development Workflow

The workflow is the spine of this template and is **the same regardless of tech stack**. Steps
that only make sense for some stacks (UX, Frontend) are optional and are pruned by `/init` for
projects without a UI.

0. `/init` - **One-time bootstrap.** Asks for the product vision + framework conditions
   (language/runtime, UI yes/no, backend yes/no, database, auth, hosting/deploy, CI), writes
   `.claude/rules/stack.md` + this Tech-Stack section, and removes the skills/rules the project
   does not need. Hands off to `/requirements`.
1. `/requirements` - Create feature specs from an idea (and the PRD on first run). Numbers the ACs
   and marks those only a human at the screen can verify `*(manual-AC)*`.
2. `/architecture` - Design the technical approach (PM-friendly, no code). Decides **backend yes/no**.
3. `/ux` - UX critique & mockups *(only if the project has a UI)* — and, once the mockups are
   approved, the manual test cases (`TEST-NNNN`) for the marked ACs, **before** any code.
4. `/backend` - Build APIs, data model, server-side logic *(only if the feature needs a backend)*.
5. `/frontend` - Build the UI against the real APIs *(only if the project has a UI)*. Both build
   skills stop while a marked AC has no test case.
6. `/qa` - Test the feature against its acceptance criteria + feature-scoped security checks; runs
   the declared test cases and records the run in `docs/test-cases/runs/`.
7. `/review` - Code review of the diff against spec & conventions (before the first deploy).
8. `/check-updates` - Cross-cutting maintenance check (dependencies, base images, CI). Periodic.
9. `/security` - Project-wide security audit. **Mandatory gate before `/deploy` to production.**
10. `/deploy <env>` - Roll out to an environment *(only if the project has a deploy target)*.

### Cross-Cutting Skills (no fixed workflow slot)

- **`/bug`** - Document a bug as `docs/bugs/bug-NNNN-<slug>.md` and run the bug-loop. Triggered
  anytime (during `/qa`, after `/deploy`, on a user report).
- **`/auth`** - Diagnose & fix authentication problems *(only if the project has auth)*. Generic
  OIDC / session / login diagnosis (diagnose-first: logs → tokens → state → hypothesis → fix).
- **`/help`** - Context-aware guide: where am I in the workflow, what to do next.

### Bug-Loop (parallel to the workflow)

1. `/bug <description>` documents it as `BUG-NNNN` in `docs/bugs/bug-NNNN-<slug>.md` (status `Open`).
2. Fix it via `/frontend BUG-NNNN` (UI), `/backend BUG-NNNN` (API/DB/server), or `/auth BUG-NNNN`
   (login/session/OIDC) — commit convention in `.claude/rules/general.md`.
3. `/qa BUG-NNNN` re-tests (narrow mandate: does the repro hold, any regression in the diff?) →
   `/bug close BUG-NNNN` resolves the follow-up findings with you, closes it and `git mv`s it into
   the quarterly archive.

A feature only moves on toward `/review` → `/deploy` once it has no open Critical/High bugs. Only
Critical/High are fixed right away; chains stop after two generations — `.claude/rules/general.md`
→ "Bug Loop — Threshold and Reach".

## Feature Tracking

All features are tracked in `features/INDEX.md`. Every skill reads it at start and updates it when
done. Feature specs live in `features/<prefix>-XXXX-name.md`.

- **Feature-ID scheme:** `{{FEATURE_PREFIX}}-XXXX` (sequential, zero-padded). The prefix is set by
  `/init`; the default in this template is `feat`. Skills refer to "the feature-ID scheme defined
  here" rather than hard-coding a prefix — examples in skill text use `feat-XXXX` illustratively.
- **Commits:** `feat({{FEATURE_PREFIX}}-XXXX): description`, `fix({{FEATURE_PREFIX}}-XXXX): BUG-NNNN; description`.
- **Archive on completion:** `Deployed` (prod) and `Superseded` are terminal — the spec is
  `git mv`'d to `features/archive/<YYYY-QN>/` and its `INDEX.md` row moves to the "Features
  (archived)" table (same quarterly scheme as the bug archive). Details in
  `.claude/rules/general.md` and `features/README.md`.

## Key Conventions

- **One feature per spec file** (Single Responsibility).
- **Human-in-the-loop:** every workflow phase has a user approval checkpoint.
- **Conventions live in `.claude/rules/`** and auto-load each session — except the path-scoped ones
  (see "Rule map" below), which load on a matching file. The authoritative tech stack
  is `.claude/rules/stack.md` — when a skill needs a stack fact, it reads that file, never guesses.
- **`README.md` files always start with a Table of Contents.**

## Build & Test Commands

{{BUILD_TEST_COMMANDS}}

<!-- e.g. for Python:  ruff check .  ·  pytest  ·  docker build .  — filled by /init from stack.md -->

## Legal

- **Cookie banner:** if the project ships a public web UI, check whether a cookie banner is required
  (GDPR/ePrivacy) — see `.claude/rules/cookies.md`. Pruned by `/init` for non-web projects.

## Product Context

@docs/PRD.md

## Feature Overview

Not loaded as an include (every session would pay for the whole table) — read on demand:

- **`features/INDEX.md`** — status of every feature and the next free ID. **Read it before any work
  on a feature** (mandatory per `.claude/rules/general.md`; every workflow skill does it first).
- **`docs/roadmap.md`** — prioritized roadmap (priority, status, spec per feature). Search it for a
  feature ID instead of reading it whole.

## Rule map (path-scoped rules)

The rules below carry a `paths:` frontmatter: they load **only** when a matching file is read,
written or edited — and then arrive with that tool result, i.e. **after** the call. Whoever answers
a question on their topic without touching a matching file, or **creates a new file** in their area,
reads the relevant rule explicitly first. Every scoped rule has exactly one line here;
`node scripts/check-context-budget.mjs` checks it. Always loaded (no `paths:`): everything else
under `.claude/rules/` — `general`, `language`, `documentation`, `stack`, `security`, `testing`, and,
where kept, `backend`, `db-migrations`, `deploy-infra`, `cookies`, plus the small `sql/` and `ui/`
index READMEs. `/init` deletes the lines of pruned vendors/flavors.

- `.claude/rules/sql/postgres/README.md` — PostgreSQL ruleset index, `db/**`
- `.claude/rules/sql/postgres/sql.md` — cross-cutting SQL style guide (naming, alignment, file numbering, layout), `db/**`
- `.claude/rules/sql/postgres/tables.md` — tables, constraints, comments, seeds, convergent evolution, `db/**`
- `.claude/rules/sql/postgres/procedures.md` — procedures (parameters, body structure, error messages), `db/**`
- `.claude/rules/sql/postgres/functions.md` — functions, volatility, `db/**`
- `.claude/rules/sql/postgres/trigger.md` — triggers and trigger functions, `db/**`
- `.claude/rules/sql/postgres/views.md` — views, `db/**`
- `.claude/rules/sql/postgres/policies.md` — row-level security policies, `db/**`
- `.claude/rules/sql/mssql/README.md` — SQL Server ruleset index, `db/**`
- `.claude/rules/sql/mssql/sql.md` — cross-cutting T-SQL style guide (naming, batches, file numbering, layout), `db/**`
- `.claude/rules/sql/mssql/tables.md` — tables, constraints, descriptions, MERGE seeds, `db/**`
- `.claude/rules/sql/mssql/procedures.md` — procedures (parameters, body structure, FORMATMESSAGE/THROW), `db/**`
- `.claude/rules/sql/mssql/functions.md` — functions, scalar vs. inline TVF, SCHEMABINDING, `db/**`
- `.claude/rules/sql/mssql/trigger.md` — set-based triggers, recursion guard, `db/**`
- `.claude/rules/sql/mssql/views.md` — views, indexed views, `db/**`
- `.claude/rules/sql/mssql/policies.md` — security policies (FILTER/BLOCK predicates), `db/**`
- `.claude/rules/ui/react-tailwind-shadcn/README.md` — UI flavor index, UI source + `design/**`
- `.claude/rules/ui/react-tailwind-shadcn/frontend.md` — component library first, four states, forms, a11y, UI source
- `.claude/rules/ui/react-tailwind-shadcn/brand.md` — brand tokens, type scale, punctuation in UI strings, UI source + `design/**`
- `.claude/rules/ui/react-tailwind-shadcn/confirm-dialog.md` — shared ConfirmDialog, no native confirm/alert, UI source
- `.claude/rules/ui/react-tailwind-shadcn/tooltip.md` — centralized tooltip variants and delay, UI source
