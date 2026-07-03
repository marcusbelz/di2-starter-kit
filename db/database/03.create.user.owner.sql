-- 03 — Schema owner: owns the application schema(s) and creates all objects in them.
-- Run against the new database, connected as a superuser.
--
-- Variables from db/config/<env>.env.sql (:schema_owner, :database_owner, :schema_app).
-- The schema-owner password is passed at runtime: psql -v schema_owner_password=…

\echo '## 03 create schema owner'

CREATE USER :schema_owner WITH LOGIN PASSWORD :'schema_owner_password';

GRANT CONNECT ON DATABASE :database_name TO :schema_owner;

-- The DB owner may switch into the schema-owner role (for DDL / migrations run as owner).
GRANT :schema_owner TO :database_owner;

-- search_path across the application schema(s). Add each schema you create under
-- db/schemas/ here (e.g. ', :schema_log' once you uncomment it in <env>.env.sql).
ALTER USER :schema_owner SET search_path TO
    :schema_app, public;

-- lc_messages is a SUSET GUC and the example procedures set it as their first body
-- line (see .claude/rules/sql/postgres/procedures.md). The schema owner calls
-- procedures during deploys (seed data, the schema_apply_log tracker row), so it
-- needs the grant just like the runtime role (db/database/05.create.role.rw.sql).
GRANT SET ON PARAMETER lc_messages TO :schema_owner;

\echo '## 03 create schema owner - DONE'
