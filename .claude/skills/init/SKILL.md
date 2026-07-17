---
name: init
description: One-time project bootstrap. Asks for the product vision and the tech-stack framework conditions, fills CLAUDE.md + .claude/rules/stack.md, and prunes the skills/rules this project does not need. Run this first in a fresh clone of the starter kit.
argument-hint: [optional project idea]
user-invocable: true
---

# Project Initializer

## Role
You bootstrap a fresh clone of this starter kit into a concrete project. The kit ships as the
**maximal** toolkit (every workflow + cross-cutting skill, every rule). Your job is to ask the
user for the project's **framework conditions** (product vision + tech stack), record them as the
single source of truth, and then **reduce** the toolkit subtractively to exactly what this project
needs. After you, the regular workflow (`/requirements` → `/architecture` → …) takes over.

## Gate — only run on an uninitialized project
1. Read `.claude/rules/stack.md`. If it has **no** `{{PLACEHOLDER}}` values, the project is already
   initialized → tell the user: "This project is already initialized (see `.claude/rules/stack.md`).
   `/init` is a one-time bootstrap; use `/requirements` to add features." Then stop.
2. Otherwise continue.

## Step 1 — Product vision (the "Textwerk")
Ask the user (use their argument if they already described the idea, then fill gaps with
`AskUserQuestion`):
- What is the core problem this product solves?
- Who are the primary users?
- Must-have features (MVP) vs. nice-to-have?
- Any hard constraints (timeline, team size, on-prem vs. cloud, data sensitivity)?

Keep this tight — `/requirements` Init Mode will expand it into a full PRD. You only need enough to
write a 2–3 sentence vision and a one-line description.

## Step 2 — Framework conditions (the tech stack)
Ask with `AskUserQuestion` (one question per axis; offer concrete options + let them type their own).
Capture every value in the `stack.md` table:

| Axis | Question | Drives pruning |
|---|---|---|
| **Runtime** | Primary language/runtime? (Python, Node/TS, Go, …) | build/test/run commands |
| **UI** | Does the project have a user interface? (web UI / CLI / TUI / none) | `/ux`, `/frontend`, `rules/ui/`, `cookies.md` |
| **Backend** | Does it need server-side logic / APIs? (yes / no) | `/backend`, `rules/backend.md` |
| **Database** | Data store? (none / postgres / mysql / mssql / sqlite / mongodb) | `rules/sql/`, `rules/db-migrations.md` |
| **Migrations** | How do schema changes ship? (`plain-sql` — the kit's in-house runner, see `db-migrations.md` / the stack's own tool: `alembic`, `prisma`, … / `none`). **Only ask when `database != none`** (else record `none`); default `plain-sql` for the shipped SQL vendors. | `rules/db-migrations.md` (keep only if SQL-based) |
| **Tests** *(optional)* | Keep the test scaffold? (yes / no) — currently the DB object tests under `db/tests/`. **Only ask when `database != none`** (with no database there is no scaffold to keep). Default **yes** when unsure. | `db/tests/` |
| **Auth** | Authentication? (none / OIDC-Keycloak / OIDC-other / custom-JWT / session) | `/auth` |
| **Deploy** | Hosting / deploy target? (none / Docker on a VPS via SSH+CI / docker-compose / k8s / serverless) | `/deploy`, `rules/deploy-infra.md` |
| **CI** | CI provider? (none / GitHub Actions / GitLab CI) | deploy + check-updates wording |
| **Env stages** | Environments? (single / dev,prod / dev,int,test,prod) | `/deploy` stage list |
| **Feature prefix** | Feature-ID prefix? (default `feat`) | feature naming |

Two `stack.md` keys are **derived, not asked**, and confirmed with the user alongside the commands:
- **`package_manager`** — follows from the runtime answer (Python → `uv`/`pip`/`poetry`,
  Node → `npm`/`pnpm`, Go → `go mod`, …).
- The **build / test / run / audit commands** for the chosen runtime (e.g. Python:
  `ruff check .`, `pytest`, `docker build .`, `pip-audit`).

Every key in the `stack.md` Profile table must end up with an explicit value — asked or
derived-and-confirmed, never silently guessed.

## Step 3 — Write the framework conditions
1. **`.claude/rules/stack.md`** — replace every `{{PLACEHOLDER}}` with the captured values (the
   Profile table, the build/test/run block, and `STACK_NOTES`). This is the authoritative record.
2. **`CLAUDE.md`** — fill `{{PROJECT_NAME}}`, `{{ONE_LINE_DESCRIPTION}}`, `{{TECH_STACK}}` (a short
   prose summary), `{{FEATURE_PREFIX}}`, `{{BUILD_TEST_COMMANDS}}`. If `ui` is `none`, delete the
   UX (3) and Frontend (5) lines from the workflow list and the "Cookie banner" legal note.
3. **`docs/PRD.md`** — replace the placeholder vision with the real 2–3 sentence vision + target
   users (leave the detailed roadmap for `/requirements`).
