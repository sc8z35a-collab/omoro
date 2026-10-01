// GLSL for the gallery (owned by agent C).
import { GLSL } from "../fx/index.js";

/* ------------------------------------------------------------------------------------------------
 * Moment card: a print mounted behind glass inside a gilded frame.
 *  - photo layer sits "deep" (parallax by the object-space view vector)
 *  - ghost number at mid depth, ink at the surface
 *  - quote / rules are hot-foil stamped: champagne gold with thin-film interference + brushed spec
 *  - glitter flakes in the speaker line that only sparkle at certain angles
 *  - frame-lip contact shadow, spotlight pool, holographic sweep, "photo developing" intro dissolve
 * ---------------------------------------------------------------------------------------------- */
export const cardVert = /* glsl */`
  uniform float uTime, uHover, uBend;
  varying vec2 vUv; varying vec3 vViewObj; varying vec3 vW;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159) * uBend * .28;
    p.z += sin(uv.y * 7. + uTime * 2.2) * .012 * uHover;
    vec4 w = modelMatrix * vec4(p, 1.);
    vW = w.xyz;
    vec3 camObj = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz;
    vViewObj = camObj - p;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

export const cardFrag = /* glsl */`
  uniform sampler2D uPhoto, uInk, uMask;
  uniform float uTime, uHover, uDim, uReveal, uLight;
  uniform vec3 uAccent; uniform vec2 uPointer, uAspect;
  varying vec2 vUv; varying vec3 vViewObj; varying vec3 vW;
  ${GLSL.hash}
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }
  float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
  void main(){
    vec3 V = normalize(vViewObj);
    vec2 par = V.xy / max(V.z, .3);
    par = clamp(par, -1.2, 1.2);

    // ---- deep photo layer (8% oversize, parallax)
    vec2 uvP = (vUv - .5) * .92 + .5 - par * vec2(.03, .03 * uAspect.x);
    vec3 photo = texture2D(uPhoto, uvP).rgb;
    // holographic sweep living *in* the emulsion
    float sweep = smoothstep(.1, .0, abs(fract(vUv.x * .55 + vUv.y * .45 - uTime * .07 + par.x * .25) - .5));
    vec3 holo = .5 + .5 * cos(6.2831 * (vUv.x * .7 + vUv.y + par.x * .6 + uTime * .05 + vec3(0., .33, .67)));
    photo += holo * sweep * (.05 + .1 * uHover) * (.4 + luma(photo));

    // ---- mid layer: etched ghost number
    vec4 mMid = texture2D(uMask, vUv - par * .014);
    photo = mix(photo, photo * 1.25 + vec3(.04), mMid.g * .35);

    // ---- surface: ink + foil + glitter
    vec4 ink = texture2D(uInk, vUv);
    vec4 mk = texture2D(uMask, vUv);
    vec3 col = mix(photo, ink.rgb, ink.a);

    // virtual key light follows the pointer a little so the foil "rolls"
    vec3 L = normalize(vec3(uPointer.x * .8, .9 + uPointer.y * .5, 1.));
    vec2 brushed = vec2(vnoise(vUv * vec2(900., 6.)), vnoise(vUv * vec2(6., 900.))) - .5;
    vec3 N = normalize(vec3(brushed * .16, 1.));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.), 60.);
    float broad = pow(max(dot(N, H), 0.), 6.);
    float film = dot(V, N) * 1.7 + vUv.y * .6 + vUv.x * .25;
    vec3 irid = .5 + .5 * cos(6.2831 * (film + vec3(0., .33, .67)));
    vec3 gold = vec3(1., .79, .45);
    vec3 foil = mix(gold, gold * irid * 1.6, .38) * (.42 + broad * .9) + vec3(1., .93, .8) * spec * 3.2;
    col = mix(col, foil, mk.r * smoothstep(.0, .6, ink.a + mk.r));

    // glitter flakes
    vec2 cell = floor(vUv * vec2(520., 520. * uAspect.y));
    float hh = hash12(cell);
    float flake = step(.965, hh) * pow(max(0., sin(hh * 91. + dot(par, vec2(13., 9.)) * 3. + uTime * 1.3)), 24.);
    col += flake * mk.b * vec3(1., .95, .86) * 4.;

    // ---- light & shadow from the mount
    vec2 e = min(vUv, 1. - vUv);
    float lip = smoothstep(0., .05, e.x) * smoothstep(0., .04, e.y);
    col *= mix(.25, 1., lip);
    col *= mix(.5, 1., smoothstep(.0, .16, 1. - vUv.y));            // frame top casts a shadow (spot is above)
    float pool = smoothstep(.95, .05, length((vUv - vec2(.5, .66)) * vec2(1.05, .85)));
    col *= (.75 + .55 * pool) * mix(.2, 1.12, uLight) * (1. + uHover * .2);
    col += uAccent * pow(1. - max(V.z, 0.), 3.) * uHover * .25;

    // dim (other cards while one is focused) — darker and a touch desaturated
    col = mix(col, vec3(luma(col)) * .9, uDim * .5) * (1. - uDim * .62);

    // ---- intro: the print "develops" out of black with a glowing burn front
    float n = fbm2(vUv * vec2(6., 8.)) * .85 + vUv.y * .25;
    float edge = uReveal * 1.25 - .15;
    float vis = smoothstep(n - .03, n + .03, edge);
    float front = smoothstep(n - .07, n, edge) - smoothstep(n, n + .07, edge);
    col = mix(vec3(.003), col, vis) + uAccent * front * 2.4 * (1. - uReveal * .4);

    gl_FragColor = vec4(col, 1.);
  }`;

/* ------------------------------------------------------------------------------------------------
 * Paper chōchin lanterns (instanced). Translucent paper: brighter where it faces you,
 * bamboo ribs, lacquered caps, a painted band, slow candle flicker. Emits > 1.0 so bloom picks it up.
 * ---------------------------------------------------------------------------------------------- */
export const lanternVert = /* glsl */`
  attribute float aPhase; attribute float aDelay;
  uniform float uTime;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vPhase; varying float vDelay; varying vec3 vCol;
  void main(){
    vUv = uv; vPhase = aPhase; vDelay = aDelay;
    #ifdef USE_INSTANCING_COLOR
      vCol = instanceColor;
    #else
      vCol = vec3(1., .3, .2);
    #endif
    vec3 p = position;
    float sway = sin(uTime * .7 + aPhase * 6.) * .05;
    p.x += sway * (1. - uv.y); 
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
export const lanternFrag = /* glsl */`
  uniform float uTime, uIntro;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vPhase; varying float vDelay; varying vec3 vCol;
  void main(){
    float on = smoothstep(vDelay, vDelay + .12, uIntro);
    float face = abs(dot(normalize(vN), normalize(vV)));
    float rib = smoothstep(.0, .12, abs(fract(vUv.y * 13.) - .5));
    float band = smoothstep(.40, .42, vUv.y) - smoothstep(.58, .60, vUv.y);
    float flick = .86 + .1 * sin(uTime * 7.3 + vPhase * 30.) + .06 * sin(uTime * 17.1 + vPhase * 11.);
    vec3 paper = vCol * (.8 + 2.6 * pow(face, 1.6)) * mix(.45, 1., rib) * flick;
    paper = mix(paper, paper * vec3(.25, .2, .18), band * .55);              // painted band (darker ink)
    float cap = step(vUv.y, .07) + step(.93, vUv.y);
    vec3 col = mix(paper * 1.5, vec3(.02, .015, .012), cap);
    gl_FragColor = vec4(col * mix(.02, 1., on), 1.);
  }`;

/* ------------------------------------------------------------------------------------------------
 * Volumetric beam: additive cone, brighter along the axis (face-on), fading with length,
 * drifting smoke noise. Cheap but reads as light-in-haze when combined with lit dust.
 * ---------------------------------------------------------------------------------------------- */
export const beamVert = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
export const beamFrag = /* glsl */`
  uniform vec3 uColor; uniform float uTime, uOn;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
  ${GLSL.noise}
  void main(){
    float face = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
    float along = vUv.y;                       // 1 at the lamp, 0 at the far end
    float fade = pow(along, 1.4) * smoothstep(.0, .25, along) * smoothstep(1., .93, along);
    float smoke = .55 + .45 * snoise(vec3(vW.x * .35, vW.y * .5 - uTime * .12, vW.z * .35 + uTime * .05));
    float a = face * fade * smoke * uOn;
    gl_FragColor = vec4(uColor * a * .15, 1.);
  }`;

/* ------------------------------------------------------------------------------------------------
 * Dust motes: drift on a cheap curl-ish field; they only light up inside the six spot cones,
 * so the beams look like they are cutting through real haze.
 * ---------------------------------------------------------------------------------------------- */
export const dustVert = /* glsl */`
  attribute float aSeed;
  uniform float uTime, uPx, uOn;
  uniform vec3 uLightPos[6]; uniform vec3 uLightDir[6]; uniform vec3 uLightCol[6];
  varying vec3 vCol; varying float vA;
  void main(){
    vec3 p = position;
    float t = uTime * .06;
    p += vec3(sin(t * 1.3 + aSeed * 40. + p.y * .4), sin(t * 1.1 + aSeed * 13. + p.x * .3) * .6, cos(t * 1.2 + aSeed * 27. + p.z * .35)) * .7;
    p.y = mod(p.y + uTime * .03 * (.3 + aSeed) + 3.4, 13.) - 3.4;
    vec3 lit = vec3(.0);
    for (int i = 0; i < 6; i++){
      vec3 d = p - uLightPos[i];
      float dist = length(d);
      float c = dot(d / dist, uLightDir[i]);
      float cone = smoothstep(.9, .96, c) * smoothstep(13., 2., dist);
      lit += uLightCol[i] * cone;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    float tw = .55 + .45 * sin(uTime * (1. + aSeed * 3.) + aSeed * 50.);
    vCol = (vec3(.05, .05, .06) + lit * 2.2) * tw * uOn;
    vA = 1.;
    gl_PointSize = uPx * (.6 + aSeed * 1.4) * (6. / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
export const dustFrag = /* glsl */`
  varying vec3 vCol; varying float vA;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float d = smoothstep(.5, .0, length(c));
    gl_FragColor = vec4(vCol * d * d, 1.);
  }`;

/* Neon tube sign: a canvas mask (R = tube core, G = wide glow) driven hot with buzz/flicker. */
export const neonFrag = /* glsl */`
  uniform sampler2D uMask; uniform vec3 uColor; uniform float uTime, uOn;
  varying vec2 vUv;
  ${GLSL.hash}
  void main(){
    vec4 m = texture2D(uMask, vUv);
    float t = floor(uTime * 18.);
    float buzz = .92 + .08 * hash11(t);
    float drop = step(.985, hash11(floor(uTime * 4.))) * .7;       // occasional flicker dropout
    float k = buzz * (1. - drop) * uOn;
    vec3 col = (uColor * m.g * .9 + mix(uColor, vec3(1.), .55) * m.r * 3.2) * k;
    gl_FragColor = vec4(col, 1.);
  }`;
export const quadVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
