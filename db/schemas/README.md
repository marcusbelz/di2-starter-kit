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
Per schema: `tables → policies → functions → procedures → trigger → views → data` (within a section,
by 3-digit prefix). Across schemas (`deploy all`), in dependency order — framework example:
`helper → config → log → etl`; `clean all` reverses it.
