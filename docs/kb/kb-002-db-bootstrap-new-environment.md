# KB-002: Bootstrap a new database environment (`create.sh`)

> Runbook — the **one-time** setup of a database environment: database, extensions, schema(s),
> roles, and users. Run once per environment (and again only after a full teardown).

## When to use
- First-time setup of `local`, `dev`, `int`, `test`, or `prod`.
- Full reset while pre-launch (always as `drop` → `create`, never `create` on top).

## Prerequisites
- A `db/config/<env>.env` + `<env>.env.sql` pair exists (copy from `example.*`; the committed
  `local.*` pair works out of the box).
- `psql` available; network access to the PostgreSQL server.
- Passwords for non-local envs as environment variables: `DB_ADMIN_PASSWORD_POSTGRES` (superuser),
  `DB_OWNER_PASSWORD`, `DB_FW_PASSWORD` (schema owner), `DB_SA_PASSWORD` (service account).
  `local` falls back to the throwaway password `pw`.

## Procedure
```bash
bash db/scripts/create.sh <env>          # e.g. create.sh local
```
What it runs, in order (all files in `db/database/`):
1. `00.preflight.create.sql` — aborts if the database or any role already exists.
2. `01.create.database.sql` — database + owner role (against the `postgres` maintenance DB).
3. `02…07` — extensions, schema owner, `app` schema, RW group role (incl. the `lc_messages`
   grant), service account, role grant (against the new database).

Via GitHub Actions instead: the **DB - create** workflow (see
[KB-006](kb-006-github-actions-db-deployment-setup.md)).

## Verification
```bash
psql -h <host> -U <db>_fw -d <db> -c "\dn"          # schema 'app' exists, owned by the fw role
psql -h <host> -U <db>_sa -d <db> -c "SELECT 1;"    # service account can connect
```

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: database or roles for env '<env>' already exist` (exit 3 hint) | Bootstrap is **drop-and-recreate**; roles are cluster-global and survive `DROP DATABASE` | `bash db/scripts/drop.sh <env>` first, then re-run `create.sh` — see [KB-007](kb-007-db-drop-environment.md) |
| `Error: DB_OWNER_PASSWORD must be set for env '<env>'` | Non-local env without password env vars | Export the four `DB_*_PASSWORD` variables (locally) or configure them as GitHub Environment secrets (CI) |
| `psql: command not found` | No PostgreSQL client on the machine | Install `postgresql-client`, or run the script inside a `postgres:17` container with the repo mounted |
| Connection refused / timeout in preflight | Wrong `DB_HOST`/`DB_PORT` in `<env>.env`, or the server is not reachable | Verify the `.env` coordinates and firewall/tunnel |

## Related
- [KB-003: Deploy schema objects](kb-003-db-deploy-schema-objects.md) — the next step after bootstrap.
- [KB-007: Drop an environment](kb-007-db-drop-environment.md) — the inverse operation.
- Reference: [db/database/README.md](../../db/database/README.md), [db/scripts/README.md](../../db/scripts/README.md).
