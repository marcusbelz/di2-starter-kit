\echo "## CREATE FUNCTION :schema_app.fn_is_null_or_empty"

DROP FUNCTION IF EXISTS :schema_app.fn_is_null_or_empty(varchar);

-- Pure validator (no error RAISE): omits the "Get name" section per functions.md.
-- IMMUTABLE — result depends only on the input value.

-- --------------------------------------------------------------------------------
-- Parameter
-- --------------------------------------------------------------------------------
--    p_value        varchar
--       Value to test; NULL, empty, and whitespace-only all count as empty
-- --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION :schema_app.fn_is_null_or_empty
(
    IN    p_value        varchar
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN

   RETURN p_value IS NULL OR length(trim(p_value)) = 0;

END;
$function$;

ALTER FUNCTION :schema_app.fn_is_null_or_empty(varchar) OWNER TO :schema_owner;

\echo "## CREATE FUNCTION :schema_app.fn_is_null_or_empty - DONE"
