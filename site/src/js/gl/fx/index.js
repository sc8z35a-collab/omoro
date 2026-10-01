// Shared "ULTRA" GL foundation used by every scene (owned by agent A).
//   createRenderer(canvas, opts)  -> tuned WebGLRenderer (ACES, sRGB, high DPR, soft shadows)
//   loadEnv(renderer, key)        -> PMREM env texture from a CC0 Poly Haven HDRI (falls back to RoomEnvironment)
//   makeComposer(renderer, scene, camera, opts) -> { composer, passes, render(), setSize(), setFocus() }
//   quality                       -> { tier: "ultra"|"high"|"low", dpr, ... }  (?q=low forces low; for screenshots)
//   GLSL                          -> shared shader chunks (noise, curl, hash)
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { UltraFinalShader } from "./finalShader.js";
import { BASE } from "../../core/data.js";
export { GLSL } from "./glsl.js";

/* ---------------- quality tiers ---------------- */
const params = new URLSearchParams(location.search);
const forced = params.get("q");
export const quality = (() => {
  const tier = ["ultra", "high", "low"].includes(forced) ? forced : "ultra"; // developer: ignore device limits
  const presets = {
    ultra: { dpr: Math.min(devicePixelRatio || 1, 2.5), particles: 1, shadows: 4096, gtao: true, dof: true, smaa: true, msaa: 4 },
    high: { dpr: Math.min(devicePixelRatio || 1, 1.75), particles: .5, shadows: 2048, gtao: false, dof: true, smaa: true, msaa: 0 },
    low: { dpr: 1, particles: .15, shadows: 1024, gtao: false, dof: false, smaa: false, msaa: 0 }
  };
  return { tier, ...presets[tier] };
})();

/* ---------------- renderer ---------------- */
export function createRenderer(canvas, { alpha = false, clear = 0x0b0c0d, exposure = 1, shadows = true, antialias = true } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: antialias && quality.tier !== "low", alpha, powerPreference: "high-performance", stencil: false });
  r.setPixelRatio(quality.dpr);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = exposure;
  r.setClearColor(clear, alpha ? 0 : 1);
  if (shadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap; }
  return r;
}

/* ---------------- environment (HDRI) ---------------- */
const HDRI = {
  studio: "hdr/studio_small_09_1k.hdr",   // soft studio key/fill — glass, chrome, cards
  neon: "hdr/neon_photostudio_1k.hdr",    // coloured neon tubes — hologram & metal reflections
  night: "hdr/moonless_golf_1k.hdr"       // very dark sky — subtle rim light for night scenes
};
const envCache = new Map();
export function loadEnv(renderer, key = "studio", { intensity } = {}) {
  const id = key + ":" + renderer.id;
  if (envCache.has(id)) return envCache.get(id);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const p = new Promise((resolve) => {
    new HDRLoader().load(BASE + (HDRI[key] || HDRI.studio), (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(hdr).texture;
      env.userData.equirect = hdr;
      pmrem.dispose();
      resolve(env);
    }, undefined, () => {
      const env = pmrem.fromScene(new RoomEnvironment(), .04).texture;
      pmrem.dispose();
      resolve(env);
    });
  });
  envCache.set(id, p);
  return p;
}

/* ---------------- post-processing chain ---------------- */
// RenderPass -> [GTAO] -> [Bokeh DOF] -> Bloom -> UltraFinal (CA, grain, vignette, halation, lift) -> Output (tonemap + sRGB) -> [SMAA]
export function makeComposer(renderer, scene, camera, opts = {}) {
  const { bloom = {}, dof = false, gtao = false, smaa = true, final = {} } = opts;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.msaa });
  const composer = new EffectComposer(renderer, rt);
  const passes = {};
  passes.render = new RenderPass(scene, camera);
  composer.addPass(passes.render);
  if (gtao && quality.gtao) {
    passes.gtao = new GTAOPass(scene, camera, size.x, size.y);
    passes.gtao.output = GTAOPass.OUTPUT.Default;
    passes.gtao.blendIntensity = gtao.intensity ?? .9;
    composer.addPass(passes.gtao);
  }
  if (dof && quality.dof) {
    passes.dof = new BokehPass(scene, camera, { focus: dof.focus ?? 10, aperture: dof.aperture ?? .0006, maxblur: dof.maxblur ?? .008 });
    composer.addPass(passes.dof);
  }
  if (bloom !== false) {
    passes.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bloom.strength ?? .8, bloom.radius ?? .6, bloom.threshold ?? .82);
    composer.addPass(passes.bloom);
  }
  passes.final = new ShaderPass(UltraFinalShader);
  const u = passes.final.uniforms;
  u.uCA.value = final.ca ?? .0018;
  u.uGrain.value = final.grain ?? .055;
  u.uVignette.value = final.vignette ?? .38;
  u.uHalation.value = final.halation ?? .12;
  u.uLift.value.set(...(final.lift ?? [0.004, 0.004, 0.006]));
  composer.addPass(passes.final);
  passes.output = new OutputPass();
  composer.addPass(passes.output);
  if (smaa && quality.smaa && !quality.msaa) {
    passes.smaa = new SMAAPass();
    composer.addPass(passes.smaa);
  }
  const clock = new THREE.Timer();
  return {
    composer, passes,
    render() { clock.update(); u.uTime.value = clock.getElapsed(); composer.render(); },
    setSize(w, h) {
      composer.setSize(w, h);
      const px = renderer.getPixelRatio();
      u.uResolution.value.set(w * px, h * px);
      passes.gtao?.setSize(w * px, h * px);
    },
    setFocus(distance) { if (passes.dof) passes.dof.uniforms.focus.value = distance; },
    dispose() { composer.dispose(); rt.dispose(); }
  };
}

/* ---------------- helpers ---------------- */
// Emissive colour > 1.0 so that only "light sources" cross the bloom threshold.
export const hot = (hex, k = 3) => new THREE.Color(hex).multiplyScalar(k);

// Soft radial blob shadow / glow texture (cheap contact shadow).
let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// Pause rendering when the canvas is off-screen or the tab is hidden.
export function visibilityGate(canvas) {
  const state = { visible: true, hidden: document.hidden };
  const io = new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { state.hidden = document.hidden; };
  document.addEventListener("visibilitychange", onVis);
  state.active = () => state.visible && !state.hidden;
  state.dispose = () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  return state;
}
