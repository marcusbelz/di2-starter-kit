# predeploy/ — run-once transition scripts (before the object sections)

## Table of Contents
- [Purpose](#purpose)
- [Naming](#naming)
- [Run-once semantics & immutability](#run-once-semantics--immutability)
- [Lifecycle](#lifecycle)

## Purpose
**Data-dependent transition scripts, not desired-state object DDL.** `predeploy` files run
**before** the object sections (`tables → … → data`) — for work that must happen ahead of the
object DDL, e.g. saving data aside before a destructive change, or dropping something the new
DDL would conflict with. Work that needs the **new** objects (backfills, moving saved data back)
belongs in [`../postdeploy/`](../postdeploy/) instead.

The full model (convergent object files + pre/postdeploy change sets) is documented in
`.claude/rules/db-migrations.md`.

## Naming
Timestamp prefix, chronological glob order:

    YYYYMMDDHHMM.<kebab-name>.sql        e.g. 202607050900.save-aside-legacy-rows.sql

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
