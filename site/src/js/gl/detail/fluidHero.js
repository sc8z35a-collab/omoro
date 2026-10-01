// OMORO v3 — detail-page hero: real-time Navier–Stokes ink simulation over the scene photo.
//
//   velocity / dye / pressure / divergence / curl ping-pong FBOs (stable-fluids, Jacobi pressure solve,
//   vorticity confinement) — technique after Jos Stam "Stable Fluids" and Pavel Dobryakov's
//   WebGL-Fluid-Simulation (MIT). Re-implemented on three.js render targets.
//
//   The photo is refracted by the velocity field + the ink's surface normal, split into RGB along the flow,
//   parallaxed by a luminance pseudo-depth, and lit like a wet glossy liquid. 16k–65k dust motes (GPGPU,
//   float position texture) are advected by the same velocity field. Post: A's shared composer
//   (bloom → UltraFinal grain/CA/halation → ACES).
//
//   The moment's data drives the mood:  volume → splat force / curl,  gap (間) → idle rhythm.
import * as THREE from "three";
import { createRenderer, makeComposer, quality, visibilityGate, GLSL } from "../fx/index.js";

const TIER = {
  ultra: { sim: 256, dye: 1536, iters: 28, motes: 256 },
  high: { sim: 160, dye: 1024, iters: 20, motes: 160 },
  low: { sim: 96, dye: 512, iters: 12, motes: 64 }
}[quality.tier];

/* ------------------------------------------------------------------ shaders */
const baseVert = /* glsl */`
  uniform vec2 texelSize;
  varying vec2 vUv, vL, vR, vT, vB;
  void main(){
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.); vR = vUv + vec2(texelSize.x, 0.);
    vT = vUv + vec2(0., texelSize.y); vB = vUv - vec2(0., texelSize.y);
    gl_Position = vec4(position.xy, 0., 1.);
  }`;
const head = `varying vec2 vUv, vL, vR, vT, vB;\nuniform vec2 texelSize;\n`;

const SPLAT = head + /* glsl */`
  uniform sampler2D uTarget; uniform float aspectRatio, radius; uniform vec3 color; uniform vec2 point;
  void main(){
    vec2 p = vUv - point; p.x *= aspectRatio;
    vec3 s = exp(-dot(p, p) / radius) * color;
    gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.);
  }`;
const ADVECT = head + /* glsl */`
  uniform sampler2D uVelocity, uSource; uniform float dt, dissipation;
  void main(){
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = texture2D(uSource, coord) / (1. + dissipation * dt);
  }`;
const DIVERGENCE = head + /* glsl */`
  uniform sampler2D uVelocity;
  void main(){
    float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x;
    if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
    gl_FragColor = vec4(.5 * (R - L + T - B), 0., 0., 1.);
  }`;
const CURL = head + /* glsl */`
  uniform sampler2D uVelocity;
  void main(){
    float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
    gl_FragColor = vec4(.5 * (R - L - T + B), 0., 0., 1.);
  }`;
const VORTICITY = head + /* glsl */`
  uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
  void main(){
    float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
    vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    f /= length(f) + .0001; f *= curl * C; f.y *= -1.;
    vec2 v = texture2D(uVelocity, vUv).xy + f * dt;
    gl_FragColor = vec4(clamp(v, -1000., 1000.), 0., 1.);
  }`;
const CLEAR = head + `uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`;
const PRESSURE = head + /* glsl */`
  uniform sampler2D uPressure, uDivergence;
  void main(){
    float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
    gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * .25, 0., 0., 1.);
  }`;
const GRADIENT = head + /* glsl */`
  uniform sampler2D uPressure, uVelocity;
  void main(){
    float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
    vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
    gl_FragColor = vec4(v, 0., 1.);
  }`;

