\echo "## TEST app.sp_ins_example - happy path + guards"

-- Behavioral: the insert procedure's happy path, its parameter guard, and the
-- table's UNIQUE constraint. Each guard test asserts the EXPECTED error is raised
-- (and fails loudly via ASSERT false if it is not).

-- Happy path: returns a new id and normalizes the actor email into created_by.
DO $$
DECLARE
   l_id   bigint;
   l_cnt  int;
BEGIN
   CALL app.sp_ins_example(l_id, 'Widget A', 'Tester@Example.COM');

   ASSERT l_id IS NOT NULL, 'sp_ins_example must return the new id';

   SELECT count(*) INTO l_cnt
   FROM   app.example
   WHERE  id = l_id
     AND  name = 'Widget A'
     AND  created_by = 'tester@example.com';   -- lower(trim(...)) applied by the proc

   ASSERT l_cnt = 1, 'inserted row must exist with normalized created_by';
END $$;

-- Guard: empty name must raise invalid_parameter_value (22023).
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_example(l_id, '   ', 'tester@example.com');
   ASSERT false, 'expected invalid_parameter_value for empty name was not raised';
EXCEPTION
   WHEN invalid_parameter_value THEN
      NULL;   -- expected
END $$;

-- UNIQUE: a duplicate name must raise unique_violation (23505).
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_example(l_id, 'Duplicate Name', 'tester@example.com');

   BEGIN
      CALL app.sp_ins_example(l_id, 'Duplicate Name', 'tester@example.com');
      ASSERT false, 'expected unique_violation for duplicate name was not raised';
   EXCEPTION
      WHEN unique_violation THEN
         NULL;   -- expected
   END;
END $$;

-- Update: renames the row, stamps modified_by with the actor email (audit
-- convention), and raises no_data_found (P0002) for a missing id.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_example(l_id, 'Update Probe', 'tester@example.com');

   CALL app.sp_upd_example(l_id, 'Update Probe Renamed', true, 'Editor@Example.COM');

   ASSERT
   (
      SELECT count(*) FROM app.example
      WHERE  id = l_id
        AND  name = 'Update Probe Renamed'
        AND  modified_by = 'editor@example.com'   -- actor email, not the connection role
        AND  modified_on IS NOT NULL
   ) = 1, 'sp_upd_example must rename the row and stamp modified_by with the actor email';

   BEGIN
      CALL app.sp_upd_example(-1, 'Does Not Exist', true, 'tester@example.com');
      ASSERT false, 'expected no_data_found for missing id was not raised';
   EXCEPTION
      WHEN no_data_found THEN
         NULL;   -- expected
   END;
END $$;

-- Delete: removes an unreferenced row; raises no_data_found for a missing id.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_example(l_id, 'Delete Probe', 'tester@example.com');

   CALL app.sp_del_example(l_id);

   ASSERT
   (
      SELECT count(*) FROM app.example WHERE id = l_id
   ) = 0, 'sp_del_example must remove the row';

   BEGIN
      CALL app.sp_del_example(l_id);
      ASSERT false, 'expected no_data_found for already-deleted id was not raised';
   EXCEPTION
      WHEN no_data_found THEN
         NULL;   -- expected
   END;
END $$;

\echo "## TEST app.sp_ins_example - happy path + guards - DONE"
