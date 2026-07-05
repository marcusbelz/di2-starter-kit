#!/bin/bash
# db/scripts/lint-numbers.sh — table-group number lint (CI backstop for the claim
# protocol in .claude/rules/sql/postgres/sql.md -> "File Naming & Numbering").
#
# Per schema directory under db/schemas/, three checks:
#   1. one prefix = one table : no two files in tables/ share a 3-digit prefix
#   2. registry coverage      : every prefix used by any file in the numbered
#                               sections has a row in that schema's NUMBERS.md
#   3. registry integrity     : NUMBERS.md contains no duplicate numbers
#
# predeploy/postdeploy files use timestamp prefixes (no table-group numbers) and
# are deliberately NOT checked here.
#
# Usage: bash db/scripts/lint-numbers.sh
# Exit:  0 = clean, 1 = at least one violation (one message per violation).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMAS_DIR="$SCRIPT_DIR/../schemas"

# Numbered sections only — predeploy/postdeploy use timestamp prefixes.
SECTIONS=(tables policies functions procedures trigger views data)

violations=0

fail() {
  echo "LINT: $*" >&2
  violations=$((violations + 1))
}

for schema_dir in "$SCHEMAS_DIR"/*/; do
  [ -d "$schema_dir" ] || continue
  schema="$(basename "$schema_dir")"
  registry="${schema_dir}NUMBERS.md"

  # ------------------------------------------------------------------------------
  # Collect every 3-digit prefix used in the numbered sections of this schema.
  # ------------------------------------------------------------------------------
  used_prefixes=""
  for section in "${SECTIONS[@]}"; do
    dir="${schema_dir}${section}"
    [ -d "$dir" ] || continue
    for f in "$dir"/[0-9][0-9][0-9].*.sql; do
      [ -e "$f" ] || continue
      used_prefixes+="$(basename "$f" | cut -d. -f1)"$'\n'
    done
  done

  # Schema dir has no numbered files at all -> nothing to lint here.
  if [ -z "$used_prefixes" ]; then
    continue
  fi

  # ------------------------------------------------------------------------------
  # Check 1: one prefix = one table (no duplicate prefix across tables/ files).
  # ------------------------------------------------------------------------------
  if [ -d "${schema_dir}tables" ]; then
    table_prefixes=""
    for f in "${schema_dir}tables"/[0-9][0-9][0-9].*.sql; do
      [ -e "$f" ] || continue
      table_prefixes+="$(basename "$f" | cut -d. -f1)"$'\n'
    done
    for dup in $(printf '%s' "$table_prefixes" | sort | uniq -d); do
      fail "schema '$schema': prefix $dup is used by more than one table file:" \
           "$(cd "${schema_dir}tables" && echo "$dup".*.sql)"
    done
  fi

  # ------------------------------------------------------------------------------
  # Check 2 + 3: registry coverage and integrity (NUMBERS.md).
  # ------------------------------------------------------------------------------
  if [ ! -f "$registry" ]; then
    fail "schema '$schema': numbered files exist but NUMBERS.md is missing"
    continue
  fi

  # Registry numbers = first cell of each table row that starts with a 3-digit number.
  registry_numbers="$(sed -n 's/^| *\([0-9]\{3\}\) *|.*/\1/p' "$registry")"

  for dup in $(printf '%s\n' "$registry_numbers" | sort | uniq -d); do
    fail "schema '$schema': NUMBERS.md claims number $dup more than once"
  done

  for prefix in $(printf '%s' "$used_prefixes" | sort -u); do
    if ! printf '%s\n' "$registry_numbers" | grep -qx "$prefix"; then
      fail "schema '$schema': prefix $prefix is used by DDL files but has no row in NUMBERS.md:" \
           "$(cd "$schema_dir" && echo */"$prefix".*.sql)"
    fi
  done
done

if [ "$violations" -gt 0 ]; then
  echo "lint-numbers: $violations violation(s) found." >&2
  exit 1
fi

echo "lint-numbers: OK"
