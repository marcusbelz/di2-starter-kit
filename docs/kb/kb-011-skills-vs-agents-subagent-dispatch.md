# KB-011: Skills vs. agents — and how subagent dispatch works

> Concept article — the sibling of [KB-010](kb-010-how-rules-and-skills-are-loaded.md). KB-010
> explains how *rules* and *skills* get into a session; this article explains the third `.claude/`
> citizen — **agents** (`.claude/agents/*.md`) — and the part that is invisible in daily use:
> **who decides that a subagent is launched, and which one**.

## Table of Contents
- [Skills vs. agents in one table](#skills-vs-agents-in-one-table)
- [The anatomy of an agent file — and what is actually loaded](#the-anatomy-of-an-agent-file--and-what-is-actually-loaded)
- [The built-in (generic) agents](#the-built-in-generic-agents)
- [Who decides — the three trigger paths](#who-decides--the-three-trigger-paths)
- [Steering dispatch deliberately](#steering-dispatch-deliberately)
- [Common misconceptions](#common-misconceptions)
- [Related](#related)

## Skills vs. agents in one table

Both are markdown files, but they are executed in completely different ways:

| | Skill (`.claude/skills/<name>/SKILL.md`) | Agent (`.claude/agents/<name>.md`) |
|---|---|---|
| What it is | A **procedure** loaded into the *main* conversation | A **separate Claude instance** ("subagent") with its own system prompt |
| Who executes it | The main model itself, in the current session | A freshly spawned model instance, isolated from the session |
| Context | Shares the full session context (everything discussed so far, all loaded rules) | Starts with a **fresh context** — no session conversation, no `.claude/rules/` files; custom agents do auto-receive `CLAUDE.md` + git status (the built-in `Explore`/`Plan` agents get neither) |
| Invoked by | The user, via slash command (`/backend`, `/qa`, …) | The **main model**, via a tool call (the `Agent`/`Task` tool) |
| Visibility | Every step visible in the conversation; user checkpoints work | Runs autonomously; only the **final result** returns to the main conversation |
| Model / tools | Whatever the session uses | Own `model:`, own `tools:` allowlist, own `maxTurns:` budget (frontmatter) |
| Typical use | Workflow steps with human-in-the-loop (this kit's spine) | Delegated work packages, parallelism, keeping the main context small |

Rule of thumb: **a process with user checkpoints is a skill; a self-contained work package that a
role should grind through autonomously is an agent.** The two compose: a skill text can instruct
the main model to delegate its implementation part to a specific agent — then the chain
skill → agent is deterministic instead of left to matching (see below).

> This starter kit ships **no** `.claude/agents/` files — the workflow is skills + rules only.
> Projects grown from it may add agents (typical trio: `backend-dev`, `frontend-dev`,
> `qa-engineer`) once delegation or parallelism pays off.

## The anatomy of an agent file — and what is actually loaded

```yaml
---
name: Backend Developer
description: Builds APIs, database schemas, and server-side logic with PostgreSQL
model: opus          # subagent's own model, independent of the session
maxTurns: 50         # its own turn budget
tools: Read, Write, Edit, Bash, Glob, Grep   # restricted tool set
---
You are a Backend Developer ...        # <- the BODY = the subagent's system prompt
Key rules: ... Read `.claude/rules/backend.md` ...
```

The load semantics are the key to understanding dispatch — and the most common surprise:

- **At session start, only the frontmatter (`name` + `description`) of every agent file is
  injected** into the main model's context — as a directory of available agent types. The body is
  **not** loaded into the main conversation.
- **The body is read only when the agent is spawned** — it becomes the subagent's system prompt.
  The main model never "knows" what is in the body; it picks agents purely by `description`.

Two practical consequences:

1. **The `description` is the job posting.** It is the *only* signal the dispatcher has. A vague
   description ("Helps with backend stuff") never gets matched; a sharp one ("Use this agent
   whenever building or changing API endpoints or DB schemas") gets picked reliably.
2. **The body must be self-sufficient.** The subagent has *not* inherited the session's
   conversation or the `.claude/rules/` files — what it does receive automatically is `CLAUDE.md`
   and the git status (the built-in `Explore`/`Plan` agents get neither). This is why agent
   bodies explicitly say "Read `.claude/rules/backend.md`": the isolated instance is told where
   the conventions live instead of assuming it saw them.

## The built-in (generic) agents

Even with **zero** files under `.claude/agents/`, subagents exist. Claude Code ships generic agent
types that are always available; the important ones:

| Built-in agent | What it is for |
|---|---|
| **`general-purpose`** | The catch-all: research, multi-step tasks, code search with all tools. **This is what runs when you say "use subagents" without naming one.** |
| **`Explore`** | Read-only search agent — fans out over many files/directories and returns only the conclusion, not the file dumps. Cannot edit anything. |
| **`Plan`** | Architect agent — designs an implementation plan, identifies critical files; also read-only. |

This explains the common observation *"I allowed subagents, they ran, but I never saw my custom
agent's name"*: unless the task matched a custom agent's `description` (or the agent was named
explicitly), the dispatcher fell back to `general-purpose`. Custom agents do not replace the
built-ins — they extend the same list the dispatcher chooses from.

## Who decides — the three trigger paths

Subagents are launched **by the main model, as a tool call** (`Agent` tool, with a task prompt and
a `subagent_type`). The user never launches one directly; the user creates the *occasion*:

| Trigger | Example | What happens |
|---|---|---|
| **Explicit** | "Have the qa-engineer test the acceptance criteria" | The named agent is spawned — no matching involved |
| **Generic permission** | "You can use subagents for this" | The model matches the task against all `description`s; on a hit it uses that agent, **otherwise `general-purpose`** |
| **Proactive** | An agent's `description` contains e.g. "Use PROACTIVELY after every code change" | The model delegates on its own as soon as the situation fits — no user prompt needed |

The matching in row 2 and 3 works exclusively on the frontmatter `description` (see above) — not
on the file name, not on the body.

## Steering dispatch deliberately

- **Name the agent** in the prompt when you care which one runs — that bypasses matching entirely.
- **Sharpen `description`s** to steer automatic matching: state *when* to use the agent
  ("Use this agent whenever …"), add "Use PROACTIVELY …" for self-triggering.
- **Wire agents into skills** for a fixed pipeline: a line in the skill text like "delegate the
  implementation to the `backend-dev` agent" makes the delegation part of the procedure.
- **Inspect what exists** with the `/agents` command — it lists built-in + project agents and lets
  you create or edit them interactively.
- **See what ran:** in the terminal a spawned subagent shows up as a collapsed
  `Task(<description>)` line — expand it (Ctrl+O / verbose transcript) to see the agent type and
  its steps.

## Common misconceptions

| Assumption | Reality | Practical fix |
|------------|---------|---------------|
| "The whole agent file sits in the session context" | Only `name` + `description` are loaded; the body is read at spawn time as the subagent's system prompt | Put dispatch-relevant wording into the `description`, role instructions into the body |
| "My custom agent runs whenever I allow subagents" | Generic permission triggers matching; without a `description` hit the fallback is `general-purpose` | Name the agent, or sharpen its `description` |
| "The subagent knows our conversation" | It never sees the session conversation or the rules — its fresh context holds `CLAUDE.md` + git status (custom agents) plus the task prompt it was handed | Make the task prompt self-contained; have the body point at the rule files it needs |
| "Subagents only exist if I create agent files" | `general-purpose`, `Explore`, `Plan` & co. are always available | Create custom agents only for recurring roles that need their own rules/model/tool limits |
| "Agents replace skills" | They compose: the skill is the process (checkpoints, tracking), the agent is the delegated worker | Process → skill; autonomous work package → agent |

## Related
- [KB-010](kb-010-how-rules-and-skills-are-loaded.md) — how rules and skills are loaded (auto-load vs. on-demand); this article extends that picture by the agents axis.
- [.claude/skills/README.md](../../.claude/skills/README.md) — index of the workflow skills.
- `.claude/rules/general.md` — handoffs between skills are user-initiated; agent delegation inside a skill does not change that.
