// GLSL for the home hero (agent B). All shaders are GLSL1-style so three can auto-upgrade them on WebGL2.
import { GLSL } from "../fx/index.js";

/* ------------------------------------------------------------------ *
 * GPGPU simulation (GPUComputationRenderer)
 *   texturePosition : xyz = local position, w = edge weight of current target (0 interior → 1 outline)
 *   textureVelocity : xyz = velocity,       w = per-particle random (constant)
 * ------------------------------------------------------------------ */
export const simVelocity = /* glsl */`
  precision highp sampler3D;
  uniform sampler2D uTarget;
  uniform sampler3D uNoise;
  uniform float uTime, uDt, uMorph, uScatter, uFlow, uStir, uShockT, uIntro;
  uniform vec3 uMouse, uMouseVel, uShockPos, uSpout;
  void main(){
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 P = texture2D(texturePosition, uv);
    vec4 V = texture2D(textureVelocity, uv);
    vec4 T = texture2D(uTarget, uv);
    vec3 p = P.xyz, v = V.xyz; float r = V.w;

    // staggered arrival: each particle "switches on" its spring at a different moment
    float gate = clamp(uMorph * 1.75 - r * .75, 0., 1.);
    gate = gate * gate * (3. - 2. * gate);
    // intro: particles pour out of the centre lamp one after another
    float born = step(r, uIntro);
    float hold = (1. - born);

    vec3 toT = T.xyz - p;
    float k = mix(.35, 38., gate) * (1. - uScatter * .97);
    vec3 acc = toT * k;

    // divergence-free curl flow (pre-baked volume) → smoke-like motion
    vec3 q = p * vec3(.42, .55, .55) + vec3(0., -uTime * .045, uTime * .02);
    vec4 nz = texture(uNoise, q);
    vec4 nz2 = texture(uNoise, q * 2.7 + 17.3);
    vec3 curl = nz.xyz + nz2.xyz * .45;
    float turb = uFlow + uStir * (1. - gate) * 2.6 + uScatter * 5.5 + (1. - gate) * .6;
    acc += curl * turb;
    // during transit, lift particles upward a little (warm air)
    acc.y += (1. - gate) * .35 * (nz.w - .35);

    // scroll: dissolve outward into a vortex
    acc += vec3(p.xy * .6, (r - .5) * 2.) * uScatter * 2.2;

    // pointer: repulsion + swirl + drag along pointer velocity
    vec3 d = p - uMouse;
    float dl2 = dot(d.xy, d.xy);
    float f = exp(-dl2 * 26.);
    acc.xy += normalize(d.xy + 1e-5) * f * 26.;
    acc.xy += vec2(-d.y, d.x) * f * 34.;
    acc.z  += f * 6. * (r - .3);
    acc    += uMouseVel * f * 9.;

    // click shockwave ring
    float age = uShockT;
    if (age < 2.5) {
      vec3 sd = p - uShockPos; float sl = length(sd.xy);
      float R = age * 2.4;
      float ring = exp(-pow((sl - R) / .07, 2.)) * exp(-age * 1.6);
      acc.xy += normalize(sd.xy + 1e-5) * ring * 120.;
      acc.z += ring * 40. * (r - .5);
    }

    // integrate (semi-implicit Euler, critically-ish damped)
    float damp = mix(1.4, 7.5, gate);
    v += acc * uDt;
    v *= exp(-damp * uDt);
    // not yet born: sit in the lamp
    v = mix(v, vec3(0.), hold);
    gl_FragColor = vec4(v, r);
  }`;

export const simPosition = /* glsl */`
  uniform sampler2D uTarget;
  uniform float uDt, uIntro;
  uniform vec3 uSpout;
  void main(){
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 P = texture2D(texturePosition, uv);
    vec4 V = texture2D(textureVelocity, uv);
    float edge = texture2D(uTarget, uv).w;
    vec3 p = P.xyz + V.xyz * uDt;
    float born = step(V.w, uIntro);
    // unborn particles wait inside the lamp aperture, slightly jittered
    vec3 spout = uSpout + (vec3(fract(V.w * 91.7), fract(V.w * 37.3), fract(V.w * 13.1)) - .5) * vec3(.05, .02, .05);
    p = mix(spout, p, born);
    gl_FragColor = vec4(p, mix(P.w, edge, .08));
  }`;

