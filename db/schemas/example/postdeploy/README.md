# postdeploy/ — run-once transition scripts (after the object sections)

## Table of Contents
- [Purpose](#purpose)
- [Naming](#naming)
- [Run-once semantics & immutability](#run-once-semantics--immutability)
- [Lifecycle](#lifecycle)
- [Shipped worked example](#shipped-worked-example)

## Purpose
**Data-dependent transition scripts, not desired-state object DDL.** `postdeploy` files run
**after** the object sections (`tables → … → data`) — for work that needs the new objects, e.g.
backfilling a freshly added column, moving saved-aside data back, or a `SET NOT NULL` that must
follow its backfill (expand/contract). Work that must happen **before** the object DDL belongs in
[`../predeploy/`](../predeploy/) instead.

The full model (convergent object files + pre/postdeploy change sets) is documented in
`.claude/rules/db-migrations.md` — including the sequencing rule for the NOT NULL / backfill case.

## Naming
Timestamp prefix, chronological glob order:

    YYYYMMDDHHMM.<kebab-name>.sql        e.g. 202607050900.backfill-example-notes.sql

Table-group numbers do **not** apply here (transition scripts are chronological change entries,
not per-table state) — no `NUMBERS.md` entry.

## Run-once semantics & immutability
Each file executes **exactly once per database**: `db/scripts/deploy.sh` runs these files
individually, records filename + sha256 checksum in `schema_change_log` (via
`sp_ins_schema_change`), and skips already-applied files on every later deploy. **Once applied
anywhere, a file is never edited** — the runner compares checksums and **aborts** on a mismatch.
A correction is a new file.

## Lifecycle
Applied files stay in the tree; tracking makes them inert. No archive step. A greenfield deploy
runs them all once in chronological order — write every script so it also **succeeds on an
empty-but-current schema** (guard with `WHERE` conditions / `IF EXISTS` checks where the
transition targets pre-existing data).

## Shipped worked example
[`202607050900.backfill-example-notes.sql`](202607050900.backfill-example-notes.sql) backfills the
`notes` column that `tables/001.example.sql` adds via convergent `ADD COLUMN IF NOT EXISTS`. CI
exercises the run-once path for real: the first `deploy.sh all local` applies it and writes a
`schema_change_log` row; the idempotency re-deploy proves the skip path.
