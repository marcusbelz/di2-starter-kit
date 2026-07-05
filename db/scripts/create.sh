#!/bin/bash
# db/scripts/create.sh — one-time DB / role / user setup for an environment.
#
# Creates the database, extensions, the application schema(s), the RW group role,
# and the login users. Connects as the postgres superuser. The bootstrap is
# drop-and-recreate: to re-set-up, run drop.sh first, then create.sh.
#
# Usage: bash db/scripts/create.sh <env>
#   env : any <env> with a db/config/<env>.env + <env>.env.sql pair (default: local)
#
# Passwords (non-local: required via environment variables; local: 'pw'):
#   DB_ADMIN_PASSWORD_POSTGRES  - postgres superuser (connect)   -> prompt if empty
#   DB_OWNER_PASSWORD           - database owner        (script 01)
#   DB_FW_PASSWORD              - schema owner          (script 03)
#   DB_SA_PASSWORD              - service account       (script 06)
#
# Example (non-local manual run; export in the same shell, directly before the call):
#   export DB_ADMIN_PASSWORD_POSTGRES='<existing superuser password>'   # optional - prompted if unset
#   export DB_OWNER_PASSWORD='<new password you choose>'
#   export DB_FW_PASSWORD='<new password you choose>'
#   export DB_SA_PASSWORD='<new password you choose>'
#   bash db/scripts/create.sh dev
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

# postgres superuser password (prompt if not set via environment variable)
if [ -z "${DB_ADMIN_PASSWORD_POSTGRES:-}" ]; then
  read -s -p "Password for postgres superuser: " DB_ADMIN_PASSWORD_POSTGRES
  echo
fi
export PGPASSWORD="$DB_ADMIN_PASSWORD_POSTGRES"

# Role passwords: local -> 'pw' (matches the local <env>.env.sql), otherwise required.
if [ "$ENV" = "local" ]; then
  DB_OWNER_PASSWORD="${DB_OWNER_PASSWORD:-pw}"
  DB_FW_PASSWORD="${DB_FW_PASSWORD:-pw}"
  DB_SA_PASSWORD="${DB_SA_PASSWORD:-pw}"
else
  for v in DB_OWNER_PASSWORD DB_FW_PASSWORD DB_SA_PASSWORD; do
    if [ -z "${!v}" ]; then
      echo "Error: $v must be set for env '$ENV'." >&2
      exit 1
    fi
  done
fi

echo "--- creating database: env $ENV ($DB_NAME) ---"

# Preflight: the bootstrap is drop-and-recreate. Roles are cluster-global and survive
# a DROP DATABASE -> a second create.sh run without a prior drop.sh would abort in
# step 1 with "role already exists" (42710). Exit code 3 = DB/roles exist (RAISE
# under ON_ERROR_STOP); 1/2 = a real connection error.
echo ">>> preflight: check for existing database / roles"
rc=0
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -v ON_ERROR_STOP=1 -X \
  -f "$ENV_SQL" \
  -f "$DB_DIR/00.preflight.create.sql" >/dev/null || rc=$?
if [ "$rc" -eq 3 ]; then
  echo
  echo "Error: database or roles for env '$ENV' already exist." >&2
  echo "       The bootstrap is drop-and-recreate (not idempotent)." >&2
  echo "       Clean up first, then re-create:" >&2
  echo "         bash db/scripts/drop.sh $ENV" >&2
  echo "         bash db/scripts/create.sh $ENV" >&2
  exit 1
elif [ "$rc" -ne 0 ]; then
  echo "Error: preflight psql failed (exit $rc) — check connection/setup." >&2
  exit "$rc"
fi

# Step 1: database + owner role (against the maintenance DB 'postgres')
echo ">>> step 1: database + owner"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -v "database_owner_password=$DB_OWNER_PASSWORD" \
  -f "$ENV_SQL" \
  -f "$DB_DIR/01.create.database.sql"

# Step 2: extensions, schema owner, schema(s), RW role, service account (new DB)
echo ">>> step 2: extensions, schemas, roles, users"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -v "schema_owner_password=$DB_FW_PASSWORD" \
  -v "user_sa_password=$DB_SA_PASSWORD" \
  -f "$ENV_SQL" \
  -f "$DB_DIR/02.create.extension.sql" \
  -f "$DB_DIR/03.create.user.owner.sql" \
  -f "$DB_DIR/04.create.schema.app.sql" \
  -f "$DB_DIR/05.create.role.rw.sql" \
  -f "$DB_DIR/06.create.user.sa.sql" \
  -f "$DB_DIR/07.grant.role.sa.sql"

echo "--- done ---"
