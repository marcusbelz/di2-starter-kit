# Rule: Triggers (PostgreSQL 17)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/`
> (e.g. `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **For the cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming,
> tabular alignment, file skeleton, File Naming & Numbering). **On conflict, sql.md wins.**
> Trigger function **`tf_<entity>`** (`RETURNS TRIGGER`, **no** `DROP FUNCTION` — only
> `CREATE OR REPLACE`, dollar-quoting `$triggerfunction$`), trigger **`tr_<type>_<entity>`**
> (`<type>` = `i`/`u`/`d`/`iud`). The **trigger / trigger-function skeletons** and the `TG_OP`
> logic live **here** in this file.
>
> **Schema variables:** `:schema_config`/`:schema_etl`/`:schema_helper`/`:schema_log` and
> `:schema_owner` instead of `:schema_app_*`.

## Framework-specific
- **Location:** one script per trigger under `db/schemas/<schema>/trigger/<NNN>.<tf|tr>_<...>.sql`
  (trigger function + trigger definition). `<NNN>` = number of the table on whose trigger the
  function hangs (cross-table heuristic see sql.md).
- Keep it lean: no heavy business logic, no uncontrolled side effects, no
  infinite/recursion loops.
- `SECURITY DEFINER` only with a rationale **and** a set `search_path`.

## Trigger logic (`TG_OP`)
- Check `TG_OP` with `IF / ELSEIF / ELSE` — always cover all three branches
- `ELSE` → `RETURN NULL` (no implicit fall-through)
- On INSERT: pass `NEW.<column>`, `RETURN NEW`
- On DELETE: pass `OLD.<column>`, `RETURN OLD`
- Always pass `TG_OP` as the first argument to called procedures

## Skeleton (trigger function)

> **No `DROP FUNCTION` for trigger functions.** Triggers depend on the function; a `DROP FUNCTION IF EXISTS` would abort on a re-run with `cannot drop function ... because other objects depend on it (trigger ...)`. `CREATE OR REPLACE FUNCTION` alone is trigger-safe as long as the signature stays stable — for trigger functions with `RETURNS TRIGGER` and no parameters it is, by definition. For **non-trigger** stored functions (see [functions.md](functions.md)) the `DROP FUNCTION IF EXISTS … (signature);` + `CREATE OR REPLACE FUNCTION` pattern stays correct.

```sql
\echo "## CREATE FUNCTION :schema_name.tf_table()"

CREATE OR REPLACE FUNCTION :schema_name.tf_table()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $triggerfunction$
BEGIN

   -- Logic

END;
$triggerfunction$;

ALTER FUNCTION :schema_name.tf_table() OWNER TO :schema_owner;

\echo "## CREATE FUNCTION :schema_name.tf_table() - DONE"
```

## Skeleton (trigger)

```sql
\echo "## CREATE TRIGGER tr_iud_table"

DROP TRIGGER IF EXISTS tr_iud_table ON :schema_name.log_execution;

CREATE TRIGGER tr_iud_table
BEFORE INSERT OR UPDATE OR DELETE ON :schema_name.log_execution
FOR EACH ROW
   EXECUTE PROCEDURE :schema_name.tf_table();

\echo "## CREATE TRIGGER tr_iud_table - DONE"
```
