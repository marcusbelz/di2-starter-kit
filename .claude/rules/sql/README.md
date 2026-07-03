# SQL rules (vendor-specific)

> SQL conventions are split **per database vendor**. Each vendor has its own subdirectory here;
> every rule file inside it auto-loads each session (like every `*.md` under `.claude/rules/`).
> `/init` keeps only the subdirectory for the project's chosen `database` (see
> `.claude/rules/stack.md`) and prunes the rest. Same pattern as the UI rules under
> [`../ui/`](../ui/). How the auto-loading works and why pruning matters:
> [KB-007](../../../docs/kb/kb-007-how-rules-and-skills-are-loaded.md).

## Contents of this directory

| Entry | What it is |
|-------|-----------|
| [`postgres/`](postgres/) | PostgreSQL 17 ruleset — the implemented reference vendor, ported from a framework proven in a real-world project. Files: see its own [README](postgres/README.md). |
| [`mssql/`](mssql/) | SQL Server 2022 ruleset — the T-SQL sibling of `postgres/`, same file breakdown. Files: see its own [README](mssql/README.md). |

## Vendor status

| Vendor | Directory | Status |
|--------|-----------|--------|
| PostgreSQL | [`postgres/`](postgres/) | Implemented (full ruleset) |
| SQL Server | [`mssql/`](mssql/) | Implemented (full ruleset, translated from `postgres/`) |
| MySQL / SQLite / … | — | Not yet written (sibling directory, see below) |

## Adding another vendor

Create a sibling directory (`mysql/`, `sqlite/`, …) with the same file breakdown as `postgres/`,
each file starting with the same vendor banner as the `postgres/*.md` headers. Do **not** assume
the PostgreSQL specifics carry over — quoting, dialect, and identity semantics differ
(`GENERATED ALWAYS AS IDENTITY`, `$…$` dollar-quoting, `:schema_*` psql variables, `format()` are
all PostgreSQL-flavored). `/init` selects exactly one vendor directory per project.
