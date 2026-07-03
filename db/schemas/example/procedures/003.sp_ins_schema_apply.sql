\echo "## CREATE PROCEDURE :schema_app.sp_ins_schema_apply"

DROP PROCEDURE IF EXISTS :schema_app.sp_ins_schema_apply(bigint, varchar, varchar, varchar, varchar);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id            bigint
--       INOUT — surrogate key of the new history row, returned to the caller
--    p_db_version    varchar
--       Version label of the apply run (e.g. 1.0.42)
--    p_git_sha       varchar
--       Git commit SHA the apply run was executed from
--    p_environment   varchar
--       Target environment of the apply run (e.g. local/dev/int/test/prod)
--    p_note          varchar
--       Optional free-text note (NULL allowed)
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_ins_schema_apply
(
    INOUT p_id            bigint
   ,IN    p_db_version    varchar
   ,IN    p_git_sha       varchar
   ,IN    p_environment   varchar
   ,IN    p_note          varchar
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
      IF p_db_version IS NULL OR length(trim(p_db_version)) = 0 THEN
         l_error_message := format($$%1$s: p_db_version must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_db_version)) > 50 THEN
         l_error_message := format($$%1$s: parameter 'p_db_version' = '%2$s' is too long (%3$s chars, max 50) and does not fit target column app.schema_apply_log.db_version$$, l_component, p_db_version, length(trim(p_db_version)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_git_sha IS NULL OR length(trim(p_git_sha)) = 0 THEN
         l_error_message := format($$%1$s: p_git_sha must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_git_sha)) > 64 THEN
         l_error_message := format($$%1$s: parameter 'p_git_sha' = '%2$s' is too long (%3$s chars, max 64) and does not fit target column app.schema_apply_log.git_sha$$, l_component, p_git_sha, length(trim(p_git_sha)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_environment IS NULL OR length(trim(p_environment)) = 0 THEN
         l_error_message := format($$%1$s: p_environment must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_environment)) > 10 THEN
         l_error_message := format($$%1$s: parameter 'p_environment' = '%2$s' is too long (%3$s chars, max 10) and does not fit target column app.schema_apply_log.environment$$, l_component, p_environment, length(trim(p_environment)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_note IS NOT NULL AND length(p_note) > 500 THEN
         l_error_message := format($$%1$s: parameter 'p_note' = '%2$s' is too long (%3$s chars, max 500) and does not fit target column app.schema_apply_log.note$$, l_component, p_note, length(p_note));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;
   END;

   -- --------------------------------------------------------------------------------
   -- Workload
   -- --------------------------------------------------------------------------------
   BEGIN
      -- applied_on / applied_by come from the column defaults (deploy actor = the
      -- connection role; the table is exempt from the app-user audit convention).
      INSERT INTO app.schema_apply_log
          (
              db_version
             ,git_sha
             ,environment
             ,note
          )
      VALUES
          (
              trim(p_db_version)
             ,trim(p_git_sha)
             ,trim(p_environment)
             ,nullif(trim(coalesce(p_note, '')), '')
          )
      RETURNING id INTO p_id;
   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_ins_schema_apply(bigint, varchar, varchar, varchar, varchar) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_ins_schema_apply - DONE"
