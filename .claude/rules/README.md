# .claude/rules — always-on conventions

Every `*.md` in this tree **without** a `paths:` frontmatter auto-loads into each Claude Code
session. The SQL vendor rules (`sql/<vendor>/`, scope `db/**`) and the UI flavor rules
(`ui/<flavor>/`, scope: UI source) **carry** `paths:` — they load only when a matching file is read
or edited, and are listed in the "Rule map" of the root `CLAUDE.md` (kept in sync by
`scripts/check-context-budget.mjs`); before creating a file in their area, read them explicitly.
Why: the fixed per-session cost (`documentation.md` → "Rule vs. record"). Rules are the project's
standing conventions; skills (in `../skills/`) are the workflow steps that apply them. How the
loading works (and what it means for pruning and rule edits):
[KB-010](../../docs/kb/kb-010-how-rules-and-skills-are-loaded.md). How rules and skills relate to
**agents** (`.claude/agents/`) and when subagents are dispatched:
[KB-011](../../docs/kb/kb-011-skills-vs-agents-subagent-dispatch.md).

| Rule | Scope | Pruned by `/init` when… |
|------|-------|-------------------------|
| [`general.md`](general.md) | Project detection, feature tracking, git conventions, bug-loop threshold and reach, parallel sessions | never |
| [`testing.md`](testing.md) | Automated tests: location, "green means complete" gate, regression lock with negative control, wiring, unguarded-invariant inventory, flakes, load-test hygiene | never |
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
type scale ([`ui/react-tailwind-shadcn/eslint-rules/no-raw-font-size.mjs`](ui/react-tailwind-shadcn/eslint-rules/no-raw-font-size.mjs)),
dead links after a move ([`scripts/check-md-links.mjs`](../../scripts/check-md-links.mjs) for
[`documentation.md`](documentation.md)), oversized source files
([`scripts/check-file-size.mjs`](../../scripts/check-file-size.mjs)), and — on the harness side —
the Bash-tool hook [`.claude/hooks/block-inline-interpreter.mjs`](../hooks/block-inline-interpreter.mjs)
(a backslash in inline interpreter code is silently altered by the tool; a prose rule against it
was broken in practice). When you add a rule whose core a machine could check, add the guard with it.

**Guard anatomy** (new guards follow it, so they behave alike locally and in CI):
- **Runtime:** a dependency-free script — bash for DB tooling next to `db/scripts/`, otherwise a
  Node `.mjs` under `scripts/` using only `node:` builtins (no `package.json`; CI sets up Node).
- **File set = git's view:** `git ls-files --cached --others --exclude-standard` minus deleted
  files — ignored paths are invisible, so a local run checks what a fresh CI checkout would.
- **Findings carry a rule tag and a fix hint** (`[depth] … -> correct would be: …`), one per line.
- **Exit codes:** `0` clean, `1` findings, `2` environment problem (e.g. not a git checkout).
- **Baseline for a known backlog** (`scripts/<guard>-baseline.txt`), and it **only shrinks**: an
  entry that no longer matches a finding is itself a `[stale]` finding; `--update-baseline`
  regenerates (removes/lowers, never adds). Growing it is a deliberate, visible manual edit.
- **A negative control before merging:** the guard is shown red on a doctored input once — a
  check that has never failed has not been shown to check anything.

Conventions for writing rules: one concern per file, English, and if a rule references a file or
path, keep that reference valid — rules are loaded verbatim into every session.
