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
needs — leaving it **consistent**: no dead links, no instructions pointing at removed skills, all
guards green. After you, the regular workflow (`/requirements` → `/architecture` → …) takes over.

## Gate — only run on an uninitialized project
1. Read `.claude/rules/stack.md`. If its **Profile table** has no double-brace placeholder values
   left (e.g. `{{RUNTIME}}`), the project is already initialized → tell the user: "This project is
   already initialized (see `.claude/rules/stack.md`). `/init` is a one-time bootstrap; use
   `/requirements` to add features." Then stop.
2. Otherwise continue.

## Step 1 — Product vision (the "Textwerk")
Ask the user (use their argument if they already described the idea, then fill gaps with
`AskUserQuestion`):
- What is the core problem this product solves?
- Who are the primary users?
- Must-have features (MVP) vs. nice-to-have?
- Any hard constraints (timeline, team size, on-prem vs. cloud, data sensitivity)?

Keep this tight — `/requirements` will expand it into a full PRD. You only need enough to write a
2–3 sentence vision and a one-line description.

## Step 2 — Framework conditions (the tech stack)
Ask with `AskUserQuestion` (one question per axis; offer concrete options + let them type their own).
Capture every value in the `stack.md` table:

| Axis | Question | Drives pruning |
|---|---|---|
| **Runtime** | Primary language/runtime? (Python, Node/TS, Go, …) | build/test/run commands |
| **UI** | Does the project have a **graphical** user interface? (web UI / desktop UI / none). **A CLI or TUI counts as `none`** — the UI skills, the click-test catalog and the cookie rule are about graphical screens. | `/ux`, `/frontend`, `rules/ui/`, `cookies.md`, `docs/test-cases/` |
| **Backend** | Does it have **application logic outside a UI** — a server/API, a CLI tool, a library, jobs? (`yes` + kind: e.g. `fastapi`, `next-api`, `cli`, `library` / `none`). **`none` only for a UI-only project** (a static site, a UI against third-party APIs). `/backend` is the skill that writes and fixes all non-UI code. | `/backend`, `rules/backend.md` |
| **Database** | Data store? (none / postgres / mysql / mssql / sqlite / mongodb) | `rules/sql/`, `rules/db-migrations.md`, `db/`, DB workflows, DB articles |
| **Migrations** | How do schema changes ship? (`plain-sql` — the kit's in-house runner, see `db-migrations.md` / the stack's own tool: `alembic`, `prisma`, … / `none`). **Only ask when `database != none`** (else record `none`); default `plain-sql` for the shipped SQL vendors. | `rules/db-migrations.md` (keep only if SQL-based) |
| **DB tests** *(optional)* | Keep the DB object test scaffold under `db/tests/`? (yes / no). **Only ask when `database != none`**; default **yes**. (Application tests are not this question — they are recorded in `STACK_NOTES`, see Step 3.) | `db/tests/` |
| **Auth** | Authentication? (none / OIDC-Keycloak / OIDC-other / custom-JWT / session) | `/auth` |
| **Deploy** | Hosting / deploy target? (none / Docker on a VPS via SSH+CI / docker-compose / k8s / serverless). A library or tool that is only **released** (published, tagged) has `none`. | `/deploy`, `rules/deploy-infra.md`, SSH workflows, `check-env-files.sh` |
| **CI** | CI provider? (none / GitHub Actions / GitLab CI) | `.github/workflows/` |
| **Env stages** | Environments? (single / dev,prod / dev,int,test,prod) | `/deploy` stage list |
| **Release merge** | Who merges into the production branch (`main`)? (`user` — Claude prepares, the user merges; default / `claude` — Claude may merge and push). Ask whenever there is a production branch at all. | `general.md` rule, `/deploy prod` |
| **Feature prefix** | Feature-ID prefix? (default `feat`) | feature naming |

Two `stack.md` keys are **derived, not asked**, and confirmed with the user alongside the commands:
- **`package_manager`** — follows from the runtime answer (Python → `uv`/`pip`/`poetry`,
  Node → `npm`/`pnpm`, Go → `go mod`, …).
- The **lint / build / test / run / audit commands** for the chosen runtime (e.g. Python:
  `ruff check .`, `pytest`, `docker build .`, `pip-audit`).

Every key in the `stack.md` Profile table must end up with an explicit value — asked or
derived-and-confirmed, never silently guessed.

