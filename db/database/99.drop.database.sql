-- 99 — Tear down the database, roles and logins.
-- Run against the 'postgres' maintenance DB, connected as a superuser.
-- This IS the teardown — destructive and intentionally not idempotent-guarded
-- beyond the IF EXISTS clauses. Roles are dropped after the database that owns
-- their objects, so no "role cannot be dropped, owns objects" error.

\echo '## 99 drop database + roles'

-- 1. Terminate active connections (a DROP DATABASE fails while sessions are open).
\echo '1. Terminate active connections'
SELECT pg_terminate_backend(pid)
FROM   pg_stat_activity
WHERE  datname =  :'database_name'
  AND  pid     <> pg_backend_pid();

-- 2. Drop the database.
\echo '2. Drop database'
DROP DATABASE IF EXISTS :database_name;

-- 2b. Revoke cluster-wide parameter grants (lc_messages, see 03/05): parameter
-- privileges live in a SHARED catalog and survive the DROP DATABASE — without this
-- revoke the role drops below fail with "cannot be dropped because some objects
-- depend on it". Generated via \gexec so it is a no-op when the roles are gone.
\echo '2b. Revoke parameter grants'
SELECT format('REVOKE SET ON PARAMETER lc_messages FROM %I;', rolname)
FROM   pg_roles
WHERE  rolname IN (:'role_rw', :'schema_owner');
\gexec

-- 3. Service-account login.
\echo '3. Drop service account'
DROP ROLE IF EXISTS :user_sa;

-- 4. Read/write group role.
\echo '4. Drop rw role'
DROP ROLE IF EXISTS :role_rw;

-- 5. Schema owner.
\echo '5. Drop schema owner'
DROP ROLE IF EXISTS :schema_owner;

-- 6. Database owner.
\echo '6. Drop database owner'
DROP ROLE IF EXISTS :database_owner;

\echo '## 99 drop database + roles - DONE'
