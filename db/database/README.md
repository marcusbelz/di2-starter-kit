# db/database — cluster bootstrap (one-time)

One-time setup that creates the database, its roles, the schemas, and extensions. Run once per
environment (and on a full reset). **Drop-and-recreate, not idempotent** — re-running means `drop`
then `create`. (The schema *objects* under `db/schemas/` are idempotent; these bootstrap scripts are
not.)

## File pattern
`NN.<action>.sql`, applied in numeric order by `db/scripts/create.sh`. The kit ships a complete
worked example set (built against the `app` example schema and `db/config/example.env.sql`
variables):

| File | Creates | Runs against |
|------|---------|--------------|
| `00.preflight.create.sql` | aborts (exit code 3) if the DB or roles already exist — bootstrap is drop-and-recreate | `postgres` maintenance DB |
| `01.create.database.sql` | database + owner role | `postgres` maintenance DB |
| `02.create.extension.sql` | extensions (`pgcrypto`, optional `citext`); revoke `CREATE` on `public` from `PUBLIC` | new database |
| `03.create.user.owner.sql` | schema-owner login role + `search_path` | new database |
| `04.create.schema.app.sql` | the `app` schema (one file per schema — insert `04x`/renumber when adding schemas) | new database |
| `05.create.role.rw.sql` | read/write group role (NOLOGIN) + grants + default privileges + `lc_messages` grant | new database |
| `06.create.user.sa.sql` | service-account login (the application connects with this user) | new database |
| `07.grant.role.sa.sql` | grants the RW role to the service account | new database |
| `99.drop.database.sql` | tear down database + all roles (`IF EXISTS`, safe to re-run) | `postgres` maintenance DB |

> The example scripts are written in English (kit is English-only) and adapted to the `app` schema.
> When you add schemas, keep the schema files contiguous after `04` and renumber the role scripts —
> the runner applies files in numeric order, and the RW grants must run after all schemas exist.

## Roles (framework model)
`<owner>` (DB owner, DDL) · `<fw>`/schema-owner (creates objects) · `<rw>` (NOLOGIN group: DML, no
`CREATE`) · `<sa>` (app service account, LOGIN, inherits `<rw>`). Names are project-specific and come
from `db/config/<env>.env.sql` (`:database_owner`, `:schema_owner`, `:role_rw`, `:user_sa`).

## Secrets
Passwords for non-local environments are passed at runtime (`psql -v …`), never stored here. `01`
runs against the `postgres` maintenance DB; the rest against the new database.
