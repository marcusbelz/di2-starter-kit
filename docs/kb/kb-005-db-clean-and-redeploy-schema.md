# KB-005: Clean a schema and redeploy (`clean.sh`)

> Runbook — drop **all objects** of a schema while keeping the schema itself, then rebuild via
> `deploy.sh`. The middle ground between a routine deploy and a full drop.

## When to use
- A schema's object state is broken/diverged and you want a guaranteed clean rebuild **without**
  touching the database, roles, or other schemas.
- Pre-launch resets of a dev/int environment where the data is disposable.

**Not** for environments with data to protect — `clean` drops tables **including their data**.

## Why the schema itself stays
The schema keeps its `USAGE` grant and the owner's **default privileges** for the RW role. Because
those survive, the subsequent `deploy.sh` needs no grant re-apply — freshly created objects are
readable/executable by the service account immediately.

## Prerequisites
- Schema-owner password `DB_FW_PASSWORD` (non-local; `local` → `pw`).
- Certainty that the schema's data is disposable (take a dump first if in doubt).

## Procedure
```bash
bash db/scripts/clean.sh app <env>       # deployed schema NAME (not the directory name)
bash db/scripts/deploy.sh all <env>      # rebuild
```
`clean.sh` introspects the schema and generates `DROP … CASCADE` for views, matviews, tables,
functions, procedures, and sequences (`db/scripts/clean.schema.sql`) — all `IF EXISTS`, safe to
re-run.

Via GitHub Actions instead: the **DB - clean** workflow — it additionally requires typing the
literal word `clean` as confirmation (see [KB-006](kb-006-github-actions-db-deployment-setup.md)).

## Verification
```sql
SELECT count(*) FROM pg_tables WHERE schemaname = 'app';   -- 0 after clean, > 0 after redeploy
```
After the redeploy, check the new `schema_apply_log` row as in
[KB-003](kb-003-db-deploy-schema-objects.md).

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: unknown schema '…'` | Passed the **directory** name (`example`) instead of the deployed schema name (`app`) | Use the deployed name; the mapping is set in `db/config/<env>.env.sql` (`\set schema_app app`) |
| Objects of another schema disappeared | `DROP … CASCADE` followed a cross-schema dependency | Clean dependent schemas deliberately in reverse deploy order (`clean.sh all` does this) |
| Service account loses access after redeploy | The schema was dropped/recreated manually instead of via `clean.sh` (default privileges lost) | Re-run the RW grant block from `db/database/05.create.role.rw.sql`, or bootstrap the env cleanly |

## Related
- [KB-008: Drop an environment](kb-008-db-drop-environment.md) — when even the schema/roles must go.
- Reference: [db/scripts/README.md](../../db/scripts/README.md).
