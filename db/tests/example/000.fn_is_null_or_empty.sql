\echo "## TEST app.fn_is_null_or_empty - validator function"

DO $$
BEGIN
   ASSERT app.fn_is_null_or_empty(NULL)        IS TRUE,  'NULL must count as empty';
   ASSERT app.fn_is_null_or_empty('')          IS TRUE,  'empty string must count as empty';
   ASSERT app.fn_is_null_or_empty('   ')       IS TRUE,  'whitespace-only must count as empty';
   ASSERT app.fn_is_null_or_empty('value')     IS FALSE, 'non-empty value must not count as empty';
   ASSERT app.fn_is_null_or_empty('  value  ') IS FALSE, 'padded value must not count as empty';
END $$;

\echo "## TEST app.fn_is_null_or_empty - validator function - DONE"
