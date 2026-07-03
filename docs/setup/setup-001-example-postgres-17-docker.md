> ⚠️ **EXAMPLE FILE** — this setup guide is a template to learn from, not a project-specific state.
> Values (database name, roles, passwords, ports) are placeholders from the `db/` skeleton
> (`db/config/example.env`). Adapt them at `/init` or when setting up the real project, or replace
> this file with a real `setup-00N-…md`. **Never enter real passwords here.**

# Setup-001 (Example): PostgreSQL 17 in a Docker container

> Local PostgreSQL 17 instance for development — as a plain `docker run` one-liner **or** via
> `docker-compose.yml` (recommended). Afterwards: run the `db/` bootstrap (`scripts/create.sh`)
> against it. Stack values come from `.claude/rules/stack.md`; the connection values from
> `db/config/<env>.env` (here: `local`).

## Contents
- [Prerequisites](#prerequisites)
- [Option A — docker run (quick)](#option-a--docker-run-quick)
- [Option B — docker-compose (recommended)](#option-b--docker-compose-recommended)
- [Check the connection](#check-the-connection)
- [Bootstrap + deploy against the container](#bootstrap--deploy-against-the-container)
- [Common pitfalls](#common-pitfalls)

## Prerequisites
- Docker Desktop / Docker Engine installed (`docker --version`).
- Free port `5432` on the host (otherwise adjust the mapping, see below).
- The connection values from `db/config/example.env` as a reference:

  | Variable  | Example value | Meaning |
  |-----------|---------------|---------|
  | `DB_HOST` | `localhost`   | Host you connect from |
  | `DB_PORT` | `5432`        | mapped host port |
  | `DB_USER` | `postgres`    | superuser (bootstrap connects as superuser) |
  | `DB_NAME` | `app_local`   | target database, created by the bootstrap |

> Note: The container initially starts only with the **superuser** (`postgres`) and an empty
> maintenance DB. The database `app_local`, roles, and schemas are created only by the
> `db/database/` bootstrap (see [below](#bootstrap--deploy-against-the-container)) — not by the
> container itself.

## Option A — docker run (quick)

```bash
docker run -d \
  --name pg17-local \
  -e POSTGRES_PASSWORD=local_dev_only \
  -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=C" \
  -p 5432:5432 \
  -v pg17_local_data:/var/lib/postgresql/data \
  --health-cmd="pg_isready -U postgres" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=5 \
  postgres:17
```

- `POSTGRES_PASSWORD` here is a **throwaway password for a local DB** — for non-local
  environments the password comes from the secret store / CI, never from a file (see
  `.claude/rules/security.md`).
- `-v pg17_local_data:…` creates a named volume so the data survives a container restart.
  To reset completely: `docker rm -f pg17-local && docker volume rm pg17_local_data`.
- `postgres:17` pulls the current 17.x patch level. For reproducible builds, pin a specific
  tag (e.g. `postgres:17.5`).

## Option B — docker-compose (recommended)

`docker-compose.yml` (e.g. under `db/` or in the project root):

```yaml
services:
  postgres:
    image: postgres:17
    container_name: pg17-local
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: local_dev_only      # local only! otherwise via secret/CI
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    ports:
      - "5432:5432"
    volumes:
      - pg17_local_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg17_local_data:
```

Start / status / logs / stop:

```bash
docker compose up -d
docker compose ps
docker compose logs -f postgres
docker compose down           # container gone, volume stays
docker compose down -v        # also delete the volume (data gone)
```

## Check the connection

```bash
# waits until the DB accepts connections
docker exec pg17-local pg_isready -U postgres

# version + interactive shell in the container
docker exec -it pg17-local psql -U postgres -c "select version();"

# from the host (psql installed locally):
psql "host=localhost port=5432 user=postgres dbname=postgres" -c "select 1;"
```

## Bootstrap + deploy against the container

Once the container is running, apply the `db/` skeleton against it (details: `db/README.md`,
`db/scripts/README.md`):

```bash
# 1. Create the env file from the template (git-ignored):
cp db/config/example.env     db/config/local.env
cp db/config/example.env.sql db/config/local.env.sql
#    -> align DB_HOST/DB_PORT/DB_USER/DB_NAME in local.env to the values above

# 2. Cluster bootstrap (database, roles, schemas) — connects as superuser:
db/scripts/create.sh local

# 3. Deploy schema objects idempotently — connects as schema owner:
db/scripts/deploy.sh all local
```

> The `*.sh` runners exist in the kit only as a README skeleton — write them for your stack
> (`db/scripts/README.md` documents the load-order contract they implement). For a quick
> test without a runner, a single script can be applied directly:
>
> ```bash
> docker exec -i pg17-local psql -U postgres -d app_local < db/database/02.create.extension.sql
> ```

## Common pitfalls
- **Port 5432 in use** (a local PostgreSQL installation is already running): remap the host port,
  e.g. `-p 5433:5432`, and set `DB_PORT=5433` in `local.env`.
- **"database app_local does not exist"**: expected — the DB is created only by step 2
  (`create.sh`), not by the container. Until then, connect against the `postgres` maintenance DB.
- **Password auth fails after volume reuse**: `POSTGRES_PASSWORD` only takes effect during the
  **initial initialization** of an empty volume. Existing volume → the old password still applies;
  for a real reset, delete the volume (`docker compose down -v`).
- **`locale=C` vs. real collation**: fine and fast for pure development; closer to production,
  provide a specific collation (e.g. `de_DE.UTF-8`) in the image if needed.

> Related: SQL conventions `.claude/rules/sql/postgres/`, deploy model `db/README.md`,
> migration model `.claude/rules/db-migrations.md`.
