// OMORO 3D Gallery v3 "ULTRA" — a night-time theatre museum (owned by agent C).
//
//  * six moment prints behind glass, each in a gilded baroque frame (Poly Haven CC0 glTF, PBR in code)
//  * polished black marble floor (ambientCG CC0) that *really* reflects: a planar Reflector render
//    target is injected into a MeshPhysicalMaterial, so the spots still light / shadow the floor and
//    the reflection is distorted by the marble's normal map and fades with roughness
//  * velvet stage curtains (Poly Haven CC0 velour, sheen), a lantern garland, neon sign, brass rails
//  * one VSM-shadowed spotlight per frame + additive volumetric cone + 40k lit dust motes
//  * cinematic intro: lights come on one by one, prints "develop" out of black
//  * DOF that racks focus to the focused frame, bloom, shared ULTRA grade (agent A's fx base)
//
// Public API is unchanged from v2: new GalleryScene(canvas, moments, { onHover, onFocus, onLayout })
//   .applyLayout(kind)  .focus(i)  .unfocus()  .next(dir)  .onOpen = (i) => {}
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { gsap } from "gsap";
import { createRenderer, applyEnv, makeComposer, quality, hot, blobTexture, visibilityGate } from "./fx/index.js";
import { momentLayers } from "./cardTexture.js";
import { url } from "../core/data.js";
import { cardVert, cardFrag, lanternVert, lanternFrag, beamVert, beamFrag, dustVert, dustFrag, neonFrag, quadVert } from "./gallery/shaders.js";

const CARD_W = 2.4, CARD_H = 3.28;
const FLOOR_Y = -2.2;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

export class GalleryScene {
  constructor(canvas, moments, { onHover, onFocus, onLayout } = {}) {
    Object.assign(this, { canvas, moments, onHover, onFocus, onLayout });
    this.layout = "ring";
    this.rotY = 0; this.rotTarget = 0; this.rotVel = 0; this.travel = 0; this.travelTarget = 0;
    this.pointer = new THREE.Vector2(9, 9); this.pSmooth = new THREE.Vector2();
    this.hovered = -1; this.focused = -1;
    this.drag = { on: false, x: 0, y: 0, moved: 0, vx: 0 };
    this.intro = { v: 0 };
    this.cards = [];
    this.ready = this.init().catch((e) => { console.error("[gallery]", e); throw e; });
  }

