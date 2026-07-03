# KB-009: Create a new project from the starter-kit template

> How to turn the DI² Starter Kit into a fresh project repository — either via GitHub's
> *template repository* feature or via the local copy scripts — and what to do immediately
> afterwards. This is the one-time "day zero" procedure; everything after it is driven by `/init`.

## Table of Contents
- [Purpose / when to use](#purpose--when-to-use)
- [Option A — GitHub "Use this template" (recommended)](#option-a--github-use-this-template-recommended)
- [Option B — local copy script (no GitHub needed)](#option-b--local-copy-script-no-github-needed)
- [After cloning: run `/init`](#after-cloning-run-init)
- [Verification](#verification)
- [Symptom → Cause → Fix](#symptom--cause--fix)

## Purpose / when to use

Use this procedure every time you start a **new project** from the starter kit. Both options
produce the same result: a fresh repository containing the full (maximal) template with **no
connection to the template's git history** — the new project starts with its own initial commit.
The template itself stays untouched and maximal; the tailoring (pruning skills/rules the project
does not need) happens later, inside the new repo, via `/init`
(see [TEMPLATE.md](../../TEMPLATE.md) for the pruning matrix).

Do **not** `git clone` the template directly and keep working in that clone — you would drag the
template's history and remote into your project. Use one of the two options below.

## Option A — GitHub "Use this template" (recommended)

**One-time prerequisite (template maintainer):** the template repo must be marked as a *template
repository* on GitHub — Settings → General → check **"Template repository"**.

Then, per new project, either use the CLI:

```bash
gh repo create my-new-project --template <owner>/di2-starter-kit --private --clone
cd my-new-project
# then, in Claude Code:  /init
```

or the GitHub UI: open the template repo → **"Use this template"** → **"Create a new repository"**
→ clone the new repo.

GitHub copies the template's files into a brand-new repository with a single initial commit — no
template history, no fork relationship.

## Option B — local copy script (no GitHub needed)

The template ships two equivalent helper scripts under [`scripts/`](../../scripts/README.md) that
copy the working tree into a fresh local repo:

```powershell
# Windows / PowerShell
.\scripts\new-project.ps1 -Target c:\sandbox\github\my-new-project
```

```bash
# macOS / Linux / Git Bash
./scripts/new-project.sh ~/code/my-new-project
```

Both scripts do the same four things:

1. **Guard the target:** the target directory must not exist yet or must be empty — the script
   aborts rather than overwrite anything.
2. **Copy the template** excluding `.git` and dependency/build directories (`node_modules`,
   `.venv`, `dist`, `build`, `.next`).
3. **Initialize a fresh repo:** `git init` + `git add -A` + initial commit
   `chore: initialize from di2-starter-kit`.
4. **Remind you** to open the new project in Claude Code and run `/init`.

The new repo has no remote. If the project should live on GitHub, create the remote afterwards
(e.g. `gh repo create my-new-project --private --source . --push`).

## After cloning: run `/init`

Open the new project in Claude Code and run:

```
/init
```

`/init` interviews you for the product vision and the framework conditions (runtime, UI yes/no,
backend yes/no, database, migrations, auth, deploy target, CI, env stages, feature-ID prefix),
writes them to `.claude/rules/stack.md` + `CLAUDE.md`, prunes the skills/rules/workflows the
project does not need, and hands off to `/requirements`. Until `/init` has run, the repo is in the
detectable "uninitialized" state (`{{PLACEHOLDER}}` values in `stack.md`, placeholder text in
`docs/PRD.md`) and the rules refuse feature work.

If the project keeps a database and CI, the GitHub Actions side needs its own one-time
provisioning — see [KB-005](kb-005-github-actions-db-deployment-setup.md).

## Verification

In the new project directory:

```bash
git log --oneline          # exactly one commit (Option B) / the template file drop (Option A)
git remote -v              # Option A: your new repo; Option B: empty until you add one
ls .claude/skills          # the full skill set (still maximal — /init prunes later)
```

- The commit history must **not** contain the template's commits.
- `.claude/rules/stack.md` still shows `{{PLACEHOLDER}}` values — that is correct before `/init`.

## Symptom → Cause → Fix

| Symptom | Cause | Fix |
|---|---|---|
| `gh repo create --template` fails with "not a template repository" | The template repo is not marked as a template on GitHub | Settings → General → enable **"Template repository"**, then retry |
| Copy script aborts with "Target … already exists and is not empty" | Deliberate guard against overwriting | Pick a new/empty target directory (a lone `.git/` in the target is tolerated) |
| New project contains the template's full git history | The template was `git clone`d instead of using Option A/B | Start over with Option A or B; do not build on a direct clone |
| `robocopy failed (exit ≥ 8)` (Windows) | Real copy error (locked files, permissions) | Close programs locking files (IDE/AV), check target permissions, retry |
| `/init` not offered / skills missing in the new project | Copy was made from an already-initialized (pruned) project, not from the template | Re-create from the actual template — pruned skills only exist there |
