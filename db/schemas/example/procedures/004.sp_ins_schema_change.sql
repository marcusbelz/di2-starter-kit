\echo "## CREATE PROCEDURE :schema_app.sp_ins_schema_change"

DROP PROCEDURE IF EXISTS :schema_app.sp_ins_schema_change(bigint, varchar, varchar, varchar);

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_id            bigint
--       INOUT — surrogate key of the new run-once row, returned to the caller
--    p_filename      varchar
--       Run-once key: schema dir + section + file name of the applied script
--    p_checksum      varchar
--       sha256 (hex) of the file at apply time (immutability guard)
--    p_git_sha       varchar
--       Git commit SHA the apply run was executed from
-- --------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE :schema_app.sp_ins_schema_change
(
    INOUT p_id            bigint
   ,IN    p_filename      varchar
   ,IN    p_checksum      varchar
   ,IN    p_git_sha       varchar
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
      IF p_filename IS NULL OR length(trim(p_filename)) = 0 THEN
         l_error_message := format($$%1$s: p_filename must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_filename)) > 200 THEN
         l_error_message := format($$%1$s: parameter 'p_filename' = '%2$s' is too long (%3$s chars, max 200) and does not fit target column app.schema_change_log.filename$$, l_component, p_filename, length(trim(p_filename)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_checksum IS NULL OR length(trim(p_checksum)) = 0 THEN
         l_error_message := format($$%1$s: p_checksum must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_checksum)) > 64 THEN
         l_error_message := format($$%1$s: parameter 'p_checksum' = '%2$s' is too long (%3$s chars, max 64) and does not fit target column app.schema_change_log.checksum$$, l_component, p_checksum, length(trim(p_checksum)));
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF p_git_sha IS NULL OR length(trim(p_git_sha)) = 0 THEN
         l_error_message := format($$%1$s: p_git_sha must not be empty$$, l_component);
         l_error_code    := 'invalid_parameter_value';

         RAISE EXCEPTION USING MESSAGE = l_error_message, ERRCODE = l_error_code;
      END IF;

      IF length(trim(p_git_sha)) > 64 THEN
         l_error_message := format($$%1$s: parameter 'p_git_sha' = '%2$s' is too long (%3$s chars, max 64) and does not fit target column app.schema_change_log.git_sha$$, l_component, p_git_sha, length(trim(p_git_sha)));
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
      INSERT INTO app.schema_change_log
          (
              filename
             ,checksum
             ,git_sha
          )
      VALUES
          (
              trim(p_filename)
             ,trim(p_checksum)
             ,trim(p_git_sha)
          )
      RETURNING id INTO p_id;
   END;

END;
$procedure$;

ALTER PROCEDURE :schema_app.sp_ins_schema_change(bigint, varchar, varchar, varchar) OWNER TO :schema_owner;

\echo "## CREATE PROCEDURE :schema_app.sp_ins_schema_change - DONE"
