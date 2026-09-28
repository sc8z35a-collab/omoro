// Hero: particle typography morphing between quotes + orbiting photo cards + volumetric spot cones + bloom.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { gsap } from "gsap";
import { momentCanvas, ensureFonts } from "./cardTexture.js";
import { isMobile } from "../core/env.js";

const COUNT_DESKTOP = 14000;
const COUNT_MOBILE = 6500;

// Sample the visible pixels of a rendered string into N points in [-1..1] space.
function sampleText(lines, count, { family = `"Dela Gothic One", "Zen Kaku Gothic New", sans-serif` } = {}) {
  const W = 1400, H = 700;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let size = 300;
  do { ctx.font = `400 ${size}px ${family}`; size -= 6; } while (Math.max(...lines.map((l) => ctx.measureText(l).width)) > W * .92 || size * 1.1 * lines.length > H * .92);
  const lh = size * 1.14;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
  const data = ctx.getImageData(0, 0, W, H).data;
  const pts = [];
  const step = 3;
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4] > 128) pts.push(x, y);
  const out = new Float32Array(count * 3);
  const n = pts.length / 2;
  for (let i = 0; i < count; i++) {
    const k = n ? Math.floor(Math.random() * n) : 0;
    out[i * 3] = n ? (pts[k * 2] / W - .5) * 2 + (Math.random() - .5) * .004 : (Math.random() - .5) * 2;
    out[i * 3 + 1] = n ? -(pts[k * 2 + 1] / H - .5) * 1 : (Math.random() - .5);
    out[i * 3 + 2] = (Math.random() - .5) * .06;
  }
  return out;
}

const particleVert = /* glsl */`
  uniform float uTime, uMix, uSize, uScatter, uPixel;
  uniform vec3 uMouse;
  attribute vec3 aFrom, aTo;
  attribute float aRand;
  varying float vAlpha, vRand;
  // cheap hash noise
  vec3 hash3(float n){ return fract(sin(vec3(n, n+1.0, n+2.0)) * vec3(43758.5453, 22578.1459, 19642.3490)) - .5; }
  void main(){
    float t = clamp((uMix * 1.7) - aRand * .7, 0., 1.);
    t = t * t * (3. - 2. * t);
    vec3 p = mix(aFrom, aTo, t);
    // swirl mid-transition
    float mid = sin(t * 3.14159);
    p += hash3(aRand * 100.) * mid * 1.6;
    p.z += mid * (aRand - .5) * 2.;
    // idle breathing
    p += vec3(sin(uTime * .9 + aRand * 40.), cos(uTime * .7 + aRand * 30.), sin(uTime * .5 + aRand * 20.)) * .012;
    // scatter on scroll
    p += hash3(aRand * 71.) * uScatter * 9.;
    // mouse repulsion (in world units)
    vec3 d = p - uMouse;
    float dist = length(d.xy);
    float force = smoothstep(.9, 0., dist);
    p.xy += normalize(d.xy + 1e-4) * force * .45;
    p.z += force * .6;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (0.6 + aRand * .8) * (1. / -mv.z);
    vAlpha = .55 + .45 * (1. - mid) ;
    vRand = aRand;
  }`;
const particleFrag = /* glsl */`
  uniform vec3 uColorA, uColorB;
  uniform float uTime;
  varying float vAlpha, vRand;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float d = length(c);
    if (d > .5) discard;
    float core = smoothstep(.5, .0, d);
    vec3 col = mix(uColorA, uColorB, step(.86, vRand));
    col += .25 * sin(uTime * 2. + vRand * 30.);
    gl_FragColor = vec4(col * (0.55 + core * .6), core * vAlpha * .85);
  }`;

const coneVert = /* glsl */`
  varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const coneFrag = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity, uTime;
  varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){
    float rim = pow(abs(dot(vN, vV)), 1.6);
    float fall = pow(vY, 1.4);
    float flicker = .92 + .08 * sin(uTime * 3. + vY * 10.);
    gl_FragColor = vec4(uColor, rim * fall * uOpacity * flicker);
  }`;

const floorFrag = /* glsl */`
  uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
  void main(){
    vec2 g = vUv * 60.;
    vec2 grid = abs(fract(g - .5) - .5) / fwidth(g);
    float line = 1. - min(min(grid.x, grid.y), 1.);
    float r = distance(vUv, vec2(.5));
    float fade = smoothstep(.5, .05, r);
    float pulse = smoothstep(.02, .0, abs(fract(r * 4. - uTime * .12) - .5) - .47);
    vec3 col = uColor * (line * .35 + pulse * .25) * fade;
    col += vec3(.02, .022, .02) * fade;
    gl_FragColor = vec4(col, fade);
  }`;

