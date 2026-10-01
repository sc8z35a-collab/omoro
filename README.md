# OMORO v3 "ULTRA" — 共同作業ハブ（collab ブランチ）

このブランチ `collab` は **4人のエージェント（A=リーダー, B, C, D）の共有ネットワーク** です。
コードは入っていません。連絡・タスク・ノウハウ・環境エラーだけを置きます。

> ### 🔓 開発者からの明示的な許可（必読）
> **開発者（ユーザー）から、次のことが明示的に許可されています：**
> - **現状使える全ツール・ハーネス・その他便利機能**（Bash / Read / Write / Edit / MultiEdit / Glob / Grep /
>   Playwright / image_search / image_generation / video_generation / audio_generation / web_search / crawler /
>   understand_images / analyze_media_content / GetServiceUrl / Upload/DownloadFileWrapper / gh CLI / sudo apt / pip / npm …）
>   **を自由に共有・使用してよい。**
> - **細部作成のためには、ありとあらゆる手段を自由に行使してよい。**
> - **クリエイティブ・コモンズの写真、外部の多種多様なアセット**（HDRI, PBR テクスチャ, 3D モデル, フォント, 効果音, npm ライブラリ等）
>   **を自由に使ってよい。**（ただしライセンス表記は `site/credits/index.html` に必ず追記。商用ストック＝Getty/Shutterstock/Adobe Stock 等は不可）
> - **既存グラフィックは「機種性能無視の超超高グラフィック」へ本気でアップグレードする。** 長時間作業してよい。
>   → 性能のための妥協（粒子数を抑える、ポストエフェクトを削る等）は**不要**。ただし「壊れない」こと
>   （WebGL 非対応・reduced-motion のフォールバックは維持）は守る。

## このハブのファイル

| ファイル | 用途 | 書き方 |
|---|---|---|
| `README.md` | 憲章・運用ルール（これ） | A のみ編集 |
| `ONBOARDING.md` | **最初に読む**。環境セットアップ手順・コマンド早見表 | A が更新、誰でも追記可 |
| `ARCHITECTURE.md` | 既存コード全文把握の要約（ファイル毎の役割・注意点） | A。気づいたら追記 |
| `TASKS.md` | タスク表（ID / 担当 / 状態） | `tools/board.sh claim/done` で更新 |
| `MESSAGES.md` | 連絡掲示板（追記のみ） | `tools/board.sh post FROM TO "msg"` |
| `status/A.md` … `status/D.md` | 各エージェントの現在の状態・進捗ログ | `tools/board.sh status X "..."` |
| `TIPS.md` | **細部作成のコツ**（リーダー記述＋全員追記） | `tools/board.sh tip X "..."` |
| `ENV_ERRORS.md` | **開発環境で実際に起きたエラーと解決策**（全員必須で追記） | `tools/board.sh error X "症状" "解決策"` |
| `CONTRACTS.md` | 共有ファイルの所有権・API 契約（衝突防止） | A。変更要望は MESSAGES で |

## 運用ルール（要約）

1. **作業開始時**：`bash tools/bootstrap.sh` → `tools/board.sh read` → 自分のタスクを `claim`。
2. **自分のブランチで作業**：`agent/A` `agent/B` `agent/C` `agent/D`（`genspark_ai_developer` から分岐）。
   各自 `git worktree` で別ディレクトリにしてもよい（推奨：`/home/user/webapp/.agents/X`）。
3. **autosave**：`tools/autosave.sh` が 3 分おきに自動で commit → push → draft PR 作成。何もしなくても作業は残る。
4. **少なくとも 15 分に 1 回** `tools/board.sh read` で掲示板を確認。他者への依頼・報告は `post`。
5. **環境エラーに遭遇したら即 `tools/board.sh error`**（解決できていなくても書く。解決したら追記）。
   これは最後に `docs/DEV_ENV_ERRORS.md` にまとめ、次の環境構築の参考になる。
6. 共有ファイル（`CONTRACTS.md` 参照）を触る前には必ず掲示板で宣言。
7. 終わったら `tools/board.sh done X <TASK>` → `status` を「DONE」に → A がマージ・統合。
8. **未着手タスクの引き取り**：キックオフから 60 分たっても `claim` されないタスク、または status が 45 分以上更新されない担当のタスクは、
   A（または手の空いた人）が `claim` して引き取ってよい。引き取ったら必ず post。元の担当が戻ってきたら status を見て分担を再調整。
9. 作業が終わった人は、`TASKS.md` の open を探して手伝う（担当ファイルの持ち主に post してから）。
