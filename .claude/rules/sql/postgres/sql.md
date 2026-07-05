# SQL rules

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/` (e.g.
> `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **Cross-cutting** SQL styleguide (naming, alignment, file-numbering, generic layout principles).
> The **object-specific** rules are separated out into the respective object files — see
> [Object-specific rules (separated out)](#object-specific-rules-separated-out) at the end.

- [SQL](#sql)
  - [Naming conventions](#naming-conventions)
    - [Prefixes](#prefixes)
    - [Placeholder](#placeholder)
    - [Dollar quoting](#dollar-quoting)
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
| Trigger Function   | `tf_`   | `tf_upd_table`         |
| Trigger            | `tr_`   | `tr_iu_table`          |
| View               | `vw_`   | `vw_execution_duration`|

### Placeholder

#### `<entity>`  : name of the main table the procedure deals with

#### `<verb>` :
  - `upd` = update
  - `ins` = insert (the data-quality check family `sp_ins_error_*` also runs under `ins`,
    entity `error` — the dominant statement is `INSERT INTO log.error` per detected violation)
  - `del` = delete
  - `dup` = duplicate (copy a row to a new row, picking a new surrogate key — used for "save as" / "duplicate" UX flows; e.g. `sp_dup_project`)
  - `get` = select
  - `check` = check (ETL: runs all configured data-quality check rules for a source;
    e.g. the config-driven dispatcher `sp_check_data`)
  - `load` = load (ETL: full load of a target table from a source; e.g. `sp_load_data`)

#### `<type>`:
  - `i`   = insert
  - `u`   = update
  - `d`   = delete
  - `iud` = combination of types

### Dollar quoting
| Object type        | Dollar Quoting     |
|--------------------|--------------------|
| stored procedure   | `$procedure$`      |
| stored function    | `$function$`       |
| trigger function   | `$triggerfunction$`|
| trigger            | `$trigger$`        |

### Common
- ALWAYS **snake_case**
- **Double-quote reserved keywords used as identifiers (`precision`, `value`, `version`, …) only where PostgreSQL's grammar forces it — otherwise leave them unquoted.** Known mandatory case: the **`RETURNS TABLE (…)` column list** of a function (and `OUT` parameter names). There, an unquoted type keyword like `precision` throws `syntax error at or near "precision"`, so it must be `"precision"` (see `config.fn_get_table_definition`). The **same** word as a normal `CREATE TABLE` column, as a column alias, or as a qualified reference (`T01.precision`) is accepted unquoted and must **not** be quoted (otherwise superfluous quoting). Lint: this one mandatory quote is exempted from sqlfluff **RF06** via `.sqlfluff` `ignore_words = precision` — do **not** use `prefer_quoted_keywords` (it inverts RF06 and forces quoting for *every* keyword identifier).
- Schema name in **DDL** (outside dollar-quoting): always via the variable, **never** hardcoded
  — applies to `CREATE`/`DROP`/`ALTER`/`OWNER`, FK `REFERENCES`, `\echo`, etc.
  - **Framework:** the concrete schema variables are `:schema_config` / `:schema_etl` / `:schema_helper` / `:schema_log`, the schema owner is `:schema_owner` (see `db/config/*.env.sql`). In the examples below, `:schema_name` stands **in place of** the respective concrete schema variable.
  - **Exception — procedure/function body (dollar-quoting):** psql does **not** interpolate `:schema_*` inside `$procedure$…$procedure$` / `$function$…$function$` (syntax error `at or near ":"`). Object references in the body are therefore **schema-qualified hardcoded** (`config.process`, `log.execution`). This is acceptable because the four schema names are fixed across **all** environments (`db/config/*.env.sql` sets them as constants); only a global schema rename requires a `grep` replace of the bodies. Use fully qualified body references instead of `SET search_path` — the latter only when unqualified names are unavoidable.
- ALWAYS use **singular** table names (`user`, `project`, `task` — never `users`, `projects`, `tasks`). Applies to the table name itself; foreign-key column names follow naturally (`user_id`, not `users_id`).
- ALWAYS suffix timestamp columns with **`_on`**, never `_at` (`created_on`, `modified_on`, `deleted_on`, `last_login_on`, `first_seen_on`). The TypeScript camelCase mapping uses the same suffix (`createdOn`, `lastLoginOn`).
- ALWAYS give each table a surrogate primary key column **`id bigint NOT NULL GENERATED ALWAYS AS IDENTITY`** with `CONSTRAINT pk_<table> PRIMARY KEY (id)`. **NEVER use `serial`/`bigserial`/`smallserial`** — these are catalog-unmarked PostgreSQL legacy (`information_schema.is_identity = NO`; the auto-increment is only a `DEFAULT nextval()` convention, and the runtime role needs a separate sequence `USAGE` grant). A real `GENERATED ALWAYS AS IDENTITY` column is the SQL-standard identity (system-managed sequence, `is_identity = YES`, and it blocks accidental manual `id` inserts — the framework procedures only ever use `RETURNING id`). Natural keys (composite or otherwise) become **`UNIQUE` constraints**, not the PK. Applies to all tables, including lookup / master-data tables and existing tables — **pre-launch**, existing deployed tables are dropped + recreated rather than data-migrated; **on environments with data to protect** (post-go-live), never drop + recreate — converge the table file toward the desired state and move the data-dependent transition into a run-once `predeploy`/`postdeploy` script instead (see `.claude/rules/db-migrations.md` and `tables.md` → "Convergent evolution"). Where a row needs to carry an external identifier, it lives in its own `UNIQUE` column (e.g. `external_ref varchar UNIQUE NOT NULL`), separate from the surrogate `id`.
- ALWAYS store **the email address of the authenticated app user** in the audit columns `created_by` and `modified_by` — no `DEFAULT CURRENT_USER` (data type/length: see `tables.md`). The application supplies the email explicitly, either via a stored-procedure parameter (`p_actor_email varchar(100)`) or via a per-request session variable (`SET LOCAL app.actor_email = '…'` + column `DEFAULT current_setting('app.actor_email', true)`). The architecture step decides per feature which mechanism. `CURRENT_USER` (PG role) is **not** an acceptable substitute — it would always be the connection role (`di2_<env>_rw`, …), useless for app-level audit.
- ALWAYS prefix stored-procedure and stored-function parameters with **`p_`** (e.g. `p_project_id`, `p_actor_email`) — distinguishes them from local variables (`l_` prefix). The mode keyword (`IN` / `OUT` / `INOUT`) carries the direction; do not encode mode in the name (use `p_result` not `p_out_result`).
- `RETURNS` clause on a separate line
- `LANGUAGE plpgsql` on a separate line
- indentation: **3 white spaces** within 
  - `BEGIN`/`END`
  - `IF`/`ELSE`/`END IF`
  - `SELECT`/`INTO`/`FROM`/`WHERE`/`GROUP BY`/`HAVING`
- indentation: **3 white spaces** after 
  - `FOR`

### Examples
- procedure names        : `sp_<verb>_<entity>` (e.g. `sp_upd_table`)
- function names         : `fn_<verb>_<name>`   (e.g. `fn_is_null_or_empty`)
- trigger function names : `tf_<entity>`        (e.g. `tf_table`)
- trigger names          : `tr_<type>_<entity>` (e.g. `tr_iud_table`)
- view names             : `vw_<name>`          (e.g. `vw_errors_by_table`)

### Tabular alignment (parameters, variables, JOINs)

> Measured from the gold-standard files. Column numbers are 1-based from the start of the line. Base indentation is **3 spaces** app-wide (see Common). The sub-columns (name, type) align tabularly at a common column = longest identifier of the block + spacing; longer identifiers overflow (overflow allowed, they break the alignment only for their own line).

**Procedure/function parameters** (in the `( … )` signature):

- `(` and `)` each on their own line.
- First element **4 spaces** indentation; following elements **3 spaces + leading `,`** → the mode keyword sits at **column 5** in both cases.
- Mode keyword (`IN` / `OUT` / `INOUT`) left-aligned, padded to a **6-character field** → parameter name from **column 11**.
- Parameter type aligned at a common column = longest parameter name + spacing (in the reference file **column 40**; for shorter signatures correspondingly further left, overflow for longer ones).

```sql
CREATE OR REPLACE PROCEDURE :schema_name.sp_example
(
    IN    p_source_table_id            bigint
   ,IN    p_actor_email                varchar
   ,INOUT p_result                     text
)
```

**Variable declarations** (`DECLARE` block):

- **3 spaces** indentation → variable name from **column 4**.
- Data type aligned at a common column = longest variable name + spacing (reference file **column 30**).

```sql
DECLARE
   l_context                 varchar;
   l_session_actor           varchar;
   l_error_message           text;
```

**Grouping in the `DECLARE` block:** with more than a handful of variables, the declarations are
grouped by role under **3-line banner sub-headers** (same banner form as the
section comments, see [Inline comment blocks](#inline-comment-blocks-section-comments)) —
fixed order, empty groups omitted:

1. `-- Common` — infrastructure variables (`l_component`, possibly `l_context` / `l_source`).
2. `-- Error Handling` — `l_error_message`, `l_error_code`.
3. `-- Workload` — the domain working variables (lookups, intermediate results).

The groups mirror the body sections
([Get name / Check parameter / Workload](procedures.md#body-structure-get-name--check-parameter--workload)).

```sql
DECLARE
   -- --------------------------------------------------------------------------------
   -- Common
   -- --------------------------------------------------------------------------------
   l_component               varchar;

   -- --------------------------------------------------------------------------------
   -- Error Handling
   -- --------------------------------------------------------------------------------
   l_error_message           text;
   l_error_code              text;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   l_name                    varchar;
```

**JOINs**:

- Always fully qualified: **`INNER JOIN`** instead of a bare `JOIN`; likewise write out `LEFT JOIN` / `RIGHT JOIN` / `FULL JOIN`.
- **Positional table aliases** (`T01`, `T02`, `T03`, …) for **every aliased table reference** — JOIN, single-table `FROM`, `UPDATE … FROM`, CTE correlation, subquery —, numbered in order of appearance **within the respective statement** (restarting at `T01` per statement). Unaliased single-table refs may stay without an alias. **Why positional instead of descriptive:** aliases of varying length (`pm`/`cp`/`sts`) break the tabular alignment of the field names and become unreadable; equal-length `T0n` keep the column alignment. Descriptive aliases lose their meaning anyway with many JOINs.
- `ON` on its own line, aligned **under the `INNER`** (same column as `INNER JOIN` and the `FROM` table).
- **One** join condition: **2 spaces** indented under `ON` — deviating from the 3-space base indentation, because `ON` is only 2 characters wide and the condition should line up just behind it.
- **Multiple** conditions: `AND`/`OR` river like in `WHERE` (leading `AND`/`OR`, conditions aligned, comparison `=` lined up).

```sql
FROM
   :schema_log.component T01
   INNER JOIN :schema_log.execution T02
   ON
     T02.id = T01.execution_id
WHERE
       T01.execution_id = l_execution_id
   AND T02.status       = 'running'
```

## File Naming & Numbering

Every DDL file under `db/schemas/<schema>/<objecttype>/` carries a **3-digit number prefix** before the object name, e.g. `003.sp_ins_execution.sql`. The prefix is **not a global, sequential counter**, but a **table-group indicator** (assigned per schema). The number is orthogonal to the subfolders: the same `003` appears in `tables/`, `procedures/`, `functions/`, `views/`, `trigger/`, etc. — for every object that describes table `003`.

### Rule

- **One table = one number.** All DDL objects belonging to the same table (the table itself, its policies, trigger function, trigger, procedures, data seed) carry the same prefix.
- **Numbers are assigned in the order tables enter the schema.** Once assigned, never reassigned — even if a table becomes obsolete.
- **Disambiguation happens via the object-name suffix**, not via the number. `003.sp_ins_project.sql` and `003.sp_upd_project.sql` deliberately have the same prefix.

### Claim protocol (`NUMBERS.md` registry)

Every schema directory carries a registry `db/schemas/<schema>/NUMBERS.md` (one markdown table:
Number | Table | Ref | Claimed on). It makes number assignment visible at **development start**, so
two developers on parallel branches cannot silently claim the same next number. The claim happens
the moment a feature/bug that introduces a new table moves to in-progress — **before any DDL file
is created**:

1. Update to the current default-branch state (`git pull`).
2. Read `db/schemas/<schema>/NUMBERS.md`, take the highest number + 1.
3. Add the registry row (number, table name, feature/bug ref, date).
4. Commit **only this change**: `chore(db): claim table number NNN for <table>`.
5. Push **directly to the default branch** — the claim must be visible to all developers
   immediately; on a feature branch it would surface only at merge time, too late.
6. If the push is rejected (non-fast-forward — someone else claimed concurrently): pull, take the
   next number, amend, push again. **`git push` acts as the atomic lock**; the race resolves itself
   without extra infrastructure.

Notes:

- Numbers are **never reassigned** — an abandoned feature leaves a burned number in the registry
  (matches the "once assigned, never reassigned" rule above).
- Requires that direct registry-only commits to the default branch are allowed. If the project
  enables strict branch protection later, switch the claim channel (e.g. annotated git tags
  `dbnum/<schema>/NNN`) — record that as a follow-up decision then.
- Exception: `predeploy`/`postdeploy` transition scripts use timestamp prefixes
  (`YYYYMMDDHHMM.<name>.sql`, see `.claude/rules/db-migrations.md`), **no** table-group numbers,
  and therefore no registry entry.
- CI backstop: `db/scripts/lint-numbers.sh` (wired into `.github/workflows/ci.yml`) fails the build
  on duplicate prefixes in `tables/`, prefixes missing from the registry, or duplicate registry
  numbers.

### Cross-table objects (procedure / function touching multiple tables)

Choose the prefix by this heuristic (in this order):

1. **Trigger function** → prefix of the table to whose trigger it is attached. Example: `tf_source_table_workflow_aggregate` reads from `column_metadata` (007) and writes to `source_table_selection` (006). File: `007.tf_source_table_workflow_aggregate.sql`, because the trigger `tr_iud_column_metadata_workflow_aggregate` fires on `column_metadata`.
2. **Procedure with a clear write target** → prefix of that table. Reads from other tables (lookups, `FOR UPDATE` locks for defense-in-depth) are accompanying operations and do not count. Example: `sp_recover_project_owner` locks `project` (003) and writes to `project_member` + `project_member_history` (004). File: `004.sp_recover_project_owner.sql`.
3. **Symmetric cross-table operation** (equally weighted writes to two unrelated tables) → the **higher** of the two group numbers, so both target tables already exist at `\ir` time. Rare in practice — usually one table can be identified as the driver.

**Mandatory:** the file's `--comment:` header names every cross-table relationship explicitly, so a searcher finds via `grep` — and not only via prefix filter — what touches another table.

### Why this convention (instead of a global sequence)

Deliberately **not** a global `001., 002., 003., …` counter across all procedures. The table-group variant has three concrete advantages:

1. **Co-location per table.** `ls 007.*` shows all objects of a table at a glance — a driver for reviews and refactors.
2. **No renumbering tax.** New procedure for `project_member`? The file is named `004.sp_new_procedure.sql`, done — no 20 other files have to be renamed.
3. **Section ordering in the deploy runner (`db/scripts/`) already resolves dependencies.** Tables → Policies → Functions → Procedures → Triggers → Views → Data are loaded in separate blocks. Within a block the order usually doesn't matter (a procedure references no other procedure, only tables — which all exist by that point).

### Single Source of Truth

The load order is determined by the **deploy runner** (`db/scripts/`): by section (Tables → Policies → Functions → Procedures → Triggers → Views → Data), within the section by number. **The number is a sort helper + table-group indicator, not a global sequence.**

## Layout & formatting (DDL/DML)

> Derived from the gold-standard files. Complements the [Tabular alignment](#tabular-alignment-parameters-variables-joins) (parameters/variables/JOINs) with the file and statement structure. Base indentation **3 spaces** app-wide.

### File skeleton

- **Head:** first line `\echo "## CREATE <KIND> :schema_name.<name>"` (`<KIND>` = TABLE / PROCEDURE / FUNCTION / POLICIES / SEED / BACKFILL).
- **Foot:** `\echo "## CREATE <KIND> :schema_name.<name> - DONE"` (replaces the old empty `\echo ''`).
- **DROP:** `DROP …;` lines, then one blank line, then `CREATE OR REPLACE …`. (Trigger functions: no DROP — see [trigger.md](trigger.md).)
- **Parameter block:** for procedures/functions **with parameters**, the `-- Parameter` doc block between `DROP …;` and `CREATE OR REPLACE …` — see [Parameter documentation in procedures.md](procedures.md#parameter-documentation-inline-block-before-create).
- **OWNER:** `ALTER … OWNER TO :schema_owner;` directly after the object body (tables: after `);`; procedures/functions: after `$…$;`).
- **No description footer banner:** procedures/functions carry **no** feature-ID description block at the file end — the domain description of the objects lives in the **external documentation** (project decision). An inline `--comment:` prefix is not used either. Tables are exempt from this: there the `COMMENT ON TABLE`/`COMMENT ON COLUMN` block from [tables.md](tables.md) still applies.

### Inline comment blocks (section comments)

Grouping section comments in the script body — e.g. `-- Unique constraints` / `-- Foreign keys`
after the table as well as the `Get name` / `Check parameter` / `Workload` sections in the procedure body —
are **always** written as a **3-line banner block**: separator line · label · separator line. The
**separator line** is `--`, **one space**, then **exactly 80** `-` characters (line length 83). In
indented blocks (procedure body), the base indentation (3 spaces) precedes each of the three lines.

```sql
-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
```

### Parentheses on their own line

`(` and `)` each go on their own line for: CREATE TABLE, procedure/function signature, INSERT column list, `VALUES`, CTE body, multi-line subqueries (`EXISTS (` / `NOT EXISTS (`), policy `USING (` / `WITH CHECK (`.

**Exception — trivial constant bodies stay single-line:** `FOR UPDATE USING (false);`, `FOR DELETE USING (true);`, `WITH CHECK (true)`. Only when the body is a real expression/subquery do `(`/`)` go on their own lines.

### SELECT / DML — vertical layout

- `SELECT` / `INTO` / `FROM` / `WHERE` / `GROUP BY` / `ORDER BY` each on their own line at statement level.
- Lists (select list, `INTO` list, column list) indented below with leading comma; the first element one space deeper so it lines up with the comma elements.
- `FROM` table on its own indented line; JOINs see [Tabular alignment → JOINs](#tabular-alignment-parameters-variables-joins).
- `WHERE`: `AND`/`OR` river (leading `AND`/`OR`, conditions aligned, `=` lined up).
- Short subqueries / function calls may be single-line (`NOT EXISTS (SELECT 1 FROM … WHERE …)`, `l_x := app.fn_y(a, b, c);`).

```sql
SELECT
    is_active
   ,connection_id
INTO
    l_is_active
   ,l_connection_id
FROM
   app.source_table_selection
WHERE
   id = p_source_table_id;
```

### CTE

`WITH` on its own line; CTE name with `CTE_` prefix; `AS` then `(` on its own line.

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

### Dynamic SQL (`format()`) — string layout

> Applies to write/read statements built via `format($sql$…$sql$, …)` in the PL/pgSQL body (e.g. the
> persistent log write path via `log.fn_log_write`, in future `etl`). Complements the `%I`/`%L` requirement from
> [procedures.md → Dynamic SQL](procedures.md#framework-specific) with the **string layout**.

The dynamic SQL string is set as a **hanging block** aligned **under its first keyword**
— so the embedded statement reads as a coherent, aligned block and the
`$sql$…$sql$` delimiters flank it:

- **Opening `$sql$` + first keyword on the `format(` line** (`… := format($sql$INSERT …`) — **no**
  line break between `format(` and `$sql$`.
- **All following lines of the statement align under the first keyword** (the column directly behind `$sql$`).
  Structural keywords/parentheses (`(`, `)`, `VALUES`, `RETURNING`, `SET`, `WHERE`, …) sit on this
  keyword column.
- **List elements** (column list, `VALUES`, `SET` assignments, `WHERE` conditions) **one level
  (4 spaces) deeper**, each on its own line with a **leading comma or leading `AND`**; `=` signs and
  conditions within the block aligned tabularly (like static DML).
- **Closing `$sql$` on its own line, aligned under the opening `$sql$`** — **not** appended to the
  last SQL line.
- **`format()` arguments** follow afterwards with a leading comma at the `format()` call's indentation
  (the first "argument" — the string — already sits on the `format(` line).

```sql
l_sql := format($sql$INSERT INTO log.execution
                     (
                         process_id
                         ,start_on
                         ,state
                         ,success
                     )
                     VALUES
                     (
                         %1$L
                         ,%2$L
                         ,'processing'
                         ,false
                     )
                     RETURNING id
                $sql$
   ,p_process_id
   ,l_start
);
```

(The **keyword column** results from the prefix `<var> := format($sql$`; all statement lines hang
beneath it, the closing `$sql$` aligns under the opening one. `UPDATE` analogously: `SET`/`WHERE`/`RETURNING`
on the keyword column, assignments/conditions 4 spaces deeper with a leading `,`/`AND`.)

# Object-specific rules (separated out)

sql.md is the **cross-cutting** styleguide (naming, alignment, file-numbering, generic
layout principles). The **object-specific** rules live in the respective object files —
look them up there, depending on what is being built. Each object file refers back to sql.md for the
cross-cutting parts; **on conflict, sql.md wins.**

| Object type | Rule file | contains among others |
|---|---|---|
| Tables | [tables.md](tables.md) | CREATE-TABLE layout, foreign keys / unique, comments (table & columns), INSERT/seed, data types, audit columns, RLS |
| Procedures | [procedures.md](procedures.md) | Parameter order (ID first), parameter documentation, body structure, error messages & `format()`, Single Responsibility, procedure skeleton |
| Functions | [functions.md](functions.md) | Function skeleton, volatility; shared body rules via reference to procedures.md |
| Triggers | [trigger.md](trigger.md) | Trigger/trigger-function skeleton, `TG_OP` logic |
| Views | [views.md](views.md) | View conventions |
| Policies / RLS | [policies.md](policies.md) | Row-Level-Security policies |
