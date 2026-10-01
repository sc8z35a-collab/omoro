// Framed moment cards: gilded baroque frame (Poly Haven CC0 glTF) + layered print shader
// (photo parallax behind glass, floating ink, holographic foil quote, glitter, paper tooth)
// + additive glass pane with smudges + engraved brass plaque + its own spotlight & light cone.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLSL, hot, quality } from "../fx/index.js";
import { url } from "../../core/data.js";
import { momentLayers } from "../cardTexture.js";
import { tex, createCone } from "./stage.js";

// glTF canvas rectangle (x ±.196, y -.254….246) → our card size
const SRC_W = .392, SRC_H = .5, SRC_CY = -.004, SRC_Z = .0093;
export const CARD_H = 2.72, CARD_W = CARD_H * SRC_W / SRC_H;
const SX = CARD_W / SRC_W, SY = CARD_H / SRC_H;
export const FRAME_H = .771 * SY, FRAME_W = .66 * SX;

const cardVert = /* glsl */`
  uniform float uTime, uHover, uBend;
  varying vec2 vUv; varying vec3 vViewL, vLightL, vW;
  uniform vec3 uLightPos;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159) * uBend * .3;
    vec4 w = modelMatrix * vec4(p, 1.);
    vW = w.xyz;
    mat4 inv = inverse(modelMatrix);
    vViewL = (inv * vec4(cameraPosition, 1.)).xyz - p;
    vLightL = uLightPos - p;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const cardFrag = GLSL.hash + GLSL.noise + /* glsl */`
  uniform sampler2D uPhoto, uInk, uMask;
  uniform float uTime, uHover, uDim, uPower, uAspect;
  uniform vec3 uAccent; uniform vec2 uPointer;
  varying vec2 vUv; varying vec3 vViewL, vLightL, vW;
  vec3 irid(float t){ return .5 + .5 * cos(6.28318 * (t + vec3(0., .33, .67))); }
  void main(){
    vec3 V = normalize(vViewL), L = normalize(vLightL);
    vec2 par = V.xy / max(V.z, .3);
    // --- layer 1: photo, sunk ~4.5% behind the glass
    vec2 uvP = (vUv - .5) * .93 + .5 - par * .04;
    vec3 photo = texture2D(uPhoto, uvP).rgb;
    // paper tooth (micro relief)
    float tooth = snoise(vec3(vUv * vec2(420., 420. / uAspect), 1.)) * .5 + .5;
    vec3 Np = normalize(vec3((tooth - .5) * .25, (snoise(vec3(vUv * 380., 7.)) ) * .12, 1.));
    float diff = .55 + .45 * max(dot(Np, L), 0.);
    // spotlight pool on the print: hot spot upper-centre, falloff to the corners
    vec2 sc = (vUv - vec2(.5, .62)) * vec2(1., 1.25);
    float pool = .35 + .9 * exp(-dot(sc, sc) * 3.2);
    // cursor "torch" when hovered
    vec2 pc = (vUv - uPointer) * vec2(1., 1. / uAspect);
    float torch = exp(-dot(pc, pc) * 26.) * uHover;
    // --- layer 2: ghost number (mid depth, frosted)
    float ghost = texture2D(uMask, vUv - par * .02).g;
    // --- layer 3: ink on the glass, casting a soft shadow onto the photo
    vec4 ink = texture2D(uInk, vUv);
    float inkShadow = texture2D(uInk, vUv + par * .012 + vec2(.004, -.006)).a;
    vec3 col = photo * diff * pool;
    col *= 1. - inkShadow * .45;
    col += vec3(.9, .95, 1.) * ghost * (.05 + .05 * uHover);
    col += photo * torch * 1.4;
    vec3 mask = texture2D(uMask, vUv).rgb;
    // --- holographic foil (quote / bars / frame line)
    vec2 g = vec2(snoise(vec3(vUv * 90., 3.)), snoise(vec3(vUv * 90., 9.))) * .22;
    vec3 Nf = normalize(vec3(g, 1.));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(Nf, H), 0.), 90.);
    float fres = pow(1. - max(dot(Nf, V), 0.), 2.);
    vec3 holo = irid(dot(Nf, V) * 1.6 + vUv.y * .8 + vUv.x * .3 + uTime * .03);
    vec3 gold = mix(vec3(1., .78, .42), uAccent, .35);
    vec3 foil = mix(gold, holo, .45 + .35 * fres) * (.55 + .9 * max(dot(Nf, L), 0.)) + spec * 6.;
    col = mix(col, ink.rgb * diff * (.9 + .4 * pool), ink.a * (1. - mask.r));
    col = mix(col, foil * (.6 + .6 * pool), mask.r);
    // --- glitter: sparse view-dependent sparkles, denser in mask.b
    vec2 cell = floor(vUv * vec2(520., 520. / uAspect));
    vec3 rn = hash33(vec3(cell, 3.)) * 2. - 1.;
    vec3 Ng = normalize(vec3(rn.xy * .6, 1.));
    float sp = pow(max(dot(reflect(-L, Ng), V), 0.), 900.);
    float dens = step(.985 - mask.b * .25, hash12(cell + 11.3));
    col += hot_glitter(sp * dens);
    // hover rim + dim others
    col *= mix(1., .28, uDim);
    col *= .12 + .88 * uPower;
    gl_FragColor = vec4(col, 1.);
  }`.replace("hot_glitter(sp * dens)", "vec3(1., .96, .88) * sp * dens * 14. * (.3 + .7 * uPower)");

let framePromise = null;
function loadFrame() {
  if (!framePromise) framePromise = new GLTFLoader().loadAsync(url("models/c-frame/frame.gltf")).then((g) => {
    let frameGeo = null;
    g.scene.traverse((o) => { if (o.isMesh && !frameGeo && o.geometry.attributes.position.count > 100) frameGeo = o.geometry; });
    return frameGeo;
  }).catch(() => null);
  return framePromise;
}
function frameMaterial(aniso) {
  return new THREE.MeshPhysicalMaterial({
    map: tex("models/c-frame/textures/frame_diff.webp", { srgb: true, aniso }),
    normalMap: tex("models/c-frame/textures/frame_nor_gl.webp", { aniso }),
    roughnessMap: tex("models/c-frame/textures/frame_rough.webp", { aniso }),
    color: 0xfff1d6, metalness: 1, roughness: .85, normalScale: new THREE.Vector2(1.2, 1.2),
    clearcoat: .35, clearcoatRoughness: .3, envMapIntensity: 1.1
  });
}
// procedural smudge / dust map for the glass roughness
let smudge = null;
function smudgeTexture() {
  if (smudge) return smudge;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#151515"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const cx = Math.random() * 512, cy = Math.random() * 512, r = 20 + Math.random() * 70;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, `rgba(160,160,160,${.15 + Math.random() * .25})`); gr.addColorStop(1, "rgba(160,160,160,0)");
    x.fillStyle = gr; x.beginPath(); x.ellipse(cx, cy, r, r * (.4 + Math.random() * .6), Math.random() * 3, 0, 6.3); x.fill();
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .5})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1.2, 1.2); }
  smudge = new THREE.CanvasTexture(c);
  return smudge;
}
function plaqueTexture(m) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 1024, 256);
  g.addColorStop(0, "#5a4320"); g.addColorStop(.5, "#c9a560"); g.addColorStop(1, "#6a4f25");
  x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
  // brushed lines
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() > .5 ? "255,240,200" : "40,25,5"},${Math.random() * .08})`; x.fillRect(0, Math.random() * 256, 1024, 1); }
  x.strokeStyle = "rgba(40,25,5,.6)"; x.lineWidth = 6; x.strokeRect(14, 14, 996, 228);
  // engraved text: dark fill + light lower edge
  const eng = (t, px, y, font) => { x.font = font; x.fillStyle = "rgba(255,240,200,.35)"; x.fillText(t, px, y + 2); x.fillStyle = "rgba(30,18,4,.92)"; x.fillText(t, px, y); };
  x.textBaseline = "middle";
  eng(`No. ${m.number}`, 56, 88, `500 44px "JetBrains Mono", monospace`);
  eng(m.title.length > 13 ? m.title.slice(0, 13) + "…" : m.title, 56, 170, `400 70px "Dela Gothic One", sans-serif`);
  x.textAlign = "right";
  eng(m.en.toUpperCase().slice(0, 26), 968, 88, `500 30px "JetBrains Mono", monospace`);
  eng(m.speaker, 968, 176, `700 40px "Zen Kaku Gothic New", sans-serif`);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export async function createFramedCard(renderer, m, i, { glass = true } = {}) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const res = quality.tier === "low" ? 640 : 1440;
  const [layers, frameGeo] = await Promise.all([momentLayers(m, { width: res, height: Math.round(res / (SRC_W / SRC_H)) }), loadFrame()]);
  const mkTex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

  const holder = new THREE.Group();      // layout transform (gsap)
  const inner = new THREE.Group();       // hover lift / float
  holder.add(inner);

  const lightPosL = new THREE.Vector3(0, 5.2, 4.2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: cardVert, fragmentShader: cardFrag,
    uniforms: {
      uPhoto: { value: mkTex(layers.photo, true) }, uInk: { value: mkTex(layers.ink, true) }, uMask: { value: mkTex(layers.mask, false) },
      uTime: { value: 0 }, uHover: { value: 0 }, uBend: { value: 0 }, uDim: { value: 0 }, uPower: { value: 0 },
      uAccent: { value: new THREE.Color(m.accent) }, uPointer: { value: new THREE.Vector2(.5, .5) }, uAspect: { value: CARD_W / CARD_H },
      uLightPos: { value: lightPosL }
    }
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H, 32, 32), mat);
  card.position.set(0, SRC_CY * SY, SRC_Z * SX + .004);
  card.userData.index = i;
  card.receiveShadow = false;
  inner.add(card);

  // gilded frame (or a procedural bevel if the model failed to load)
  let frame;
  if (frameGeo) {
    frame = new THREE.Mesh(frameGeo, frameMaterial(aniso));
    frame.scale.set(SX, SY, SX * .8);
  } else {
    const shape = new THREE.Shape(); shape.moveTo(-FRAME_W / 2, -FRAME_H / 2); shape.lineTo(FRAME_W / 2, -FRAME_H / 2); shape.lineTo(FRAME_W / 2, FRAME_H / 2); shape.lineTo(-FRAME_W / 2, FRAME_H / 2);
    const hole = new THREE.Path(); hole.moveTo(-CARD_W / 2, -CARD_H / 2); hole.lineTo(-CARD_W / 2, CARD_H / 2); hole.lineTo(CARD_W / 2, CARD_H / 2); hole.lineTo(CARD_W / 2, -CARD_H / 2); shape.holes.push(hole);
    frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .25, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 6 }), new THREE.MeshPhysicalMaterial({ color: 0xc9a25a, metalness: 1, roughness: .3 }));
  }
  frame.castShadow = true; frame.receiveShadow = true;
  inner.add(frame);
  // dark backing board so the frame never shows the curtain through gaps
  const back = new THREE.Mesh(new THREE.PlaneGeometry(FRAME_W * .92, FRAME_H * .92), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: .9 }));
  back.position.z = .002; back.castShadow = true; back.rotation.y = Math.PI; inner.add(back);

  // glass pane: additive, black base → only reflections/speculars show; smudges vary roughness
  let glassMesh = null;
  if (glass) {
    const gm = new THREE.MeshPhysicalMaterial({
      color: 0x000000, metalness: 0, roughness: .06, roughnessMap: smudgeTexture(), clearcoat: 1, clearcoatRoughness: .02,
      iridescence: .45, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600], specularIntensity: 1, envMapIntensity: 1.6,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.02, CARD_H * 1.02), gm);
    glassMesh.position.set(0, SRC_CY * SY, SRC_Z * SX + .03);
    glassMesh.renderOrder = 3;
    inner.add(glassMesh);
  }

  // brass plaque
  const pt = plaqueTexture(m);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.7, .42, .05), [
    new THREE.MeshStandardMaterial({ color: 0x9c7a3e, metalness: 1, roughness: .35 }), new THREE.MeshStandardMaterial({ color: 0x9c7a3e, metalness: 1, roughness: .35 }),
    new THREE.MeshStandardMaterial({ color: 0x9c7a3e, metalness: 1, roughness: .35 }), new THREE.MeshStandardMaterial({ color: 0x9c7a3e, metalness: 1, roughness: .35 }),
    new THREE.MeshPhysicalMaterial({ map: pt, metalnessMap: null, metalness: .85, roughness: .32, clearcoat: .6, clearcoatRoughness: .2 }),
    new THREE.MeshStandardMaterial({ color: 0x2a2010 })
  ]);
  plaque.position.set(0, -FRAME_H / 2 - .38, .05);
  plaque.castShadow = true;
  inner.add(plaque);

  // hanging wires up into the dark
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, metalness: 1, roughness: .4 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 14, 6), wireMat);
    w.position.set(sx * FRAME_W * .32, FRAME_H / 2 + 7, -.02);
    inner.add(w);
  }

  // key spotlight + volumetric cone (live in holder so they don't bob with the float)
  const spot = new THREE.SpotLight(new THREE.Color("#fff1dc").lerp(new THREE.Color(m.accent), .18), 0, 22, .36, .55, 1.6);
  spot.position.copy(lightPosL);
  spot.target.position.set(0, -.2, 0);
  spot.castShadow = quality.tier !== "low";
  spot.shadow.mapSize.set(quality.shadows, quality.shadows);
  spot.shadow.bias = -.0004; spot.shadow.radius = 8; spot.shadow.blurSamples = 16;
  spot.shadow.camera.near = 1; spot.shadow.camera.far = 22;
  holder.add(spot, spot.target);

  const cone = createCone({ color: "#ffe9c8", height: 10, radius: 3.1 });
  const dir = new THREE.Vector3().subVectors(spot.target.position, lightPosL).normalize();
  cone.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  cone.mesh.position.copy(lightPosL).addScaledVector(dir, cone.height / 2);
  holder.add(cone.mesh);

  // the fixture itself: small black can with a hot lens
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .5, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: .8, roughness: .35, side: THREE.DoubleSide }));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.2, 32), new THREE.MeshBasicMaterial({ color: hot("#fff3df", 0) }));
  lens.rotation.x = Math.PI / 2; lens.position.y = -.25;
  can.add(body, lens);
  can.position.copy(lightPosL);
  can.quaternion.copy(cone.mesh.quaternion);
  holder.add(can);

  return { holder, inner, card, mat, frame, glass: glassMesh, plaque, spot, cone, lens, index: i };
}
