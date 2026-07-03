> ⚠️ **EXAMPLE FILE** — this setup guide is a template to learn from, not a project-specific state.
> Values (database name, roles, schemas, passwords) are placeholders from the `db/` skeleton
> (`db/config/example.env.sql`). Adapt them at `/init` or when setting up the real project, or
> replace this file with a real `setup-00N-…md`. **Never enter real passwords here.**

# Setup-002 (Example): Read-only role on all schemas of a database

> Create a role that has **read-only** access (`SELECT`) to **all** schemas of a database — for
> reporting, BI tools, read replicas, or ad-hoc analysis, without granting the person/tool any
> write or DDL privileges. Follows the kit's role model (NOLOGIN group role + LOGIN user, analogous
> to `<rw>` + `<sa>` in `db/database/README.md`). Schema and role names come from
> `db/config/<env>.env.sql`.

## Contents
- [Model: group role + login user](#model-group-role--login-user)
- [Prerequisites](#prerequisites)
- [Step 1 — Create the group role + login user](#step-1--create-the-group-role--login-user)
- [Step 2 — Read grants per schema](#step-2--read-grants-per-schema)
- [Step 3 — Default privileges for future tables](#step-3--default-privileges-for-future-tables)
- [Verify](#verify)
- [Troubleshooting](#troubleshooting)

## Model: group role + login user

Like the framework's `<rw>`/`<sa>` pair, read access is set up in **two stages**:

| Role | Type | Purpose |
|------|------|---------|
| `<ro>` (e.g. `app_local_ro`) | `NOLOGIN` group role | Carries the `SELECT`/`USAGE` grants. No login. |
| `<user_ro>` (e.g. `app_local_ro_login`) | `LOGIN` user | Logs in, **inherits** the privileges via `GRANT <ro> TO <user_ro>`. |

**Why separate:** privileges hang off the group once; further read logins receive them via
`GRANT <ro> TO …`, without duplicating the grants. Password/rotation only concerns the login user.

> Location of the real SQL script: `db/database/NN.create.role.ro.sql` (`NN` = next free
> bootstrap number, see `db/database/README.md`). This article is the guide for it — the script
> itself belongs in the `db/database/` bootstrap (drop-and-recreate, not idempotent).

## Prerequisites
- The database, schemas, and the owner/`<rw>` roles already exist (the `db/database/` bootstrap
  has run — see [Setup-001](setup-001-example-postgres-17-docker.md)).
- A connection as **superuser** or as `<database_owner>` (only the owner of the objects, or a
  superuser, may grant privileges).
- Schema/role variables from `db/config/<env>.env.sql`. Example:

  | Variable | Example value | Meaning |
  |----------|---------------|---------|
  | `:database_name` | `app_local` | target database |
  | `:schema_owner` | `app_local_fw` | owner of the schema objects (relevant for default privileges) |
  | `:schema_app` | `app` | a schema (one separate `\set` variable per additional schema) |
  | `:role_ro` | `app_local_ro` | the read group role newly created here |
  | `:user_ro` | `app_local_ro_login` | the read login user |

> For the example here, also add `\set role_ro app_local_ro` and `\set user_ro app_local_ro_login`
> to the `<env>.env.sql` (the template so far only knows `:role_rw` / `:user_sa`).

## Step 1 — Create the group role + login user

```sql
\echo "## CREATE ROLE :role_ro (read-only group) + :user_ro (login)"

-- Group role: carries the grants, never logs in
DROP ROLE IF EXISTS :role_ro;
CREATE ROLE :role_ro NOLOGIN;

-- Login user: inherits the privileges via the group
DROP ROLE IF EXISTS :user_ro;
CREATE ROLE :user_ro LOGIN PASSWORD :'user_ro_password';
GRANT :role_ro TO :user_ro;

-- may only connect, nothing else at the DB level
GRANT CONNECT ON DATABASE :database_name TO :role_ro;

\echo "## CREATE ROLE :role_ro - DONE"
```

- **`:'user_ro_password'`** is passed at runtime (`psql -v user_ro_password=…`), never hardcoded in
  the file — except for a local throwaway DB (see `.claude/rules/security.md`).
- `CONNECT` is intentionally the only DB-level privilege. Read access is granted **per schema** in
  step 2.

## Step 2 — Read grants per schema

`SELECT` alone is not enough — the role additionally needs `USAGE` on each schema, otherwise the
tables in it are invisible. **Repeat this block per schema** (`:schema_app`, `:schema_log`, …):

```sql
\echo "## GRANT read-only on :schema_app to :role_ro"

GRANT USAGE              ON SCHEMA :schema_app          TO :role_ro;
GRANT SELECT ON ALL TABLES    IN SCHEMA :schema_app     TO :role_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA :schema_app     TO :role_ro;   -- only if currval/lastval should be read

\echo "## GRANT read-only on :schema_app - DONE"
```

> **"all schemas" — deliberately explicit, not dynamic.** A `DO` loop over
> `information_schema.schemata` would work, but psql does **not** interpolate the `:schema_*`
> variables inside `$$…$$` dollar quoting (same limitation as with procedure bodies, see
> `.claude/rules/sql/postgres/sql.md`). In the bootstrap script the grant block is therefore
> **spelled out once** per `\set` schema — that is traceable and matches the "one file, clear
> order" line of `db/database/`.

## Step 3 — Default privileges for future tables

Step 2 only covers the tables that exist **today**. So that later-created tables are automatically
readable, set `ALTER DEFAULT PRIVILEGES` — **`FOR ROLE :schema_owner`**, because exactly this role
creates the schema objects (default privileges apply only to objects owned by the named role).
Also **per schema**:

```sql
\echo "## ALTER DEFAULT PRIVILEGES on :schema_app for :role_ro"

ALTER DEFAULT PRIVILEGES FOR ROLE :schema_owner IN SCHEMA :schema_app
   GRANT SELECT ON TABLES TO :role_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE :schema_owner IN SCHEMA :schema_app
   GRANT SELECT ON SEQUENCES TO :role_ro;   -- only if also granted in step 2

\echo "## ALTER DEFAULT PRIVILEGES on :schema_app - DONE"
```

## Verify

```sql
-- 1. Role exists, NOLOGIN, without special privileges?
\du :role_ro

-- 2. granted table privileges per schema (should show only 'r' = SELECT):
SELECT table_schema, privilege_type
FROM   information_schema.role_table_grants
WHERE  grantee = 'app_local_ro'
GROUP  BY table_schema, privilege_type
ORDER  BY table_schema;
```

```bash
# 3. cross-check as the login user: SELECT works, INSERT must fail
psql "host=localhost port=5432 user=app_local_ro_login dbname=app_local" \
  -c "select count(*) from app.example;" \
  -c "insert into app.example (name) values ('x');"   # expected: ERROR: permission denied
```

Expectation: step 3 returns a number for the `select` and an
`ERROR: permission denied for table example` for the `insert` — that is exactly "read-only".

## Troubleshooting

The recurring failure modes for this role, in symptom → cause → fix form:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `permission denied for schema …` despite a `SELECT` grant | Missing `USAGE` on the schema | `GRANT USAGE ON SCHEMA <s> TO <role>;` |
| Newly created tables are invisible to the role | `ALTER DEFAULT PRIVILEGES` forgotten, or set with the wrong `FOR ROLE` (it must name the role that **creates** the tables) | Re-issue `ALTER DEFAULT PRIVILEGES FOR ROLE <creator> IN SCHEMA <s> GRANT SELECT ON TABLES TO <role>;` |
| `GRANT … ON ALL TABLES` stops applying at some point | That grant is a **snapshot** of the tables existing at grant time | Combine it with default privileges (previous row) for future tables |
| One schema silently slips through during rollout | Grants were run per schema by hand | Script the grant loop over all schemas (as in this guide) instead of ad-hoc statements |
| An RLS-enabled table stays empty despite the `SELECT` grant | No `FOR SELECT` policy applies to the role | Add a policy (see `.claude/rules/sql/postgres/policies.md`) — grants alone do not bypass RLS |

> Related: bootstrap model `db/database/README.md`, role convention ibid., SQL conventions
> `.claude/rules/sql/postgres/`, security floor `.claude/rules/security.md`.
