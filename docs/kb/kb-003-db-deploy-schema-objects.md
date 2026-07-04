# KB-003: Deploy schema objects (`deploy.sh`) — the routine deploy

> Runbook — the **repeatable, idempotent** rollout of all schema objects. This is the normal
> deploy you run after every merged DDL change; re-running it on an unchanged state is a no-op.

## When to use
- After bootstrap ([KB-002](kb-002-db-bootstrap-new-environment.md)) to load the objects the
  first time.
- After every merged change under `db/schemas/` — routine deploys on every environment.

## Prerequisites
- The environment was bootstrapped (database, schema, roles exist).
- Password of the schema owner: `DB_FW_PASSWORD` (non-local; `local` → `pw`).

## Procedure
```bash
bash db/scripts/deploy.sh all <env>           # all schema directories, dependency order
bash db/scripts/deploy.sh example <env>       # or a single directory under db/schemas/
```
- There is **no central deploy.sql** — the runner walks `db/schemas/<dir>/` in section order
  `tables → policies → functions → procedures → trigger → views → data`, within a section by the
  3-digit prefix.
- It connects as the **schema owner**, so new objects are auto-granted to the RW role via default
  privileges — no separate grant step.
- After a successful run it records one row in `app.schema_apply_log` (version from
  `APP_VERSION_*` in `<env>.env`, git SHA, environment, note).

Via GitHub Actions instead: the **DB - deploy** workflow (see
[KB-006](kb-006-github-actions-db-deployment-setup.md)).

## Verification
```sql
SELECT id, db_version, git_sha, environment, applied_on
FROM   app.schema_apply_log
ORDER BY id DESC
LIMIT 3;   -- newest row = this deploy
```
Drift check: compare the newest `git_sha` here with the SHA your application build reports.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: DB_FW_PASSWORD must be set for env '<env>'` | Missing schema-owner password | Export it (locally) or set the Environment secret (CI) |
| `relation/schema "…" does not exist` on first deploy | Environment was never bootstrapped | Run [KB-002](kb-002-db-bootstrap-new-environment.md) first |
| A single object file fails mid-run | The failing script violates a convention or references an object with a higher load order | Fix the file, re-run — the runner is idempotent, already-applied objects are skipped/replaced harmlessly |
| `schema_apply_log row not written` warning | No git checkout (SHA unresolvable) | Deploy from a git checkout; the warning is non-fatal but the history row is skipped |

## Related
- [KB-004: Apply-smoke & object tests](kb-004-db-apply-smoke-and-tests.md) — run this before merging DDL.
- [KB-005: Clean & redeploy](kb-005-db-clean-and-redeploy-schema.md) — when a broken state should be rebuilt without a full drop.
- Reference: [db/scripts/README.md](../../db/scripts/README.md), `.claude/rules/db-migrations.md`.
