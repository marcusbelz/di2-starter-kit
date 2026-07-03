# Rule: Tables (SQL Server 2022)

> **SQL Server (MSSQL).** This ruleset is the T-SQL sibling of the PostgreSQL ruleset under
> [`../postgres/`](../postgres/); `/init` keeps only the chosen vendor directory. Overview:
> [README](../README.md).

> **For cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> snake_case/**singular**, PK `id bigint IDENTITY(1,1)` + `CONSTRAINT pk_<table>`, natural keys as
> `UNIQUE`, timestamps with the **`_on`** suffix, tabular alignment, file skeleton `PRINT`
> header/footer + `GO` batches, file naming & numbering). **On conflict, sql.md wins.** The
> **table-specific** rules (CREATE TABLE layout, foreign keys / unique, descriptions, INSERT/seed)
> live **here** in this file.
>
> **Schema variables:** sqlcmd `$(schema_config)` / `$(schema_etl)` / `$(schema_helper)` /
> `$(schema_log)`; `$(schema_name)` in the examples stands in for the concrete variable.

## Framework-specific
- **Location:** one script per table under `db/schemas/<schema>/tables/<NNN>.<table>.sql`.
  `<NNN>` = 3-digit **table group number** (assigned per schema sequentially in creation order,
  never reassigned). All objects of this table carry this number (see sql.md
  "File Naming & Numbering").
- **Idempotency:** T-SQL has no `CREATE TABLE IF NOT EXISTS` — guard the whole `CREATE TABLE` with
  `IF OBJECT_ID(N'$(schema_name).<table>', N'U') IS NULL BEGIN … END;`.
- **Data types (binding — this is the authoritative place):**
  - Character columns always **`nvarchar`** (Unicode), **never** `varchar` / `text` / `ntext`
    (`text`/`ntext` are deprecated; `varchar` silently mangles non-Latin input). Unbounded fields:
    `nvarchar(max)` — use it only where truly unbounded; otherwise define a length.
  - Timestamp columns (`*_on`) always **`datetimeoffset(3)`** — the offset-preserving equivalent of
    PostgreSQL `timestamptz`. **Never** `datetime` / `smalldatetime`; `datetime2` only with a
    documented reason (it loses the offset). Default: `sysdatetimeoffset()`.
  - Boolean flags: **`bit`**, always `NOT NULL` with an explicit named default.
  - Audit columns `created_by` / `modified_by` always **`nvarchar(100)`**.
  - Surrogate PK always **`bigint NOT NULL IDENTITY(1,1)`** — system-managed key; procedures
    retrieve it via `SCOPE_IDENTITY()` (never `@@IDENTITY`, which is trigger-unsafe). Manual `id`
    inserts are blocked (only `SET IDENTITY_INSERT`, never used in application code).
- **Named constraints everywhere:** `pk_<table>`, `uq_<table>_<column>`, `fk_<table>_<column>`,
  `chk_<table>_<name>`, and — SQL Server-specific — **named default constraints
  `df_<table>_<column>`**. An unnamed default gets a random system name that makes every later
  `DROP CONSTRAINT` a catalog lookup; always name them inline.
- **Audit-column convention (default & nullability):**
  - `created_on datetimeoffset(3) NOT NULL CONSTRAINT df_<table>_created_on DEFAULT (sysdatetimeoffset())`
  - `created_by nvarchar(100) NOT NULL` (supplied by the app — no default; see sql.md audit rule)
  - `modified_on datetimeoffset(3) NULL` (no default)
  - `modified_by nvarchar(100) NULL` (no default)
  - `modified_on` / `modified_by` are **not** set via a default, but on every `UPDATE` by the
    table's `AFTER UPDATE` trigger `tr_u_<table>` (see [trigger.md](trigger.md) — T-SQL has no
    shared trigger function; each table carries its own small trigger).
- **Descriptions (extended properties):** table description mandatory; column descriptions above
  all on wide tables. Full rule → section
  [Descriptions (table & columns)](#descriptions-table--columns) below.
- **RLS** (security policies) on sensitive tables (above all `log.*`); policies →
  [policies.md](policies.md).
- **Audit columns:** the sql.md variant `created_by`/`modified_by` = email of the app user is
  app-flavored — for framework tables only where it makes domain sense (e.g. `config`). Log tables
  carry their own time/status columns of the logging.

## CREATE TABLE — columns & constraints

- Leading comma: first element 4 spaces, subsequent elements `   ,` (3 + comma).
- Tabular columns **Name | Type | Nullability | Default**:
  - `NULL` is vertically aligned; the optional `NOT ` sits in the 4-character column to its left
    (all `NULL` line up, with or without `NOT`).
  - `CONSTRAINT df_<table>_<column> DEFAULT (<value>)` follows directly after `NOT NULL` / `NULL`.
  - Overflow: names that run past the name column break the alignment for their own line only.
- **Inline in `CREATE TABLE` (within the `( … )`): only `IDENTITY`, `PRIMARY KEY`, named defaults,
  and `CHECK`.**
  - **PK explicitly as a named constraint** `CONSTRAINT pk_<table> PRIMARY KEY (id)` as the
    **last** element of the block — **never** as a column inline
    (`id bigint IDENTITY(1,1) PRIMARY KEY`).
  - `CHECK` constraints (if any) also inline, set off by a blank line; expressions aligned.
- **`UNIQUE` and `FOREIGN KEY` do NOT live in the `CREATE TABLE`,** but as separate `ALTER TABLE`
  statements **after** the table — grouped by family: first all `UNIQUE` under
  `-- Unique constraints`, then all `FOREIGN KEY` under `-- Foreign keys`.
  - **Idempotency:** per constraint `ALTER TABLE … DROP CONSTRAINT IF EXISTS <name>;` directly
    followed by `ALTER TABLE … ADD CONSTRAINT <name> …;`. **Trade-off:** the re-add validates FKs /
    rebuilds UNIQUE indexes on **every** deploy — on very large tables switch to an
    `IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = N'<constraint>' …)` guard around the
    `ADD` instead (deliberate, documented deviation).
- Audit columns under `-- Audit`, set off by a blank line.
- **Order after the table:** `-- Unique constraints` → `-- Foreign keys` → indexes → security
  policy (if any) → `-- Descriptions` (extended properties, see
  [Descriptions](#descriptions-table--columns)). Indexes have no `IF NOT EXISTS` in T-SQL — guard
  with `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'<index>' AND object_id = OBJECT_ID(N'$(schema_name).<table>'))`.

```sql
IF OBJECT_ID(N'$(schema_name).example', N'U') IS NULL
BEGIN
   CREATE TABLE $(schema_name).example
   (
       id              bigint             NOT NULL IDENTITY(1,1)
      ,name            nvarchar(200)      NOT NULL
      ,parent_id       bigint                 NULL
      ,is_active       bit                NOT NULL CONSTRAINT df_example_is_active DEFAULT (1)

      -- --------------------------------------------------------------------------------
      -- Audit
      -- --------------------------------------------------------------------------------
      ,created_on      datetimeoffset(3)  NOT NULL CONSTRAINT df_example_created_on DEFAULT (sysdatetimeoffset())
      ,created_by      nvarchar(100)      NOT NULL
      ,modified_on     datetimeoffset(3)      NULL
      ,modified_by     nvarchar(100)          NULL

      ,CONSTRAINT pk_example  PRIMARY KEY (id)

      ,CONSTRAINT chk_example_name  CHECK (LEN(LTRIM(RTRIM(name))) > 0)
   );
END;
GO

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE $(schema_name).example DROP CONSTRAINT IF EXISTS uq_example_name;
ALTER TABLE $(schema_name).example ADD  CONSTRAINT uq_example_name UNIQUE (name);
GO

-- --------------------------------------------------------------------------------
-- Foreign keys
-- --------------------------------------------------------------------------------
ALTER TABLE $(schema_name).example DROP CONSTRAINT IF EXISTS fk_example_parent_id;
ALTER TABLE $(schema_name).example ADD  CONSTRAINT fk_example_parent_id FOREIGN KEY (parent_id) REFERENCES $(schema_name).example(id) ON DELETE CASCADE;
GO
```

## Foreign keys

- Name FK constraints: `fk_<table>_<column>`.
- **Location: as separate `ALTER TABLE … ADD CONSTRAINT` AFTER the table** (not inline in
  `CREATE TABLE`), idempotent via `DROP CONSTRAINT IF EXISTS` + `ADD`, grouped under
  `-- Foreign keys` — see
  [CREATE TABLE — columns & constraints](#create-table--columns--constraints).
- Choose `ON DELETE` behavior deliberately: `CASCADE` for dependent detail rows, `SET NULL` for
  optional references, otherwise the default (`NO ACTION`). **SQL Server caveat:** multiple cascade
  paths onto the same table raise error 1785 (`may cause cycles or multiple cascade paths`) — where
  that hits, keep `NO ACTION` and delete the detail rows in the `sp_del_*` procedure instead;
  document it in the file header.
- Referenced table always schema-qualified via the schema variable.
- Natural keys become `UNIQUE` constraints (not the PK — that is always
  `id bigint IDENTITY(1,1)`); likewise as a separate `ALTER TABLE … ADD CONSTRAINT` after the
  table, grouped under `-- Unique constraints`.

## Descriptions (table & columns)

> The T-SQL equivalent of `COMMENT ON TABLE` / `COMMENT ON COLUMN` is the **`MS_Description`
> extended property** — set via `sys.sp_addextendedproperty` / `sys.sp_updateextendedproperty`.
> The block sits **at the end of the file**, after `-- Unique constraints` / `-- Foreign keys` /
> indexes / RLS.

**Scope (what gets described):**
- **Table description is mandatory** — short domain description of the table.
- **Column descriptions for domain columns:** every column with a non-obvious meaning. **Mandatory
  on wide tables** (rule of thumb from ~8 domain columns). Concise and domain-focused; for
  codes/flags name the permitted values (e.g. `error_type` → `E`/`W`/`I`).
- **No column descriptions needed:** the surrogate PK `id` and the audit columns `created_on` /
  `created_by` / `modified_on` / `modified_by` (framework-wide uniform).
- **FK columns:** optional short hint at the target table / relationship.

**Layout:**
- Grouped under a **`-- Descriptions` banner** (3-line banner like `-- Unique constraints`).
- **Order:** first the table description, then the column descriptions in the column order of the
  `CREATE TABLE`.
- The raw `sp_addextendedproperty` call is verbose and cannot be tabularly aligned — the kit
  therefore wraps it once in a small **helper procedure**
  `$(schema_helper).sp_set_description(@p_schema, @p_table, @p_column, @p_description)`
  (idempotent add-or-update; `@p_column = NULL` targets the table itself). Table files then carry
  **one aligned `EXEC` line per description**:

```sql
-- --------------------------------------------------------------------------------
-- Descriptions
-- --------------------------------------------------------------------------------
EXEC $(schema_helper).sp_set_description N'$(schema_config)', N'process', NULL,         N'Master data: named processes (configuration data).';

EXEC $(schema_helper).sp_set_description N'$(schema_config)', N'process', N'name',      N'Unique process name (natural key, UNIQUE).';
EXEC $(schema_helper).sp_set_description N'$(schema_config)', N'process', N'is_active', N'Controls whether the process is actively used.';
GO
```

(The table description is set off from the column descriptions by one blank line — same visual
split as the PostgreSQL `COMMENT` block. The helper's body is the standard
`IF EXISTS (sys.extended_properties …) sp_updateextendedproperty ELSE sp_addextendedproperty`
upsert; it lives in the `helper` schema and is created early in the deploy run.)

## INSERT / Seed

- `INSERT INTO <table>` then `(` column list `)`, then `VALUES` then `(` value list `)` — parens on
  their own lines, leading comma. (A short column list may sit single-line after
  `INSERT INTO <table>` — see the seed example.)
- Multi-line seed `VALUES`: tuples with leading comma, one per line; tuple elements aligned in
  columns (string columns padded). String literals always `N'…'`.
- **Idempotent upsert via `MERGE`** — the T-SQL equivalent of `ON CONFLICT … DO UPDATE`
  (SQL Server has no `ON CONFLICT`). Match on the natural key; terminate the `MERGE` with `;`
  (mandatory in T-SQL).

```sql
MERGE $(schema_name).example AS T01
USING
(
   VALUES
       (N'a', N'Alpha', 1, N'<system>')
      ,(N'b', N'Beta',  0, N'<system>')
) AS T02 (slug, name, is_active, created_by)
ON
  T01.slug = T02.slug
WHEN MATCHED THEN
   UPDATE
   SET
       name        = T02.name
      ,is_active   = T02.is_active
      ,modified_on = sysdatetimeoffset()
      ,modified_by = N'<system>'
WHEN NOT MATCHED THEN
   INSERT (slug, name, is_active, created_by)
   VALUES (T02.slug, T02.name, T02.is_active, T02.created_by);
GO
```
