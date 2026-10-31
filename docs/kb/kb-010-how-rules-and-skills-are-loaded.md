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
| Loaded | **Automatically at session start** — every file **without** `paths:` frontmatter, injected into the context alongside `CLAUDE.md` and its `@`-imports (`docs/PRD.md`). Files **with** `paths:` (the kit's SQL vendor and UI flavor rules) load **lazily**, when a matching file is read/edited — listed in the "Rule map" of `CLAUDE.md` | **On demand** — when the user invokes `/name`, **or** when Claude matches the task against the skill's `description` (only `name` + `description` sit in context from session start) |
| Role | Always-on conventions: language policy, SQL style, security floor, doc structure | Workflow steps: a procedure with inputs, checkpoints, and outputs |
| Who "finds" them | Nobody has to — the harness loads them before the first prompt; no skill needs to say "read language.md" | The user (slash command) **or Claude itself** — the model sees every skill's `name` + `description` and can self-invoke on a match |

Consequence of the first row: rules apply to **every** action, including ad-hoc requests that use
no skill at all ("change table X"). That is the reason a convention belongs in `rules/` and not
inside a skill text — a skill-only convention would silently not apply outside that skill.

Consequence of the second row: **a skill's `description` is dispatch surface, not just
documentation** — it is what Claude matches against when deciding to invoke the skill on its own,
the same "job posting" role that agent descriptions play
([KB-011](kb-011-skills-vs-agents-subagent-dispatch.md)). A vague description never triggers; a
sharp one triggers reliably. A skill that must only ever run when the user types it can opt out
via `disable-model-invocation: true` in its frontmatter — the skill becomes invisible to the model
(zero context cost) until the user invokes it explicitly.

## Why skills still mention specific rule files

Skill texts contain lines like "Read `.claude/rules/stack.md`" or "`/deploy` reads
`deploy-infra.md`". For an always-loaded rule that is **not** how the file gets found — it is
already in context. For a **path-scoped** rule it is: the rule arrives only with the result of a
read/edit on a matching file — **after** that call — so a skill about to **create** the first file
in a scoped area (a new SQL object, a new UI component) must read the rule explicitly first, or it
writes the file without it. For always-loaded rules the explicit read exists for two other reasons:

1. **Fresh data:** `stack.md` and `deploy-infra.md` are not style rules but *facts* (stack values,
   hosts, containers, commands). The context copy is a snapshot from session start; re-reading at
   execution time picks up edits made since.
2. **Focus:** naming the one rule that governs the current step directs attention to it among the
   many loaded rules. This matters most when **similar rules coexist** in context: before `/init`
   prunes, touching a `db/**` file loads both SQL vendor rulesets (`sql/postgres/` *and*
   `sql/mssql/` share the scope) side by side — near-identical conventions in different dialects. "Follow `sql/postgres/procedures.md`" is a
   priority instruction that keeps the dialects from being mixed; it is steering, not loading.

So a rule mention in a skill is neither redundant nor a prerequisite — it is a deliberate
freshness/priority instrument on top of the auto-load.

### The same line weighs differently in an agent body

Projects that add **agents** (`.claude/agents/*.md` — see
[KB-011](kb-011-skills-vs-agents-subagent-dispatch.md)) reuse the identical wording
("Read `.claude/rules/backend.md`") in the agent body — but there it is **load-bearing, not
focus**: a subagent starts with a fresh context into which the `.claude/rules/` files are *not*
auto-loaded (a custom agent receives only `CLAUDE.md` + the git status automatically), so without
the explicit read it does not know the rule exists.

| Where the line "Read rules/X.md" appears | Effect |
|---|---|
| Skill (runs in the main conversation) | Focus + freshness — the rule is in context anyway |
| Agent body (isolated subagent) | **Required** — without the read the agent never sees the rule |

## Practical consequences

- **Every rule file without a `paths:` frontmatter costs context in every session** — including
  the `README.md` index files (kept deliberately small). Rules that carry a `paths:` glob in their
  frontmatter load **lazily** instead: only when Claude touches files matching the pattern, at
  zero cost in sessions that never match. The kit scopes its two largest rule groups — the SQL
  vendor rulesets (`db/**`) and the UI flavor (UI source) — and keeps everything without a file
  reference global (commits, bug loop, security floor, creation rules like `testing.md`). Measured
  in the project these conventions come from: 454,900 → 64,700 tokens of fixed cost before the
  first prompt, after a subagent with a 200k window had stopped starting at all
  (https://sql.marcus-belz.de/en/context-window-full-before-first-prompt/). Pruning stays
  essential too: a project without a UI should not even carry the scoped UI rules.
- **The limit of scoping:** a scoped rule arrives with the tool result, i.e. after the call — too
  late for a file being created. Three safety nets: the rule map in `CLAUDE.md` (what exists, for
  which area), skills that read the scoped rules before creating files in their area, and
  unscoped creation rules. Plus a guard so the fixed cost does not creep back:
  `scripts/check-context-budget.mjs` (budget, oversized rules, unreadable `paths:`, map parity).
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
| "A skill must list a rule, otherwise the rule is ignored" | Unscoped rules load unconditionally (skill mentions are focus + freshness); **path-scoped** rules load only on a matching file — for a new file the explicit read is required | Put the convention in `rules/`; scope it only if it has a file reference and is not a creation rule — then add the rule-map line |
| "The 'Read rules/X.md' lines in skills are redundant, then" | They steer: re-read facts at execution time, prioritize the governing rule among similar ones | Keep them for fact files (`stack.md`, `deploy-infra.md`) and wherever sibling rulesets could be confused |
| "I edited a rule but the session ignores it" | The context is a session-start snapshot | Start a new session, or ask for an explicit re-read |
| "More rule files = better" | Every file is paid for in context, every session | One concern per file, prune what the project does not need, keep rules concise |
| "I can drop a convention into `CLAUDE.md` instead" | Works (it auto-loads too), but mixes project identity with conventions and bypasses the pruning matrix | `CLAUDE.md` = project frame; conventions = `rules/` |
| "A loaded rule is a followed rule" | A rule is prose the model weighs — it raises the hit rate, it does not guarantee it | Where the core is mechanical: a **guard** in CI (`scripts/`, see the rules README "Guard anatomy") or a **hook** (`.claude/hooks/`, wired in `.claude/settings.json`) — the harness runs a hook before the tool call, the model cannot skip it |

## Related
- [KB-011](kb-011-skills-vs-agents-subagent-dispatch.md) — skills vs. **agents** (`.claude/agents/`) and how subagent dispatch works; extends this picture by the third `.claude/` citizen.
- [.claude/rules/README.md](../../.claude/rules/README.md) — index of the shipped rules and their pruning conditions; the "enforcement counterpart" principle and the guard anatomy.
- [.claude/hooks/block-inline-interpreter.mjs](../../.claude/hooks/block-inline-interpreter.mjs) — the shipped hook: blocks Bash calls that pass backslash-containing code inline to an interpreter (the tool alters it silently).
- [.claude/skills/README.md](../../.claude/skills/README.md) — index of the workflow skills.
- `.claude/rules/documentation.md` — where which kind of content lives.
