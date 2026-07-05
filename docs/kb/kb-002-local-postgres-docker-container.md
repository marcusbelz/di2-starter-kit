# KB-002: Run the local PostgreSQL server as a Docker container

> Runbook — providing and operating the **persistent local dev PostgreSQL server** that the
> committed `local` environment points to. The bootstrap ([KB-003](kb-003-db-bootstrap-new-environment.md))
> and deploy ([KB-004](kb-004-db-deploy-schema-objects.md)) scripts create and fill databases
> *inside* an existing server — this article is how you get that server on your machine.

## Table of Contents
- [Purpose / when to use](#purpose--when-to-use)
- [Create the container](#create-the-container)
- [Everyday commands](#everyday-commands)
- [The data volume](#the-data-volume)
- [Teardown](#teardown)
- [Symptom → Cause → Fix](#symptom--cause--fix)
- [Related](#related)

## Purpose / when to use

The committed `db/config/local.env` expects a PostgreSQL server on `localhost:5432` with a
superuser `postgres`. The simplest way to provide one is a Docker container with a named volume —
create it once, then `start`/`stop` it as needed; the data survives restarts and recreates.

Not to be confused with the **throwaway container** the object tests spin up (and remove) on every
run ([KB-005](kb-005-db-apply-smoke-and-tests.md)) — that one is ephemeral by design. This article
is about your persistent local dev server.

## Create the container

One-time (per machine):

```powershell
# Windows / PowerShell
docker run -d --name app-local-pg `
  -p 5432:5432 `
  -e POSTGRES_PASSWORD=pw `
  -v app_local_pgdata:/var/lib/postgresql/data `
  postgres:17
```

```bash
# macOS / Linux / Git Bash
docker run -d --name app-local-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=pw \
  -v app_local_pgdata:/var/lib/postgresql/data \
  postgres:17
```

- `POSTGRES_PASSWORD` is the superuser password the bootstrap asks for
  (`DB_ADMIN_PASSWORD_POSTGRES`, see [KB-003](kb-003-db-bootstrap-new-environment.md)) — `pw` is
  fine for a local throwaway. It only takes effect on the **first** initialization of an empty
  data volume (see [Symptom → Cause → Fix](#symptom--cause--fix)).
- The named volume `app_local_pgdata` keeps the data across container restarts and recreates;
  drop the `-v` flag if the instance is truly disposable.
- Wait until the server reports ready before bootstrapping:
  `docker exec app-local-pg pg_isready -U postgres`.

## Everyday commands

```bash
docker ps -a --filter name=app-local-pg        # status (running / exited)
docker start app-local-pg                      # start (e.g. after a reboot)
docker stop app-local-pg                       # stop (data stays in the volume)
docker restart app-local-pg                    # stop + start
docker logs --tail 50 app-local-pg             # server log (startup errors, connections)
docker exec app-local-pg pg_isready -U postgres  # readiness check
```

Shells into the running container:

```bash
docker exec -it app-local-pg psql -U postgres              # SQL shell (maintenance DB)
docker exec -it app-local-pg psql -U postgres -d app_local # SQL shell into the app DB (after KB-003)
docker exec -it app-local-pg bash                          # OS shell inside the container
```

The container does not auto-start with Docker/the machine by default; add
`--restart unless-stopped` to the `docker run` (or later: `docker update --restart unless-stopped
app-local-pg`) if you want that.

## The data volume

The database cluster lives in the named volume `app_local_pgdata`, mounted at
`/var/lib/postgresql/data` inside the container — not in the container's writable layer. That is
why `docker rm` + `docker run` keeps the data.

```bash
docker volume ls                              # list volumes
docker volume inspect app_local_pgdata        # metadata incl. mountpoint
```

Note: on Docker Desktop (Windows/macOS) the `Mountpoint` path lives **inside the Docker VM** — you
cannot browse it directly from the host filesystem. To look inside the volume:

```bash
# container running: browse in place
docker exec -it app-local-pg bash
ls -la /var/lib/postgresql/data

# container stopped or removed: mount the volume into a helper container
docker run --rm -it -v app_local_pgdata:/data alpine sh
ls -la /data
```

For getting **data** (not files) out, prefer a dump over file-level access:
`docker exec app-local-pg pg_dump -U postgres app_local > app_local.sql`.

## Teardown

```bash
docker rm -f app-local-pg                     # remove the container — data SURVIVES in the volume
docker volume rm app_local_pgdata             # full wipe — next create re-initializes from scratch
```

After removing only the container, a re-run of the [create command](#create-the-container) picks
the existing volume up again — databases, roles, and passwords are all still there (no
[KB-003](kb-003-db-bootstrap-new-environment.md) re-run needed). After removing the volume too,
the server starts empty: run the bootstrap again.

## Symptom → Cause → Fix

| Symptom | Cause | Fix |
|---|---|---|
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another PostgreSQL (native install or container) already listens on 5432 | Stop the other server, or map a different host port (`-p 5433:5432`) and set `DB_PORT=5433` in `db/config/local.env` |
| `The container name "/app-local-pg" is already in use` | The container already exists (maybe stopped) | `docker start app-local-pg` — or `docker rm -f app-local-pg` and re-create |
| Changed `POSTGRES_PASSWORD` in the run command has no effect | The variable only applies when an **empty** data volume is initialized; an existing cluster keeps its old password | Either wipe the volume (teardown above) or change it in place: `docker exec -it app-local-pg psql -U postgres -c "ALTER ROLE postgres PASSWORD 'new';"` |
| `connection refused` / `pg_isready` not ready right after create | initdb is still running in the fresh container | Wait a few seconds and re-run `pg_isready`; check `docker logs` if it never turns ready |
| Data gone after recreate | Container was created without the `-v app_local_pgdata:…` mount (data lived in the container layer) | Re-create with the named volume; restore data via bootstrap + deploy (or a dump, if you have one) |

## Related

- [KB-001: Create a new project from the template](kb-001-create-new-project-from-template.md) — the step before this one.
- [KB-003: Bootstrap a new database environment](kb-003-db-bootstrap-new-environment.md) — the next step: create database, roles, schema inside this server.
- [KB-005: Apply-smoke & object tests](kb-005-db-apply-smoke-and-tests.md) — uses its own throwaway container, not this one.
