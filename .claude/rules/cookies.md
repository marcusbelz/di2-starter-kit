# Cookie Consent (GDPR/ePrivacy)

> When a public web UI needs a cookie banner — and when it doesn't. Pruned at `/init` time for
> projects without a public web UI.

## Baseline: no banner if only strictly-necessary cookies
A site that uses **only strictly-necessary cookies** (e.g. an auth session token / CSRF token,
HttpOnly) does **not** need a consent banner — strictly-necessary cookies are exempt from the
ePrivacy/GDPR consent requirement. Document this in the privacy policy.

## Trigger list — when a banner becomes mandatory
As soon as **any** of these is added, you MUST add an opt-in cookie banner **and** update the privacy
policy accordingly:
- **Analytics with cookies** (Google Analytics, Matomo/Plausible *with* cookies)
- **Marketing / retargeting pixels** (Meta Pixel, LinkedIn Insight Tag, Ads conversion tracking)
- **Embedded third-party content with its own cookies** (YouTube without the no-cookie domain, Vimeo,
  social embeds / like buttons)
- **A/B testing tools**
- **Live-chat widgets** (Intercom, Crisp, Zendesk Chat, …)
- **Affiliate tracking**
- **Session-recording tools** (Hotjar, Clarity, FullStory)

## Not banner-required
- Pure session/auth cookies (the baseline above) — strictly necessary.
- Cookieless analytics (e.g. Plausible cookieless mode), server logs without a tracking cookie.
- CSRF-token cookies (strictly necessary, no tracking).

## What to do when a trigger is added
1. Pause and confirm with the user; pick a consent approach.
2. Build a non-blocking sticky banner ("Accept" / "Reject" + link to the privacy policy).
3. **Lazy-load tracking code only after explicit opt-in** — no pre-load.
4. Update the privacy policy (per third party: purpose, data categories, retention, recipients,
   legal basis) and the "last updated" date.

## Sources
- ePrivacy Directive 2002/58/EC, Art. 5(3); GDPR Art. 6(1)(a) (consent).
- National implementations (e.g. Germany's TTDSG §25).
