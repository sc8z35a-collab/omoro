# TASKS

状態の更新は `tools/board.sh claim <AGENT> <ID>` / `tools/board.sh done <AGENT> <ID>`（最後の 2 列が自動で書き換わる）。
タスクを追加したいときは `tools/board.sh edit` → `.collab/TASKS.md` に行を足す → `tools/board.sh push "add task"`。

**ゴール：既存グラフィックを「機種性能無視の超超高グラフィック」へ。細部（マイクロインタラクション・質感・光・タイポ・音）を徹底的に作り込む。**
各自、担当範囲の `docs/BUG_REPORT.md` の既知バグも直すこと（番号は BUG_REPORT のもの）。

| ID | 内容 | 想定担当 | 担当 | 状態 |
|---|---|---|---|---|
| A-1 | 自動保存システム（tools/autosave.sh・hooks・bootstrap）設計と稼働 | A | A | done 2026-10-01 10:30:11Z |
| A-2 | 共有ネットワーク（collab ブランチ・board.sh・各種 md）構築 | A | A | claimed 2026-10-01 10:35:00Z |
| A-3 | 共通 GL 基盤 `site/src/js/gl/fx/`（renderer/HDRI/composer/UltraFinalPass/quality） | A | - | open |
| A-4 | 共通 chrome の超高品質化：WebGL カーソル残像 or 流体、ページ遷移を GL シェーダーに、ローダー刷新、grain を GL ノイズに | A | - | open |
| A-5 | 共通 UI バグ修正 BUG #1〜#18, #64, #65（chrome.js / base.css / partials） | A | - | open |
| A-6 | credits 更新・README・統合・publish・最終 PR | A | - | open |
| A-7 | 全エージェントの環境エラー集 `docs/DEV_ENV_ERRORS.md` ＋ 次のエージェントへの技術アドバイス `docs/NEXT_AGENT_GUIDE.md` | A | - | open |
| B-1 | ヒーロー：GPGPU パーティクル（GPUComputationRenderer, 100k〜260k 粒）＋カールノイズ流体、文字モーフ | B | B | claimed 2026-10-01 10:35:23Z |
| B-2 | ヒーロー：ボリュメトリック・スポットライト（レイマーチ or 多層コーン）＋ゴッドレイ、HDRI 反射床（MeshReflector/SSR風）、DOF、色収差 | B | B | claimed 2026-10-01 10:35:39Z |
| B-3 | ホーム各セクションの細部：ホロカードを WebGL 化 or CSS ホロ強化、ステージプレイヤーの GL トランジション、チェーンマップ・温度チャートの発光とマイクロアニメ | B | B | claimed 2026-10-01 10:35:43Z |
| B-4 | ホームの既知バグ BUG #19〜#41 | B | B | claimed 2026-10-01 10:35:45Z |
| C-1 | ギャラリー：HDRI 環境・MeshPhysical（transmission/clearcoat/iridescence）で本物のガラス額縁＋金属フレーム、SoftShadows/接地影 | C | C | claimed 2026-10-01 10:35:30Z |
| C-2 | ギャラリー：舞台美術（GLTF/プロシージャル：提灯・スポット・幕・床の濡れ反射）、ボリュメトリックライト、GTAO、DOF（フォーカス中のカードに合焦）、SMAA | C | C | claimed 2026-10-01 10:35:32Z |
| C-3 | ギャラリー：カードシェーダー刷新（視差マッピング・ホログラム箔・スペキュラ）、カメラワーク（慣性・ズーム・シネマティック intro） | C | C | claimed 2026-10-01 10:35:35Z |
| C-4 | ギャラリーの既知バグ BUG #42〜#46 | C | C | claimed 2026-10-01 10:35:37Z |
| D-1 | 特設ページヒーロー：rippleImage を流体シミュレーション（Navier–Stokes, pingpong FBO）＋RGB シフト＋ディスプレイスメントへ | D | D | claimed 2026-10-01 10:36:08Z |
| D-2 | 特設ページの細部：ビートの GL/CSS 演出、insight カード、反応ボタンのパーティクル（WebGL）、次へ遷移 | D | D | claimed 2026-10-01 10:36:26Z |
| D-3 | Lab の細部：リールの 3D 強化、クイズ演出、カードメーカーの高解像度・新テーマ（箔押し/ホロ）、距離シミュの 3D 化、間チャレンジの演出 | D | D | claimed 2026-10-01 10:36:28Z |
| D-4 | 特設＋Lab の既知バグ BUG #47〜#63 | D | D | claimed 2026-10-01 10:36:30Z |
