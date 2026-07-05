# KB-010: How rules and skills are loaded (auto-load vs. on-demand)

> Concept article — how Claude Code gets from a file under `.claude/` to behavior in a session.
> Read this to understand why rules and skills are separate directories, why `/init` pruning
> matters, and why a rule edit does not take effect mid-session.

## Table of Contents
- [The two mechanisms](#the-two-mechanisms)
- [Why skills still mention specific rule files](#why-skills-still-mention-specific-rule-files)
- [Practical consequences](#practical-consequences)
- [Common misconceptions](#common-misconceptions)
- [Related](#related)

## The two mechanisms

| | Rules (`.claude/rules/**/*.md`) | Skills (`.claude/skills/<name>/SKILL.md`) |
|---|---|---|
| Loaded | **Automatically at session start** — every file, injected into the context alongside `CLAUDE.md` and its `@`-imports (`docs/PRD.md`, `features/INDEX.md`) | **On demand** — only when the user invokes `/name` |
| Role | Always-on conventions: language policy, SQL style, security floor, doc structure | Workflow steps: a procedure with inputs, checkpoints, and outputs |
| Who "finds" them | Nobody has to — the harness loads them before the first prompt; no skill needs to say "read language.md" | The user, by typing the slash command |

Consequence of the first row: rules apply to **every** action, including ad-hoc requests that use
no skill at all ("change table X"). That is the reason a convention belongs in `rules/` and not
inside a skill text — a skill-only convention would silently not apply outside that skill.

## Why skills still mention specific rule files

Skill texts contain lines like "Read `.claude/rules/stack.md`" or "`/deploy` reads
`deploy-infra.md`". That is **not** how the file gets found — it is already in context. The
explicit read exists for two other reasons:

1. **Fresh data:** `stack.md` and `deploy-infra.md` are not style rules but *facts* (stack values,
   hosts, containers, commands). The context copy is a snapshot from session start; re-reading at
   execution time picks up edits made since.
2. **Focus:** naming the one rule that governs the current step directs attention to it among the
   many loaded rules. This matters most when **similar rules coexist** in context: before `/init`
   prunes, both SQL vendor rulesets (`sql/postgres/` *and* `sql/mssql/`) are loaded side by side —
   near-identical conventions in different dialects. "Follow `sql/postgres/procedures.md`" is a
   priority instruction that keeps the dialects from being mixed; it is steering, not loading.

So a rule mention in a skill is neither redundant nor a prerequisite — it is a deliberate
freshness/priority instrument on top of the auto-load.

### The same line weighs differently in an agent body

Projects that add **agents** (`.claude/agents/*.md` — see
[KB-011](kb-011-skills-vs-agents-subagent-dispatch.md)) reuse the identical wording
("Read `.claude/rules/backend.md`") in the agent body — but there it is **load-bearing, not
focus**: a subagent starts with a fresh, empty context where *nothing* is auto-loaded, so without
the explicit read it does not know the rule exists.

| Where the line "Read rules/X.md" appears | Effect |
|---|---|
| Skill (runs in the main conversation) | Focus + freshness — the rule is in context anyway |
| Agent body (isolated subagent) | **Required** — without the read the agent never sees the rule |

## Practical consequences

- **Every file under `rules/` costs context in every session** — including the `README.md` index
  files (kept deliberately small). This is why `/init` pruning is not cosmetic: a project without
  a UI would otherwise carry the whole UI ruleset into every single session.
- **The vendor/flavor split acts directly on context size:** `/init` keeps exactly one
  `sql/<vendor>/` and one `ui/<flavor>/` directory — an added vendor (e.g. `mssql/`) is loaded
  *instead of* `postgres/` in a real project, never in addition.
- **Rule edits take effect at the next session**, not mid-session (snapshot semantics). After
  editing a rule, start a fresh session — or explicitly ask to re-read the file.
- **New always-on conventions go to `rules/`, new procedures go to `skills/`** — the decision
  table is in `.claude/rules/documentation.md` ("When what goes where").

## Common misconceptions

| Assumption | Reality | Practical fix |
|------------|---------|---------------|
| "A skill must list a rule, otherwise the rule is ignored" | Rules load unconditionally; skill mentions are focus + freshness only | Put the convention in `rules/` and it applies everywhere |
| "The 'Read rules/X.md' lines in skills are redundant, then" | They steer: re-read facts at execution time, prioritize the governing rule among similar ones | Keep them for fact files (`stack.md`, `deploy-infra.md`) and wherever sibling rulesets could be confused |
| "I edited a rule but the session ignores it" | The context is a session-start snapshot | Start a new session, or ask for an explicit re-read |
| "More rule files = better" | Every file is paid for in context, every session | One concern per file, prune what the project does not need, keep rules concise |
| "I can drop a convention into `CLAUDE.md` instead" | Works (it auto-loads too), but mixes project identity with conventions and bypasses the pruning matrix | `CLAUDE.md` = project frame; conventions = `rules/` |

## Related
- [KB-011](kb-011-skills-vs-agents-subagent-dispatch.md) — skills vs. **agents** (`.claude/agents/`) and how subagent dispatch works; extends this picture by the third `.claude/` citizen.
- [.claude/rules/README.md](../../.claude/rules/README.md) — index of the shipped rules and their pruning conditions.
- [.claude/skills/README.md](../../.claude/skills/README.md) — index of the workflow skills.
- `.claude/rules/documentation.md` — where which kind of content lives.
