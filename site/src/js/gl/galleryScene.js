// 3D Gallery v3 "ULTRA": a night theatre-museum.
//   six gilded baroque frames (Poly Haven CC0) holding layered foil prints behind real glass,
//   each under its own shadow-casting spotlight + volumetric cone; black polished marble floor with
//   a PBR planar reflection; velvet curtain; strings of paper lanterns; 40k dust motes;
//   cinematic intro where the house lights come up one fixture at a time; DOF that racks focus.
// Public API (used by pages/gallery.js) is unchanged:
//   new GalleryScene(canvas, moments, { onHover, onFocus, onLayout }); .onOpen = (i) => …
//   .applyLayout("ring"|"helix"|"wall")  .focus(i)  .unfocus()  .next(dir)
import * as THREE from "three";
import { gsap } from "gsap";
import { createRenderer, applyEnv, makeComposer, quality, hot, visibilityGate } from "./fx/index.js";
import { createMarbleFloor, createCurtain, createLanterns, createDust } from "./gallery/stage.js";
import { createFramedCard } from "./gallery/cards.js";

const FLOOR_Y = -2.2, HANG_Y = .95;
const TWO_PI = Math.PI * 2;

export class GalleryScene {
  constructor(canvas, moments, { onHover, onFocus, onLayout, reduced = false } = {}) {
    Object.assign(this, { canvas, moments, onHover, onFocus, onLayout, reduced });
    this.layout = "ring";
    this.rotY = 0; this.rotTarget = 0; this.rotVel = 0; this.travel = 0; this.travelTarget = 0;
    this.pointer = new THREE.Vector2(9, 9); this.pointerS = new THREE.Vector2();
    this.hovered = -1; this.focused = -1;
    this.drag = { on: false, x: 0, moved: 0, vx: 0, t: 0 };
    this.cards = [];
    this.ready = this.init();
  }

  async init() {
    const r = this.renderer = createRenderer(this.canvas, { exposure: 1.05, shadows: true });
    r.shadowMap.type = THREE.VSMShadowMap;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050405);
    scene.fog = new THREE.FogExp2(0x070506, .028);
    this.camera = new THREE.PerspectiveCamera(40, 1, .1, 140);
    this.camera.position.set(0, 4.5, 30);
    this.lookAt = new THREE.Vector3(0, HANG_Y, 0);
    this.gate = visibilityGate(this.canvas);

    await applyEnv(scene, r, "studio", { intensity: .22 }).catch(() => {});

    // ambient bounce: warm from the lanterns, cool from the floor
    this.hemi = new THREE.HemisphereLight(0xffb27a, 0x1a1c2a, 0);
    scene.add(this.hemi);

    this.world = new THREE.Group();
    scene.add(this.world);

    const aniso = r.capabilities.getMaxAnisotropy();
    this.floor = createMarbleFloor(r, scene, { y: FLOOR_Y, res: quality.tier === "low" ? 512 : 2048, aniso, samples: quality.tier === "low" ? 0 : 4 });
    scene.add(this.floor.mesh);
    this.curtain = createCurtain({ radius: 21, height: 18, y: FLOOR_Y, aniso });
    scene.add(this.curtain.mesh);
    this.lanterns = createLanterns({ count: quality.tier === "low" ? 42 : 96, radius: 17, rings: 3, y: 8.2 });
    scene.add(this.lanterns.group);
    // a few real point lights to carry the lantern glow onto the curtain + floor
    this.lanternLights = [0, 1, 2, 3].map((k) => {
      const l = new THREE.PointLight(0xff7a40, 0, 22, 1.6);
      const a = k / 4 * TWO_PI + .4; l.position.set(Math.sin(a) * 15, 6.5, Math.cos(a) * 15);
      scene.add(l); return l;
    });
    this.dust = createDust({ count: Math.round(40000 * quality.particles), spread: 34, height: 13 });
    scene.add(this.dust.points);

