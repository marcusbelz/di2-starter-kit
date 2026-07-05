# KB-005: Apply-smoke & database object tests (`db/tests/run.sh`)

> Runbook — verify every DDL change **end-to-end against an empty throwaway database** before it
> is merged. This is the apply-smoke discipline from `.claude/rules/db-migrations.md`: a merged
> DDL change that does not run on an empty DB is broken by definition — and typically surfaces on
> the **next** environment, not the one where it was written.

## Table of Contents
- [When to use](#when-to-use)
- [Prerequisites](#prerequisites)
- [Procedure](#procedure)
- [Expected output & reading the log](#expected-output--reading-the-log)
- [Running the scripts on Windows](#running-the-scripts-on-windows)
- [Adding a test for a new object](#adding-a-test-for-a-new-object)
- [Common failures](#common-failures)
- [Related](#related)

## When to use
- Before merging any change under `db/` (mandatory per the migration rule).
- After porting/renaming schema objects, to prove the load order still resolves.

## Prerequisites
- Docker (the runner spins up a disposable `postgres:17` container).
- A bash — on Windows see
  [KB-003 → Running the scripts on Windows](kb-003-db-bootstrap-new-environment.md#running-the-scripts-on-windows).
  No `psql` needed on the host: the runner executes everything inside its container.

## Procedure

Run from the **repo root**. The smoke is local by design (throwaway container, independent of any
environment); CI runs the same assertions on every push (see below).

```powershell
# Windows / PowerShell — call Git's bundled bash
& "$env:ProgramFiles\Git\bin\bash.exe" db/tests/run.sh
```

```bash
# macOS / Linux / Git Bash
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

## Expected output & reading the log

A successful run exits with code 0 and ends in this line — it only prints when **every** script
succeeded:

```
>>> ALL TESTS PASSED
```

Before that, the log shows the container phase (`>>> starting throwaway container di2-kit-test-pg`
→ `>>> waiting for readiness` → `>>> creating database + minimal owner role/schema`) and then one
`>>> apply <file>` line per object file (deploy order) and per test file (numeric order). The
container is removed at the end — on failure too (exit trap).

When it fails, read the log like this:

- The run stops at the **first** error (`ON_ERROR_STOP` + `set -e`); there is no partial success —
  a missing `ALL TESTS PASSED` means failure even if the tail looks quiet.
- **The failing file is the last `>>> apply …` line.** The SQL error itself reads
  `psql:<stdin>:<line>: ERROR: …` — the line number counts *within that file*; the filename only
  appears in the apply line above (the runner streams files via stdin).
- A failed assertion surfaces as `ERROR:  Assertion failed` (or the assert's custom message) from
  the test file's `DO $$ … ASSERT` block — the object's behavior regressed, or the test encodes an
  outdated expectation.
- `NOTICE: … does not exist, skipping` lines are **normal** idempotency noise
  (`DROP … IF EXISTS` on a fresh DB) — never the cause of a failure.

## Running the scripts on Windows

Same ground rules as in
[KB-003](kb-003-db-bootstrap-new-environment.md#running-the-scripts-on-windows): the runner is a
bash script — Git Bash sees the repo directly (no Docker mount), and from PowerShell you call
Git's bundled bash with the leading `&` (call operator, required):

```powershell
# Windows / PowerShell
& "$env:ProgramFiles\Git\bin\bash.exe" db/tests/run.sh
```

Differences from the bootstrap/deploy runners ([KB-003](kb-003-db-bootstrap-new-environment.md),
[KB-004](kb-004-db-deploy-schema-objects.md)):

- **No `psql` needed on the host** — every psql call runs *inside* the throwaway container
  (`docker exec`), so there is no containerized-psql fallback to reach for.
- **No mount, no `-it`, no passwords** — the runner streams the SQL files into the container over
  stdin and prompts for nothing; it also brings (and removes) its own container, independent of
  `app-local-pg` from [KB-002](kb-002-local-postgres-docker-container.md).

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
- [KB-004: Deploy schema objects](kb-004-db-deploy-schema-objects.md) — the deploy this smoke protects.
- Reference: [db/tests/README.md](../../db/tests/README.md).