// dust motes: GPGPU position update (xy = uv, z = life 0..1, w = seed)
const MOTES_UPDATE = head + GLSL.hash + GLSL.noise + /* glsl */`
  uniform sampler2D uPos, uVelocity; uniform vec2 uVelTexel; uniform float uDt, uTime, uInit, uFlow;
  void main(){
    vec4 p = texture2D(uPos, vUv);
    float seed = hash12(vUv * 517.3);
    if (uInit > .5) { p = vec4(hash12(vUv * 91.7), hash12(vUv * 37.1 + 4.), hash12(vUv * 13.3 + 9.), seed); gl_FragColor = p; return; }
    vec2 v = texture2D(uVelocity, p.xy).xy * uVelTexel;          // uv / second
    p.xy += v * uDt * uFlow;
    float n1 = snoise(vec3(p.xy * 2.6, uTime * .07 + seed * 9.)), n2 = snoise(vec3(p.xy * 2.6 + 11.3, uTime * .07 - seed * 7.));
    p.xy += vec2(n1, n2 + .35) * .006 * uDt;                       // warm air: slow upward drift
    p.z -= uDt * (.035 + .09 * seed);
    if (p.z <= 0. || p.x < -.04 || p.x > 1.04 || p.y < -.04 || p.y > 1.04) {
      vec2 r = vec2(hash12(vUv * 71.1 + uTime), hash12(vUv * 19.7 - uTime * 1.3));
      p = vec4(r.x, r.y * 1.1 - .05, 1., seed);
    }
    gl_FragColor = p;
  }`;
const MOTES_VERT = /* glsl */`
  uniform sampler2D uPos; uniform float uSize, uAspect, uTime; uniform vec2 uMouse;
  attribute vec2 ref;
  varying float vA, vSeed, vBig;
  void main(){
    vec4 p = texture2D(uPos, ref);
    vSeed = p.w;
    vBig = step(.993, p.w);                                         // ~0.7% are large out-of-focus bokeh discs
    vA = smoothstep(0., .18, p.z) * smoothstep(1., .82, p.z);
    vec2 par = (uMouse - .5) * (.004 + p.w * .02);                  // depth parallax by seed
    gl_Position = vec4((p.xy + par) * 2. - 1., 0., 1.);
    float tw = .75 + .25 * sin(uTime * (1.5 + p.w * 4.) + p.w * 40.);
    gl_PointSize = uSize * mix(mix(1., 3.2, pow(p.w, 3.)), 26. + p.w * 22., vBig) * tw;
  }`;
const MOTES_FRAG = /* glsl */`
  uniform vec3 uAccent, uWarm;
  varying float vA, vSeed, vBig;
  void main(){
    vec2 c = gl_PointCoord - .5; float d = length(c);
    if (d > .5) discard;
    float core = smoothstep(.5, .0, d);
    float disc = smoothstep(.5, .44, d) * (.35 + .65 * smoothstep(.2, .48, d));   // bokeh: brighter rim
    float a = mix(core * core, disc * .09, vBig) * vA;
    vec3 col = mix(uWarm, uAccent, smoothstep(.3, .9, vSeed));
    gl_FragColor = vec4(col * mix(2.4, 1.1, vBig) * a, a);
  }`;

