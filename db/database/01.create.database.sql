-- 01 — Database + owner role.
-- Run against the 'postgres' maintenance DB, connected as a superuser.
-- Drop-and-recreate bootstrap (NOT idempotent) — see db/database/README.md.
--
-- Variables come from db/config/<env>.env.sql (:database_name, :database_owner).
-- The owner password is passed at runtime:  psql -v database_owner_password=…
-- (for a local throwaway DB it may be hardcoded in the <env>.env.sql instead).

\echo '## 01 create database + owner role'

-- Owner role: owns the database and runs DDL / migrations.
CREATE ROLE :database_owner WITH LOGIN PASSWORD :'database_owner_password';

-- Note: CREATE DATABASE options are NOT comma-separated (unlike a column list).
CREATE DATABASE :database_name
    WITH
    OWNER    = :database_owner
    ENCODING = 'UTF8';

-- Harden: no implicit PUBLIC connect — only the owner may connect for now.
REVOKE CONNECT ON DATABASE :database_name FROM PUBLIC;
GRANT  CONNECT ON DATABASE :database_name TO   :database_owner;

\echo '## 01 create database + owner role - DONE'
