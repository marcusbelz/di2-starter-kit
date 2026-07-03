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
.github/
  workflows/        CI + DB deploy workflows (manual dispatch; pruned by /init when not needed)
features/
  INDEX.md          Feature status overview (single source of truth for what's planned/built)
  archive/          Completed features (Deployed/Superseded), git mv'd per quarter (<YYYY-QN>/)
docs/
  PRD.md            Product Requirements Document
  bugs/             One file per bug (docs/bugs/bug-NNNN-<slug>.md) + INDEX.md + archive/
  kb/               Knowledge-base / troubleshooting articles (kb-NNN-*.md)
  setup/            One-time setup guides (setup-NNN-*.md)
  production/       Generic production hardening guides
db/                 SQL DB artifacts (PostgreSQL): config/ · database/ · schemas/<schema>/ · scripts/ · tests/
                    (worked example slice; pruned by /init when database == none; tests/ is a
                    separate opt-out at /init even when a database is kept)
scripts/            Helper scripts (e.g. spin up a new project from this template)
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
1. `/requirements` - Create feature specs from an idea (and the PRD on first run).
2. `/architecture` - Design the technical approach (PM-friendly, no code). Decides **backend yes/no**.
3. `/ux` - UX critique & mockups *(only if the project has a UI)*.
4. `/backend` - Build APIs, data model, server-side logic *(only if the feature needs a backend)*.
5. `/frontend` - Build the UI against the real APIs *(only if the project has a UI)*.
6. `/qa` - Test the feature against its acceptance criteria + feature-scoped security checks.
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
3. `/qa` re-tests → `/bug close BUG-NNNN` closes it and `git mv`s it into the quarterly archive.

A feature only moves on toward `/review` → `/deploy` once it has no open Critical/High bugs.

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
- **Conventions live in `.claude/rules/`** and auto-load each session. The authoritative tech stack
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

@features/INDEX.md
