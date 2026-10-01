// Cinematic final grade, applied in linear HDR *before* OutputPass (tone mapping + sRGB).
//  - radial chromatic aberration (stronger at the edges)
//  - halation: warm red glow bleeding around very bright pixels (film look)
//  - animated, luminance-weighted film grain (blue-noise-ish hash, no banding)
//  - shaped vignette + shadow lift
import * as THREE from "three";

export const UltraFinalShader = {
  name: "UltraFinalShader",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCA: { value: .0018 },
    uGrain: { value: .055 },
    uVignette: { value: .38 },
    uHalation: { value: .12 },
    uLift: { value: new THREE.Vector3(.004, .004, .006) }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uGrain, uVignette, uHalation; uniform vec2 uResolution; uniform vec3 uLift;
    varying vec2 vUv;
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - .5;
      float r2 = dot(d, d);
      // chromatic aberration, quadratic falloff from centre
      vec2 off = d * r2 * uCA * 18.;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      // halation: sample a ring of neighbours, keep only very bright energy, tint warm
      if (uHalation > 0.) {
        vec2 px = 1. / uResolution;
        vec3 h = vec3(0.);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * .785398;
          vec2 o = vec2(cos(a), sin(a)) * px * 9.;
          vec3 s = texture2D(tDiffuse, uv + o).rgb;
          h += max(s - 1.1, 0.);
        }
        col += h / 8. * vec3(1., .32, .18) * uHalation * 4.;
      }
      // shadow lift (avoid crushed pure-black)
      col += uLift * (1. - smoothstep(0., .25, luma(col)));
      // vignette
      float v = smoothstep(.85, .18, length(d * vec2(1.08, 1.)));
      col *= mix(1. - uVignette, 1., v);
      // grain: stronger in mid-tones, animated at 24fps
      float t = floor(uTime * 24.);
      float n = hash12(uv * uResolution + t * 37.17) + hash12(uv * uResolution * 1.37 - t * 11.3) - 1.;
      float l = luma(col);
      col += n * uGrain * (.35 + .65 * smoothstep(.0, .35, l) * (1. - smoothstep(.6, 1.6, l)));
      gl_FragColor = vec4(max(col, 0.), 1.);
    }`
};
