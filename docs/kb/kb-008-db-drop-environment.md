# KB-008: Drop a database environment (`drop.sh`)

> Runbook — the **full teardown**: terminates connections, drops the database and all four roles.
> Destructive and final; the only way back is a fresh bootstrap (plus a restore, if you have one).

## When to use
- Before re-running a bootstrap (the create path is drop-and-recreate, see
  [KB-002](kb-002-db-bootstrap-new-environment.md)).
- Decommissioning an environment.

**Never** on an environment with data to protect without a verified backup/dump.

## Prerequisites
- Superuser password `DB_ADMIN_PASSWORD_POSTGRES` (prompted if not set).
- For prod-like envs: a current dump if the data may ever be needed again.

## Procedure
```bash
bash db/scripts/drop.sh <env>
```
Runs `db/database/99.drop.database.sql` against the `postgres` maintenance DB:
1. Terminates active connections (a `DROP DATABASE` fails while sessions are open).
2. Drops the database.
3. Revokes the cluster-wide `lc_messages` parameter grants (they live in a **shared** catalog and
   would otherwise block the role drops).
4. Drops service account, RW role, schema owner, database owner — all `IF EXISTS`, so the script
   is safe to re-run and safe after a partial failure.

Via GitHub Actions instead: the **DB - drop** workflow — it additionally requires typing the
literal word `drop` as confirmation (see [KB-006](kb-006-github-actions-db-deployment-setup.md)).

## Verification
```bash
psql -h <host> -U postgres -d postgres -c "SELECT datname FROM pg_database WHERE datname = '<db>';"   # 0 rows
psql -h <host> -U postgres -d postgres -c "SELECT rolname FROM pg_roles WHERE rolname LIKE '<db>_%';" # 0 rows
```

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `database "…" is being accessed by other users` | A session connected between terminate and drop (e.g. an app container reconnect loop) | Stop the application/service first, re-run `drop.sh` |
| `role "…" cannot be dropped because some objects depend on it` | The role still owns objects in **another** database, or holds grants outside this DB | Find them with `\du` + `pg_shdepend`; drop/reassign those objects, then re-run |
| Script "fails" politely on a half-torn-down env | Nothing — all statements are `IF EXISTS` | Just re-run; it is idempotent |

## Related
- [KB-002: Bootstrap a new environment](kb-002-db-bootstrap-new-environment.md) — the counterpart.
- [KB-005: Clean & redeploy](kb-005-db-clean-and-redeploy-schema.md) — the non-destructive alternative when only the objects are broken.
