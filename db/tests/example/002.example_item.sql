\echo "## TEST app.example_item - FK guards + view"

-- Behavioral: item insert happy path, the speaking parent check, the per-parent
-- UNIQUE constraint, the reference-guarded delete of the parent, and the
-- vw_example_overview item count.

-- Happy path + view count.
DO $$
DECLARE
   l_example_id  bigint;
   l_item_id     bigint;
BEGIN
   CALL app.sp_ins_example(l_example_id, 'Item Parent', 'tester@example.com');

   CALL app.sp_ins_example_item(l_item_id, l_example_id, 'First Item',  10, 'tester@example.com');
   ASSERT l_item_id IS NOT NULL, 'sp_ins_example_item must return the new id';

   CALL app.sp_ins_example_item(l_item_id, l_example_id, 'Second Item', 20, 'tester@example.com');

   ASSERT
   (
      SELECT item_count FROM app.vw_example_overview WHERE id = l_example_id
   ) = 2, 'vw_example_overview must report 2 items for the parent';
END $$;

-- Guard: a missing parent must raise no_data_found (speaking message, not a raw 23503).
DO $$
DECLARE
   l_item_id  bigint;
BEGIN
   CALL app.sp_ins_example_item(l_item_id, -1, 'Orphan Item', 0, 'tester@example.com');
   ASSERT false, 'expected no_data_found for missing parent was not raised';
EXCEPTION
   WHEN no_data_found THEN
      NULL;   -- expected
END $$;

-- UNIQUE: the same label twice under one parent must raise unique_violation.
DO $$
DECLARE
   l_example_id  bigint;
   l_item_id     bigint;
BEGIN
   CALL app.sp_ins_example(l_example_id, 'Duplicate Item Parent', 'tester@example.com');
   CALL app.sp_ins_example_item(l_item_id, l_example_id, 'Same Label', 0, 'tester@example.com');

   BEGIN
      CALL app.sp_ins_example_item(l_item_id, l_example_id, 'Same Label', 1, 'tester@example.com');
      ASSERT false, 'expected unique_violation for duplicate label was not raised';
   EXCEPTION
      WHEN unique_violation THEN
         NULL;   -- expected
   END;
END $$;

-- Reference guard: deleting a parent with items must fail with foreign_key_violation
-- and the speaking count-based message from sp_del_example.
DO $$
DECLARE
   l_example_id  bigint;
   l_item_id     bigint;
BEGIN
   CALL app.sp_ins_example(l_example_id, 'Guarded Parent', 'tester@example.com');
   CALL app.sp_ins_example_item(l_item_id, l_example_id, 'Blocking Item', 0, 'tester@example.com');

   BEGIN
      CALL app.sp_del_example(l_example_id);
      ASSERT false, 'expected foreign_key_violation for referenced parent was not raised';
   EXCEPTION
      WHEN foreign_key_violation THEN
         NULL;   -- expected
   END;
END $$;

\echo "## TEST app.example_item - FK guards + view - DONE"
