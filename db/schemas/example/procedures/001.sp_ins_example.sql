\echo "## CREATE PROCEDURE :schema_app.sp_ins_example"

DROP PROCEDURE IF EXISTS :schema_app.sp_ins_example(bigint, varchar, varchar);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id            bigint
--       INOUT — surrogate key of the new row, returned to the caller
--    p_name          varchar
--       Display name of the example row (non-empty, UNIQUE)
--    p_actor_email   varchar
--       Email of the authenticated app user, stored in created_by (audit)
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_ins_example
(
    INOUT p_id            bigint
   ,IN    p_name          varchar
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
      IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
         l_error_message := format($$%1$s: p_name must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      -- Length check: PostgreSQL does NOT enforce the varchar(n) modifier on
      -- parameters — without this guard a too-long value raises a raw 22001 only
      -- at INSERT time. Speaking message before the DML instead.
      IF length(trim(p_name)) > 200 THEN
         l_error_message := format($$%1$s: parameter 'p_name' = '%2$s' is too long (%3$s chars, max 200) and does not fit target column app.example.name$$, l_component, p_name, length(trim(p_name)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_actor_email IS NULL OR length(trim(p_actor_email)) = 0 THEN
         l_error_message := format($$%1$s: p_actor_email must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_actor_email)) > 100 THEN
         l_error_message := format($$%1$s: parameter 'p_actor_email' = '%2$s' is too long (%3$s chars, max 100) and does not fit target column app.example.created_by$$, l_component, p_actor_email, length(trim(p_actor_email)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN
      INSERT INTO app.example
          (
              name
             ,created_by
          )
      VALUES
          (
              trim(p_name)
             ,lower(trim(p_actor_email))
          )
      RETURNING id INTO p_id;

   EXCEPTION WHEN unique_violation THEN

      l_error_message := format($$%1$s: example with name '%2$s' already exists$$, l_component, trim(p_name));
      l_error_code    := 'unique_violation';

      RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;

   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_ins_example(bigint, varchar, varchar) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_ins_example - DONE"