## Step 3 — Write the framework conditions and remove the samples
1. **`.claude/rules/stack.md`** — replace every placeholder with the captured values (the Profile
   table, the command block, and `STACK_NOTES`). This is the authoritative record. In
   `STACK_NOTES`, record the **test runner and where application tests live** (colocated next to the
   source, or a `tests/` tree — the runtime's convention unless the user prefers otherwise);
   `.claude/rules/testing.md` reads it. If the runner can report success while test files did not
   run, note that the `test` command needs a completeness wrapper (testing.md → "The gate"). Trim
   "How skills consume this file" to the skills that remain after Step 4.
2. **`CLAUDE.md`** — fill the project name, one-line description, tech-stack summary, feature prefix
   and build/test commands; **delete the HTML template comments** (the ones explaining what `/init`
   will do). Then, consistent with the Step-4 pruning:
   - workflow list: delete the lines of every pruned skill (`/ux`, `/frontend`, `/backend`,
     `/deploy`) and the `0. /init` line; renumber; cross-cutting list: drop `/auth` if pruned;
   - bug loop: name only the kept fix skills (`/frontend` / `/backend` / `/auth`);
   - project structure: drop the lines of removed dirs (`db/`, `docs/test-cases/`, …);
   - "Rule map": drop the lines of removed vendor/flavor rules; if **no** scoped rule remains,
     replace the whole section by one sentence ("No path-scoped rules in this project.");
   - `ui == none`: drop the "Cookie banner" legal note.
3. **`docs/PRD.md`** — replace the template banner (the blockquote saying the file is the empty
   template) and the vision + target-user placeholders with the real content; leave the detailed
   roadmap to `/requirements` (it keeps it in `docs/roadmap.md`).
4. **Sample features** — `git rm` `features/feat-0002-*.md`, `features/feat-0003-*.md` **and**
   `features/archive/2026-Q2/feat-0001-*.md`; in `features/INDEX.md` delete their rows and the
   "shipped samples" note, and reset "Next Available ID" to `<prefix>-0001`; in `features/README.md`
   delete the "Shipped samples" bullet. If the prefix is not `feat`, replace `feat` in the INDEX
   heading lines that state the scheme.
5. **Sample bugs** — `git rm` `docs/bugs/bug-0002-*.md` and `docs/bugs/archive/2026-Q2/bug-0001-*.md`;
   in `docs/bugs/INDEX.md` delete both rows, set the counters to `0` and "Last updated" to today; in
   `docs/bugs/README.md` delete the "Worked examples" section. The first `/bug` then files `BUG-0001`.
6. **`docs/test-cases/`** (kept only when `ui != none`) — delete the shipped *(sample)* files
   `cases/test-0001-*.md`, `suites/suite-001-*.md` and `runs/2026-07-03-local.md`, but **keep the
   three `.gitkeep` files** (the INDEX links the directories). Reset `docs/test-cases/INDEX.md`:
   Active test cases `0`, Retired `0`, Next free ID `TEST-0001`, From a bug `0 of 0`, Next free suite
   number `SUITE-001`; empty both tables (keep the header rows); remove the "shipped samples" note
   there and in the README head.
7. **Spec template** (`.claude/skills/requirements/template.md`) — trim to the kept skills: drop the
   `/ux` / `/frontend` / `/backend` / `/deploy` / `/auth` lines of pruned skills from both command
   blocks; `ui == none` → delete the "UX Design" section; `deploy == none` → rename the "Deployment"
   section to "Release" with the hint "_Added when the reviewed change is on the production branch
   (merged / tagged) — that sets the status to Deployed._".

## Step 4 — Reduce the toolkit (prune what this project doesn't need)
Delete what doesn't apply, using `git rm -r` (the clone is a tracked git repo). Apply this matrix
from the Step-2 answers:

| Condition | Remove |
|---|---|
| `ui == none` | `.claude/skills/ux/`, `.claude/skills/frontend/`, `.claude/rules/ui/`, `.claude/rules/cookies.md`, the test-case catalog `docs/test-cases/` + `scripts/check-testcases.mjs` + its step in `.github/workflows/ci.yml` |
| `ui` is a different graphical stack (not React/Tailwind/shadcn) | the UI rules ship only for one flavor (`.claude/rules/ui/react-tailwind-shadcn/`). Create `.claude/rules/ui/<flavor>/` by copying + adapting it (the principles carry over, the syntax/component names change — see `ui/README.md`), then remove `react-tailwind-shadcn/` |
| `backend == none` (UI-only project) | `.claude/skills/backend/`, `.claude/rules/backend.md` |
| `database == none` | `.claude/rules/sql/` (whole tree), `.claude/rules/db-migrations.md`, `db/` (whole tree — includes `db/tests/`), `.github/workflows/db-*.yml`, the `db-dry-run-deploy` job in `.github/workflows/ci.yml`, and the DB-only articles `docs/kb/kb-002-*` … `kb-009-*` + `docs/setup/setup-001-*`, `setup-002-*` |
| `db_tests == none` (user opted out, `database != none`) | `db/tests/` (the test scaffold only — keep the rest of `db/`) + the "db/tests assertions" step in `.github/workflows/ci.yml` |
| `database in {sqlite, mongodb}` | `.claude/rules/sql/` (keep `db-migrations.md` only if the **Migrations** answer is SQL-based, i.e. `plain-sql` — else remove) |
| `database == postgres` | `.claude/rules/sql/mssql/` (keep only the matching vendor directory) |
| `database == mssql` | `.claude/rules/sql/postgres/` (keep only the matching vendor directory). Note: the `db/` artifact tree is a PostgreSQL worked example — adapt it to T-SQL/sqlcmd or rebuild it per `sql/mssql/` |
| `database in {mysql, sqlite, …}` (SQL, no shipped ruleset) | both shipped vendor dirs. Create `.claude/rules/sql/<vendor>/` by copying + adapting a shipped one (quoting/dialect/identity differ — see `sql/README.md`) |
| `auth == none` | `.claude/skills/auth/` |
| `deploy == none` | `.claude/skills/deploy/`, `.claude/rules/deploy-infra.md`, `.github/workflows/db-create.yml` / `db-deploy.yml` / `db-clean.yml` / `db-drop.yml` (the SSH dispatch workflows — keep `ci.yml` if `ci != none`), `scripts/check-env-files.sh` |
| `ci == none` | `.github/workflows/` (whole tree) |

Always keep: `init` (until you finish — see Step 6), `requirements`, `architecture`, `qa`,
`review`, `bug`, `help`, `check-updates`, `security`, and rules `general.md`, `language.md`,
`documentation.md`, `stack.md`, `security.md`, `testing.md`; the guards
`scripts/check-md-links.mjs`, `check-context-budget.mjs`, `check-file-size.mjs`, `check-bugs.mjs`
and the Bash-tool hook `.claude/hooks/block-inline-interpreter.mjs` (stack-independent).

**Index files — every removed item leaves no row behind.** For each removed skill / rule / directory
/ script, delete its row or sentence in: `.claude/skills/README.md`, `.claude/rules/README.md`
(table + the guard examples paragraph), `.claude/rules/sql/README.md` and `ui/README.md` (if kept),
`.github/workflows/README.md`, `scripts/README.md` (guards table + the `db/scripts/` note),
`docs/kb/README.md`, `docs/setup/README.md` and the root `README.md`.

**Path-scoped rules after pruning:** the SQL vendor and UI flavor rules carry `paths:` frontmatter
(they load only when a matching file is touched). (1) Delete the "Rule map" lines in `CLAUDE.md` for
every vendor/flavor directory you removed (Step 3.2). (2) Set the `paths:` globs of the kept UI
flavor to the project's real UI source layout (the shipped defaults `src/**`, `app/**`,
`components/**`, `design/**`, `**/*.tsx|jsx|css` are a guess) — mind server code living under the
same tree (e.g. `src/app/api/**` in Next.js): the UI rules then also load during `/backend` work,
which is harmless but costs context; exclude it if the layout allows. (3) A newly created
vendor/flavor directory gets the same frontmatter on every file **and** one rule-map line per file.

