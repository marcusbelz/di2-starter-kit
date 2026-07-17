# Brand Guide (token skeleton)

> Fill this in for your project's visual identity. Pruned at `/init` time if the project has no UI.
> The discipline (semantic tokens, no hardcoded colors) matters more than the specific values.

## Principle: semantic tokens, never hardcoded colors
Wire your palette into CSS variables + the Tailwind config once, then reference **semantic roles**
everywhere — not raw color classes:
- CTAs / primary actions: `bg-primary text-primary-foreground hover:bg-primary-hover`
- Accents / highlights: `bg-accent text-accent-foreground`
- States: `…-danger`, `…-success`, `…-warning`, `…-info` (background / border / text triplets)
- Text: `text-foreground` (body), `text-muted-foreground` (secondary)
- Surfaces / lines: `bg-surface`, `bg-surface-muted`, `border-border` / `border-line`

A component library's default neutral grays are a starting point — override them with your tokens so
`bg-primary` is *your* brand color, not the library default.

## Palette (fill in)
| Role | Hex | Token |
|------|-----|-------|
| Primary | `{{PRIMARY}}` | `primary` |
| Primary hover | `{{PRIMARY_HOVER}}` | `primary-hover` |
| Accent | `{{ACCENT}}` | `accent` |
| Foreground / ink | `{{FOREGROUND}}` | `foreground` |
| Muted text | `{{MUTED}}` | `muted-foreground` |
| Line / border | `{{LINE}}` | `border` / `line` |
| Success / Warning / Error | `{{SUCCESS}}` / `{{WARNING}}` / `{{ERROR}}` | `success` / `warning` / `danger` |

## Typography (fill in)
- Headlines & body: `{{SANS_FONT}}`
- Code / mono: `{{MONO_FONT}}`
- Consider a small fixed type scale (a handful of named sizes) rather than ad-hoc pixel values,
  especially for data-dense internal tools where density is a design criterion. The scale is
  machine-enforced — see [Enforcement](#enforcement-of-the-type-scale) below.

## Enforcement of the type scale

The type scale is exactly the kind of rule that drifts under AI-assisted development: prose raises
the hit rate, but at generation volume it cannot reach 100 % — raw `text-[Xpx]` values and Tailwind
defaults creep back in. This guard comes from a measured case study (the project the kit was
extracted from: 799 raw pixel font sizes across 74 files versus 263 token uses, despite the rule
file being loaded on every frontend task):
[AI code drift — 799 font sizes](https://sql.marcus-belz.de/en/ai-code-drift-799-font-sizes/).
The scale therefore ships with an **enforcement counterpart** (the principle:
`.claude/rules/README.md` → "Rules with a machine-checkable core"):

- **[`eslint-rules/no-raw-font-size.mjs`](eslint-rules/no-raw-font-size.mjs)** — ESLint custom
  rule (flat config). Flags `text-[Xpx]` (any px value) and `text-xs|sm|base` in **all** string
  literals and template quasis (not just JSX attributes — also `cn()` args, `.join(" ")` helpers,
  exported class constants). The error message names the canonical snap target, so the fix is
  unambiguous for humans and agents. `text-lg`+ is deliberately not flagged (design-review case,
  not a mechanical snap). The `text-scale-*` snap table in the rule holds **example values** —
  replace them with your project's tokens when you fill in this file.
- **[`eslint.config.snippet.mjs`](eslint.config.snippet.mjs)** — wiring example: rule at `error`
  (only a broken build is enforcement) for the app scope, plus a `FONT_SIZE_CARVE_OUT` path list
  (marketing/legal/public-auth pages, test files) where the rule is `off`. The carve-out list is
  the **machine-readable scope of the convention**; the app scope is its complement, so a
  forgotten new public page fails loudly instead of drifting silently (fail-closed).

**Activation order (when adopting the stack or introducing the scale later):** define the tokens →
migrate the app scope → enable the guard **last**, when the app scope is clean. Enabling it earlier
forces temporary per-file disables, and temporary exceptions like to become permanent.

The kit's own CI cannot run this guard (no Node stack at the template root) — it is template
content, activated with your project's lint setup (`.github/workflows/ci.yml` placeholder points
here).

## Logos & icons
- Logo assets live under `design/` (or `public/`). Pick the variant by background, not by taste.
- Icons from a single library (per `stack.md`); don't mix sets.

## Punctuation in user-visible strings
Use the plain ASCII hyphen `-` in UI labels/tooltips/toasts/errors. Em/en dashes (`—` / `–`) are
reserved for markdown docs, not UI strings (they render inconsistently across fonts/renderers).

## Don'ts
- ❌ Hardcoded color classes (`bg-zinc-900`) or raw hex for semantic roles — use tokens.
- ❌ A component library's unmodified default theme as if it were the brand.
- ❌ Ad-hoc pixel font sizes scattered across components — use the type scale.
