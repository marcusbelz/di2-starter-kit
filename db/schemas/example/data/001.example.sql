\echo "## CREATE SEED :schema_app.example"

-- Idempotent seed: safe to re-run on every deploy (ON CONFLICT keyed on the natural
-- key). Seed rows carry '<system>' as the audit actor — they are not user actions.

INSERT INTO :schema_app.example (name, is_active, created_by)
VALUES
    ('Example Alpha', true,  '<system>')
   ,('Example Beta',  false, '<system>')
ON CONFLICT (name) DO UPDATE
SET
    is_active   = EXCLUDED.is_active
   ,modified_by = '<system>';

\echo "## CREATE SEED :schema_app.example - DONE"