export class HeroScene {
  constructor(canvas, moments, { onReady } = {}) {
    this.canvas = canvas;
    this.moments = moments;
    this.index = 0;
    this.mobile = isMobile();
    this.count = this.mobile ? COUNT_MOBILE : COUNT_DESKTOP;
    this.pointer = new THREE.Vector2(0, 0);
    this.mouseWorld = new THREE.Vector3(99, 99, 0);
    this.scroll = 0;
    this.visible = true;
    this.clock = new THREE.Timer();
    this.onReady = onReady;
    this.init();
  }

  async init() {
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    renderer.setClearColor(0x0b0c0d, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0c0d, .045);
    const camera = this.camera = new THREE.PerspectiveCamera(this.mobile ? 55 : 42, 1, .1, 200);
    camera.position.set(0, .3, 9);
    this.root = new THREE.Group();
    scene.add(this.root);

    await ensureFonts();
    this.buildParticles();
    this.buildCones();
    this.buildFloor();
    this.buildDust();
    this.buildCards(); // async textures, non-blocking

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), this.mobile ? .55 : .7, .45, .42);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    this.bind();
    renderer.setAnimationLoop(() => this.tick());
    this.onReady?.();
  }

  buildParticles() {
    const geo = new THREE.BufferGeometry();
    const from = new Float32Array(this.count * 3);
    for (let i = 0; i < from.length; i++) from[i] = (Math.random() - .5) * 14;
    this.targets = this.moments.map((m) => sampleText(m.lines, this.count));
    this.introTarget = sampleText(["面白い", "ねえ。"], this.count);
    const rand = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) rand[i] = Math.random();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(this.introTarget.slice(), 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    this.pMat = new THREE.ShaderMaterial({
      vertexShader: particleVert, fragmentShader: particleFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMix: { value: 0 }, uSize: { value: this.mobile ? 30 : 24 }, uPixel: { value: 1 }, uScatter: { value: 0 }, uMouse: { value: this.mouseWorld }, uColorA: { value: new THREE.Color("#eef0e8") }, uColorB: { value: new THREE.Color("#d8ff4f") } }
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.textScale = this.mobile ? 2.1 : 3.7;
    this.points.scale.set(this.textScale, this.textScale, this.textScale);
    this.points.position.y = 1.45;
    this.root.add(this.points);
    gsap.to(this.pMat.uniforms.uMix, { value: 1, duration: 3.2, ease: "power2.inOut", delay: .2 });
  }

  morphTo(targetArray, accent) {
    const geo = this.points.geometry;
    const from = geo.getAttribute("aFrom"), to = geo.getAttribute("aTo");
    // current resting positions are "to" (uMix == 1). Snap from <- to.
    from.array.set(to.array); from.needsUpdate = true;
    to.array.set(targetArray); to.needsUpdate = true;
    this.pMat.uniforms.uMix.value = 0;
    gsap.killTweensOf(this.pMat.uniforms.uMix);
    gsap.to(this.pMat.uniforms.uMix, { value: 1, duration: 2.1, ease: "power3.inOut" });
    if (accent) {
      const c = new THREE.Color(accent);
      gsap.to(this.pMat.uniforms.uColorB.value, { r: c.r, g: c.g, b: c.b, duration: 1.2 });
      this.cones.forEach((cone, i) => { if (i === 1) gsap.to(cone.material.uniforms.uColor.value, { r: c.r, g: c.g, b: c.b, duration: 1.4 }); });
      gsap.to(this.floor.material.uniforms.uColor.value, { r: c.r, g: c.g, b: c.b, duration: 1.4 });
    }
  }
  show(index) {
    this.index = (index + this.moments.length) % this.moments.length;
    this.morphTo(this.targets[this.index], this.moments[this.index].accent);
    if (this.cardGroup) gsap.to(this.cardGroup.rotation, { y: -this.index * (Math.PI * 2 / this.moments.length), duration: 2, ease: "power3.inOut" });
  }
  showIntro() { this.morphTo(this.introTarget, "#d8ff4f"); }

  buildCones() {
    this.cones = [];
    const specs = [[-5.5, "#b6a2ec", -.35], [0, "#d8ff4f", 0], [5.5, "#ff90b4", .35]];
    for (const [x, color, tilt] of specs) {
      const geo = new THREE.ConeGeometry(2.6, 12, 48, 1, true);
      geo.translate(0, -6, 0);
      const mat = new THREE.ShaderMaterial({ vertexShader: coneVert, fragmentShader: coneFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: x === 0 ? .11 : .07 }, uTime: { value: 0 } } });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.set(x, 7.5, -3);
      cone.rotation.z = tilt;
      cone.userData.baseTilt = tilt;
      this.root.add(cone);
      this.cones.push(cone);
    }
  }
  buildFloor() {
    const geo = new THREE.PlaneGeometry(80, 80);
    const mat = new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`, fragmentShader: floorFrag, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color("#d8ff4f") }, uTime: { value: 0 } } });
    mat.extensions = { derivatives: true };
    this.floor = new THREE.Mesh(geo, mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -2.6;
    this.root.add(this.floor);
  }
  buildDust() {
    const n = this.mobile ? 500 : 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = Math.random() * 12 - 3; pos[i * 3 + 2] = (Math.random() - .5) * 30; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: .035, color: 0xeef0e8, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending });
    this.dust = new THREE.Points(geo, mat);
    this.root.add(this.dust);
  }
  async buildCards() {
    const group = this.cardGroup = new THREE.Group();
    group.position.set(0, .6, -17);
    this.root.add(group);
    const radius = this.mobile ? 8 : 10;
    const step = Math.PI * 2 / this.moments.length;
    const canvases = await Promise.all(this.moments.map((m) => momentCanvas(m, { width: 512, height: 700, small: true })));
    canvases.forEach((cv, i) => {
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.55), mat);
      const a = i * step;
      mesh.position.set(Math.sin(a) * radius, Math.sin(i * 1.7) * .6, Math.cos(a) * radius - 0);
      mesh.lookAt(0, mesh.position.y, 0);
      mesh.rotateY(Math.PI);
      group.add(mesh);
      gsap.to(mat, { opacity: .5, duration: 2, delay: .6 + i * .12 });
    });
  }

  bind() {
    this.onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      // project to z=0 plane in world coordinates relative to points
      const v = new THREE.Vector3(this.pointer.x, this.pointer.y, .5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const t = (0 - this.camera.position.z) / dir.z;
      const world = this.camera.position.clone().add(dir.multiplyScalar(t));
      this.mouseWorld.set((world.x - this.points.position.x) / this.textScale, (world.y - this.points.position.y) / this.textScale, 0);
    };
    this.onLeave = () => this.mouseWorld.set(99, 99, 0);
    addEventListener("pointermove", this.onMove, { passive: true });
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.onResize = () => this.resize();
    addEventListener("resize", this.onResize);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { threshold: 0 });
    this.io.observe(this.canvas);
    document.addEventListener("visibilitychange", () => { this.hidden = document.hidden; });
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.mobile = isMobile();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 60 : 42;
    this.camera.updateProjectionMatrix();
    this.textScale = w / h < 1 ? 2.1 : 3.7;
    this.points?.scale.setScalar(this.textScale);
    if (this.pMat) this.pMat.uniforms.uPixel.value = this.renderer.getPixelRatio() * (h / 900);
  }

  setScroll(p) { this.scroll = p; }

  tick() {
    if (!this.visible || this.hidden) return;
    this.clock.update(); const t = this.clock.getElapsed();
    const u = this.pMat.uniforms;
    u.uTime.value = t;
    u.uScatter.value += ((this.scroll * this.scroll) * .9 - u.uScatter.value) * .12;
    this.cones.forEach((c, i) => { c.material.uniforms.uTime.value = t; c.rotation.z = c.userData.baseTilt + Math.sin(t * .4 + i * 2) * .12; });
    this.floor.material.uniforms.uTime.value = t;
    this.dust.rotation.y = t * .015;
    this.dust.position.y = Math.sin(t * .2) * .2;
    if (this.cardGroup) { this.cardGroup.children.forEach((c, i) => { c.position.y = Math.sin(t * .6 + i * 1.7) * .5; }); }
    // camera parallax + scroll dolly
    const cx = this.pointer.x * .9, cy = this.pointer.y * .45;
    this.camera.position.x += (cx - this.camera.position.x) * .04;
    this.camera.position.y += (.3 + cy - this.scroll * 2 - this.camera.position.y) * .05;
    this.camera.position.z += (9 - this.scroll * 4 - this.camera.position.z) * .06;
    this.camera.lookAt(0, .2 - this.scroll * 1.5, -2);
    this.composer.render();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    removeEventListener("pointermove", this.onMove);
    removeEventListener("resize", this.onResize);
    this.io?.disconnect();
    this.renderer.dispose();
  }
}
