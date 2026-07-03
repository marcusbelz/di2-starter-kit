\echo "## CREATE PROCEDURE :schema_app.sp_ins_example_item"

DROP PROCEDURE IF EXISTS :schema_app.sp_ins_example_item(bigint, bigint, varchar, int, varchar);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id            bigint
--       INOUT — surrogate key of the new item row, returned to the caller
--    p_example_id    bigint
--       Parent row in app.example the item belongs to
--    p_label         varchar
--       Item label (non-empty; UNIQUE per parent)
--    p_sort_order    int
--       Display/sort position within the parent (NULL -> 0)
--    p_actor_email   varchar
--       Email of the authenticated app user, stored in created_by (audit)
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_ins_example_item
(
    INOUT p_id            bigint
   ,IN    p_example_id    bigint
   ,IN    p_label         varchar
   ,IN    p_sort_order    int
   ,IN    p_actor_email   varchar
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
      IF p_example_id IS NULL THEN
         l_error_message := format($$%1$s: p_example_id must not be NULL$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
         l_error_message := format($$%1$s: p_label must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_label)) > 200 THEN
         l_error_message := format($$%1$s: parameter 'p_label' = '%2$s' is too long (%3$s chars, max 200) and does not fit target column app.example_item.label$$, l_component, p_label, length(trim(p_label)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_actor_email IS NULL OR length(trim(p_actor_email)) = 0 THEN
         l_error_message := format($$%1$s: p_actor_email must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_actor_email)) > 100 THEN
         l_error_message := format($$%1$s: parameter 'p_actor_email' = '%2$s' is too long (%3$s chars, max 100) and does not fit target column app.example_item.created_by$$, l_component, p_actor_email, length(trim(p_actor_email)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN
      -- Speaking existence check before the INSERT — otherwise the FK raises a raw
      -- 23503 whose message names constraint internals instead of the domain problem.
      IF NOT EXISTS (SELECT 1 FROM app.example WHERE id = p_example_id) THEN

         l_error_message := format($$%1$s: example with id=%2$s does not exist$$, l_component, p_example_id);
         l_error_code    := 'no_data_found';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

      END IF;

      INSERT INTO app.example_item
          (
              example_id
             ,label
             ,sort_order
             ,created_by
          )
      VALUES
          (
              p_example_id
             ,trim(p_label)
             ,coalesce(p_sort_order, 0)
             ,lower(trim(p_actor_email))
          )
      RETURNING id INTO p_id;

   EXCEPTION WHEN unique_violation THEN

      l_error_message := format($$%1$s: item with label '%2$s' already exists for example id=%3$s$$, l_component, trim(p_label), p_example_id);
      l_error_code    := 'unique_violation';

      RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_ins_example_item(bigint, bigint, varchar, int, varchar) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_ins_example_item - DONE"
