#!/usr/bin/env bash
# One-shot environment bootstrap for any agent (idempotent). Run after every sandbox reset:
#   bash tools/bootstrap.sh
set -u
cd "$(dirname "$0")/.."
git config core.hooksPath tools/hooks          # hooks re-arm autosave on every git op
git config pull.rebase true
git config rebase.autoStash true
git config fetch.prune true
# node_modules may be a *symlink* in extra worktrees; `node_modules/` in .gitignore only matches dirs.
EXC="$(git rev-parse --path-format=absolute --git-common-dir)/info/exclude"
grep -qx 'node_modules' "$EXC" 2>/dev/null || printf 'node_modules\n.autosave\n.collab\n.agents\n.shots\n' >> "$EXC"
[ -e node_modules ] || npm install --no-audit --no-fund
tools/autosave.sh start
