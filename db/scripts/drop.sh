#!/bin/bash
# db/scripts/drop.sh — drops the whole database + roles of an environment.
#
# Runs db/database/99.drop.database.sql against the maintenance DB 'postgres'
# (terminates connections, DROP DATABASE, DROP of the roles/users). All DROPs are
# IF EXISTS -> safe to re-run. Connects as the postgres superuser.
#
# Usage: bash db/scripts/drop.sh <env>
#   env : any <env> with a db/config/<env>.env pair (default: local)
#
# Password: DB_ADMIN_PASSWORD_POSTGRES (prompt if empty).
set -e

ENV="${1:-local}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$SCRIPT_DIR/../database"
CONFIG="$SCRIPT_DIR/../config/$ENV.env"
ENV_SQL="$SCRIPT_DIR/../config/$ENV.env.sql"

if [ ! -f "$CONFIG" ]; then
  echo "Error: unknown environment '$ENV' (no $CONFIG)" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG"

if [ -z "${DB_ADMIN_PASSWORD_POSTGRES:-}" ]; then
  read -s -p "Password for postgres superuser: " DB_ADMIN_PASSWORD_POSTGRES
  echo
fi
export PGPASSWORD="$DB_ADMIN_PASSWORD_POSTGRES"

echo "--- dropping database: env $ENV ($DB_NAME) ---"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -f "$ENV_SQL" \
  -f "$DB_DIR/99.drop.database.sql"

echo "--- done ---"
