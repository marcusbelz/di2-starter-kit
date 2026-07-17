# KB-008: Evolve the schema on environments with data (convergent files + run-once transitions)

> Runbook — how a schema change ships **after go-live**, when environments hold data you must not
> lose. Pre-launch you can simply drop + recreate; once real data exists, every change is a
> combination of a **convergent object file** (desired state) and, where the change is
> data-dependent, a **run-once transition script**. Model reference:
> `.claude/rules/db-migrations.md`.

## Table of Contents
- [When to use](#when-to-use)
- [Procedure](#procedure)
- [Verification](#verification)
- [Common failures](#common-failures)
- [Related](#related)

## When to use
- Any DDL change (new column, new table, constraint change) targeting an environment that holds
  data to protect.
- Whenever a change needs a backfill, a data move, or any step that must run exactly once per
  database.

## Procedure

1. **New table? Claim its number first.** Add the row to `db/schemas/<schema>/NUMBERS.md` and push
   the claim commit (protocol: `.claude/rules/sql/postgres/sql.md` → "Claim protocol"). Skip this
   step for changes to existing tables.
2. **Converge the object file.** Describe the new desired state in the table's object file —
   initial shape in `CREATE TABLE IF NOT EXISTS`, later columns as idempotent
   `ALTER TABLE … ADD COLUMN IF NOT EXISTS` under the `-- Convergent evolution` banner
   (see `.claude/rules/sql/postgres/tables.md`). Never drop + recreate a populated table.
3. **Data-dependent part → run-once transition.** If the change needs work an idempotent object
   file cannot express, add a timestamped script:
   - `db/schemas/<schema>/predeploy/YYYYMMDDHHMM.<name>.sql` — must run **before** the object DDL
     (e.g. save data aside ahead of a destructive change).
   - `db/schemas/<schema>/postdeploy/YYYYMMDDHHMM.<name>.sql` — needs the **new** objects
     (e.g. backfill; a `SET NOT NULL` goes at the **end of the same script**, after its backfill).
   Write it to also succeed on an empty-but-current schema (`WHERE` guards / `IF EXISTS`) — a
   greenfield deploy runs all transitions once, in chronological order.

   **Atomicity guarantee:** the runner executes the transition and records it in
   `schema_change_log` in **one transaction** — a deploy killed mid-run never leaves an
   executed-but-unrecorded transition that the next deploy would run twice. The flip side (shared
   with Flyway/Liquibase): statements that refuse to run inside a transaction block
   (`CREATE INDEX CONCURRENTLY`, `VACUUM`, some `ALTER SYSTEM`) can't live in such a file — opt
   out with `-- no-single-transaction` as the file's **first line**. Opt-out files fall back to
   the non-atomic two-step apply and may run twice after a crash: write them idempotent.
4. **Apply-smoke.** Run the change end-to-end against a throwaway DB before merging
   ([KB-005](kb-005-db-apply-smoke-and-tests.md)); CI's double deploy also proves the run-once
   skip path.
5. **Deploy.** Routine rollout per environment ([KB-004](kb-004-db-deploy-schema-objects.md)) —
   locally or via the **DB - deploy** workflow ([KB-007](kb-007-github-actions-db-deployment-setup.md)).
   One deploy at a time per database: the workflow serializes runs per environment; for manual
   runs, never start a second deploy while one is in flight (see KB-004).
6. **Contract (optional follow-up).** Once a `SET NOT NULL`-style transition has been applied on
   every environment, move the final state into the object file as an idempotent `ALTER` so the
   desired state is fully described by the object file again.

## Verification
```sql
SELECT filename, checksum, git_sha, applied_on
FROM   app.schema_change_log
ORDER BY applied_on DESC
LIMIT 5;   -- your transition file(s) appear once per database
```
Re-run `deploy.sh` — every applied transition must be reported as `skipped (already applied)`.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deploy aborts: `… was applied with checksum … but now hashes to …` | An already-applied transition file was edited | Applied change files are immutable — revert the edit; ship the correction as a **new** timestamped file |
| `SET NOT NULL` fails on first deploy of a new env | The constraint ran before the backfill (it sat in the tables section) | Keep the `SET NOT NULL` at the end of the backfill's postdeploy script (step 3), contract later (step 6) |
| Transition fails on a greenfield deploy | Script assumes pre-existing data | Guard it (`WHERE … IS NULL`, `IF EXISTS`) so it is a no-op on an empty-but-current schema |
| Two branches claim the same table number | Claim commit skipped or not pushed | Follow the claim protocol; `db/scripts/lint-numbers.sh` (CI) catches it at PR time |

## Related
- [KB-004: Deploy schema objects](kb-004-db-deploy-schema-objects.md) — the routine deploy incl. run-once mechanics.
- [KB-005: Apply-smoke & object tests](kb-005-db-apply-smoke-and-tests.md) — mandatory before merge.
- Reference: `.claude/rules/db-migrations.md` (model + expand/contract),
  `.claude/rules/sql/postgres/tables.md` ("Convergent evolution"),
  [db/schemas/example/postdeploy/](../../db/schemas/example/postdeploy/) (worked example).
