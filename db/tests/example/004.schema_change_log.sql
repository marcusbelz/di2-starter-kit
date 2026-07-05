\echo "## TEST app.schema_change_log - run-once tracker"

-- Behavioral: sp_ins_schema_change writes one run-once row (applied_on/applied_by
-- from the column defaults), the filename is UNIQUE, and inputs are validated.

-- Cleanup first so the test file is re-runnable despite the UNIQUE run-once key
-- (test fixtures use the reserved 000000000000.* prefix — never real transitions).
DELETE FROM app.schema_change_log WHERE filename LIKE 'example/postdeploy/00000000000%';

DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_schema_change(l_id, 'example/postdeploy/000000000000.test-run.sql', 'cafebabe', 'deadbeef');

   ASSERT l_id IS NOT NULL, 'sp_ins_schema_change must return the new id';

   ASSERT
   (
      SELECT count(*) FROM app.schema_change_log
      WHERE  id = l_id
        AND  filename = 'example/postdeploy/000000000000.test-run.sql'
        AND  checksum = 'cafebabe'
        AND  git_sha = 'deadbeef'
        AND  applied_on IS NOT NULL
        AND  applied_by = current_user   -- deploy actor IS the connection role here
   ) = 1, 'schema_change_log row must exist with defaults applied';
END $$;

-- Guard: the filename is the run-once key — a second insert must violate UNIQUE.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_schema_change(l_id, 'example/postdeploy/000000000000.test-run.sql', 'cafebabe', 'deadbeef');
   ASSERT false, 'expected unique_violation for duplicate filename was not raised';
EXCEPTION
   WHEN unique_violation THEN
      NULL;   -- expected
END $$;

-- Guard: empty checksum must raise invalid_parameter_value.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_schema_change(l_id, 'example/postdeploy/000000000001.test-run.sql', '  ', 'deadbeef');
   ASSERT false, 'expected invalid_parameter_value for empty checksum was not raised';
EXCEPTION
   WHEN invalid_parameter_value THEN
      NULL;   -- expected
END $$;

\echo "## TEST app.schema_change_log - run-once tracker - DONE"
