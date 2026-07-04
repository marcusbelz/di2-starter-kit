# KB-004: Apply-smoke & database object tests (`db/tests/run.sh`)

> Runbook — verify every DDL change **end-to-end against an empty throwaway database** before it
> is merged. This is the apply-smoke discipline from `.claude/rules/db-migrations.md`: a merged
> DDL change that does not run on an empty DB is broken by definition — and typically surfaces on
> the **next** environment, not the one where it was written.

## When to use
- Before merging any change under `db/` (mandatory per the migration rule).
- After porting/renaming schema objects, to prove the load order still resolves.

## Prerequisites
- Docker (the runner spins up a disposable `postgres:17` container).
- On Windows: run from Git Bash.

## Procedure
```bash
bash db/tests/run.sh
```
What it does:
1. Starts a throwaway container + creates an empty DB, minimal owner role, and the `app` schema.
2. Applies **all** objects from `db/schemas/example/` in deploy order (same section order as
   `deploy.sh`; new object files are picked up automatically).
3. Runs every assertion file under `db/tests/example/` (`psql` + `DO $$ … ASSERT`).
4. Tears the container down (always, via trap). Prints `ALL TESTS PASSED` only on full success.

CI runs the same assertions in `ci.yml` after a real `create.sh local` + `deploy.sh all local`,
then deploys a second time as an **idempotency check**.

## Adding a test for a new object
- File name reuses the object's 3-digit number: `db/tests/example/NNN.<object>.sql`.
- Cover: the happy path, at least one guard (expected `RAISE`, asserted via
  `EXCEPTION WHEN <condition> THEN NULL;` + `ASSERT false` if it did not fire), and any
  constraint the object introduces (UNIQUE, FK, CHECK).
- Cross-cutting checks live in `000.*` files (identity PKs, audit columns).

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `docker: command not found` / daemon not running | No Docker available | Start Docker Desktop, or run the equivalent steps in CI |
| An object file fails only here, not on dev | Dev already had the object — the empty-DB path exposes a missing dependency or wrong load order | Fix the file/number so a greenfield apply works; that is the point of the smoke |
| `ASSERT` failure in a test | The object's behavior regressed (or the test encodes an outdated expectation) | Fix the object — or, if the convention deliberately changed, update the test in the same commit |
| Port/name conflict starting the container | A previous run's container survived a hard abort | `docker rm -f di2-kit-test-pg`, re-run |

## Related
- [KB-003: Deploy schema objects](kb-003-db-deploy-schema-objects.md) — the deploy this smoke protects.
- Reference: [db/tests/README.md](../../db/tests/README.md).
