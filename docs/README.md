# docs/ — project documentation

## Table of Contents
- [What lives here](#what-lives-here)
- [Subdirectories](#subdirectories)
- [Top-level files](#top-level-files)
- [Conventions](#conventions)

## What lives here
All project documentation in **one tree**, split by lifecycle. The authoritative "what goes where"
rule is [.claude/rules/documentation.md](../.claude/rules/documentation.md).

Feature specs deliberately do **not** live here — they are the workflow's working set and stay in
[`features/`](../features/) at the repo root.

## Subdirectories

| Directory | Purpose | Naming |
|-----------|---------|--------|
| [`bugs/`](bugs/) | One file per bug + [`INDEX.md`](bugs/INDEX.md) + quarterly archive | `bug-NNNN-<slug>.md` |
| [`kb/`](kb/) | Knowledge base: troubleshooting articles & runbooks (Symptom → Cause → Diagnosis → Fix) | `kb-NNN-<slug>.md` |
| [`setup/`](setup/) | One-time setup guides (local dev, server, CI, service accounts) | `setup-NNN-<slug>.md` |
| [`production/`](production/) | Generic production hardening guides | `<topic>.md` |

## Top-level files

| File | Purpose | Written by |
|------|---------|-----------|
| [`PRD.md`](PRD.md) | Product Requirements Document | `/requirements` (first run) |
| `security-audit.md` | Project-wide security audit results | `/security` |
| `update-check.md` | Dependency / base-image / CI update findings | `/check-updates` |

(`security-audit.md` / `update-check.md` appear once the corresponding skill has run.)

## Conventions
- Numbered files (`kb-NNN`, `setup-NNN`, `bug-NNNN`) are **never renumbered**; obsolete ones become
  stubs.
- `kb/` and `setup/` each keep a `README.md` index — update it with every new article.
- Everything is written in **US English** (see `.claude/rules/language.md`).
