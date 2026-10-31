# scripts/ — template helper scripts and repo guards

## Table of Contents
- [Helpers](#helpers)
- [Guards](#guards)

## Helpers

Helpers for working with the starter kit itself (project-level helpers created later by the
workflow also land here).

| Script | Platform | Purpose |
|--------|----------|---------|
| [`new-project.ps1`](new-project.ps1) | Windows / PowerShell | Copy the template's **committed** state (`git archive HEAD` — no untracked or ignored files) into a fresh local repo (`git init` + initial commit); needs the template as a git clone |
| [`new-project.sh`](new-project.sh) | macOS / Linux / Git Bash | Same, for POSIX shells |

Usage — full walkthrough incl. verification and troubleshooting:
[KB-001](../docs/kb/kb-001-create-new-project-from-template.md) (short form: root
[README](../README.md) → "Getting started"). After copying, open the new project in Claude Code
and run `/init`.

> Database runner scripts live in [`db/scripts/`](../db/scripts/), not here — this directory is for
> repo/template-level helpers.

## Guards

Machine checks that back a prose rule (the "enforcement counterpart" principle and the shared
guard anatomy: [`.claude/rules/README.md`](../.claude/rules/README.md)). The `.mjs` guards need
only `node` on the PATH — no `package.json`, no install step.

| Guard | Run | Checks | Rule | CI |
|-------|-----|--------|------|----|
| [`check-md-links.mjs`](check-md-links.mjs) | `node scripts/check-md-links.mjs` | every relative markdown link target exists; classifies dead links (`[depth]` / `[moved]` / `[gone]` / `[absolute]`) with the fix | [`documentation.md`](../.claude/rules/documentation.md) → "Archiving pulls the links along" | lint job |
| [`check-context-budget.mjs`](check-context-budget.mjs) | `node scripts/check-context-budget.mjs` (`--top`, `--update-baseline`) | estimated tokens loaded in every session (`CLAUDE.md` + `@`-imports + rules without `paths:`) within `BUDGET_TOKENS`; `[size]` per rule file, `[frontmatter]` readable `paths:`, `[map]` rule map ↔ scoped rules | [`documentation.md`](../.claude/rules/documentation.md) → "Rule vs. record" | lint job |
| [`check-file-size.mjs`](check-file-size.mjs) | `node scripts/check-file-size.mjs` (`--top`, `--update-baseline`) | no source file above 1,000 lines; baseline files may only shrink (+2 % tolerance) — scope `SOURCE_ROOTS` set by `/init` | header of the script | lint job |
| [`check-bugs.mjs`](check-bugs.mjs) | `node scripts/check-bugs.mjs` (`--commit [<rev>]` checks a committed tree — use it after `git commit --only` when sessions run in parallel) | `docs/bugs/INDEX.md` ↔ bug files: `[table]` row format, `[dup]`, `[sort]` ID descending, `[counts]` status block recomputed from the rows, `[place]` status ↔ flat/archive quarter, `[parity]` one row per file, `[status]` file status = row | `/bug` skill | lint job |
| [`check-testcases.mjs`](check-testcases.mjs) | `node scripts/check-testcases.mjs` | manual test-case catalog: case/suite/run format, INDEX ↔ files, counts, `[manual-ac]` marker form + every marked AC of a designed/reviewed spec referenced by an Active case (UI projects; exits 0 when there is no catalog) | `docs/test-cases/README.md` → "The guard" | lint job |
| [`check-env-files.sh`](check-env-files.sh) | `bash scripts/check-env-files.sh [env]` — **on the deploy host** | every security-critical env variable is `SET` (reports `MISSING` / `EMPTY` / `PLACEHOLDER`, never values) — template, configured by `/init` | [`deploy-infra.md`](../.claude/rules/deploy-infra.md) → "Secret-sync drift" | — (host-side) |

Baselines (`*-baseline.txt`) appear here only when a project adopts a guard on an existing backlog.
