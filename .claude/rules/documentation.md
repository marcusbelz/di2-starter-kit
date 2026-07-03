# Documentation Structure (repo doc conventions)

> Where which kind of doc lives, and how files are named. One `docs/` tree with clearly separated
> subdirectories per lifecycle — deliberately not mixed within a subdirectory.

## One tree, four purposes

| Directory | Purpose | Lifecycle | Typical files |
|---|---|---|---|
| **`docs/`** (top level) | Project-wide docs — PRD, security audit, update check. | Single file per topic. | `PRD.md`, `security-audit.md`, `update-check.md` |
| **`docs/bugs/`** | Bug tracking — one file per bug + index + quarterly archive. | One-per-bug; closed bugs `git mv`'d to `archive/<quarter>/`. | `INDEX.md`, `bug-NNNN-…md`, `archive/2026-Q2/…` |
| **`docs/kb/`** | **Knowledge base** — troubleshooting articles and recovery/rotation runbooks. Pattern: Symptom → Cause → Diagnosis → Fix. | Append-only (KB number grows monotonically). | `kb-001-…md` … `kb-NNN-…md` + `README.md` (index) |
| **`docs/setup/`** | **Setup guides** — one-time configuration/setup walkthroughs (local dev, server/deploy, CI, service accounts). | Grows; survives refactors. | `setup-001-…md` … `setup-NNN-…md` + `README.md` (index) |
| **`docs/production/`** | Generic production hardening guides. | Single file per topic. | `error-tracking.md`, `rate-limiting.md` |

Feature specs stay in **`features/`** at the repo root — they are the workflow's working set
(every skill reads `features/INDEX.md` at start), not documentation output.

## Naming convention
- **KB articles:** `kb-XXX-<kebab-slug>.md` — `XXX` is a 3-digit zero-padded running number; the slug
  describes the symptom compactly.
- **Setup guides:** `setup-XXX-<kebab-slug>.md` — `XXX` reflects the typical order a new contributor
  follows (local → server → CI → …), not alphabetical.
- Directories and files lowercase, kebab-case. No `KB/`, no camelCase, no snake_case.
- **Numbers are never reassigned.** If `kb-005` becomes obsolete, adapt it or leave a stub — never
  renumber `kb-006`, `kb-007`, … (it breaks cross-refs and Git history).

## When what goes where
| Situation | Directory | Example |
|---|---|---|
| Recurring class of symptoms with a fix | `docs/kb/` new `kb-NNN-…md` | "Service X fails to start after a container restart" |
| Planned recovery/rotation procedure, run rarely but deliberately | `docs/kb/` (runbook style) | `kb-00N-secret-rotation.md` |
| First-time setup of a component (DNS, SMTP, service account) | `docs/setup/` new `setup-NNN-…md` | `setup-00N-ci-deploy-key.md` |
| Architecture convention / coding rule every skill should auto-load | `.claude/rules/` new `*.md` | `sql/postgres/sql.md`, `deploy-infra.md` |
| Generic production hardening guide | `docs/production/` | `error-tracking.md`, `rate-limiting.md` |

## Mandatory: a README index per subdirectory
`docs/kb/` and `docs/setup/` each need a `README.md` with a markdown list of all
files (`- [KB-XXX: Title](kb-XXX-….md)`). Update the index with every new article. Longer single
files start with a Table of Contents (markdown heading anchors).

## Cross-references
- Within `docs/kb/`: relative links — `[KB-002](kb-002-….md)`.
- From `docs/setup/` to `kb/`: `[KB-003](../kb/kb-003-….md)`.
- From skills, features, code comments: full path with slug — `docs/kb/kb-005-….md`.

## What does NOT belong in `docs/kb/` / `docs/setup/`
- **Bug reports** → `docs/bugs/bug-NNNN-<slug>.md` (index in `docs/bugs/INDEX.md`). Distill a KB
  article only once a bug pattern recurs.
- **Feature specs** → `features/<prefix>-XXXX-…md`.
- **Architecture/coding rules** → `.claude/rules/`, not a setup guide in disguise.
- **User-memory-style notes** ("user dislikes X") → your assistant memory, not the shared repo.
