# .claude/skills — workflow skills (slash commands)

Each subdirectory is one skill (`SKILL.md` + optional templates), invoked as `/name` in Claude
Code — or auto-invoked by Claude itself when a skill's `description` matches the task (opt out
per skill via `disable-model-invocation: true`). The numbered workflow is the spine of the kit;
cross-cutting skills run anytime.
How skills are loaded (on-demand, vs. the always-on rules):
[KB-010](../../docs/kb/kb-010-how-rules-and-skills-are-loaded.md). How skills relate to
**agents** (`.claude/agents/`) and when subagents are dispatched:
[KB-011](../../docs/kb/kb-011-skills-vs-agents-subagent-dispatch.md).

## Numbered workflow
| Step | Skill | Purpose |
|------|-------|---------|
| 0 | [`init/`](init/) | One-time bootstrap: vision + stack interview, fills `stack.md`/`CLAUDE.md`, prunes unused skills/rules |
| 1 | [`requirements/`](requirements/) | Feature specs (user stories, acceptance criteria) + PRD on first run |
| 2 | [`architecture/`](architecture/) | PM-friendly technical design; decides backend yes/no |
| 3 | [`ux/`](ux/) | UX critique & mockups *(UI projects only)* |
| 4 | [`backend/`](backend/) | APIs, data model, server-side logic |
| 5 | [`frontend/`](frontend/) | UI against the real APIs *(UI projects only)* |
| 6 | [`qa/`](qa/) | Feature test vs. acceptance criteria + feature-scoped security |
| 7 | [`review/`](review/) | Code review of the diff vs. spec & conventions |
| 8 | [`check-updates/`](check-updates/) | Dependency / base-image / CI maintenance check (periodic) |
| 9 | [`security/`](security/) | Project-wide security audit — **gate before prod deploy** |
| 10 | [`deploy/`](deploy/) | Roll out to an environment |

## Cross-cutting
| Skill | Purpose |
|-------|---------|
| [`bug/`](bug/) | File/close bugs under `docs/bugs/` (bug-loop) |
| [`auth/`](auth/) | Diagnose & fix authentication problems *(auth projects only)* |
| [`help/`](help/) | Where am I in the workflow, what's next |

Handoffs between skills are always user-initiated (`.claude/rules/general.md` → Human-in-the-Loop).
