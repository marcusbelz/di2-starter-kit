# DB Deployment & Migrations (in-house pattern, no Liquibase/Flyway by default)

> Architecture decision: by default this kit uses a **plain-SQL, in-house** migration pattern rather
> than a migration framework (Liquibase, Flyway, Alembic, …) — to avoid tool dependency / vendor
> lock-in. This is a deliberate choice. If the chosen stack ships its own migration tool (Prisma,
> Alembic, an ORM), `/init` records that in `stack.md` and you follow that tool instead — this file
> then documents the in-house fallback only. **Don't switch the established approach without asking
> the user.**
>
> Pruned at `/init` time if `database == none`.

## One apply model: the directory runner
There is **no central `deploy.sql`** — the runner (`db/scripts/deploy.sh`) walks the schema
directories under `db/schemas/<schema>/` and applies them section by section. This is the only
apply model, **including after go-live on environments that hold data**:

    predeploy → tables → policies → functions → procedures → trigger → views → data → postdeploy

Within a section, files apply in prefix order (3-digit table-group numbers in the object sections,
`YYYYMMDDHHMM` timestamps in `predeploy`/`postdeploy`). Two complementary file kinds:

1. **Object files are convergently idempotent (desired state).** A table file describes the desired
   state *and* converges existing databases toward it: `CREATE TABLE IF NOT EXISTS` for the initial
   shape, followed by idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (etc.) for columns added
   later. Constraints keep the `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` idiom; modules use
   `CREATE OR REPLACE`. See `.claude/rules/sql/postgres/tables.md` → "Convergent evolution".
2. **Data-dependent transitions get dedicated run-once slots.** `predeploy` (before `tables`) and
   `postdeploy` (after `data`) hold transition scripts — e.g. saving data aside before a
   destructive change, or backfilling a new column before it becomes `NOT NULL`. These scripts are
   **run-once per database**, tracked by filename + sha256 checksum in `schema_change_log`:
   already-applied files are skipped; an applied file whose checksum changed **aborts** the deploy
   (applied change files are immutable — a correction is a new file). Applied files stay in the
   tree; tracking makes them inert. Write every transition to also succeed on an
   empty-but-current schema (greenfield deploys run them all once, in chronological order).

### Why the fixed section order resolves dependencies
The order only constrains references that are resolved at **`CREATE` time**. PL/pgSQL (and T-SQL
procedure) bodies are resolved at **runtime** — a function or procedure body may freely reference
a view or any other later-section object: its `CREATE` succeeds, and by the time anything calls
it, the completed deploy run has created every object. References resolved at `CREATE` time must
point to an **earlier section** (or a lower number within the same section):

- **Views** — view-on-function is fine (functions load earlier); view-on-view requires the
  referenced view's number prefix to sort earlier (pick the higher table-group number, cf. the
  cross-table heuristic in `sql/<vendor>/sql.md`).
- **Policy expressions** — policies load *before* functions; a predicate/helper function used by
  a policy is created **inside the policy file**, not in `functions/` (the mssql ruleset's
  drop-policy → create-function → create-policy layout does exactly this).
- **SQL Server `WITH SCHEMABINDING`** objects and **PostgreSQL `LANGUAGE sql` string-body
  functions** (fully validated at `CREATE` under the default `check_function_bodies = on` — one
  reason the kit's skeletons are PL/pgSQL).

The mandatory apply-smoke (below) is the enforcement backstop: a backward create-time dependency
fails on the empty throwaway DB before merge, not on the next environment.

### Sequencing rule: NOT NULL column on a populated table (expand/contract)
1. Table file: add the column as **nullable** via `ADD COLUMN IF NOT EXISTS`.
2. Postdeploy script: backfill the column, then `SET NOT NULL` **at the end of the same script**
   (the tables section would otherwise run `SET NOT NULL` before the backfill on the first deploy).
3. After the transition has been applied everywhere: move the `SET NOT NULL` into the table file as
   an idempotent `ALTER` so the desired state is fully described by the object file again
   (greenfield deploys then don't depend on the transition script's effect).

## Tracker tables: `schema_apply_log` and `schema_change_log`
Two append-only siblings, both written by the runner:

- **`schema_apply_log`** — one row per apply **run** (timestamp, applied_by, db_version, git_sha,
  note). The most recent row = current schema state; the in-house equivalent of a migration
  framework's history table. The runner passes `git_sha = git rev-parse HEAD` + a version through
  and inserts a row on every run.
- **`schema_change_log`** — one row per applied **transition file** (filename UNIQUE = run-once
  key, sha256 checksum = immutability guard, git_sha). Consulted before every `predeploy`/
  `postdeploy` file; the runner ensures this tracker exists before the `predeploy` section runs
  (greenfield chicken-and-egg).

## Code vs. schema version — separate axes
The schema version lives in `schema_apply_log` (in the DB). The application/code version lives in a
build-time constant / a `/version` endpoint (git SHA + build number). Diagnosis: "which schema is on
env X?" → query `schema_apply_log`; "which code is on env X?" → hit `/version`; drift check → compare
the two SHAs.

## Apply-smoke after every schema change (MANDATORY)
Every DDL change must be applied **end-to-end against a throwaway DB** before merge — not just
eyeballed against the convention. Spin up an empty schema, run the apply script, require exit code 0
+ one new `schema_apply_log` row. If it fails, fix it before the branch goes to review — a merged DDL
change that doesn't run on an empty DB is broken by definition. (The failure often surfaces not on
the env where it was merged — which already had the table — but on the **next** apply on another env.)

## Deploy-time discipline
The app-deploy step does **not** apply DDL. Before a deploy, check whether the target env has recent
schema changes and apply them first (see `deploy-infra.md` → "Migration drift"). Forgetting this
shows up as the app starting but breaking on first data access.

## When to switch this convention
If the in-house pattern hits limits (complex migrations, rollback needs, team-discipline issues),
agree with the user first and write a small spec for the switch. Plain-SQL migrations with a custom
runner, or `pg_dump`/`pg_restore`-based strategies, remain in-scope alternatives that are *not* the
same as adopting a heavyweight framework.
