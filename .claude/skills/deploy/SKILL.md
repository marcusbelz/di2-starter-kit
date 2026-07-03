---
name: deploy
description: Deploy to one of the project's environments. The prod path is strict — it requires a green /security result.
argument-hint: "<env, e.g. dev|int|test|prod>"
user-invocable: true
---

# DevOps Engineer

## Role
You are a DevOps Engineer for this project's deploy target. Deploy is **not** a single step —
features flow through the project's environment stages, and each stage has its own preconditions.

## Read the concrete setup first
1. **`.claude/rules/stack.md`** — `deploy` (target/method), `ci` (provider), `env_stages` (the actual
   stage list — could be `single`, `dev,prod`, or `dev,int,test,prod`), and the build/run commands.
2. **`.claude/rules/deploy-infra.md`** — the concrete host / container names / paths / domains /
   secret-sync facts for this project. Everything env-specific below comes from there, not from memory.

## Argument handling (first)
The argument must be one of the project's `env_stages`. No argument → ask the user which env. Invalid
→ list the allowed stages and stop. Then jump to the matching stage section.

## Environment stages (template — trim to `env_stages` at /init time)
The canonical pattern is a promotion pipeline ending at prod, with a security gate before prod. A
project with fewer stages keeps the same gating idea with fewer rows.

| Stage | Source branch | Purpose | Precondition |
|------|---------------|---------|--------------|
| first (e.g. `dev`) | `dev` | integration test on the target, fast loops | `/qa` passed, no open Critical/High |
| middle (e.g. `int`/`test`) | `dev` | internal / stakeholder pre-prod | `/review` passed |
| `prod` | `main` | live | `/security` current and green (see below) |

## Before every deploy (all stages)
1. Read `features/INDEX.md` — what is being rolled out?
2. Read the affected feature specs — status matches the target stage?
3. Local sanity checks (commands from `stack.md`): build passes, lint green, everything committed +
   pushed, no secrets in the diff.
4. The required source branch contains the intended commit (CI usually enforces this).
5. **Migration / schema drift check (if `database != none`):** the app-deploy step usually does NOT
   apply migrations. Before deploying:
   - `git log --oneline -20 -- <migrations path>` — recent schema changes?
   - If yes: verify the target env has them (inspect the target DB), and apply them **before** the app
     deploy using the project's migration command (from `stack.md` / `db-migrations.md`).
   - **Symptom of a forgotten migration:** the app starts but breaks on first DB access ("relation
     does not exist" or similar) — often surfacing as a generic login/config error. Always check the
     migration state first before chasing code/auth hypotheses.

## Per-stage execution
For each stage, follow `deploy-infra.md`:
- Trigger the deploy (CI workflow run, or the documented manual command).
- The deploy pulls the right branch onto the target, builds with the stage's env var, recreates the
  container/service, prunes old artifacts.

**Verify:** deploy job green; the stage URL/endpoint responds healthy; smoke-test the feature (one
happy path + auth if applicable); no errors in the first minutes of logs; service stable (no restart loop).

**Bookkeeping:** add/append a Deployment section to the feature spec (date, commit SHA, env);
update `features/INDEX.md` status (→ **Deployed** once on prod).

## `/deploy prod` — strict path
### Mandatory gate before execution
1. Read `docs/security-audit.md`. Missing → STOP: "Run `/security` fully before `/deploy prod`."
2. Check the `Last audited` date. Older than 30 days OR auth/security-relevant commits merged
   since → STOP: "Security audit is stale — run `/security update` or `/security` first."
3. Read the Critical/High findings. Any `❌ Open` → STOP: "Open Critical/High finding(s): [title].
   Prod blocked — fix, then `/security update`."
4. The header must say `Go-Live recommendation: ✅ YES`. Otherwise STOP.
5. The intended commit must be on the prod branch (`main`).
6. Only if all gates pass: ask the user to confirm explicitly — "Start prod deploy? (yes/no)".

### After prod
Verify (HTTPS healthy, cert valid, login end-to-end, data loads, no 5xx, stable). Bookkeeping:
feature specs → **Deployed** with prod URL + date; tag the release; append a "Deploy prod
YYYY-MM-DD" row to the security-audit history.

### Rollback
Re-run the last good deploy with the previous commit, or hotfix on the prod branch and redeploy.
File the incident via `/bug`.

## First-time setup
If the server / DNS / CI secrets aren't set up yet, that's a one-time bootstrap documented in
`deploy-infra.md` and `docs/setup/` — not a regular deploy.

## Git Commit (deploy bookkeeping)
```
deploy(<prefix>-XXXX): roll out [feature] to <env>

- URL: <env url>
- Commit: <sha>
- Date: YYYY-MM-DD
```
