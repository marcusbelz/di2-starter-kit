# Tooltip Pattern

> Pruned at `/init` time if the project has no UI. Keep tooltip styling centralized so the whole app
> stays consistent — this is the seed of a growing UI style guide.

## Centralize the styling and the delay
Define tooltip look + hover delay **once** in the shared tooltip component (e.g. a wrapper over the
component library's tooltip primitive) and reuse it everywhere. Don't set per-caller font sizes,
paddings, or ad-hoc delays — a style change should be a single-file edit that propagates to every
tooltip.

- **Delay:** export one constant (e.g. `TOOLTIP_DELAY_MS = 500`) and pass it to every provider. A
  delay that's too short makes tooltips flash on mouse pass-through; ~500ms gives "dwell = show".
- **Style:** one set of tokens (brand surface, readable contrast, small radius, compact padding,
  sensible `max-width` with wrapping) lives in the component — callers don't override font size.

## Two variants
- **Standard tooltip** — short single/multi-line hints. Long text wraps automatically (centralized
  `max-width` + normal whitespace). Callers pass only the content.
- **Row/structured tooltip** — a header + label/value rows for structured data (e.g. column info,
  record details). One component, 2-column body; don't hand-roll `<div>` stacks per caller.

## Don'ts
- ❌ Per-caller font-size / padding / delay overrides — those belong in the central component.
- ❌ Native `title=""` attributes on elements that already have a real tooltip (double tooltip).
- ❌ Inline structured layout inside a plain tooltip — use the structured variant.
- ❌ A new color scheme per tooltip — one brand palette, centralized.

When a use case the central component doesn't cover appears (pinned/interactive tooltips, charts),
add the variant to the component and document it here first — then use it.
