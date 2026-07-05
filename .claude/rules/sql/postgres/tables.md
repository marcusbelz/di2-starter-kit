# Rule: Tables (PostgreSQL 17)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/` (e.g.
> `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **For cross-cutting SQL conventions see [sql.md](sql.md) — read before every script** (naming
> snake_case/**singular**, PK `id bigint GENERATED ALWAYS AS IDENTITY` + `CONSTRAINT pk_<table>`, natural keys as `UNIQUE`,
> timestamps with the **`_on`** suffix, tabular alignment, file skeleton `\echo` header/footer +
> `OWNER TO`, file naming & numbering). **On conflict, sql.md wins.** The **table-specific**
> rules (CREATE TABLE layout, foreign keys / unique, comments, INSERT/seed) live **here** in
> this file.
>
> **Schema variables:** in the framework use `:schema_config` / `:schema_etl` / `:schema_helper` /
> `:schema_log` and `:schema_owner` — **not** `:schema_app_*` from the sql.md examples
> (see `db/config/*.env.sql`).

## Framework-specific
- **Location:** one script per table under `db/schemas/<schema>/tables/<NNN>.<table>.sql`.
  `<NNN>` = 3-digit **table group number** (assigned per schema sequentially in creation order,
  never reassigned). All objects of this table carry this number (see sql.md
  "File Naming & Numbering").
- **Idempotency:** `CREATE TABLE IF NOT EXISTS …`.
- **Data types (binding — this is the authoritative place):**
  - Character columns always **`varchar`**, **never `text`**. In PostgreSQL `varchar` (without a length)
    is internally identical to `text` (same storage/performance); `varchar(n)` additionally enforces
    a length check. Unbounded fields: `varchar` **without** a length.
  - Audit columns `created_by` / `modified_by` always **`varchar(100)`**.
  - Surrogate PK always **`bigint GENERATED ALWAYS AS IDENTITY`**, **never `serial`/`bigserial`/`smallserial`**
    (rationale see [sql.md](sql.md) — catalog-marked identity instead of the `nextval` default convention).
- **Audit-column convention (default & nullability):**
  - `created_on timestamptz NOT NULL DEFAULT now()`
  - `created_by varchar(100) NOT NULL DEFAULT current_user`
  - `modified_on timestamptz NULL` (no default)
  - `modified_by varchar(100) NULL` (no default)
  - `modified_on` / `modified_by` are **not** set via a default, but on every `UPDATE`
    by the `BEFORE UPDATE` trigger `log.tf_set_modified()` (→ `now()` / `current_user`). Every
    table with `modified_*` columns gets a `tr_u_<table>` trigger that calls this function.
- **Comments (`COMMENT ON TABLE` + `COMMENT ON COLUMN`):** table comment mandatory; column comments
  above all on wide tables. Full rule incl. layout → section
  [Comments (table & columns)](#comments-table--columns) below.
- **RLS** enabled on sensitive tables (above all `log.*`); policies → [policies.md](policies.md).
- **Audit columns:** the sql.md variant `created_by`/`modified_by` = email of the app user is
  app-flavored — for framework tables only where it makes domain sense (e.g. `config`).
  Log tables carry their own time/status columns of the logging.

## CREATE TABLE — columns & constraints

- Leading comma: first element 4 spaces, subsequent elements `   ,` (3 + comma).
- Tabular columns **Name | Type | Nullability | Default**:
  - `NULL` is vertically aligned; the optional `NOT ` sits in the 4-character column to its left (all `NULL` line up, with or without `NOT`).
  - `DEFAULT <value>` follows directly after `NOT NULL` / `NULL`.
  - Overflow: names that run past the name column break the alignment for their own line only.
- **Inline in `CREATE TABLE` (within the `( … )`): only `PRIMARY KEY` and `CHECK`.**
  - **PK explicitly as a named constraint** `CONSTRAINT pk_<table> PRIMARY KEY (…)` as the **last** element of the block — **never** as a column inline (`id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`).
  - `CHECK` constraints (if any) also inline, set off by a blank line; expressions aligned with one another.
- **`UNIQUE` and `FOREIGN KEY` do NOT live in the `CREATE TABLE`,** but as separate `ALTER TABLE` statements **after** the `ALTER … OWNER` — grouped by family: first all `UNIQUE` under `-- Unique constraints`, then all `FOREIGN KEY` under `-- Foreign keys`.
  - **Idempotency:** per constraint `ALTER TABLE … DROP CONSTRAINT IF EXISTS <name>;` directly followed by `ALTER TABLE … ADD CONSTRAINT <name> …;` (PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS`; a `DO` guard is out because psql does not interpolate `:schema_*` inside dollar-quoting). **Trade-off:** the re-add validates FKs / rebuilds UNIQUE indexes on **every** deploy — use deliberately on very large tables.
- Audit columns under `-- Audit`, set off by a blank line.
- **Order after `ALTER … OWNER`:** `-- Unique constraints` → `-- Foreign keys` → `-- Convergent evolution` (see below) → indexes → `ENABLE`/`FORCE ROW LEVEL SECURITY` → `-- Comments` (`COMMENT ON TABLE` + `COMMENT ON COLUMN`, see [Comments](#comments-table--columns)). `CREATE … INDEX` linearized (`CREATE [UNIQUE] INDEX IF NOT EXISTS <name> ON <table> (…) [WHERE …];`).
- **Convergent evolution (columns added after initial creation):** the table file describes the
  **desired state** and converges existing databases toward it. Columns added after the initial
  `CREATE` do **not** go into the `CREATE TABLE` block — they live as idempotent
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS <column> <type> …;` statements under a
  `-- Convergent evolution` banner after the constraint blocks (so a greenfield deploy and an
  existing environment both end up with the identical shape). A data-dependent follow-up (backfill,
  `SET NOT NULL` after backfill) is **not** part of the table file — it goes into a run-once
  `predeploy`/`postdeploy` transition script (see `.claude/rules/db-migrations.md`, incl. the
  expand/contract sequencing rule). Worked example: `db/schemas/example/tables/001.example.sql`
  (column `notes`) + `db/schemas/example/postdeploy/`.

```sql
CREATE TABLE IF NOT EXISTS :schema_name.example
(
    id              bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,name            varchar(200)  NOT NULL
   ,parent_id       bigint            NULL
   ,is_active       boolean       NOT NULL DEFAULT true

   ,CONSTRAINT pk_example  PRIMARY KEY (id)

   ,CONSTRAINT chk_example_name  CHECK (length(trim(name)) > 0)
);
ALTER TABLE :schema_name.example OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_name.example DROP CONSTRAINT IF EXISTS uq_example_name;
ALTER TABLE :schema_name.example ADD  CONSTRAINT uq_example_name UNIQUE (name);

-- --------------------------------------------------------------------------------
-- Foreign keys
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_name.example DROP CONSTRAINT IF EXISTS fk_example_parent_id;
ALTER TABLE :schema_name.example ADD  CONSTRAINT fk_example_parent_id FOREIGN KEY (parent_id) REFERENCES :schema_name.example(id) ON DELETE CASCADE;
```

## Foreign keys

- Name FK constraints: `fk_<table>_<column>`.
- **Location: as separate `ALTER TABLE … ADD CONSTRAINT` AFTER the table** (not inline in
  `CREATE TABLE`), idempotent via `DROP CONSTRAINT IF EXISTS` + `ADD`, grouped under
  `-- Foreign keys` — see [CREATE TABLE — columns & constraints](#create-table--columns--constraints).
- Choose `ON DELETE` behavior deliberately: `CASCADE` for dependent detail rows, `SET NULL` for
  optional references, otherwise the default (Restrict).
- Referenced table always schema-qualified via the schema variable.
- Natural keys become `UNIQUE` constraints (not the PK — that is always `id bigint GENERATED ALWAYS AS IDENTITY`); likewise
  as a separate `ALTER TABLE … ADD CONSTRAINT` after the table, grouped under `-- Unique constraints`.
- Audit columns `created_by` / `modified_by` (only where actually used in the domain — above all `config`):
  set by the calling process — **never** `CURRENT_USER` (that would only be the connection role,
  not the domain actor). Data type/length see Data types above.

Example (`UNIQUE`/`FK` as separate `ALTER TABLE` after the table — see [CREATE TABLE — columns & constraints](#create-table--columns--constraints)):
```sql
CREATE TABLE IF NOT EXISTS :schema_name.example
(
    id           bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,parent_id    bigint            NULL
   ,name         varchar(200)  NOT NULL
   ,created_on   timestamptz   NOT NULL DEFAULT now()
   ,created_by   varchar(100)  NOT NULL
   ,modified_on  timestamptz   NOT NULL DEFAULT now()
   ,modified_by  varchar(100)  NOT NULL

   ,CONSTRAINT pk_example  PRIMARY KEY (id)
);
ALTER TABLE :schema_name.example OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_name.example DROP CONSTRAINT IF EXISTS uq_example_name;
ALTER TABLE :schema_name.example ADD  CONSTRAINT uq_example_name UNIQUE (name);

-- --------------------------------------------------------------------------------
-- Foreign keys
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_name.example DROP CONSTRAINT IF EXISTS fk_example_parent_id;
ALTER TABLE :schema_name.example ADD  CONSTRAINT fk_example_parent_id FOREIGN KEY (parent_id) REFERENCES :schema_name.example(id) ON DELETE CASCADE;
```

## Comments (table & columns)

> Framework-local (both scope **and** layout), because `COMMENT ON TABLE` / `COMMENT ON COLUMN`
> apply exclusively to tables — a deliberate exception to "layout lives in sql.md". The
> `COMMENT` block sits **at the end of the file**, after `-- Unique constraints` / `-- Foreign keys` /
> indexes / RLS.

**Scope (what gets commented):**
- **`COMMENT ON TABLE` is mandatory** — short domain description of the table.
- **`COMMENT ON COLUMN` for domain columns:** every column with a non-obvious meaning.
  **Mandatory on wide tables** (rule of thumb from ~8 domain columns — e.g.
  `config.check_constraint`, `config.table_metadata`, `log.error`, `log.trace`). Concise and domain-focused;
  for codes/flags name the permitted values (e.g. `error_type` → `E`/`W`/`I`).
- **No column comments needed:** the surrogate PK `id` and the audit columns
  `created_on` / `created_by` / `modified_on` / `modified_by` (framework-wide uniform).
- **FK columns:** optional short hint at the target table / relationship — above all in the log chain
  `execution` → `component` → `trace`.

**Layout:**
- Grouped under a **`-- Comments` banner** (3-line banner like `-- Unique constraints` /
  `-- Foreign keys`).
- **Order:** first `COMMENT ON TABLE`, then the `COMMENT ON COLUMN` in the column order
  of the `CREATE TABLE`.
- **Table comment set off:** between the `COMMENT ON TABLE` line and the first
  `COMMENT ON COLUMN` line there is **one blank line** — the table comment is visually separated from the
  column comments. Between the `COMMENT ON COLUMN` lines themselves no blank lines.
- **Reference start aligned:** `COMMENT ON TABLE ` with 2 spaces, `COMMENT ON COLUMN ` with 1 space,
  so that the table and column reference begin in **the same column**.
- **`IS` clause tabularly aligned:** the object references are padded on the right with spaces
  so that the `IS` keyword lines up across **all** `COMMENT` lines of the block in **the same
  column** (shared column = longest reference of the block + one space). This puts
  reference, `IS` and description text under one another like table columns; longer references run
  over and break the alignment for their own line only (overflow allowed, cf. the tabular
  alignment in sql.md). Schema always via the variable, description text in single quotes
  (umlauts/ß permitted).

```sql
-- --------------------------------------------------------------------------------
-- Comments
-- --------------------------------------------------------------------------------
COMMENT ON TABLE  :schema_config.process            IS 'Master data: named processes (configuration data).';

COMMENT ON COLUMN :schema_config.process.name       IS 'Unique process name (natural key, UNIQUE).';
COMMENT ON COLUMN :schema_config.process.is_active  IS 'Controls whether the process is actively used.';
```

(`IS` lines up across all lines — the shorter references `…process` / `…process.name` are padded up to
the column of the longest reference `…process.is_active`. The table comment is set off from the
column comments by one blank line.)

## INSERT / Seed

- `INSERT INTO <table>` then `(` column list `)`, then `VALUES` then `(` value list `)` — parens on their own lines, leading comma. (A short column list may sit single-line after `INSERT INTO <table>` — see the seed example.)
- Multi-line seed `VALUES`: tuples with leading comma, one per line; tuple elements aligned in columns (string columns padded).
- `ON CONFLICT (...) DO UPDATE` → `SET` → leading-comma assignments.

```sql
INSERT INTO :schema_name.example (slug, name, is_active, created_by, modified_by)
VALUES
    ('a', 'Alpha', true,  '<system>', '<system>')
   ,('b', 'Beta',  false, '<system>', '<system>')
ON CONFLICT (slug) DO UPDATE
SET
    name        = EXCLUDED.name
   ,is_active   = EXCLUDED.is_active
   ,modified_on = now();
```
