# General Project Rules

## New Project Detection (MANDATORY)
Before starting ANY work, check if the project has been initialized:
1. Read `.claude/rules/stack.md` - if it still contains `{{PLACEHOLDER}}` values, the tech stack is NOT defined yet.
2. Read `docs/PRD.md` - if it still contains placeholder text like "_Describe what you are building_", the project is NOT initialized.
3. Read `features/INDEX.md` - if the features table is empty **or contains only the shipped
   `feat-000X` sample rows** (marked *(sample)*), no real features have been defined.

**If the project is not initialized (stack.md still has placeholders):**
- Do NOT write any code, create components, or pick a tech stack on your own.
- Tell the user: "This project is a fresh starter-kit clone and hasn't been set up yet. Run `/init` and I'll ask for the product idea and the tech-stack framework conditions, then tailor the toolkit to your project."
- If the user already described their idea in the current message, run `/init` automatically with their description.

**If `/init` has run (stack defined) but the user requests a feature not yet in `INDEX.md`:**
- Guide them to run `/requirements` first to create the feature spec before any implementation.

## Feature Tracking
- All features are tracked in `features/INDEX.md` - read it before starting any work.
- Feature specs live in `features/<prefix>-XXXX-feature-name.md`.
- The feature-ID prefix is defined in `CLAUDE.md` / `.claude/rules/stack.md` (`feature_id_prefix`, default `feat`). Feature IDs are sequential — check `INDEX.md` for the next available number.
- One feature per spec file (Single Responsibility). Never combine multiple independent functionalities in one spec.

## Git Conventions
- Feature commit format: `type(<prefix>-XXXX): description`
- Bug-fix commit format: first line `fix(<prefix>-XXXX): BUG-NNNN; description`, from line 2 the solution writeup from the bug report (root cause, changed files, solution steps, why it works). If no feature applies: `fix(NA): BUG-NNNN; description`.
- Types (features): feat, fix, refactor, test, docs, deploy, chore.
- Check existing features before creating new ones, and existing modules/APIs before building (use the project's actual source layout — see `.claude/rules/stack.md`).

## Bug-Tracking — No Reopens (MANDATORY)
Closed bugs (`Fixed` or `Won't Fix`) are immutable. If a follow-up problem appears after close — a regression, an incomplete fix, a refinement — always file a **new** `BUG-NNNN` that references the predecessor in its body (`**Predecessor:** BUG-XXXX (Status: Fixed on YYYY-MM-DD) — regression / refinement of that earlier fix.`).

**Why:** the bug-history table in `docs/bugs/INDEX.md` is one row per bug (opened / closed). Reopens would make that ambiguous and weaken the audit trail. The filesystem layout (`docs/bugs/<open>` vs `docs/bugs/archive/<quarter>/<closed>`) enforces the split on disk — an archived bug file never moves back to the flat directory. Full procedure in the `/bug` skill.

## Human-in-the-Loop
- Always ask for user approval before finalizing deliverables.
- Present options as clear choices rather than open-ended questions.
- Never proceed to the next workflow phase without user confirmation.

## Status Updates (MANDATORY — Write-Then-Verify)
After completing work on any feature, you MUST update tracking files. Exact sequence:
1. **Read** the feature spec (`features/<prefix>-XXXX-*.md`) and `features/INDEX.md` BEFORE editing.
2. **Write** your changes using the Edit tool — do NOT just describe them.
3. **Re-read** the file AFTER editing to verify the changes are present.
4. **If changes are missing**, repeat step 2 — never claim updates were made without verifying.

**In the feature spec:** Status field (Planned → In Progress → In Review → Deployed), implementation notes, deviations from the original spec, bug fixes / design changes discovered during implementation.

**In `features/INDEX.md`:** the status column must match the feature-spec header. Valid statuses: Planned, In Progress, In Review, Deployed.

**NEVER:** say "I've updated the spec" without calling the Edit tool; summarize changes in chat as a substitute for writing them; skip updates because "it's obvious" or "minor".

## File Handling
- ALWAYS read a file before modifying it — never assume contents from memory.
- After context compaction, re-read files before continuing work.
- When unsure about current project state, read `features/INDEX.md` first.
- Run `git diff` to verify what has already been changed in this session.
- Never guess at import paths, module names, or routes — verify by reading.

## Handoffs Between Skills (explicit next command — MANDATORY)
- After completing a skill, ALWAYS show the next possible command — **explicitly, as the final
  element of the answer**, never buried mid-text. Format: one short "Next step" line plus the
  command in its own fenced code block so it can be copied as-is:

  ```
  Next step: design the technical approach.

      /architecture feat-0001
  ```

- The command comes from the feature spec's **Skill Commands** section (see the `/requirements`
  template) — keep that section in sync: when a skill completes, remove its line there so the next
  open command is always on top.
- If several next steps are possible (e.g. bug found → bug-loop vs. continue), show each candidate
  command in the block, one per line, with a one-line label.
- Handoffs are always user-initiated, never automatic — showing the command is not running it.

## Proactive Hints on Updates & Config Changes
When build output, dependency-install output, dependency checks, Dockerfile reviews, or manifest changes surface something notable (a new major version, a deprecation warning, a config recommendation):
- Call it out explicitly — don't silently pass over it — even if it isn't directly related to the current task.
- Format: a short line at the end of the answer, e.g. "By the way: the package manager flags a new major version of X, in case you want to pick it up later — otherwise just ignore it."

**Why:** the user doesn't want to miss important updates. Cross-cutting maintenance otherwise runs via `/check-updates`, but spontaneous hints in build output shouldn't get lost.
