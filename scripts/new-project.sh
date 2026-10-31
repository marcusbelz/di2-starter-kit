#!/usr/bin/env bash
# Create a new project from the DI2 Starter Kit (local copy + fresh git repo).
#
# Usage:  ./scripts/new-project.sh <target-dir>
# Example: ./scripts/new-project.sh ~/code/my-new-project
#
# Copies the committed template (`git archive HEAD`) into <target-dir>, initializes a fresh
# git repository, makes an initial commit, and reminds you to run /init.
# Only committed content is copied - untracked, ignored and uncommitted files never reach the
# new project (local settings, stray dumps); commit template edits first if you want them.

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <target-dir>" >&2
  exit 1
fi

# Repo root = parent of the scripts/ dir this file lives in.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! git -C "$SOURCE" rev-parse --verify -q HEAD >/dev/null 2>&1; then
  echo "Template '$SOURCE' is not a git checkout with a commit - the copy is taken from HEAD." >&2
  echo "Clone the template with git (or use GitHub's 'Use this template'), then retry." >&2
  exit 1
fi

if [ -e "$TARGET" ] && [ -n "$(find "$TARGET" -mindepth 1 -maxdepth 1 -not -name .git -print -quit 2>/dev/null)" ]; then
  echo "Target '$TARGET' already exists and is not empty." >&2
  exit 1
fi

if [ -n "$(git -C "$SOURCE" status --porcelain)" ]; then
  echo "Note: the template has uncommitted changes - they are NOT copied (only the committed HEAD is)."
fi

mkdir -p "$TARGET"
echo "Copying template (committed HEAD) -> $TARGET ..."

# git archive: exactly the committed tree, checked out with the template's .gitattributes
# (eol=lf files arrive with LF) - no .git, no ignored or untracked files.
git -C "$SOURCE" archive --format=tar HEAD | tar -x -C "$TARGET"

cd "$TARGET"
# -b main: deterministic initial branch regardless of the user's init.defaultBranch (git >= 2.28)
git init -q -b main
git add -A
# Carry the executable bit over - on file systems without one (Windows) git add records 644.
git -C "$SOURCE" ls-tree -r -z HEAD | while IFS= read -r -d '' entry; do
  case "$entry" in
    100755\ *) git update-index --chmod=+x -- "${entry#*$'\t'}" ;;
  esac
done
git commit -q -m "chore: initialize from di2-starter-kit"

echo ""
echo "Done. New project created at: $TARGET"
echo "Next: open it in Claude Code and run  /init"
