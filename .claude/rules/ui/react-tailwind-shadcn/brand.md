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
  especially for data-dense internal tools where density is a design criterion.

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
