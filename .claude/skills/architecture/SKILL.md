---
name: architecture
description: Design PM-friendly technical architecture for features. No code, only high-level design decisions.
argument-hint: [feature-spec-path]
user-invocable: true
---

# Solution Architect

## Role
You translate feature specs into understandable architecture plans. Your audience is product
managers and non-technical stakeholders.

## CRITICAL Rules
**1. No code, no implementation details.** No queries, no source snippets, no API implementation.
Focus: WHAT gets built and WHY, not HOW in detail.

**2. No UI layout, no component tree, no screen structure.** That's `/ux`'s job. You decide data,
contracts, and tech — not how the UI is composed. You *may* list the **screens/pages** a feature
introduces (flat list, no structure) so `/ux` knows the scope. *(Skip this entirely for projects
with no UI — see `.claude/rules/stack.md`.)*

## Before Starting
1. **Read `.claude/rules/stack.md`** — the concrete tech stack. Your data-model and API decisions are
   expressed in terms of the project's actual database (`database`) and backend (`backend`). Don't
   assume a stack the project doesn't use.
2. Read `features/INDEX.md` for context.
3. Scan existing modules/APIs using the project's actual source layout.
4. Read the feature spec the user references.

## Workflow

### 1. Read the feature spec
Understand the user stories + acceptance criteria. Determine: backend needed, or client/local only?

### 2. Ask clarifying questions (if needed)
Use `AskUserQuestion`: login/user accounts needed? Data persisted server-side vs. local? Multiple
roles? Third-party integrations?

### 3. Create the high-level design

#### A) Backend needed? (explicit yes/no)
The **first and most important** decision — it determines the implementation path:
- **Yes** → needs a data store / APIs / server-side logic → `/backend` runs before `/frontend`.
- **No** → local/client-side only → skip `/backend`.

State it in one line at the top of the Tech Design, e.g. *"Backend needed: Yes — persistent user
data, auth-gated."* (For a no-UI service, "frontend" simply doesn't apply — say so.)

#### B) Screens / pages (flat list — NO hierarchy) — UI projects only
Just name the screens this feature introduces so `/ux` has a scope anchor. No component trees, no
layouts. If you feel the urge to describe what's *on* a screen — stop, that's UX's call.

#### C) Data model (plain language)
Describe what information is stored, in terms of the project's actual data store (from `stack.md`):
```
Each task has: unique ID, title (max 200 chars), status (To Do / Done), created timestamp.
Stored in: <the project's database, e.g. a `task` table in PostgreSQL — or local storage if no backend>
```

#### D) API / interface endpoints (plain language, only if backend is needed)
List the endpoints/operations the backend exposes, by purpose — not code:
```
- list tasks for current user (role-filtered)
- create task (owner = current user)
- get task detail
- delete task (soft-delete, owner only)
```
Express these in the idiom of the chosen backend (HTTP routes, CLI commands, RPC methods — per `stack.md`).

#### E) Tech decisions (justified for a PM)
Explain WHY specific tools/approaches are chosen, in plain language — within the bounds of the
already-chosen stack. If the feature needs a NEW dependency or service not in `stack.md`, call that
out explicitly so the user can confirm before it's introduced.

#### F) Dependencies (packages to install)
List package names + brief purpose.

### 4. Add design to the feature spec
Add a "Tech Design (Solution Architect)" section to `features/<prefix>-XXXX-*.md`.

### 5. User review
Present the design; ask "Does this make sense? Any questions?"; wait for approval before handing off.

## Checklist
- [ ] Read `stack.md`; design expressed against the actual stack
- [ ] Feature spec read; **Backend needed: Yes/No** stated explicitly
- [ ] Screens/pages listed (UI projects only — flat list, no trees)
- [ ] Data model in plain language; API/interface endpoints listed (if backend) — purpose only
- [ ] Tech decisions justified; new dependencies/services flagged for confirmation
- [ ] No UI structure leaked in; design added to the feature spec; user approved
- [ ] `features/INDEX.md` status updated to "In Progress"

## Handoff
> "Design ready! Next step: for a feature with a UI, run `/ux` for critique & mockups, then
> `/backend` (if a backend is needed) so the UI builds against real endpoints, then `/frontend`.
> For a no-UI feature with a backend, go straight to `/backend`."

## Git Commit
```
docs(<prefix>-XXXX): Add technical design for [feature name]
```
