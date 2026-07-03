---
name: help
description: Context-aware guide that tells you where you are in the workflow and what to do next. Use anytime you're unsure.
argument-hint: [optional question]
user-invocable: true
---

# Project Help Guide

You are a helpful project assistant. Analyze the current project state and tell the user exactly
where they are and what to do next.

## When Invoked

### Step 1: Analyze current state
1. **Check init:** Read `.claude/rules/stack.md`.
   - Still has `{{PLACEHOLDER}}` values? → project not initialized.
   - Filled in? → read it to learn the stack (UI? backend? auth? deploy? env stages?).
2. **Check PRD:** Read `docs/PRD.md` (empty template vs. filled).
3. **Check features:** Read `features/INDEX.md` (none vs. existing + their statuses).
4. **Check feature specs:** for each feature, which sections exist (Tech Design / UX / QA / Code
   Review / Deployment)?
5. **Check the codebase:** quick scan of the project's actual source layout (per `stack.md`).

### Step 2: Determine the next action
Use the stack to skip steps that don't apply (no UI → no `/ux`/`/frontend`; no deploy target →
no `/deploy`).

**stack.md still has placeholders:**
> This is a fresh starter-kit clone. Run `/init` and I'll ask for the product idea and the
> tech-stack framework conditions, then tailor the toolkit to your project.

**Initialized, PRD has vision but no features:**
> Run `/requirements` to break the project into feature specs.

**Feature is "Planned" (no Tech Design):**
> feat-XXXX is ready for architecture. Run `/architecture` for `features/feat-XXXX-name.md`.

**Has Tech Design, project has a UI, no UX section:**
> feat-XXXX is ready for UX. Run `/ux` for `features/feat-XXXX-name.md`.

**Ready for implementation:**
> If the feature needs a backend (per its Tech Design): run `/backend` first, then `/frontend`
> (UI projects). If it's frontend-only or a no-UI project: run `/frontend` or `/backend` directly.

**Implemented, no QA:**
> Run `/qa` to test `features/feat-XXXX-name.md` against its acceptance criteria.

**Passed QA, no code review:**
> Run `/review features/feat-XXXX-name.md` before the first deploy.

**Reviewed, not yet on the first env (and a deploy target exists):**
> Run `/deploy <first-stage>` (per env_stages in stack.md).

**On a pre-prod env, `/security` not run or stale:**
> Run `/security` (or `/security update`) — mandatory gate before prod.

**Security green:**
> `docs/security-audit.md` shows Go-Live JA with no open Critical/High → run `/deploy prod`.

**All features deployed:**
> Run `/requirements` to add a feature, or check `docs/PRD.md` for planned-but-unspecified ones.

### Step 3: Answer the user's question
If the user asked something specific, answer it in the context of the current state. Common ones:
- "What skills are available?" → list them with one-line descriptions.
- "How do I add a feature?" → `/requirements` workflow.
- "How do I customize this template?" → `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, and
  `.claude/rules/stack.md` for the stack.
- "How do I deploy?" → `/deploy` workflow + prerequisites (only if a deploy target exists).

## Output Format
### Current Project Status
_Brief summary._
### Features Overview
_Table from INDEX.md._
### Recommended Next Step
_The single most important thing to do next, with the exact command._
### Other Available Actions
_Other things the user could do now._

If the user asked a specific question, answer it FIRST, then show the status overview.

## Important
- Be concise and actionable; always give the exact command; reference specific file paths.
- Don't explain the framework architecture in detail unless asked.
- Focus on: "Here's where you are, here's what to do next."
