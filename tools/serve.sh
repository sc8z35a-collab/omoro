#!/usr/bin/env bash
# Low-memory preview: build under the global heavy lock, then serve .build/ with python (≈15MB instead of vite dev ≈200MB).
#   tools/serve.sh <port>         # build + (re)start static server on <port>   (A=4173 B=4174 C=4175 D=4176)
#   tools/serve.sh <port> nobuild # just (re)start the server
#   tools/serve.sh stop <port>
set -u
cd "$(dirname "$0")/.."
if [ "${1:-}" = stop ]; then pkill -f "[h]ttp.server ${2} " ; exit 0; fi
PORT="${1:?port}"
if [ "${2:-}" != nobuild ]; then
  flock /tmp/omoro-heavy.lock npm run -s build >/tmp/omoro-build-$PORT.log 2>&1 || { tail -30 /tmp/omoro-build-$PORT.log; exit 1; }
  grep -E "built in" /tmp/omoro-build-$PORT.log
fi
pkill -f "[h]ttp.server $PORT " 2>/dev/null
(cd .build && setsid nohup python3 -m http.server $PORT --bind 0.0.0.0 >/tmp/omoro-serve-$PORT.log 2>&1 &)
sleep 0.5; echo "serving $(pwd)/.build on http://localhost:$PORT"
