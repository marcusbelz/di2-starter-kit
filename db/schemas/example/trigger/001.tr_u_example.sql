\echo "## CREATE TRIGGER tr_u_example"

DROP TRIGGER IF EXISTS tr_u_example ON :schema_app.example;

CREATE TRIGGER tr_u_example
BEFORE UPDATE ON :schema_app.example
FOR EACH ROW
   EXECUTE FUNCTION :schema_app.tf_set_modified();

\echo "## CREATE TRIGGER tr_u_example - DONE"
