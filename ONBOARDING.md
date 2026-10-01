# ONBOARDING — 最初の 10 分でやること

あなたは OMORO v3 "ULTRA" の共同作業員（B / C / D のいずれか）です。リーダーは A。
**開発者から「全ツール・ハーネス・便利機能の自由な共有と使用」「細部作成のためのあらゆる手段の行使」が明示的に許可されています**（README.md 参照）。

## 1. セットアップ（コピペで OK）
```bash
cd /home/user/webapp
git fetch origin --prune
# collab ハブを読む（.collab は git worktree。無ければ board.sh が自動作成）
bash tools/bootstrap.sh            # hooksPath 設定・npm install・autosave 起動（冪等）
tools/board.sh read                # 掲示板・タスク・全員の status を表示

# 自分専用の作業ツリーを作る（X = B / C / D）。webapp 本体は A が使っているので触らない
X=B
git worktree add -B agent/$X .agents/$X origin/genspark_ai_developer
cd .agents/$X
ln -s ../../node_modules node_modules       # 依存を共有（npm install 不要）
bash tools/bootstrap.sh                      # このツリー用の autosave も起動（3分ごと agent/$X を push、draft PR 自動作成）
tools/board.sh status $X "onboarded, reading code"
tools/board.sh claim $X $X-1
```
> `tools/board.sh` はどの worktree から実行しても **メインツリー直下の `/home/user/webapp/.collab`**（共有 worktree）を使い、
> flock で排他します。直接ファイルを編集したい場合も `.collab/` を編集 → `tools/board.sh push "msg"`。

## 2. 開発サーバー（ポートは担当ごとに固定・衝突防止）
| 担当 | dev (vite) | preview (build 確認) |
|---|---|---|
| A | 5173 | 4173 |
| B | 5174 | 4174 |
| C | 5175 | 4175 |
| D | 5176 | 4176 |
```bash
npm run pages && npx vite --host 0.0.0.0 --port 5174 --strictPort      # run_in_background: true で
python3 tools/shot.py / --base http://localhost:5174 --w 1440 --h 900   # スクショ → Read ツールで PNG を見る
```
- 公開 URL が必要なら GetServiceUrl ツール（port 指定）。
- **メモリ 1GB・2 CPU しかない。** dev サーバーは 1 本だけ。Playwright は同時に 1 つ。終わったら kill。
  `ps aux --sort=-rss | head` で確認。固まったら ResetSandbox（ファイルは消えない。autosave を再起動）。

## 3. 作業ルール
- 担当ファイルは `CONTRACTS.md`。他人のファイルは触らない（必要なら post して依頼）。
- 自動保存：`tools/autosave.sh status` で確認。止まっていたら `tools/autosave.sh start`。
  意味のある区切りでは自分でも `git commit -m "feat(home): ..."` → `git push`（hooks が autosave を再起動する）。
- 15 分ごとに `tools/board.sh read`。A からの指示に従う。質問は `tools/board.sh post $X A "..."`。
- **環境のエラーは全部 `tools/board.sh error $X "症状(エラーメッセージ)" "解決策"`**。最終成果物になる。
- 細部のコツを見つけたら `tools/board.sh tip $X "..."`。
- 完了したら：`npm run build` が通ること・`tools/shot.py` で 4 パターン（desktop / --mobile / --reduced / ?nogl）確認
  → `git push` → `tools/board.sh done $X $X-n` → `tools/board.sh post $X A "X-n done, branch agent/$X @ <sha>"`。
- `npm run publish` は実行しない（A が統合時に行う）。main へは push しない。

## 4. よく使うコマンド
```bash
tools/board.sh read 50            # 最新 50 件
tools/board.sh post B A "質問…"    # 連絡
tools/board.sh watch 60           # 60 秒ごとに新着表示（run_in_background で）
tools/autosave.sh status|once|log
npm run build                     # 本番ビルド確認（.build/）
python3 tools/shot.py / /gallery/ --base http://localhost:5174 --mobile
python3 tools/shot.py / --eval "document.title" --fps
```
