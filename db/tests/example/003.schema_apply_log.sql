\echo "## TEST app.schema_apply_log - deploy tracker"

-- Behavioral: sp_ins_schema_apply writes one history row (applied_on/applied_by
-- from the column defaults) and validates its inputs.

DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_schema_apply(l_id, '0.0.1-test', 'deadbeef', 'local', 'test run');

   ASSERT l_id IS NOT NULL, 'sp_ins_schema_apply must return the new id';

   ASSERT
   (
      SELECT count(*) FROM app.schema_apply_log
      WHERE  id = l_id
        AND  db_version = '0.0.1-test'
        AND  git_sha = 'deadbeef'
        AND  environment = 'local'
        AND  note = 'test run'
        AND  applied_on IS NOT NULL
        AND  applied_by = current_user   -- deploy actor IS the connection role here
   ) = 1, 'schema_apply_log row must exist with defaults applied';
END $$;

-- Guard: empty db_version must raise invalid_parameter_value.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_schema_apply(l_id, '  ', 'deadbeef', 'local', NULL);
   ASSERT false, 'expected invalid_parameter_value for empty db_version was not raised';
EXCEPTION
   WHEN invalid_parameter_value THEN
      NULL;   -- expected
END $$;

\echo "## TEST app.schema_apply_log - deploy tracker - DONE"
