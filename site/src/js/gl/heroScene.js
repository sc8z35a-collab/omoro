// Home hero — "ULTRA" (agent B)
//  · GPGPU particles (GPUComputationRenderer, up to 262k) flowing through a baked curl-noise volume and
//    springing into 3D-inflated glyphs; staggered arrival, pointer swirl/repulsion, click shockwave
//  · raymarched volumetric spotlights (3D smoke texture, Henyey–Greenstein scattering, gobo streaks)
//  · wet stage floor (Reflector + puddle mask, roughness-blurred reflections, drip ripples, light pools, tape marks)
//  · velvet curtain backdrop, chrome "sanpachi" stand-mic, dust motes that glitter only inside beams
//  · particle depth-of-field (bokeh discs), bloom, cinematic final grade (shared fx base)
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { gsap } from "gsap";
import { createRenderer, loadEnv, makeComposer, quality, hot } from "./fx/index.js";
import { momentCanvas, ensureFonts } from "./cardTexture.js";
import { noiseVolume } from "./home/noiseVolume.js";
import { sampleText, cloudTargets } from "./home/textTargets.js";
import * as S from "./home/shaders.js";
import { reduced } from "../core/env.js";

const SIM_SIZE = { ultra: 512, high: 320, low: 144 }[quality.tier];
const FLOOR_Y = -2.6;
const SPOTS = [
  { x: -5.4, color: "#b6a2ec", tilt: -.33, power: .8 },
  { x: 0, color: "#d8ff4f", tilt: 0, power: 1.15 },
  { x: 5.4, color: "#ff90b4", tilt: .33, power: .8 }
];

export class HeroScene {
  constructor(canvas, moments, { onReady } = {}) {
    this.canvas = canvas;
    this.moments = moments;
    this.index = -1;
    this.onReady = onReady;
    this.pointer = new THREE.Vector2(0, 0);
    this.mouseLocal = new THREE.Vector3(99, 99, 0);
    this.mousePrev = new THREE.Vector3(99, 99, 0);
    this.mouseVel = new THREE.Vector3();
    this.scroll = 0;
    this.visible = true;
    this.hidden = document.hidden;
    this.reduced = reduced;
    this.settle = 240; // frames to keep simulating in reduced-motion mode
    this.timer = new THREE.Timer();
    this.targets = new Map();
    this.ready = this.init();
  }

  /* ------------------------------------------------------------ setup */
  async init() {
    const renderer = this.renderer = createRenderer(this.canvas, { exposure: 1.05, shadows: false });
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080a);
    scene.fog = new THREE.FogExp2(0x07080a, .028);
    const camera = this.camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
    camera.position.set(0, .3, 9);
    this.root = new THREE.Group();
    scene.add(this.root);

    this.noise = noiseVolume(quality.tier === "low" ? 32 : 64);
    await ensureFonts();
    this.buildSpots();
    this.buildParticles();
    this.buildFloor();
    this.buildCurtain();
    this.buildDust();
    this.buildMic();
    this.buildCards();
    loadEnv(renderer, "studio").then((env) => { scene.environment = env; scene.environmentIntensity = .55; });

    this.fx = makeComposer(renderer, scene, camera, {
      bloom: { strength: .95, radius: .7, threshold: .78 },
      final: { ca: .0022, grain: .05, vignette: .42, halation: .16 }
    });

