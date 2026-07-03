# functions/

Stored **functions** (`fn_…`) — one file per function.

- **File name:** `NNN.fn_<verb>_<name>.sql` — `NNN` = number of the main table the function relates to.
- **Idempotent:** `DROP FUNCTION IF EXISTS … (signature);` then `CREATE OR REPLACE FUNCTION`.
- Set volatility correctly (`IMMUTABLE` / `STABLE` / `VOLATILE`); writes belong in procedures, not functions.

Full convention: `.claude/rules/sql/postgres/functions.md`.

Shipped example: [`000.fn_is_null_or_empty.sql`](000.fn_is_null_or_empty.sql) (IMMUTABLE validator).
