# Template Internals

How this starter kit is built and how `/init` tailors it to a project. Read this if you're
maintaining the template or want to understand the pruning behavior.

## Table of Contents
- [Design: maximal → subtractive](#design-maximal--subtractive)
- [What `/init` asks](#what-init-asks)
- [Pruning matrix](#pruning-matrix)
- [The stack.md contract](#the-stackmd-contract)
- [Feature-ID prefix](#feature-id-prefix)
- [Intentional omissions (vs. the DI² source)](#intentional-omissions-vs-the-di-source)
- [Conventions for editing the template](#conventions-for-editing-the-template)

## Design: maximal → subtractive
The template ships every skill and rule. `/init` records the project's framework conditions and then
**deletes** what the project doesn't need (in the clone — the template itself stays maximal). This is
simpler and safer than a build-up approach: a user can always prune later, but re-adding a deleted
skill means copying it back from the template.

The single source of truth for the concrete stack is `.claude/rules/stack.md`. Stack-agnostic skills
(`/architecture`, `/backend`, `/review`, `/deploy`, `/check-updates`, `/security`) read it instead of
hard-coding a language/framework/host. Uninitialized state is detected by the `{{PLACEHOLDER}}` values
still being present in `stack.md` (and the PRD placeholder text).

## What `/init` asks
Vision (→ `docs/PRD.md`) plus these axes (→ `stack.md` + `CLAUDE.md`):
runtime · UI yes/no · backend yes/no · database · migrations (only when a database exists) ·
tests (keep the DB test scaffold? — only when a database exists) · auth · deploy target · CI ·
env stages · feature-ID prefix. Two `stack.md` keys are derived rather than asked and confirmed
with the user: `package_manager` (from the runtime) and the build/test/run/audit commands.

## Pruning matrix
| Condition (from /init answers) | Removed |
|---|---|
| `ui == none` | `skills/ux`, `skills/frontend`, `rules/ui/`, `rules/cookies.md`; UX+Frontend lines dropped from the `CLAUDE.md` workflow |
| `ui` is a different stack | only `rules/ui/react-tailwind-shadcn/` ships; add `rules/ui/<flavor>/` (port + adapt), then drop `react-tailwind-shadcn/` — same pattern as the SQL vendors |
| `backend == none` | `skills/backend`, `rules/backend.md` |
| `database == none` | `rules/sql/` (whole tree), `rules/db-migrations.md`, `db/` (whole tree — includes `db/tests/`), `.github/workflows/db-*.yml` + the db jobs in `ci.yml` |
| `tests == none` (opt-out, `database != none`) | `db/tests/` (the test scaffold only) + the "db/tests assertions" step in `ci.yml` |
| `database in {sqlite, mongodb}` | `rules/sql/` (keep `db-migrations.md` only if the migrations answer is SQL-based, i.e. `plain-sql`) |
| `database == postgres` | `rules/sql/mssql/` (keep only the matching vendor) |
| `database == mssql` | `rules/sql/postgres/` (keep only the matching vendor; adapt the PostgreSQL `db/` example tree) |
| `database == mysql` (no shipped ruleset) | both shipped vendors; add `rules/sql/<vendor>/` (port + adapt from a shipped one) |
| `auth == none` | `skills/auth` |
| `deploy == none` | `skills/deploy`, `rules/deploy-infra.md`, `.github/workflows/db-create/deploy/clean/drop.yml` (SSH dispatch workflows) |
| `ci == none` | `.github/workflows/` (whole tree) |
| always | `skills/init` removes itself at the end (one-time bootstrap) |

Always kept: `requirements`, `architecture`, `qa`, `review`, `bug`, `help`, `check-updates`,
`security`, and rules `general`, `documentation`, `stack`, `security`.

## The stack.md contract
`stack.md` carries a Profile table + a build/test/run/audit command block + free-form notes. Every
agnostic skill names which fields it consumes (see the "How skills consume this file" section there).
When adding a new agnostic skill, read from `stack.md` rather than assuming a stack.

## Feature-ID prefix
The scheme is `<prefix>-XXXX`; the default prefix is `feat`. Skills use `feat-XXXX` illustratively but
always defer to "the scheme defined in CLAUDE.md / stack.md". If `/init` sets a non-default prefix, it
updates `CLAUDE.md` (`feature_id_prefix`) + `features/INDEX.md`; skill text examples stay illustrative.

## Intentional omissions (vs. the DI² source)
This kit is distilled from the DI² project. Deliberately **not** carried over, because they are
product-specific rather than generic:
- DI²'s detailed UI layout rules (list-page-layout, workspace-data-register, settings-section-nav,
  page-skeleton, loading-skeleton, dialog/dropdown/collapsible specifics). They reference DI²'s exact
  components and pixel scales. The `ui/` bundle here ships only the genuinely reusable seeds
  (`frontend`, `brand`, `confirm-dialog`, `tooltip`); grow project-specific layout rules in `ui/` as
  your UI matures.
- DI²-specific infrastructure facts (Hetzner IP/containers/domains, Keycloak realm/theme, sample
  databases). Generalized into `deploy-infra.md` placeholders + a generic `/auth` skill.
- DI²'s product domain (ETL generator), brand colors, and feature/bug history.
- Sub-agent definitions + `context: fork` on QA/Frontend/Review — those skills run in the main
  context here for zero-config portability.

## Conventions for editing the template
- Keep every skill/rule **stack-neutral**: defer concrete facts to `stack.md` / `deploy-infra.md`.
- A skill/rule that only applies to some stacks must be in the pruning matrix above and carry a
  one-line "Pruned at /init time if …" note at its top.
- No `{{PLACEHOLDER}}` should survive `/init` — when adding placeholders, add the fill-in step to the
  `/init` skill too.
