# Rule: Policies / Row-Level Security (SQL Server 2022)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **The authoritative SQL code conventions are in [sql.md](sql.md) — read before every script.**
> Naming (policy **`sec_<entity>`**, predicate function **`fn_<entity>_predicate`**), layout, file
> skeleton `PRINT` header/footer + `GO` batches live there. **On conflict, sql.md wins.**
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable.

## Framework-specific
- **Location:** script under `db/schemas/<schema>/policies/<NNN>.<table>_policies.sql`
  (framework primarily `log`). `<NNN>` = number of the table whose policies are defined here.
- **Two-part model:** SQL Server RLS = an **inline table-valued predicate function**
  (`fn_<entity>_predicate`, `WITH SCHEMABINDING` — mandatory) + a **security policy**
  (`sec_<entity>`) that binds the function to the table. There is no `ENABLE ROW LEVEL SECURITY`
  on the table itself — attaching a policy `WITH (STATE = ON)` is what activates RLS.
- **Predicate kinds** (the mirror of PostgreSQL `USING` / `WITH CHECK`):
  - **`FILTER` predicate** = visibility — silently filters rows from `SELECT`, and from the row
    selection of `UPDATE`/`DELETE`.
  - **`BLOCK` predicates** = write conditions — reject violating writes with an error:
    `AFTER INSERT`, `AFTER UPDATE`, `BEFORE UPDATE`, `BEFORE DELETE`. T-SQL has no per-command
    policy (`FOR SELECT|INSERT|…`) — per-operation granularity comes from choosing the block
    types.
  - Set **both sides fully; default-deny**: a `FILTER` alone still lets a session `INSERT` rows it
    can never see again — pair it with `AFTER INSERT` (and where relevant `AFTER UPDATE`) block
    predicates.
- **Actor context:** the predicate keys off the per-session context
  (`SESSION_CONTEXT(N'actor_email')`, see sql.md audit rule) — never off the connection login
  (always the pooled runtime login). Decide explicitly what an **unset** context means; for
  sensitive tables the predicate returns no row then (default-deny).
- **Idempotency & drop order (the caveat referenced from [tables.md](tables.md)):** while a
  security policy references a predicate function, `ALTER`/`CREATE OR ALTER`/`DROP` of that
  function fails (schema-bound reference). File order is therefore fixed:
  1. `DROP SECURITY POLICY IF EXISTS …;`
  2. `CREATE OR ALTER FUNCTION … fn_<entity>_predicate …;`
  3. `CREATE SECURITY POLICY … WITH (STATE = ON);`
- **Defense-in-depth, not the only line:** the application still enforces authorization in code
  (see `.claude/rules/backend.md`); RLS catches what slips past it. Note that `db_owner` /
  sysadmin sessions bypass nothing automatically — but whoever can `ALTER SECURITY POLICY` can
  turn it off; keep runtime roles free of DDL rights.

## Skeleton (predicate function + security policy)

```sql
PRINT '## CREATE POLICY $(schema_log).sec_error';
GO

DROP SECURITY POLICY IF EXISTS $(schema_log).sec_error;
GO

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    @p_created_by    nvarchar(100)
--       created_by column value of the candidate row (bound by the security policy)
-- --------------------------------------------------------------------------------
CREATE OR ALTER FUNCTION $(schema_log).fn_error_predicate
(
    @p_created_by    nvarchar(100)
)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
(
   SELECT
      1 AS fn_result
   WHERE
      @p_created_by = CAST(SESSION_CONTEXT(N'actor_email') AS nvarchar(100))
);
GO

CREATE SECURITY POLICY $(schema_log).sec_error
    ADD FILTER PREDICATE $(schema_log).fn_error_predicate(created_by) ON $(schema_log).error
   ,ADD BLOCK  PREDICATE $(schema_log).fn_error_predicate(created_by) ON $(schema_log).error AFTER INSERT
   ,ADD BLOCK  PREDICATE $(schema_log).fn_error_predicate(created_by) ON $(schema_log).error AFTER UPDATE
WITH (STATE = ON);
GO

PRINT '## CREATE POLICY $(schema_log).sec_error - DONE';
GO
```

(An unset `actor_email` session context yields `NULL` — the comparison is never true, no row is
visible or writable: default-deny. Maintenance/ETL sessions that legitimately see everything get
an explicit escape hatch in the predicate — e.g. a dedicated session-context flag or role check —
documented in the file header, never by leaving the policy `STATE = OFF`.)
