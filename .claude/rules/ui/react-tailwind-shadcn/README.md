# UI flavor: React + Tailwind + shadcn/ui

> The implemented UI flavor (proven in the source project). Directory overview:
> [../README.md](../README.md). Pruned at `/init` time when `ui == none` or when the project
> uses a different UI stack. How the auto-loading works and why pruning matters:
> [KB-010](../../../../docs/kb/kb-010-how-rules-and-skills-are-loaded.md).

## Contents of this directory

| File | Scope |
|------|-------|
| [`frontend.md`](frontend.md) | Core frontend discipline: component library first, styling (utility classes + tokens), the four states (loading/empty/error/populated), forms, responsiveness, accessibility |
| [`brand.md`](brand.md) | Brand token skeleton: semantic color tokens instead of hardcoded colors, typography, logo/icon rules, UI punctuation |
| [`confirm-dialog.md`](confirm-dialog.md) | The shared `ConfirmDialog` pattern — no native `window.confirm`/`alert`/`prompt`; state pair, busy handling, destructive tone rules |
| [`tooltip.md`](tooltip.md) | Centralized tooltip component: one delay constant, one style, standard + structured variant |
| [`eslint-rules/no-raw-font-size.mjs`](eslint-rules/no-raw-font-size.mjs) | Enforcement counterpart to the `brand.md` type scale: ESLint custom rule flagging raw `text-[Xpx]` + `text-xs\|sm\|base` (inert template content — not a rule that auto-loads; activated with the project's lint setup) |
| [`eslint.config.snippet.mjs`](eslint.config.snippet.mjs) | Flat-config wiring example for the guard: `error` in the app scope, carve-out path list as the machine-readable scope |

The principles in these files are stack-transferable; the class names, component names, and code
snippets are React/Tailwind/shadcn-specific.