/* ------------------------------------------------------------------ *
 * Particle rendering (point sprites with depth-of-field bokeh)
 * ------------------------------------------------------------------ */
export const particleVert = /* glsl */`
  uniform sampler2D tPos, tVel;
  uniform float uSize, uPixel, uFocus, uAperture, uTime, uIntro;
  attribute vec2 aRef;
  varying vec3 vColor; varying float vAlpha, vCoc;
  uniform vec3 uColorA, uColorB, uHot;
  void main(){
    vec4 P = texture2D(tPos, aRef);
    vec4 V = texture2D(tVel, aRef);
    float r = V.w;
    float speed = length(V.xyz);
    vec4 mv = modelViewMatrix * vec4(P.xyz, 1.);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    // circle of confusion (thin-lens-ish), in pixels
    float coc = abs(depth - uFocus) / max(depth, .1) * uAperture;
    vCoc = clamp(coc, 0., 1.);
    float base = uSize * uPixel * (.55 + fract(r * 7.13) * .9) / depth;
    gl_PointSize = base + coc * uPixel * 22.;
    // colour: paper → accent sprinkle, edges brighter, fast particles burn hot (HDR → bloom)
    float sprinkle = step(.78, fract(r * 3.7));
    vec3 col = mix(uColorA, uColorB, sprinkle);
    float edge = P.w;
    col *= .55 + edge * 1.1;
    col += uHot * smoothstep(.6, 4.5, speed) * 1.6;
    col *= .9 + .1 * sin(uTime * 2. + r * 40.);
    vColor = col;
    // spread energy when blurred so the total brightness stays constant
    float spread = (base * base) / (gl_PointSize * gl_PointSize);
    float born = step(r, uIntro);
    vAlpha = (.42 + .3 * edge) * mix(1., spread, .85) * born;
  }`;

export const particleFrag = /* glsl */`
  varying vec3 vColor; varying float vAlpha, vCoc;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float d = length(c) * 2.;
    if (d > 1.) discard;
    // sharp → gaussian core; blurred → flat disc with a bright rim (lens bokeh)
    float core = exp(-d * d * 4.);
    float disc = smoothstep(1., .82, d) * (.55 + .45 * smoothstep(.55, .95, d));
    float a = mix(core, disc, smoothstep(.05, .5, vCoc));
    gl_FragColor = vec4(vColor * a * vAlpha, 1.);
  }`;

/* ------------------------------------------------------------------ *
 * Raymarched volumetric spotlight (rendered on the cone's front faces)
 * ------------------------------------------------------------------ */
