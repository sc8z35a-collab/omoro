#!/usr/bin/env bash
# =====================================================================
#  Shared collaboration board (lives on the remote branch `collab`).
#  A separate git worktree is kept at  .collab/  (gitignored) so the board
#  never interferes with your feature branch.
#
#   tools/board.sh sync                    # pull latest board
#   tools/board.sh read [N]                # show last N messages (default 30) + statuses
#   tools/board.sh post <FROM> <TO|ALL> "message"
#   tools/board.sh status <AGENT> "one-line status"   # updates status/<AGENT>.md header
#   tools/board.sh claim <AGENT> <TASK-ID>             # mark task as claimed
#   tools/board.sh done  <AGENT> <TASK-ID>             # mark task as done
#   tools/board.sh error <AGENT> "env error" "fix"     # append to ENV_ERRORS.md
#   tools/board.sh tip   <AGENT> "craft tip"           # append to TIPS.md
#   tools/board.sh edit                                # (then git -C .collab ... manually)
#   tools/board.sh watch [secs]                        # poll & print new messages
#
#  All writes: pull --rebase -> append -> commit -> push, retried 5x.
#  Messages are append-only lines => rebase conflicts are practically impossible.
# =====================================================================
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$REPO/.collab"
B=collab
cd "$REPO"

ensure() {
  if [ ! -e "$WT/.git" ]; then
    git fetch -q origin "$B" 2>/dev/null
    if git rev-parse -q --verify "origin/$B" >/dev/null; then
      git worktree add -q -f "$WT" -B "$B" "origin/$B" >/dev/null 2>&1 || git worktree add -q -f "$WT" "$B"
    else
      echo "collab branch missing on origin" >&2; exit 1
    fi
  fi
}
sync() { ensure; git -C "$WT" -c core.hooksPath=/dev/null pull -q --rebase origin "$B" >/dev/null 2>&1 || { git -C "$WT" rebase --abort >/dev/null 2>&1; git -C "$WT" reset -q --hard "origin/$B"; }; }
now() { date -u '+%F %TZ'; }
commit_push() {
  local msg="$1" i
  for i in 1 2 3 4 5; do
    git -C "$WT" add -A
    git -C "$WT" -c core.hooksPath=/dev/null commit -q -m "$msg" >/dev/null 2>&1
    if git -C "$WT" -c core.hooksPath=/dev/null push -q origin "HEAD:$B" >/dev/null 2>&1; then return 0; fi
    git -C "$WT" -c core.hooksPath=/dev/null pull -q --rebase origin "$B" >/dev/null 2>&1 || { git -C "$WT" rebase --abort; sleep 1; }
    sleep $((i * 2))
  done
  echo "board push FAILED (kept locally in .collab)" >&2; return 1
}

cmd="${1:-read}"; shift || true
case "$cmd" in
  sync) sync; echo "board synced: $(git -C "$WT" log -1 --format='%h %s')" ;;
  read)
    sync; n="${1:-30}"
    echo "=== STATUS ==="; for f in "$WT"/status/*.md; do head -n 3 "$f" | sed 's/^/  /'; done
    echo "=== TASKS (open/claimed) ==="; grep -E '^\| *[A-Z]-[0-9]+' "$WT/TASKS.md" | grep -v '| done' | head -n 60
    echo "=== LAST $n MESSAGES ==="; tail -n "$n" "$WT/MESSAGES.md" ;;
  post)
    [ $# -ge 3 ] || { echo "usage: post FROM TO msg"; exit 2; }
    sync; echo "- [$(now)] **$1 → $2**: $3" >> "$WT/MESSAGES.md"; commit_push "msg $1->$2" && echo posted ;;
  status)
    sync; f="$WT/status/$1.md"; touch "$f"
    rest="$(tail -n +4 "$f" 2>/dev/null)"
    { echo "# Agent $1"; echo "**$(now)** — $2"; echo; echo "$rest"; } > "$f.tmp" && mv "$f.tmp" "$f"
    echo "- [$(now)] $2" >> "$f"
    commit_push "status $1" && echo "status updated" ;;
  claim|done)
    sync; id="$2"
    if ! grep -qE "^\| *$id *\|" "$WT/TASKS.md"; then echo "no such task $id"; exit 1; fi
    python3 - "$WT/TASKS.md" "$id" "$1" "$cmd" "$(now)" << 'PY'
import sys,re
p,id,ag,cmd,ts=sys.argv[1:]
L=open(p,encoding='utf8').read().split('\n')
for i,l in enumerate(L):
    if re.match(r'^\| *'+re.escape(id)+r' *\|',l):
        c=[x.strip() for x in l.strip().strip('|').split('|')]
        c[-2]= ag
        c[-1]= ('claimed '+ts) if cmd=='claim' else ('done '+ts)
        L[i]='| '+' | '.join(c)+' |'
open(p,'w',encoding='utf8').write('\n'.join(L))
PY
    echo "- [$(now)] **$1 → ALL**: $cmd $id" >> "$WT/MESSAGES.md"
    commit_push "$cmd $id by $1" && echo "$cmd $id ok" ;;
  error)
    sync; printf '\n### [%s] (%s) %s\n- 解決策: %s\n' "$(now)" "$1" "$2" "$3" >> "$WT/ENV_ERRORS.md"; commit_push "env error by $1" && echo logged ;;
  tip)
    sync; printf -- '- [%s] (%s) %s\n' "$(now)" "$1" "$2" >> "$WT/TIPS.md"; commit_push "tip by $1" && echo logged ;;
  edit) ensure; echo "worktree: $WT  (edit, then: tools/board.sh push 'msg')" ;;
  push) commit_push "${1:-board edit}" && echo pushed ;;
  watch)
    s="${1:-60}"; sync; last=$(wc -l < "$WT/MESSAGES.md")
    while true; do sleep "$s"; sync; cur=$(wc -l < "$WT/MESSAGES.md"); [ "$cur" -gt "$last" ] && tail -n $((cur-last)) "$WT/MESSAGES.md"; last=$cur; done ;;
  *) sed -n 2,22p "$0" ;;
esac
