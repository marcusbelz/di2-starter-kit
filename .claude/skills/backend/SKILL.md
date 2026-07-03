---
name: backend
description: Build APIs, data model, and server-side logic. Use after the design (and UX mockups, if any) exist — backend is built before the frontend so the UI can consume real endpoints.
argument-hint: "feature-spec-path"
user-invocable: true
---

# Backend Developer

## Role
You read feature specs + tech design and implement APIs, the data model, and server-side logic —
**against the project's actual stack**, not a hard-coded one.

## Before Starting
1. **Read `.claude/rules/stack.md`** — `backend`, `database`, `migrations`, `auth`, and the
   build/test/run commands. Everything below adapts to these values.
2. Read `features/INDEX.md` and the referenced feature spec (incl. Tech Design).
3. Scan existing endpoints / data-access code in the project's actual source layout.

## Workflow

### 1. Read spec + design
Understand the data model and the endpoints/operations the architect specified.

### 2. Ask technical questions
Use `AskUserQuestion`: permissions model (owner-only vs. shared)? concurrent edits? rate limiting?
specific input validations?

### 3. Create the data model (if `database != none`)
- Put schema/migrations where the stack dictates (`migrations` in `stack.md`). For **plain-SQL**
  migrations, follow `.claude/rules/db-migrations.md`. For an ORM/migration tool, follow its idiom.
- **If `database` is a SQL engine, follow the vendor rules under `.claude/rules/sql/`** for
  naming/layout (PostgreSQL: `sql/postgres/`; other vendors get a sibling `sql/<vendor>/` — note
  dialect differences for MySQL/MSSQL).
- **Idempotency:** every migration must run repeatably without error.
- Add indexes on performance-critical columns; foreign keys with appropriate `ON DELETE` behavior.
- **Access control at the data layer:** if the engine supports it (e.g. PostgreSQL Row-Level
  Security) and the app is multi-tenant/multi-user, enable it as defense-in-depth. (`security.md`)

### 4. Create the API / interface
- Implement the endpoints/operations in the idiom of `backend` (HTTP routes, CLI, RPC — per `stack.md`).
- **Input validation on every write path** (use the stack's validation library).
- Meaningful errors with correct status/exit codes. **Always check authentication** where `auth != none`.

### 5. Document the contract for the frontend
Backend runs **before** frontend. In the feature spec's Tech Design, list every endpoint
(method/path/auth), request/response shapes, error codes, and a short example call per endpoint.

### 6. Smoke-test it yourself
Hit every endpoint (curl / REST client / CLI / `<run command>` from `stack.md`). Verify: auth
(logged-out → rejected, wrong role → forbidden), validation (bad payload → clear error), happy path
returns the documented shape.

### 7. User review
Walk the user through the endpoints; ask what edge cases to test before the frontend consumes them.

## Context Recovery
If context was compacted: re-read the feature spec + `features/INDEX.md`; `git diff` to see your
changes; scan existing endpoints again; continue — don't restart or duplicate.

## Bug-Fix Mode (`/backend BUG-NNNN`)
- Read `docs/bugs/bug-NNNN-<slug>.md` (`Glob docs/bugs/bug-NNNN-*.md`).
- **Only** accept API / data-model / access-control / auth / server-logic bugs. UI/interaction bugs
  → `/frontend BUG-NNNN`; login/session/OIDC → `/auth BUG-NNNN`.
- **No scope-creep:** fix only what the bug describes. Note systemic patterns as candidates for the
  next `/security` run instead of widening the fix.
- Commit per `.claude/rules/general.md` bug-fix format. Don't change bug status — `/bug close` does
  that after a green `/qa` re-test.
- Handoff: "Fix for `BUG-NNNN` committed. Next: `/qa` re-tests, then `/bug close BUG-NNNN`."

## Checklist
- [ ] Read `stack.md`; implemented against the actual backend/database
- [ ] Data layer: migrations idempotent; indexes + FKs set; data-layer access control where applicable
- [ ] All planned endpoints implemented; auth enforced; input validation on all writes
- [ ] Meaningful errors + correct status codes; no hardcoded secrets
- [ ] API contract documented in the feature spec; every endpoint smoke-tested
- [ ] `build`/`lint` (from `stack.md`) pass; `features/INDEX.md` status "In Progress"; committed

## Handoff
> "Backend done and APIs documented. Next step: `/frontend` to build the UI against the real
> endpoints (UI projects), or `/qa` if this is a no-UI service."

## Git Commit
```
feat(<prefix>-XXXX): Implement backend for [feature name]
```
