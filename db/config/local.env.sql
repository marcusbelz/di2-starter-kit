-- local — committed throwaway environment (never real credentials).
-- psql variables for the bootstrap scripts (db/database/) and schema objects.
-- Real environments (dev/int/test/prod) get their own git-ignored <env>.env.sql.

\set database_name   app_local
\set database_owner  app_local_owner
\set schema_owner    app_local_fw

-- one \set per schema you define under db/schemas/ (rename the example schema):
\set schema_app      app
-- \set schema_log    log

\set role_rw         app_local_rw
\set user_sa         app_local_sa

-- Local throwaway passwords only — non-local envs pass these via psql -v at runtime.
\set database_owner_password  pw
\set schema_owner_password    pw
\set user_sa_password         pw