**Sweep for leftovers (MANDATORY).**
1. `node scripts/check-md-links.mjs` — every finding is a link to something you removed: delete the
   row/sentence (or reword it), never point it elsewhere by guess. Repeat until 0 findings.
2. Prose references that are not links:
   `git grep -nE "/(ux|frontend|backend|deploy|auth)\b|check-testcases|test-cases|sql/(postgres|mssql)|ui/react|deploy-infra|db-migrations|cookies\.md|db/scripts" -- "*.md" "*.yml"`
   — an instruction that only applies when the item exists and **already says so** ("if the project
   has a UI", "UI projects", "(if kept)") stays; an **unconditional** instruction or handoff to a
   removed item is deleted or reworded (e.g. the next-step command of a kept skill).

After deleting, **show the user the resulting skill/rule list** and confirm it matches expectations.

## Step 5 — Stack-specific fill-in (where a kept skill needs concrete facts)
- **CI (`ci != none`):** add an `app` job to `.github/workflows/ci.yml` that runs the project's
  `lint` and `test` commands from `stack.md` (set up the runtime with the provider's setup action;
  the test command must fail when test files did not run — `testing.md` → "The gate"), and rewrite
  the header comment of `ci.yml` for this project (which jobs exist and why). Update the `ci.yml`
  row in `.github/workflows/README.md`.
- If `deploy != none`: open `.claude/rules/deploy-infra.md` and replace its host / container / path
  / secret placeholders with the project's real values (or leave clearly marked TODOs the user fills
  when the server exists). Trim the env-stage tables there **and** the stage table in
  `.claude/skills/deploy/SKILL.md` to the chosen `env_stages`. Fill the `ENV_FILE` / `ENVS_DEFAULT`
  / `VARS` block at the top of `scripts/check-env-files.sh` from the same facts (it refuses to run
  while a placeholder is left — an allowed leftover until the server exists).