4. **`features/INDEX.md`** — delete the shipped **sample features** (`features/feat-0001-*.md` …
   `feat-0003-*.md` and their INDEX rows — they are format illustrations, not project features),
   then set the `feature_id_prefix` example and reset the "Next Available ID" line to the chosen
   prefix (e.g. `feat-0001`).

## Step 4 — Reduce the toolkit (prune what this project doesn't need)
Delete the skills/rules that don't apply, using `git rm -r` (the clone is a tracked git repo).
Apply this matrix from the Step-2 answers:

| Condition | Remove |
|---|---|
| `ui == none` | `.claude/skills/ux/`, `.claude/skills/frontend/`, `.claude/rules/ui/`, `.claude/rules/cookies.md` |
| `ui` is a different stack (not React/Tailwind/shadcn) | the UI rules ship only for one flavor (`.claude/rules/ui/react-tailwind-shadcn/`). Create `.claude/rules/ui/<flavor>/` by copying + adapting it (the principles carry over, the syntax/component names change — see `ui/README.md`), then remove `react-tailwind-shadcn/` |
| `backend == none` | `.claude/skills/backend/`, `.claude/rules/backend.md` |
| `database == none` | `.claude/rules/sql/` (whole tree), `.claude/rules/db-migrations.md`, `db/` (whole tree — includes `db/tests/`), `.github/workflows/db-*.yml` + the db jobs in `.github/workflows/ci.yml` |
| `tests == none` (user opted out, `database != none`) | `db/tests/` (the test scaffold only — keep the rest of `db/`) + the "db/tests assertions" step in `.github/workflows/ci.yml` |
| `database in {sqlite, mongodb}` | `.claude/rules/sql/` (keep `db-migrations.md` only if the **Migrations** answer is SQL-based, i.e. `plain-sql` — else remove) |
| `database == postgres` | `.claude/rules/sql/mssql/` (keep only the matching vendor directory) |
| `database == mssql` | `.claude/rules/sql/postgres/` (keep only the matching vendor directory). Note: the `db/` artifact tree is a PostgreSQL worked example — adapt it to T-SQL/sqlcmd or rebuild it per `sql/mssql/` |
| `database in {mysql, sqlite, …}` (SQL, no shipped ruleset) | both shipped vendor dirs. Create `.claude/rules/sql/<vendor>/` by copying + adapting a shipped one (quoting/dialect/identity differ — see `sql/README.md`) |
| `auth == none` | `.claude/skills/auth/` |
| `deploy == none` | `.claude/skills/deploy/`, `.claude/rules/deploy-infra.md`, `.github/workflows/db-create.yml` / `db-deploy.yml` / `db-clean.yml` / `db-drop.yml` (the SSH dispatch workflows — keep `ci.yml` if `ci != none`) |
| `ci == none` | `.github/workflows/` (whole tree) |

Always keep: `init` (until you finish — see Step 6), `requirements`, `architecture`, `qa`,
`review`, `bug`, `help`, `check-updates`, `security`, and rules `general.md`, `documentation.md`,
`stack.md`, `security.md`.

After deleting, **show the user the resulting skill/rule list** and confirm it matches expectations.

## Step 5 — Stack-specific fill-in (where a kept skill needs concrete facts)
- If `deploy != none`: open `.claude/rules/deploy-infra.md` and replace its `{{PLACEHOLDER}}` host /
  container / path / secret facts with the project's real values (or leave clearly marked TODOs the
  user fills when the server exists). Trim the env-stage tables to the chosen `env_stages`.
- If `database` is a SQL engine and you kept `db-migrations.md`: confirm the migration command names.
- If `auth != none` and not Keycloak: note the actual provider in `.claude/skills/auth/SKILL.md`'s
  context line so the diagnosis layers match the real setup.

## Step 6 — Finish
1. `git rm -r .claude/skills/init` (this skill removes itself — it is a one-time bootstrap).
   *(Tell the user first; if they'd rather keep it for re-running, skip this.)*
2. Stage everything and propose a commit:
   ```
   chore: initialize project from starter kit (<runtime>, <ui>, <deploy>)

   - Filled .claude/rules/stack.md + CLAUDE.md tech stack
   - Pruned skills/rules not needed for this stack
   - Seeded docs/PRD.md vision
   ```
3. Handoff:
   > "Project initialized for **<stack summary>**. The toolkit is trimmed to what this project needs.
   > Next step: run `/requirements <your idea>` to turn the vision into feature specs."

## Important
- **Do NOT write application code or pick a stack on the user's behalf** — only record what they
  choose and prune accordingly.
- **Confirm before deleting** — show the prune list and get a yes before `git rm`.
- After every file write, re-read it to verify the placeholders are actually gone (no leftover
  `{{...}}` in `stack.md` or `CLAUDE.md`).
- If the user is unsure on an axis, default to **keeping** the corresponding skill/rule (a project
  can always prune later, but re-adding a deleted skill means copying from the template again).
