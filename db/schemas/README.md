# db/schemas — schema objects

One subdirectory per database **schema**; each schema splits its objects by type. The directory tree
+ file numbering is the deploy source of truth (there is no central `deploy.sql`).

## Table of Contents
- [Layout](#layout)
- [Load order](#load-order)

## Layout
- [`example/`](example/) — a **template schema** to copy per real schema (rename `example`).

For reference, the source framework defines schemas like `config` (app configuration), `etl`
(dynamic-SQL procedures), `helper` (utility functions), `log` (process logging + errors). Your
project defines its own.

## Load order
Per schema: `predeploy → tables → policies → functions → procedures → trigger → views → data →
postdeploy` (within the object sections by 3-digit table-group prefix; `predeploy`/`postdeploy`
are **run-once** transition scripts with `YYYYMMDDHHMM` prefixes — see
`.claude/rules/db-migrations.md`). Across schemas (`deploy all`), in dependency order — framework
example: `helper → config → log → etl`; `clean all` reverses it.

Each schema directory also carries a `NUMBERS.md` — the table-group number registry (claim
protocol in `.claude/rules/sql/postgres/sql.md`, CI lint via `db/scripts/lint-numbers.sh`).