- If `deploy != none` **and** `database != none`: fill the "Data protection" table in
  `deploy-infra.md` — one row per env, **`greenfield` everywhere until go-live** unless the user says
  an environment already holds data to protect; date + "user" as the decision.
- **Release merge:** write the Step-2 answer into `stack.md` (`release_merge`). `general.md`'s
  production-branch rule applies when it is `user`.
- **Guards (always):** set `SOURCE_ROOTS` at the top of `scripts/check-file-size.mjs` to the
  project's source directories (and narrow `SOURCE_EXT` if useful). The guards and the hook need
  `node` (any LTS) on the PATH — confirm the user has it; if not, say that the hook then errors
  without blocking and the guards run in CI only.
- `ui != none`: the brand palette/typography placeholders in the kept flavor's `brand.md` — fill
  them if the user already knows the brand; otherwise leave them as the **allowed leftover** that
  `/ux` fills (say so in the handoff).
- If `database` is a SQL engine and you kept `db-migrations.md`: confirm the migration command names.
- If `auth != none`: note the actual provider (and IdP product) in the "Read the setup first"
  section of `.claude/skills/auth/SKILL.md`, so the diagnosis layers match the real setup.

## Step 6 — Finish
1. `git rm -r .claude/skills/init` (this skill removes itself — it is a one-time bootstrap) and
   delete its row in `.claude/skills/README.md` (and any remaining `/init` mention that is not
   history). *(Tell the user first; if they'd rather keep it for re-running, skip this.)*
2. **Final gate (MANDATORY — nothing is committed red):**
   - every guard that is still present reports 0 findings: `node scripts/check-md-links.mjs`,
     `check-context-budget.mjs`, `check-file-size.mjs`, `check-bugs.mjs`, `check-testcases.mjs`
     (if kept), `bash db/scripts/lint-numbers.sh` (if kept); then lower `BUDGET_TOKENS` in
     `check-context-budget.mjs` to the measured value plus a margin, so growth stays visible;
   - the workflow files still parse (YAML) and reference no removed script;
   - **no placeholder is left** except the allowed ones (brand palette until `/ux`,
     `check-env-files.sh` until the server exists):
     `git grep -nE "\{\{[A-Z_]+\}\}" -- . ":(exclude).github/**"` — GitHub `${{ … }}` expressions
     and docker format strings like `{{.Names}}` are not placeholders and do not match.
3. Stage everything and propose a commit:
   ```
   chore: initialize project from starter kit (<runtime>, <ui>, <deploy>)

   - Filled .claude/rules/stack.md + CLAUDE.md tech stack
   - Pruned skills/rules/docs not needed for this stack; samples removed; guards green
   - Seeded docs/PRD.md vision
   ```
4. Handoff:
   > "Project initialized for **<stack summary>**. The toolkit is trimmed to what this project needs
   > and every guard is green. Next step: `/requirements <your idea>` — it can break the vision into
   > a first batch of features, or spec a single feature."

## Important
- **Do NOT write application code or pick a stack on the user's behalf** — only record what they
  choose and prune accordingly.
- **Confirm before deleting** — show the prune list and get a yes before `git rm`.
- After every file write, re-read it to verify the placeholders are actually gone.
- If the user is unsure on an axis, default to **keeping** the corresponding skill/rule (a project
  can always prune later, but re-adding a deleted skill means copying from the template again).