const DISPLAY_FRAG = GLSL.hash + /* glsl */`
  uniform sampler2D uPhoto, uDye, uVel; uniform vec2 uRes, uImg, uMouse, uDyeTexel;
  uniform float uTime, uIntro, uScroll, uZoom, uHasPhoto; uniform vec3 uAccent;
  varying vec2 vUv;
  vec2 cover(vec2 uv){ float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y; vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.); return (uv - .5) * s / uZoom + .5; }
  float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
  float dyeH(vec2 uv){ return luma(texture2D(uDye, uv).rgb); }
  void main(){
    vec2 uv = vUv;
    vec2 vel = texture2D(uVel, uv).xy;
    vec3 dye = texture2D(uDye, uv).rgb;
    float h = luma(dye);
    // liquid surface normal from ink height
    float hl = dyeH(uv - vec2(uDyeTexel.x, 0.)), hr = dyeH(uv + vec2(uDyeTexel.x, 0.));
    float hb = dyeH(uv - vec2(0., uDyeTexel.y)), ht = dyeH(uv + vec2(0., uDyeTexel.y));
    vec3 n = normalize(vec3(hl - hr, hb - ht, .035));
    // pseudo-depth from luminance → pointer parallax (bright = near)
    vec2 c0 = cover(uv);
    float depth = luma(texture2D(uPhoto, c0).rgb);
    vec2 par = (uMouse - .5) * (depth - .35) * .03;
    // refraction through the ink + drag by the flow
    float ink = clamp(h * 3.5, 0., 1.);
    vec2 disp = vel * .00028 + n.xy * .035 * ink;
    vec2 b = uv + par - disp;
    // breathing idle wave so the still frame is never dead
    b += vec2(sin(b.y * 7. + uTime * .45), cos(b.x * 6. + uTime * .38)) * .0018;
    float amt = clamp(length(vel) * .0009 + ink * .6, 0., 1.);
    vec2 dir = normalize(vel + vec2(1e-5, 0.)) * .65 + n.xy * .35;
    float ca = .0015 + amt * .014;
    vec3 col;
    col.r = texture2D(uPhoto, cover(b + dir * ca)).r;
    col.g = texture2D(uPhoto, cover(b)).g;
    col.b = texture2D(uPhoto, cover(b - dir * ca)).b;
    col = mix(vec3(.01), col, uHasPhoto);
    // grade: deep, accent-tinted shadows
    col *= .58;
    col = mix(col, col * uAccent * 1.55, .18);
    // lit glossy ink
    vec3 L = normalize(vec3(-.45, .65, .62));
    float diff = clamp(dot(n, L), 0., 1.);
    float spec = pow(clamp(dot(reflect(-L, n), vec3(0., 0., 1.)), 0., 1.), 60.);
    float fres = pow(1. - n.z, 2.);
    col = col * (1. - ink * .35) + dye * (.55 + .75 * diff) * 1.25;
    col += spec * clamp(h * 8., 0., 1.) * vec3(1., .97, .9) * 1.6;
    col += uAccent * fres * ink * .6;
    // fine dither (prevents banding in the dark gradients)
    col += (hash12(gl_FragCoord.xy + fract(uTime) * 91.) - .5) / 255.;
    col *= mix(1., .35, uScroll);
    col *= uIntro;
    gl_FragColor = vec4(max(col, 0.), 1.);
  }`;

