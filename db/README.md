# db/ — Database artifacts (PostgreSQL)

> Plain-SQL, in-house database layout — modeled on a PostgreSQL framework proven in a real-world
> project. No migration
> framework (Liquibase/Flyway/Alembic): the **directory structure + file numbering is the source of
> truth**, applied by a runner under [`scripts/`](scripts/). Conventions live in
> `.claude/rules/sql/postgres/` and `.claude/rules/db-migrations.md`.
>
> This ships as a **worked example slice** — each directory has a README describing what belongs in
> it, and the `example` schema contains complete, tested example objects (tables, procedures,
> trigger, function, view, seed) plus runnable deploy scripts and CI/deploy workflows under
> [`.github/workflows/`](../.github/workflows/). Replace the `example` schema with your project's
> real schema(s).

## Table of Contents
- [Layout](#layout)
- [Deploy model](#deploy-model)
- [Object load order](#object-load-order)
- [Conventions](#conventions)

## Layout
| Directory | Contains |
|-----------|----------|
| [`config/`](config/) | Per-environment connection + object-name variables (`<env>.env`, `<env>.env.sql`) |
| [`database/`](database/) | One-time cluster bootstrap: database, roles, schemas, extensions (`NN.<action>.sql`) |
| [`schemas/`](schemas/) | The schema objects — one subdirectory per schema, each split by object type |
| [`scripts/`](scripts/) | Runner scripts (create / deploy / clean / drop) |
| [`tests/`](tests/) | Per-schema object tests — **optional scaffold**, opt-out via `/init` (see [`tests/README.md`](tests/README.md)) |

## Deploy model
There is **no central `deploy.sql`** — the runner walks the directory tree and applies objects in a
fixed order. `scripts/deploy.sh <schema> <env>` connects as the schema owner and is idempotent
(re-runnable) — this is the **only apply model, including after go-live** on environments that hold
data: object files are convergently idempotent (desired state), data-dependent transitions live in
run-once `predeploy`/`postdeploy` scripts (tracked in `schema_change_log`; see
`.claude/rules/db-migrations.md`). One-time cluster setup (`scripts/create.sh <env>`) connects as a
superuser and is drop-and-recreate, not idempotent.

## Object load order
Per schema, sections load in this order (within a section, by prefix — 3-digit table-group numbers
in the object sections, `YYYYMMDDHHMM` timestamps in `predeploy`/`postdeploy`):

    predeploy → tables → policies → functions → procedures → trigger → views → data → postdeploy

`predeploy`/`postdeploy` transition scripts are **run-once per database** (skipped once applied;
edited-after-apply aborts the deploy — applied change files are immutable). For a multi-schema
`all` deploy, schemas load in dependency order (framework example: `helper → config → log → etl`);
`clean all` runs the reverse.

## Conventions
- File numbering = **table-group indicator** (all objects of one table share its `NNN`), never a
  global sequence — see `.claude/rules/sql/postgres/sql.md` → "File Naming & Numbering".
- Every object script is **idempotent** (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`).
- Schema names come from psql variables (`:schema_*`), never hard-coded in DDL.
