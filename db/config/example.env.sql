-- Copy to <env>.env.sql (e.g. local.env.sql) and fill in. Loaded by psql via \i.
-- This file is a committed TEMPLATE — real <env>.env.sql files are git-ignored.
-- Database/role names carry the <env> suffix; schema names are fixed across environments.

\set database_name   app_local
\set database_owner  app_local_owner
\set schema_owner    app_local_fw

-- one \set per schema you define under db/schemas/ (rename the example schema):
\set schema_app      app
-- \set schema_log    log

\set role_rw         app_local_rw
\set user_sa         app_local_sa

-- Passwords: hardcode only for a local throwaway DB; otherwise pass via psql -v at runtime:
--   -v database_owner_password=… -v schema_owner_password=… -v user_sa_password=…
