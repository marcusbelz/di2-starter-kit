# policies/

Row-Level-Security **policies** — one file per table whose RLS is defined here.

- **File name:** `NNN.<table>_policies.sql` — `NNN` = number of the table the policies protect.
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (sensitive tables also `FORCE`); one policy per command
  (`FOR SELECT|INSERT|UPDATE|DELETE`), explicit roles, default-deny.
- **Idempotent:** `DROP POLICY IF EXISTS …` before `CREATE POLICY`.

Full convention: `.claude/rules/sql/postgres/policies.md`.