    // centre piece: slowly turning brass armillary that catches the env light
    this.armillary = new THREE.Group();
    const brass = new THREE.MeshPhysicalMaterial({ color: 0xd8b26a, metalness: 1, roughness: .22, clearcoat: .5 });
    [1.15, .95, .75].forEach((rad, k) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, .025, 16, 160), brass);
      ring.rotation.set(k * .9, k * .6, 0); ring.castShadow = true; this.armillary.add(ring);
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.32, 64, 32), quality.tier === "low"
      ? new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1, roughness: .05 })
      : new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: .6, roughness: .04, ior: 1.5, iridescence: 1, iridescenceIOR: 1.3, dispersion: 4, envMapIntensity: 1.4 }));
    this.armillary.add(orb);
    this.orbLight = new THREE.PointLight(0xd8ff4f, 0, 6, 2);
    this.armillary.add(this.orbLight);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, 2.6, 64), new THREE.MeshPhysicalMaterial({ color: 0x0d0d0f, roughness: .25, metalness: .2, clearcoat: 1, clearcoatRoughness: .1 }));
    plinth.position.y = FLOOR_Y + 1.3; plinth.castShadow = plinth.receiveShadow = true;
    this.armillary.position.y = FLOOR_Y + 3.9;
    this.world.add(this.armillary, plinth);

    // cards
    const built = await Promise.all(this.moments.map((m, i) => createFramedCard(r, m, i, { glass: true })));
    built.forEach((c) => { this.world.add(c.holder); this.cards.push(c); });
    this.applyLayout("ring", { instant: true, keepFocus: false });

    // post
    this.fx = makeComposer(r, scene, this.camera, {
      bloom: { strength: .62, radius: .55, threshold: .88 },
      dof: { focus: 12, aperture: .00028, maxblur: .006 },
      gtao: false, smaa: true,
      final: { ca: .0016, grain: .05, vignette: .46, halation: .16 }
    });
    // keep additive volumetrics + dust out of the DOF depth pass (they would "focus" the blur on air)
    const dof = this.fx.passes.dof;
    if (dof) {
      const orig = dof.render.bind(dof);
      const additive = () => [this.dust.points, ...this.cards.map((c) => c.cone.mesh), ...this.cards.map((c) => c.glass).filter(Boolean)];
      dof.render = (...a) => { const list = additive(); list.forEach((o) => (o.visible = false)); orig(...a); list.forEach((o) => (o.visible = true)); };
    }

    // compile every program up-front (KHR_parallel_shader_compile) so the first frame doesn't stall
    try { await r.compileAsync(scene, this.camera); } catch { /* older drivers */ }
    // a lost context (driver reset / GPU watchdog) must never leave a black page
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; this.onContextLost?.(); }, { once: true });

    this.raycaster = new THREE.Raycaster();
    this.timer = new THREE.Timer();
    this.bind();
    this.resize();
    this.intro();
    r.setAnimationLoop(() => this.tick());
  }

  /* ---------------------------------------------------------------- intro: house lights up */
  intro() {
    const tl = this.introTl = gsap.timeline({ defaults: { ease: "power2.out" } });
    const quick = this.reduced;
    const cam = this.camera.position;
    if (quick) cam.set(0, 1.7, 13.6);
    else tl.to(cam, { x: 0, y: 1.7, z: 13.6, duration: 5.2, ease: "expo.inOut" }, 0);
    tl.to(this.lanterns.uniforms.uPower, { value: 1, duration: quick ? .01 : 2.4 }, quick ? 0 : .2);
    this.lanternLights.forEach((l, k) => tl.to(l, { intensity: 26, duration: quick ? .01 : 2 }, quick ? 0 : .3 + k * .15));
    tl.to(this.hemi, { intensity: .35, duration: quick ? .01 : 2.5 }, quick ? 0 : .5);
    this.cards.forEach((c, k) => {
      const at = quick ? 0 : 1.1 + k * .32;
      // a fixture "strikes": quick flicker, then settles
      if (!quick) tl.to(c.spot, { intensity: 140, duration: .06, repeat: 3, yoyo: true, ease: "none" }, at);
      tl.to(c.spot, { intensity: 260, duration: quick ? .01 : .9 }, at + (quick ? 0 : .25));
      tl.to(c.cone.uniforms.uIntensity, { value: .2, duration: quick ? .01 : 1.2 }, at + (quick ? 0 : .25));
      tl.to(c.mat.uniforms.uPower, { value: 1, duration: quick ? .01 : 1.4 }, at + (quick ? 0 : .2));
      tl.to(c.lens.material.color, { r: 6, g: 5.4, b: 4.6, duration: quick ? .01 : .5 }, at);
    });
    tl.to(this.orbLight, { intensity: 6, duration: quick ? .01 : 2 }, quick ? 0 : 3);
  }

  /* ---------------------------------------------------------------- layouts */
  layoutFor(kind, i) {
    const n = this.moments.length;
    if (kind === "ring") {
      const a = i / n * TWO_PI, R = 7.4;
      return { p: [Math.sin(a) * R, HANG_Y, Math.cos(a) * R], r: [0, a, 0], s: 1, a };
    }
    if (kind === "helix") {
      const a = i / n * Math.PI * 2.6, R = 7.4;
      return { p: [Math.sin(a) * R, HANG_Y - .4 + i * 1.25, Math.cos(a) * R], r: [0, a, 0], s: .82, a };
    }
    const col = i % 3, row = Math.floor(i / 3);
    return { p: [(col - 1) * 3.05, row === 0 ? 3.15 : -.15, 2.2 - Math.abs(col - 1) * .55], r: [0, -(col - 1) * .2, 0], s: .7, a: 0 };
  }
  applyLayout(kind, { instant = false, keepFocus = true } = {}) {
    const prev = this.focused;
    this.layout = kind;
    this.cards.forEach((c, i) => {
      const { p, r, s } = this.layoutFor(kind, i);
      const d = instant ? 0 : 1.8, delay = instant ? 0 : i * .05;
      gsap.to(c.holder.position, { x: p[0], y: p[1], z: p[2], duration: d, ease: "expo.inOut", delay, overwrite: true });
      gsap.to(c.holder.rotation, { x: r[0], y: r[1], z: r[2], duration: d, ease: "expo.inOut", delay, overwrite: true });
      gsap.to(c.holder.scale, { x: s, y: s, z: s, duration: d, ease: "expo.inOut", delay, overwrite: true });
      if (!instant) gsap.fromTo(c.mat.uniforms.uBend, { value: 0 }, { value: 1, duration: .9, yoyo: true, repeat: 1, ease: "sine.inOut", delay });
    });
    if (kind === "wall") this.rotTarget = Math.round(this.rotTarget / TWO_PI) * TWO_PI;
    if (kind !== "helix") this.travelTarget = 0;
    this.onLayout?.(kind);
    // BUG #42: keep the selected card selected across layout changes
    if (keepFocus && prev >= 0) this.focus(prev); else if (!keepFocus) this.unfocus();
  }

  focus(i) {
    if (!this.cards[i]) return;
    this.focused = i;
    if (this.layout !== "wall") {
      const target = -this.layoutFor(this.layout, i).a;
      this.rotTarget = target + Math.round((this.rotTarget - target) / TWO_PI) * TWO_PI;
    }
    if (this.layout === "helix") this.travelTarget = this.layoutFor("helix", i).p[1] - HANG_Y;
    this.cards.forEach((c, k) => {
      gsap.to(c.mat.uniforms.uDim, { value: k === i ? 0 : 1, duration: .9, overwrite: true });
      gsap.to(c.spot, { intensity: k === i ? 420 : 110, duration: 1.2, overwrite: "auto" });
      gsap.to(c.cone.uniforms.uIntensity, { value: k === i ? .32 : .08, duration: 1.2, overwrite: true });
    });
    gsap.to(this.lanterns.uniforms.uPower, { value: .45, duration: 1.2 });
    this.onFocus?.(i);
  }
  unfocus() {
    const was = this.focused;
    this.focused = -1;
    this.cards.forEach((c) => {
      gsap.to(c.mat.uniforms.uDim, { value: 0, duration: .9, overwrite: true });
      if (this.introTl?.isActive()) return;
      gsap.to(c.spot, { intensity: 260, duration: 1.2, overwrite: "auto" });
      gsap.to(c.cone.uniforms.uIntensity, { value: .2, duration: 1.2, overwrite: true });
    });
    if (!this.introTl?.isActive()) gsap.to(this.lanterns.uniforms.uPower, { value: 1, duration: 1.2 });
    if (was >= 0 || this.onFocusInit !== true) { this.onFocusInit = true; this.onFocus?.(-1); }
  }
  // BUG #43: from "nothing selected", ← goes to the last card, → to the first
  next(dir = 1) {
    const n = this.moments.length;
    const i = this.focused < 0 ? (dir > 0 ? 0 : n - 1) : ((this.focused + dir) % n + n) % n;
    this.focus(i);
  }

  /* ---------------------------------------------------------------- input */
  bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => { this.drag = { on: true, x: e.clientX, moved: 0, vx: 0, t: performance.now() }; c.setPointerCapture?.(e.pointerId); });
    c.addEventListener("pointermove", (e) => {
      const b = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      if (this.drag.on) {
        const dx = e.clientX - this.drag.x; this.drag.x = e.clientX; this.drag.moved += Math.abs(dx);
        if (this.layout !== "wall") { this.rotTarget += dx * .0055; this.drag.vx = dx; }
      }
    });
    const up = () => {
      if (!this.drag.on) return;
      const click = this.drag.moved < 6;
      this.drag.on = false;
      if (click) { if (this.hovered >= 0) (this.focused === this.hovered ? this.onOpen?.(this.hovered) : this.focus(this.hovered)); else if (this.focused >= 0) this.unfocus(); }
      else this.rotVel = this.drag.vx * .0055 * .9; // inertial flick
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", () => { if (!this.drag.on) this.pointer.set(9, 9); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.layout === "helix") this.travelTarget = THREE.MathUtils.clamp(this.travelTarget + e.deltaY * .004, -.6, 6.6);
      else if (this.layout === "ring") this.rotTarget += e.deltaY * .0016;
    }, { passive: false });
    this.onResize = () => this.resize();
    addEventListener("resize", this.onResize);
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.fx?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.fov = w / h < 1 ? 58 : 40; this.camera.updateProjectionMatrix();
    this.dust.uniforms.uPixel.value = h * this.renderer.getPixelRatio() / 900;
  }

  /* ---------------------------------------------------------------- frame */
  tick() {
    if (!this.gate.active() || this.paused || this.lost) return;
    const t0 = performance.now();
    this.timer.update();
    const t = this.timer.getElapsed(), dt = Math.min(this.timer.getDelta(), .05);
    const idle = !this.drag.on && this.focused < 0 && this.layout === "ring" && !this.reduced;
    if (idle) this.rotTarget += dt * .045;
    this.rotTarget += this.rotVel; this.rotVel *= .93;
    this.rotY += (this.rotTarget - this.rotY) * (1 - Math.pow(.001, dt));
    this.travel += (this.travelTarget - this.travel) * (1 - Math.pow(.01, dt));
    this.world.rotation.y = this.layout === "wall" ? 0 : this.rotY;
    this.world.position.y = -this.travel;
    this.lanterns.group.rotation.y = -this.rotY * .25 + t * .006;
    this.curtain.mesh.rotation.y = this.rotY * .12;
    this.armillary.rotation.y = t * .18; this.armillary.children.forEach((ring, k) => { if (ring.geometry?.type === "TorusGeometry") ring.rotation.z = t * (.1 + k * .07); });

    // pointer smoothing for parallax / torch
    const px = this.pointer.x > 5 ? 0 : this.pointer.x, py = this.pointer.y > 5 ? 0 : this.pointer.y;
    this.pointerS.x += (px - this.pointerS.x) * .06; this.pointerS.y += (py - this.pointerS.y) * .06;

    // hover (raycast against the prints only)
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.cards.length && this.pointer.x < 5 ? this.raycaster.intersectObjects(this.cards.map((c) => c.card)) : [];
    const hov = hits.length ? hits[0].object.userData.index : -1;
    if (hits.length && hits[0].uv) this.cards[hov].mat.uniforms.uPointer.value.lerp(hits[0].uv, .25);
    if (hov !== this.hovered) { this.hovered = hov; this.canvas.style.cursor = hov >= 0 ? "pointer" : "grab"; this.onHover?.(hov); }

    this.cards.forEach((c, i) => {
      const u = c.mat.uniforms; u.uTime.value = t;
      const target = i === this.hovered || i === this.focused ? 1 : 0;
      u.uHover.value += (target - u.uHover.value) * (1 - Math.pow(.002, dt));
      c.inner.position.z = u.uHover.value * .22;
      c.inner.position.y = this.reduced ? 0 : Math.sin(t * .7 + i * 1.3) * .045;
      c.inner.rotation.z = this.reduced ? 0 : Math.sin(t * .5 + i) * .006;
      c.cone.uniforms.uTime.value = t;
    });
    this.lanterns.uniforms.uTime.value = t;
    this.curtain.uniforms.uTime.value = t;
    this.dust.uniforms.uTime.value = t;
    this.lanternLights.forEach((l, k) => { if (!this.introTl?.isActive()) l.intensity = (this.focused >= 0 ? 12 : 26) * (.92 + .08 * Math.sin(t * 6 + k * 2.1)); });

    // camera
    let target = new THREE.Vector3(this.pointerS.x * .9, 1.7 + this.pointerS.y * .45, this.layout === "wall" ? 12.4 : 14.2);
    let look = new THREE.Vector3(this.pointerS.x * .25, HANG_Y + .1, 0);
    if (this.focused >= 0) {
      const holder = this.cards[this.focused].holder;
      const wp = new THREE.Vector3(); holder.getWorldPosition(wp);
      const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(holder.getWorldQuaternion(new THREE.Quaternion()));
      const dist = (this.camera.aspect < 1 ? 7.4 : 5.1) * holder.scale.x;
      target = wp.clone().add(nrm.multiplyScalar(dist)).add(new THREE.Vector3(this.pointerS.x * .35, .1 + this.pointerS.y * .22, 0));
      look = wp.clone().add(new THREE.Vector3(0, this.camera.aspect < 1 ? -.55 : -.15, 0));
    }
    if (!this.introTl?.isActive() || this.introTl.time() > 4.6) this.camera.position.lerp(target, 1 - Math.pow(.04, dt));
    this.lookAt.lerp(look, 1 - Math.pow(.02, dt));
    this.camera.lookAt(this.lookAt);
    // rack focus onto whatever we're looking at
    const fd = this.camera.position.distanceTo(this.lookAt);
    this.fx.setFocus(this.focusDist = (this.focusDist ?? fd) + (fd - (this.focusDist ?? fd)) * .1);

    this.floor.update(this.camera, [this.dust.points]);
    this.fx.render();
    this.frameMs = performance.now() - t0; this.frames = (this.frames || 0) + 1;
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    removeEventListener("resize", this.onResize);
    this.gate.dispose(); this.fx.dispose(); this.renderer.dispose();
  }
}
