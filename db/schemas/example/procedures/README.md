# procedures/

Stored **procedures** (`sp_…`) — one file per procedure.

- **File name:** `NNN.sp_<verb>_<entity>.sql` — `NNN` = number of the procedure's main (write-target) table.
- Verbs: `ins` / `upd` / `del` / `dup` / `get` (+ project-specific). Identifier parameter first; params prefixed `p_`.
- **Idempotent:** `DROP PROCEDURE IF EXISTS … (signature);` then `CREATE OR REPLACE PROCEDURE`.
- Body sections: Get name → Check parameter → Workload (guards before mutations).

Full convention: `.claude/rules/sql/postgres/procedures.md`.

Shipped examples: [`001.sp_ins_example.sql`](001.sp_ins_example.sql),
[`001.sp_upd_example.sql`](001.sp_upd_example.sql) (no-op guard, actor-email audit),
[`001.sp_del_example.sql`](001.sp_del_example.sql) (speaking reference guard),
[`002.sp_ins_example_item.sql`](002.sp_ins_example_item.sql) (parent existence check),
[`003.sp_ins_schema_apply.sql`](003.sp_ins_schema_apply.sql) (deploy tracker insert).
