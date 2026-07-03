# Rule: Functions (SQL Server 2022 / T-SQL)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **For the cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> `fn_<verb>_<name>`, parameter prefix `@p_`, variables `@l_`, `RETURNS` on its own line, tabular
> alignment, file skeleton `PRINT` header/footer + `GO` batches). **On conflict, sql.md wins.**
>
> **Shared body rules** (apply to functions identically to procedures) live in
> [procedures.md](procedures.md):
> [Parameter order](procedures.md#parameter-order-id-first) ·
> [Parameter documentation](procedures.md#parameter-documentation-inline-block-before-create) ·
> [Body structure](procedures.md#body-structure-get-name--check-parameter--workload).
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable.

## Framework-specific
- **Location:** one script per function under
  `db/schemas/<schema>/functions/<NNN>.fn_<verb>_<name>.sql`. `<NNN>` = number of the main table
  the function relates to (sql.md "File Naming & Numbering").
- **Idempotency:** `CREATE OR ALTER FUNCTION`. **Exception — RLS predicate functions:** while a
  security policy references the function, `ALTER`/`CREATE OR ALTER` fails — drop the policy
  first; the order lives in [policies.md](policies.md).
- **Write operations belong in procedures, not in functions** — in T-SQL this is not just
  convention but engine-enforced: function bodies allow no data modification, no `TRY/CATCH`, no
  `THROW`/`RAISERROR`, no `SET` options (hence also no `SET NOCOUNT ON` — the sql.md rule
  deliberately names only procedures and triggers). Validator functions therefore signal problems
  via **marker return values**, never via errors; real error raising happens in the calling
  procedure.
- **Scalar vs. inline TVF:** anything set-shaped is an **inline table-valued function**
  (single-statement `RETURN (SELECT …)`) — the optimizer inlines it like a view. Scalar functions
  only for small pure helpers (conversions, `fn_is_null_or_empty`-style checks); SQL Server 2019+
  scalar-UDF inlining mitigates but does not excuse heavy scalar UDFs in hot queries. Avoid
  **multi-statement** TVFs — they carry cardinality-estimation penalties; if one seems needed,
  reconsider the design (usually a procedure or an inline TVF fits).
- **Determinism instead of volatility:** T-SQL has no `IMMUTABLE`/`STABLE`/`VOLATILE` markers —
  determinism is inferred. Add **`WITH SCHEMABINDING`** to functions that qualify (pure
  computation / stable reads): it lets the engine verify determinism and is a prerequisite for use
  in indexed views and persisted computed columns.

## Skeleton (scalar function)

> Pure validator functions without a component trace omit the `Get name` section of the
> [body structure](procedures.md#body-structure-get-name--check-parameter--workload); the
> `Check parameter`/`Workload` split is optional there. The `-- Parameter` block is mandatory even
> for functions with parameters. No error handler at the end — T-SQL functions cannot catch or
> raise errors (see above); the function returns its value, nothing else.

```sql
PRINT '## CREATE FUNCTION $(schema_name).fn_is_null_or_empty';
GO

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    @p_value         nvarchar(max)
--       Value to test for NULL or empty/whitespace-only content
-- --------------------------------------------------------------------------------
CREATE OR ALTER FUNCTION $(schema_name).fn_is_null_or_empty
(
    @p_value         nvarchar(max)
)
RETURNS bit
WITH SCHEMABINDING
AS
BEGIN
   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   DECLARE @l_returnvalue           bit;

   SET @l_returnvalue = CASE
                           WHEN @p_value IS NULL                 THEN 1
                           WHEN LEN(LTRIM(RTRIM(@p_value))) = 0  THEN 1
                           ELSE 0
                        END;

   RETURN @l_returnvalue;
END;
GO

PRINT '## CREATE FUNCTION $(schema_name).fn_is_null_or_empty - DONE';
GO
```

## Skeleton (inline table-valued function)

```sql
PRINT '## CREATE FUNCTION $(schema_name).fn_get_active_process';
GO

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    @p_connection_id bigint
--       Identifier of the connection whose active processes are returned
-- --------------------------------------------------------------------------------
CREATE OR ALTER FUNCTION $(schema_name).fn_get_active_process
(
    @p_connection_id bigint
)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
   SELECT
       T01.id
      ,T01.name
   FROM
      $(schema_config).process T01
   WHERE
          T01.connection_id = @p_connection_id
      AND T01.is_active     = 1
);
GO

PRINT '## CREATE FUNCTION $(schema_name).fn_get_active_process - DONE';
GO
```
