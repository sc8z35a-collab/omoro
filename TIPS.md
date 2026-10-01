# 細部作成のコツ（リーダー A 記述 ＋ 全員追記）

追記は `tools/board.sh tip <AGENT> "..."`（このファイル末尾に追記されます）。

## 0. 心構え
- **「超超高グラフィック」＝ 情報量 × 質感 × 光 × 動きの減衰。** 粒子を増やすだけでは安っぽい。
  光源の色温度差、接地影、微細なノイズ、イージングの余韻を全部入れて初めて「高い」と感じる。
- **性能制約は無視してよい（開発者許可済み）。** ただし壊れないこと：WebGL 不可・reduced-motion・モバイル幅でも
  レイアウトが崩れずに読めること。`?q=low` で軽量化できるスイッチは残す（撮影用）。
- **毎セクション、スクショを撮って自分の目で見る**（`python3 tools/shot.py /path --w 1440 --h 900`、Read ツールで PNG を開く）。
  コードを見て「たぶん綺麗」は禁止。

## 1. three.js（r186）での画質の底上げ
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`（または `AgXToneMapping`）、`toneMappingExposure` で露出調整。
  EffectComposer 使用時はトーンマップは **OutputPass** が掛ける。RenderPass 直後に bloom → 最後に OutputPass。
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` → 今回は **上限 2〜3 でよい**（性能無視）。
- **HDRI 環境マップ**が質感の 8 割。Poly Haven（CC0）：`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<name>_1k.hdr`
  を `site/public/hdr/` に置き、`RGBELoader`/`HDRLoader` → `PMREMGenerator.fromEquirectangular`。
  おすすめ：`studio_small_09`, `brown_photostudio_02`, `moonless_golf`, `dancing_hall`, `neon_photostudio`, `royal_esplanade`。
- `MeshPhysicalMaterial`：`transmission:1, thickness, ior:1.5, roughness:.05, clearcoat:1, iridescence:1, iridescenceIOR:1.3,
  sheen`、`attenuationColor`。ガラスは背景が無いと黒く見える → 必ず envMap と背後に光源 or 発光体を置く。
- **影**：`renderer.shadowMap.type = THREE.VSMShadowMap`（柔らかい）＋ `light.shadow.mapSize = 4096`。接地影は ContactShadows 的に
  「下から正射影カメラで深度→ぼかし」でも可。安価で効果大なのは床に放射グラデのブロブ影（`MeshBasicMaterial` + `alphaMap`）。
- **ポスト**（`three/examples/jsm/postprocessing/`）：`UnrealBloomPass`, `GTAOPass`（AO）, `BokehPass`（DOF）, `SMAAPass`,
  `AfterimagePass`, `FilmPass`, `OutlinePass`, `SSRPass`, `ShaderPass` + `RGBShiftShader` / `VignetteShader`。
  最終段に自作 `ShaderPass`（色収差 + フィルムグレイン + ビネット + 微ハレーション）を入れると一気に映画っぽくなる。
- **Bloom はしきい値高め（0.8〜0.9）＋ 発光体の色を 1.0 超え（`color.multiplyScalar(4)`）** にすると、光るものだけ光って白飛びしない。
- **GPGPU 粒子**：`three/examples/jsm/misc/GPUComputationRenderer.js`。位置/速度テクスチャを ping-pong、
  カールノイズで流体的な動き。256×256=65k、512×512=262k 粒。描画は `Points` の `position` 属性に UV を入れ、vertex で texture2D 参照。
- **ボリュメトリックライト**：①加算コーンを 3〜6 層、ノイズでゆらぎ ②スクリーン空間ゴッドレイ（光源位置から放射ブラー）
  ③本気ならレイマーチ（フォグ密度×シャドウマップ）。①＋②で十分高見え。
- **ノイズ**：シェーダーには `simplex3d` / `curl noise` / `fbm` を自前で貼る（three に付属しない）。ハッシュは `fract(sin())` より
  `pcg` や `hash12`（Dave Hoskins）のほうが縞が出ない。
- **カラー**：テクスチャは `tex.colorSpace = THREE.SRGBColorSpace`。データ（ノーマル/ラフネス）は `NoColorSpace`。
  CanvasTexture も sRGB 指定を忘れると白っぽくなる。
- **anisotropy** は `renderer.capabilities.getMaxAnisotropy()`、ミップマップ有効、`generateMipmaps` を確認。
- フォント入りの CanvasTexture は `document.fonts.load()` を待ってから描く（`ensureFonts()` 済み）。2048px 以上で描けばにじまない。

