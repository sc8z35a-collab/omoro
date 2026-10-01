#!/usr/bin/env bash
# One-shot environment bootstrap for any agent (idempotent). Run after every sandbox reset:
#   bash tools/bootstrap.sh
set -u
cd "$(dirname "$0")/.."
git config core.hooksPath tools/hooks          # hooks re-arm autosave on every git op
git config pull.rebase true
git config rebase.autoStash true
git config fetch.prune true
[ -d node_modules ] || npm install --no-audit --no-fund
tools/autosave.sh start
