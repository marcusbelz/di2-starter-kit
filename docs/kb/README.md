# Knowledge Base

> Troubleshooting articles and recovery/operations runbooks. Pattern per article: purpose /
> when-to-use, procedure, verification, and a Symptom → Cause → Fix table for the common failures.
> Naming: `kb-XXX-<kebab-slug>.md` (3-digit, zero-padded). Numbers follow the onboarding /
> project-lifecycle order — lower numbers are earlier steps.
> See `.claude/rules/documentation.md`.

## Articles

Numbered in the order you actually perform the steps — from creating the project, through the
database-deployment lifecycle, to two reference articles on how the toolkit loads. Doubles as the
worked example of the KB format:

- [KB-001: Create a new project from the starter-kit template](kb-001-create-new-project-from-template.md) — the "day zero" procedure: GitHub "Use this template" vs. the local copy scripts, what the scripts do, and the `/init` handoff.
- [KB-002: Run the local PostgreSQL server as a Docker container](kb-002-local-postgres-docker-container.md) — create the persistent local dev server (named volume), everyday start/stop/logs/shell commands, volume access, teardown.
- [KB-003: Bootstrap a new database environment (`create.sh`)](kb-003-db-bootstrap-new-environment.md) — one-time setup: database, extensions, schema, roles; drop-and-recreate semantics.
- [KB-004: Deploy schema objects (`deploy.sh`) — the routine deploy](kb-004-db-deploy-schema-objects.md) — idempotent object rollout, section load order, `schema_apply_log` verification.
- [KB-005: Apply-smoke & database object tests (`db/tests/run.sh`)](kb-005-db-apply-smoke-and-tests.md) — verify every DDL change against an empty throwaway DB before merge.
- [KB-006: Clean a schema and redeploy (`clean.sh`)](kb-006-db-clean-and-redeploy-schema.md) — rebuild all objects while keeping schema + grants intact.
- [KB-007: Set up GitHub Actions for the DB deployment](kb-007-github-actions-db-deployment-setup.md) — one-time provisioning: Environments, secrets, variables, branch rules.
- [KB-008: Evolve the schema on environments with data](kb-008-db-schema-evolution-with-data.md) — post-go-live changes: convergent object files + run-once `predeploy`/`postdeploy` transitions, expand/contract, `schema_change_log`.
- [KB-009: Drop a database environment (`drop.sh`)](kb-009-db-drop-environment.md) — full teardown incl. the cluster-wide parameter-grant pitfall.
- [KB-010: How rules and skills are loaded (auto-load vs. on-demand)](kb-010-how-rules-and-skills-are-loaded.md) — why rules apply everywhere without being invoked, why skills still say "Read rules/X.md" (freshness + focus), and what that means for pruning and rule edits.
- [KB-011: Skills vs. agents — and how subagent dispatch works](kb-011-skills-vs-agents-subagent-dispatch.md) — how `.claude/agents/*.md` differ from skills, the built-in generic agents, and how the model picks a subagent via the frontmatter `description`.
