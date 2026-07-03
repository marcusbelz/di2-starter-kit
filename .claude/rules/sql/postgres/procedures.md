# Rule: Procedures (PostgreSQL 17 / PL/pgSQL)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/`
> (e.g. `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview:
> [README](../README.md).

> **For cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> `sp_<verb>_<entity>`, parameter prefix `p_`, variables `l_`, dollar quoting `$procedure$`,
> tabular alignment, file skeleton `\echo`/`DROP`/`CREATE OR REPLACE`/`OWNER TO`, File
> Naming & Numbering). **On conflict, sql.md wins.** The **procedure-specific** rules
> (parameter order, parameter documentation, body structure, error messages, Single
> Responsibility, skeleton) live **here** in this file.
>
> **Schema variables:** `:schema_config`/`:schema_etl`/`:schema_helper`/`:schema_log` and
> `:schema_owner` instead of `:schema_app_*`. The schema name is **always** a variable, never hardcoded.

## Framework-specific
- **Location:** one script per procedure under `db/schemas/<schema>/procedures/<NNN>.sp_<verb>_<entity>.sql`.
  `<NNN>` = number of the **main table** that the procedure describes (cross-table heuristic see sql.md).
- **Integrate logging:** create the component at the start, update it on success/failure
  at the end; trace likewise; data errors go to `log.error`; set the status deterministically
  in the `EXCEPTION` block.
- **Dynamic SQL** (the core job of `etl`): only `format()` with `%I`/`%L`, or parameterized via
  `USING` — never string concatenation of inputs. For the **string layout** of the built statement
  (hanging block under the first keyword, `$sql$` delimiters aligned) see
  [sql.md → Dynamic SQL (`format()`)](sql.md#dynamic-sql-format--string-layout).
- **Note on lc_messages:** uses the logging convention `SET LOCAL
  lc_messages TO 'C'` (component parsing from `PG_CONTEXT`), which requires the runtime role to have
  `GRANT SET ON PARAMETER lc_messages` — see the grant in `db/database/05.create.role.rw.sql`.

## Parameter order (ID first)

> Derived from the `config.process` procedures (`sp_ins_process` / `sp_upd_process` / `sp_del_process`).

If a procedure/function addresses a **record via its identifier** (`p_id` — generally the
primary key/identifier of the affected record) and **additionally takes attribute parameters**
(name, text/name field, …), then the signature order follows:

- **The identifier parameter ALWAYS comes first**, followed by the attribute fields — in
  the order in which the associated table first **identifies** the record and then
  **describes** it. This mirrors the statement logic of the procedures: `WHERE id = p_id`
  identifies the row first, after which the attribute columns are read/set (cf. the
  `SELECT … WHERE id = p_id`, `UPDATE … WHERE id = p_id`, `DELETE … WHERE id = p_id` in
  `sp_upd_process` / `sp_del_process`).
- Applies to all verbs: `del`/`get` often have only `p_id`; `upd` has `p_id` + attributes; **`ins`**
  carries the `id` as `INOUT` (returning the newly assigned surrogate key) — it still comes
  **before** the attribute fields. The rule "identifier first" takes precedence here over the
  otherwise usual ordering "inputs before outputs".
- Multiple identifiers (composite/cross-table keys): all identifier parameters first (in order
  of their identification depth), followed by the attribute fields.

```sql
-- correct: identifier (p_id) before attribute (p_name) — even when p_id is INOUT on INSERT
CREATE OR REPLACE PROCEDURE :schema_config.sp_ins_process
(
    INOUT p_id          bigint
   ,IN    p_name        varchar
)
```

## Parameter documentation (inline block before `CREATE`)

> Derived from the `config.process` procedures. **Mandatory for every procedure/function with
> parameters** — the bare signature is not enough, especially with long parameter lists.

**Between `DROP …;` and `CREATE OR REPLACE …`** there is a comment block that documents each
parameter. It is structured as a banner block: a 3-line `-- Parameter` header, the entries,
closed by **one more separator line directly before `CREATE`**.

- **Header/footer:** the same banner separator line as everywhere else (`--` + space + 80 `-`); label `Parameter`.
- **Two lines per parameter:**
  - **Line 1 — name + type:** `--` + **4 spaces** (= 3 characters of indentation from the comment prefix
    `-- `), then `<p_name>`, then the alignment spaces + `<type>`. Name and type are copied **1:1 from
    the signature** (copied from the parameter name onward) — the mode keyword (`IN`/`INOUT`) and
    leading comma are dropped; the types thereby line up below one another as in the signature.
  - **Line 2 — description:** `--` + **7 spaces** (= 3 characters more indented than the name),
    then the description text (the parameter's domain meaning).
- The order of entries = the order of the signature (i.e. identifier first, see
  [Parameter order](#parameter-order-id-first)).

```sql
-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id          bigint
--       Identifier of the affected process record
--    p_name        varchar
--       Name of the process
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_config.sp_upd_process
(
    IN    p_id          bigint
   ,IN    p_name        varchar
)
```

## Body structure: Get name / Check parameter / Workload

> Every procedure/function body is divided into three fixed sections, each introduced by an 80-dash banner. The last two live in a **dedicated `BEGIN … END;` sub-block** — purely for visual grouping and to **collapse** them in the editor (focus on one part). The sub-blocks need no `DECLARE`/`EXCEPTION` of their own (they are pure grouping blocks), but may have one if needed.

1. **`Get name of function/procedure`** — `SET LOCAL lc_messages TO 'C'`, `GET DIAGNOSTICS … PG_CONTEXT`, `l_component := substring(…)` (+ an optional `RAISE NOTICE` entry trace). Lives directly in the outer `BEGIN` (no sub-block).
   > **Grant prerequisite:** `lc_messages` is a **SUSET GUC** — only a superuser or a role with an explicit `GRANT SET ON PARAMETER lc_messages` may set it. Because the procedures run with **caller rights** (no `SECURITY DEFINER`), the runtime role must carry this privilege, otherwise the very first body line throws `42501 permission denied to set parameter "lc_messages"`. The kit's example procedures use this convention, so the grant is **active** in `db/database/05.create.role.rw.sql` (`GRANT SET ON PARAMETER lc_messages TO :role_rw;`) — remove it only if you drop the convention from your procedures.
2. **`Check parameter`** — `BEGIN … END;` sub-block with **all entry/guard checks at the start** (parameter validation, actor context, permission preconditions). Violation → `RAISE` following the format() pattern.
3. **`Workload`** — `BEGIN … END;` sub-block with the actual work (lookups, mutations, RETURN).

**Order is mandatory:** guards come before the mutation — the `Check parameter` block always comes before the `Workload` block. When refactoring existing procs, the order of security-relevant checks (permission!) must **never** slip behind the mutation.

**Refactoring method (no reordering):** there is exactly **one boundary** between the pure entry-validation prefix and the first lookup/work statement. The `BEGIN … END;` blocks wrap the existing statements **in place** — statements are **never** moved relative to one another. If guards and lookups are interleaved (e.g. a permission check needs a previously fetched `project_id`), the boundary lies after the last pure entry check; all lookup-dependent checks stay in the `Workload` block. Prefer a smaller `Check parameter` block over a risky reordering.

**Avoid empty blocks:** a `BEGIN END;` without a statement is a syntax error in PL/pgSQL — at least `NULL;` or real statements.

Pure validator functions without an error `RAISE` (e.g. `fn_validate_*`, which only return marker strings) omit the `Get name` section; the `Check parameter`/`Workload` split is optional there.

## Error messages & `format()`

Every message and every error code passed to `RAISE EXCEPTION` (or to a `RAISE WARNING` that gives a real message to the client) is **placed into separate variables first** and only then emitted. **Exception:** diagnostic `RAISE NOTICE` traces (the `### procedure : %` entry trace and the `##### … SQLERRM` trace in the `EXCEPTION` handler) stay as plain inline `RAISE NOTICE` — they are debug breadcrumbs, not structured error messages. Rationale: no hardcoded texts directly at the function/`RAISE` call — the code reads top to bottom (first *what* is thrown, then *that* it is thrown), and the `RAISE` only gets variables.

### Rules

- **Language (MANDATORY): English.** All error messages passed to `RAISE EXCEPTION`/`RAISE WARNING` are written in **English** (project-wide operations/monitoring consistency). Applies to new **and** changed objects. The whole repo is English-only: code comments, the parameter-doc block, and the emitted message texts are all English.
- **Separate variables (MANDATORY):** `l_error_message text` for the message and `l_error_code text` for the error code (both in the DECLARE block). No inline text at the `RAISE`.
- **Message via `format($$…$$, v1, v2, …)`:** dollar quoting (`$$…$$`) as the template delimiter — this keeps the single quotes around text values **single** (`'%2$s'` instead of `''%2$s''`). Safe inside the procedure body because it quotes with `$procedure$…$procedure$`; only if a message must literally contain `$$` use a named tag like `$msg$…$msg$` (edge case).
- **Indexed placeholders only:** `%1$s`, `%2$s`, `%3$s`, … — **never** the bare `%`. Applies throughout, even when each argument appears only once; indispensable as soon as an argument appears multiple times in the message (`%n$s` references the same argument in multiple places without passing it again).
- **Text values in single quotes** in the message (`'%2$s'`), so that string values (names, e-mails, identifiers) are visually set apart. **Numeric values** (`bigint`, `int`, …) without quotes. **Exception: the component prefix** (`l_component`, up front as a label) is **not** quoted.
- **`RAISE EXCEPTION USING MESSAGE = …, ERRCODE = …;` on a single line** — it takes only the variables, no `'%'` placeholder, no inline string.
- **Preserve the ERRCODE, never invent one:** take the existing ERRCODE over exactly. If a `RAISE EXCEPTION` had **no** ERRCODE in the original, it stays without one — `RAISE EXCEPTION USING MESSAGE = l_error_message;` (no `l_error_code`, no newly invented code).

### Example

```sql
DECLARE
   l_component       text;
   l_error_message   text;
   l_error_code      text;
   -- ...
BEGIN
   -- ...
   IF NOT l_can_edit THEN
      l_error_message := format($$%1$s: actor='%2$s' is neither owner nor editor of project id=%3$s$$, l_component, p_actor_email, l_project_id);
      l_error_code    := 'insufficient_privilege';

      RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
   END IF;
```

(`l_component` = component prefix → not quoted; `p_actor_email` = text value → `'%2$s'`; `l_project_id` = numeric → `%3$s` without quotes.)

## Single Responsibility

- Each `CALL` statement delegates exactly **one** domain action to an `sp_` procedure
- One procedure = one responsibility (e.g. update status, set map access)

## Skeleton (stored procedure)

```sql
\echo "## CREATE PROCEDURE :schema_name.sp_upd_table_status"

DROP PROCEDURE IF EXISTS :schema_name.sp_upd_table_status(varchar, bigint);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_parameter1        varchar
--       <meaning of p_parameter1>
--    p_parameter2        bigint
--       <meaning of p_parameter2>
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_name.sp_upd_table_status
(
    INOUT p_parameter1        varchar
   ,IN    p_parameter2        bigint
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
   -- --------------------------------------------------------------------------------
   -- Common
   -- --------------------------------------------------------------------------------
   l_context                 varchar;
   l_component               varchar;
   l_source                  varchar(7);

   -- --------------------------------------------------------------------------------
   -- Error Handling
   -- --------------------------------------------------------------------------------
   l_error_message           text;
   l_error_code              text;
BEGIN
   -- --------------------------------------------------------------------------------
   -- Get name of function/procedure
   -- --------------------------------------------------------------------------------
   SET LOCAL lc_messages TO 'C';   -- forces English server messages for this transaction
   GET DIAGNOSTICS l_context = PG_CONTEXT;
   l_component := substring(l_context from 'function (.*?)\(');
   l_source    := 'plpgsql';

   RAISE NOTICE '### procedure : %', l_component;

   -- --------------------------------------------------------------------------------
   -- Check parameter
   -- --------------------------------------------------------------------------------
   BEGIN
      -- all entry/guard checks (parameter validation, actor context, permission).
      -- violation -> error via separate variables + format($$…$$):
      -- l_error_message := format($$%1$s: example error for id=%2$s$$, l_component, p_parameter2);
      -- l_error_code    := 'invalid_parameter_value';
      -- RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      NULL;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN
      -- the actual work (lookups, mutations)
      NULL;
   END;

END;
$procedure$;

ALTER PROCEDURE :schema_name.sp_upd_table_status(varchar, bigint) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_name.sp_upd_table_status - DONE"
```