/* ------------------------------------------------------------------ helpers */
const rtOpts = (type, filter) => ({ type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
function single(w, h, type, filter = THREE.LinearFilter) {
  const rt = new THREE.WebGLRenderTarget(w, h, rtOpts(type, filter));
  rt.texel = new THREE.Vector2(1 / w, 1 / h);
  return rt;
}
function double(w, h, type, filter) {
  let a = single(w, h, type, filter), b = single(w, h, type, filter);
  return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, texel: a.texel, dispose() { a.dispose(); b.dispose(); } };
}
function resFor(res, w, h) {
  const aspect = w / h, min = Math.round(res), max = Math.round(res * Math.max(aspect, 1 / aspect));
  return w > h ? [max, min] : [min, max];
}

/* ------------------------------------------------------------------ class */
export class FluidHero {
  constructor(canvas, { src, accent = "#d8ff4f", volume = 60, gap = .8 } = {}) {
    this.canvas = canvas;
    this.host = canvas.parentElement;
    this.accent = new THREE.Color(accent);
    this.mood = { force: .45 + (volume / 100) * 1.25, curl: 12 + volume * .32, idle: 1.1 + gap * 1.6, quiet: volume < 30 };
    const r = this.renderer = createRenderer(canvas, { shadows: false, antialias: false, exposure: 1.08 });
    r.autoClear = true;
    this.type = THREE.HalfFloatType;
    this.floatOK = r.capabilities.isWebGL2 && r.extensions.has("EXT_color_buffer_float");

    // fullscreen blitter for the simulation passes
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.simScene = new THREE.Scene(); this.simScene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: baseVert, fragmentShader: frag, uniforms: { texelSize: { value: new THREE.Vector2() }, ...uniforms }, depthTest: false, depthWrite: false });
    const t = () => ({ value: null }), f = (v = 0) => ({ value: v });
    this.m = {
      splat: mk(SPLAT, { uTarget: t(), aspectRatio: f(1), radius: f(.002), color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() } }),
      advect: mk(ADVECT, { uVelocity: t(), uSource: t(), dt: f(), dissipation: f() }),
      divergence: mk(DIVERGENCE, { uVelocity: t() }),
      curl: mk(CURL, { uVelocity: t() }),
      vorticity: mk(VORTICITY, { uVelocity: t(), uCurl: t(), curl: f(this.mood.curl), dt: f() }),
      clear: mk(CLEAR, { uTexture: t(), value: f(.8) }),
      pressure: mk(PRESSURE, { uPressure: t(), uDivergence: t() }),
      gradient: mk(GRADIENT, { uPressure: t(), uVelocity: t() })
    };

    // display scene: composite quad + motes, rendered through the shared ULTRA composer
    this.u = {
      uPhoto: t(), uDye: t(), uVel: t(), uRes: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(.5, .5) }, uDyeTexel: { value: new THREE.Vector2() }, uTime: f(), uIntro: f(0), uScroll: f(0),
      uZoom: f(1.06), uHasPhoto: f(0), uAccent: { value: this.accent }
    };
    this.scene = new THREE.Scene();
    const display = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: DISPLAY_FRAG, uniforms: this.u, depthTest: false, depthWrite: false
    }));
    display.frustumCulled = false; display.renderOrder = 0;
    this.scene.add(display);
    if (this.floatOK) this.initMotes();

    this.fx = makeComposer(r, this.scene, this.cam, {
      bloom: { strength: .75, radius: .55, threshold: .72 }, smaa: false,
      final: { ca: .0011, grain: .065, vignette: .42, halation: .16 }
    });

    new THREE.TextureLoader().load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = r.capabilities.getMaxAnisotropy();
      this.u.uPhoto.value = tex; this.u.uImg.value.set(tex.image.width, tex.image.height); this.u.uHasPhoto.value = 1;
      canvas.classList.add("is-on");
      this.introBurst();
    });

    this.pointer = { x: .5, y: .5, px: .5, py: .5, moved: false, tx: .5, ty: .5 };
    this.queue = [];
    this.lastIdle = 0;
    this.timer = new THREE.Timer();
    this.gate = visibilityGate(canvas);
    this.resize();
    this.onResize = () => this.resize();
    this.onMove = (e) => {
      const b = canvas.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width, y = 1 - (e.clientY - b.top) / b.height;
      const p = this.pointer;
      p.px = p.moved ? p.x : x; p.py = p.moved ? p.y : y; p.x = x; p.y = y; p.tx = x; p.ty = y; p.moved = true; p.dirty = true;
      this.lastInput = performance.now();
    };
    this.onDown = (e) => { this.onMove(e); this.burst(this.pointer.x, this.pointer.y, 1.4); };
    this.onLeave = () => { this.pointer.moved = false; };
    addEventListener("resize", this.onResize);
    this.host.addEventListener("pointermove", this.onMove);
    this.host.addEventListener("pointerdown", this.onDown);
    this.host.addEventListener("pointerleave", this.onLeave);
    r.setAnimationLoop(() => this.tick());
  }

  initMotes() {
    const n = TIER.motes;
    this.motes = double(n, n, THREE.FloatType, THREE.NearestFilter);
    this.m.motes = new THREE.ShaderMaterial({
      vertexShader: baseVert, fragmentShader: MOTES_UPDATE, depthTest: false, depthWrite: false,
      uniforms: { texelSize: { value: new THREE.Vector2(1 / n, 1 / n) }, uPos: { value: null }, uVelocity: { value: null }, uVelTexel: { value: new THREE.Vector2() }, uDt: { value: 0 }, uTime: { value: 0 }, uInit: { value: 1 }, uFlow: { value: 1 } }
    });
    const g = new THREE.BufferGeometry(), ref = new Float32Array(n * n * 2);
    for (let i = 0; i < n * n; i++) { ref[i * 2] = (i % n + .5) / n; ref[i * 2 + 1] = (Math.floor(i / n) + .5) / n; }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    g.setAttribute("ref", new THREE.BufferAttribute(ref, 2));
    this.moteU = { uPos: { value: null }, uSize: { value: 1.6 * this.renderer.getPixelRatio() }, uAspect: { value: 1 }, uTime: { value: 0 }, uMouse: this.u.uMouse, uAccent: { value: this.accent.clone().multiplyScalar(1.2) }, uWarm: { value: new THREE.Color("#ffe6c4") } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: MOTES_VERT, fragmentShader: MOTES_FRAG, uniforms: this.moteU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; pts.renderOrder = 1;
    this.scene.add(pts);
    this.motesNeedInit = true;
  }

  blit(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.simScene, this.cam); }

  resize() {
    const w = Math.max(2, this.canvas.clientWidth), h = Math.max(2, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.fx.setSize(w, h);
    this.u.uRes.value.set(w, h);
    this.aspect = w / h;
    const [sw, sh] = resFor(TIER.sim, w, h), [dw, dh] = resFor(TIER.dye, w, h);
    if (this.simSize !== `${sw}x${sh}`) {
      ["velocity", "pressure", "dye"].forEach((k) => this[k]?.dispose());
      [this.divergence, this.curl].forEach((x) => x?.dispose());
      this.velocity = double(sw, sh, this.type, THREE.LinearFilter);
      this.pressure = double(sw, sh, this.type, THREE.NearestFilter);
      this.divergence = single(sw, sh, this.type, THREE.NearestFilter);
      this.curl = single(sw, sh, this.type, THREE.NearestFilter);
      this.dye = double(dw, dh, this.type, THREE.LinearFilter);
      this.simSize = `${sw}x${sh}`;
      this.u.uDyeTexel.value.set(1 / dw, 1 / dh);
    }
  }

  /* ---------------- splats ---------------- */
  palette(k = 0) {
    const c = this.accent.clone();
    c.offsetHSL((Math.random() - .5) * .1 + k, (Math.random() - .5) * .1, (Math.random() - .5) * .08);
    return c;
  }
  splat(x, y, dx, dy, color, radius = .22) {
    const m = this.m.splat.uniforms;
    m.aspectRatio.value = this.aspect;
    m.point.value.set(x, y);
    m.radius.value = (radius / 100) * (this.aspect > 1 ? this.aspect : 1);
    m.uTarget.value = this.velocity.read.texture; m.color.value.set(dx, dy, 0); m.texelSize.value.copy(this.velocity.texel);
    this.blit(this.m.splat, this.velocity.write); this.velocity.swap();
    m.uTarget.value = this.dye.read.texture; m.color.value.set(color.r, color.g, color.b); m.texelSize.value.copy(this.dye.texel);
    this.blit(this.m.splat, this.dye.write); this.dye.swap();
  }
  burst(x, y, k = 1) {
    const n = 5 + Math.round(k * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .4, f = (380 + Math.random() * 420) * this.mood.force * k;
      this.queue.push([x, y, Math.cos(a) * f, Math.sin(a) * f, this.palette().multiplyScalar(.09 * k), .12 + Math.random() * .1]);
    }
  }
  introBurst() {
    // ink pours in from below the quote, sweeping right — timed with the title intro
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      setTimeout(() => {
        const x = .06 + (i / steps) * .7, y = .12 + Math.sin(i * .9) * .08;
        this.queue.push([x, y, (160 + Math.random() * 220) * this.mood.force, (520 + Math.random() * 520) * this.mood.force, this.palette(i % 3 === 2 ? .5 : 0).multiplyScalar(.16), .32]);
      }, 120 + i * 70);
    }
  }
  idleSplat(now) {
    if (now - this.lastIdle < this.mood.idle * 1000) return;
    if (this.lastInput && now - this.lastInput < 1600) return;
    this.lastIdle = now;
    const x = .15 + Math.random() * .8, y = Math.random() * .9;
    const a = Math.random() * Math.PI * 2, f = (this.mood.quiet ? 120 : 340) * this.mood.force;
    this.queue.push([x, y, Math.cos(a) * f, Math.sin(a) * f + 120, this.palette(Math.random() < .25 ? .45 : 0).multiplyScalar(this.mood.quiet ? .05 : .085), this.mood.quiet ? .5 : .28]);
  }

  /* ---------------- simulation step ---------------- */
  step(dt) {
    const m = this.m, v = this.velocity, tx = v.texel;
    const set = (mat) => { mat.uniforms.texelSize.value.copy(tx); return mat.uniforms; };
    set(m.curl).uVelocity.value = v.read.texture; this.blit(m.curl, this.curl);
    const vo = set(m.vorticity); vo.uVelocity.value = v.read.texture; vo.uCurl.value = this.curl.texture; vo.dt.value = dt;
    this.blit(m.vorticity, v.write); v.swap();
    set(m.divergence).uVelocity.value = v.read.texture; this.blit(m.divergence, this.divergence);
    const cl = set(m.clear); cl.uTexture.value = this.pressure.read.texture; cl.value.value = .8;
    this.blit(m.clear, this.pressure.write); this.pressure.swap();
    const pr = set(m.pressure); pr.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < TIER.iters; i++) { pr.uPressure.value = this.pressure.read.texture; this.blit(m.pressure, this.pressure.write); this.pressure.swap(); }
    const gr = set(m.gradient); gr.uPressure.value = this.pressure.read.texture; gr.uVelocity.value = v.read.texture;
    this.blit(m.gradient, v.write); v.swap();
    const ad = set(m.advect); ad.dt.value = dt;
    ad.uVelocity.value = v.read.texture; ad.uSource.value = v.read.texture; ad.dissipation.value = this.mood.quiet ? .35 : .22;
    this.blit(m.advect, v.write); v.swap();
    ad.uVelocity.value = v.read.texture; ad.uSource.value = this.dye.read.texture; ad.dissipation.value = (this.mood.quiet ? .55 : .85) + this.u.uScroll.value * 3;
    this.blit(m.advect, this.dye.write); this.dye.swap();
    if (this.motes) {
      const mu = this.m.motes.uniforms;
      mu.uPos.value = this.motes.read.texture; mu.uVelocity.value = v.read.texture; mu.uVelTexel.value.copy(tx);
      mu.uDt.value = dt; mu.uTime.value = this.u.uTime.value; mu.uInit.value = this.motesNeedInit ? 1 : 0;
      this.blit(this.m.motes, this.motes.write); this.motes.swap(); this.motesNeedInit = false;
      this.moteU.uPos.value = this.motes.read.texture; this.moteU.uTime.value = this.u.uTime.value;
    }
  }

  tick() {
    if (!this.gate.active()) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 1 / 30), now = performance.now();
    this.u.uTime.value = this.timer.getElapsed();
    this.u.uIntro.value += (1 - this.u.uIntro.value) * .04;
    const p = this.pointer;
    if (p.dirty) {
      p.dirty = false;
      const dx = (p.x - p.px) * (this.aspect < 1 ? this.aspect : 1), dy = (p.y - p.py) * (this.aspect > 1 ? 1 / this.aspect : 1);
      const sp = Math.hypot(dx, dy);
      if (sp > .0004) this.queue.push([p.x, p.y, dx * 6200 * this.mood.force, dy * 6200 * this.mood.force, this.palette().multiplyScalar(Math.min(.12, .025 + sp * 3)), .18 + Math.min(.25, sp * 6)]);
    }
    this.u.uMouse.value.lerp(new THREE.Vector2(p.tx, p.ty), .05);
    this.idleSplat(now);
    for (const s of this.queue.splice(0, 24)) this.splat(...s);
    this.step(dt);
    this.u.uDye.value = this.dye.read.texture; this.u.uVel.value = this.velocity.read.texture;
    this.renderer.setRenderTarget(null);
    this.fx.render();
  }

  setScroll(v) { this.u.uScroll.value = v; }

  dispose() {
    this.renderer.setAnimationLoop(null);
    removeEventListener("resize", this.onResize);
    this.host.removeEventListener("pointermove", this.onMove);
    this.host.removeEventListener("pointerdown", this.onDown);
    this.host.removeEventListener("pointerleave", this.onLeave);
    this.gate.dispose();
    ["velocity", "pressure", "dye", "motes"].forEach((k) => this[k]?.dispose());
    this.divergence?.dispose(); this.curl?.dispose();
    Object.values(this.m).forEach((mat) => mat.dispose());
    this.u.uPhoto.value?.dispose();
    this.fx.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
