# .github/workflows — CI + DB deployment

## Table of Contents
- [Workflows](#workflows)
- [How the DB workflows reach the target](#how-the-db-workflows-reach-the-target)
- [GitHub Environments: secrets, variables, branch rules](#github-environments-secrets-variables-branch-rules)
- [Adapting to your project](#adapting-to-your-project)

## Workflows

| Workflow | Trigger | What it does | Secrets |
|----------|---------|--------------|---------|
| [`ci.yml`](ci.yml) | PR → `main`/`master`, push → `dev` | Dry-run DB deploy against a throwaway `postgres:17` service (`create.sh local` → `deploy.sh all local` → `db/tests` → re-deploy as idempotency check) + shellcheck lint | **none** (ephemeral DB, committed local creds) |
| [`db-create.yml`](db-create.yml) | manual dispatch (env) | one-time bootstrap: `db/scripts/create.sh <env>` on the host | SSH + all DB passwords |
| [`db-deploy.yml`](db-deploy.yml) | manual dispatch (schema + env) | idempotent object deploy: `db/scripts/deploy.sh <schema> <env>` | SSH + `DB_FW_PASSWORD` |
| [`db-clean.yml`](db-clean.yml) | manual dispatch (schema + env + typed `clean`) | drop schema objects (schema stays): `db/scripts/clean.sh` | SSH + `DB_FW_PASSWORD` |
| [`db-drop.yml`](db-drop.yml) | manual dispatch (env + typed `drop`) | drop whole DB + roles: `db/scripts/drop.sh` | SSH + `DB_ADMIN_PASSWORD_POSTGRES` |

The destructive workflows (`db-clean`, `db-drop`) require typing the literal word
(`clean` / `drop`) into the confirmation input — a second, deliberate step beyond the dispatch.

## How the DB workflows reach the target
The dispatch workflows **SSH into the deploy host**, `git fetch` + `git reset --hard` the per-env
checkout at `vars.DEPLOY_PATH`, and run the matching `db/scripts/*.sh` there. The database itself
is never exposed to GitHub — only the host is. If your deploy target is not an SSH host (managed
Postgres, k8s, …), replace the SSH step with your mechanism; the `db/scripts/*.sh` contract stays
the same.

## GitHub Environments: secrets, variables, branch rules

> Step-by-step provisioning runbook (incl. verification and common failures):
> [KB-007](../../docs/kb/kb-007-github-actions-db-deployment-setup.md).

Create one **GitHub Environment** per stage (`dev`, `int`, `test`, `prod` — match your
`env_stages` in `.claude/rules/stack.md`) and configure per environment:

**Secrets**
| Secret | Used by | Meaning |
|--------|---------|---------|
| `DEPLOY_SSH_HOST` / `DEPLOY_SSH_USER` / `DEPLOY_SSH_PRIVATE_KEY` | all dispatch workflows | SSH access to the deploy host |
| `DB_ADMIN_PASSWORD_POSTGRES` | create, drop | postgres superuser |
| `DB_OWNER_PASSWORD` | create | database owner role |
| `DB_FW_PASSWORD` | create, deploy, clean | schema owner (object owner) |
| `DB_SA_PASSWORD` | create | application service account |

**Variables**
| Variable | Default | Meaning |
|----------|---------|---------|
| `DEPLOY_PATH` | — (required) | per-env repo checkout on the host, e.g. `/home/user/app/<project>/<env>` |
| `SSH_PORT` | `22` | SSH port of the deploy host |

**Branch → environment mapping:** use the Environment's *deployment branches* setting (e.g.
`dev`/`int` deployable from `dev`, `test`/`prod` only from `main`) — the workflows then refuse to
run from the wrong branch natively, without extra script guards. For `prod`, additionally enable
*required reviewers* on the Environment for a human approval gate.

## Adapting to your project
- `/init` prunes this directory when the project has neither a database nor CI.
- Rename the `schema` choice options in `db-deploy.yml` / `db-clean.yml` when you rename
  `db/schemas/example/` (deploy takes the **directory** name, clean the **deployed schema** name).
- Adjust the `environment` choice lists to your `env_stages`.
- App build/test/deploy workflows are added later by the workflow skills against
  `.claude/rules/stack.md` — this directory ships only the stack-agnostic DB + CI part.
