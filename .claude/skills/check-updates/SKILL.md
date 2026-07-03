---
name: check-updates
description: Cross-cutting maintenance check (NOT a numbered workflow step). Checks updates for dev dependencies (package manager, container base images, CI actions) and, if the project runs on a server, the host components. Writes findings to docs/update-check.md. Modifies nothing.
argument-hint: "[dev | host | all | apply]"
user-invocable: true
---

# Maintenance / Update Check

## Role
You run a periodic, **read-only** maintenance scan. You **report** available updates — you do **not**
install or change anything. Findings go to `docs/update-check.md` with an append-only "applied"
history (`/check-updates apply`).

## Read the stack first
Read `.claude/rules/stack.md`: `package_manager`, `runtime`, `deploy`, `ci`, and the `audit` command.
Everything below adapts to those — there is no hard-coded toolchain.

## Argument handling
- `dev` (default) — project-side only.
- `host` — server-side only (only meaningful if `deploy` targets a server you control).
- `all` — both.
- `apply` — record which previously-reported updates were applied (history append; still changes nothing itself).

## Dev-side checks (from project files, never from memory)
Determine current vs. latest for:
1. **Dependencies** — via the project's package manager (e.g. `npm outdated` / `pip list --outdated`
   / `uv pip list --outdated` / `go list -m -u all`). Note major-version bumps separately.
2. **Security advisories** — the `audit` command from `stack.md` (e.g. `npm audit` / `pip-audit`).
3. **Runtime / base images** — the `FROM` lines in `Dockerfile` / compose files (if containerized),
   and the runtime version pinned in the manifest.
4. **CI action / image versions** — if `ci != none`, the pinned action/image versions in the CI
   workflow files.

Record each as: component · current · latest · type (patch/minor/major) · note.

## Host-side checks (only if `deploy` targets a server; strictly read-only)
A read-only checklist the user runs on the host (OS packages, container engine, reverse proxy, TLS
cert expiry, running container images/tags). The exact commands and host access live in
`.claude/rules/deploy-infra.md` — reference them; never invent host facts. Output is pasted back into
this session and summarized into the report. **No `upgrade`, no `pull`, no `renew`, no restart.**

## Output — `docs/update-check.md`
Write/overwrite the current snapshot, and keep an append-only history of applied updates:

```markdown
# Update Check

## Latest scan: YYYY-MM-DD  (scope: dev | host | all)

### Dev-side
| Component | Current | Latest | Type | Note |
|-----------|---------|--------|------|------|

### Host-side (if applicable)
| Component | Current | Latest | Note |
|-----------|---------|--------|------|

### Recommended actions (prioritized)
1. [security-relevant first] ...

## Applied history (append-only)
| Date | Component | From → To | By |
|------|-----------|-----------|----|
```

## Rules
- **Modify nothing** — no installs, no upgrades, no restarts. Report + recommend only.
- Read current versions from **project files / live host output**, never from `CLAUDE.md` prose.
- Flag major-version bumps and security advisories explicitly (they're the reason to run this).
- Per `.claude/rules/general.md`, surface notable findings proactively even outside a full run.

## Handoff
> "Update check done (scope: <scope>). Findings in `docs/update-check.md`. Security-relevant items
> first. After you apply any, run `/check-updates apply` to record it. Before a prod release, pair
> this with `/security`."
