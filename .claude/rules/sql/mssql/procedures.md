# Rule: Procedures (SQL Server 2022 / T-SQL)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **For cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> `sp_<verb>_<entity>`, parameter prefix `@p_`, variables `@l_`, `SET NOCOUNT ON`, semicolon
> discipline, tabular alignment, file skeleton `PRINT` header/footer + `GO` batches, File Naming &
> Numbering). **On conflict, sql.md wins.** The **procedure-specific** rules (parameter order,
> parameter documentation, body structure, error messages, Single Responsibility, skeleton) live
> **here** in this file.
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable. sqlcmd
> substitutes `$(var)` textually before the batch is sent, so the variables work **inside**
> procedure bodies too — never hardcode a schema name (difference from the PostgreSQL ruleset,
> which must hardcode inside dollar-quoted bodies).

## Framework-specific
- **Location:** one script per procedure under
  `db/schemas/<schema>/procedures/<NNN>.sp_<verb>_<entity>.sql`. `<NNN>` = number of the **main
  table** that the procedure describes (cross-table heuristic see sql.md).
- **Idempotency:** `CREATE OR ALTER PROCEDURE` — no `DROP` needed for a re-deploy (a rename or
  removal still needs an explicit `DROP PROCEDURE IF EXISTS` change-set entry).
- **Integrate logging:** create the component at the start, update it on success/failure at the
  end; trace likewise; data errors go to `log.error`; set the status deterministically in the
  `CATCH` block.
