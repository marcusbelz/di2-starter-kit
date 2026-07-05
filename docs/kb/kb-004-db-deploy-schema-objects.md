# KB-004: Deploy schema objects (`deploy.sh`) — the routine deploy

> Runbook — the **repeatable, idempotent** rollout of all schema objects. This is the normal
> deploy you run after every merged DDL change; re-running it on an unchanged state is a no-op.

## When to use
- After bootstrap ([KB-003](kb-003-db-bootstrap-new-environment.md)) to load the objects the
  first time.
- After every merged change under `db/schemas/` — routine deploys on every environment.

## Prerequisites
- The environment was bootstrapped (database, schema, roles exist).
- Password of the schema owner: `DB_FW_PASSWORD` (non-local; `local` → `pw`).

## Procedure

All commands run from the **repo root**; the scripts are bash — on Windows see
[Running the scripts on Windows](#running-the-scripts-on-windows) below.

### Local

No password export needed (`local` → `pw`; server: the container from
[KB-002](kb-002-local-postgres-docker-container.md)):

```powershell
# Windows / PowerShell — call Git's bundled bash
& "$env:ProgramFiles\Git\bin\bash.exe" db/scripts/deploy.sh all local
```

```bash
# macOS / Linux / Git Bash
bash db/scripts/deploy.sh all local           # all schema directories, dependency order
bash db/scripts/deploy.sh example local       # or a single directory under db/schemas/
```

### Non-local (dev / int / test / prod)

```bash
export DB_FW_PASSWORD='<schema owner password>'   # provisioned at bootstrap (KB-003)
bash db/scripts/deploy.sh all <env>
```

Or via GitHub Actions: the **DB - deploy** workflow
([KB-007](kb-007-github-actions-db-deployment-setup.md)) — `DB_FW_PASSWORD` comes from the GitHub
Environment secret.

### What it does

- There is **no central deploy.sql** — the runner walks `db/schemas/<dir>/` in section order
  `predeploy → tables → policies → functions → procedures → trigger → views → data → postdeploy`,
  within the object sections by the 3-digit prefix, in `predeploy`/`postdeploy` by the
  `YYYYMMDDHHMM` timestamp prefix.
- The order only constrains references resolved at `CREATE` time (views, policy expressions) —
  function/procedure bodies resolve at runtime and may reference later-section objects such as
  views. Details: `.claude/rules/db-migrations.md` → "Why the fixed section order resolves
  dependencies".
- `predeploy`/`postdeploy` transition scripts run **once per database**: applied files (tracked by
  filename + checksum in `app.schema_change_log`) are skipped on every later deploy; an applied
  file that was edited afterwards **aborts** the deploy (immutability guard).
- It connects as the **schema owner**, so new objects are auto-granted to the RW role via default
  privileges — no separate grant step.
- After a successful run it records one row in `app.schema_apply_log` (version from
  `APP_VERSION_*` in `<env>.env`, git SHA, environment, note).

## Running the scripts on Windows

Same ground rules as in
[KB-003](kb-003-db-bootstrap-new-environment.md#running-the-scripts-on-windows): the runner is a
bash script executing **on the host** against `localhost:5432` — Git Bash sees the repo directly
(no Docker mount), and from PowerShell you call Git's bundled bash with the leading `&`
(call operator, required):

```powershell
# Windows / PowerShell
& "$env:ProgramFiles\Git\bin\bash.exe" db/scripts/deploy.sh all local
```

**No `psql` on the host?** Run the deploy inside a disposable `postgres:17` container instead —
the one case where the repo **is** mounted, sharing the DB container's network so
`localhost:5432` still resolves:

```powershell
# Windows / PowerShell
docker run --rm -it -v "${PWD}:/repo" -w /repo --network container:app-local-pg postgres:17 `
  bash db/scripts/deploy.sh all local
```

```bash
# macOS / Linux / Git Bash
docker run --rm -it -v "$PWD:/repo" -w /repo --network container:app-local-pg postgres:17 \
  bash db/scripts/deploy.sh all local
```

- `deploy.sh` prompts for nothing on `local` (`DB_FW_PASSWORD` → `pw`); for non-local envs add
  `-e DB_FW_PASSWORD='…'`.
- The `postgres:17` image has no `git`, so the run ends with
  `Warning: GIT_SHA empty — schema_apply_log row not written` — the deploy itself is complete;
  only the informational apply-log row is skipped. Run from a host shell with `git` + `psql` when
  that row matters.

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
| `relation/schema "…" does not exist` on first deploy | Environment was never bootstrapped | Run [KB-003](kb-003-db-bootstrap-new-environment.md) first |
| A single object file fails mid-run | The failing script violates a convention or references an object with a higher load order | Fix the file, re-run — the runner is idempotent, already-applied objects are skipped/replaced harmlessly |
| `schema_apply_log row not written` warning | No git checkout (SHA unresolvable) | Deploy from a git checkout; the warning is non-fatal but the history row is skipped |
| `… was applied with checksum … but now hashes to …` abort | An already-applied `predeploy`/`postdeploy` file was edited | Applied change files are immutable — revert the edit and put the correction into a **new** timestamped transition file |

## Related
- [KB-005: Apply-smoke & object tests](kb-005-db-apply-smoke-and-tests.md) — run this before merging DDL.
- [KB-006: Clean & redeploy](kb-006-db-clean-and-redeploy-schema.md) — when a broken state should be rebuilt without a full drop.
- Reference: [db/scripts/README.md](../../db/scripts/README.md), `.claude/rules/db-migrations.md`.
