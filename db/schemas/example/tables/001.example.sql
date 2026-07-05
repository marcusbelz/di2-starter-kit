\echo "## CREATE TABLE :schema_app.example"

-- Worked example table for the db/tests slice (see db/tests/README.md).
-- Deploys into the :schema_app schema (db/config/example.env.sql -> schema_app = app).

CREATE TABLE IF NOT EXISTS :schema_app.example
(
    id            bigint        NOT NULL GENERATED ALWAYS AS IDENTITY
   ,name          varchar(200)  NOT NULL
   ,is_active     boolean       NOT NULL DEFAULT true

   ,created_on    timestamptz   NOT NULL DEFAULT now()
   ,created_by    varchar(100)  NOT NULL
   ,modified_on   timestamptz       NULL
   ,modified_by   varchar(100)      NULL

   ,CONSTRAINT pk_example  PRIMARY KEY (id)

   ,CONSTRAINT chk_example_name  CHECK (length(trim(name)) > 0)
);
ALTER TABLE :schema_app.example OWNER TO :schema_owner;

-- --------------------------------------------------------------------------------
-- Unique constraints
-- --------------------------------------------------------------------------------
ALTER TABLE :schema_app.example DROP CONSTRAINT IF EXISTS uq_example_name;
ALTER TABLE :schema_app.example ADD  CONSTRAINT uq_example_name UNIQUE (name);

-- --------------------------------------------------------------------------------
-- Convergent evolution (columns added after initial creation)
-- --------------------------------------------------------------------------------
-- The object file describes the DESIRED STATE and converges existing databases
-- toward it (see .claude/rules/sql/postgres/tables.md). notes was added after the
-- initial CREATE; the one-time backfill for pre-existing rows lives in
-- ../postdeploy/ (run-once transition, tracked in schema_change_log).
ALTER TABLE :schema_app.example ADD COLUMN IF NOT EXISTS notes varchar(500) NULL;

-- --------------------------------------------------------------------------------
-- Comments
-- --------------------------------------------------------------------------------
COMMENT ON TABLE  :schema_app.example            IS 'Worked example entity used by the db/tests example slice.';

COMMENT ON COLUMN :schema_app.example.name       IS 'Display name (natural key, UNIQUE; non-empty).';
COMMENT ON COLUMN :schema_app.example.is_active  IS 'Controls whether the row is actively used.';
COMMENT ON COLUMN :schema_app.example.notes      IS 'Optional free-text notes (added post-creation; worked example of convergent column evolution).';

\echo "## CREATE TABLE :schema_app.example - DONE"
