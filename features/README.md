# features/ — feature specs & tracking

The workflow's working set: one spec file per feature plus the central status table in
[`INDEX.md`](INDEX.md). Every skill reads `INDEX.md` at start and updates it when done — it is the
single source of truth for what is planned / in progress / deployed.

## Conventions
- **One feature per spec file:** `<prefix>-XXXX-<kebab-name>.md`. The prefix is set by `/init`
  (`feature_id_prefix` in `.claude/rules/stack.md`, default `feat`); `XXXX` is sequential and
  zero-padded — `INDEX.md` tracks the next available ID.
- **Statuses:** `Planned` → `In Progress` → `In Review` → `Deployed` (plus `Superseded`). The
  status in the spec header and the `INDEX.md` row must always match.
- **Archive on completion:** `Deployed` (prod) and `Superseded` are terminal — the spec is
  `git mv`'d to `features/archive/<YYYY-QN>/` (quarter of the prod deploy / supersede date; same
  quarterly scheme as `docs/bugs/archive/`) and its `INDEX.md` row moves to the "Features
  (archived)" table. Archiving is done by `/deploy` (after a verified prod deploy) or by the skill
  that marks a spec `Superseded`. An archived spec never moves back; post-deploy fixes run via the
  bug-loop, follow-up work gets a new feature ID. Skills that look up a spec by ID search
  `features/**` (the archive included).
- **Created by `/requirements`** (user stories, acceptance criteria, edge cases); enriched by
  `/architecture` (tech design) and the implementation skills (implementation notes, deviations).
- **Skill Commands section (mandatory):** every spec carries a copy-paste block with the workflow
  commands for that feature (`/architecture <id>` → … → `/deploy <env>`) plus the bug-loop
  commands. `/requirements` fills the real ID and removes lines that don't apply to the stack;
  as steps complete, the block is trimmed so the next open command is always on top.
- **Shipped samples:** `feat-0001`–`feat-0003` are worked examples (one per lifecycle stage:
  `Deployed` / `In Progress` / `Planned`) for an invented task manager. `feat-0001` sits in
  `archive/2026-Q2/` as the worked example of the archive convention. `/init` deletes all of them
  (incl. the archived one) and resets the ID counter.
- **Commits** reference the feature ID: `feat(<prefix>-XXXX): description` — see
  `.claude/rules/general.md`.

## Why not under docs/?
Feature specs are *process state*, not documentation output: skills write to them at every workflow
step, and `CLAUDE.md` imports `INDEX.md` into every session. Keeping them at the repo root keeps
that hot path obvious. Long-term documentation lives in [`docs/`](../docs/).
