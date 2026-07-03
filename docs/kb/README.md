# Knowledge Base

> Troubleshooting articles and recovery/operations runbooks. Pattern per article: purpose /
> when-to-use, procedure, verification, and a Symptom → Cause → Fix table for the common failures.
> Naming: `kb-XXX-<kebab-slug>.md` (3-digit, zero-padded, never reassigned).
> See `.claude/rules/documentation.md`.

## Articles

The shipped set covers the database-deployment lifecycle end-to-end — and doubles as the worked
example of the KB format:

- [KB-001: Bootstrap a new database environment (`create.sh`)](kb-001-db-bootstrap-new-environment.md) — one-time setup: database, extensions, schema, roles; drop-and-recreate semantics.
- [KB-002: Deploy schema objects (`deploy.sh`) — the routine deploy](kb-002-db-deploy-schema-objects.md) — idempotent object rollout, section load order, `schema_apply_log` verification.
- [KB-003: Clean a schema and redeploy (`clean.sh`)](kb-003-db-clean-and-redeploy-schema.md) — rebuild all objects while keeping schema + grants intact.
- [KB-004: Drop a database environment (`drop.sh`)](kb-004-db-drop-environment.md) — full teardown incl. the cluster-wide parameter-grant pitfall.
- [KB-005: Set up GitHub Actions for the DB deployment](kb-005-github-actions-db-deployment-setup.md) — one-time provisioning: Environments, secrets, variables, branch rules.
- [KB-006: Apply-smoke & database object tests (`db/tests/run.sh`)](kb-006-db-apply-smoke-and-tests.md) — verify every DDL change against an empty throwaway DB before merge.
- [KB-007: How rules and skills are loaded (auto-load vs. on-demand)](kb-007-how-rules-and-skills-are-loaded.md) — why rules apply everywhere without being invoked, why skills still say "Read rules/X.md" (freshness + focus), and what that means for pruning and rule edits.
- [KB-008: Skills vs. agents — and how subagent dispatch works](kb-008-skills-vs-agents-subagent-dispatch.md) — how `.claude/agents/*.md` differ from skills, the built-in generic agents, and how the model picks a subagent via the frontmatter `description`.
- [KB-009: Create a new project from the starter-kit template](kb-009-create-new-project-from-template.md) — the "day zero" procedure: GitHub "Use this template" vs. the local copy scripts, what the scripts do, and the `/init` handoff.
