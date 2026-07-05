# db/scripts — runner scripts

## Table of Contents
- [Scripts](#scripts)
- [Load logic (deploy)](#load-logic-deploy)
- [Deploy trackers](#deploy-trackers)
- [Number lint](#number-lint)
- [Environments & secrets](#environments--secrets)
- [Adapting to your project](#adapting-to-your-project)

Reproducible setup / deploy / teardown. The **directory structure + file numbering under
`db/schemas/` is the source of truth** — there is no central `deploy.sql`.

> Step-by-step runbooks (incl. verification and common failures) live in the knowledge base:
> [KB-002 bootstrap](../../docs/kb/kb-002-db-bootstrap-new-environment.md) ·
> [KB-003 deploy](../../docs/kb/kb-003-db-deploy-schema-objects.md) ·
> [KB-005 clean](../../docs/kb/kb-005-db-clean-and-redeploy-schema.md) ·
> [KB-007 schema evolution](../../docs/kb/kb-007-db-schema-evolution-with-data.md) ·
> [KB-008 drop](../../docs/kb/kb-008-db-drop-environment.md) ·
> [KB-004 apply-smoke/tests](../../docs/kb/kb-004-db-apply-smoke-and-tests.md).

## Scripts
| Script | Purpose | Connects as |
|--------|---------|-------------|
| `create.sh <env>` | one-time: database, extensions, schema(s), roles (runs `db/database/00…07`) | superuser |
| `deploy.sh <schema-dir\|all> <env>` | apply schema objects idempotently + record a `schema_apply_log` row | schema owner |
| `clean.sh <schema\|all> <env>` | drop schema objects via introspection (`clean.schema.sql`; schema stays) | schema owner |
| `drop.sh <env>` | drop the whole database + roles (runs `db/database/99…`) | superuser |
| `lint-numbers.sh` | table-group number lint against `db/schemas/<schema>/NUMBERS.md` (CI backstop, no DB) | — |

All are bash scripts (Linux / macOS / Git Bash on Windows) around plain `psql`; every call runs
with `-v ON_ERROR_STOP=1`, so the first error aborts with a non-zero exit code.

## Load logic (deploy)
Per schema directory, sections in fixed order; within a section, by prefix (3-digit table-group
numbers in the object sections, `YYYYMMDDHHMM` timestamps in `predeploy`/`postdeploy`):

    predeploy → tables → policies → functions → procedures → trigger → views → data → postdeploy

The seven **object sections** are batched into one `psql` call per schema. The two **transition
sections** run **file-by-file with run-once semantics**: per file, `deploy.sh` computes the sha256
checksum and consults `schema_change_log` —

- **not applied** → execute the file, then record filename/checksum/git_sha via
  `sp_ins_schema_change`;
- **applied, same checksum** → skip (logged as `skipped (already applied)`);
- **applied, different checksum** → **abort** the deploy: applied change files are immutable —
  create a new file instead of editing.

Because `predeploy` runs before `tables`, the runner applies the two tracker object files
(`schema_change_log` table + `sp_ins_schema_change`, from the `TRACKER_DIR` schema directory)
**up front** on every run — they are idempotent, so their second application in the regular
sections is harmless.

`deploy.sh all` walks the schema directories in the `DEPLOY_ORDER` configured at the top of the
script (dependency-safe, foundation first); `clean.sh all` uses the reverse `CLEAN_ORDER`.

> `clean.sh` takes the **deployed schema name** (e.g. `app`), while `deploy.sh` takes the
> **directory name** under `db/schemas/` (e.g. `example`) — the directory is a template whose
> objects deploy into the schema set in `db/config/<env>.env.sql` (`\set schema_app app`).

## Deploy trackers
After a successful run, `deploy.sh` inserts one row into `schema_apply_log` via
`sp_ins_schema_apply` (version from `APP_VERSION_*` in `<env>.env`, `git_sha` from the checkout,
the target env, and a note). This is the in-house equivalent of a migration framework's history
table. Its sibling `schema_change_log` tracks the applied `predeploy`/`postdeploy` transition
files (run-once key + checksum, see above) — both are described in
`.claude/rules/db-migrations.md`.

## Number lint
`lint-numbers.sh` enforces the table-group number registry (`db/schemas/<schema>/NUMBERS.md`):
one prefix = one table, every used prefix has a registry row, no duplicate registry numbers. Runs
in CI (`.github/workflows/ci.yml` → lint job); the claim protocol lives in
`.claude/rules/sql/postgres/sql.md` → "File Naming & Numbering".

## Environments & secrets
`<env>` is any name with a `db/config/<env>.env` + `<env>.env.sql` pair (the kit ships the
committed `example.env` templates; real env files are git-ignored). Non-local passwords come from
environment variables (`DB_ADMIN_PASSWORD_POSTGRES`, `DB_OWNER_PASSWORD`, `DB_FW_PASSWORD`,
`DB_SA_PASSWORD`) — provided by CI as secrets, never from files. `local` falls back to the
hardcoded throwaway password `pw`.

## Adapting to your project
1. Copy `db/config/example.env` / `example.env.sql` to `<env>.env` / `<env>.env.sql` per stage.
2. Rename/copy the `db/schemas/example/` directory for your schema(s) and update `DEPLOY_ORDER`
   (deploy.sh) + `CLEAN_ORDER` (clean.sh).
3. If you rename the schema that holds the deploy trackers, update `TRACKER_SCHEMA` **and**
   `TRACKER_DIR` in `deploy.sh`.
