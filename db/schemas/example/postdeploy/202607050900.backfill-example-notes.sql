\echo "## BACKFILL :schema_app.example.notes"

-- Run-once transition (tracked in schema_change_log — see ./README.md and
-- .claude/rules/db-migrations.md): one-time backfill of example.notes, which
-- tables/001.example.sql adds convergently via ADD COLUMN IF NOT EXISTS.
--
-- Guarded with "notes IS NULL" so the script also succeeds on an
-- empty-but-current schema (greenfield deploy) and never overwrites a value
-- an app user has set in the meantime.

UPDATE :schema_app.example
SET
   notes = 'backfilled: pre-existing row'
WHERE
   notes IS NULL;

\echo "## BACKFILL :schema_app.example.notes - DONE"
