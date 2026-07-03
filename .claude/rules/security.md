# Security Rules (always-on)

> Baseline security discipline that applies to every change, independent of the project-wide
> `/security` audit. Stack specifics come from `.claude/rules/stack.md`.

## Secrets management
- **Never commit secrets.** All secrets come from env / a secret store; `.env*` files are git-ignored.
- `.env.example` documents every variable with dummy values.
- No secret in client-exposed/public-prefixed variables.
- Auth/signing secrets are ≥ 32 random bytes.

## Input validation & injection
- Validate all external input server-side before use; define max lengths.
- **Parameterized queries only** — never concatenate user input into a query/command.
- Escape/encode output where it's rendered or interpolated (prevent XSS / injection).

## Authentication & authorization
- Every protected endpoint checks the session/identity before returning or mutating data.
- Authorization checks role/ownership, not just authentication (no IDOR).
- Sign-in/redirect targets restricted to relative paths (no open redirect).
- Sessions expire; sensitive fields are not stored in tokens.

## Transport & headers (web UIs)
- HTTPS enforced. For a web UI, set CSP (`default-src 'self'`, no `'unsafe-eval'`),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS,
  `Permissions-Policy`.

## Dependencies & CI
- Keep the lockfile/manifest committed. Run the stack's audit command (`/check-updates`, `/security`).
- In CI, reference secrets via the secret store (never echo them); deploy keys have minimal privilege;
  workflows trigger only on intended branches.

## Logging
- Log auth failures; never log passwords, tokens, or secrets.

> The deep, project-wide sweep (OWASP Top 10, RLS review across all tables, header audit, dependency
> CVEs, infra hardening) is the `/security` skill's job and gates `/deploy prod`. This rule is the
> day-to-day floor that `/review` checks on every diff.