  /* ============================================================ setup */
  async init() {
    const r = this.renderer = createRenderer(this.canvas, { exposure: 1.0, clear: 0x050506 });
    r.shadowMap.type = THREE.VSMShadowMap;
    this.maxAniso = r.capabilities.getMaxAnisotropy();
    RectAreaLightUniformsLib.init();
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040405);
    scene.fog = new THREE.FogExp2(0x060607, .034);
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 140);
    this.camera.position.set(0, 3.6, 30);
    this.lookAt = new THREE.Vector3(0, .4, 0);

    this.world = new THREE.Group(); scene.add(this.world);       // things that rotate with the ring
    this.stage = new THREE.Group(); scene.add(this.stage);       // fixed architecture
    this.tex = new THREE.TextureLoader();

    const env = applyEnv(scene, r, "studio", { intensity: .32 });
    const frameGeo = this.loadFrame();
    const prints = Promise.all(this.moments.map((m) => momentLayers(m, { width: quality.tier === "low" ? 640 : 1280, height: quality.tier === "low" ? 875 : 1750 })));

    this.buildLights();
    this.buildFloor();
    this.buildCurtains();
    this.buildLanterns();
    this.buildRails();
    this.buildNeon();
    this.buildDust();

    const [geo, layers] = await Promise.all([frameGeo, prints, env]);
    layers.forEach((L, i) => this.buildCard(i, L, geo));
    this.applyLayout("ring", true);

    this.fx = makeComposer(r, scene, this.camera, {
      bloom: { strength: .62, radius: .55, threshold: .86 },
      dof: { focus: 15, aperture: .00018, maxblur: .0065 },
      final: { ca: .0016, grain: .05, vignette: .5, halation: .16 }
    });
    this.gate = visibilityGate(this.canvas);
    this.raycaster = new THREE.Raycaster();
    this.timer = new THREE.Timer();
    this.bind();
    this.resize();
    r.setAnimationLoop(() => this.tick());
    this.playIntro();
  }

  tx(path, { srgb = false, repeat = 1 } = {}) {
    const t = this.tex.load(url(path));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = this.maxAniso;
    return t;
  }

  /* ---------- gilded baroque frame (geometry from glTF, gold PBR built here) */
  async loadFrame() {
    let frameGeo = null;
    try {
      const gltf = await new GLTFLoader().loadAsync(url("models/c-frame/frame.gltf"));
      gltf.scene.traverse((o) => { if (o.isMesh && !o.name.toLowerCase().includes("canvas") && !frameGeo) frameGeo = o.geometry; });
    } catch (e) { console.warn("[gallery] frame model failed, using procedural frame", e); }
    if (!frameGeo) {
      const s = new THREE.Shape(); s.moveTo(-.33, -.39); s.lineTo(.33, -.39); s.lineTo(.33, .38); s.lineTo(-.33, .38);
      const hole = new THREE.Path(); hole.moveTo(-.2, -.255); hole.lineTo(-.2, .247); hole.lineTo(.2, .247); hole.lineTo(.2, -.255); s.holes.push(hole);
      frameGeo = new THREE.ExtrudeGeometry(s, { depth: .08, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 4 });
    }
    // model: opening ≈ 0.392 × 0.500 centred at y≈-.004, depth 0 → .09 (front at +z).
    // scale so the opening matches our print (CARD_W × CARD_H) with a tiny overlap.
    const sx = (CARD_W + .06) / .392, sy = (CARD_H + .06) / .5;
    frameGeo = frameGeo.clone();
    frameGeo.translate(0, .004, -.0093);
    frameGeo.scale(sx, sy, (sx + sy) * .5 * .85);
    frameGeo.computeBoundingBox();
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: this.tx("models/c-frame/textures/frame_diff.webp", { srgb: true }),
      normalMap: this.tx("models/c-frame/textures/frame_nor_gl.webp"), normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: this.tx("models/c-frame/textures/frame_rough.webp"),
      metalness: 1, roughness: .9, clearcoat: .35, clearcoatRoughness: .25, envMapIntensity: 1.5
    });
    [goldMat.map, goldMat.normalMap, goldMat.roughnessMap].forEach((t) => t.repeat.set(1, 1));
    this.goldMat = goldMat;
    return frameGeo;
  }

  buildCard(i, L, frameGeo) {
    const m = this.moments[i];
    const mkTex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = this.maxAniso; return t; };
    const uniforms = {
      uPhoto: { value: mkTex(L.photo) }, uInk: { value: mkTex(L.ink) }, uMask: { value: mkTex(L.mask, false) },
      uTime: { value: 0 }, uHover: { value: 0 }, uBend: { value: 0 }, uDim: { value: 0 }, uReveal: { value: reduced ? 1 : 0 }, uLight: { value: reduced ? 1 : 0 },
      uAccent: { value: new THREE.Color(m.accent) }, uPointer: { value: new THREE.Vector2() }, uAspect: { value: new THREE.Vector2(CARD_W / CARD_H, CARD_H / CARD_W) }
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: cardVert, fragmentShader: cardFrag, uniforms });
    const holder = new THREE.Group();
    const inner = new THREE.Group(); holder.add(inner);              // inner = hover lift / float (holder = layout tweens)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H, 32, 32), mat);
    mesh.userData.index = i; mesh.position.z = .012;
    inner.add(mesh);

    // gilded frame
    const frame = new THREE.Mesh(frameGeo, this.goldMat);
    frame.castShadow = true; frame.receiveShadow = true;
    frame.userData.index = i;
    inner.add(frame);
    // museum glass: thin clear coat with fresnel + env reflections, slight smudge
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W + .04, CARD_H + .04), new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: .04, transmission: 0, transparent: true, opacity: .1,
      clearcoat: 1, clearcoatRoughness: .03, iridescence: .35, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 420],
      specularIntensity: 1, envMapIntensity: 2.4, depthWrite: false
    }));
    glass.position.z = .07; glass.userData.index = i;
    inner.add(glass);
    // velvet back board + brass plaque under the frame
    const back = new THREE.Mesh(new THREE.BoxGeometry(CARD_W + 1.05, CARD_H + 1.15, .06), new THREE.MeshPhysicalMaterial({ color: 0x0d0b0c, roughness: .9, sheen: 1, sheenColor: new THREE.Color(m.accent).multiplyScalar(.35), sheenRoughness: .5 }));
    back.position.z = -.09; back.receiveShadow = true; back.castShadow = true;
    inner.add(back);
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.1, .2, .03), new THREE.MeshPhysicalMaterial({ map: this.plaqueTexture(m), metalness: 1, roughness: .32, color: 0xd9b56b, clearcoat: .6 }));
    plaque.position.set(0, -CARD_H / 2 - .5, .02); plaque.castShadow = true;
    inner.add(plaque);

    // stanchion post below + floor contact glow
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 1, 24), this.brassMat());
    post.scale.y = 1; post.castShadow = true;
    holder.add(post);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: blobTexture(), color: hot(m.accent, .55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    this.world.add(glow);

    // per-card key light: spot from above-front, soft VSM shadow
    const spot = new THREE.SpotLight(new THREE.Color("#fff1dc").lerp(new THREE.Color(m.accent), .22), 0, 18, .34, .6, 1.6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(quality.tier === "low" ? 512 : 2048, quality.tier === "low" ? 512 : 2048);
    spot.shadow.radius = 9; spot.shadow.blurSamples = 16; spot.shadow.bias = -.0004; spot.shadow.normalBias = .02;
    spot.shadow.camera.near = 1; spot.shadow.camera.far = 18;
    this.world.add(spot); this.world.add(spot.target);
    const beam = this.makeBeam(m.accent);
    this.world.add(beam);

    this.world.add(holder);
    this.cards.push({ holder, inner, mesh, frame, glass, mat, spot, beam, glow, post, m, light: 0 });
  }

  plaqueTexture(m) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 186;
    const g = c.getContext("2d");
    g.fillStyle = "#c9a45c"; g.fillRect(0, 0, 1024, 186);
    for (let x = 0; x < 1024; x++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .08})`; g.fillRect(x, 0, 1, 186); }
    g.strokeStyle = "rgba(60,40,10,.55)"; g.lineWidth = 6; g.strokeRect(14, 14, 996, 158);
    g.fillStyle = "rgba(48,30,6,.9)"; g.textBaseline = "middle";
    g.font = `500 34px "JetBrains Mono", monospace`; g.fillText(`No.${m.number}`, 44, 64);
    g.font = `700 50px "Zen Kaku Gothic New", sans-serif`; g.fillText(m.title.slice(0, 15), 44, 124);
    g.textAlign = "right"; g.font = `500 28px "JetBrains Mono", monospace`; g.fillText(m.en.toUpperCase().slice(0, 30), 980, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.maxAniso;
    return t;
  }
  brassMat() {
    return this._brass ||= new THREE.MeshPhysicalMaterial({ color: 0xc9a25a, metalness: 1, roughness: .26, clearcoat: .5, clearcoatRoughness: .2 });
  }
  makeBeam(accent) {
    const len = 9.5;
    const geo = new THREE.CylinderGeometry(.08, 2.1, len, 64, 1, true);
    geo.translate(0, -len / 2, 0);  // apex at origin, pointing -Y
    // uv.y: 1 at apex → 0 at base (CylinderGeometry already does top=1)
    const mat = new THREE.ShaderMaterial({ vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color("#ffe9c8").lerp(new THREE.Color(accent), .3).multiplyScalar(1.2) }, uTime: { value: 0 }, uOn: { value: reduced ? 1 : 0 } } });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.len = len; mesh.renderOrder = 5; mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------- light rig */
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0x2a2f40, 0x0a0606, reduced ? .35 : 0);
    this.scene.add(this.hemi);
    // warm house lights bouncing off the curtains (rect area = soft, physically shaped highlights on gold)
    this.rectL = new THREE.RectAreaLight(0xff6a3d, 0, 10, 3); this.rectL.position.set(-13, 2, -8); this.rectL.lookAt(0, 0, 0); this.stage.add(this.rectL);
    this.rectR = new THREE.RectAreaLight(0x7f6bff, 0, 10, 3); this.rectR.position.set(13, 2, -8); this.rectR.lookAt(0, 0, 0); this.stage.add(this.rectR);
    // cold rim from behind
    this.rim = new THREE.DirectionalLight(0x9fc4ff, 0); this.rim.position.set(0, 6, -14); this.stage.add(this.rim);
  }

  /* ---------- floor: black marble + planar reflection injected into physical material */
  buildFloor() {
    const size = 90;
    const res = quality.tier === "low" ? 512 : quality.tier === "high" ? 1024 : 2048;
    const refl = this.reflector = new Reflector(new THREE.PlaneGeometry(size, size), { textureWidth: res, textureHeight: res, clipBias: .002, multisample: quality.tier === "ultra" ? 4 : 0 });
    refl.rotation.x = -Math.PI / 2; refl.position.y = FLOOR_Y - .002;
    // we don't want the plain reflector to draw — only to produce its render target. Its onBeforeRender
    // is triggered when the reflector itself is drawn, so we keep it in the scene but with colorWrite off.
    refl.material.colorWrite = false; refl.material.depthWrite = false;
    refl.renderOrder = -10;
    this.stage.add(refl);
    const rt = refl.getRenderTarget();
    const texMat = refl.material.uniforms.textureMatrix.value;

    const rep = 7;
    const mat = this.floorMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: this.tx("tex/c-marble-col.webp", { srgb: true, repeat: rep }),
      normalMap: this.tx("tex/c-marble-nor.webp", { repeat: rep }), normalScale: new THREE.Vector2(.55, .55),
      roughnessMap: this.tx("tex/c-marble-rough.webp", { repeat: rep }),
      roughness: .5, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: .5
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tReflect = { value: rt.texture };
      sh.uniforms.uReflMatrix = { value: texMat };
      sh.uniforms.uReflRes = { value: new THREE.Vector2(res, res) };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vWorldP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvReflUv = uReflMatrix * vec4(position, 1.);\nvWorldP = (modelMatrix * vec4(position,1.)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D tReflect;\nuniform vec2 uReflRes;\nvarying vec4 vReflUv;\nvarying vec3 vWorldP;")
        .replace("#include <opaque_fragment>", /* glsl */`
          {
            // distort by the marble normal, blur by roughness (9 taps, golden-angle spiral)
            vec2 ruv = vReflUv.xy / vReflUv.w;
            vec3 nV = normal;               // view-space perturbed normal
            ruv += nV.xy * .018;
            float rr = clamp(roughnessFactor, .0, 1.);
            vec3 refl = vec3(0.); float wsum = 0.;
            for (int i = 0; i < 9; i++){
              float fi = float(i);
              float a = fi * 2.39996; float rad = sqrt(fi / 9.) * (1. + rr * 14.);
              vec2 o = vec2(cos(a), sin(a)) * rad / uReflRes;
              float w = 1. - fi / 10.;
              refl += texture2D(tReflect, ruv + o).rgb * w; wsum += w;
            }
            refl /= wsum;
            vec3 Vw = normalize(cameraPosition - vWorldP);
            float fres = .04 + .96 * pow(1. - clamp(Vw.y, 0., 1.), 5.);
            float k = mix(.32, 1., fres) * (1. - rr * .55);
            // fade reflection with distance from the hall centre so the edge of the world never shows
            float fade = smoothstep(40., 14., length(vWorldP.xz));
            outgoingLight += refl * k * fade;
          }
          #include <opaque_fragment>`);
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true;
    this.stage.add(floor);

    // inlaid brass ring + compass rose around the centre (reads as a museum rotunda)
    const ringMat = new THREE.MeshPhysicalMaterial({ color: 0xc9a25a, metalness: 1, roughness: .22, clearcoat: .8 });
    for (const [rad, w] of [[9.6, .05], [9.9, .015], [3.2, .03]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rad, rad + w, 256), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = FLOOR_Y + .003; ring.receiveShadow = true;
      this.stage.add(ring);
    }
    for (let k = 0; k < 16; k++) {
      const len = k % 4 === 0 ? 2.6 : k % 2 === 0 ? 1.6 : .9;
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(.025, len), ringMat);
      ray.rotation.x = -Math.PI / 2; ray.rotation.z = k / 16 * Math.PI * 2;
      ray.position.set(Math.sin(k / 16 * Math.PI * 2) * (len / 2 + .1), FLOOR_Y + .003, Math.cos(k / 16 * Math.PI * 2) * (len / 2 + .1));
      this.stage.add(ray);
    }
  }

  /* ---------- velvet curtains: a cylinder of pleats around the hall */
  buildCurtains() {
    const R = 21, H = 16, seg = 720;
    const geo = new THREE.CylinderGeometry(R, R, H, seg, 24, true);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      const a = Math.atan2(z, x);
      const v = uv.getY(i);
      // pleats: a sum of sines, deeper towards the floor where the fabric pools, gentle swag at the top
      const pleat = Math.sin(a * 96) * .32 + Math.sin(a * 41 + 1.3) * .18 + Math.sin(a * 13) * .1;
      const depth = (.55 + .45 * (1 - v)) * pleat + (v > .92 ? Math.sin(a * 12) * .25 * (v - .92) * 12 : 0);
      const rr = R + depth;
      pos.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    geo.computeVertexNormals();
    const rep = new THREE.Vector2(36, 5);
    const mk = (p, srgb) => { const t = this.tx(p, { srgb }); t.repeat.copy(rep); return t; };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x8a1420, map: mk("tex/c-velvet-col.webp", true), normalMap: mk("tex/c-velvet-nor.webp", false), roughnessMap: mk("tex/c-velvet-rough.webp", false),
      roughness: 1, sheen: 1, sheenRoughness: .38, sheenColor: new THREE.Color(0xff5a62), side: THREE.BackSide, envMapIntensity: .25
    });
    const curtain = new THREE.Mesh(geo, mat);
    curtain.position.y = FLOOR_Y + H / 2 - .3; curtain.receiveShadow = true;
    this.stage.add(curtain);
    // gold fringe (tassels) along the top swag: instanced thin boxes
    const n = 900, tassel = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .02, .55, 5), this.brassMat(), n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2; d.position.set(Math.cos(a) * (R - .5), FLOOR_Y + H - 1.2 - Math.abs(Math.sin(a * 6)) * .6, Math.sin(a) * (R - .5));
      d.rotation.set(0, 0, 0); d.updateMatrix(); tassel.setMatrixAt(i, d.matrix);
    }
    this.stage.add(tassel);
    // valance band at the top
    const val = new THREE.Mesh(new THREE.CylinderGeometry(R - .55, R - .55, 1.1, 256, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x3a0a10, roughness: .9, sheen: 1, sheenColor: new THREE.Color(0xff6a5a), side: THREE.BackSide }));
    val.position.y = FLOOR_Y + H - .6;
    this.stage.add(val);
  }

  /* ---------- lantern garland: two rings of instanced chōchin + strings */
  buildLanterns() {
    const palette = ["#ff3b2f", "#ff5a2a", "#ffb02e", "#ff3b6b", "#ff4a2a"];
    const lat = new THREE.SphereGeometry(.34, 28, 20); lat.scale(1, 1.32, 1);
    const n = 64;
    const mesh = new THREE.InstancedMesh(lat, new THREE.ShaderMaterial({ vertexShader: lanternVert, fragmentShader: lanternFrag, uniforms: { uTime: { value: 0 }, uIntro: { value: reduced ? 2 : 0 } } }), n);
    const phase = new Float32Array(n), delay = new Float32Array(n);
    const d = new THREE.Object3D(), c = new THREE.Color();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ring = i % 2, k = Math.floor(i / 2), m = n / 2;
      const a = k / m * Math.PI * 2 + ring * .1;
      const R = ring ? 12.5 : 16.5;
      const sag = Math.abs(Math.sin(k / m * Math.PI * 8)) ;
      const y = (ring ? 6.4 : 7.6) - sag * 1.1;
      d.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      const s = ring ? .85 : 1.05; d.scale.set(s, s, s);
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, c.set(palette[i % palette.length]));
      phase[i] = Math.random(); delay[i] = .15 + (k / m) * .55 + ring * .05;
      pts.push({ ring, a, R, y });
    }
    mesh.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    mesh.geometry.setAttribute("aDelay", new THREE.InstancedBufferAttribute(delay, 1));
    mesh.frustumCulled = false;
    this.lanterns = mesh;
    this.stage.add(mesh);
    // strings: a catenary curve per ring
    for (const ring of [0, 1]) {
      const R = ring ? 12.5 : 16.5, base = ring ? 6.4 : 7.6, m = 32, curve = [];
      for (let j = 0; j <= 512; j++) { const t = j / 512, a = t * Math.PI * 2 + ring * .1; const sag = Math.abs(Math.sin(t * Math.PI * 8)); curve.push(new THREE.Vector3(Math.cos(a) * R, base + .46 - sag * 1.1, Math.sin(a) * R)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve, true), 1024, .012, 5, true), new THREE.MeshStandardMaterial({ color: 0x150d08, roughness: .8 }));
      this.stage.add(tube);
    }
    // a few warm point lights so lanterns actually light the curtains
    this.lanternLights = [];
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + .3;
      const pl = new THREE.PointLight(0xff5a2a, 0, 14, 1.8); pl.position.set(Math.cos(a) * 15, 6.6, Math.sin(a) * 15);
      this.stage.add(pl); this.lanternLights.push(pl);
    }
  }

  /* ---------- brass rope rail on stanchions (outer ring) */
  buildRails() {
    const R = 10.8, n = 18, brass = this.brassMat();
    const ropePts = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      const post = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, 1.05, 20), brass); shaft.position.y = .52;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .06, 40), brass); base.position.y = .03;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.075, 24, 16), brass); ball.position.y = 1.1;
      [shaft, base, ball].forEach((x) => { x.castShadow = true; post.add(x); });
      post.position.set(Math.cos(a) * R, FLOOR_Y, Math.sin(a) * R);
      this.stage.add(post);
    }
    for (let j = 0; j <= n * 24; j++) {
      const t = j / (n * 24), a = t * Math.PI * 2, f = (t * n) % 1;
      ropePts.push(new THREE.Vector3(Math.cos(a) * R, FLOOR_Y + 1.02 - Math.sin(f * Math.PI) * .22, Math.sin(a) * R));
    }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts, true), n * 48, .035, 8, true),
      new THREE.MeshPhysicalMaterial({ color: 0x6d0f18, roughness: .85, sheen: 1, sheenColor: new THREE.Color(0xff6060), sheenRoughness: .4 }));
    rope.castShadow = true;
    this.stage.add(rope);
  }

  /* ---------- neon sign hung above the back of the hall */
  buildNeon() {
    const W = 2048, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.textBaseline = "middle";
    const font = `400 230px "Dela Gothic One", sans-serif`;
    // glow (G)
    g.font = font; g.lineJoin = "round";
    g.filter = "blur(26px)"; g.strokeStyle = "rgb(0,255,0)"; g.lineWidth = 46; g.strokeText("OMORO", W / 2, H / 2 + 10);
    g.filter = "none";
    // core (R + some G)
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "rgb(255,120,0)"; g.lineWidth = 9; g.strokeText("OMORO", W / 2, H / 2 + 10);
    g.font = `500 54px "JetBrains Mono", monospace`; g.lineWidth = 3.5; g.strokeText("— THE DAUSO MUSEUM —", W / 2, H - 52);
    const t = new THREE.CanvasTexture(c);
    const mat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: neonFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMask: { value: t }, uColor: { value: new THREE.Color("#d8ff4f") }, uTime: { value: 0 }, uOn: { value: reduced ? 1 : 0 } } });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);
    sign.position.set(0, 9.2, -19.4);
    this.neon = sign;
    this.stage.add(sign);
    this.neonLight = new THREE.PointLight(0xd8ff4f, 0, 16, 1.6); this.neonLight.position.set(0, 8.6, -17.5); this.stage.add(this.neonLight);
  }

  /* ---------- dust motes lit by the spot cones */
  buildDust() {
    const n = Math.round(40000 * Math.max(quality.particles, .2));
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt(Math.random()) * 14, a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.random() * 13 - 3.4; pos[i * 3 + 2] = Math.sin(a) * rr;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const z = () => Array.from({ length: 6 }, () => new THREE.Vector3());
    this.dustU = { uTime: { value: 0 }, uPx: { value: 2 }, uOn: { value: reduced ? 1 : 0 }, uLightPos: { value: z() }, uLightDir: { value: z() }, uLightCol: { value: z().map(() => new THREE.Color(0, 0, 0)) } };
    this.dust = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dust.frustumCulled = false;
    this.world.add(this.dust);
  }

  /* ============================================================ intro */
  playIntro() {
    const lights = this.cards;
    if (reduced) {
      this.cards.forEach((c) => { c.light = 1; c.mat.uniforms.uReveal.value = 1; c.mat.uniforms.uLight.value = 1; });
      this.setHouse(1);
      this.camera.position.set(0, 1.6, 15.5);
      return;
    }
    const tl = this.introTl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(this.camera.position, { z: 15.5, y: 1.6, duration: 5.2, ease: "power3.inOut" }, 0);
    tl.to(this.neon.material.uniforms.uOn, { value: 1, duration: .08, repeat: 5, yoyo: true, ease: "none" }, .3)
      .to(this.neon.material.uniforms.uOn, { value: 1, duration: .2 }, .8)
      .to(this.neonLight, { intensity: 14, duration: .6 }, .8);
    lights.forEach((c, i) => {
      const at = 1.0 + i * .32;
      tl.to(c, { light: 1, duration: 1.1, ease: "power2.out" }, at)
        .to(c.mat.uniforms.uLight, { value: 1, duration: 1.1 }, at)
        .to(c.mat.uniforms.uReveal, { value: 1, duration: 2.4, ease: "power2.inOut" }, at + .15);
    });
    tl.to(this.lanterns.material.uniforms.uIntro, { value: 1.2, duration: 3.2, ease: "none" }, 1.4);
    tl.to(this, { house: 1, duration: 2.6, ease: "power2.inOut", onUpdate: () => this.setHouse(this.house) }, 2.2);
    tl.to(this.dustU.uOn, { value: 1, duration: 3 }, 1.2);
  }
  setHouse(v) {
    this.house = v;
    this.hemi.intensity = .32 * v;
    this.rectL.intensity = 9 * v; this.rectR.intensity = 7 * v;
    this.rim.intensity = 1.2 * v;
    this.lanternLights.forEach((l) => { l.intensity = 22 * v; });
  }

  /* ============================================================ layouts & focus */
  layoutFor(kind, i) {
    const n = this.moments.length, a = i / n * Math.PI * 2;
    if (kind === "ring") { const R = 7; return { p: [Math.sin(a) * R, 0, Math.cos(a) * R], r: [0, a, 0], a }; }
    if (kind === "helix") { const R = 5.6, aa = i / n * Math.PI * 2.4; return { p: [Math.sin(aa) * R, i * 1.05 - 2.2, Math.cos(aa) * R], r: [0, aa, 0], a: aa }; }
    const col = i % 3, row = Math.floor(i / 3);
    const x = (col - 1) * 3.6, y = (0.5 - row) * 4.5 + .7;
    return { p: [x, y, 1.2 - Math.abs(col - 1) * .9], r: [0, -(col - 1) * .26, 0], a: 0 };
  }
  applyLayout(kind, instant = false) {
    const keep = this.focused;                          // BUG #42: keep the selection across layout changes
    this.layout = kind;
    this.cards.forEach((c, i) => {
      const { p, r } = this.layoutFor(kind, i);
      const d = instant || reduced ? 0 : 1.9;
      gsap.to(c.holder.position, { x: p[0], y: p[1], z: p[2], duration: d, ease: "expo.inOut", delay: instant ? 0 : i * .05, overwrite: true });
      gsap.to(c.holder.rotation, { x: r[0], y: r[1], z: r[2], duration: d, ease: "expo.inOut", delay: instant ? 0 : i * .05, overwrite: true });
      if (!instant && !reduced) gsap.fromTo(c.mat.uniforms.uBend, { value: 0 }, { value: 1, duration: .95, yoyo: true, repeat: 1, ease: "sine.inOut", delay: i * .05 });
    });
    if (kind === "wall") this.rotTarget = Math.round(this.rotTarget / (Math.PI * 2)) * Math.PI * 2;
    this.travelTarget = 0;
    this.onLayout?.(kind);
    if (keep >= 0) setTimeout(() => this.focus(keep), instant ? 0 : 450);
  }
  focus(i) {
    if (!this.cards[i]) return;
    this.focused = i;
    if (this.layout !== "wall") {
      const { a } = this.layoutFor(this.layout, i);
      const target = -a, twoPi = Math.PI * 2;
      this.rotTarget = target + Math.round((this.rotTarget - target) / twoPi) * twoPi;
      if (this.layout === "helix") this.travelTarget = this.layoutFor("helix", i).p[1];
    }
    this.cards.forEach((c, k) => gsap.to(c.mat.uniforms.uDim, { value: k === i ? 0 : 1, duration: .9, overwrite: true }));
    this.onFocus?.(i);
  }
  unfocus() {
    this.focused = -1;
    this.cards.forEach((c) => gsap.to(c.mat.uniforms.uDim, { value: 0, duration: .9, overwrite: true }));
    this.onFocus?.(-1);
  }
  next(dir = 1) {
    const n = this.moments.length;
    const from = this.focused < 0 ? (dir > 0 ? -1 : 0) : this.focused;   // BUG #43: ← from nothing selects 06
    this.focus(((from + dir) % n + n) % n);
  }

  /* ============================================================ input */
  bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => { this.drag = { on: true, x: e.clientX, y: e.clientY, moved: 0, vx: 0 }; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => {
      const b = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      if (this.drag.on) {
        const dx = e.clientX - this.drag.x; this.drag.x = e.clientX;
        this.drag.moved += Math.abs(dx) + Math.abs(e.clientY - this.drag.y); this.drag.y = e.clientY;
        if (this.layout !== "wall") { this.rotTarget += dx * .0055; this.drag.vx = dx; }
      }
    });
    c.addEventListener("pointerup", () => {
      const click = this.drag.moved < 8;
      this.drag.on = false;
      if (click) { if (this.hovered >= 0) (this.focused === this.hovered ? this.onOpen?.(this.hovered) : this.focus(this.hovered)); else if (this.focused >= 0) this.unfocus(); }
      else this.rotVel = this.drag.vx * .0011;                 // inertial spin after a flick
    });
    c.addEventListener("pointercancel", () => { this.drag.on = false; });
    c.addEventListener("pointerleave", () => { if (!this.drag.on) this.pointer.set(9, 9); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.layout === "helix") this.travelTarget = Math.max(-2.4, Math.min(3.4, this.travelTarget - e.deltaY * .004));
      else if (this.layout === "ring") this.rotTarget += e.deltaY * .0016;
      else this.zoom = Math.max(-3, Math.min(4, (this.zoom || 0) + e.deltaY * .004));
    }, { passive: false });
    addEventListener("resize", () => this.resize());
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.fx?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.fov = w / h < 1 ? 60 : 42; this.camera.updateProjectionMatrix();
    if (this.dustU) this.dustU.uPx.value = this.renderer.getPixelRatio() * (h / 900) * 2.2;
  }

  /* ============================================================ frame */
  tick() {
    if (!this.gate.active()) return;
    this.timer.update();
    const t = this.timer.getElapsed();
    const autoSpin = !this.drag.on && this.focused < 0 && this.layout !== "wall" && !reduced;
    if (autoSpin) this.rotTarget += .0009;
    this.rotTarget += this.rotVel; this.rotVel *= .94;
    this.rotY += (this.rotTarget - this.rotY) * .055;
    this.travel += (this.travelTarget - this.travel) * .06;
    this.world.rotation.y = this.layout === "wall" ? 0 : this.rotY;
    this.world.position.y = -this.travel;
    this.stage.rotation.y = this.layout === "wall" ? 0 : this.rotY * .35;    // architecture turns slower = parallax depth
    const px = this.pointer.x > 5 ? 0 : this.pointer.x, py = this.pointer.y > 5 ? 0 : this.pointer.y;
    this.pSmooth.x += (px - this.pSmooth.x) * .06; this.pSmooth.y += (py - this.pSmooth.y) * .06;

    // hover (frames and prints both pick)
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.cards.flatMap((c) => [c.mesh, c.frame]);
    const hits = this.pointer.x > 5 ? [] : this.raycaster.intersectObjects(targets, false);
    const hov = hits.length ? hits[0].object.userData.index : -1;
    if (hov !== this.hovered) { this.hovered = hov; this.canvas.style.cursor = hov >= 0 ? "pointer" : "grab"; this.onHover?.(hov); }

    this.world.updateMatrixWorld();
    const wp = new THREE.Vector3(), q = new THREE.Quaternion(), fwd = new THREE.Vector3();
    this.cards.forEach((c, i) => {
      const u = c.mat.uniforms;
      u.uTime.value = t; u.uPointer.value.copy(this.pSmooth);
      const on = i === this.hovered || i === this.focused ? 1 : 0;
      u.uHover.value += (on - u.uHover.value) * .08;
      const h = u.uHover.value;
      c.inner.position.z = h * .22;
      c.inner.position.y = reduced ? 0 : Math.sin(t * .7 + i * 1.3) * .06;
      c.inner.rotation.y = reduced ? 0 : this.pSmooth.x * .08 * h;
      c.inner.rotation.x = reduced ? 0 : -this.pSmooth.y * .05 * h;
      // post from the frame bottom to the floor
      const bottom = c.holder.position.y - CARD_H / 2 - .62;
      const len = Math.max(.01, bottom - FLOOR_Y);
      c.post.scale.y = len; c.post.position.set(0, -CARD_H / 2 - .62 - len / 2, -.1);
      // spot sits above & in front of the frame, aimed at the print
      c.holder.getWorldPosition(wp); c.holder.getWorldQuaternion(q);
      fwd.set(0, 0, 1).applyQuaternion(q);
      const lp = this.world.worldToLocal(wp.clone().add(fwd.clone().multiplyScalar(2.6)).add(new THREE.Vector3(0, 5.6, 0)));
      const tp = this.world.worldToLocal(wp.clone().add(new THREE.Vector3(0, -.3, 0)));
      c.spot.position.copy(lp); c.spot.target.position.copy(tp);
      const dim = 1 - u.uDim.value * .55;
      c.spot.intensity = c.light * (150 + h * 90) * dim;
      // beam geometry: orient from lamp to target
      c.beam.position.copy(lp);
      const dir = tp.clone().sub(lp).normalize();
      c.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      c.beam.material.uniforms.uOn.value = c.light * dim * (.85 + h * .5);
      c.beam.material.uniforms.uTime.value = t;
      // floor glow
      c.glow.position.set(c.holder.position.x, FLOOR_Y + .01, c.holder.position.z);
      c.glow.material.opacity = c.light * (.25 + h * .55) * dim;
      // feed dust (world-local positions; dust lives in this.world)
      this.dustU.uLightPos.value[i].copy(lp);
      this.dustU.uLightDir.value[i].copy(dir);
      this.dustU.uLightCol.value[i].copy(c.spot.color).multiplyScalar(c.light * dim * (1 + h));
    });
    this.dustU.uTime.value = t;
    this.lanterns.material.uniforms.uTime.value = t;
    this.neon.material.uniforms.uTime.value = t;
    this.lanternLights.forEach((l, k) => { l.intensity = 22 * (this.house || 0) * (.9 + .1 * Math.sin(t * 6 + k * 2)); });

    // camera — slow drift + parallax, rack to the focused frame
    let target, look;
    if (this.focused >= 0) {
      const c = this.cards[this.focused];
      c.holder.getWorldPosition(wp); c.holder.getWorldQuaternion(q);
      const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      target = wp.clone().add(nrm.multiplyScalar(this.camera.aspect < 1 ? 7.4 : 5.1)).add(new THREE.Vector3(this.pSmooth.x * .35, .25 + this.pSmooth.y * .22, 0));
      look = wp.clone().add(new THREE.Vector3(this.camera.aspect < 1 ? 0 : -.55, -.15, 0));
    } else {
      const z = (this.layout === "wall" ? 12 : 15.5) + (this.zoom || 0);
      const drift = reduced ? 0 : Math.sin(t * .11) * .35;
      target = new THREE.Vector3(this.pSmooth.x * 1.1 + drift, 1.6 + this.pSmooth.y * .5, z);
      look = new THREE.Vector3(0, this.layout === "wall" ? .9 : .3, 0);
    }
    if (!this.introTl || !this.introTl.isActive()) this.camera.position.lerp(target, reduced ? 1 : .045);
    else { this.camera.position.x += (target.x - this.camera.position.x) * .03; }
    this.lookAt.lerp(look, reduced ? 1 : .07);
    this.camera.lookAt(this.lookAt);
    this.fx.setFocus(this.camera.position.distanceTo(this.focused >= 0 ? wp : this.lookAt.clone().add(new THREE.Vector3(0, 0, 7))));
    this.fx.render();
  }
}
