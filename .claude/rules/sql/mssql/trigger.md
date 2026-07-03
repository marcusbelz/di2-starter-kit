# Rule: Triggers (SQL Server 2022)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **For the cross-cutting SQL conventions see [sql.md](sql.md) — read before every script**
> (naming, tabular alignment, file skeleton `PRINT` header/footer + `GO` batches, File Naming &
> Numbering). **On conflict, sql.md wins.**
>
> **No trigger-function tier:** T-SQL has no separate trigger functions — the body lives in the
> trigger object itself, so there is no `tf_` prefix in this ruleset (difference from the
> PostgreSQL ruleset). Trigger naming: **`tr_<type>_<entity>`** (`<type>` = `i`/`u`/`d`/`iud`).
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable.

## Framework-specific
- **Location:** one script per trigger under `db/schemas/<schema>/trigger/<NNN>.tr_<...>.sql`.
  `<NNN>` = number of the table the trigger is attached to (the table in the `ON` clause),
  regardless of which tables the body writes to (cross-table heuristic see sql.md).
- **Idempotency:** `CREATE OR ALTER TRIGGER` (a rename or removal still needs an explicit
  `DROP TRIGGER IF EXISTS` change-set entry).
- **`SET NOCOUNT ON;`** is the first statement of every trigger body (sql.md rule — extra row
  counts from trigger DML confuse clients that check `@@ROWCOUNT`/rows-affected).
- Keep it lean: no heavy business logic, no uncontrolled side effects, no infinite/recursion
  loops (guard below).
- **`AFTER` triggers are the default**; `INSTEAD OF` only with a documented rationale.

## Set-based logic (`inserted` / `deleted`)

- A T-SQL trigger fires **once per statement**, not per row (there is no `FOR EACH ROW`) — the
  body must be **set-based** against the `inserted` / `deleted` pseudo-tables. **Never** assume
  exactly one row: no `SELECT @l_x = col FROM inserted` (silently picks an arbitrary row on
  multi-row DML), no cursors/loops over the pseudo-tables.
- The pseudo-tables count as table references: alias them positionally (`T01`, `T02`, …) like any
  other table (sql.md JOIN rules).
- **Determine the operation from the pseudo-tables** when one trigger covers several operations —
  always cover all three branches, no implicit fall-through (the mirror of the PostgreSQL `TG_OP`
  rule):
  - INSERT → rows in `inserted`, none in `deleted`
  - UPDATE → rows in both
  - DELETE → rows in `deleted`, none in `inserted`
- **Early exit on empty firings:** statements affecting 0 rows still fire the trigger —
  `IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;` right
  after the guards.
- `UPDATE(<column>)` narrows an `AFTER UPDATE` trigger to relevant column changes — use it when
  the workload only concerns specific columns.

## Recursion guard

A trigger that writes to **its own table** (the audit trigger below updates `modified_*` on the
row it fired for) re-fires itself when the database's `RECURSIVE_TRIGGERS` setting or server-level
nested triggers allow it. Guard as the first statement after `SET NOCOUNT ON;`:

```sql
   IF TRIGGER_NESTLEVEL(@@PROCID) > 1
      RETURN;
```

Do **not** rely on the database setting being off — the guard makes the trigger safe regardless of
environment configuration.

## The audit trigger `tr_u_<table>`

Every table with `modified_on` / `modified_by` columns gets its own small `AFTER UPDATE` trigger
(see [tables.md](tables.md) — T-SQL has no shared trigger function to reuse, so the same few lines
repeat per table):

- `modified_on` is always stamped with `sysdatetimeoffset()`.
- `modified_by` comes from the per-session context (`SESSION_CONTEXT(N'actor_email')`, see
  sql.md audit rule); `COALESCE` keeps a value the `UPDATE` statement itself supplied (e.g. via an
  `sp_upd_*` procedure parameter) when no session context is set — the trigger never erases an
  explicitly written actor.

## Skeleton (trigger)

```sql
PRINT '## CREATE TRIGGER $(schema_name).tr_u_example';
GO

CREATE OR ALTER TRIGGER $(schema_name).tr_u_example
ON $(schema_name).example
AFTER UPDATE
AS
BEGIN
   SET NOCOUNT ON;

   IF TRIGGER_NESTLEVEL(@@PROCID) > 1
      RETURN;

   IF NOT EXISTS (SELECT 1 FROM inserted)
      RETURN;

   UPDATE T01
   SET
       modified_on = sysdatetimeoffset()
      ,modified_by = COALESCE(CAST(SESSION_CONTEXT(N'actor_email') AS nvarchar(100)), T01.modified_by)
   FROM
      $(schema_name).example T01
      INNER JOIN inserted T02
      ON
        T02.id = T01.id;
END;
GO

PRINT '## CREATE TRIGGER $(schema_name).tr_u_example - DONE';
GO
```
