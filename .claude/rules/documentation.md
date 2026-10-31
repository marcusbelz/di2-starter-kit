# Documentation Structure (repo doc conventions)

> Where which kind of doc lives, and how files are named. One `docs/` tree with clearly separated
> subdirectories per lifecycle — deliberately not mixed within a subdirectory.

## One tree, four purposes

| Directory | Purpose | Lifecycle | Typical files |
|---|---|---|---|
| **`docs/`** (top level) | Project-wide docs — PRD, security audit, update check. | Single file per topic. | `PRD.md`, `security-audit.md`, `update-check.md` |
| **`docs/bugs/`** | Bug tracking — one file per bug + index + quarterly archive. | One-per-bug; closed bugs `git mv`'d to `archive/<quarter>/`. | `INDEX.md`, `bug-NNNN-…md`, `archive/2026-Q2/…` |
| **`docs/test-cases/`** | **Manual test cases** (UI projects) — what only a human at the screen can verify; declaration (`cases/`) separate from execution (`runs/`), grouped by `suites/`. | One file per case, **never moved** (retired, not archived); runs are never rewritten. | `INDEX.md`, `cases/test-NNNN-…md`, `suites/suite-NNN-…md`, `runs/YYYY-MM-DD-<env>.md` — convention in its `README.md` |
| **`docs/kb/`** | **Knowledge base** — troubleshooting articles and recovery/rotation runbooks. Pattern: Symptom → Cause → Diagnosis → Fix. | Ordered by lifecycle step; may be renumbered atomically to keep the sequence right. | `kb-001-…md` … `kb-NNN-…md` + `README.md` (index) |
| **`docs/setup/`** | **Setup guides** — one-time configuration/setup walkthroughs (local dev, server/deploy, CI, service accounts). | Grows; survives refactors. | `setup-001-…md` … `setup-NNN-…md` + `README.md` (index) |
| **`docs/production/`** | Generic production hardening guides. | Single file per topic. | `error-tracking.md`, `rate-limiting.md` |

Feature specs stay in **`features/`** at the repo root — they are the workflow's working set
(every skill reads `features/INDEX.md` at start), not documentation output.

## Naming convention
- **KB articles:** `kb-XXX-<kebab-slug>.md` — `XXX` is a 3-digit zero-padded number reflecting the
  onboarding / project-lifecycle order (like setup guides), not authoring order; the slug describes
  the symptom compactly.
- **Setup guides:** `setup-XXX-<kebab-slug>.md` — `XXX` reflects the typical order a new contributor
  follows (local → server → CI → …), not alphabetical.
- Directories and files lowercase, kebab-case. No `KB/`, no camelCase, no snake_case.
- **Numbers encode lifecycle order, not history.** When a new article belongs mid-sequence, renumber
  the following articles so the order stays right. Piecemeal renumbering breaks cross-refs and Git
  history, so always do it as **one atomic change**: `git mv` every affected file and update **all**
  `kb-00X` / `KB-00X` references across the repo in the same commit, then verify no link dangles
  (`node scripts/check-md-links.mjs` — see [Archiving pulls the links along](#archiving-pulls-the-links-along-mandatory)).

## When what goes where
| Situation | Directory | Example |
|---|---|---|
| Recurring class of symptoms with a fix | `docs/kb/` new `kb-NNN-…md` | "Service X fails to start after a container restart" |
| Planned recovery/rotation procedure, run rarely but deliberately | `docs/kb/` (runbook style) | `kb-00N-secret-rotation.md` |
| First-time setup of a component (DNS, SMTP, service account) | `docs/setup/` new `setup-NNN-…md` | `setup-00N-ci-deploy-key.md` |
| Repeatable manual UI check (a click test for the next deployment) | `docs/test-cases/cases/test-NNNN-…md` (written by `/ux` from a `manual-AC`, run by `/qa` / `/deploy`) | "Status change shows immediately in the list" |
| Architecture convention / coding rule every skill should auto-load | `.claude/rules/` new `*.md` | `sql/postgres/sql.md`, `deploy-infra.md` |
| Generic production hardening guide | `docs/production/` | `error-tracking.md`, `rate-limiting.md` |

## Mandatory: a README index per subdirectory
`docs/kb/` and `docs/setup/` each need a `README.md` with a markdown list of all
files (`- [KB-XXX: Title](kb-XXX-….md)`). Update the index with every new article. Longer single
files start with a Table of Contents (markdown heading anchors).

## Cross-references
- Within `docs/kb/`: relative links — `[KB-003](kb-003-….md)`.
- From `docs/setup/` to `kb/`: `[KB-004](../kb/kb-004-….md)`.
- From skills, features, code comments: full path with slug — `docs/kb/kb-006-….md`.

## Archiving pulls the links along (MANDATORY)
A `git mv` of a doc file breaks **two** kinds of links. Both are fixed in the **same** commit as the move:

| Direction | What breaks | Fix |
|---|---|---|
| **Outgoing** — links **in** the moved file | the number of `../` no longer matches the new directory depth | adjust every relative link by the depth difference |
| **Incoming** — links **to** the moved file | they still point at the old location | rewrite every reference repo-wide to the new path |

**Rule of thumb (outgoing):** number of `../` to reach the repo root = depth of the directory the
file lives in — `features/` = 1, `features/archive/<quarter>/` = 3, `docs/bugs/` = 2,
`docs/bugs/archive/<quarter>/` = 4.

**Procedure:** (1) `git mv`; (2) adjust the outgoing links to the new depth; (3) find the incoming
ones — `git grep -n "<old-basename>" -- '*.md'` — and rewrite them; (4) run the checker below.

- **Leave code blocks and code spans alone** — they hold link syntax as an *example*; a blunt
  find-and-replace on `](…)` rewrites the examples and falsifies the doc.
- **Rewrite existence-gated, not textually:** touch only links that are provably dead at the old
  target and provably resolve at the new one — a blind replace breaks links that were already right.
- **Compute the new path relative to the linking file**, not the repo path.
- **Ambiguous basenames** (`README.md`, `INDEX.md`): a name hit is no proof of a move — resolve by hand.
- **Target really deleted?** Leave the link; it documents the state at the time.

**Where it applies:** feature archive (`/deploy`, `Superseded`), bug archive (`/bug close`), KB
renumbering, any restructuring under `docs/`. **Where it does not:** `docs/test-cases/cases/` —
test cases never move (a retired case keeps its path with `Status: Retired`), which is exactly why
links to them from run protocols and bug files stay valid forever.

**Machine-checked:** [`scripts/check-md-links.mjs`](../../scripts/check-md-links.mjs) — blocking
CI step. It checks that every relative link target **exists** (anchors and external URLs are out of
scope, code blocks/spans are masked) and classifies a dead link with the fix: `[depth]` (the file
moved, outgoing links not adjusted), `[moved]` (the target moved — it names the new path), `[gone]`,
`[absolute]` (a `/`-rooted link resolves in no checkout). It sees exactly what git sees (tracked +
untracked-not-ignored files), so a local run equals the CI run. A known backlog can live in
`scripts/md-links-baseline.txt`, which only shrinks (a resolved entry is a `[stale]` finding).

## What does NOT belong in `docs/kb/` / `docs/setup/`
- **Bug reports** → `docs/bugs/bug-NNNN-<slug>.md` (index in `docs/bugs/INDEX.md`). Distill a KB
  article only once a bug pattern recurs.
- **Feature specs** → `features/<prefix>-XXXX-…md`.
- **Architecture/coding rules** → `.claude/rules/`, not a setup guide in disguise.
- **User-memory-style notes** ("user dislikes X") → your assistant memory, not the shared repo.
