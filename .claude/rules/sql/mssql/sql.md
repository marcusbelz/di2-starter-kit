# SQL rules

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/) — same conventions where they carry over, adapted where the T-SQL
> dialect differs (no dollar-quoting, `IDENTITY` instead of `GENERATED ALWAYS AS IDENTITY`, sqlcmd
> `$(var)` instead of psql `:var`, `FORMATMESSAGE()`/`THROW` instead of `format()`/`RAISE`). Written
> for **SQL Server 2022** and deployed via **sqlcmd** scripts. `/init` keeps only the chosen vendor
> directory. Overview: [README](../README.md).

> **Cross-cutting** SQL styleguide (naming, alignment, file-numbering, generic layout principles).
> The **object-specific** rules are separated out into the respective object files — see
> [Object-specific rules (separated out)](#object-specific-rules-separated-out) at the end.

- [SQL](#sql)
  - [Naming conventions](#naming-conventions)
    - [Prefixes](#prefixes)
    - [Placeholder](#placeholder)
    - [Module bodies & batches](#module-bodies--batches)
    - [Common](#common)
    - [Examples](#examples)
    - [Tabular alignment (parameters, variables, JOINs)](#tabular-alignment-parameters-variables-joins)
  - [File Naming & Numbering](#file-naming--numbering)
  - [Layout & formatting (DDL/DML)](#layout--formatting-ddldml)
- [Object-specific rules (separated out)](#object-specific-rules-separated-out)

# SQL

## Naming conventions

### Prefixes
| Object type        | prefix  | example                |
|--------------------|---------|------------------------|
| Stored Procedure   | `sp_`   | `sp_upd_table`         |
| Stored Function    | `fn_`   | `fn_is_null_or_empty`  |
| Trigger            | `tr_`   | `tr_u_table`           |
| View               | `vw_`   | `vw_execution_duration`|
| Security policy    | `sec_`  | `sec_error`            |

> **Note on the `sp_` prefix:** SQL Server treats `sp_`-prefixed names **in the `dbo`/`master`
> scope** specially (system-procedure name resolution). The kit's procedures always live in
> dedicated schemas (never `dbo`) and are always called **schema-qualified**
> (`EXEC config.sp_ins_process …`), which sidesteps that resolution path — the prefix is kept for
> cross-vendor consistency with the PostgreSQL ruleset. Never create `sp_` procedures in `dbo`.
>
> **No trigger-function tier:** T-SQL has no separate trigger functions — the body lives in the
> trigger object itself, so there is no `tf_` prefix in this ruleset (see [trigger.md](trigger.md)).

### Placeholder

#### `<entity>`  : name of the main table the procedure deals with

#### `<verb>` :
  - `upd` = update
  - `ins` = insert (the data-quality check family `sp_ins_error_*` also runs under `ins`,
    entity `error` — the dominant statement is `INSERT INTO log.error` per detected violation)
  - `del` = delete
  - `dup` = duplicate (copy a row to a new row, picking a new surrogate key — used for "save as" /
    "duplicate" UX flows; e.g. `sp_dup_project`)
  - `get` = select
  - `check` = check (ETL: runs all configured data-quality check rules for a source;
    e.g. the config-driven dispatcher `sp_check_data`)
  - `load` = load (ETL: full load of a target table from a source; e.g. `sp_load_data`)

#### `<type>`:
  - `i`   = insert
  - `u`   = update
  - `d`   = delete
  - `iud` = combination of types

### Module bodies & batches

> Replaces the PostgreSQL "Dollar quoting" section — T-SQL has no dollar-quoting; a module body is
> everything between `AS` and the end of the batch.

- **One object per file, one `CREATE OR ALTER` per batch.** `CREATE OR ALTER
  PROCEDURE|FUNCTION|VIEW|TRIGGER` must be the first statement of its batch — the `PRINT` header /
  footer and the object definition are therefore separated by **`GO`** batch separators (see the
  file skeleton below).
- **Terminate every statement with `;`.** Mandatory, not style: an unterminated statement directly
  before `THROW` makes the parser read `THROW` as a column alias — a classic silent bug.
- **`SET NOCOUNT ON;`** is the first statement of every procedure and trigger body (suppresses
  `n rows affected` chatter that breaks some clients and bloats logs).
- Body strings are `N'…'` Unicode literals; escape embedded quotes by doubling (`''`).

### Common
- ALWAYS **snake_case** — deliberately kept from the kit-wide convention (no PascalCase), so the
  naming is identical across vendors.
- **Bracket-quote reserved keywords used as identifiers (`[precision]`, `[value]`, `[version]`, …)
  only where the T-SQL grammar forces it — otherwise leave them unquoted.** Never wrap every
  identifier in `QUOTENAME`-style brackets "to be safe"; superfluous brackets hide the one place
  where quoting is actually load-bearing.
- Schema name always via the **sqlcmd variable**, never hardcoded — `$(schema_config)` /
  `$(schema_etl)` / `$(schema_helper)` / `$(schema_log)`, schema owner `$(schema_owner)` (set via
  `:setvar` in `db/config/*.env.sql`-equivalents; in the examples below `$(schema_name)` stands in
  for the concrete variable).
  - **Difference from PostgreSQL:** sqlcmd substitutes `$(var)` **textually before the batch is
    sent** — it works everywhere, **including inside procedure/function/trigger bodies**. There is
    no "hardcoded schema names inside dollar-quoting" exception in this ruleset: bodies use
    `$(schema_x)` too.
- ALWAYS use **singular** table names (`user`, `project`, `task` — never `users`, `projects`,
  `tasks`). Foreign-key column names follow naturally (`user_id`, not `users_id`).
- ALWAYS suffix timestamp columns with **`_on`**, never `_at` (`created_on`, `modified_on`,
  `deleted_on`, `last_login_on`). The TypeScript camelCase mapping uses the same suffix
  (`createdOn`, `lastLoginOn`).
- ALWAYS give each table a surrogate primary key column **`id bigint NOT NULL IDENTITY(1,1)`** with
  `CONSTRAINT pk_<table> PRIMARY KEY (id)`. **NEVER** use `uniqueidentifier`/`NEWID()` as the
  default PK choice, and never rely on `@@IDENTITY` (trigger-unsafe) — retrieve new keys with
  `SCOPE_IDENTITY()` (or an `OUTPUT INSERTED.id` clause). `IDENTITY` blocks accidental manual `id`
  inserts (only `SET IDENTITY_INSERT` can override — never used in application code). Natural keys
  (composite or otherwise) become **`UNIQUE` constraints**, not the PK. External identifiers live in
  their own `UNIQUE` column (e.g. `external_ref nvarchar(200) UNIQUE NOT NULL`), separate from the
  surrogate `id`.
- ALWAYS store **the email address of the authenticated app user** in the audit columns
  `created_by` and `modified_by` — never a `DEFAULT` of `SUSER_SNAME()` / `ORIGINAL_LOGIN()` /
  `CURRENT_USER`. The application supplies the email explicitly, either via a stored-procedure
  parameter (`@p_actor_email nvarchar(100)`) or via the per-session context
  (`EXEC sys.sp_set_session_context @key = N'actor_email', @value = …;` +
  `CAST(SESSION_CONTEXT(N'actor_email') AS nvarchar(100))`). The architecture step decides per
  feature which mechanism. The connection login is **not** an acceptable substitute — it is always
  the pooled runtime login, useless for app-level audit.
- ALWAYS prefix stored-procedure and stored-function parameters with **`@p_`** (e.g.
  `@p_project_id`, `@p_actor_email`) and local variables with **`@l_`** (e.g. `@l_component`,
  `@l_error_message`). Direction is carried by the `OUTPUT` keyword, not encoded in the name
  (`@p_result`, not `@p_out_result`).
- `RETURNS` clause on a separate line (functions).
- indentation: **3 white spaces** within
  - `BEGIN`/`END`
  - `IF`/`ELSE`
  - `SELECT`/`FROM`/`WHERE`/`GROUP BY`/`HAVING`
- indentation: **3 white spaces** after
  - `WHILE`

### Examples
- procedure names : `sp_<verb>_<entity>` (e.g. `sp_upd_table`)
- function names  : `fn_<verb>_<name>`   (e.g. `fn_is_null_or_empty`)
- trigger names   : `tr_<type>_<entity>` (e.g. `tr_u_table`, `tr_iud_table`)
- view names      : `vw_<name>`          (e.g. `vw_errors_by_table`)
- policy names    : `sec_<entity>`       (e.g. `sec_error`; predicate function `fn_<entity>_predicate`)

### Tabular alignment (parameters, variables, JOINs)

> Same principle as the PostgreSQL ruleset: sub-columns (name, type) align tabularly at a common
> column = longest identifier of the block + spacing; longer identifiers overflow (they break the
> alignment only for their own line). Base indentation is **3 spaces** app-wide.

**Procedure/function parameters** (in the `( … )` signature):

- `(` and `)` each on their own line (T-SQL allows the parenthesized form — use it, for parity with
  the table/procedure layout).
- First element **4 spaces** indentation; following elements **3 spaces + leading `,`** → the
  parameter name sits at **column 5** in both cases.
- T-SQL has no `IN` keyword — the name column starts immediately; the **type** aligns at a common
  column (longest parameter name + spacing), and the **`OUTPUT`** keyword (where present) aligns at
  a common column **after** the types.

```sql
CREATE OR ALTER PROCEDURE $(schema_name).sp_example
(
    @p_source_table_id           bigint
   ,@p_actor_email               nvarchar(100)
   ,@p_result                    nvarchar(max)   OUTPUT
)
```

**Variable declarations** (`DECLARE` block at the top of the body):

- One `DECLARE` per variable, **3 spaces** indentation → `DECLARE` at column 4, variable name in a
  fixed column behind it, data type aligned at a common column.
- With more than a handful of variables, group the declarations under **3-line banner sub-headers**
  (same banner form as the section comments) — fixed order, empty groups omitted:
  1. `-- Common` — infrastructure variables (`@l_component`, …).
  2. `-- Error Handling` — `@l_error_message`, `@l_error_number`.
  3. `-- Workload` — the domain working variables (lookups, intermediate results).

```sql
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
   -- Workload
   -- --------------------------------------------------------------------------------
   DECLARE @l_name                  nvarchar(200);
```

**JOINs**:

- Always fully qualified: **`INNER JOIN`** instead of a bare `JOIN`; likewise write out
  `LEFT JOIN` / `RIGHT JOIN` / `FULL JOIN`.
- **Positional table aliases** (`T01`, `T02`, `T03`, …) for **every aliased table reference** —
  JOIN, single-table `FROM`, `UPDATE … FROM`, CTE correlation, subquery, and the `inserted` /
  `deleted` pseudo-tables in triggers —, numbered in order of appearance **within the respective
  statement** (restarting at `T01` per statement). Unaliased single-table refs may stay without an
  alias. Equal-length `T0n` aliases keep the tabular column alignment that descriptive aliases of
  varying length would break.
- `ON` on its own line, aligned **under the `INNER`** (same column as `INNER JOIN` and the `FROM`
  table).
- **One** join condition: **2 spaces** indented under `ON`.
- **Multiple** conditions: `AND`/`OR` river like in `WHERE` (leading `AND`/`OR`, conditions
  aligned, comparison `=` lined up).

```sql
FROM
   $(schema_log).component T01
   INNER JOIN $(schema_log).execution T02
   ON
     T02.id = T01.execution_id
WHERE
       T01.execution_id = @l_execution_id
   AND T02.status       = N'running'
```

## File Naming & Numbering

Every DDL file under `db/schemas/<schema>/<objecttype>/` carries a **3-digit number prefix** before
the object name, e.g. `003.sp_ins_execution.sql`. The prefix is **not a global, sequential
counter**, but a **table-group indicator** (assigned per schema). The number is orthogonal to the
subfolders: the same `003` appears in `tables/`, `procedures/`, `functions/`, `views/`, `trigger/`,
etc. — for every object that describes table `003`.

### Rule

- **One table = one number.** All DDL objects belonging to the same table (the table itself, its
  security policy, triggers, procedures, data seed) carry the same prefix.
- **Numbers are assigned in the order tables enter the schema.** Once assigned, never reassigned —
  even if a table becomes obsolete.
- **Disambiguation happens via the object-name suffix**, not via the number.
  `003.sp_ins_project.sql` and `003.sp_upd_project.sql` deliberately have the same prefix.

### Cross-table objects (procedure / function touching multiple tables)

Choose the prefix by this heuristic (in this order):

1. **Trigger** → prefix of the table the trigger is attached to (the table named in the `ON`
   clause), regardless of which tables the body writes to.
2. **Procedure with a clear write target** → prefix of that table. Reads from other tables
   (lookups, `UPDLOCK` reads for defense-in-depth) are accompanying operations and do not count.
3. **Symmetric cross-table operation** (equally weighted writes to two unrelated tables) → the
   **higher** of the two group numbers, so both target tables already exist at include time. Rare
   in practice — usually one table can be identified as the driver.

**Mandatory:** the file's `--comment:` header names every cross-table relationship explicitly, so a
searcher finds via `grep` — and not only via prefix filter — what touches another table.

### Why this convention (instead of a global sequence)

Deliberately **not** a global `001., 002., 003., …` counter across all procedures:

1. **Co-location per table.** `ls 007.*` shows all objects of a table at a glance — a driver for
   reviews and refactors.
2. **No renumbering tax.** New procedure for `project_member`? The file is named
   `004.sp_new_procedure.sql`, done — no 20 other files have to be renamed.
3. **Section ordering in the deploy runner (`db/scripts/`) already resolves dependencies.** Tables →
   Policies → Functions → Procedures → Triggers → Views → Data are loaded in separate blocks.
   Within a block the order usually doesn't matter.

### Single Source of Truth

The load order is determined by the **deploy runner** (`db/scripts/`): by section (Tables →
Policies → Functions → Procedures → Triggers → Views → Data), within the section by number. **The
number is a sort helper + table-group indicator, not a global sequence.**

## Layout & formatting (DDL/DML)

> Complements the [Tabular alignment](#tabular-alignment-parameters-variables-joins) with the file
> and statement structure. Base indentation **3 spaces** app-wide.

### File skeleton

- **Head:** first line `PRINT '## CREATE <KIND> $(schema_name).<name>';` followed by `GO`
  (`<KIND>` = TABLE / PROCEDURE / FUNCTION / TRIGGER / VIEW / POLICY / SEED / BACKFILL).
- **Foot:** `PRINT '## CREATE <KIND> $(schema_name).<name> - DONE';` followed by `GO`.
- **Idempotency by object kind:**
  - Procedures / functions / views / triggers: **`CREATE OR ALTER`** — no `DROP` needed for a
    re-deploy (a **rename or removal** still needs an explicit `DROP … IF EXISTS` change-set entry).
  - Tables: `IF OBJECT_ID(N'$(schema_name).<table>', N'U') IS NULL BEGIN CREATE TABLE … END;`
    (T-SQL has no `CREATE TABLE IF NOT EXISTS`).
  - Security policies: `DROP SECURITY POLICY IF EXISTS …;` before `CREATE SECURITY POLICY` (see
    [policies.md](policies.md) for the drop-order caveat with predicate functions).
- **Batches:** `GO` after the head `PRINT`, after each object definition, and before the foot
  `PRINT` — `CREATE OR ALTER` must open its batch.
- **Parameter block:** for procedures/functions **with parameters**, the `-- Parameter` doc block
  sits directly **before** `CREATE OR ALTER …` — see
  [Parameter documentation in procedures.md](procedures.md#parameter-documentation-inline-block-before-create).
- **No per-object `OWNER TO`:** SQL Server objects belong to their **schema**; ownership is set
  once per schema in `db/database/` via `ALTER AUTHORIZATION ON SCHEMA::<schema> TO <owner>;`.
  There is no per-file owner statement (difference from the PostgreSQL ruleset).
- **No description footer banner:** procedures/functions carry **no** feature-ID description block
  at the file end — the domain description lives in the external documentation. Tables are exempt:
  the extended-property description block from [tables.md](tables.md) applies there.

### Inline comment blocks (section comments)

Grouping section comments in the script body — e.g. `-- Unique constraints` / `-- Foreign keys`
after the table as well as the `Get name` / `Check parameter` / `Workload` sections in the
procedure body — are **always** written as a **3-line banner block**: separator line · label ·
separator line. The **separator line** is `--`, **one space**, then **exactly 80** `-` characters
(line length 83). In indented blocks (procedure body), the base indentation (3 spaces) precedes
each of the three lines.

```sql
-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
```

### Parentheses on their own line

`(` and `)` each go on their own line for: CREATE TABLE, procedure/function signature, INSERT
column list, `VALUES`, CTE body, multi-line subqueries (`EXISTS (` / `NOT EXISTS (`).

**Exception — trivial constant bodies stay single-line:** short scalar defaults
(`DEFAULT (1)`, `DEFAULT (sysdatetimeoffset())`) and one-condition checks. Only when the body is a
real expression/subquery do `(`/`)` go on their own lines.

### SELECT / DML — vertical layout

- `SELECT` / `FROM` / `WHERE` / `GROUP BY` / `ORDER BY` each on their own line at statement level.
- Lists (select list, column list) indented below with leading comma; the first element one space
  deeper so it lines up with the comma elements.
- Variable assignment inside a query uses the `SELECT @l_x = col …` form; multiple assignments as a
  leading-comma list like a select list.
- `FROM` table on its own indented line; JOINs see
  [Tabular alignment → JOINs](#tabular-alignment-parameters-variables-joins).
- `WHERE`: `AND`/`OR` river (leading `AND`/`OR`, conditions aligned, `=` lined up).
- Short subqueries / function calls may be single-line
  (`NOT EXISTS (SELECT 1 FROM … WHERE …)`, `SET @l_x = app.fn_y(@a, @b);`).

```sql
SELECT
    @l_is_active     = is_active
   ,@l_connection_id = connection_id
FROM
   app.source_table_selection
WHERE
   id = @p_source_table_id;
```

### CTE

`WITH` on its own line (the preceding statement **must** be `;`-terminated — enforced anyway by the
semicolon rule); CTE name with `CTE_` prefix; `AS` then `(` on its own line.

```sql
WITH
CTE_effective_states AS
(
   SELECT
      ...
)
SELECT
   ...
FROM
   CTE_effective_states;
```

### Dynamic SQL (`sp_executesql`) — string layout

> Applies to write/read statements built dynamically in the procedure body. Values are **always**
> passed as real parameters via `sys.sp_executesql` (never concatenated into the string);
> identifiers that must be dynamic go through **`QUOTENAME()`**. This is the T-SQL equivalent of
> the PostgreSQL `format()` `%I`/`%L` rule.

The dynamic SQL string is set as a **hanging block** aligned **under its first keyword** — the
embedded statement reads as a coherent, aligned block:

- **Opening `N'` + first keyword on the assignment line** (`SET @l_sql = N'INSERT …`) — T-SQL
  string literals may span lines, so the statement continues as a multi-line literal.
- **All following lines of the statement align under the first keyword.** Structural
  keywords/parentheses (`(`, `)`, `VALUES`, `SET`, `WHERE`, `OUTPUT`, …) sit on this keyword column.
- **List elements** (column list, `VALUES`, `SET` assignments, `WHERE` conditions) **one level
  (4 spaces) deeper**, each on its own line with a **leading comma or leading `AND`**.
- **Closing `';` on its own line**, aligned under the opening `N'`.
- The `sys.sp_executesql` call follows with the parameter-definition string and the arguments as a
  leading-comma list.

```sql
SET @l_sql = N'INSERT INTO $(schema_log).execution
               (
                   process_id
                  ,start_on
                  ,state
                  ,success
               )
               VALUES
               (
                   @process_id
                  ,@start_on
                  ,N''processing''
                  ,0
               )
              ';

EXEC sys.sp_executesql
    @l_sql
   ,N'@process_id bigint, @start_on datetimeoffset(3)'
   ,@process_id = @p_process_id
   ,@start_on   = @l_start;
```

# Object-specific rules (separated out)

sql.md is the **cross-cutting** styleguide (naming, alignment, file-numbering, generic layout
principles). The **object-specific** rules live in the respective object files — look them up
there, depending on what is being built. Each object file refers back to sql.md for the
cross-cutting parts; **on conflict, sql.md wins.**

| Object type | Rule file | contains among others |
|---|---|---|
| Tables | [tables.md](tables.md) | CREATE-TABLE layout, foreign keys / unique, descriptions (extended properties), INSERT/seed, data types, audit columns, RLS |
| Procedures | [procedures.md](procedures.md) | Parameter order (ID first), parameter documentation, body structure, error messages & `FORMATMESSAGE()`/`THROW`, Single Responsibility, procedure skeleton |
| Functions | [functions.md](functions.md) | Function skeleton, scalar vs. inline TVF, determinism; shared body rules via reference to procedures.md |
| Triggers | [trigger.md](trigger.md) | Trigger skeleton, set-based `inserted`/`deleted` logic, recursion guard |
| Views | [views.md](views.md) | View conventions, indexed views |
| Policies / RLS | [policies.md](policies.md) | Security policies (FILTER/BLOCK predicates) |
