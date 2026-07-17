#!/bin/bash
# db/scripts/deploy.sh — deploys the schema objects of an environment (idempotent).
#
# Loads the objects of a schema directory (or 'all') straight from the directory
# structure db/schemas/<dir>/ — there is NO central deploy.sql. Section order:
#   predeploy -> tables -> policies -> functions -> procedures -> trigger
#             -> views -> data -> postdeploy
# Within a section: by prefix (glob sort order) — 3-digit table-group numbers in
# the object sections, YYYYMMDDHHMM timestamps in predeploy/postdeploy.
# Connects as the schema owner, so created objects belong to the owner and are
# auto-granted to the RW role via its default privileges (no separate grant step).
#
# predeploy/postdeploy transition scripts are RUN-ONCE per database: each file is
# executed individually, tracked by filename + sha256 checksum in
# <app>.schema_change_log (via sp_ins_schema_change). Execution and registration
# run in ONE transaction, so "applied" and "recorded" commit atomically (opt-out
# for non-transactional statements: '-- no-single-transaction' as first line).
# Already-applied files are skipped; an applied file whose checksum changed
# ABORTS the deploy (applied change files are immutable — create a new file).
# See .claude/rules/db-migrations.md.
#
# CONCURRENCY: one deploy at a time per database. The run-once check
# (SELECT -> execute -> record) is not safe against a parallel deploy of the
# same environment — the DB - deploy workflow serializes runs via a per-env
# concurrency group; keep the same single-runner discipline for manual/local
# runs (don't start a second deploy while one is in flight).
#
# After a successful run it records one row in <app>.schema_apply_log via
# sp_ins_schema_apply (the deploy tracker from .claude/rules/db-migrations.md).
#
# Usage: bash db/scripts/deploy.sh <schema-dir> <env>
#   schema-dir : a directory under db/schemas/ | all
#   env        : any <env> with a db/config/<env>.env pair (default: local)
#
# Password: DB_FW_PASSWORD (required non-local; local -> 'pw').
set -e

# --------------------------------------------------------------------------------
# Project configuration — keep in sync with db/schemas/ and db/config/<env>.env.sql.
#   DEPLOY_ORDER   : dependency-safe order of the schema DIRECTORIES for 'all'
#                    (foundation first). One entry per directory under db/schemas/.
#   TRACKER_SCHEMA : psql variable name (from <env>.env.sql) of the schema that
#                    holds schema_apply_log / sp_ins_schema_apply and
#                    schema_change_log / sp_ins_schema_change.
#   TRACKER_DIR    : directory under db/schemas/ that carries the tracker object
#                    files (applied up front so predeploy can run before tables).
# --------------------------------------------------------------------------------
DEPLOY_ORDER=(example)
TRACKER_SCHEMA="schema_app"
TRACKER_DIR="example"

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: deploy.sh <schema-dir> <env>" >&2
  echo "  schema-dir : ${DEPLOY_ORDER[*]} | all" >&2
  echo "  env        : any env with a db/config/<env>.env pair (default: local)" >&2
  exit 1
fi

SCHEMA="$1"
ENV="${2:-local}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMAS_DIR="$SCRIPT_DIR/../schemas"
CONFIG="$SCRIPT_DIR/../config/$ENV.env"
ENV_SQL="$SCRIPT_DIR/../config/$ENV.env.sql"

if [ ! -f "$CONFIG" ]; then
  echo "Error: unknown environment '$ENV' (no $CONFIG)" >&2
  exit 1
fi

if [ "$SCHEMA" = "all" ]; then
  SCHEMAS=("${DEPLOY_ORDER[@]}")
elif [ -d "$SCHEMAS_DIR/$SCHEMA" ]; then
  SCHEMAS=("$SCHEMA")
else
  echo "Error: unknown schema dir '$SCHEMA' (expected: ${DEPLOY_ORDER[*]} | all)" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG"

