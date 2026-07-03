\echo "## CREATE VIEW :schema_app.vw_example_overview"

-- Read-only overview: every example row with its item count. Demonstrates the view
-- conventions (vw_ prefix, explicit column list, T01/T02 positional aliases).

CREATE OR REPLACE VIEW :schema_app.vw_example_overview AS
SELECT
    T01.id
   ,T01.name
   ,T01.is_active
   ,count(T02.id) AS item_count
FROM
   :schema_app.example T01
   LEFT JOIN :schema_app.example_item T02
   ON
     T02.example_id = T01.id
GROUP BY
    T01.id
   ,T01.name
   ,T01.is_active;

ALTER VIEW :schema_app.vw_example_overview OWNER TO :schema_owner;

COMMENT ON VIEW :schema_app.vw_example_overview IS 'Overview of app.example with the number of items per row (worked example for the view conventions).';

\echo "## CREATE VIEW :schema_app.vw_example_overview - DONE"
