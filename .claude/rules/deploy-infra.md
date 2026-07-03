# Deploy Infrastructure (host, containers, paths, secrets)

> Single source of truth for deploy/runtime facts: SSH access, container names, paths, domains, and
> secret-sync points. **`/init` fills the `{{PLACEHOLDER}}` values** (or leaves clear TODOs until the
> server exists). `/deploy` and the host-side of `/check-updates` read this file — they never invent
> host facts.
>
> If `deploy` is `none` in `.claude/rules/stack.md`, this file was pruned at `/init` time.

## Host access
```
{{SSH_COMMAND}}            # e.g. ssh user@host -p 22  — only if the deploy target is a server you SSH into
```

## Environments → container / service / URL
Fill one row per stage in `env_stages` (from `stack.md`). Drop rows you don't have.

| Env | Branch | Container / service | URL / endpoint | Port / mapping |
|-----|--------|---------------------|----------------|----------------|
| {{ENV_1}} | {{BRANCH_1}} | {{CONTAINER_1}} | {{URL_1}} | {{PORT_1}} |
| {{ENV_2}} | {{BRANCH_2}} | {{CONTAINER_2}} | {{URL_2}} | {{PORT_2}} |
| prod | main | {{CONTAINER_PROD}} | {{URL_PROD}} | {{PORT_PROD}} |

## Repo paths on the host
```
{{HOST_REPO_PATH}}/<env>          # where each env's checkout lives, e.g. /home/user/app/<project>/<env>
```

## Deploy mechanism
- CI provider: `{{CI}}` (from `stack.md`). Deploy is triggered by `{{DEPLOY_TRIGGER}}` (e.g. a manual
  `workflow_dispatch`), which SSHes to the host, pulls the branch, `{{BUILD_CMD}}`, recreates the
  container/service, and prunes old artifacts.
- Reverse proxy / TLS: `{{PROXY_TLS}}` (e.g. Nginx + Let's Encrypt) terminates TLS and routes to the
  container port above.

## Standard read-only diagnostics (run on the host)
```
{{PS_CMD}}                 # e.g. docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
{{LOGS_CMD}}               # e.g. docker logs --tail 100 <container>
{{HEALTH_CMD}}             # e.g. curl -s <url>/health
```
**Discipline:** at the start of any host diagnosis, run the "what's running" command first — never
guess container names from memory. Keep this file in sync with the next verified check.

## Env-file smoke after any `.env`/secret change (MANDATORY)
Host env files live outside the repo and are edited by hand — a frequent drift source. After any edit:
1. Verify the app container resolves its dependencies (DB host, etc.) from inside the container.
2. Hit the app's health endpoint from inside the container.
3. Confirm the app can reach its data store / dependencies.

Common failure patterns: wrong DB host (a local-dev hostname that doesn't resolve on the server),
password out of sync between the env file and the role, missing/placeholder secret. The user-visible
symptom is often a generic config/login error — read the **container logs** to distinguish the cause
(name-resolution error vs. auth error vs. missing migration) before chasing code hypotheses.

## Secret-sync drift (MANDATORY)
Several secrets live in **two stores at once** — the host env file **and** a backend (DB role, auth
client secret, signing secret, a cron/reconcile token) — or in the CI secret store per env. Drift in
either store = silent failure. Maintain the table below; verify both sides match before changing code.

| Variable | Stores | Drift symptom | Sync path |
|----------|--------|---------------|-----------|
| {{SECRET_1}} | env file ↔ {{BACKEND_1}} | {{SYMPTOM_1}} | {{SYNC_1}} |

Completeness check before a prod release: every security-critical variable is `SET` (not missing,
not a placeholder) in every env. A read-only script under `scripts/` that reports SET/MISSING/
PLACEHOLDER (never the values) is the recommended way to enforce this.

## Migration drift (if `database != none`)
The app-deploy step usually does **not** apply DB migrations. Before deploying, check whether the
target env has the latest schema and apply migrations first if not (command from `db-migrations.md` /
`stack.md`). Symptom of a forgotten migration: the app starts but breaks on first data access.

## When to update this file
After any verified `docker ps` / host inventory that corrects a drift; after a path/container
refactor; after any deploy-relevant domain or secret change.