# Connect as the schema owner; local -> 'pw'.
DB_FW_USER="${DB_FW_USER:-${DB_NAME}_fw}"
if [ "$ENV" = "local" ]; then
  DB_FW_PASSWORD="${DB_FW_PASSWORD:-pw}"
fi
if [ -z "${DB_FW_PASSWORD:-}" ]; then
  echo "Error: DB_FW_PASSWORD must be set for env '$ENV'." >&2
  exit 1
fi
export PGPASSWORD="$DB_FW_PASSWORD"

GIT_SHA="$(git -C "$SCRIPT_DIR/../.." rev-parse HEAD 2>/dev/null || echo '')"
APP_VERSION="${APP_VERSION_MAJOR:-0}.${APP_VERSION_MINOR:-0}.${APP_VERSION_BUILD:-0}"

# Full section order within a schema:
#   predeploy -> tables -> policies -> functions -> procedures -> trigger
#             -> views -> data -> postdeploy
# The object sections are batched into one psql call; predeploy/postdeploy run
# file-by-file with run-once tracking (schema_change_log).
BATCH_SECTIONS=(tables policies functions procedures trigger views data)

PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_FW_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)

# --------------------------------------------------------------------------------
# Apply one predeploy/postdeploy transition file with run-once semantics:
#   not applied                 -> execute AND record filename/checksum/git_sha
#                                  (sp_ins_schema_change) in ONE transaction
#   applied, same checksum      -> skip
#   applied, different checksum -> ABORT (applied change files are immutable)
# Executing and recording commit atomically (--single-transaction), so a deploy
# killed mid-run can never leave an executed-but-unrecorded transition that the
# next deploy would run a second time. Statements that refuse to run inside a
# transaction block (CREATE INDEX CONCURRENTLY, VACUUM, ...) cannot use this
# path: opt out with '-- no-single-transaction' as the file's FIRST line, which
# falls back to the non-atomic two-step apply (execute, then record) — keep such
# files idempotent, they may run twice after a crash between the two steps.
# git_sha falls back to 'unknown' outside a git checkout — unlike the informational
# schema_apply_log row, the run-once row is functional and must always be written.
# --------------------------------------------------------------------------------
run_once_file() {
  local schema="$1" section="$2" file="$3"
  local name checksum applied
  name="$schema/$section/$(basename "$file")"
  checksum="$(sha256sum "$file" | cut -d' ' -f1)"

  applied="$("${PSQL[@]}" -tA \
    -v "fname=$name" \
    -f "$ENV_SQL" \
    -f - <<SQL
SELECT checksum FROM :${TRACKER_SCHEMA}.schema_change_log WHERE filename = :'fname';
SQL
)"

  if [ -z "$applied" ]; then
    echo "    $section: applying $name"
    if head -n 1 "$file" | grep -q '^-- no-single-transaction'; then
      # Opt-out path (non-transactional statements): execute, then record in a
      # second call — the crash window between the two steps is the price of
      # the opt-out; keep such files idempotent.
      echo "    $section: $name opted out of single-transaction apply (non-atomic two-step)"
      "${PSQL[@]}" -f "$ENV_SQL" -f "$file"
      "${PSQL[@]}" \
        -v "fname=$name" \
        -v "sum=$checksum" \
        -v "sha=${GIT_SHA:-unknown}" \
        -f "$ENV_SQL" \
        -f - <<SQL
CALL :${TRACKER_SCHEMA}.sp_ins_schema_change(NULL, :'fname', :'sum', :'sha');
SQL
    else
      "${PSQL[@]}" --single-transaction \
        -v "fname=$name" \
        -v "sum=$checksum" \
        -v "sha=${GIT_SHA:-unknown}" \
        -f "$ENV_SQL" \
        -f "$file" \
        -f - <<SQL
