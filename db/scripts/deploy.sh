#!/bin/bash
# db/scripts/deploy.sh — deploys the schema objects of an environment (idempotent).
#
# Loads the objects of a schema directory (or 'all') straight from the directory
# structure db/schemas/<dir>/ — there is NO central deploy.sql. Section order:
#   tables -> policies -> functions -> procedures -> trigger -> views -> data
# Within a section: by 3-digit number prefix (glob sort order).
# Connects as the schema owner, so created objects belong to the owner and are
# auto-granted to the RW role via its default privileges (no separate grant step).
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
#                    holds schema_apply_log / sp_ins_schema_apply.
# --------------------------------------------------------------------------------
DEPLOY_ORDER=(example)
TRACKER_SCHEMA="schema_app"

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

# Section order within a schema.
SECTIONS=(tables policies functions procedures trigger views data)

echo "--- deploying schema(s): ${SCHEMAS[*]} | env: $ENV ($DB_NAME) as $DB_FW_USER ---"

for schema in "${SCHEMAS[@]}"; do
  echo ">>> schema dir: $schema (version $APP_VERSION, git ${GIT_SHA:-unknown})"

  files=()
  for section in "${SECTIONS[@]}"; do
    dir="$SCHEMAS_DIR/$schema/$section"
    [ -d "$dir" ] || continue
    for f in "$dir"/*.sql; do
      [ -e "$f" ] || continue
      files+=("$f")
    done
  done

  if [ "${#files[@]}" -eq 0 ]; then
    echo "    (no objects for schema dir '$schema' — skipping)"
    continue
  fi

  args=()
  for f in "${files[@]}"; do
    args+=(-f "$f")
  done

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_FW_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -v "db_version=$APP_VERSION" \
    -v "git_sha=$GIT_SHA" \
    -f "$ENV_SQL" \
    "${args[@]}"
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
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_FW_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
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
