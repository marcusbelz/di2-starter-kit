# Rule: Policies / Row Level Security (PostgreSQL 17)

> **PostgreSQL.** These SQL rules were written for **PostgreSQL** (ported from a framework proven in a real-world
> project). Other DB vendors will get their own sibling directories under `.claude/rules/sql/`
> (e.g. `mysql/`, `mssql/`); `/init` keeps only the chosen one. Overview: [README](../README.md).

> **The authoritative SQL code conventions are in [sql.md](sql.md) — read before every script.**
> Layout (`USING (` / `WITH CHECK (` with parentheses on their own line for real expressions,
> trivial constant bodies single-line), file skeleton and alignment live there.
> **On conflict, sql.md wins.**
>
> **Schema variables:** `:schema_config`/`:schema_etl`/`:schema_helper`/`:schema_log` and
> `:schema_owner` instead of `:schema_app_*`.

## Framework-specific
- **Location:** script under `db/schemas/<schema>/policies/<NNN>.<table>_policies.sql`
  (framework primarily `log`). `<NNN>` = number of the table whose policies are defined here.
- Enable RLS: `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` (sensitive tables additionally
  `FORCE ROW LEVEL SECURITY`).
- Policy **per command** (`FOR SELECT|INSERT|UPDATE|DELETE`); roles explicit (`TO :role_rw` …),
  no blanket `PUBLIC`.
- Set `USING` (visibility) and `WITH CHECK` (write condition) fully; default-deny.
- Idempotency: `DROP POLICY IF EXISTS …` before `CREATE POLICY`.
