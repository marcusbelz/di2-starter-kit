\echo "## CREATE PROCEDURE :schema_app.sp_del_example"

DROP PROCEDURE IF EXISTS :schema_app.sp_del_example(bigint);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id          bigint
--       Identifier of the example row to be deleted
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_del_example
(
    IN    p_id          bigint
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
   -- --------------------------------------------------------------------------------
   -- Common
   -- --------------------------------------------------------------------------------
   l_context           varchar;
   l_component         varchar;
   l_source            varchar(7);

   -- --------------------------------------------------------------------------------
   -- Error Handling
   -- --------------------------------------------------------------------------------
   l_error_message     text;
   l_error_code        text;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   l_ref_count         bigint;
BEGIN
   -- --------------------------------------------------------------------------------
   -- Get name of function/procedure
   -- --------------------------------------------------------------------------------
   SET LOCAL lc_messages TO 'C';   -- forces English server messages for this transaction
   GET DIAGNOSTICS l_context = PG_CONTEXT;
   l_component := substring(l_context from 'function (.*?)\(');
   l_source    := 'plpgsql';

   RAISE NOTICE '### procedure : %', l_component;

   -- --------------------------------------------------------------------------------
   -- Check parameter
   -- --------------------------------------------------------------------------------
   BEGIN
      IF p_id IS NULL THEN
         l_error_message := format($$%1$s: p_id must not be NULL$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN
      IF NOT EXISTS (SELECT 1 FROM app.example WHERE id = p_id) THEN

         l_error_message := format($$%1$s: example with id=%2$s does not exist$$, l_component, p_id);
         l_error_code    := 'no_data_found';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

      END IF;

      SELECT
         count(*)
      INTO
         l_ref_count
      FROM
         app.example_item
      WHERE
         example_id = p_id;

      IF l_ref_count > 0 THEN

         l_error_message := format($$%1$s: example id=%2$s is referenced by %3$s item(s) and cannot be deleted$$, l_component, p_id, l_ref_count);
         l_error_code    := 'foreign_key_violation';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

      END IF;

      -- DELETE wrapped separately: catches only a reference that appeared between
      -- the count above and the DELETE (race). Without this wrapper the FK handler
      -- would swallow the speaking count-based message above.
      BEGIN

         DELETE FROM app.example
         WHERE
            id = p_id;

      EXCEPTION WHEN foreign_key_violation THEN

         l_error_message := format($$%1$s: example id=%2$s is referenced and cannot be deleted$$, l_component, p_id);
         l_error_code    := 'foreign_key_violation';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

      END;
   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_del_example(bigint) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_del_example - DONE"
