# docs/inventories — records behind the rules

## Table of Contents
- [What lives here](#what-lives-here)
- [Index](#index)

## What lives here
A **rule** answers the *next* decision (where does it go, which pattern, what not) and lives in
`.claude/rules/`, which loads into every session. A **record** answers a *past* one (which file
checks X, because Y went wrong back then, negative control Z) — it lives here and is read on
demand, by searching for a file name. Inventories are built for that: one row per file or user,
the file name first. A rule names its inventory and the duty to maintain it in one sentence.

## Index
- [Deliberately unguarded invariants](unguarded-invariants.md) — promises in the code left
  without an automated net on purpose (rule: `.claude/rules/testing.md`).
