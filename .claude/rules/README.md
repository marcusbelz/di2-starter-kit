# .claude/rules — always-on conventions

Every `*.md` in this tree auto-loads into each Claude Code session (a rule with a `paths:`
frontmatter would instead load lazily on file match — the shipped rules deliberately use none). Rules are the project's
standing conventions; skills (in `../skills/`) are the workflow steps that apply them. How the
loading works (and what it means for pruning and rule edits):
[KB-010](../../docs/kb/kb-010-how-rules-and-skills-are-loaded.md). How rules and skills relate to
**agents** (`.claude/agents/`) and when subagents are dispatched:
[KB-011](../../docs/kb/kb-011-skills-vs-agents-subagent-dispatch.md).

| Rule | Scope | Pruned by `/init` when… |
|------|-------|-------------------------|
| [`general.md`](general.md) | Project detection, feature tracking, git conventions, bug-loop discipline | never |
| [`language.md`](language.md) | English-only repo policy | never |
| [`documentation.md`](documentation.md) | What doc goes where under `docs/` | never |
| [`stack.md`](stack.md) | **Single source of truth for the tech stack** — filled by `/init` | never (filled, not pruned) |
| [`security.md`](security.md) | Day-to-day security floor (secrets, validation, authz, headers) | never |
| [`backend.md`](backend.md) | Backend discipline (data layer, API, contracts, rate limiting) | `backend == none` |
| [`db-migrations.md`](db-migrations.md) | Plain-SQL apply model + `schema_apply_log` tracker | `database == none` |
| [`deploy-infra.md`](deploy-infra.md) | Host/container/secret facts for `/deploy` | `deploy == none` |
| [`cookies.md`](cookies.md) | Cookie-banner triggers (GDPR/ePrivacy) | no public web UI |
| [`sql/`](sql/) | Vendor-specific SQL rulesets, one subdirectory per vendor (implemented: [`sql/postgres/`](sql/postgres/), [`sql/mssql/`](sql/mssql/)) | `database` picks the vendor; others pruned |
| [`ui/`](ui/) | Flavor-specific UI rulesets, one subdirectory per UI stack (implemented: [`ui/react-tailwind-shadcn/`](ui/react-tailwind-shadcn/)) | `ui` picks the flavor; `ui == none` prunes all |

**Rules with a machine-checkable core ship an enforcement counterpart** (lint rule, CI check, or
script). A prose rule raises the hit rate, but at AI generation volume it cannot reach 100 % —
the prose explains the *why*, the guard closes the gap between a high hit rate and zero drift.
Existing instances: deploy idempotence (CI deploys twice, [`ci.yml`](../../.github/workflows/ci.yml)),
table-group numbers ([`db/scripts/lint-numbers.sh`](../../db/scripts/lint-numbers.sh)), the UI
type scale ([`ui/react-tailwind-shadcn/eslint-rules/no-raw-font-size.mjs`](ui/react-tailwind-shadcn/eslint-rules/no-raw-font-size.mjs)).
When you add a rule whose core a machine could check, add the guard with it.

Conventions for writing rules: one concern per file, English, and if a rule references a file or
path, keep that reference valid — rules are loaded verbatim into every session.
