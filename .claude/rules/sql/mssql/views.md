# Rule: Views (SQL Server 2022)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **The authoritative SQL code conventions are in [sql.md](sql.md) — read before every script.**
> Naming **`vw_<name>`**, snake_case, vertical SELECT/FROM/WHERE layout, JOIN alignment
> (`T01`/`T02`…), file skeleton (`PRINT` header/footer + `GO` batches). **On conflict, sql.md
> wins.**
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable.

## Framework-specific
- **Location:** one script per view under `db/schemas/<schema>/views/<NNN>.vw_<name>.sql`
  (log views: `db/schemas/log/views/`). `<NNN>` = number of the underlying main table.
- **Idempotent** (`CREATE OR ALTER VIEW`), **read-only** (no `INSTEAD OF` write-through without a
  documented rationale), name/alias columns explicitly — **no `SELECT *` in permanent views**
  (T-SQL additionally freezes the `*` expansion at creation time: a later `ALTER TABLE … ADD
  COLUMN` silently does not appear until `sp_refreshview` — one more reason the rule is hard).
- `CREATE VIEW` resolves its references at creation time. View-on-function is fine (functions
  deploy earlier); **view-on-view** requires the referenced view's number prefix to sort earlier
  in the section (see `.claude/rules/db-migrations.md` → "Why the fixed section order resolves
  dependencies").
- **Indexed views instead of materialized views:** SQL Server has no `MATERIALIZED VIEW`; the
  equivalent for expensive aggregations is an **indexed view** — `WITH SCHEMABINDING` plus a
  **unique clustered index** on the view. It is maintained automatically on every base-table
  write (no refresh strategy needed — difference from the PostgreSQL ruleset), which shifts the
  cost to write time: use deliberately on write-heavy tables. Restrictions apply (deterministic
  expressions only, no outer joins, aggregates need `COUNT_BIG(*)`, two-part base-table names).
- **`CREATE OR ALTER` drops the view's indexes:** altering an indexed view removes its indexes —
  the index `CREATE` therefore lives **in the same file, after the view definition**, guarded via
  `sys.indexes` (`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'<index>' AND object_id =
  OBJECT_ID(N'$(schema_name).<view>'))`), so every deploy leaves the view indexed.
- **Description:** the T-SQL equivalent of `COMMENT ON VIEW` is the `MS_Description` extended
  property — one aligned `EXEC $(schema_helper).sp_set_description` line after the view (the
  helper from [tables.md](tables.md); `@p_column = NULL` targets the object itself).

## Skeleton (view)

```sql
PRINT '## CREATE VIEW $(schema_name).vw_errors_by_table';
GO

CREATE OR ALTER VIEW $(schema_name).vw_errors_by_table
AS
SELECT
    T01.table_name
   ,COUNT_BIG(*)  AS error_count
FROM
   $(schema_log).error T01
GROUP BY
   T01.table_name;
GO

-- --------------------------------------------------------------------------------
-- Descriptions
-- --------------------------------------------------------------------------------
EXEC $(schema_helper).sp_set_description N'$(schema_log)', N'vw_errors_by_table', NULL, N'Error count per source table (monitoring view over log.error).';
GO

PRINT '## CREATE VIEW $(schema_name).vw_errors_by_table - DONE';
GO
```
