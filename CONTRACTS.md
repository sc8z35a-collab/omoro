# ファイル所有権と API 契約（衝突防止）

**原則：自分の担当ファイル以外は編集しない。** 他担当のファイルに変更が必要なときは `MESSAGES.md` で担当者に依頼する
（緊急・数行ならば「〇〇を△△に変えた」と post してから編集してよい）。

| 担当 | ブランチ | 所有ファイル（編集可） |
|---|---|---|
| **A (リーダー)** | `genspark_ai_developer`（統合ブランチ。B/C/D の PR はここへ） | `site/src/js/core/*`, `site/src/js/ui/*`, `site/src/css/base.css`, `site/partials/*`, `site/src/js/gl/fx/*`（共通GL基盤・新規）, `site/credits/`, `site/404.html`, `site/src/js/pages/simple.js`, `site/src/css/simple.css`, `vite.config.js`, `package.json`, `scripts/publish-root.mjs`, `scripts/og.mjs`, `README.md`, `docs/*`, `tools/*` |
| **B (ホーム)** | `agent/B` | `site/index.html`, `site/src/js/pages/home.js`, `site/src/css/home.css`, `site/src/js/gl/heroScene.js`, 新規 `site/src/js/gl/home/*` |
| **C (3Dギャラリー)** | `agent/C` | `site/gallery/index.html`, `site/src/js/pages/gallery.js`, `site/src/css/gallery.css`, `site/src/js/gl/galleryScene.js`, `site/src/js/gl/cardTexture.js`, 新規 `site/src/js/gl/gallery/*` |
| **D (特設ページ＋Lab)** | `agent/D` | `scripts/build-pages.mjs`, `site/src/js/pages/detail.js`, `site/src/css/detail.css`, `site/src/js/gl/rippleImage.js`, `site/lab/index.html`, `site/src/js/pages/lab.js`, `site/src/css/lab.css`, 新規 `site/src/js/gl/detail/*`, `site/src/js/gl/lab/*` |

### 共有リソースのルール
- **画像・HDRI・テクスチャ・モデル**：`site/public/img/<担当小文字>-*.webp`、`site/public/hdr/*`、`site/public/tex/*`、`site/public/models/*` に置く。
  ファイル名の先頭に担当プレフィクス（`b-` `c-` `d-`）を付ければ衝突しない。共通で使いたいもの（HDRI 等）は A に依頼 or `shared-` プレフィクス。
- **クレジット**：新しい外部素材を入れたら `ASSETS` 節（この下）に 1 行追記 → A が `site/credits/index.html` に反映。
- **npm 依存の追加**：`package.json` は A 所有。追加したいライブラリは MESSAGES で依頼。（急ぎなら `npm i x` して post。A がマージ時に解決）
- **data/moments.json**：読み取り専用（フィールド追加が必要なら A に依頼）。
- **重い単一画像は 600KB 以下**（webp/avif 推奨）。HDRI は 1k〜2k `.hdr`（〜6MB まで可）。

### 共通 GL 基盤 API（A が `site/src/js/gl/fx/` に提供）
```js
import { createRenderer, quality, loadEnv, makeComposer, UltraFinalPass } from "../gl/fx/index.js";
const renderer = createRenderer(canvas, { alpha:false });           // ACES, sRGB, 高 DPR, shadows on, physicallyCorrect
const env = await loadEnv(renderer, "studio");                        // Poly Haven HDRI → PMREM（"studio" | "night" | "neon"）。失敗時 RoomEnvironment
const fx = makeComposer(renderer, scene, camera, { bloom:{strength,radius,threshold}, dof:{focus,aperture,maxblur}, gtao:true, smaa:true, final:{ca:.0015, grain:.06, vignette:.35} });
fx.render(dt); fx.setSize(w,h);                                       // fx.passes.bloom 等にアクセス可
quality.tier  // "ultra"（既定） | "high" | "low"（URL ?q=low で強制。SwiftShader 撮影の高速化用）
```

## ASSETS（外部素材の登録簿：誰でも追記）
| ファイル | 出典 URL | ライセンス | 追加者 |
|---|---|---|---|
| （既存）img/m01〜m06, stage-*, confetti 等 | `site/credits/index.html` 参照 | CC0 / PD | — |
