# DI² Starter Kit

A tech-stack-**agnostic**, skill-driven development workflow for Claude Code. Derived from the DI²
project: it keeps the proven workflow (Requirements → Architecture → UX → Backend → Frontend → QA →
Review → Check-Updates → Security → Deploy) and the cross-cutting bug-loop, but ships with **no
product content and no hard-coded stack**. You point it at a new project, answer a few framework
questions, and it tailors itself to that project.

## Table of Contents
- [About DI² and its database framework](#about-di-and-its-database-framework)
- [What this is](#what-this-is)
- [How it works: maximal template, then reduce](#how-it-works-maximal-template-then-reduce)
- [Getting started — use this template for a new project](#getting-started--use-this-template-for-a-new-project)
- [After cloning: run `/init`](#after-cloning-run-init)
- [The workflow](#the-workflow)
- [What's in the box](#whats-in-the-box)
- [Maintaining the template](#maintaining-the-template)
- [How this kit was written (AI-generated, human-directed)](#how-this-kit-was-written-ai-generated-human-directed)
- [Lineage & license](#lineage--license)

## About DI² and its database framework
The kit was distilled from **DI²**, a full, opinionated application by **Marcus Belz** built
end-to-end with the Claude Code workflow you see here; the generic, product-free parts of its
`.claude/` toolkit became this **DI² Starter Kit**.

The SQL conventions under `.claude/rules/sql/postgres/` were ported from the **PostgreSQL 17 database
framework** at the heart of DI² — a plain-SQL, in-house framework (tables, procedures, and functions
in PL/pgSQL) providing three-level process logging (process / component / trace in the `log` schema),
an error table, a configuration schema, and a generic ETL / dynamic-SQL layer. That framework has
been **proven in a real-world project**, which is why its conventions are carried here near-verbatim
(naming, alignment, file-numbering, the procedure/trigger/table skeletons), translated to English per
[`.claude/rules/language.md`](.claude/rules/language.md).

These ported rules are **self-contained** — they are the canonical version for this kit, so you don't
need access to the original framework to use them. The full lineage and license are in
[Lineage & license](#lineage--license) below.

> **Further reading — the SQL blog.** The core building blocks of this framework are described in
> depth in a series of blog posts at **[sql.marcus-belz.de](https://sql.marcus-belz.de)**. The posts
> cover several recurring themes — **ETL process architecture in SQL**, **data quality** (identifying
> and handling bad data so downstream systems can rely on sufficient quality), **data conversion**,
> and the trade-offs between **ETL and ELT**, among others.

## What this is
- A `.claude/` toolkit: **skills** (slash commands) + **rules** (always-on conventions) + a `CLAUDE.md`
  and a doc/feature/bug scaffold.
- The workflow is the same regardless of stack. Stack-specific behavior is parameterized off
  `.claude/rules/stack.md`, which `/init` fills in.
- A **complete, tested PostgreSQL deployment example** under [`db/`](db/): parameterized bootstrap
  SQL (`db/database/`), runnable deploy scripts (`db/scripts/`), a worked example schema (tables
  with audit columns, `ins`/`upd`/`del` procedures, triggers, function, view, seed), DB object
  tests (`db/tests/`), and GitHub Actions for CI + DB deploys (`.github/workflows/`).
- Every directory carries a `README.md` describing its artifacts and conventions.
- It is **not** a Next.js (or Python, or anything) app — there is no `src/`. The application skeleton
  is created by the workflow against whatever stack you choose.

## How it works: maximal template, then reduce
The template ships in its **maximal** form — every skill, every rule. When you run `/init` in a fresh
clone, it asks for the product vision and the framework conditions (language/runtime, UI yes/no,
backend yes/no, database, auth, hosting/deploy, CI, env stages), writes them to
`.claude/rules/stack.md` + `CLAUDE.md`, and then **prunes** the skills/rules the project doesn't need.
A Python service with no UI, for example, ends up without `/ux`, `/frontend`, the `ui/` rules, and
`/auth` (if it has no auth). See [TEMPLATE.md](TEMPLATE.md) for the full pruning matrix.

## Getting started — use this template for a new project

Two equivalent ways; the full walkthrough (what the scripts do, verification, troubleshooting) is
[KB-001: Create a new project from the starter-kit template](docs/kb/kb-001-create-new-project-from-template.md).

- **GitHub "Use this template"** (recommended — the repo must be marked as a *template repository*):
  ```bash
  gh repo create my-new-project --template <owner>/di2-starter-kit --private --clone
  ```
  or click **"Use this template" → "Create a new repository"** in the GitHub UI.
- **Local copy script** (no GitHub needed): `.\scripts\new-project.ps1 -Target <dir>` (Windows) or
  `./scripts/new-project.sh <dir>` (macOS/Linux/Git Bash) — copies the template, runs `git init`,
  and makes the initial commit.

Either way the new repo starts with a fresh history and no link to the template's git history —
never build a project on a direct `git clone` of the template.

## After cloning: run `/init`
Open the new project in Claude Code and run:
```
/init
```
It interviews you for the vision + tech stack, records them, prunes the toolkit, and hands off to
`/requirements`. From there the normal workflow takes over. If you're ever unsure where you are,
run `/help`.

## The workflow
```
/init → /requirements → /architecture → [/ux] → [/backend] → [/frontend] → /qa → /review
        → /check-updates → /security → /deploy <env>
```
Bracketed steps are pruned for projects that don't need them (no UI → no `/ux`, `/frontend`; no
backend for a given feature → skip `/backend`). Cross-cutting: `/bug` (anytime), `/auth` (auth
projects), `/help` (always).

## What's in the box
```
.claude/skills/   init · requirements · architecture · ux · backend · frontend · qa · review
                  · deploy · check-updates · security · bug · auth · help
.claude/rules/    general · documentation · stack · security · backend · db-migrations
                  · deploy-infra · cookies
                  · sql/<vendor>/{sql,tables,procedures,functions,trigger,views,policies}  (implemented: postgres · mssql)
                  · ui/<flavor>/{frontend,brand,confirm-dialog,tooltip}  (implemented: react-tailwind-shadcn)
.github/          workflows/ (ci · db-create · db-deploy · db-clean · db-drop)
docs/             PRD.md · bugs/ · kb/ · setup/ · production/
features/         INDEX.md
db/               config · database · schemas/<schema>/{tables,policies,functions,procedures,trigger,views,data} · scripts · tests  (PostgreSQL worked example)
scripts/          new-project.ps1 · new-project.sh
```

> **SQL rules are vendor-specific.** The reference ruleset under `.claude/rules/sql/postgres/` was
> written for **PostgreSQL** (ported near-verbatim from a PostgreSQL framework proven in a real-world
> project); `.claude/rules/sql/mssql/` is its **SQL Server 2022** sibling, translated to T-SQL.
> Further vendors get their own `.claude/rules/sql/<vendor>/` directory — `/init` keeps only the one
> matching the project's `database`. Overview: [.claude/rules/sql/README.md](.claude/rules/sql/README.md).

## Maintaining the template
Improvements you make to skills/rules while working on a real project can be folded back here
(`git diff` the `.claude/` tree against the template and cherry-pick the generic parts — keep
project-specific content out). The template stays maximal; projects prune.

## How this kit was written (AI-generated, human-directed)

Transparency note: the text in this repository — the skills, rules, READMEs, knowledge-base
articles, and the SQL ruleset translations — was **written by Claude (Anthropic's Claude Code)**.
It is AI-generated content, but not autonomously so: every artifact was produced **under the
direction of Marcus Belz**, who set the goals, supplied the source material (the DI² project and
its proven PostgreSQL framework), decided the structure, reviewed each result, and steered
corrections in an iterative dialog. The typical loop mirrors the kit's own workflow: the human
frames a question or a target ("explain X", "port Y", "write a KB article about Z"), Claude
drafts, the human critiques and redirects, Claude revises — with the human as the approval gate
throughout (the same human-in-the-loop principle the kit prescribes in
[`.claude/rules/general.md`](.claude/rules/general.md)).

Two practical consequences:

- **The conventions are human-proven, the wording is AI-written.** The substance (naming schemes,
  skeletons, deploy pattern) comes from a real-world project; Claude's contribution is the
  distillation, generalization, translation, and documentation of it.
- **Treat the kit as reviewed AI output, not as hand-written prose.** If you find an error, file
  it like any bug — the process above means errors are correctable design-time artifacts, not
  hallucinated facts baked in without oversight.

## Lineage & license
This kit is **MIT-licensed** (see [LICENSE](LICENSE)). Lineage:

```
di2-starter-kit  ←  DI² project (Marcus Belz)  ←  AI Coding Starter Kit (AlexPEClub, MIT)
```

It was distilled from the DI² project, which descends from the
[AI Coding Starter Kit by AlexPEClub](https://github.com/AlexPEClub/ai-coding-starter-kit) (stated as
MIT-licensed). Attribution and the third-party notice are in [NOTICE](NOTICE). The upstream's exact
copyright line is being confirmed with its author (the README declares MIT but ships no formal
LICENSE file).
