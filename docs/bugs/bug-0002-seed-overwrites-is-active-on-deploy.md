# BUG-0002: Seed re-applies `is_active` on every deploy, overwriting manual changes

- **Area:** [db/schemas/example/data/](../../db/schemas/example/data/) (`001.example.sql`)
- **Status:** Open
- **Severity:** Medium
- **Source:** deploy

**Description:** The seed script for `app.example` upserts its rows on every deploy with
`ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active`. If an operator deactivated
`Example Alpha` (or activated `Example Beta`) in the database, the next `deploy.sh` run silently
resets the flag to the seeded value. Manual state changes do not survive a routine deploy.

**Root Cause:** The upsert treats `is_active` as reference data owned by the seed, while the
application treats it as mutable operational state. Seed and runtime disagree about who owns the
column.

**Affected file(s):**
- [db/schemas/example/data/001.example.sql](../../db/schemas/example/data/001.example.sql) — the `DO UPDATE SET` list

**Reproduction:**
1. `bash db/scripts/deploy.sh all local` (seeds `Example Alpha` with `is_active = true`).
2. `UPDATE app.example SET is_active = false WHERE name = 'Example Alpha';`
3. `bash db/scripts/deploy.sh all local` again.
4. `SELECT is_active FROM app.example WHERE name = 'Example Alpha';` → back to `true`.

**Fix:** Decide the ownership per column: keep the upsert only for genuinely seed-owned attributes
and stop re-applying operational state — e.g. change the conflict action to `DO NOTHING`, or
restrict the `DO UPDATE SET` list to immutable reference attributes (not `is_active`).

**Fix commands:**
1. `/backend BUG-0002` — implement the fix.
2. `/qa` — re-test against the repro above.
3. `/bug close BUG-0002` — close + move into the quarterly archive.
