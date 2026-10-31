# docs/bugs — bug tracking

One markdown file per bug, tracked in [`INDEX.md`](INDEX.md) (the single source of truth for open /
closed counts). Managed by the `/bug` skill — use it to file, update, and close bugs.

## Layout
- **Open bugs** live flat in this directory: `bug-NNNN-<slug>.md`.
- **Closed bugs** (`Fixed` / `Won't Fix`) are `git mv`'d into the quarterly archive:
  `archive/<YYYY-Qn>/bug-NNNN-<slug>.md`.

## Rules (short form)
- Status: `Open` / `Fixed` / `Won't Fix` · Severity: `Critical` / `High` / `Medium` / `Low`.
- **No reopens:** closed bugs are immutable — a regression gets a **new** `BUG-NNNN` that references
  its predecessor (see `.claude/rules/general.md` → "Bug-Tracking — No Reopens").
- Bug numbers are sequential and never reassigned.
- A feature moves on to `/review` → `/deploy` only with no open Critical/High bugs.
- **Threshold and reach** (`.claude/rules/general.md` → "Bug Loop"): only Critical/High are fixed
  right away; pre-existing findings are their own bug; chain depth at most two generations.
- A bug-fix re-test (`/qa BUG-NNNN`) checks only the repro + regressions in the diff; what it
  notices on the way goes into the bug file's `**Follow-up findings:**` block, which `/bug close`
  resolves with the user.
- The status counters in `INDEX.md` are **recounted** from the table on every write;
  `node scripts/check-bugs.mjs` checks counts, order, file ↔ row parity and status ↔ location.

## Worked examples (delete when starting your project)
The template ships **two illustrative bugs** so the format is visible end-to-end, both grounded in
the kit's own example schema:
- [BUG-0002](bug-0002-seed-overwrites-is-active-on-deploy.md) — **Open**: shows the initial file
  (description, root cause, repro, fix proposal, fix commands).
- [BUG-0001](archive/2026-Q2/bug-0001-audit-modified-by-connection-role.md) — **Fixed + archived**:
  additionally shows the closing `**Solution:**` block and the quarterly-archive location.

They are examples, not real backlog — delete both (and reset [`INDEX.md`](INDEX.md) to zero) when
you start a real project; your first `/bug` run then files `BUG-0001`.
