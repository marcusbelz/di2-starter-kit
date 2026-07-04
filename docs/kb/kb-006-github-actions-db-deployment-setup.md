# KB-006: Set up GitHub Actions for the DB deployment (one-time provisioning)

> Runbook — everything needed **once per repository** so the shipped workflows (`ci.yml`,
> `db-create/deploy/clean/drop.yml`) actually run: environments, secrets, variables, branch rules.

## What ships
| Workflow | Trigger | Runs |
|----------|---------|------|
| `ci.yml` | PR → `main`/`master`, push → `dev` | dry-run deploy against a throwaway Postgres + `db/tests` + idempotency re-deploy + shellcheck — **needs no secrets** |
| `db-create.yml` | manual dispatch | `create.sh <env>` on the deploy host via SSH |
| `db-deploy.yml` | manual dispatch | `deploy.sh <schema> <env>` via SSH |
| `db-clean.yml` | manual dispatch + typed `clean` | `clean.sh <schema> <env>` via SSH |
| `db-drop.yml` | manual dispatch + typed `drop` | `drop.sh <env>` via SSH |

`ci.yml` works the moment the repo is on GitHub — nothing to configure. The four dispatch
workflows need the setup below.

## Procedure

### 1. Create one GitHub Environment per stage
Repo → *Settings → Environments* → create `dev`, `int`, `test`, `prod` (match your `env_stages`
in `.claude/rules/stack.md`; delete unused ones from the workflows' choice lists).

### 2. Per environment: secrets
| Secret | Used by | Value |
|--------|---------|-------|
| `DEPLOY_SSH_HOST` / `DEPLOY_SSH_USER` / `DEPLOY_SSH_PRIVATE_KEY` | all four | SSH access to the deploy host (a dedicated low-privilege deploy user; key without passphrase) |
| `DB_ADMIN_PASSWORD_POSTGRES` | create, drop | postgres superuser |
| `DB_OWNER_PASSWORD` | create | database-owner role |
| `DB_FW_PASSWORD` | create, deploy, clean | schema owner |
| `DB_SA_PASSWORD` | create | application service account |

### 3. Per environment: variables
| Variable | Value |
|----------|-------|
| `DEPLOY_PATH` | the env's repo checkout on the host, e.g. `/home/user/app/<project>/<env>` (must exist — clone it once by hand) |
| `SSH_PORT` | only if not `22` |

### 4. Branch → environment rules
In each Environment, set *Deployment branches* — e.g. `dev`/`int` deployable from `dev`,
`test`/`prod` only from `main`. The workflows then refuse the wrong branch natively. For `prod`,
also enable *Required reviewers* (human approval before the job starts).

### 5. Adapt the choice lists
- `db-deploy.yml`: `schema` options = your **directory** names under `db/schemas/` (+ `all`).
- `db-clean.yml`: `schema` options = your **deployed schema** names (+ `all`).
- Both + `db-create.yml`/`db-drop.yml`: trim the `environment` options to your stages.

## Verification
1. Push a branch, open a PR → the `CI` checks (`db-dry-run-deploy`, `lint`) must go green.
2. *Actions → DB - deploy → Run workflow* against `dev` → job green, then check the newest
   `schema_apply_log` row on dev ([KB-003](kb-003-db-deploy-schema-objects.md)).

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERROR: environment variable DEPLOY_PATH is not set` | Variable missing on that Environment | Set it (step 3) |
| SSH step: `permission denied (publickey)` | Wrong key/user, or the public key is not on the host | Fix the secret / add the key to the deploy user's `authorized_keys` |
| Dispatch workflow runs from the wrong branch | No deployment-branch rule on the Environment | Configure step 4 |
| Secrets appear empty in the job | Secrets were created at repo level while the job pins `environment:` | Create them **inside** the Environment (or use repo-level consistently) |
| Destructive workflow exits early with a confirmation error | The typed word did not match `clean` / `drop` exactly | Intentional guard — retype exactly |

## Related
- Reference: [.github/workflows/README.md](../../.github/workflows/README.md).
- The runbooks per operation: [KB-002](kb-002-db-bootstrap-new-environment.md) ·
  [KB-003](kb-003-db-deploy-schema-objects.md) · [KB-005](kb-005-db-clean-and-redeploy-schema.md) ·
  [KB-007](kb-007-db-drop-environment.md).