CALL :${TRACKER_SCHEMA}.sp_ins_schema_change(NULL, :'fname', :'sum', :'sha');
SQL
    fi
  elif [ "$applied" = "$checksum" ]; then
    echo "    $section: $name skipped (already applied)"
  else
    echo "Error: $name was applied with checksum $applied but now hashes to $checksum." >&2
    echo "       Applied change files are immutable — create a new file instead of editing." >&2
    exit 1
  fi
}

echo "--- deploying schema(s): ${SCHEMAS[*]} | env: $ENV ($DB_NAME) as $DB_FW_USER ---"

# --------------------------------------------------------------------------------
# Ensure the run-once tracker exists BEFORE any predeploy file runs (predeploy
# precedes the tables section — on a greenfield deploy schema_change_log would
# not exist yet). Both tracker files are idempotent; their second application in
# the regular tables/procedures sections below is harmless.
# --------------------------------------------------------------------------------
tracker_args=()
for f in "$SCHEMAS_DIR/$TRACKER_DIR"/tables/*.schema_change_log.sql \
         "$SCHEMAS_DIR/$TRACKER_DIR"/procedures/*.sp_ins_schema_change.sql; do
  [ -e "$f" ] || continue
  tracker_args+=(-f "$f")
done
if [ "${#tracker_args[@]}" -gt 0 ]; then
  echo ">>> ensuring run-once tracker (schema_change_log)"
  "${PSQL[@]}" -f "$ENV_SQL" "${tracker_args[@]}"
fi

for schema in "${SCHEMAS[@]}"; do
  echo ">>> schema dir: $schema (version $APP_VERSION, git ${GIT_SHA:-unknown})"

  # ----- predeploy: file-by-file, run-once ---------------------------------------
  dir="$SCHEMAS_DIR/$schema/predeploy"
  if [ -d "$dir" ]; then
    for f in "$dir"/*.sql; do
      [ -e "$f" ] || continue
      run_once_file "$schema" predeploy "$f"
    done
  fi

  # ----- object sections: batched into one psql call -----------------------------
  files=()
  for section in "${BATCH_SECTIONS[@]}"; do
    dir="$SCHEMAS_DIR/$schema/$section"
    [ -d "$dir" ] || continue
    for f in "$dir"/*.sql; do
      [ -e "$f" ] || continue
      files+=("$f")
    done
  done

  if [ "${#files[@]}" -eq 0 ]; then
    echo "    (no objects for schema dir '$schema')"
  else
    args=()
    for f in "${files[@]}"; do
      args+=(-f "$f")
    done

    "${PSQL[@]}" \
      -v "db_version=$APP_VERSION" \
      -v "git_sha=$GIT_SHA" \
      -f "$ENV_SQL" \
      "${args[@]}"
  fi

  # ----- postdeploy: file-by-file, run-once ---------------------------------------
  dir="$SCHEMAS_DIR/$schema/postdeploy"
  if [ -d "$dir" ]; then
    for f in "$dir"/*.sql; do
      [ -e "$f" ] || continue
      run_once_file "$schema" postdeploy "$f"
    done
  fi
done

# --------------------------------------------------------------------------------
# Deploy tracker: record one schema_apply_log row per apply run (see
# .claude/rules/db-migrations.md). Values are passed as psql variables (:'var')
# — injection-safe quoting, no string concatenation.
# --------------------------------------------------------------------------------
if [ -z "$GIT_SHA" ]; then
  echo "Warning: GIT_SHA empty — schema_apply_log row not written (no git checkout?)." >&2
else
  echo ">>> schema_apply_log: recording $APP_VERSION ($ENV, git $GIT_SHA)"
  "${PSQL[@]}" \
    -v "db_version=$APP_VERSION" \
    -v "sha=$GIT_SHA" \
    -v "env=$ENV" \
    -v "note=deploy.sh $SCHEMA" \
    -f "$ENV_SQL" \
    -f - <<SQL
CALL :${TRACKER_SCHEMA}.sp_ins_schema_apply(NULL, :'db_version', :'sha', :'env', :'note');
SQL
fi

echo "--- done ---"
