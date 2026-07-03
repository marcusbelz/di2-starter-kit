# Language (always-on)

> The repo is **English-only**. This kit targets a worldwide audience, so every artifact in the
> repository is written in **US English** — regardless of the team's spoken/working language. Auto-loads
> each session like every other rule.

## Scope — everything in the repo is English
Applies to **all** text committed to this repository:
- **Rules** (`.claude/rules/**`, including the SQL vendor rules under `.claude/rules/sql/`).
- **Skills** (`.claude/skills/**` — `SKILL.md`, templates, prompts).
- **Docs** (`docs/**` incl. PRD, bug reports, security audit, production guides, knowledge base
  `docs/kb/**`, setup guides `docs/setup/**`).
- **Feature specs** (`features/**`) and `CLAUDE.md` / `README.md` / `TEMPLATE.md`.
- **Code**: identifiers, **comments**, log/error/`RAISE` messages, commit messages, test names.
- **User-visible UI strings** (labels, tooltips, toasts, errors) when the project has a UI.
- **Database artifacts** (`db/**`): SQL comments, `COMMENT ON` strings, seed data meant as examples.

## Rules
- **Write in English from the start.** Do not author new content in another language "to translate
  later" — new rules, specs, bug reports, KB/setup articles, and code comments are English on creation.
- **No German (or other non-English) prose** in committed files: no ä/ö/ü/ß and no foreign-language
  sentences in headings, body text, tables, or code comments. (A literal character/string that is the
  *data* under discussion — e.g. a `de_DE.UTF-8` locale value or an example of an accented name — may
  stay; it is data, not prose.)
- **Status & severity vocabulary is English.** Bug status: `Open` / `Fixed` / `Won't Fix`. Severity:
  `Critical` / `High` / `Medium` / `Low`. Security-finding status: `Open` / `Fixed` / `Partial`.
  Field labels in bug/audit files are English (`Area`, `Severity`, `Source`, `Description`,
  `Reproduction`, `Fix`, `Solution`, `Predecessor`, …). See the `/bug` and `/security` skills.
- **Translating an existing file keeps it functional.** When converting any file to English, preserve
  markdown structure, code, identifiers, and links. If you translate a heading, recompute every
  `#anchor` link that points to it (GitHub slug rules) so cross-references keep resolving.
- **US spelling and ASCII punctuation** in UI strings (see `brand.md` in the active UI flavor
  under `.claude/rules/ui/` for the hyphen rule). Em/en
  dashes are fine in markdown docs.

## Why
A single language removes a translation/maintenance axis, keeps operational and monitoring output
consistent across environments, and makes the kit usable by contributors worldwide — not just a
German-speaking team. The SQL ruleset under `.claude/rules/sql/postgres/` was originally ported in
German from the PostgreSQL framework it descends from and has been translated to English under this
rule; new vendor rulesets are authored in English directly.
