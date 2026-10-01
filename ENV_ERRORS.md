# 開発環境で実際に起きたエラーと解決策（全員追記・最終的に docs/DEV_ENV_ERRORS.md に集約）

書式: `tools/board.sh error <AGENT> "症状（エラーメッセージそのまま）" "解決策"`
**この制作物固有のバグではなく、開発環境（サンドボックス・ツール・git・ブラウザ・ネットワーク等）の問題** を書く。

### [2026-10-01 10:24Z] (A) Playwright の Chromium が起動しない: `error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file`
- 解決策: `pip install playwright && python3 -m playwright install chromium` の後に **`sudo python3 -m playwright install-deps chromium`**（apt で依存ライブラリを入れる。約 15 秒）。

### [2026-10-01 10:25Z] (A) `python3 -c "import playwright"` → `ModuleNotFoundError`（初期状態ではブラウザも Playwright も無い）
- 解決策: `pip install playwright` → `python3 -m playwright install chromium`（約 20 秒, 114MB）。キャッシュは `~/.cache/ms-playwright`。

### [2026-10-01 10:26Z] (A) SwiftShader（CPU WebGL）でのスクショが非常に遅い（ホーム 25 秒・2.3fps、ギャラリー 42 秒）
- 解決策: 起動引数 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。`tools/shot.py` の `--wait` を長め（4000〜8000ms）に。GPU は無いので fps はあくまで相対比較用。同時に複数の Playwright を走らせない（1GB RAM）。

### [2026-10-01 10:28Z] (A) 自作 autosave デーモンが 2 回目以降ずっと `skip: another cycle running`
- 原因: `exec 9>lock; flock -n 9` をループと同じシェルで実行 → fd 9 がロックを保持したまま。しかも `sleep` などの子プロセスが fd 9 を継承し、デーモンを kill してもロックが残った。
- 解決策: サイクルを `( cycle )` のサブシェルで実行し、子プロセスには `9>&-` で fd を渡さない。`fuser` が無いので `/proc/*/fd` を grep して保持プロセスを特定・kill。

### [2026-10-01 10:29Z] (A) `gh pr view <branch>` が **マージ済みの古い PR** を返し、新しい PR を作らない
- 解決策: `gh pr list --head <branch> --state open --json number -q length` で「オープンな PR の数」を見る。

### [2026-10-01 10:22Z] (A) リモートの作業ブランチに `__pycache__/*.pyc` がコミットされていた
- 解決策: `git rm -r --cached docs/debug/__pycache__` ＋ `.gitignore` に `__pycache__/` `*.pyc` を追加。

### [2026-10-01 10:24Z] (A) Bash ツールで `for u in https://...?a=b&c=d` のように URL をクォートしないと `syntax error near unexpected token '&'`
- 解決策: URL は必ず `"..."` で囲む。

### [2026-10-01 10:35:55Z] (C) worktree で ln -s ../../node_modules node_modules すると .gitignore の 'node_modules/'（末尾スラッシュ=ディレクトリのみ）にマッチせず、シンボリックリンクが untracked になり autosave がコミットしてしまう
- 解決策: 共通の $(git rev-parse --git-common-dir)/info/exclude に 'node_modules' を追記（C が実施済み・全 worktree に効く）。A は .gitignore を 'node_modules' に変更推奨

### [2026-10-01 10:39:03Z] (D) 共有サンドボックス(1GB)で B/C/D の vite dev 3本(各120-190MB)+Playwright+vite build 同時実行で空きメモリ18MB・swap枯渇、コマンドが18秒かかる。また pkill -f 'port 5176' は Bash ツール自身のシェル(コマンド文字列に一致)も殺して exit -1 になる
- 解決策: dev サーバーは撮影時のみ起動→即 kill。pkill/pgrep は 'port 517[6]' のように [] を入れて自分自身にマッチさせない。重い処理は flock /tmp/omoro-heavy.lock <cmd> で直列化

### [2026-10-01 10:39:10Z] (B) Playwright goto 'Timeout 60000ms exceeded'（4 エージェントが同時に vite dev ×4 + chromium を起動 → MemAvailable 0MB, load avg 9）
- 解決策: flock /tmp/omoro-pw.lock で Playwright を直列化、vite dev は撮影時のみ起動して終わったら kill。ps aux --sort=-rss で確認

### [2026-10-01 10:39:17Z] (C) メモリ枯渇: free=979/985MB, swap 127/127 使用。vite dev ×3(各 ~200MB RSS)+ vite build + Playwright Chromium が同時に走り、tools/shot.py が 120 秒でタイムアウト
- 解決策: 各自 vite dev を常駐させない。C は『npx vite build --outDir .build (自 worktree)』→『python3 -m http.server 4175 -d .build』(RSS 約 15MB) で撮影する方式に切替。Playwright は撮影時のみ・同時 1 本。

### [2026-10-01 10:40:39Z] (A) `pkill -f "vite preview"` を Bash ツールで実行したら自分自身のシェル（コマンドラインに同じ文字列を含む）まで kill され、exit code -1・出力なしで終了
- 解決策: パターンの先頭 1 文字を [] で囲む（`pkill -f "[v]ite preview"`）か、ポート番号まで含めて一意にする。`pgrep -af` で事前確認。
