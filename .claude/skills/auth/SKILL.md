---
name: auth
description: Diagnose and fix authentication problems (login fails, AccessDenied, token/session issues, user-sync bugs, role mapping, logout, silent re-login/logout). Works diagnose-first (logs before code), follows a fixed 5-step procedure and a 5-layer checklist. Only relevant for projects with auth. Fix only after user approval; bug-loop-conform.
argument-hint: "[symptom description | BUG-NNNN]"
user-invocable: true
---

# Auth Doctor

## Role
You diagnose and fix authentication/identity problems. You work **diagnose-first**: gather evidence
(logs → tokens → state) before forming a hypothesis, and fix only after the user approves. This is
the alternative to ping-ponging `/backend` and `/frontend` on an auth bug.

## Read the setup first
Read `.claude/rules/stack.md` → `auth` (e.g. `oidc-keycloak`, `oidc-other`, `custom-jwt`, `session`)
and `deploy` (is there a reverse proxy in front?). The provider determines which knobs exist, but the
**procedure and the 5 layers below are provider-agnostic** — map them onto the concrete provider.

## When to use
Login fails / AccessDenied / "unauthorized_client" / invalid credentials; user immediately logged
out again or silently re-logged-in; token/claim/role-mapping problems; user-sync drift between the
identity provider and the app's user store; logout flow broken; callback/redirect errors.

## The 5-step diagnosis procedure (in order — don't skip ahead to code)
1. **Reproduce + read the exact error.** The user-visible page/text and the URL (e.g. an
   `?error=...` query param) often name the failure class. Note it verbatim.
2. **App logs.** Read the application's auth/server logs around the failed attempt. Look for the
   provider error string, redirect mismatch, signature/issuer errors, or a downstream failure
   (a DB outage can masquerade as an auth error).
3. **Identity-provider logs / state.** Check the IdP side (provider logs / admin console) for the
   same attempt — was the request received, the client recognized, the user found, the redirect URI
   allowed?
4. **Token / claim inspection.** Decode the issued token (or session payload). Are the expected
   claims present (subject, email, roles/groups)? Does the app read the claim it expects, under the
   name the provider actually emits?
5. **App-side state.** If the app keeps a local user shadow / role table, check it matches the IdP
   (user exists, not disabled/tombstoned, role mapped). Reconcile drift.

Form a single hypothesis from the evidence, state it to the user, propose the fix, and wait for approval.

## The 5-layer checklist (where auth bugs live)
1. **Provider / realm config** — issuer URL, signing keys, token lifetimes, required scopes, default
   roles, account status (enabled / disabled / deleted).
2. **Client / app registration** — client id + secret in sync between the app config and the
   provider; **allowed redirect URIs** match the app's callback exactly (scheme/host/port/path);
   grant type + PKCE settings.
3. **App auth mapping** — secret set + long enough; trust/proxy flag set when behind a reverse proxy;
   session strategy + lifetime; the callback maps provider claims → app session correctly; sign-in /
   error pages on relative paths.
4. **Cookies / session** — cookie name/flags (`Secure`, `HttpOnly`, `SameSite`), domain/path scoping,
   clock skew, session expiry vs. token expiry mismatch (a cause of silent logouts/re-logins).
5. **Reverse proxy / network** — the proxy forwards the right host/proto headers; TLS terminates
   correctly; the callback URL the proxy presents matches the registered redirect URI.

## Common secret-sync drift (very frequent root cause)
Several auth secrets exist in two stores at once — the app's env file **and** a backend (provider
client secret, admin client secret, signing secret, a reconcile/cron token). Drift in either store →
silent auth failure. When a symptom points at "wrong credentials / unauthorized client", verify the
secret matches on **both** sides before changing code.

## Fix + close (bug-loop-conform)
- If invoked as `/auth BUG-NNNN`: read the bug file first, fix only what it describes (no scope-creep).
- If invoked on a fresh symptom and the user confirms it's a bug: file it with `/bug` (source per the
  discovery position — usually `production` or `manual`), then fix.
- Commit per `.claude/rules/general.md` bug-fix format. Don't change bug status — `/bug close` does
  that after a green `/qa` re-test.
- Handoff: "Fix for `BUG-NNNN` committed. Next: `/qa` re-tests the login flow, then `/bug close BUG-NNNN`."

## Important
- **Logs before code.** Don't theorize about the auth config before reading the actual error + logs.
- A generic config/login error is often a **downstream** failure (DB down, migration missing) — rule
  that out early (step 2) before touching auth settings.
- Fix only after the user approves the hypothesis.
