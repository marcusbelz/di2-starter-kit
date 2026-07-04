# SQL vendor: PostgreSQL 17

> The reference vendor ruleset. Directory overview and vendor split:
> [../README.md](../README.md). `/init` keeps this directory only when
> `database == postgres`. How the auto-loading works and why pruning matters:
> [KB-008](../../../../docs/kb/kb-008-how-rules-and-skills-are-loaded.md).

## Contents of this directory

| File | Scope |
|------|-------|
| [`sql.md`](sql.md) | Cross-cutting styleguide: naming, alignment, file-numbering, layout. **Authoritative on conflict.** |
| [`tables.md`](tables.md) | CREATE TABLE, foreign keys / unique, comments, INSERT/seed, data types, audit columns, RLS |
| [`procedures.md`](procedures.md) | Parameter order & docs, body structure, error messages & `format()`, skeleton |
| [`functions.md`](functions.md) | Function skeleton, volatility; shared body rules via `procedures.md` |
| [`trigger.md`](trigger.md) | Trigger / trigger-function skeleton, `TG_OP` logic |
| [`views.md`](views.md) | View conventions |
| [`policies.md`](policies.md) | Row-Level-Security policies |

## Lineage

This ruleset is a near-verbatim port from a PostgreSQL framework proven in a real-world project
and therefore carries framework-internal references — `db/schemas/…` paths, `:schema_config` /
`:schema_etl` / `:schema_log` schema variables, the `:role_rw` runtime role. Treat those as
illustrative; a fresh project adapts them to its own schema and deploy layout. The files were
originally ported in **German** and have since been translated to **English** — the whole kit is
English-only (see [`../../language.md`](../../language.md)).

For what **DI²** is and where these conventions come from, see the root README →
[About DI² and its database framework](../../../../README.md#about-di-and-its-database-framework).
