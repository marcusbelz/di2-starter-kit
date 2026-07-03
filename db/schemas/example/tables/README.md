# tables/

`CREATE TABLE` scripts — one file per table.

- **File name:** `NNN.<table>.sql` — `NNN` is the 3-digit **table-group number** (assigned in
  creation order per schema, never reassigned). All objects of this table (procedures, trigger,
  policies, seed) share this number.
- **Idempotent:** `CREATE TABLE IF NOT EXISTS`; constraints as separate `ALTER TABLE … DROP/ADD`.
- Surrogate PK `id bigint GENERATED ALWAYS AS IDENTITY`, audit columns, `COMMENT ON`, RLS where needed.

Full convention: `.claude/rules/sql/postgres/tables.md` (overarching: `.claude/rules/sql/postgres/sql.md`).

Shipped examples: [`001.example.sql`](001.example.sql) (master),
[`002.example_item.sql`](002.example_item.sql) (detail with FK + index),
[`003.schema_apply_log.sql`](003.schema_apply_log.sql) (append-only deploy tracker, audit-exempt).
