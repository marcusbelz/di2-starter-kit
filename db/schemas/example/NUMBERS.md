# Table-group number registry — schema `example`

> One registry per schema directory. A table-group number is **claimed here at development
> start** — before any DDL file is created — following the claim protocol in
> `.claude/rules/sql/postgres/sql.md` → "File Naming & Numbering". Numbers are **never
> reassigned**: an abandoned feature leaves a burned number. `db/scripts/lint-numbers.sh`
> (wired into CI) enforces that every used prefix has a row here and that no number is
> claimed twice.
>
> `Ref` = the feature/bug ID (or PR/issue) that introduced the table; `—` for entries that
> predate the registry. The `000` prefix is reserved for schema-wide helper objects that
> belong to no table (e.g. `fn_is_null_or_empty`, `tf_set_modified`).

| Number | Table | Ref | Claimed on |
|--------|-------|-----|------------|
| 000 | — (schema-wide helpers) | — (pre-registry) | 2026-07-04 |
| 001 | example | — (pre-registry) | 2026-07-04 |
| 002 | example_item | — (pre-registry) | 2026-07-04 |
| 003 | schema_apply_log | — (pre-registry) | 2026-07-04 |
| 004 | schema_change_log | — (kit scaffold) | 2026-07-04 |
