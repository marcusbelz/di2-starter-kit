#!/usr/bin/env bash
# scripts/check-env-files.sh
# Read-only completeness check of the host env files (see .claude/rules/deploy-infra.md,
# "Secret-sync drift" + "Env-file smoke").
#
# Checks that every security-critical variable is set in every environment's env
# file and carries no placeholder. Reads the files only - changes nothing. The
# VALUES are never printed - only SET / MISSING / EMPTY / PLACEHOLDER.
#
# Runs ON THE DEPLOY HOST (the env files live outside the repo there):
#   bash scripts/check-env-files.sh            # all environments in ENVS
#   bash scripts/check-env-files.sh prod       # one environment
#
# Expected per environment: every variable SET. Each MISSING, EMPTY or PLACEHOLDER
# is a go-live blocker.
#
# ADAPT (/init, Step 5 - or when the server exists): fill ENV_FILE, ENVS and VARS
# from deploy-infra.md / .env.example. Until then the script refuses to run.
# Pruned by /init when deploy == none.

set -uo pipefail

# Path of one environment's env file; "<env>" is replaced per environment.
ENV_FILE='{{HOST_REPO_PATH}}/<env>/.env'

# Environments to check by default (match env_stages in .claude/rules/stack.md).
ENVS_DEFAULT=(dev prod)

# Security-critical variables that must not be missing, empty or a placeholder
# in any environment (the same list as the secret-sync table in deploy-infra.md).
VARS=(
  DATABASE_URL
  # AUTH_SECRET
  # ...
)

# Values that count as "not filled in" (extend to match your .env.example dummies).
PLACEHOLDER_RE='your_[a-z_]+|change_?me|placeholder|<[A-Za-z_]+>|\{\{[A-Z_]+\}\}'

if [[ "$ENV_FILE" == *'{{'* ]]; then
  echo "check-env-files.sh is not configured yet: set ENV_FILE, ENVS_DEFAULT and VARS at the top of the script." >&2
  exit 2
fi

if [ "$#" -ge 1 ]; then
  ENVS=("$1")
else
  ENVS=("${ENVS_DEFAULT[@]}")
fi

OVERALL=0

for env in "${ENVS[@]}"; do
  file="${ENV_FILE//<env>/$env}"
  echo "=== ${env}  (${file}) ==="

  if [ ! -f "$file" ]; then
    echo "  FILE MISSING: $file"
    OVERALL=1
    continue
  fi

  for var in "${VARS[@]}"; do
    line=$(grep -E "^${var}=" "$file" 2>/dev/null | tail -n 1 || true)
    value="${line#*=}"
    if [ -z "$line" ]; then
      echo "  MISSING:     $var"
      OVERALL=1
    elif [[ "$value" =~ ^[[:space:]]*(\"\"|\'\')?[[:space:]]*$ ]]; then
      # Set but empty (`VAR=`, `VAR=""`) counts like missing - most apps treat an
      # empty variable like an unset one.
      echo "  EMPTY:       $var"
      OVERALL=1
    elif [[ "$value" =~ $PLACEHOLDER_RE ]]; then
      echo "  PLACEHOLDER: $var"
      OVERALL=1
    else
      echo "  SET:         $var"
    fi
  done
done

echo
if [ "$OVERALL" -eq 0 ]; then
  echo "All checked environments complete (${#VARS[@]}/${#VARS[@]} SET each)."
else
  echo "ATTENTION: at least one MISSING / EMPTY / PLACEHOLDER - see above (go-live blocker)."
fi
exit "$OVERALL"
