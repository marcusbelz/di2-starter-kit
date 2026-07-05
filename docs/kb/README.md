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
- [KB-002: Bootstrap a new database environment (`create.sh`)](kb-002-db-bootstrap-new-environment.md) — one-time setup: database, extensions, schema, roles; drop-and-recreate semantics.
- [KB-003: Deploy schema objects (`deploy.sh`) — the routine deploy](kb-003-db-deploy-schema-objects.md) — idempotent object rollout, section load order, `schema_apply_log` verification.
- [KB-004: Apply-smoke & database object tests (`db/tests/run.sh`)](kb-004-db-apply-smoke-and-tests.md) — verify every DDL change against an empty throwaway DB before merge.
- [KB-005: Clean a schema and redeploy (`clean.sh`)](kb-005-db-clean-and-redeploy-schema.md) — rebuild all objects while keeping schema + grants intact.
- [KB-006: Set up GitHub Actions for the DB deployment](kb-006-github-actions-db-deployment-setup.md) — one-time provisioning: Environments, secrets, variables, branch rules.
- [KB-007: Evolve the schema on environments with data](kb-007-db-schema-evolution-with-data.md) — post-go-live changes: convergent object files + run-once `predeploy`/`postdeploy` transitions, expand/contract, `schema_change_log`.
- [KB-008: Drop a database environment (`drop.sh`)](kb-008-db-drop-environment.md) — full teardown incl. the cluster-wide parameter-grant pitfall.
- [KB-009: How rules and skills are loaded (auto-load vs. on-demand)](kb-009-how-rules-and-skills-are-loaded.md) — why rules apply everywhere without being invoked, why skills still say "Read rules/X.md" (freshness + focus), and what that means for pruning and rule edits.
- [KB-010: Skills vs. agents — and how subagent dispatch works](kb-010-skills-vs-agents-subagent-dispatch.md) — how `.claude/agents/*.md` differ from skills, the built-in generic agents, and how the model picks a subagent via the frontmatter `description`.
