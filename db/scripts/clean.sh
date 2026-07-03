#!/bin/bash
# db/scripts/clean.sh — removes the schema objects of an environment (no DB drop).
#
# Drops all objects (views, tables, functions, procedures, sequences) of a schema
# (or 'all') via introspection — the schema itself STAYS, so the USAGE grant and
# the default privileges for the RW role survive (no grant re-apply needed after
# a subsequent deploy.sh). Connects as the schema owner (owner of the objects).
#
# NOTE: takes the DEPLOYED schema NAME (e.g. 'app'), not the directory name under
# db/schemas/ — the directory is a template whose objects deploy into the schema
# set in db/config/<env>.env.sql.
#
# Usage: bash db/scripts/clean.sh <schema> <env>
#   schema : deployed schema name | all
#   env    : any <env> with a db/config/<env>.env pair (default: local)
#
# Password: DB_FW_PASSWORD (required non-local; local -> 'pw').
set -e

# --------------------------------------------------------------------------------
# Project configuration — the DEPLOYED schema names, reverse deploy order
# (dependents first). Keep in sync with db/config/<env>.env.sql and the
# DEPLOY_ORDER in deploy.sh.
# --------------------------------------------------------------------------------
CLEAN_ORDER=(app)

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: clean.sh <schema> <env>" >&2
  echo "  schema : ${CLEAN_ORDER[*]} | all" >&2
  echo "  env    : any env with a db/config/<env>.env pair (default: local)" >&2
  exit 1
fi

SCHEMA="$1"
ENV="${2:-local}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/../config/$ENV.env"
CLEAN_SQL="$SCRIPT_DIR/clean.schema.sql"

if [ ! -f "$CONFIG" ]; then
  echo "Error: unknown environment '$ENV' (no $CONFIG)" >&2
  exit 1
fi

if [ "$SCHEMA" = "all" ]; then
  SCHEMAS=("${CLEAN_ORDER[@]}")
else
  found=0
  for s in "${CLEAN_ORDER[@]}"; do
    [ "$s" = "$SCHEMA" ] && found=1
  done
  if [ "$found" -ne 1 ]; then
    echo "Error: unknown schema '$SCHEMA' (expected: ${CLEAN_ORDER[*]} | all)" >&2
    exit 1
  fi
  SCHEMAS=("$SCHEMA")
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

echo "--- cleaning schema(s): ${SCHEMAS[*]} | env: $ENV ($DB_NAME) as $DB_FW_USER ---"

for schema in "${SCHEMAS[@]}"; do
  echo ">>> clean schema: $schema"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_FW_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -v "schema_target=$schema" \
    -f "$CLEAN_SQL"
done

echo "--- done ---"
