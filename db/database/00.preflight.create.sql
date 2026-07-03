-- 00 — Preflight: ensures that neither the database nor the roles already exist.
--
-- The bootstrap is drop-and-recreate (see db/database/README.md): roles are cluster-global
-- and survive a DROP DATABASE. A second create run without a prior drop would otherwise
-- abort in 01.create.database.sql with "role already exists" (42710). This preflight stops
-- early in a controlled way via RAISE -> under ON_ERROR_STOP psql returns exit code 3;
-- db/scripts/create.sh catches that code and points to drop.sh.
--
-- Run against the 'postgres' maintenance DB, after loading db/config/<env>.env.sql.

SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname  =  :'database_name')
    OR EXISTS (SELECT 1 FROM pg_roles    WHERE rolname IN (:'database_owner', :'schema_owner', :'role_rw', :'user_sa'))
       AS bootstrap_already_exists
\gset

\if :bootstrap_already_exists
   DO $$
   BEGIN
      RAISE EXCEPTION 'preflight: database or roles already exist — run db/scripts/drop.sh first';
   END
   $$;
\endif
