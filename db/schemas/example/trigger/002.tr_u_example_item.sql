\echo "## CREATE TRIGGER tr_u_example_item"

DROP TRIGGER IF EXISTS tr_u_example_item ON :schema_app.example_item;

CREATE TRIGGER tr_u_example_item
BEFORE UPDATE ON :schema_app.example_item
FOR EACH ROW
   EXECUTE FUNCTION :schema_app.tf_set_modified();

\echo "## CREATE TRIGGER tr_u_example_item - DONE"
