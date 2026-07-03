# Rule: Functions (PostgreSQL 17)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/`
> (e.g. `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **For the cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> `fn_<verb>_<name>`, parameter prefix `p_`, variables `l_`, dollar-quoting `$function$`,
> `RETURNS`/`LANGUAGE` each on its own line, tabular alignment, file skeleton `\echo`/`DROP
> FUNCTION … (signature)`/`CREATE OR REPLACE`/`OWNER TO`). **On conflict, sql.md wins.**
>
> **Shared PL/pgSQL body rules** (apply to functions identically to procedures) live in
> [procedures.md](procedures.md):
> [Parameter order](procedures.md#parameter-order-id-first) ·
> [Parameter documentation](procedures.md#parameter-documentation-inline-block-before-create) ·
> [Body structure](procedures.md#body-structure-get-name--check-parameter--workload) ·
> [Error messages & `format()`](procedures.md#error-messages--format).
>
> **Schema variables:** `:schema_config`/`:schema_etl`/`:schema_helper`/`:schema_log` and
> `:schema_owner` instead of `:schema_app_*`.

## Framework-specific
- **Location:** one script per function under `db/schemas/<schema>/functions/<NNN>.fn_<verb>_<name>.sql`.
  `<NNN>` = number of the main table the function relates to (sql.md "File Naming & Numbering").
- **Set volatility correctly:** `IMMUTABLE` (pure computation, e.g. `helper` conversions),
  `STABLE` (read-only), `VOLATILE` (side effects).
- Write operations generally belong in **procedures**, not in functions.
- PL/Python (`plpython3u`) only where strictly necessary.

## Skeleton (stored function)

> Pure validator functions without an error `RAISE` omit the `Get name` section of the
> [body structure](procedures.md#body-structure-get-name--check-parameter--workload); the
> `Check parameter`/`Workload` split is optional there. The `-- Parameter` block is
> mandatory even for functions with parameters.

```sql
\echo "## CREATE FUNCTION :schema_name.fn_is_null_or_empty"

DROP FUNCTION IF EXISTS :schema_name.fn_is_null_or_empty(varchar, bigint);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_parameter1        varchar
--       <meaning of p_parameter1>
--    p_parameter2        bigint
--       <meaning of p_parameter2>
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION :schema_name.fn_is_null_or_empty
(
    IN    p_parameter1        varchar
   ,IN    p_parameter2        bigint
)
RETURNS varchar
LANGUAGE plpgsql
AS $function$
DECLARE
   l_returnvalue             varchar;
BEGIN

   -- Logic

   RETURN l_returnvalue;

EXCEPTION WHEN others THEN
   RAISE NOTICE '##### %', SQLERRM;
   RETURN NULL::varchar;
END;
$function$;

ALTER FUNCTION :schema_name.fn_is_null_or_empty(varchar, bigint) OWNER TO :schema_owner;

\echo "## CREATE FUNCTION :schema_name.fn_is_null_or_empty - DONE"
```
