// 3D Gallery: six glossy photo-cards in an infinite dark hall. Three layouts (ring / helix / wall),
// drag-to-orbit, wheel to travel, raycast hover + click to focus, reflective floor, bloom.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { momentCanvas } from "./cardTexture.js";

const CARD_W = 2.4, CARD_H = 3.28;

const cardVert = /* glsl */`
  uniform float uTime, uHover, uBend;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159) * uBend * .35;           // flag-like bend while moving
    p.z += sin(uv.y * 6. + uTime * 2.) * .02 * uHover;   // shimmer on hover
    vec4 w = modelMatrix * vec4(p, 1.);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const cardFrag = /* glsl */`
  uniform sampler2D uMap; uniform float uTime, uHover, uDim; uniform vec3 uAccent;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main(){
    vec4 tex = texture2D(uMap, vUv);
    vec3 view = normalize(cameraPosition - vW);
    float fres = pow(1. - abs(dot(normalize(vN), view)), 2.5);
    // holographic sweep
    float sweep = smoothstep(.0, .12, .12 - abs(fract(vUv.x * .6 + vUv.y * .4 - uTime * .12) - .5));
    vec3 holo = .5 + .5 * cos(6.2831 * (vUv.x + vUv.y + uTime * .1 + vec3(0., .33, .67)));
    vec3 col = tex.rgb * (1. - uDim * .65);
    col += holo * sweep * .22 * (.3 + uHover);
    col += uAccent * fres * (.35 + uHover * .9);
    // edge frame glow
    vec2 e = min(vUv, 1. - vUv);
    float edge = smoothstep(.012, .0, min(e.x, e.y * .73));
    col += uAccent * edge * (.6 + uHover * 1.4);
    gl_FragColor = vec4(col, 1.);
  }`;

export class GalleryScene {
  constructor(canvas, moments, { onHover, onFocus, onLayout } = {}) {
    Object.assign(this, { canvas, moments, onHover, onFocus, onLayout });
    this.layout = "ring";
    this.rotY = 0; this.rotTarget = 0; this.travel = 0; this.travelTarget = 0;
    this.pointer = new THREE.Vector2(9, 9);
    this.hovered = -1; this.focused = -1;
    this.drag = { on: false, x: 0, moved: 0, vx: 0 };
    this.init();
  }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c0d);
    scene.fog = new THREE.Fog(0x0b0c0d, 12, 38);
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    this.camera = new THREE.PerspectiveCamera(45, 1, .1, 120);
    this.camera.position.set(0, 1.4, 12);

    this.world = new THREE.Group();
    scene.add(this.world);
    this.buildFloor();
    this.buildArches();
    this.buildParticles();

    this.cards = [];
    const canvases = await Promise.all(this.moments.map((m) => momentCanvas(m, { width: 768, height: 1050 })));
    canvases.forEach((cv, i) => {
      const m = this.moments[i];
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = r.capabilities.getMaxAnisotropy();
      const mat = new THREE.ShaderMaterial({ vertexShader: cardVert, fragmentShader: cardFrag, side: THREE.DoubleSide, uniforms: { uMap: { value: tex }, uTime: { value: 0 }, uHover: { value: 0 }, uBend: { value: 0 }, uDim: { value: 0 }, uAccent: { value: new THREE.Color(m.accent) } } });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H, 24, 24), mat);
      mesh.userData.index = i;
      const holder = new THREE.Group();
      holder.add(mesh);
      // glass back panel + accent light
      const back = new THREE.Mesh(new THREE.BoxGeometry(CARD_W + .08, CARD_H + .08, .05), new THREE.MeshPhysicalMaterial({ color: 0x111315, metalness: .6, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }));
      back.position.z = -.04;
      holder.add(back);
      const light = new THREE.PointLight(new THREE.Color(m.accent), 6, 6, 2);
      light.position.set(0, 0, 1.2);
      holder.add(light);
      this.world.add(holder);
      this.cards.push({ holder, mesh, mat, light });
    });
    this.applyLayout("ring", true);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .45, .45, .7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.timer = new THREE.Timer();
    this.bind();
    this.resize();
    r.setAnimationLoop(() => this.tick());
    gsap.from(this.camera.position, { z: 26, y: 5, duration: 3, ease: "expo.out" });
  }

  buildFloor() {
    const mirror = new Reflector(new THREE.PlaneGeometry(80, 80), { textureWidth: 1024, textureHeight: 1024, color: 0x3a3d40, clipBias: .003 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -2.2;
    this.world.add(mirror);
    // additive neon grid over the mirror so it reads as a glossy stage floor
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 g = vUv * 80.; vec2 f = abs(fract(g - .5) - .5) / fwidth(g); float l = 1. - min(min(f.x, f.y), 1.); float fade = smoothstep(.4, .0, distance(vUv, vec2(.5))); gl_FragColor = vec4(vec3(.85, 1., .31) * l * .22 * fade, 1.); }`
    }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -2.19;
    this.world.add(grid);
  }
  buildArches() {
    this.arches = new THREE.Group();
    const colors = ["#d8ff4f", "#b6a2ec", "#ffad82", "#ff90b4", "#9fc4ff", "#ffd979"];
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.TorusGeometry(9, .025, 8, 120, Math.PI);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors[i % 6]).multiplyScalar(1.4), transparent: true, opacity: .55, fog: true });
      const arch = new THREE.Mesh(geo, mat);
      arch.position.set(0, -2.2, -i * 5 + 10);
      this.arches.add(arch);
    }
    this.world.add(this.arches);
  }
  buildParticles() {
    const n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 40; pos[i * 3 + 1] = Math.random() * 14 - 2; pos[i * 3 + 2] = (Math.random() - .5) * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .04, color: 0xeef0e8, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.world.add(this.dust);
  }

  layoutFor(kind, i) {
    const n = this.moments.length, a = i / n * Math.PI * 2;
    if (kind === "ring") { const R = 7; return { p: [Math.sin(a) * R, 0, Math.cos(a) * R], r: [0, a * .5, 0], a }; }
    if (kind === "helix") { const R = 5.2, aa = i / n * Math.PI * 3; return { p: [Math.sin(aa) * R, i * 1.1 - 2.4, Math.cos(aa) * R], r: [0, aa * .6, 0], a: aa }; }
    // wall: 3x2 grid, slightly curved
    const col = i % 3, row = Math.floor(i / 3);
    const x = (col - 1) * 2.9, y = (0.5 - row) * 3.7 + .1;
    return { p: [x, y, -Math.abs(col - 1) * .6], r: [0, -(col - 1) * .22, 0] };
  }
  applyLayout(kind, instant = false) {
    this.layout = kind;
    this.cards.forEach((c, i) => {
      const { p, r } = this.layoutFor(kind, i);
      const d = instant ? 0 : 1.8;
      gsap.to(c.holder.position, { x: p[0], y: p[1], z: p[2], duration: d, ease: "expo.inOut", delay: instant ? 0 : i * .04 });
      gsap.to(c.holder.rotation, { x: r[0], y: r[1], z: r[2], duration: d, ease: "expo.inOut", delay: instant ? 0 : i * .04 });
      if (!instant) gsap.fromTo(c.mat.uniforms.uBend, { value: 0 }, { value: 1, duration: .9, yoyo: true, repeat: 1, ease: "sine.inOut", delay: i * .04 });
    });
    if (kind === "wall") { this.rotTarget = Math.round(this.rotTarget / (Math.PI * 2)) * Math.PI * 2; }
    this.unfocus();
    this.onLayout?.(kind);
  }

  focus(i) {
    if (!this.cards[i]) return;
    this.focused = i;
    const world = new THREE.Vector3();
    // rotate world so card faces camera in ring/helix
    if (this.layout !== "wall") {
      const { a } = this.layoutFor(this.layout, i);
      const target = -a;
      const twoPi = Math.PI * 2;
      this.rotTarget = target + Math.round((this.rotTarget - target) / twoPi) * twoPi;
    }
    this.cards.forEach((c, k) => gsap.to(c.mat.uniforms.uDim, { value: k === i ? 0 : 1, duration: .8 }));
    setTimeout(() => {
      this.cards[i].holder.getWorldPosition(world);
      this.focusPoint = world.clone();
    }, 0);
    this.onFocus?.(i);
  }
  unfocus() {
    this.focused = -1; this.focusPoint = null;
    this.cards?.forEach((c) => gsap.to(c.mat.uniforms.uDim, { value: 0, duration: .8 }));
    this.onFocus?.(-1);
  }
  next(dir = 1) { const n = this.moments.length; this.focus(((this.focused < 0 ? 0 : this.focused + dir) % n + n) % n); }

  bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => { this.drag = { on: true, x: e.clientX, moved: 0, vx: 0 }; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => {
      const b = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      if (this.drag.on) { const dx = e.clientX - this.drag.x; this.drag.x = e.clientX; this.drag.moved += Math.abs(dx); this.rotTarget += dx * .006; this.drag.vx = dx; }
    });
    c.addEventListener("pointerup", () => {
      const click = this.drag.moved < 6;
      this.drag.on = false;
      if (click) { if (this.hovered >= 0) (this.focused === this.hovered ? this.onOpen?.(this.hovered) : this.focus(this.hovered)); else this.unfocus(); }
      else this.rotTarget += this.drag.vx * .03;
    });
    c.addEventListener("pointerleave", () => { this.pointer.set(9, 9); });
    c.addEventListener("wheel", (e) => { e.preventDefault(); if (this.layout === "helix") this.travelTarget = Math.max(-2.5, Math.min(3.5, this.travelTarget - e.deltaY * .004)); else this.rotTarget += e.deltaY * .0016; }, { passive: false });
    addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => { this.hidden = document.hidden; });
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.fov = w / h < 1 ? 62 : 45; this.camera.updateProjectionMatrix();
  }

  tick() {
    if (this.hidden) return;
    this.timer.update();
    const t = this.timer.getElapsed();
    if (!this.drag.on && this.focused < 0 && this.layout !== "wall") this.rotTarget += .0012;
    this.rotY += (this.rotTarget - this.rotY) * .06;
    this.travel += (this.travelTarget - this.travel) * .06;
    this.world.rotation.y = this.layout === "wall" ? this.rotY * .0 : this.rotY;
    this.world.position.y = -this.travel;
    this.arches.rotation.y = -this.rotY * .5;
    this.dust.rotation.y = t * .01;
    // hover
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.cards.length ? this.raycaster.intersectObjects(this.cards.map((c) => c.mesh)) : [];
    const hov = hits.length ? hits[0].object.userData.index : -1;
    if (hov !== this.hovered) { this.hovered = hov; this.canvas.style.cursor = hov >= 0 ? "pointer" : "grab"; this.onHover?.(hov); }
    this.cards.forEach((c, i) => {
      const u = c.mat.uniforms; u.uTime.value = t;
      u.uHover.value += ((i === this.hovered || i === this.focused ? 1 : 0) - u.uHover.value) * .1;
      const lift = u.uHover.value * .25;
      c.mesh.position.z = lift; c.mesh.position.y = Math.sin(t * .8 + i) * .08;
      c.light.intensity = 3 + u.uHover.value * 10;
    });
    // camera
    const px = this.pointer.x > 5 ? 0 : this.pointer.x, py = this.pointer.y > 5 ? 0 : this.pointer.y;
    let target = new THREE.Vector3(px * .8, 1.3 + py * .4, this.layout === "wall" ? 10.5 : 15.5);
    let look = new THREE.Vector3(0, .2, 0);
    if (this.focused >= 0) {
      const wp = new THREE.Vector3(); this.cards[this.focused].holder.getWorldPosition(wp);
      const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(this.cards[this.focused].holder.getWorldQuaternion(new THREE.Quaternion()));
      target = wp.clone().add(nrm.multiplyScalar(this.camera.aspect < 1 ? 6.2 : 4.4)).add(new THREE.Vector3(px * .3, py * .2, 0));
      look = wp;
    }
    this.camera.position.lerp(target, .05);
    this.lookAt = (this.lookAt || look.clone()).lerp(look, .08);
    this.camera.lookAt(this.lookAt);
    this.composer.render();
  }
}
