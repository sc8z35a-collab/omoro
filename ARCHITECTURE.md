# 既存コード全文把握メモ（A が全ファイルを読んで作成 / base = genspark_ai_developer @ 024dd7d + tools）

総量 ≈ 4,900 行。Vite 8 + three 0.186 + GSAP 3.15 + Lenis。MPA（複数 HTML）。

## ビルドの仕組み
- `vite.config.js` … root=`site/`, outDir=`.build/`。`site/` 配下の全 `*.html` を自動で rollup input にする（`public/src/partials` は除外）。
  - 独自プラグイン `partials()`：`<!--#include name -->` を `site/partials/name.html` で置換（3段ネスト可）、`{{base}}` を BASE に置換、`data-nav="x"` に `aria-current` 付与。
  - partials を編集したら HMR でなく full-reload。
- `npm run dev` = `pages`（`scripts/build-pages.mjs` が `data/moments.json` → `site/moments/<slug>/index.html` ×6 を生成）＋ vite dev :5173
- `npm run build` → `.build/`（BASE=/）。`npm run build:gh` → BASE=/omoro/（GitHub Pages 用）。
- `npm run publish` → build:gh の成果物をリポジトリ直下へコピー（`.published.json` で管理）。**main マージ前に A が実行**。各エージェントは実行しない（ルート直下の index.html/assets/ が衝突するため）。
- `site/moments/` は **生成物で gitignore**。詳細ページの HTML を変えたいときは `scripts/build-pages.mjs` を編集。
- 画像は `site/public/img/*.webp`（本体 1600×1100 と `-sm` 800×560）。`scripts/process-images.mjs` が `.raw/*.jpg`→webp（.raw は gitignore）。

## データ
- `data/moments.json`：6 件。`slug number title lines[] short speaker accent lead context point beats[3]{label,title,body} insights[2] image en volume gap tags[] glyph`
- `site/src/js/core/data.js`：`moments, url(), momentUrl(), img(name, small), bySlug, speakerOf, normalize, search(q)`

## 共通（site/src/js/core, ui, css/base.css, partials）
- `env.js`：`reduced, coarse, isMobile(), webglOK(), lerp, clamp, qs, qsa, h(tag, attrs, ...children)`（`h` は `--var` 属性で CSS 変数、`onX` でリスナ）
- `store.js`：localStorage（saved / reactions / seen / prefs）。`store.on(fn)` で変更通知。
- `chrome.js`：`initChrome()` が Lenis 慣性スクロール・ヘッダー・カスタムカーソル・メニュー・⌘K パレット・`?` ヘルプ・ページ遷移カーテン・フッター・marquee・magnetic・ローダーを初期化。
  export: `gsap, ScrollTrigger, lenis, toast, magnetic, splitChars, initReveals, initMarquees, scrollToTop, openPalette, preloadImages`
  - ローダーは sessionStorage `omoro-loaded` で 1 セッション 1 回。完了で `html.is-loaded` + `omoro:ready` イベント。
  - `initReveals()`：`[data-reveal]`（gsap で opacity/y）、`[data-split]`（文字分割）、`[data-parallax]`、`[data-count]`
- `tilt.js`：ポインタで `--rx --ry --mx --my` を設定（CSS 側で transform に使う）。**既知バグ：gsap が inline transform を書くと CSS の rotate が消える（#26,#27,#48）**
- `partials/`：head（フォント: Dela Gothic One / Zen Kaku Gothic New / Space Grotesk / JetBrains Mono）、chrome（カーソル・カーテン・ヘッダー・メニュー・パレット・トースト）、loader、footer
- `css/base.css`：トークン（`--ink #0b0c0d --paper #eef0e8 --acid #d8ff4f --purple --coral --pink --sky --gold`、`--f-display` 等、`--ease`）、ボタン、marquee、セクション共通、フッター、grain

## ページ
| ページ | HTML | JS | CSS | GL |
|---|---|---|---|---|
| ホーム | `site/index.html` | `pages/home.js` (309行) | `home.css` (288行) | `gl/heroScene.js` (329行) |
| 3D ギャラリー | `site/gallery/index.html` | `pages/gallery.js` | `gallery.css` | `gl/galleryScene.js` (261行) |
| 特設 ×6 | `scripts/build-pages.mjs` が生成 | `pages/detail.js` | `detail.css` | `gl/rippleImage.js` (77行) |
| Lab | `site/lab/index.html` | `pages/lab.js` (364行) | `lab.css` | なし（2D canvas: カードメーカー・距離シミュ） |
| credits / 404 | `site/credits/`, `site/404.html` | `pages/simple.js` | `simple.css` | なし |

### heroScene.js（ホーム）
- 14,000 粒子が `sampleText()`（2D canvas に文字を描いてピクセルをサンプル）で作った点群へモーフ。`aFrom/aTo/aRand` 属性、`uMix` を gsap で 0→1。
- マウス反発（z=0 平面への unproject）、スクロールで `uScatter` 拡散＋カメラドリー。
- 加算ブレンドのスポットライト円錐 ×3（フレネル）、グリッド床（fwidth）、ダスト 1,400 粒、背景にカード 6 枚（`cardTexture.momentCanvas`）がリング状。
- EffectComposer: RenderPass → UnrealBloom → OutputPass。`IntersectionObserver` で画面外は描画停止。
- `show(i)`, `showIntro()`, `setScroll(p)`。home.js がチップと 5.2s 自動送りを制御。

### galleryScene.js（ギャラリー）
- 6 枚のカード（ShaderMaterial：ホロ sweep, fresnel, エッジ発光、移動時 bend）＋ガラス背板 (MeshPhysical)＋カード毎 PointLight。
- `Reflector` 鏡面床＋加算グリッド、ネオンアーチ（Torus 半円）×14、ダスト。RoomEnvironment を PMREM。
- レイアウト ring/helix/wall、ドラッグ回転・ホイール・raycast hover・クリック focus→2 回目で遷移。
- Bloom 0.45。callbacks: onHover/onFocus/onLayout/onOpen。

### rippleImage.js（特設ヒーロー）
- フルスクリーン quad。写真に cover UV、ポインタ中心の波紋 + RGB ずれ + 微ウェーブ、アクセント色ミックス。

### cardTexture.js
- `ensureFonts()`, `loadImage()`, `coverDraw()`, `momentCanvas(m, {width,height,small})`：写真＋デュオトーン＋巨大ゴースト番号＋セリフ＋枠を 2D canvas に描く（GL テクスチャ用）。

## 既知バグ一覧
- `docs/BUG_REPORT.md` に **65 件**（A 共通 18 / B ホーム 23 / C ギャラリー 5 / D 特設 3 / E Lab 14 / F ビルド 2）。担当範囲のバグは各自で直すこと。
- 再現スクリプト `docs/debug/*.py`（旧ハーネス）。新ハーネスは `tools/shot.py`。

## 注意点（ハマりどころ）
- `[data-reveal]` は CSS で opacity:0。JS が死ぬと見えなくなる → コンソールエラーは必ず確認。
- `home.js` の横スクロールは `gsap.matchMedia("(min-width: 861px)")` で pin。ScrollTrigger の refresh 順序に注意（画像読み込み後 `ScrollTrigger.refresh()`）。
- three r186：`THREE.Timer`（Clock は非推奨）、`renderer.outputColorSpace` は既定 sRGB、`OutputPass` がトーンマップと色空間変換を担当（RenderPass 直後に tone mapping されない）。
- `three/examples/jsm/...` から import（`three/addons/...` も可）。
- base.css の `url("/img/noise.png")` は Vite が base を付けて書き換える。
