# db/tests — database object tests

Per-schema tests that assert the deployed objects behave (constraints, identity PKs, audit columns,
procedure happy-paths / guards). Run against a throwaway database after `deploy` — the apply-smoke
step in `.claude/rules/db-migrations.md`.

> **Optional scaffold.** This test scaffold is opt-out: `/init` asks whether to keep it and removes
> this `db/tests/` tree when you decline (`tests == none` in `.claude/rules/stack.md`). Keeping it is
> the default. If it was pruned and you later want tests back, copy this directory from a fresh clone
> of the starter kit.

## Layout
One subdirectory per schema, mirroring `db/schemas/` — e.g. `db/tests/<schema>/`. Test files reuse
the target object's 3-digit number: `NNN.<object>.sql`, plus cross-cutting checks like
`000.audit_columns.sql`, `000.identity_pk.sql`.

## Running
- **Locally:** `bash db/tests/run.sh` (Git Bash on Windows; needs Docker) — spins up a throwaway
  `postgres:17` container, applies all `db/schemas/example/` objects in deploy order, runs every
  test file, tears down. Prints `ALL TESTS PASSED` only if everything succeeded.
- **CI:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs the same assertions
  after a full `create.sh local` + `deploy.sh all local` against a service container, then
  re-deploys as an idempotency check.

## What to cover
- **Structural:** surrogate identity PK present, audit columns + defaults, NOT NULL / UNIQUE / FK.
- **Behavioral:** each `sp_…` happy path + at least one guard (`RAISE` on bad input).
- **RLS:** a row visible to its owner is hidden from another role.

The shipped `example/` tests cover exactly that spread: structural checks
(`000.identity_pk.sql`, `000.audit_columns.sql`), a function (`000.fn_is_null_or_empty.sql`), and
behavioral procedure tests incl. guards (`001.example.sql`, `002.example_item.sql`,
`003.schema_apply_log.sql`).