    this.resize();
    this.bind();
    renderer.setAnimationLoop(() => this.tick());
    this.intro();
    this.onReady?.();
    // pre-bake the other quotes while idle
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
    let k = 0;
    const next = () => { if (k < this.moments.length) { this.target(k++); idle(next); } };
    idle(next);
  }

  /* ------------------------------------------------------------ GPGPU particles */
  target(key) {
    if (this.targets.has(key)) return this.targets.get(key);
    const N = SIM_SIZE * SIM_SIZE;
    const data = key === "cloud" ? cloudTargets(N) : sampleText(key === "intro" ? ["面白い", "ねえ。"] : this.moments[key].lines, N);
    const tex = new THREE.DataTexture(data, SIM_SIZE, SIM_SIZE, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    this.targets.set(key, tex);
    return tex;
  }

  buildParticles() {
    const size = SIM_SIZE;
    const gpu = this.gpu = new GPUComputationRenderer(size, size, this.renderer);
    const pos0 = gpu.createTexture(), vel0 = gpu.createTexture();
    const pa = pos0.image.data, va = vel0.image.data;
    for (let i = 0; i < size * size; i++) {
      pa[i * 4] = (Math.random() - .5) * .05; pa[i * 4 + 1] = 2; pa[i * 4 + 2] = 0; pa[i * 4 + 3] = 0;
      va[i * 4] = 0; va[i * 4 + 1] = 0; va[i * 4 + 2] = 0; va[i * 4 + 3] = Math.random();
    }
    this.velVar = gpu.addVariable("textureVelocity", S.simVelocity, vel0);
    this.posVar = gpu.addVariable("texturePosition", S.simPosition, pos0);
    gpu.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);
    gpu.setVariableDependencies(this.posVar, [this.velVar, this.posVar]);
    const intro = this.target("intro");
    this.simU = {
      uTarget: { value: intro }, uNoise: { value: this.noise },
      uTime: { value: 0 }, uDt: { value: 1 / 60 }, uMorph: { value: 1 }, uScatter: { value: 0 }, uFlow: { value: .22 }, uStir: { value: 0 },
      uMouse: { value: this.mouseLocal }, uMouseVel: { value: this.mouseVel },
      uShockPos: { value: new THREE.Vector3() }, uShockT: { value: 99 }, uIntro: { value: this.reduced ? 1 : 0 }, uSpout: { value: new THREE.Vector3(0, 2, 0) }
    };
    Object.assign(this.velVar.material.uniforms, this.simU);
    this.posVar.material.uniforms.uTarget = this.simU.uTarget;
    this.posVar.material.uniforms.uDt = this.simU.uDt;
    this.posVar.material.uniforms.uIntro = this.simU.uIntro;
    this.posVar.material.uniforms.uSpout = this.simU.uSpout;
    const err = gpu.init();
    if (err) throw new Error(err);

    const N = this.particleCount = size * size;
    const ref = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { ref[i * 2] = ((i % size) + .5) / size; ref[i * 2 + 1] = (Math.floor(i / size) + .5) / size; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute("aRef", new THREE.BufferAttribute(ref, 2));
    this.pMat = new THREE.ShaderMaterial({
      vertexShader: S.particleVert, fragmentShader: S.particleFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        tPos: { value: null }, tVel: { value: null }, uTime: { value: 0 },
        uSize: { value: 9 * Math.sqrt(512 / size) }, uPixel: { value: 1 }, uFocus: { value: 9 }, uAperture: { value: 1.1 },
        uIntro: this.simU.uIntro,
        uColorA: { value: new THREE.Color("#eef0e8").multiplyScalar(.9) }, uColorB: { value: new THREE.Color("#d8ff4f").multiplyScalar(1.2) }, uHot: { value: hot("#d8ff4f", 1.6) }
      }
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.root.add(this.points);
  }

  intro() {
    const u = this.simU;
    if (this.reduced) { u.uIntro.value = 1; return; }
    // particles pour out of the centre lamp, drift on the curl flow, then lock into the glyphs one by one
    gsap.to(u.uIntro, { value: 1, duration: 2.6, ease: "power1.in", delay: .2 });
    gsap.fromTo(u.uMorph, { value: 0 }, { value: 1, duration: 4.2, ease: "power2.inOut", delay: .5 });
    gsap.fromTo(u.uStir, { value: 1.2 }, { value: 0, duration: 5, ease: "power2.out" });
  }

  morphTo(tex, accent) {
    const u = this.simU;
    u.uTarget.value = tex;
    gsap.killTweensOf([u.uMorph, u.uStir]);
    if (this.reduced) { u.uMorph.value = 1; this.settle = 240; }
    else {
      u.uMorph.value = 0;
      gsap.to(u.uMorph, { value: 1, duration: 2.2, ease: "power2.inOut" });
      gsap.fromTo(u.uStir, { value: 1 }, { value: 0, duration: 2.6, ease: "power2.out" });
    }
    if (accent) {
      const c = new THREE.Color(accent);
      const d = this.reduced ? 0 : 1.4;
      gsap.to(this.pMat.uniforms.uColorB.value, { r: c.r * 1.2, g: c.g * 1.2, b: c.b * 1.2, duration: d });
      gsap.to(this.pMat.uniforms.uHot.value, { r: c.r * 1.6, g: c.g * 1.6, b: c.b * 1.6, duration: d });
      const mid = this.spots[1];
      gsap.to(mid.color, { r: c.r, g: c.g, b: c.b, duration: d * 1.2, onUpdate: () => this.syncSpotColors() });
      gsap.to(this.floorAccent, { r: c.r, g: c.g, b: c.b, duration: d * 1.2 });
      if (this.micLens) gsap.to(this.micLens.color, { r: c.r * 4, g: c.g * 4, b: c.b * 4, duration: d });
    }
  }
  show(i) {
    this.index = (i + this.moments.length) % this.moments.length;
    this.morphTo(this.target(this.index), this.moments[this.index].accent);
    if (this.cardGroup) gsap.to(this.cardGroup.rotation, { y: -this.index * (Math.PI * 2 / this.moments.length), duration: this.reduced ? 0 : 2.2, ease: "power3.inOut" });
  }
  showIntro() { this.index = -1; this.morphTo(this.target("intro"), "#d8ff4f"); }

  // click / tap: shockwave through the particles
  shock(clientX, clientY) {
    if (this.reduced) return;
    this.toLocal(clientX, clientY, this.simU.uShockPos.value);
    this.simU.uShockT.value = 0;
    gsap.fromTo(this.simU.uStir, { value: .8 }, { value: 0, duration: 1.4, ease: "power2.out" });
  }

  /* ------------------------------------------------------------ volumetric spotlights */
  buildSpots() {
    this.spots = [];
    const steps = { ultra: 48, high: 28, low: 12 }[quality.tier];
    this.spotU = { apex: [], dir: [], color: [], tan: [] };
    for (const s of SPOTS) {
      const len = 13, tan = .2;
      const geo = new THREE.ConeGeometry(len * tan * 1.02, len, 64, 1, true);
      geo.translate(0, -len / 2, 0);
      const apex = new THREE.Vector3(s.x, 7.4, -3.2);
      const dir = new THREE.Vector3(Math.sin(s.tilt), -Math.cos(s.tilt), .12).normalize();
      const color = new THREE.Color(s.color);
      const mat = new THREE.ShaderMaterial({
        vertexShader: S.coneVert, fragmentShader: S.coneFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
        uniforms: {
          uNoise: { value: this.noise }, uApex: { value: apex }, uDir: { value: dir }, uColor: { value: color.clone().multiplyScalar(s.power) },
          uTan: { value: tan }, uLength: { value: len }, uIntensity: { value: .085 }, uTime: { value: 0 }, uFloorY: { value: FLOOR_Y }, uSteps: { value: steps }, uGobo: { value: s.x === 0 ? .5 : .8 }
        }
      });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.copy(apex);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      cone.renderOrder = 2;
      cone.userData = { base: s.tilt, dir0: dir.clone() };
      this.root.add(cone);
      this.spots.push({ mesh: cone, apex, dir, color, power: s.power, tan });
      this.spotU.apex.push(apex); this.spotU.dir.push(dir); this.spotU.color.push(color.clone().multiplyScalar(s.power)); this.spotU.tan.push(tan);
    }
    // lens glints at the lamp apertures (bloom picks them up)
    const glintTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.12, "rgba(255,255,255,.7)"); gr.addColorStop(.4, "rgba(255,255,255,.08)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, 62, 128, 4);
      return new THREE.CanvasTexture(c);
    })();
    this.glints = this.spots.map((s) => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: s.color.clone().multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      m.position.copy(s.apex).addScaledVector(s.dir, .3);
      m.scale.setScalar(2.6);
      this.root.add(m);
      return m;
    });
  }
  syncSpotColors() {
    this.spots.forEach((s, i) => {
      s.mesh.material.uniforms.uColor.value.copy(s.color).multiplyScalar(s.power);
      this.spotU.color[i].copy(s.color).multiplyScalar(s.power);
      this.glints[i].material.color.copy(s.color).multiplyScalar(3);
    });
  }

  /* ------------------------------------------------------------ wet floor */
  buildFloor() {
    const px = quality.dpr;
    const shader = {
      uniforms: {
        color: { value: new THREE.Color(0x15171a) }, tDiffuse: { value: null }, textureMatrix: { value: null },
        uNoise: { value: null }, uTime: { value: 0 }, uReflect: { value: 1 }, uAccent: { value: new THREE.Color("#d8ff4f") },
        uSpotApex: { value: [] }, uSpotDir: { value: [] }, uSpotColor: { value: [] }, uSpotTan: { value: [] }
      },
      vertexShader: S.floorVert, fragmentShader: S.floorFrag
    };
    const w = Math.round(innerWidth * px * (quality.tier === "low" ? .35 : .6)), h = Math.round(innerHeight * px * (quality.tier === "low" ? .35 : .6));
    const floor = this.floor = new Reflector(new THREE.PlaneGeometry(70, 50), { shader, textureWidth: w, textureHeight: h, clipBias: .003, multisample: quality.tier === "low" ? 0 : 4 });
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, -6);
    const u = floor.material.uniforms;
    u.uNoise.value = this.noise;
    u.uSpotApex.value = this.spotU.apex; u.uSpotDir.value = this.spotU.dir; u.uSpotColor.value = this.spotU.color; u.uSpotTan.value = this.spotU.tan;
    this.floorAccent = u.uAccent.value;
    floor.material.extensions = { derivatives: true };
    this.root.add(floor);
  }

  /* ------------------------------------------------------------ backdrop */
  buildCurtain() {
    const geo = new THREE.PlaneGeometry(60, 22, 240, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNoise: { value: this.noise }, uSpotApex: { value: this.spotU.apex }, uSpotDir: { value: this.spotU.dir }, uSpotColor: { value: this.spotU.color }, uSpotTan: { value: this.spotU.tan } },
      vertexShader: /* glsl */`
        uniform float uTime; varying vec3 vWorld; varying float vFold; varying vec2 vUv;
        void main(){
          vec3 p = position;
          float f = sin(p.x * 1.7 + sin(p.x * .37) * 2.) * .5 + sin(p.x * 4.1 + 1.3) * .18;
          p.z += f * .9 + sin(uTime * .3 + p.x * .2) * .05 * (1. - uv.y);
          vFold = f; vUv = uv;
          vec4 w = modelMatrix * vec4(p, 1.); vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp sampler3D;
        uniform sampler3D uNoise; uniform float uTime;
        uniform vec3 uSpotApex[3]; uniform vec3 uSpotDir[3]; uniform vec3 uSpotColor[3]; uniform float uSpotTan[3];
        varying vec3 vWorld; varying float vFold; varying vec2 vUv;
        void main(){
          // velvet: dark in the fold valleys, sheen on the ridges (grazing-angle term)
          float ridge = smoothstep(-.6, .7, vFold);
          float sheen = pow(1. - abs(dFdx(vFold) * 8.), 3.);
          float fib = texture(uNoise, vec3(vWorld.x * .9, vWorld.y * .05, .5)).a;
          vec3 base = mix(vec3(.018, .006, .012), vec3(.08, .02, .04), ridge) * (.8 + fib * .4);
          vec3 light = vec3(.0);
          for (int i = 0; i < 3; i++) {
            vec3 l = vWorld - uSpotApex[i];
            float along = dot(l, uSpotDir[i]);
            float radial = length(l - uSpotDir[i] * along);
            float rad = max(along * uSpotTan[i] * 1.8, 1e-3);
            light += uSpotColor[i] * exp(-pow(radial / rad, 2.) * 1.5) * .35;
          }
          vec3 col = base + base * light * 14. + light * ridge * .05 * sheen;
          col *= smoothstep(0., .25, vUv.y);
          gl_FragColor = vec4(col, 1.);
        }`
    });
    mat.extensions = { derivatives: true };
    const c = this.curtain = new THREE.Mesh(geo, mat);
    c.position.set(0, FLOOR_Y + 11 - .2, -21);
    this.root.add(c);
  }

  buildDust() {
    const n = { ultra: 6000, high: 3000, low: 900 }[quality.tier];
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 24; pos[i * 3 + 1] = Math.random() * 12 - 3; pos[i * 3 + 2] = -Math.random() * 16 + 4; rnd[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    this.dust = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: S.dustVert, fragmentShader: S.dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uSpotApex: { value: this.spotU.apex }, uSpotDir: { value: this.spotU.dir }, uSpotColor: { value: this.spotU.color }, uSpotTan: { value: this.spotU.tan } }
    }));
    this.dust.frustumCulled = false;
    this.root.add(this.dust);
  }

  /* ------------------------------------------------------------ center stand-mic ("サンパチマイク") */
  buildMic() {
    const g = new THREE.Group();
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: .18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: .8, roughness: .45 });
    // perforated grille (procedural bump + roughness)
    const gc = document.createElement("canvas"); gc.width = gc.height = 256;
    const gx = gc.getContext("2d"); gx.fillStyle = "#fff"; gx.fillRect(0, 0, 256, 256); gx.fillStyle = "#000";
    for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 256; x += 8) { gx.beginPath(); gx.arc(x + 4, y + 4, 2.2, 0, 7); gx.fill(); }
    const grilleTex = new THREE.CanvasTexture(gc); grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping; grilleTex.repeat.set(3, 4);
    const grille = new THREE.MeshStandardMaterial({ color: 0xc7cbd0, metalness: 1, roughness: .35, bumpMap: grilleTex, bumpScale: 2.5, roughnessMap: grilleTex });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, .1, 64), dark); base.position.y = .05;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(.63, .025, 12, 64), chrome); baseRing.rotation.x = Math.PI / 2; baseRing.position.y = .1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, 1.95, 24), chrome); pole.position.y = 1.07;
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .14, 24), dark); joint.position.y = 1.2;
    const head = new THREE.Group(); head.position.y = 2.18;
    const body = new THREE.Mesh(new RoundedBoxGeometry(.34, .5, .2, 6, .08), grille);
    const band = new THREE.Mesh(new RoundedBoxGeometry(.36, .07, .22, 4, .03), chrome);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .22, 24), chrome); neck.position.y = -.33;
    // tiny status lamp — picks up the current accent (HDR → bloom)
    this.micLens = new THREE.MeshBasicMaterial({ color: hot("#d8ff4f", 4) });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.018, 16, 16), this.micLens); lamp.position.set(0, -.12, .105);
    head.add(body, band, neck, lamp);
    head.rotation.x = -.12;
    g.add(base, baseRing, pole, joint, head);
    g.position.set(0, FLOOR_Y, 1.3);
    g.scale.setScalar(.92);
    // soft contact shadow
    const sh = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(0,0,0,.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: sh, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, FLOOR_Y + .005, 1.3);
    // key light for the chrome (env does most of the work)
    const key = new THREE.SpotLight(0xffffff, 60, 14, .35, .6, 1.5); key.position.set(0, 6.5, 2.4); key.target = g;
    const rim = new THREE.PointLight(0xb6a2ec, 6, 6); rim.position.set(-1.6, -.6, -.4);
    this.mic = g;
    this.root.add(g, blob, key, rim);
  }

  /* ------------------------------------------------------------ distant photo cards */
  async buildCards() {
    const group = this.cardGroup = new THREE.Group();
    group.position.set(0, .9, -15.5);
    this.root.add(group);
    const radius = 7.2, step = Math.PI * 2 / this.moments.length;
    const canvases = await Promise.all(this.moments.map((m) => momentCanvas(m, { width: 640, height: 874, small: true })));
    canvases.forEach((cv, i) => {
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: true, toneMapped: true });
      mat.color.setScalar(.55);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.55), mat);
      const a = i * step;
      mesh.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      mesh.lookAt(0, 0, 0); mesh.rotateY(Math.PI);
      mesh.userData.phase = i * 1.7;
      group.add(mesh);
      gsap.to(mat, { opacity: .85, duration: 2.4, delay: .8 + i * .14 });
    });
  }

  /* ------------------------------------------------------------ interaction */
  toLocal(cx, cy, out) {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
    const v = new THREE.Vector3(nx, ny, .5).unproject(this.camera).sub(this.camera.position).normalize();
    const t = (this.points.position.z - this.camera.position.z) / v.z;
    const w = this.camera.position.clone().addScaledVector(v, t);
    return out.set((w.x - this.points.position.x) / this.textScale, (w.y - this.points.position.y) / this.textScale, 0);
  }
  bind() {
    this.onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      if (e.clientY > r.bottom || e.clientY < r.top) { this.mouseLocal.set(99, 99, 0); return; }
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (!this.reduced) this.toLocal(e.clientX, e.clientY, this.mouseLocal);
    };
    this.onLeave = () => this.mouseLocal.set(99, 99, 0);
    this.onDown = (e) => { const r = this.canvas.getBoundingClientRect(); if (e.clientY < r.bottom && e.clientY > r.top && !e.target.closest("a,button,input")) this.shock(e.clientX, e.clientY); };
    addEventListener("pointermove", this.onMove, { passive: true });
    addEventListener("pointerdown", this.onDown, { passive: true });
    document.addEventListener("pointerleave", this.onLeave);
    this.onResize = () => this.resize();
    addEventListener("resize", this.onResize);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { threshold: 0 });
    this.io.observe(this.canvas);
    this.onVis = () => { this.hidden = document.hidden; };
    document.addEventListener("visibilitychange", this.onVis);
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.fx?.setSize(w, h);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 58 : 42;
    this.camera.updateProjectionMatrix();
    // fit the particle text to the viewport: it lives in the upper part of the hero so it never collides with the
    // DOM headline (BUG #19). Visible size of the z=0 plane from the camera:
    const dist = 9, visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), visW = visH * aspect;
    if (aspect < 1) { this.textScale = visW * .46; this.textY = visH * .2; }
    else { this.textScale = Math.min(visW * .33, visH * .62); this.textY = visH * .13; }
    this.points?.scale.setScalar(this.textScale);
    this.points?.position.set(0, this.textY, 0);
    // spout = centre lamp aperture expressed in particle-local space
    if (this.simU) this.simU.uSpout.value.set((0 - 0) / this.textScale, (6.6 - this.textY) / this.textScale, (-3 - 0) / this.textScale);
    const px = this.renderer.getPixelRatio() * (h / 900);
    if (this.pMat) this.pMat.uniforms.uPixel.value = px;
    if (this.dust) this.dust.material.uniforms.uPixel.value = px;
  }

  setScroll(p) { this.scroll = p; }

  /* ------------------------------------------------------------ frame */
  tick() {
    if (!this.visible || this.hidden) return;
    if (this.reduced && this.settle-- <= 0) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 1 / 30);
    const t = this.reduced ? 1 : this.timer.getElapsed();
    const u = this.simU;
    u.uTime.value = t; u.uDt.value = dt || 1 / 60;
    u.uScatter.value += (this.scroll * this.scroll * 1.1 - u.uScatter.value) * .1;
    u.uShockT.value += dt;
    // pointer velocity in local units/s (smoothed)
    if (this.mouseLocal.x < 50 && this.mousePrev.x < 50) this.mouseVel.lerp(this.mouseLocal.clone().sub(this.mousePrev).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 6), .3);
    else this.mouseVel.multiplyScalar(.8);
    this.mousePrev.copy(this.mouseLocal);
    this.gpu.compute();
    this.pMat.uniforms.tPos.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.pMat.uniforms.tVel.value = this.gpu.getCurrentRenderTarget(this.velVar).texture;
    this.pMat.uniforms.uTime.value = t;

    this.spots.forEach((s, i) => {
      const sway = this.reduced ? 0 : Math.sin(t * .35 + i * 2.1) * .07;
      const base = SPOTS[i].tilt + sway;
      s.dir.set(Math.sin(base), -Math.cos(base), .12).normalize();
      s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s.dir);
      s.mesh.material.uniforms.uTime.value = t;
      this.glints[i].position.copy(s.apex).addScaledVector(s.dir, .3);
    });
    this.floor.material.uniforms.uTime.value = t;
    this.curtain.material.uniforms.uTime.value = t;
    this.dust.material.uniforms.uTime.value = t;
    if (this.cardGroup) this.cardGroup.children.forEach((c) => { c.position.y = Math.sin(t * .5 + c.userData.phase) * .35; });
    if (this.mic) this.mic.rotation.y = Math.sin(t * .2) * .08;

    // camera: pointer parallax + scroll dolly-down toward the floor
    const cx = this.pointer.x * .8, cy = this.pointer.y * .35;
    const cam = this.camera;
    cam.position.x += (cx - cam.position.x) * .035;
    cam.position.y += (.3 + cy - this.scroll * 1.6 - cam.position.y) * .05;
    cam.position.z += (9 - this.scroll * 3.5 - cam.position.z) * .06;
    cam.lookAt(0, this.textY * .45 - this.scroll * 1.4, -2);
    this.pMat.uniforms.uFocus.value = cam.position.distanceTo(this.points.position);
    this.fx.render();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    removeEventListener("pointermove", this.onMove);
    removeEventListener("pointerdown", this.onDown);
    removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.io?.disconnect();
    this.gpu?.dispose?.();
    this.fx?.dispose();
    this.renderer.dispose();
  }
}
