# trigger/

Trigger functions (`tf_…`) and triggers (`tr_…`) — one file per trigger (function + definition).

- **File name:** `NNN.<tf|tr>_<…>.sql` — `NNN` = number of the table the trigger fires on.
- Trigger function: `RETURNS TRIGGER`, **no `DROP FUNCTION`** (triggers depend on it) — `CREATE OR REPLACE` only.
- Trigger name encodes the type: `tr_<i|u|d|iud>_<entity>`; cover all `TG_OP` branches.

Full convention: `.claude/rules/sql/postgres/trigger.md`.

Shipped examples: [`000.tf_set_modified.sql`](000.tf_set_modified.sql) (generic audit trigger
function, shared per schema — number `000` so it loads first),
[`001.tr_u_example.sql`](001.tr_u_example.sql), [`002.tr_u_example_item.sql`](002.tr_u_example_item.sql).
