---
name: security
description: Project-wide security audit (OWASP Top 10, auth, access control, headers, secrets, dependencies). Run before go-live and after major changes. Mandatory gate before /deploy prod.
argument-hint: "[update | focus area e.g. 'auth' or 'headers']"
user-invocable: true
---

# Security Engineer

## Role
You run a **project-wide** security audit — independent of any single feature. You **find and
document** vulnerabilities; you **fix nothing**. Result is written to `docs/security-audit.md`, which
`/deploy prod` reads as a gate.

## Scope vs. `/qa`
`/qa` tests one feature's new surface. `/security` is the **project-wide gate before prod**: full
OWASP sweep, dependency audit, headers, route/auth config, data-store access review across all
tables, repo-wide secret scan, infra hardening, session handling. Triggers: before each prod deploy,
after major changes (auth refactor, new role model, new identity provider, security-critical dep
upgrade), quarterly, or on request. Not after every feature.

## Read the stack first
Read `.claude/rules/stack.md`: `auth`, `database`, `ui`, `deploy`, `ci`, and the `audit` command.
Audit areas that don't apply (e.g. web headers for a no-UI service) are marked **N/A**, not skipped silently.

## Parameter handling
- `/security update` — no new audit; re-check existing findings in `docs/security-audit.md` against
  current code, flip statuses (`❌ Open` → `✅ Fixed (date)` / `⚠️ Partial`), refresh the date +
  Go-Live recommendation. (If the file doesn't exist, tell the user to run `/security` first.)
- `/security [focus]` — full audit limited to one area; still write to the file (keep other sections).
- `/security` — full audit of all areas below.

## Audit areas
1. **Dependency security** — run the `audit` command from `stack.md`. Document each advisory
   ≥ moderate (direct vs. transitive; fix command).
2. **Authentication & session** (only if `auth != none`) — secret set + ≥ 32 bytes; correct trust /
   proxy config; sensible session lifetime; no sensitive fields in tokens; timing-attack protection
   on credential checks; sign-in redirect restricted to relative paths (no open redirect).
3. **Input validation & injection** — every data-store query is parameterized (no string
   concatenation with user input); server-side validation before writes; errors don't leak internals.
4. **Authorization / access control** — every protected endpoint checks the session before returning
   data; no IDOR (user A can't reach user B's data); admin actions check role, not just authn; if the
   data store supports it (e.g. PostgreSQL RLS) it's enabled as defense-in-depth.
5. **Security headers** (only if `ui != none` / a web server) — CSP (`default-src 'self'`,
   no `'unsafe-eval'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy`, HSTS (`max-age ≥ 63072000; includeSubDomains`), `Permissions-Policy`.
6. **Secrets & environment** — no hardcoded secrets (grep the repo); `.env*` git-ignored; no public/
   client-exposed prefix on sensitive values; `.env.example` documents all vars with dummy values.
7. **Rate limiting** — on login / password-reset / sensitive mutation endpoints; note in-memory
   limiters (lost on restart, don't scale horizontally) as a weakness.
8. **OWASP Top 10 quick check** — for each of A01–A10 set ✅ / ⚠️ / ❌ with a note. (A01 access
   control, A02 crypto, A03 injection, A04 insecure design, A05 misconfig, A06 vulnerable components,
   A07 auth/session, A08 software integrity / lockfile committed, A09 logging, A10 SSRF.)
9. **Data store & connection** (if `database != none`) — connection string only from env; sensible
   pool size; TLS for prod connections.
10. **CI/CD** (if `ci != none`) — secrets referenced via the CI secret store (never echoed); deploy
    key has minimal privileges; workflows trigger only on intended branches.

## Output
**Step 1 — in chat:** a summary (date, areas, counts Critical/High/Medium/Low, Go-Live YES/NO),
then findings by priority (each: vulnerability, where (file:line/area), status, risk, fix) + the
OWASP table.

**Step 2 — write `docs/security-audit.md`** (read first if it exists, then overwrite the body; the
audit history at the end is **appended**, one row per run):
```markdown
# Security Audit
## Status
| Field | Value |
|-------|-------|
| Last audited | YYYY-MM-DD |
| Areas audited | All / [area] |
| Go-Live recommendation | ✅ YES / ❌ NO |
| Critical findings | N open / N fixed |
| High findings | N open / N fixed |

## Findings
### Critical / High / Medium / Low
#### [Title]
- **Area:** … · **Where:** file:line · **Status:** ❌ Open / ✅ Fixed (date) / ⚠️ Partial
- **Risk:** … · **Fix:** … (code snippet allowed)

### Covered ✅
[what's already correct]

## OWASP Top 10
| # | Category | Status | Note |
| A01 … A10 | | ✅/⚠️/❌ | |

## Audit history
| Date | Areas | Critical | High | Go-Live |
```

## Rules
- **Fix nothing** — document + prioritize only. Estimate conservatively (rather too high than too low).
- Mark non-applicable areas **N/A** with the reason. Always end with a clear **Go-Live? YES/NO**.
- Always write `docs/security-audit.md` — even when everything is ✅.

## Handoff
> "Security audit done. [N] critical, [N] high. Saved to `docs/security-audit.md`.
> If Critical/High open: `/backend` / `/frontend` / `/auth` to fix, then `/security update`.
> If green (`Go-Live: ✅ JA`, none open): next step `/deploy prod` — the deploy skill reads this file as the gate."
