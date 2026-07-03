# Production Guides

> Generic, stack-neutral hardening/operations guides referenced by skills (`/backend`, `/security`,
> `/deploy`) as needed. Add guides here as the project goes toward production. Suggested topics:

- `error-tracking.md` — wiring an error/observability backend (server + client).
- `rate-limiting.md` — rate-limiting strategy for auth + public endpoints.
- `performance.md` — caching, query optimization, bundle/runtime budgets.
- `security-headers.md` — CSP and the security-header set for a web UI.
- `database-optimization.md` — indexing, N+1 avoidance, connection pooling.

Keep them stack-neutral where possible; note stack specifics by referencing `.claude/rules/stack.md`.
