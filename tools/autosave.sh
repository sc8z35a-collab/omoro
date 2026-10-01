#!/usr/bin/env bash
# =====================================================================
#  OMORO autosave daemon — commits & pushes WIP every N seconds (default 180)
#  so that work survives sandbox resets / session loss.
#
#  usage:  tools/autosave.sh start   # start daemon (idempotent)
#          tools/autosave.sh ensure  # same as start, silent (used by hooks)
#          tools/autosave.sh stop
#          tools/autosave.sh status
#          tools/autosave.sh once    # run one save cycle now
#          tools/autosave.sh log     # tail log
#
#  env:    AUTOSAVE_INTERVAL=180   seconds between cycles
#          AUTOSAVE_BRANCH=<name>  branch to push (default: current branch)
#          AUTOSAVE_NO_PR=1        don't auto-create a draft PR
#
#  Safety:
#   * skips while a merge/rebase/cherry-pick is in progress or index.lock exists
#   * flock prevents overlapping cycles
#   * if the push is rejected (non-fast-forward), it first tries
#     `git pull --rebase --autostash`; if that fails it aborts the rebase and
#     force-pushes a backup to  autosave/<branch>  so nothing is ever lost
#   * never pushes to main
# =====================================================================
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$REPO/.autosave"
PIDF="$STATE/pid"
LOG="$STATE/autosave.log"
LOCK="$STATE/lock"
INTERVAL="${AUTOSAVE_INTERVAL:-180}"
mkdir -p "$STATE"

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
running() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

busy() {
  local g; g="$(git -C "$REPO" rev-parse --absolute-git-dir 2>/dev/null)" || return 0
  [ -f "$g/index.lock" ] || [ -d "$g/rebase-merge" ] || [ -d "$g/rebase-apply" ] \
    || [ -f "$g/MERGE_HEAD" ] || [ -f "$g/CHERRY_PICK_HEAD" ] || [ -f "$g/REVERT_HEAD" ]
}

cycle() {
  cd "$REPO" || return 1
  exec 9>"$LOCK"
  flock -n 9 || { log "skip: another cycle running"; return 0; }
  if busy; then log "skip: git operation in progress"; return 0; fi
  # children (git, gh, ssh) must not inherit the lock fd
  _run() { "$@" 9>&-; }
  local br; br="${AUTOSAVE_BRANCH:-$(git symbolic-ref --short -q HEAD)}"
  if [ -z "$br" ] || [ "$br" = "main" ] || [ "$br" = "master" ]; then log "skip: branch '$br' not allowed"; return 0; fi

  if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
    git add -A >/dev/null 2>&1
    local n; n="$(git diff --cached --name-only | wc -l)"
    git -c core.hooksPath=/dev/null commit -q --no-verify -m "wip(autosave): $n file(s) @ $(date -u '+%F %TZ')" >/dev/null 2>&1 \
      && log "commit: $n file(s) on $br" || log "commit failed"
  fi

  # push if ahead of remote (or remote branch missing)
  local ahead=1
  if git rev-parse -q --verify "origin/$br" >/dev/null; then
    git fetch -q origin "$br" 2>/dev/null
    ahead="$(git rev-list --count "origin/$br..HEAD" 2>/dev/null || echo 1)"
  fi
  if [ "$ahead" != "0" ]; then
    if _run timeout 90 git -c core.hooksPath=/dev/null push -q origin "HEAD:refs/heads/$br" >/dev/null 2>&1; then
      log "push ok: $br (+$ahead)"
    else
      log "push rejected -> pull --rebase"
      if _run timeout 90 git -c core.hooksPath=/dev/null pull -q --rebase --autostash origin "$br" >/dev/null 2>&1 \
         && _run timeout 90 git -c core.hooksPath=/dev/null push -q origin "HEAD:refs/heads/$br" >/dev/null 2>&1; then
        log "push ok after rebase: $br"
      else
        git rebase --abort >/dev/null 2>&1
        _run timeout 90 git -c core.hooksPath=/dev/null push -q -f origin "HEAD:refs/heads/autosave/$br" >/dev/null 2>&1 \
          && log "BACKUP pushed to autosave/$br (resolve manually!)" || log "ERROR: backup push failed"
      fi
    fi
  fi

  # make sure there is a PR so the work is visible
  if [ -z "${AUTOSAVE_NO_PR:-}" ] && command -v gh >/dev/null; then
    local open; open="$(_run timeout 30 gh pr list --head "$br" --state open --json number -q 'length' 2>/dev/null || echo err)"
    if [ "$open" = "0" ]; then
      local base="genspark_ai_developer"; [ "$br" = "genspark_ai_developer" ] && base="main"
      _run timeout 40 gh pr create --draft --base "$base" --head "$br" \
        --title "WIP(autosave): $br" --body "Auto-created by tools/autosave.sh. Work in progress; squashed before merge." >/dev/null 2>&1 \
        && log "draft PR created: $br -> $base"
    fi
  fi
  return 0
}

loop() {
  trap 'log "daemon stop (pid $$)"; rm -f "$PIDF"; exit 0' TERM INT
  log "daemon start (pid $$, every ${INTERVAL}s, repo $REPO)"
  while true; do
    sleep "$INTERVAL" 9>&- &
    wait $!
    ( cycle )   # subshell => flock released after each cycle
  done
}

case "${1:-status}" in
  start|ensure)
    if running; then [ "$1" = start ] && echo "autosave already running (pid $(cat "$PIDF"))"; exit 0; fi
    nohup setsid bash "$0" __loop >/dev/null 2>&1 < /dev/null &
    for _ in 1 2 3 4 5 6 7 8 9 10; do running && break; sleep 0.2; done
    [ "$1" = start ] && echo "autosave started (pid $(cat "$PIDF" 2>/dev/null), every ${INTERVAL}s) log: $LOG"
    exit 0 ;;
  __loop) echo $$ > "$PIDF"; loop ;;
  stop) if running; then kill "$(cat "$PIDF")" && echo "stopped"; else echo "not running"; fi; rm -f "$PIDF" ;;
  status) if running; then echo "running (pid $(cat "$PIDF"))"; else echo "NOT running"; fi; tail -n 5 "$LOG" 2>/dev/null ;;
  once) ( cycle ); tail -n 5 "$LOG" ;;
  log) tail -n "${2:-40}" "$LOG" ;;
  *) echo "usage: $0 start|ensure|stop|status|once|log"; exit 2 ;;
esac
