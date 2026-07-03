#!/usr/bin/env bash
#
# Throwaway-container test runner for the db/tests example slice.
#
# Spins up a disposable PostgreSQL 17 container + a fresh database, applies the
# example schema objects in load order, runs the db/tests/example assertions
# against them, and tears the container down again (always, via trap).
#
# This is the apply-smoke pattern from .claude/rules/db-migrations.md: a DDL +
# test change must run end-to-end against an empty DB, exit 0, before merge.
#
# Usage:   db/tests/run.sh
# Windows: run from Git Bash (the Bash tool / "Git Bash here"); needs Docker.
#
# Failure model: every script runs with `psql -v ON_ERROR_STOP=1`, so a failing
# ASSERT (or any SQL error) aborts that psql with a non-zero exit; `set -e` then
# stops the whole run. "ALL TESTS PASSED" only prints if every script succeeded.

set -euo pipefail

CONTAINER="di2-kit-test-pg"
IMAGE="postgres:17"
DB="kit_test"
PW="test_only"                                  # local throwaway only — never a real secret
DB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"     # the db/ directory

# psql variables the object scripts expect (mirror db/config/example.env.sql)
SCHEMA_APP="app"
SCHEMA_OWNER="app_local_fw"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo ">>> starting throwaway container $CONTAINER ($IMAGE)"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PW" \
  -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=C" \
  "$IMAGE" >/dev/null

echo ">>> waiting for readiness"
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

echo ">>> creating database + minimal owner role/schema"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
CREATE DATABASE $DB;
SQL
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d "$DB" <<SQL
CREATE ROLE $SCHEMA_OWNER NOLOGIN;
CREATE SCHEMA $SCHEMA_APP AUTHORIZATION $SCHEMA_OWNER;
SQL

apply() {
  echo ">>> apply $(basename "$1")"
  docker exec -i "$CONTAINER" \
    psql -v ON_ERROR_STOP=1 \
         -v schema_app="$SCHEMA_APP" \
         -v schema_owner="$SCHEMA_OWNER" \
         -U postgres -d "$DB" < "$1"
}

# object load order: same section order as db/scripts/deploy.sh; within a section
# by 3-digit prefix (glob sort). New object files are picked up automatically.
for section in tables policies functions procedures trigger views data; do
  for f in "$DB_ROOT/schemas/example/$section"/*.sql; do
    [ -e "$f" ] || continue
    apply "$f"
  done
done

# tests, in numeric order (000.* structural first, then behavioral)
for f in "$DB_ROOT"/tests/example/*.sql; do
  apply "$f"
done

echo ">>> ALL TESTS PASSED"