export const coneVert = /* glsl */`
  varying vec3 vWorld;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

export const coneFrag = /* glsl */`
  precision highp sampler3D;
  uniform sampler3D uNoise;
  uniform vec3 uApex, uDir, uColor;
  uniform float uTan, uLength, uIntensity, uTime, uFloorY, uSteps, uGobo;
  varying vec3 vWorld;
  ${GLSL.hash}
  float coneMask(vec3 p, out float along, out float radial, out float rad){
    vec3 l = p - uApex;
    along = dot(l, uDir);
    radial = length(l - uDir * along);
    rad = max(along * uTan, 1e-3);
    float side = smoothstep(rad, rad * .55, radial);
    float ends = smoothstep(0., .35, along) * smoothstep(uLength, uLength * .7, along);
    return side * ends * step(uFloorY, p.y);
  }
  void main(){
    vec3 ro = vWorld;
    vec3 rd = normalize(vWorld - cameraPosition);
    // march length ~ cone diameter at this depth
    float along0 = max(dot(ro - uApex, uDir), .2);
    float span = along0 * uTan * 2.6 + .6;
    float n = uSteps;
    float stepL = span / n;
    float jitter = hash12(gl_FragCoord.xy + fract(uTime) * 61.);
    float acc = 0.;
    float t = stepL * jitter;
    for (int i = 0; i < 64; i++) {
      if (float(i) >= n) break;
      vec3 p = ro + rd * t;
      float along, radial, rad;
      float m = coneMask(p, along, radial, rad);
      if (m > 0.) {
        vec3 q = p * .085 + vec3(uTime * .006, -uTime * .012, uTime * .004);
        float smoke = texture(uNoise, q).a;
        float smoke2 = texture(uNoise, q * 3.1 + 5.).a;
        float dens = .25 + 1.6 * pow(smoke, 2.2) + .5 * smoke2 * smoke2;
        // soft core + gobo-ish streaks (rotating radial pattern)
        float ang = atan(dot(p - uApex, vec3(1., 0., 0.)), dot(p - uApex, vec3(0., 0., 1.)));
        float streak = mix(1., .65 + .35 * sin(ang * 9. + uTime * .2), uGobo);
        float core = exp(-pow(radial / rad, 2.) * 2.2);
        float fall = 1. / (1. + along * along * .02);
        acc += m * dens * (.35 + core) * streak * fall * stepL;
      }
      t += stepL;
    }
    // Henyey–Greenstein forward scattering: brighter when looking into the lamp
    float g = .55;
    float cosT = dot(-rd, -uDir);
    float hg = (1. - g * g) / pow(1. + g * g - 2. * g * cosT, 1.5);
    float e = acc * uIntensity * (.35 + .65 * hg);
    gl_FragColor = vec4(uColor * e, 1.);
  }`;

/* ------------------------------------------------------------------ *
 * Wet stage floor (Reflector): puddles + rough concrete + spotlight pools + tape marks
 * ------------------------------------------------------------------ */
export const floorVert = /* glsl */`
  uniform mat4 textureMatrix;
  varying vec4 vUvR; varying vec3 vWorld; varying vec2 vUv;
  void main(){
    vUvR = textureMatrix * vec4(position, 1.);
    vec4 w = modelMatrix * vec4(position, 1.);
    vWorld = w.xyz; vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

export const floorFrag = /* glsl */`
  precision highp sampler3D;
  uniform sampler2D tDiffuse;
  uniform sampler3D uNoise;
  uniform vec3 color;
  uniform float uTime, uReflect;
  uniform vec3 uSpotApex[3]; uniform vec3 uSpotDir[3]; uniform vec3 uSpotColor[3]; uniform float uSpotTan[3];
  uniform vec3 uAccent;
  varying vec4 vUvR; varying vec3 vWorld; varying vec2 vUv;
  ${GLSL.hash}
  float gridLine(vec2 p, float w){ vec2 g = abs(fract(p - .5) - .5) / fwidth(p); return 1. - min(min(g.x, g.y) / w, 1.); }
  void main(){
    vec2 xz = vWorld.xz;
    vec4 nz = texture(uNoise, vec3(xz * .045, .37));
    vec4 nzf = texture(uNoise, vec3(xz * .21, .71));
    // puddle mask: smooth low areas are mirror-like, the rest is rough concrete
    float puddle = smoothstep(.52, .6, nz.a);
    float rough = mix(1., .06, puddle);
    // ripples in puddles (slow drips)
    vec2 rip = vec2(0.);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 c = vec2(hash12(vec2(fi, floor(uTime * .25 + fi * .37))), hash12(vec2(fi + 7., floor(uTime * .25 + fi * .37)))) * vec2(18., 10.) - vec2(9., 7.);
      float age = fract(uTime * .25 + fi * .37);
      float dd = length(xz - c);
      float w = sin((dd - age * 3.) * 18.) * exp(-pow((dd - age * 3.) * 3., 2.)) * (1. - age);
      rip += normalize(xz - c + 1e-4) * w * .012 * puddle;
    }
    vec2 distort = (nzf.xy * .018 + rip) * (.4 + rough);
    vec2 ruv = vUvR.xy / vUvR.w + distort;
    // roughness blur: rotated 12-tap disc, radius grows with roughness and distance from the mirror plane
    vec3 refl = vec3(0.);
    float rad = rough * .022;
    float ang = hash12(gl_FragCoord.xy) * 6.283;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float a = ang + fi * 2.39996;
      float rr = sqrt((fi + .5) / 12.) * rad;
      refl += texture2D(tDiffuse, ruv + vec2(cos(a), sin(a)) * rr * vec2(1., 1.6)).rgb;
    }
    refl /= 12.;
    // fresnel (Schlick) from view angle
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = .04 + .96 * pow(1. - max(V.y, 0.), 5.);
    float reflAmt = mix(.25, 1., puddle) * mix(.35, 1., fres) * uReflect;

    // concrete albedo with stains
    vec3 base = color * (.55 + .45 * nzf.a) * (1. - puddle * .5);
    // stage tape marks & grid
    float grid = gridLine(xz * .5, 1.2) * .06;
    float tape = smoothstep(.04, .0, abs(vWorld.z - 1.2)) * step(abs(vWorld.x), 5.5) * .55;
    float cross1 = 0.;
    for (int i = -1; i <= 1; i++) { vec2 m = xz - vec2(float(i) * 3.2, -.6); cross1 += (smoothstep(.03, .0, abs(m.x)) * step(abs(m.y), .22) + smoothstep(.03, .0, abs(m.y)) * step(abs(m.x), .22)); }
    base += uAccent * (grid + (tape + cross1 * .8) * (1. - puddle * .6)) * .5;

    // spotlight pools on the floor (analytic cone ∩ plane)
    vec3 light = vec3(0.);
    for (int i = 0; i < 3; i++) {
      vec3 l = vWorld - uSpotApex[i];
      float along = dot(l, uSpotDir[i]);
      float radial = length(l - uSpotDir[i] * along);
      float rad = max(along * uSpotTan[i], 1e-3);
      float pool = smoothstep(rad, rad * .55, radial) * step(0., along);
      float hot = exp(-pow(radial / rad, 2.) * 3.);
      light += uSpotColor[i] * (pool * .6 + hot * 1.2) / (1. + along * .05);
    }
    vec3 col = base * (.04 + light * .9) + refl * reflAmt + light * .04 * rough;
    // distance fade into darkness
    float fade = smoothstep(26., 6., length(xz - vec2(0., -4.)));
    gl_FragColor = vec4(col * fade, 1.);
  }`;

/* ------------------------------------------------------------------ *
 * Dust motes: only glitter where they cross a light beam
 * ------------------------------------------------------------------ */
export const dustVert = /* glsl */`
  uniform float uTime, uPixel;
  uniform vec3 uSpotApex[3]; uniform vec3 uSpotDir[3]; uniform vec3 uSpotColor[3]; uniform float uSpotTan[3];
  attribute float aRand;
  varying vec3 vColor; varying float vA;
  void main(){
    vec3 p = position;
    p.y = mod(p.y - uTime * (.04 + aRand * .06) + 3., 12.) - 3.;
    p.x += sin(uTime * .3 + aRand * 50.) * .3;
    p.z += cos(uTime * .25 + aRand * 31.) * .3;
    vec3 lit = vec3(.012);
    for (int i = 0; i < 3; i++) {
      vec3 l = p - uSpotApex[i];
      float along = dot(l, uSpotDir[i]);
      float radial = length(l - uSpotDir[i] * along);
      float rad = max(along * uSpotTan[i], 1e-3);
      lit += uSpotColor[i] * smoothstep(rad, rad * .4, radial) * step(0., along) * 2.2;
    }
    float tw = .5 + .5 * sin(uTime * (1. + aRand * 3.) + aRand * 90.);
    vColor = lit * (.4 + tw * .9);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aRand * 2.6) * uPixel * 6. / -mv.z;
    vA = smoothstep(40., 4., -mv.z);
  }`;
export const dustFrag = /* glsl */`
  varying vec3 vColor; varying float vA;
  void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; gl_FragColor = vec4(vColor * exp(-d * d * 3.) * vA, 1.); }`;
