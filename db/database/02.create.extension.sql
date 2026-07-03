-- 02 — Extensions + public-schema hardening.
-- Run against the NEW database (not 'postgres'), connected as a superuser.
-- Drop-and-recreate bootstrap (NOT idempotent at the cluster level), but the
-- CREATE EXTENSION / REVOKE statements themselves are safe to re-run.

\echo '## 02 create extensions + harden public'

-- pgcrypto: gen_random_uuid(), digest()/hmac(), crypt() — hashing & random UUIDs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- citext: case-insensitive text, handy for email / natural-key columns.
-- Optional — remove this line if the project does not need it.
CREATE EXTENSION IF NOT EXISTS citext;

-- Note (framework reference): the source framework also installs `dblink` here for a
-- loopback write channel used by its persistent logging (log writes survive a
-- rollback of the business transaction). Enable only if you adopt that pattern:
-- CREATE EXTENSION IF NOT EXISTS dblink SCHEMA public;

-- Harden: nobody except the owner may create objects in the public schema.
-- Application objects live in your own schema(s) — see 04.create.schema.<name>.sql.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

\echo '## 02 create extensions + harden public - DONE'
