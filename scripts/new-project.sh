#!/usr/bin/env bash
# Create a new project from the DI2 Starter Kit (local copy + fresh git repo).
#
# Usage:  ./scripts/new-project.sh <target-dir>
# Example: ./scripts/new-project.sh ~/code/my-new-project
#
# Copies the template (excluding this repo's .git and dependency/build dirs) into <target-dir>,
# initializes a fresh git repository, makes an initial commit, and reminds you to run /init.

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <target-dir>" >&2
  exit 1
fi

# Repo root = parent of the scripts/ dir this file lives in.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -e "$TARGET" ] && [ -n "$(find "$TARGET" -mindepth 1 -maxdepth 1 -not -name .git -print -quit 2>/dev/null)" ]; then
  echo "Target '$TARGET' already exists and is not empty." >&2
  exit 1
fi

mkdir -p "$TARGET"
echo "Copying template -> $TARGET ..."

# tar pipe: copy everything except .git and dependency/build dirs, portably.
( cd "$SOURCE" && tar \
    --exclude='./.git' \
    --exclude='./node_modules' \
    --exclude='./.venv' \
    --exclude='./dist' \
    --exclude='./build' \
    --exclude='./.next' \
    -cf - . ) | ( cd "$TARGET" && tar -xf - )

cd "$TARGET"
git init -q
git add -A
git commit -q -m "chore: initialize from di2-starter-kit"

echo ""
echo "Done. New project created at: $TARGET"
echo "Next: open it in Claude Code and run  /init"
