\echo "## TEST app.example - surrogate identity PK"

-- Structural: every table carries a system-managed identity surrogate key
-- (GENERATED ALWAYS AS IDENTITY, not serial/bigserial) with a named pk_ constraint.
-- Assertions abort the run via ASSERT + psql -v ON_ERROR_STOP=1 (see db/tests/README.md).

DO $$
BEGIN
   -- id is a catalog-marked identity column (is_identity = YES)
   ASSERT
   (
      SELECT is_identity = 'YES'
      FROM   information_schema.columns
      WHERE  table_schema = 'app'
        AND  table_name   = 'example'
        AND  column_name  = 'id'
   ), 'app.example.id must be GENERATED ALWAYS AS IDENTITY';

   -- the primary key is the named constraint pk_example
   ASSERT EXISTS
   (
      SELECT 1
      FROM   information_schema.table_constraints
      WHERE  table_schema    = 'app'
        AND  table_name      = 'example'
        AND  constraint_type = 'PRIMARY KEY'
        AND  constraint_name = 'pk_example'
   ), 'app.example must have a PRIMARY KEY named pk_example';
END $$;

\echo "## TEST app.example - surrogate identity PK - DONE"