- **Dynamic SQL** (the core job of `etl`): values **always** as real parameters via
  `sys.sp_executesql`, dynamic identifiers **always** through `QUOTENAME()` — never string
  concatenation of inputs. For the **string layout** of the built statement (hanging block under
  the first keyword) see [sql.md → Dynamic SQL (`sp_executesql`)](sql.md#dynamic-sql-sp_executesql--string-layout).
- **Execution context:** keep the default `EXECUTE AS CALLER` (the T-SQL mirror of "no
  `SECURITY DEFINER`"). `EXECUTE AS OWNER` / `EXECUTE AS SELF` only with a documented rationale.
- **No `lc_messages` equivalent needed:** the component name comes from `@@PROCID` (see
  [Body structure](#body-structure-get-name--check-parameter--workload)) — no context-string
  parsing, no special grant. If English server messages matter for log parsing, set the login's
  default language to `us_english` instead of per-procedure `SET LANGUAGE` calls.

## Parameter order (ID first)

If a procedure/function addresses a **record via its identifier** (`@p_id` — generally the primary
key/identifier of the affected record) and **additionally takes attribute parameters** (name,
text/name field, …), then the signature order follows:

- **The identifier parameter ALWAYS comes first**, followed by the attribute fields — in the order
  in which the associated table first **identifies** the record and then **describes** it. This
  mirrors the statement logic of the procedures: `WHERE id = @p_id` identifies the row first,
  after which the attribute columns are read/set.
- Applies to all verbs: `del`/`get` often have only `@p_id`; `upd` has `@p_id` + attributes;
  **`ins`** carries the `id` as an **`OUTPUT` parameter** (T-SQL's in/out mode — the equivalent of
  PL/pgSQL `INOUT`), returning the newly assigned surrogate key via `SCOPE_IDENTITY()` — it still
  comes **before** the attribute fields. The rule "identifier first" takes precedence here over
  the otherwise usual ordering "inputs before outputs".
- Multiple identifiers (composite/cross-table keys): all identifier parameters first (in order of
  their identification depth), followed by the attribute fields.

```sql
-- correct: identifier (@p_id) before attribute (@p_name) — even when @p_id is OUTPUT on INSERT
CREATE OR ALTER PROCEDURE $(schema_config).sp_ins_process
(
    @p_id            bigint          OUTPUT
   ,@p_name          nvarchar(200)
)
```

## Parameter documentation (inline block before `CREATE`)

> **Mandatory for every procedure/function with parameters** — the bare signature is not enough,
> especially with long parameter lists.

**Between the head `PRINT` batch and `CREATE OR ALTER …`** (i.e. directly before the `CREATE`, at
the start of its batch — the block belongs to the `CREATE` batch, after the preceding `GO`) there
is a comment block that documents each parameter. It is structured as a banner block: a 3-line
`-- Parameter` header, the entries, closed by **one more separator line directly before `CREATE`**.

- **Header/footer:** the same banner separator line as everywhere else (`--` + space + 80 `-`);
  label `Parameter`.
- **Two lines per parameter:**
  - **Line 1 — name + type:** `--` + **4 spaces**, then `@p_<name>`, then the alignment spaces +
    `<type>`. Name and type are copied **1:1 from the signature** — the leading comma is dropped
    (T-SQL has no `IN` mode keyword; the `OUTPUT` keyword is copied along where present); the
    types thereby line up below one another as in the signature.
  - **Line 2 — description:** `--` + **7 spaces** (= 3 characters more indented than the name),
    then the description text (the parameter's domain meaning).
- The order of entries = the order of the signature (i.e. identifier first, see
  [Parameter order](#parameter-order-id-first)).

```sql
-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    @p_id            bigint
--       Identifier of the affected process record
--    @p_name          nvarchar(200)
--       Name of the process
-- --------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE $(schema_config).sp_upd_process
(
    @p_id            bigint
   ,@p_name          nvarchar(200)
)
```

## Body structure: Get name / Check parameter / Workload

> Every procedure body is divided into three fixed sections, each introduced by an 80-dash banner.
> **Difference from the PostgreSQL ruleset:** the sections are **not** wrapped in extra
> `BEGIN … END` sub-blocks — T-SQL gains nothing from them (no block-local `DECLARE` scoping; an
> empty `BEGIN END` is a syntax error), so the 3-line banners alone carry the structure.

1. **`Get name of function/procedure`** — resolve the component name from the catalog:
   `SET @l_component = OBJECT_SCHEMA_NAME(@@PROCID) + N'.' + OBJECT_NAME(@@PROCID);`
   (+ an optional `PRINT` entry trace). No context-string parsing and no `lc_messages` grant —
   `@@PROCID` is always available.
2. **`Check parameter`** — **all entry/guard checks at the start** (parameter validation, actor
   context, permission preconditions). Violation → error via the
   [`FORMATMESSAGE()`/`THROW` pattern](#error-messages--formatmessage--throw) below.
3. **`Workload`** — the actual work (lookups, mutations, `OUTPUT` assignment).

**Order is mandatory:** guards come before the mutation — the `Check parameter` section always
comes before the `Workload` section. When refactoring existing procs, the order of
security-relevant checks (permission!) must **never** slip behind the mutation.

**Refactoring method (no reordering):** there is exactly **one boundary** between the pure
entry-validation prefix and the first lookup/work statement. The banners are inserted **in
place** — statements are **never** moved relative to one another. If guards and lookups are
interleaved (e.g. a permission check needs a previously fetched `project_id`), the boundary lies
after the last pure entry check; all lookup-dependent checks stay in the `Workload` section.
Prefer a smaller `Check parameter` section over a risky reordering.

Pure validator helpers without an error `THROW` (e.g. small `fn_validate_*` functions that only
return marker values) omit the `Get name` section; the `Check parameter`/`Workload` split is
optional there (see [functions.md](functions.md)).

## Error messages & `FORMATMESSAGE()` / `THROW`

Every message and every error number passed to `THROW` is **placed into separate variables first**
and only then emitted. **Exception:** diagnostic `PRINT` traces (the `### procedure : %` entry
trace and an `ERROR_MESSAGE()` trace in a `CATCH` block) stay as plain inline `PRINT` — they are
debug breadcrumbs, not structured error messages. Rationale: no hardcoded texts directly at the
`THROW` — the code reads top to bottom (first *what* is thrown, then *that* it is thrown), and the
`THROW` only gets variables.

### Rules

- **Language (MANDATORY): English.** All error messages passed to `THROW` (or to a `RAISERROR`
  that gives a real message to the client) are written in **English** (project-wide
  operations/monitoring consistency). Applies to new **and** changed objects. The whole repo is
  English-only: code comments, the parameter-doc block, and the emitted message texts are all
  English.
- **Separate variables (MANDATORY):** `@l_error_message nvarchar(2048)` for the message and
  `@l_error_number int` for the error number (both in the `DECLARE` block, group
  `-- Error Handling`). No inline text at the `THROW`.
- **Message via `FORMATMESSAGE(N'…', v1, v2, …)`** — printf-style placeholders. T-SQL supports
  **no** indexed placeholders (`%1$s` does not exist): arguments are consumed **in order**; if a
  value appears multiple times in the message, pass it multiple times.
- **Placeholder types:** `%s` for strings, `%d` for `int`. **`bigint` values use `%I64d`** — a
  plain `%d` is int-only and fails/truncates on `bigint` arguments.
- **Text values in single quotes** in the message (`'%s'` — inside the `N'…'` literal that is
  `''%s''`), so that string values (names, e-mails, identifiers) are visually set apart.
  **Numeric values** (`%d` / `%I64d`) without quotes. **Exception: the component prefix**
  (`@l_component`, up front as a label) is **not** quoted.
- **`THROW @l_error_number, @l_error_message, 1;` on a single line** — it takes only the
  variables, no inline string. **Semicolon discipline:** the statement *before* a `THROW` must be
  `;`-terminated, otherwise the parser reads `THROW` as a column alias (see sql.md — this is the
  classic silent T-SQL bug).
- **Error numbers:** user-defined `THROW` numbers must be **≥ 50000**; default to `50000` when no
  finer classification exists. **Preserve existing numbers, never invent:** when porting/refactoring,
  take the existing error number over exactly. (PostgreSQL's named `ERRCODE`s have no T-SQL
  equivalent — the classification, e.g. `insufficient_privilege`, goes into the message text
  instead.)

### Example

```sql
   IF @l_can_edit = 0
   BEGIN
      SET @l_error_message = FORMATMESSAGE(N'%s: actor=''%s'' is neither owner nor editor of project id=%I64d', @l_component, @p_actor_email, @l_project_id);
      SET @l_error_number  = 50000;

      THROW @l_error_number, @l_error_message, 1;
   END;
```

(`@l_component` = component prefix → not quoted; `@p_actor_email` = text value → `''%s''`;
`@l_project_id` = `bigint` → `%I64d` without quotes.)

## Single Responsibility

- Each `EXEC` statement delegates exactly **one** domain action to an `sp_` procedure.
- One procedure = one responsibility (e.g. update status, set map access).

## Skeleton (stored procedure)

```sql
PRINT '## CREATE PROCEDURE $(schema_name).sp_upd_table_status';
GO

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    @p_id            bigint
--       Identifier of the affected table record
--    @p_status        nvarchar(50)
--       New status value
-- --------------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE $(schema_name).sp_upd_table_status
(
    @p_id            bigint
   ,@p_status        nvarchar(50)
)
AS
BEGIN
   SET NOCOUNT ON;

   -- --------------------------------------------------------------------------------
   -- Common
   -- --------------------------------------------------------------------------------
   DECLARE @l_component             nvarchar(300);

   -- --------------------------------------------------------------------------------
   -- Error Handling
   -- --------------------------------------------------------------------------------
   DECLARE @l_error_message         nvarchar(2048);
   DECLARE @l_error_number          int;

   -- --------------------------------------------------------------------------------
   -- Get name of function/procedure
   -- --------------------------------------------------------------------------------
   SET @l_component = OBJECT_SCHEMA_NAME(@@PROCID) + N'.' + OBJECT_NAME(@@PROCID);

   PRINT N'### procedure : ' + @l_component;

   -- --------------------------------------------------------------------------------
   -- Check parameter
   -- --------------------------------------------------------------------------------
   -- all entry/guard checks (parameter validation, actor context, permission).
   -- violation -> error via separate variables + FORMATMESSAGE():
   -- SET @l_error_message = FORMATMESSAGE(N'%s: example error for id=%I64d', @l_component, @p_id);
   -- SET @l_error_number  = 50000;
   -- THROW @l_error_number, @l_error_message, 1;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   -- the actual work (lookups, mutations)

END;
GO

PRINT '## CREATE PROCEDURE $(schema_name).sp_upd_table_status - DONE';
GO
```
