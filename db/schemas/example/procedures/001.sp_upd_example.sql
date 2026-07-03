\echo "## CREATE PROCEDURE :schema_app.sp_upd_example"

DROP PROCEDURE IF EXISTS :schema_app.sp_upd_example(bigint, varchar, boolean, varchar);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id            bigint
--       Identifier of the example row to be updated
--    p_name          varchar
--       New display name (non-empty, UNIQUE)
--    p_is_active     boolean
--       New active flag
--    p_actor_email   varchar
--       Email of the authenticated app user, stored in modified_by (audit)
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_upd_example
(
    IN    p_id            bigint
   ,IN    p_name          varchar
   ,IN    p_is_active     boolean
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

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   l_name              varchar;
   l_current_name      varchar;
   l_current_active    boolean;
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

      IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
         l_error_message := format($$%1$s: p_name must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      -- Length check: PostgreSQL does NOT enforce the varchar(n) modifier on
      -- parameters — speaking message before the DML instead of a raw 22001.
      IF length(trim(p_name)) > 200 THEN
         l_error_message := format($$%1$s: parameter 'p_name' = '%2$s' is too long (%3$s chars, max 200) and does not fit target column app.example.name$$, l_component, p_name, length(trim(p_name)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_is_active IS NULL THEN
         l_error_message := format($$%1$s: p_is_active must not be NULL$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_actor_email IS NULL OR length(trim(p_actor_email)) = 0 THEN
         l_error_message := format($$%1$s: p_actor_email must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_actor_email)) > 100 THEN
         l_error_message := format($$%1$s: parameter 'p_actor_email' = '%2$s' is too long (%3$s chars, max 100) and does not fit target column app.example.modified_by$$, l_component, p_actor_email, length(trim(p_actor_email)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN

      SELECT
          name
         ,is_active
      INTO
          l_current_name
         ,l_current_active
      FROM
         app.example
      WHERE
         id = p_id;

      IF NOT FOUND THEN

         l_error_message := format($$%1$s: example with id=%2$s does not exist$$, l_component, p_id);
         l_error_code    := 'no_data_found';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

      END IF;

      l_name := trim(p_name);

      -- No-op guard: skip the UPDATE (and the audit stamp) when nothing changes.
      IF l_name = l_current_name AND p_is_active = l_current_active THEN
         RETURN;   -- nothing changed -> no-op, no error
      END IF;

      -- modified_by carries the app user's email (audit convention, see tables.md)
      -- — the tr_u_example trigger stamps modified_on and preserves this value.
      UPDATE app.example
         SET
             name        = l_name
            ,is_active   = p_is_active
            ,modified_by = lower(trim(p_actor_email))
      WHERE
         id = p_id;

   EXCEPTION WHEN unique_violation THEN

      l_error_message := format($$%1$s: name '%2$s' is already used by another example$$, l_component, l_name);
      l_error_code    := 'unique_violation';

      RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_upd_example(bigint, varchar, boolean, varchar) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_upd_example - DONE"
