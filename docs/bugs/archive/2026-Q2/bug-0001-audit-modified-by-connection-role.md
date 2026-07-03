# BUG-0001: Audit column `modified_by` recorded the DB role, not the app user

- **Area:** [db/schemas/example/procedures/](../../../../db/schemas/example/procedures/) (`001.sp_upd_example.sql`), [db/schemas/example/trigger/](../../../../db/schemas/example/trigger/) (`000.tf_set_modified.sql`)
- **Status:** Fixed (2026-06-24)
- **Severity:** High
- **Source:** qa

**Description:** When a row in `app.example` was updated via `sp_upd_example`, the `modified_by`
audit column was filled with the PostgreSQL **connection role** (`app_local_sa`) instead of the
authenticated application user's email. Every change in the audit trail looked like it came from
the service account, making "who changed this?" unanswerable.

**Root Cause:** `sp_upd_example` never wrote its `p_actor_email` parameter — it relied on the
`tf_set_modified` trigger, which unconditionally stamped `modified_by := current_user`. This
violates the audit-column convention in
[.claude/rules/sql/postgres/tables.md](../../../../.claude/rules/sql/postgres/tables.md): audit
columns store the **app user's email**, never `CURRENT_USER` (that is only the connection role,
useless for app-level audit).

**Affected file(s):**
- [db/schemas/example/procedures/001.sp_upd_example.sql](../../../../db/schemas/example/procedures/001.sp_upd_example.sql) — the `UPDATE … SET` list
- [db/schemas/example/trigger/000.tf_set_modified.sql](../../../../db/schemas/example/trigger/000.tf_set_modified.sql) — unconditional `current_user` overwrite

**Reproduction:**
1. Connect as the runtime service account `app_local_sa`.
2. `CALL app.sp_upd_example(1, 'X', true, 'marcus@example.com');`
3. `SELECT modified_by FROM app.example WHERE id = 1;` → returns `app_local_sa` instead of
   `marcus@example.com`.

**Fix:** Set `modified_by = lower(trim(p_actor_email))` explicitly in the `UPDATE` inside
`sp_upd_example`, and make `tf_set_modified` **preserve** an explicitly supplied actor — falling
back to `current_user` only when the caller left the column untouched.

**Fix commands:**
1. `/backend BUG-0001` — implement the fix.
2. `/qa` — re-test against the repro above.
3. `/bug close BUG-0001` — close + move into the quarterly archive.

**Solution:**
- **Root Cause (confirmed):** the procedure never wrote `p_actor_email`; the trigger then
  overwrote `modified_by` with the connection role on every UPDATE.
- **Changed files:**
  - [db/schemas/example/procedures/001.sp_upd_example.sql](../../../../db/schemas/example/procedures/001.sp_upd_example.sql): the `UPDATE` now sets `modified_by = lower(trim(p_actor_email))`.
  - [db/schemas/example/trigger/000.tf_set_modified.sql](../../../../db/schemas/example/trigger/000.tf_set_modified.sql): the trigger keeps an explicitly changed `modified_by` (`IS NOT DISTINCT FROM` guard) and stamps `current_user` only as a fallback.
- **Solution steps:**
  1. Added the actor assignment to the `SET` list of the `UPDATE` in `sp_upd_example`.
  2. Added the preserve-guard to `tf_set_modified` so procedure-supplied actors survive the trigger.
  3. Extended [db/tests/example/000.audit_columns.sql](../../../../db/tests/example/000.audit_columns.sql) with both cases (explicit actor preserved, fallback to `current_user`).
  4. Re-ran `db/tests/run.sh` against a throwaway DB — exit code 0.
- **Why it works:** the application already passes the authenticated user's email; writing it
  explicitly makes the audit column reflect the real actor, and the trigger fallback still covers
  raw `UPDATE`s that bypass the procedures.
