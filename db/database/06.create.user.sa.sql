-- 06 — Service account (LOGIN, INHERIT): the application connects with this user.
-- Run against the NEW database, connected as a superuser.
--
-- The password is passed at runtime: psql -v user_sa_password=…
-- (for a local throwaway DB it may be hardcoded in the <env>.env.sql instead).

\echo '## 06 create service account'

CREATE USER :user_sa WITH LOGIN INHERIT PASSWORD :'user_sa_password';

GRANT CONNECT ON DATABASE :database_name TO :user_sa;

-- search_path across the application schema(s). Keep in sync with
-- 03.create.user.owner.sql when you add schemas.
ALTER USER :user_sa SET search_path TO
    :schema_app, public;

\echo '## 06 create service account - DONE'
