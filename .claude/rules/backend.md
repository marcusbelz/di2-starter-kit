# Backend Rules (API / data / server-side)

> Stack-agnostic backend discipline. The concrete framework, database, and language come from
> `.claude/rules/stack.md`. Pruned at `/init` time if the project has no backend.

## Data layer
- **Access control at the data layer where the engine supports it.** For PostgreSQL on a
  multi-user/multi-tenant app, enable Row-Level Security on every table (see `.claude/rules/sql/`) as
  defense-in-depth — the application still enforces authorization in code.
- **Audit columns:** store the authenticated app user's email in `created_by` / `modified_by`
  (supplied by the app), and timestamps as `*_on`. Never rely on the DB connection role for "who".
- **Indexes** on every frequently filtered/sorted/joined column. **Foreign keys** with deliberate
  `ON DELETE` behavior. **No N+1 queries** — join instead of looping. **All list queries are bounded**
  (limit/paginate).
- **Migrations** follow `db-migrations.md` (or the stack's migration tool) and are idempotent.

## API / interface
- **Input validation on every write path**, server-side, using the stack's validation library. Define
  max lengths; normalize emails (`lower().trim()`) before storage.
- **Parameterized queries only** — never build SQL by string concatenation with user input.
- **Always check the session/identity** before returning or mutating data (where `auth != none`).
  Authorization checks role, not just authentication. No endpoint returns another user's data (IDOR).
- **Meaningful errors** with correct status/exit codes; error responses leak no internals (no DB
  messages, stack traces, secrets).
- **No hardcoded secrets** — only from env/secret store.

## Contract & testing
- Document each endpoint (method/path/auth, request/response shape, error codes) in the feature spec's
  Tech Design so the frontend can build against it.
- Smoke-test every endpoint before handoff: auth (unauth → rejected, wrong role → forbidden),
  validation (bad payload → clear error), happy path returns the documented shape.

## Rate limiting
On login / password-reset / sensitive mutations. Note that in-memory limiters lose state on restart
and don't scale horizontally — fine for MVP, flag it for `/security`.
