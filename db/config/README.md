# db/config — Environment configuration

Connection parameters and object-name variables, **one pair of files per environment**. Modeled on
the `db/config` layout of a PostgreSQL framework proven in a real-world project.

## The two file types

Each environment is described by **two** complementary files, because two different consumers need
the same facts in two different formats — the shell that *connects* to the database, and psql that
*runs SQL inside* it. Neither can read the other's format, so the facts are kept in parallel.

- **`<env>.env` — shell environment file (sourced by the bash runners).**
  A plain `KEY=value` file that the `scripts/*.sh` runners `source` before they invoke `psql`. It
  carries the **connection coordinates** the client needs to reach the server: `DB_HOST`, `DB_PORT`,
  `DB_USER`, `DB_NAME`. These become normal shell variables (and, via `PGHOST`/`PGPORT`/… or `psql`
  flags, the connection the runner opens). It answers *"which server/database/role do we connect
  to?"* — it does **not** contain any object names used inside the SQL.

- **`<env>.env.sql` — psql variable file (loaded with `\i` at the top of every script).**
  A file of `\set` directives that psql reads to define **named SQL variables** referenced throughout
  the DDL: `:database_name`, `:schema_owner`, `:schema_<name>` (e.g. `:schema_config`,
  `:schema_log`), `:role_rw`, … These are the placeholders the rules under `.claude/rules/sql/`
  require instead of hardcoded schema/role names (see `sql.md` → schema variables). It answers
  *"what are the object names this environment uses?"* — so the same DDL deploys unchanged to every
  env by swapping only this file.

In short: `<env>.env` is **how to connect** (read by the shell), `<env>.env.sql` is **what to call
things once connected** (read by psql). A deploy run loads both — the runner sources the `.env` to
open the connection, then `\i`s the `.env.sql` as the first step inside the psql session.

## File pairs (per environment)
For each env in your `env_stages` (e.g. `local`, `dev`, `int`, `test`, `prod`), create two files:

| File | Loaded by | Sets |
|------|-----------|------|
| `<env>.env` | the bash runners (`scripts/*.sh`) | shell vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` |
| `<env>.env.sql` | psql via `\i` | named vars: `:database_name`, `:schema_owner`, `:schema_<name>`, `:role_rw`, … |

Templates to copy: [`example.env`](example.env), [`example.env.sql`](example.env.sql). The
committed [`local.env`](local.env) / [`local.env.sql`](local.env.sql) pair is the ready-to-use
**local throwaway environment** (hardcoded `pw` passwords only) — it powers `db/tests/run.sh`
guidance and the CI dry-run deploy out of the box.

`<env>.env` also carries `APP_VERSION_MAJOR/MINOR/BUILD` — the version `deploy.sh` records in the
`schema_apply_log` deploy tracker.

## Secrets
- Real `<env>.env` / `<env>.env.sql` files are **git-ignored** (see `.gitignore`); only the
  `example.*` templates and the throwaway `local.*` pair are committed.
- Passwords for non-local environments are passed at runtime (`psql -v database_owner_password=…`),
  **never** stored in files. `local` may hardcode a throwaway dev password.
- Schema names are fixed across environments; only the database/role names carry the `<env>` suffix.
