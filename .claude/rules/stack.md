# Tech Stack (single source of truth)

> **This file is filled in by `/init`.** Until then it is a skeleton with `{{PLACEHOLDER}}`
> values — that is the signal that the project is not yet initialized.
>
> Every stack-agnostic skill (`/architecture`, `/backend`, `/review`, `/deploy`,
> `/check-updates`, `/security`) reads THIS file to learn the concrete tech stack of the project.
> Skills must NOT hard-code a language, framework, database, or hosting target — they parameterize
> their behavior off the values here. When a value is `none`, the corresponding workflow step /
> skill is not used (and `/init` will have pruned it).

## Profile

| Key | Value | Notes |
|-----|-------|-------|
| `runtime` | `{{RUNTIME}}` | e.g. `python-3.12`, `node-22-ts`, `go-1.23` |
| `package_manager` | `{{PACKAGE_MANAGER}}` | e.g. `uv` / `pip` / `poetry`, `npm` / `pnpm`, `go mod` |
| `ui` | `{{UI}}` | `none` or e.g. `react-next-tailwind-shadcn`, `vue-nuxt`, `cli`, `tui` |
| `backend` | `{{BACKEND}}` | `none` or e.g. `fastapi`, `flask`, `django`, `next-api`, `express` |
| `database` | `{{DATABASE}}` | `none` / `postgres` / `mysql` / `mssql` / `sqlite` / `mongodb` |
| `migrations` | `{{MIGRATIONS}}` | e.g. `none`, `plain-sql` (see `db-migrations.md`), `alembic`, `prisma` |
| `tests` | `{{TESTS}}` | `keep` / `none` — optional test scaffold (currently the DB object tests under `db/tests/`); `/init` prunes it when `none`. Always `none` if `database == none` |
| `auth` | `{{AUTH}}` | `none` / `oidc-keycloak` / `oidc-other` / `custom-jwt` / `session` |
| `deploy` | `{{DEPLOY}}` | `none` or e.g. `docker-ssh-vps + github-actions`, `docker-compose`, `k8s`, `serverless` |
| `ci` | `{{CI}}` | `none` / `github-actions` / `gitlab-ci` |
| `env_stages` | `{{ENV_STAGES}}` | e.g. `single`, `dev,prod`, `dev,int,test,prod` |
| `feature_id_prefix` | `{{FEATURE_PREFIX}}` | default `feat` — the `XXXX` part is sequential |

## Build / Test / Run commands

> The exact commands `/review`, `/qa`, `/check-updates`, and `/deploy` invoke. Filled by `/init`.

```
lint:   {{LINT_CMD}}        # e.g. ruff check .            | npm run lint
build:  {{BUILD_CMD}}       # e.g. docker build -t app .   | npm run build
test:   {{TEST_CMD}}        # e.g. pytest                  | npm test
run:    {{RUN_CMD}}         # e.g. uvicorn app.main:app    | npm run dev
audit:  {{AUDIT_CMD}}       # e.g. pip-audit / uv pip audit | npm audit
```

## How skills consume this file

- **`/architecture`** — "is a backend needed?" is still a per-feature decision, but the *kind* of
  backend/data store it designs against comes from `database` + `backend` here.
- **`/backend`** — implements against `backend` + `database` + `migrations`. If `database` is a SQL
  engine, also follows the vendor rules under `.claude/rules/sql/` (active vendor `sql/<vendor>/`);
  for `postgres` and `mssql` the shipped rulesets apply verbatim.
- **`/frontend` / `/ux`** — only present when `ui` is not `none`; follow the active flavor under
  `.claude/rules/ui/`.
- **`/deploy`** — drives `env_stages` against `deploy` using `deploy-infra.md` for the concrete
  host/container/secret facts.
- **`/check-updates`** — checks the `package_manager`, container base images, and `ci`.
- **`/security`** — OWASP sweep is generic; auth checks key off `auth`, data checks off `database`.

## Project-specific stack notes

{{STACK_NOTES}}

<!-- Free-form: anything a skill should know that doesn't fit the table above. Filled by /init. -->