## 2. CSS / DOM の細部
- **イージング**：出は `cubic-bezier(.19,1,.22,1)`（expo.out）、入退場は `(.77,0,.175,1)`。全部同じ duration にしない。
  stagger は 0.02〜0.06s。ホバーの戻りは行きより遅く（0.6〜0.9s）。
- **光の層**：ボタン・カードに ①内側ハイライト（`inset 0 1px 0 rgba(255,255,255,.08)`）②外側グロー（アクセント色の大きくぼけた box-shadow）
  ③ノイズ（`url(noise.png)` を `mix-blend-mode: overlay`）を重ねる。
- **ホロ/箔**：`conic-gradient` + `repeating-linear-gradient` を `mix-blend-mode: color-dodge`、`background-position` をポインタで動かす。
  さらに `filter: url(#svg-turbulence)` で微細なゆらぎ。
- **文字**：見出しは `font-feature-settings: "palt"`（日本語のプロポーショナル詰め）。`text-wrap: balance`。
  巨大文字は `-webkit-text-stroke` のアウトライン ＋ 塗りのレイヤー重ね、`letter-spacing` を負に。
- **`backdrop-filter: blur() saturate()`** のガラス面には 1px の明るい境界線と、上辺だけ少し明るいグラデを。
- **マイクロインタラクション**：押下時 `scale(.96)`、離した時 elastic、キーボードフォーカス時にも同等のリング。音（後述）。
- **Variable font / font-display**：Google Fonts は `display=swap`。CanvasTexture に使うフォントはロード完了を待つ。

## 3. 動き
- GSAP の `quickTo()` でポインタ追従（毎フレーム tween 生成しない）。`gsap.ticker` に乗せて Lenis と同期。
- ScrollTrigger の pin は **1 ページに 3 つまで**。pin 内の画像は読み込み後 `ScrollTrigger.refresh()`。
- **`transform` の取り合い**に注意：GSAP が inline transform を書くと CSS の `transform: rotateX(var(--rx))` が消える
  （既知バグ #26/#27/#48 の原因）。→ 傾き用の **内側ラッパー要素** を作り、GSAP は外側、tilt は内側に掛ける。
- reduced-motion：`gsap.matchMedia()` の `(prefers-reduced-motion: no-preference)` 条件内でアニメを登録すると自動で外れる。

## 4. 音（任意だが効く）
- `audio_generation`（elevenlabs/sound-effects）でクリック音・ホバー音・ワープ音を作成可能。WebAudio で再生、
  **初回ユーザー操作まで鳴らさない**、音量 0.15 程度、ミュートトグル必須（`store.pref("sound")`）。

## 5. 素材の探し方（ライセンス安全）
- 写真：`image_search` ツール（CC フィルタ内蔵）、Wikimedia Commons、PxHere（CC0）、Public Domain Pictures。
- HDRI / PBR テクスチャ / 3D モデル：Poly Haven（CC0, API: `https://api.polyhaven.com/assets?t=hdris|textures|models`,
  ファイル: `https://api.polyhaven.com/files/<id>`）、ambientCG（CC0, `https://ambientcg.com/api/v2/full_json?q=...`）。
- 3D モデル（glTF）：Poly Haven models、Khronos glTF-Sample-Assets（ライセンス個別確認）、three.js examples/models（MIT/各種）。
- 見つからない場合は `image_generation` で生成（オリジナル）。**Getty/Shutterstock/Adobe Stock 等の画像は使用禁止。**
- 画像は `sharp` で webp（quality 76〜82）、`-sm` 版（800px）も作る。

## 6. 検証
- `python3 tools/shot.py / --w 1440 --h 900` / `--mobile` / `--reduced` / `?nogl` の 4 パターンを最低限撮る。
- SwiftShader（CPU WebGL）は遅い：1 枚 20〜40 秒。`--wait` を長めに、`?q=low` で軽量化して構図確認 → 最後に ultra で 1 枚。
- コンソールに `[pageerror]` が出たら必ず直す。
# TIPS appended below (by board.sh)
- [2026-10-01 10:50:00Z] (A) HDRI(PolyHaven studio)を environment に入れると金属/ガラスが一気に「本物」になるが、暗い背景のサイトでは scene.environmentIntensity を .3〜.5 に。1.0 のままだと反射が bloom 閾値を超えて全体が白く霞む（fx テストで実測）。
