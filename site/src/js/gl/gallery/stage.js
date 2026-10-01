// Stage dressing for the 3D gallery ("a night theatre-museum"):
//   - polished black marble floor (ambientCG CC0) with a real planar reflection injected into MeshPhysicalMaterial
//     so spotlights, shadows and normal-mapped veins all sit *on top* of the mirror image
//   - velvet curtain cylinder (Poly Haven CC0 velour_velvet) with procedural folds + sheen
//   - strings of paper lanterns (instanced, custom emissive shader with flicker)
//   - volumetric light cones (raymarched-looking layered noise in a cone shader)
//   - floating dust motes lit by the cones
import * as THREE from "three";
import { GLSL, hot } from "../fx/index.js";
import { url } from "../../core/data.js";

const loader = new THREE.TextureLoader();
export function tex(path, { srgb = false, repeat = 1, aniso = 8 } = {}) {
  const t = loader.load(url(path));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ floor */
// A Reflector-style render target, but the result is fed into a PBR material (not an unlit mirror).
export function createMarbleFloor(renderer, scene, { size = 90, y = -2.2, res = 1024, aniso = 8 } = {}) {
  const rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.HalfFloatType, samples: 4 });
  const reflCam = new THREE.PerspectiveCamera();
  const texMatrix = new THREE.Matrix4();
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const rep = size / 6;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa0a8,
    map: tex("tex/c-marble-col.webp", { srgb: true, repeat: rep, aniso }),
    normalMap: tex("tex/c-marble-nor.webp", { repeat: rep, aniso }),
    normalScale: new THREE.Vector2(.35, .35),
    roughnessMap: tex("tex/c-marble-rough.webp", { repeat: rep, aniso }),
    roughness: .55, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .06,
    envMapIntensity: .35
  });
  const U = { tReflect: { value: rt.texture }, uTexMatrix: { value: texMatrix }, uReflect: { value: .62 }, uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uTexMatrix; varying vec4 vReflUv; varying vec3 vWorldP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvReflUv = uTexMatrix * modelMatrix * vec4(transformed, 1.); vWorldP = (modelMatrix * vec4(transformed,1.)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tReflect; uniform float uReflect, uTime; varying vec4 vReflUv; varying vec3 vWorldP;")
      .replace("#include <opaque_fragment>", /* glsl */`
        {
          // perturb the mirror lookup by the marble normal so veins ripple the reflection
          vec2 nOff = (normal.xy) * .028;
          vec2 ruv = vReflUv.xy / vReflUv.w + nOff;
          // cheap rough blur (5 taps, spread by roughness)
          float spread = .0035 + roughnessFactor * .012;
          vec3 refl = texture2D(tReflect, ruv).rgb * .4;
          refl += texture2D(tReflect, ruv + vec2(spread, 0.)).rgb * .15;
          refl += texture2D(tReflect, ruv - vec2(spread, 0.)).rgb * .15;
          refl += texture2D(tReflect, ruv + vec2(0., spread)).rgb * .15;
          refl += texture2D(tReflect, ruv - vec2(0., spread)).rgb * .15;
          vec3 V = normalize(cameraPosition - vWorldP);
          float fres = .18 + .82 * pow(1. - clamp(V.y, 0., 1.), 4.);
          float fade = smoothstep(46., 8., length(vWorldP.xz));
          outgoingLight += refl * uReflect * fres * fade * (1.15 - roughnessFactor * .6);
          outgoingLight *= mix(.0, 1., fade);
        }
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;

  const plane = new THREE.Plane(), normal = new THREE.Vector3(), wp = new THREE.Vector3(), cp = new THREE.Vector3();
  const rot = new THREE.Matrix4(), look = new THREE.Vector3(), target = new THREE.Vector3(), view = new THREE.Vector3();
  const clip = new THREE.Vector4(), q = new THREE.Vector4();
  // call before the main render
  function update(camera, hide = []) {
    wp.setFromMatrixPosition(mesh.matrixWorld); cp.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(mesh.matrixWorld); normal.set(0, 0, 1).applyMatrix4(rot);
    view.subVectors(wp, cp); if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(wp);
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
    target.subVectors(wp, look).reflect(normal).negate().add(wp);
    reflCam.position.copy(view); reflCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal); reflCam.lookAt(target);
    reflCam.far = camera.far; reflCam.updateMatrixWorld(); reflCam.projectionMatrix.copy(camera.projectionMatrix);
    texMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(normal, wp).applyMatrix4(reflCam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = reflCam.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0]; q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1 - .003; pm.elements[14] = clip.w;
    mesh.visible = false; hide.forEach((o) => (o.visible = false));
    const prevRT = renderer.getRenderTarget(), prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, reflCam);
    renderer.setRenderTarget(prevRT); renderer.shadowMap.autoUpdate = prevShadow;
    mesh.visible = true; hide.forEach((o) => (o.visible = true));
  }
  return { mesh, update, uniforms: U, setSize: (s) => rt.setSize(s, s) };
}

/* ------------------------------------------------------------------ curtain */
// Open cylinder around the hall with pleated folds displaced in the vertex shader; velvet sheen.
export function createCurtain({ radius = 19, height = 16, y = -2.2, aniso = 8 } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 720, 24, true);
  geo.translate(0, height / 2, 0);
  const rep = 22;
  const col = tex("tex/c-velvet-col.webp", { srgb: true, aniso }); col.repeat.set(rep, 3);
  const nor = tex("tex/c-velvet-nor.webp", { aniso }); nor.repeat.set(rep, 3);
  const rough = tex("tex/c-velvet-rough.webp", { aniso }); rough.repeat.set(rep, 3);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x7a1020, map: col, normalMap: nor, normalScale: new THREE.Vector2(.8, .8), roughnessMap: rough, roughness: .9,
    sheen: 1, sheenRoughness: .35, sheenColor: new THREE.Color(0xff6a7a), side: THREE.BackSide, envMapIntensity: .25
  });
  const U = { uTime: { value: 0 }, uFolds: { value: 64 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uFolds; varying float vFold;")
      .replace("#include <beginnormal_vertex>", /* glsl */`
        float a = uv.x * 6.28318 * uFolds;
        float sway = sin(uv.x * 40. + uTime * .35) * .08 * (1. - uv.y);
        float k = .42 + .12 * sin(uv.x * 13.);
        vec3 objectNormal = normalize(vec3(normal.x, 0., normal.z) + vec3(-normal.z, 0., normal.x) * cos(a) * k * 2.2);
        vFold = sin(a);`)
      .replace("#include <begin_vertex>", /* glsl */`
        vec3 transformed = position;
        float d = sin(a) * k + sway;
        transformed.xz += normalize(position.xz) * d;
        // gather at the floor: hem bunches outward
        transformed.xz += normalize(position.xz) * smoothstep(.12, .0, uv.y) * .3;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFold;")
      .replace("#include <opaque_fragment>", "outgoingLight *= .45 + .55 * smoothstep(-1., .6, vFold);\n#include <opaque_fragment>");
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return { mesh, uniforms: U };
}

/* ------------------------------------------------------------------ lanterns */
const lanternVert = /* glsl */`
  attribute vec3 aColor; attribute float aSeed;
  uniform float uTime, uPower;
  varying vec3 vN, vV, vColor, vObj; varying float vSeed;
  void main(){
    vec3 p = position;
    // paper ribs
    float ang = atan(p.z, p.x);
    p.xz *= 1. - .045 * pow(abs(sin(ang * 8.)), .6);
    vObj = position;
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
    // gentle swing
    float sw = sin(uTime * .9 + aSeed * 6.2831) * .04;
    w.x += sw * (1. - position.y);
    vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vV = cameraPosition - w.xyz; vColor = aColor; vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const lanternFrag = /* glsl */`
  uniform float uTime, uPower;
  varying vec3 vN, vV, vColor, vObj; varying float vSeed;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  void main(){
    vec3 N = normalize(vN), V = normalize(vV);
    float facing = abs(dot(N, V));
    // light glowing through paper: brighter in the middle, darker at rims and ribs
    float ang = atan(vObj.z, vObj.x);
    float rib = smoothstep(.0, .25, abs(sin(ang * 8.)));
    float band = smoothstep(.0, .06, abs(vObj.y - .48)) * smoothstep(.0, .06, abs(vObj.y + .48));
    float flick = .82 + .18 * sin(uTime * (7. + vSeed * 5.) + vSeed * 40.) * sin(uTime * 3.1 + vSeed * 9.);
    float core = pow(facing, 1.6);
    vec3 col = vColor * (1.4 + 4.2 * core) * flick * mix(.35, 1., rib) * mix(.25, 1., band);
    // black lacquer caps
    float cap = smoothstep(.47, .5, abs(vObj.y));
    col = mix(col, vec3(.02) + .2 * pow(1. - facing, 3.), cap);
    // calligraphy-ish dark strokes
    float glyph = step(.82, fract(sin(floor(ang * 1.2 + vSeed * 7.) * 12.9898 + floor(vObj.y * 6.) * 78.233) * 43758.5)) * (1. - cap) * step(abs(vObj.y), .3);
    col *= 1. - glyph * .55;
    gl_FragColor = vec4(col * uPower, 1.);
  }`;

export function createLanterns({ count = 84, radius = 15.5, rings = 3, y = 7.5 } = {}) {
  const geo = new THREE.SphereGeometry(.5, 48, 24);
  geo.scale(.82, 1.05, .82);
  const mat = new THREE.ShaderMaterial({ vertexShader: lanternVert, fragmentShader: lanternFrag, uniforms: { uTime: { value: 0 }, uPower: { value: 0 } } });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const colors = new Float32Array(count * 3), seeds = new Float32Array(count);
  const palette = ["#ff5a3c", "#ff7b39", "#ffb347", "#ff4f64", "#ff8a52"].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const perRing = Math.floor(count / rings);
  const cords = [];
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(i / perRing) % rings, k = i % perRing;
    const a = (k / perRing) * Math.PI * 2 + ring * .4;
    const r = radius - ring * 2.6;
    // catenary sag between hangers
    const sag = Math.pow(Math.sin(((k % 6) / 6) * Math.PI), 1) * .9;
    p.set(Math.sin(a) * r, y - ring * 1.1 - sag, Math.cos(a) * r);
    const sc = .75 + Math.random() * .45;
    s.set(sc, sc, sc);
    m4.compose(p, q, s);
    mesh.setMatrixAt(i, m4);
    palette[(i * 7) % palette.length].toArray(colors, i * 3);
    seeds[i] = Math.random();
    cords.push(p.clone());
  }
  geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
  const group = new THREE.Group();
  group.add(mesh);
  // cord lines connecting lanterns ring by ring
  const pts = [];
  for (let rr = 0; rr < rings; rr++) for (let k = 0; k < perRing; k++) {
    const a = cords[rr * perRing + k], b = cords[rr * perRing + ((k + 1) % perRing)];
    if (!a || !b) continue;
    pts.push(a.x, a.y + .55, a.z, b.x, b.y + .55, b.z);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a1a14, transparent: true, opacity: .8 })));
  return { group, mesh, uniforms: mat.uniforms };
}

/* ------------------------------------------------------------------ volumetric cones */
const coneVert = /* glsl */`
  varying vec3 vW, vLocal; varying vec3 vN;
  void main(){ vLocal = position; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const coneFrag = GLSL.noise + /* glsl */`
  uniform vec3 uColor; uniform float uTime, uIntensity, uHeight;
  varying vec3 vW, vLocal, vN;
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float rim = pow(abs(dot(normalize(vN), V)), 1.8);      // fade the silhouette edges
    float h = clamp(-vLocal.y / uHeight + .5, 0., 1.);       // 0 at apex -> 1 at base
    float along = pow(1. - h, .55) * smoothstep(0., .08, h); // brighter near the source
    float n = snoise(vec3(vW.xz * .35, vW.y * .25 - uTime * .12)) * .5 + .5;
    float n2 = snoise(vec3(vW * 1.3 + vec3(0., uTime * .2, 0.))) * .5 + .5;
    float dens = (.45 + .55 * n) * (.7 + .3 * n2);
    float a = rim * along * dens * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }`;
export function createCone({ color = "#fff2d8", height = 9, radius = 2.2 } = {}) {
  const geo = new THREE.CylinderGeometry(.06, radius, height, 64, 24, true);
  const mat = new THREE.ShaderMaterial({
    vertexShader: coneVert, fragmentShader: coneFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: hot(color, 1) }, uTime: { value: 0 }, uIntensity: { value: 0 }, uHeight: { value: height } }
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return { mesh, uniforms: mat.uniforms, height };
}

/* ------------------------------------------------------------------ dust */
const dustVert = GLSL.noise + /* glsl */`
  attribute float aSeed; uniform float uTime, uSize, uPixel;
  varying float vA;
  void main(){
    vec3 p = position;
    float t = uTime * .05;
    p += vec3(snoise(p * .15 + t), snoise(p * .15 + 17. + t), snoise(p * .15 + 41. + t)) * 1.4;
    p.y += mod(uTime * .05 * (.4 + aSeed), 1.) * .6;
    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    float tw = .5 + .5 * sin(uTime * (1. + aSeed * 3.) + aSeed * 50.);
    vA = tw * smoothstep(40., 6., -mv.z);
    gl_PointSize = uSize * uPixel * (.4 + aSeed) / -mv.z;
  }`;
const dustFrag = /* glsl */`
  uniform vec3 uColor; varying float vA;
  void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, .0, d); a *= a; gl_FragColor = vec4(uColor * a * vA, a * vA); }`;
export function createDust({ count = 40000, spread = 30, height = 14 } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * spread * .6, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.sin(a) * r; pos[i * 3 + 1] = Math.random() * height - 2; pos[i * 3 + 2] = Math.cos(a) * r;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSize: { value: 26 }, uPixel: { value: 1 }, uColor: { value: new THREE.Color(1.6, 1.45, 1.2) } }
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  return { points, uniforms: mat.uniforms };
}
