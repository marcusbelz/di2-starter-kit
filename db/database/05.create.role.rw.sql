-- 05 — Read/write group role (NOLOGIN): DML across the application schema(s).
-- Run against the NEW database, connected as a superuser.
--
-- The application never connects as the schema owner. It connects as the service
-- account (06.create.user.sa.sql), which inherits this group role: DML + EXECUTE,
-- but no CREATE — objects are created only by the schema owner via db/scripts/deploy.sh.

\echo '## 05 create rw group role'

CREATE ROLE :role_rw WITH
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOLOGIN
    NOREPLICATION
    NOBYPASSRLS
    CONNECTION LIMIT -1;

GRANT CONNECT ON DATABASE :database_name TO :role_rw;

-- --------------------------------------------------------------------------------
-- Existing objects: USAGE on the schema, DML on tables, sequences, routines.
-- (USAGE, not CREATE — only the schema owner creates objects.)
-- Repeat this block for every additional schema you define under db/schemas/.
-- --------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA :schema_app TO :role_rw;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA :schema_app TO :role_rw;
GRANT USAGE                          ON ALL SEQUENCES IN SCHEMA :schema_app TO :role_rw;
GRANT EXECUTE                        ON ALL ROUTINES  IN SCHEMA :schema_app TO :role_rw;

-- --------------------------------------------------------------------------------
-- Default privileges: objects the schema owner creates later are granted automatically.
-- This is why deploy.sh needs no separate grant step after creating new objects.
-- --------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE :schema_owner IN SCHEMA :schema_app
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :role_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE :schema_owner IN SCHEMA :schema_app
    GRANT USAGE ON SEQUENCES TO :role_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE :schema_owner IN SCHEMA :schema_app
    GRANT EXECUTE ON ROUTINES TO :role_rw;

-- --------------------------------------------------------------------------------
-- lc_messages grant (PG15+) — required by the procedure convention.
-- --------------------------------------------------------------------------------
-- The example procedures set `SET LOCAL lc_messages TO 'C'` as their first body line
-- (English server messages for component parsing — see
-- .claude/rules/sql/postgres/procedures.md). lc_messages is a SUSET GUC, so a
-- non-superuser runtime role needs this explicit grant, otherwise the very first
-- call as the service account fails with 42501 (permission denied to set parameter).
GRANT SET ON PARAMETER lc_messages TO :role_rw;

\echo '## 05 create rw group role - DONE'
