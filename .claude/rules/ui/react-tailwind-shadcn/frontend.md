# Frontend Rules (UI)

> Conventions for UI work in the **react-tailwind-shadcn flavor** (the `ui` value in
> `.claude/rules/stack.md` is authoritative). Pruned at `/init` time if the project has no UI;
> a different UI stack gets its own sibling flavor directory — see [../README.md](../README.md).

## Component library first (MANDATORY)
Before creating ANY UI component, check whether the installed component library already has it
(button, input, dialog, table, dropdown, …). Use it. Install missing primitives via the library's
CLI. Build custom components **only as compositions of primitives** — never re-implement a primitive
the library already provides.

## Styling
- **Utility classes only** (Tailwind) — no inline styles, no CSS modules.
- **Use brand tokens, never hardcoded colors** — see [brand.md](brand.md). No `bg-zinc-*` / raw hex for
  semantic roles; use `bg-primary`, `text-foreground`, `border-border`, etc.
- Icons from one icon library (per the stack); don't mix icon sets.

## The four states (MANDATORY for every data-driven view)
- **Loading** — skeletons / contextual spinners; disabled actions. Never a blank page.
- **Empty** — explain *why* it's empty and *what to do about it*, with an action.
- **Error** — human language, the real problem, a next step.
- **Populated** — the happy path.

## Forms
- Inline validation under each field (not a top summary, unless a server error).
- Specific error messages, not generic ones.
- Submit disabled + spinner while submitting; don't clear the form on server error.
- `aria-invalid` + `aria-describedby` wired to the error; group long forms with section headers.

## Quality
- **Responsive:** mobile / tablet / desktop.
- **Accessibility:** semantic HTML, ARIA labels on icon-only buttons, keyboard nav (Tab order, Enter
  to submit, Esc to close, focus management around dialogs). Target WCAG 2.1 AA.
- **TypeScript:** typed props; no build/lint errors (commands from `stack.md`).
- Surface loading + error states for every API call (skeletons, toasts, inline errors). No leftover
  mock data or "TODO: connect API" where a real endpoint belongs.

## Note on detailed layout conventions
This kit intentionally does **not** ship a product's detailed page-layout vocabulary (exact list-page
grids, table densities, register patterns, pixel scales). Those are product-specific and grow with
the app. As your UI matures, add project-specific layout rules here in this flavor directory (one
file per concern, e.g. `list-page-layout.md`, `dialog.md`) so they auto-load and stay consistent.
