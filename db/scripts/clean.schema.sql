-- --------------------------------------------------------------------------------
-- clean.schema.sql — drops all objects of a schema (the schema itself stays).
-- --------------------------------------------------------------------------------
-- Invoked by db/scripts/clean.sh; expects the psql variable :schema_target
-- (the deployed schema name, e.g. 'app'). The order is dependency-safe:
-- views/matviews first, then tables (CASCADE resolves FKs/triggers), then
-- routines, sequences last. All DROPs are IF EXISTS -> idempotent.
-- --------------------------------------------------------------------------------

\echo '## CLEAN schema objects in ' :schema_target

-- Views
SELECT 'DROP VIEW IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(viewname) || ' CASCADE;'
FROM   pg_views
WHERE  schemaname = :'schema_target';
\gexec

-- Materialized views
SELECT 'DROP MATERIALIZED VIEW IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(matviewname) || ' CASCADE;'
FROM   pg_matviews
WHERE  schemaname = :'schema_target';
\gexec

-- Tables (CASCADE removes attached triggers, FKs, default constraints)
SELECT 'DROP TABLE IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(tablename) || ' CASCADE;'
FROM   pg_tables
WHERE  schemaname = :'schema_target';
\gexec

-- Functions (incl. trigger functions)
SELECT 'DROP FUNCTION IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(T01.proname) || '(' || pg_get_function_identity_arguments(T01.oid) || ') CASCADE;'
FROM   pg_proc T01
       INNER JOIN pg_namespace T02
       ON
         T02.oid = T01.pronamespace
WHERE      T02.nspname = :'schema_target'
   AND     T01.prokind = 'f';
\gexec

-- Procedures
SELECT 'DROP PROCEDURE IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(T01.proname) || '(' || pg_get_function_identity_arguments(T01.oid) || ') CASCADE;'
FROM   pg_proc T01
       INNER JOIN pg_namespace T02
       ON
         T02.oid = T01.pronamespace
WHERE      T02.nspname = :'schema_target'
   AND     T01.prokind = 'p';
\gexec

-- Sequences (leftovers not removed via their table)
SELECT 'DROP SEQUENCE IF EXISTS ' || quote_ident(:'schema_target') || '.' || quote_ident(sequence_name) || ' CASCADE;'
FROM   information_schema.sequences
WHERE  sequence_schema = :'schema_target';
\gexec

\echo '## CLEAN schema objects in ' :schema_target ' - DONE'
