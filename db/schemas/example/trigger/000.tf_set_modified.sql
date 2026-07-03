\echo "## CREATE FUNCTION :schema_app.tf_set_modified()"

-- Generic BEFORE UPDATE trigger function: stamps the audit columns on every UPDATE.
-- One shared copy per schema, numbered 000 so it loads before the tr_u_<table>
-- triggers that use it. No DROP FUNCTION — trigger-safe (see trigger.md).

CREATE OR REPLACE FUNCTION :schema_app.tf_set_modified()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $triggerfunction$
BEGIN

   IF TG_OP = 'UPDATE' THEN
      NEW.modified_on := now();

      -- Keep an explicitly supplied actor: procedures write the authenticated app
      -- user's email into modified_by (audit convention, see tables.md). Fall back
      -- to the connection role only when the caller left the column untouched.
      IF NEW.modified_by IS NOT DISTINCT FROM OLD.modified_by THEN
         NEW.modified_by := current_user;
      END IF;

      RETURN NEW;
   ELSE
      RETURN NULL;
   END IF;

END;
$triggerfunction$;

ALTER FUNCTION :schema_app.tf_set_modified() OWNER TO :schema_owner;

\echo "## CREATE FUNCTION :schema_app.tf_set_modified() - DONE"
