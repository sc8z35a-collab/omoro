// Fullscreen, click-through WebGL particle layer for celebratory bursts (reactions, quiz, Lab).
// Instanced quads with physically-flavoured motion (drag, gravity, curl flutter, 3D tumbling confetti with
// two-sided metallic sheen, glowing sparks with motion-blur streaks and additive glow).
// Lazily created on the first burst; sleeps (no rAF) when nothing is alive. Canvas2D/DOM fallback lives in
// the callers when WebGL is unavailable.
import * as THREE from "three";

const MAX = 6000;
const vert = /* glsl */`
  attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec4 iMeta; // meta: born, life, size, kind
  attribute vec3 iSpin;
  uniform float uTime; uniform vec2 uRes; uniform float uDpr;
  varying vec4 vCol; varying vec2 vUv; varying float vKind, vFade, vShade;
  mat3 rot(vec3 a){
    float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
    return mat3(cy*cz, cy*sz, -sy, sx*sy*cz - cx*sz, sx*sy*sz + cx*cz, sx*cy, cx*sy*cz + sx*sz, cx*sy*sz - sx*cz, cx*cy);
  }
  void main(){
    float t = uTime - iMeta.x, life = iMeta.y, kind = iMeta.w;
    vKind = kind; vUv = uv; vCol = iCol;
    if (t < 0. || t > life) { gl_Position = vec4(2., 2., 2., 1.); return; }
    float k = kind < .5 ? 1.6 : kind < 1.5 ? 2.6 : 1.1;         // drag per kind: confetti, spark, glyph-dust
    float g = kind < .5 ? 900. : kind < 1.5 ? 520. : -60.;       // px/s² (glyph dust floats up)
    float e = (1. - exp(-k * t)) / k;
    vec2 p = iPos.xy + iVel.xy * e + vec2(0., g) * (t - e) / k;
    // flutter (confetti only)
    p.x += kind < .5 ? sin(t * (5. + iSpin.x) + iPos.z) * 14. * min(t * 2., 1.) : 0.;
    vec2 vel = iVel.xy * exp(-k * t) + vec2(0., g) * (1. - exp(-k * t)) / k;
    vFade = smoothstep(life, life * .62, t) * smoothstep(0., .04, t);
    vec2 q = uv - .5;
    vec3 pos;
    if (kind < .5) {                                               // tumbling 3D confetti strip
      mat3 R = rot(iSpin * t * 2.2 + iPos.z);
      vec3 l = R * vec3(q * vec2(iMeta.z, iMeta.z * .45), 0.);
      vShade = abs((R * vec3(0., 0., 1.)).z);                      // facing ratio → metallic glint
      pos = vec3(l.xy, 0.);
    } else if (kind < 1.5) {                                       // spark: stretch along velocity
      float sp = length(vel); vec2 d = sp > .01 ? vel / sp : vec2(1., 0.); vec2 nrm = vec2(-d.y, d.x);
      float len = iMeta.z * (1. + sp * .028);
      pos = vec3(d * q.x * len + nrm * q.y * iMeta.z * .9, 0.); vShade = 1.;
    } else { pos = vec3(q * iMeta.z * (1. + t * .6), 0.); vShade = 1.; }
    vec2 px = p + pos.xy;
    gl_Position = vec4(px / uRes * 2. - 1., 0., 1.); gl_Position.y *= -1.;
  }`;
const frag = /* glsl */`
  varying vec4 vCol; varying vec2 vUv; varying float vKind, vFade, vShade;
  void main(){
    vec2 q = vUv - .5;
    vec3 c = vCol.rgb; float a;
    if (vKind < .5) {
      float glint = pow(vShade, 6.);
      c = c * (.45 + .55 * vShade) + glint * .9;                   // satin + specular flash
      a = 1.;
    } else if (vKind < 1.5) {
      float d = length(q * vec2(1., 2.2));
      a = smoothstep(.5, 0., d); a *= a; c = c * 2.2 + vec3(.6) * a; // hot core
    } else {
      float d = length(q); a = smoothstep(.5, .1, d) * .55; c *= 1.6;
    }
    a *= vFade * vCol.a;
    if (a < .003) discard;
    gl_FragColor = vec4(c * a, a);                                   // premultiplied
  }`;

let layer = null;
function create() {
  const canvas = document.createElement("canvas");
  canvas.className = "gl-burst-layer";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: "975", pointerEvents: "none" });
  document.body.append(canvas);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true }); }
  catch { canvas.remove(); return null; }
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0, 0);
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const A = (n) => new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
  const at = { iPos: A(3), iVel: A(3), iCol: A(4), iMeta: A(4), iSpin: A(3) };
  Object.entries(at).forEach(([k, v]) => geo.setAttribute(k, v));
  geo.instanceCount = 0;
  const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uDpr: { value: dpr } };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.Camera();
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); uniforms.uRes.value.set(innerWidth, innerHeight); };
  resize(); addEventListener("resize", resize);
  const t0 = performance.now();
  let cursor = 0, until = 0, running = false;
  const now = () => (performance.now() - t0) / 1000;
  const loop = () => {
    uniforms.uTime.value = now();
    renderer.render(scene, cam);
    if (uniforms.uTime.value < until) requestAnimationFrame(loop);
    else { running = false; renderer.clear(); }
  };
  return {
    emit(list) {
      const tn = now();
      for (const p of list) {
        const i = cursor; cursor = (cursor + 1) % MAX;
        at.iPos.setXYZ(i, p.x, p.y, Math.random() * 10);
        at.iVel.setXYZ(i, p.vx, p.vy, 0);
        at.iCol.setXYZW(i, p.r, p.g, p.b, p.a ?? 1);
        at.iMeta.setXYZW(i, tn + (p.delay || 0), p.life, p.size, p.kind);
        at.iSpin.setXYZ(i, (Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 5);
        until = Math.max(until, tn + (p.delay || 0) + p.life + .1);
      }
      geo.instanceCount = MAX;
      Object.values(at).forEach((a) => { a.needsUpdate = true; });
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
  };
}

const toRGB = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

/**
 * burst(x, y, { colors, count, power, kinds })  — screen-space px. Returns false when WebGL is unavailable.
 * kinds: { confetti: 0..1, spark: 0..1, dust: 0..1 } proportions.
 */
export function burst(x, y, { colors = ["#d8ff4f", "#b6a2ec", "#ff90b4", "#9fc4ff", "#ffd979"], count = 160, power = 1, kinds = { confetti: .55, spark: .35, dust: .1 }, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}) {
  if (layer === null) layer = create() || false;
  if (!layer) return false;
  const cols = colors.map(toRGB), list = [];
  const kc = kinds.confetti ?? 0, ks = kinds.spark ?? 0;
  for (let i = 0; i < count; i++) {
    const r = Math.random(), kind = r < kc ? 0 : r < kc + ks ? 1 : 2;
    const a = angle + (Math.random() - .5) * spread;
    const sp = (kind === 1 ? 700 + Math.random() * 1300 : kind === 0 ? 450 + Math.random() * 1000 : 60 + Math.random() * 160) * power;
    const [cr, cg, cb] = cols[i % cols.length];
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: cr, g: cg, b: cb, life: kind === 0 ? 2.2 + Math.random() * 1.4 : kind === 1 ? .7 + Math.random() * .6 : 1.4 + Math.random(), size: kind === 0 ? 10 + Math.random() * 10 : kind === 1 ? 5 + Math.random() * 5 : 16 + Math.random() * 30, kind, delay: Math.random() * .05 });
  }
  layer.emit(list);
  return true;
}
