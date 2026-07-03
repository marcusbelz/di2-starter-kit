-- 04 — Application schema 'app' (owned by the schema owner).
-- Run against the new database, connected as a superuser.
-- One file per schema; copy + renumber (05, 06, …) for each additional schema.

\echo '## 04 create schema :schema_app'

CREATE SCHEMA :schema_app AUTHORIZATION :schema_owner;

-- Objects created by the DB owner in this schema are automatically usable by the
-- schema owner (e.g. tables created during owner-run migrations).
ALTER DEFAULT PRIVILEGES FOR USER :database_owner IN SCHEMA :schema_app
    GRANT ALL ON TABLES TO :schema_owner;

\echo '## 04 create schema :schema_app - DONE'
