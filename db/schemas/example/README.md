# db/schemas/example — template schema

A template for **one database schema**. Copy this directory, rename `example` to your real schema
name (e.g. `app`, `core`, `billing`), and add a matching `\set schema_<name>` in
`db/config/<env>.env.sql`.

> For reference, the source framework defines four schemas — `config`, `etl`, `helper`, `log`. Your
> project defines its own.

## Object-type subdirectories (load order)
The runner applies these in a fixed order; within each, by 3-digit numeric prefix:

| # | Directory | Objects |
|---|-----------|---------|
| 1 | [`predeploy/`](predeploy/) | run-once transition scripts (before object DDL) |
| 2 | [`tables/`](tables/) | `CREATE TABLE` |
| 3 | [`policies/`](policies/) | Row-Level-Security policies |
| 4 | [`functions/`](functions/) | `fn_…` stored functions |
| 5 | [`procedures/`](procedures/) | `sp_…` stored procedures |
| 6 | [`trigger/`](trigger/) | `tf_…` / `tr_…` |
| 7 | [`views/`](views/) | `vw_…` |
| 8 | [`data/`](data/) | seed / reference data |
| 9 | [`postdeploy/`](postdeploy/) | run-once transition scripts (after seed; backfills etc.) |

All objects belonging to one table share that table's 3-digit number across the object
subdirectories (see `.claude/rules/sql/postgres/sql.md` → "File Naming & Numbering"; numbers are
claimed in [`NUMBERS.md`](NUMBERS.md)). `predeploy`/`postdeploy` files use `YYYYMMDDHHMM`
timestamp prefixes instead and run **once per database** (tracked in `schema_change_log` — see
`.claude/rules/db-migrations.md`).

## Shipped worked examples

A small, complete, **tested** slice (deployed into `:schema_app` = `app`; exercised by
`db/tests/run.sh` and CI):

| # | Table | Objects |
|---|-------|---------|
| `000` | — (shared) | `fn_is_null_or_empty` (validator function), `tf_set_modified` (generic BEFORE UPDATE audit trigger function) |
| `001` | `example` (master) | table · `sp_ins_example` / `sp_upd_example` / `sp_del_example` · `tr_u_example` · `vw_example_overview` · seed data |
| `002` | `example_item` (detail, FK → example) | table · `sp_ins_example_item` · `tr_u_example_item` |
| `003` | `schema_apply_log` (deploy tracker) | table (append-only, audit-exempt) · `sp_ins_schema_apply` (called by `db/scripts/deploy.sh`) |
| `004` | `schema_change_log` (run-once tracker) | table (append-only, audit-exempt, `filename` UNIQUE) · `sp_ins_schema_change` (called by `db/scripts/deploy.sh` per applied `predeploy`/`postdeploy` file) |
| — | transition scripts | `postdeploy/202607050900.backfill-example-notes.sql` (backfills the convergently added `example.notes` column — worked example of the run-once path) |

The trio demonstrates the core conventions end-to-end: identity PKs, audit columns + actor-email
convention, UNIQUE / FK as separate `ALTER TABLE`, speaking reference-guard deletes, the
Get name / Check parameter / Workload procedure body, `format()` error messages, and idempotent
re-runnable DDL.
