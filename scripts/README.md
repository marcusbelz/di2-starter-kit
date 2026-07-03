# scripts/ — template helper scripts

Helpers for working with the starter kit itself (project-level helpers created later by the
workflow also land here).

| Script | Platform | Purpose |
|--------|----------|---------|
| [`new-project.ps1`](new-project.ps1) | Windows / PowerShell | Copy the template into a fresh local repo (`git init` + initial commit), excluding this repo's `.git` |
| [`new-project.sh`](new-project.sh) | macOS / Linux / Git Bash | Same, for POSIX shells |

Usage — full walkthrough incl. verification and troubleshooting:
[KB-009](../docs/kb/kb-009-create-new-project-from-template.md) (short form: root
[README](../README.md) → "Getting started"). After copying, open the new project in Claude Code
and run `/init`.

> Database runner scripts live in [`db/scripts/`](../db/scripts/), not here — this directory is for
> repo/template-level helpers.
