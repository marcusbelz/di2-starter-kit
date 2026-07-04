# SQL vendor: SQL Server 2022 (MSSQL)

> The T-SQL sibling of the PostgreSQL reference ruleset under [`../postgres/`](../postgres/) —
> same conventions where they carry over, adapted where the T-SQL dialect differs. Directory
> overview and vendor split: [../README.md](../README.md). `/init` keeps this directory only when
> `database == mssql`. How the auto-loading works and why pruning matters:
> [KB-008](../../../../docs/kb/kb-008-how-rules-and-skills-are-loaded.md).

## Contents of this directory

| File | Scope |
|------|-------|
| [`sql.md`](sql.md) | Cross-cutting styleguide: naming, alignment, file-numbering, layout, `GO` batches, sqlcmd variables. **Authoritative on conflict.** |
| [`tables.md`](tables.md) | CREATE TABLE, foreign keys / unique, descriptions (extended properties), INSERT/`MERGE` seed, data types, audit columns, RLS |
| [`procedures.md`](procedures.md) | Parameter order & docs, body structure, error messages & `FORMATMESSAGE()`/`THROW`, skeleton |
| [`functions.md`](functions.md) | Function skeleton, scalar vs. inline TVF, determinism/`SCHEMABINDING`; shared body rules via `procedures.md` |
| [`trigger.md`](trigger.md) | Trigger skeleton, set-based `inserted`/`deleted` logic, recursion guard, audit trigger |
| [`views.md`](views.md) | View conventions, indexed views |
| [`policies.md`](policies.md) | Security policies (FILTER/BLOCK predicates, predicate functions) |

## Key dialect differences from the PostgreSQL ruleset

- **sqlcmd instead of psql:** `$(var)` variables substitute textually before the batch runs — they
  work *inside* module bodies too (no hardcoded-schema exception); `GO` batch separators instead
  of psql meta-commands; `PRINT` instead of `\echo`.
- **No dollar-quoting, no trigger functions** (`tf_` tier does not exist — the body lives in the
  trigger), **no per-object `OWNER TO`** (ownership is per schema).
- **Identity & errors:** `IDENTITY(1,1)` + `SCOPE_IDENTITY()` instead of
  `GENERATED ALWAYS AS IDENTITY` + `RETURNING`; `FORMATMESSAGE()`/`THROW` instead of
  `format()`/`RAISE`; `MERGE` instead of `ON CONFLICT`.
- **Descriptions:** `MS_Description` extended properties (via the `sp_set_description` helper)
  instead of `COMMENT ON`.

## Lineage

Translated from the kit's PostgreSQL ruleset (itself a near-verbatim port from a framework proven
in a real-world project) and adapted to the T-SQL dialect; authored in **English** directly per
[`../../language.md`](../../language.md). The framework-internal references (`db/schemas/…` paths,
`$(schema_config)` / `$(schema_etl)` / `$(schema_log)` variables) are illustrative — a fresh
project adapts them to its own schema and deploy layout.

For what **DI²** is and where these conventions come from, see the root README →
[About DI² and its database framework](../../../../README.md#about-di-and-its-database-framework).
