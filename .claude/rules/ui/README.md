# UI rules (flavor-specific)

> UI conventions are split **per UI stack ("flavor")** — the same pattern as the SQL rules under
> [`../sql/`](../sql/): one implemented reference flavor, other stacks get sibling directories,
> `/init` keeps exactly one. Every rule file inside auto-loads each session.
> Pruned entirely at `/init` time when `ui == none`. How the auto-loading works and why pruning
> matters: [KB-007](../../../docs/kb/kb-007-how-rules-and-skills-are-loaded.md).

## Contents of this directory

| Entry | What it is |
|-------|-----------|
| [`react-tailwind-shadcn/`](react-tailwind-shadcn/) | The implemented flavor: React + Tailwind + shadcn/ui-style component library (proven in the source project). See its own README for the files. |

## Active flavor

| Flavor | Directory | Status |
|--------|-----------|--------|
| React + Tailwind + shadcn/ui | [`react-tailwind-shadcn/`](react-tailwind-shadcn/) | Implemented |
| Vue / Svelte / TUI / … | — | Not yet written (sibling directory, see below) |

The project's actual UI stack is set by `/init` in `.claude/rules/stack.md` (`ui`); skills read
that value, never assume a flavor.

## Adding another flavor

For a different UI stack, create a sibling directory (`vue-nuxt/`, `svelte/`, `tui/`, …) with the
same file breakdown as the implemented flavor. The **principles** carry over 1:1 (component
library first, the four states, semantic brand tokens, centralized confirm/tooltip components,
accessibility); only the syntax and component names change. Then remove the flavor(s) the project
does not use — `/init` does this based on the `ui` answer.
