# DB Deployment & Migrations (in-house pattern, no Liquibase/Flyway by default)

> Architecture decision: by default this kit uses a **plain-SQL, in-house** migration pattern rather
> than a migration framework (Liquibase, Flyway, Alembic, …) — to avoid tool dependency / vendor
> lock-in. This is a deliberate choice. If the chosen stack ships its own migration tool (Prisma,
> Alembic, an ORM), `/init` records that in `stack.md` and you follow that tool instead — this file
> then documents the in-house fallback only. **Don't switch the established approach without asking
> the user.**
>
> Pruned at `/init` time if `database == none`.

## Two-script convention
| Script | Purpose | When |
|---|---|---|
| **`deploy.full.sql`** | Greenfield rebuild from the current object DDL. `CREATE` only, no `ALTER`. | Initial setup of a new env; disaster recovery; dev resets while pre-launch. |
| **`deploy.sql`** | Change-set — chronological, **immutable** changes (`ALTER`, `ADD CONSTRAINT`, `CREATE INDEX`; procs/functions via `CREATE OR REPLACE`). | Routine deploys on envs with real data (after go-live). |

**While the app is not yet live** (no user data to protect), both scripts are identical (both
rebuild). Once an env holds data to protect, they diverge: `deploy.full.sql` grows new `CREATE`
definitions (greenfield stays consistent); `deploy.sql` grows new **immutable** change-set entries —
existing entries are **never** removed or reordered (they are the change log). The user signals when
to switch from "synchronized" to "diverging".

## Tracker table: `schema_apply_log`
An append-only audit table — one row per apply run (timestamp, applied_by, db_version, git_sha, note).
The most recent row = current schema state. The in-house equivalent of a migration framework's
history table. The apply script passes `git_sha = git rev-parse HEAD` + a version through and inserts
a row on every run.

## Code vs. schema version — separate axes
The schema version lives in `schema_apply_log` (in the DB). The application/code version lives in a
build-time constant / a `/version` endpoint (git SHA + build number). Diagnosis: "which schema is on
env X?" → query `schema_apply_log`; "which code is on env X?" → hit `/version`; drift check → compare
the two SHAs.

## Apply-smoke after every schema change (MANDATORY)
Every DDL change must be applied **end-to-end against a throwaway DB** before merge — not just
eyeballed against the convention. Spin up an empty schema, run the apply script, require exit code 0
+ one new `schema_apply_log` row. If it fails, fix it before the branch goes to review — a merged DDL
change that doesn't run on an empty DB is broken by definition. (The failure often surfaces not on
the env where it was merged — which already had the table — but on the **next** apply on another env.)

## Deploy-time discipline
The app-deploy step does **not** apply DDL. Before a deploy, check whether the target env has recent
schema changes and apply them first (see `deploy-infra.md` → "Migration drift"). Forgetting this
shows up as the app starting but breaking on first data access.

## When to switch this convention
If the in-house pattern hits limits (complex migrations, rollback needs, team-discipline issues),
agree with the user first and write a small spec for the switch. Plain-SQL migrations with a custom
runner, or `pg_dump`/`pg_restore`-based strategies, remain in-scope alternatives that are *not* the
same as adopting a heavyweight framework.
