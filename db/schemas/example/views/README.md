# views/

Read-only **views** (`vw_…`) — one file per view.

- **File name:** `NNN.vw_<name>.sql` — `NNN` = number of the underlying main table.
- **Idempotent:** `CREATE OR REPLACE VIEW`; name columns explicitly (no `SELECT *`); `COMMENT ON VIEW`.
- Expensive aggregates → `MATERIALIZED VIEW` + a documented refresh strategy.

Full convention: `.claude/rules/sql/postgres/views.md`.

Shipped example: [`001.vw_example_overview.sql`](001.vw_example_overview.sql) (parent + item count).
