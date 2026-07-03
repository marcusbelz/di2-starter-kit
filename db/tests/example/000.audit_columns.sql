\echo "## TEST app.example - audit columns + modified trigger"

-- Structural: the four audit columns exist with the expected nullability.
-- Behavioral: the BEFORE UPDATE trigger tr_u_example stamps modified_on on UPDATE.

DO $$
DECLARE
   l_nullable_created   varchar;
   l_nullable_modified  varchar;
BEGIN
   SELECT is_nullable INTO l_nullable_created
   FROM   information_schema.columns
   WHERE  table_schema = 'app' AND table_name = 'example' AND column_name = 'created_by';

   SELECT is_nullable INTO l_nullable_modified
   FROM   information_schema.columns
   WHERE  table_schema = 'app' AND table_name = 'example' AND column_name = 'modified_on';

   ASSERT l_nullable_created  = 'NO',  'created_by must be NOT NULL';
   ASSERT l_nullable_modified = 'YES', 'modified_on must be nullable (set on UPDATE, not on INSERT)';
END $$;

DO $$
DECLARE
   l_id        bigint;
   l_modified  timestamptz;
BEGIN
   CALL app.sp_ins_example(l_id, 'Trigger Probe', 'tester@example.com');

   ASSERT
   (
      SELECT modified_on FROM app.example WHERE id = l_id
   ) IS NULL, 'modified_on must be NULL right after INSERT';

   UPDATE app.example SET is_active = false WHERE id = l_id;

   SELECT modified_on INTO l_modified FROM app.example WHERE id = l_id;
   ASSERT l_modified IS NOT NULL, 'tr_u_example must set modified_on on UPDATE';
END $$;

-- Behavioral: tf_set_modified preserves an explicitly supplied actor (audit
-- convention) and falls back to the connection role only when none was supplied.
DO $$
DECLARE
   l_id  bigint;
BEGIN
   CALL app.sp_ins_example(l_id, 'Actor Probe', 'tester@example.com');

   -- explicit actor (as the procedures set it) must survive the trigger
   UPDATE app.example SET is_active = false, modified_by = 'actor@example.com' WHERE id = l_id;
   ASSERT
   (
      SELECT modified_by FROM app.example WHERE id = l_id
   ) = 'actor@example.com', 'tf_set_modified must preserve an explicitly set modified_by';

   -- raw UPDATE without an actor -> fallback to the connection role
   UPDATE app.example SET is_active = true WHERE id = l_id;
   ASSERT
   (
      SELECT modified_by FROM app.example WHERE id = l_id
   ) = current_user, 'tf_set_modified must fall back to current_user when no actor is set';
END $$;

\echo "## TEST app.example - audit columns + modified trigger - DONE"
