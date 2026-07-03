# Rule: Views (PostgreSQL 17)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/`
> (e.g. `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **The authoritative SQL code conventions are in [sql.md](sql.md) — read before every script.**
> Naming **`vw_<name>`**, snake_case, vertical SELECT/FROM/WHERE layout, JOIN alignment
> (`T01`/`T02`…), file skeleton (`\echo`, `OWNER TO`). **On conflict, sql.md wins.**
>
> **Schema variables:** `:schema_config`/`:schema_etl`/`:schema_helper`/`:schema_log` and
> `:schema_owner` instead of `:schema_app_*`.

## Framework-specific
- **Location:** one script per view under `db/schemas/<schema>/views/<NNN>.vw_<name>.sql`
  (log views: `db/schemas/log/views/`). `<NNN>` = number of the underlying main table.
- Idempotent (`CREATE OR REPLACE VIEW`), **read-only**, name/alias columns explicitly
  (no `SELECT *` in permanent views).
- For expensive aggregations, use `MATERIALIZED VIEW` if applicable + a documented refresh strategy.
- `COMMENT ON VIEW` with a domain description.
