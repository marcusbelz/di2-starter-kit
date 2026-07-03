# data/

Seed / reference data (`INSERT … ON CONFLICT`) — one file per table that needs rows at deploy time.

- **File name:** `NNN.<table>.sql` — `NNN` = the table's group number.
- **Idempotent / re-runnable:** `INSERT … ON CONFLICT (<natural key>) DO UPDATE` (upsert), never a bare INSERT.
- Loaded **last** in the per-schema order (after tables / functions / procedures / trigger / views).

Layout convention: `.claude/rules/sql/postgres/tables.md` → "INSERT / Seed".

Shipped example: [`001.example.sql`](001.example.sql) (upsert seed keyed on the natural key).
