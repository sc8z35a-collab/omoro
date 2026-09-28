// Fullscreen photo with RGB-split liquid distortion that follows the pointer (and a slow idle wave).
import * as THREE from "three";

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const frag = /* glsl */`
  uniform sampler2D uTex; uniform vec2 uRes, uImg, uMouse; uniform float uTime, uHover, uVel;
  uniform vec3 uAccent;
  varying vec2 vUv;
  vec2 cover(vec2 uv){ float rs = uRes.x/uRes.y, ri = uImg.x/uImg.y; vec2 s = rs > ri ? vec2(1., ri/rs) : vec2(rs/ri, 1.); return (uv - .5) * s / 1.06 + .5; }
  void main(){
    vec2 uv = vUv;
    vec2 m = uMouse; vec2 asp = vec2(uRes.x/uRes.y, 1.);
    float d = distance(uv * asp, m * asp);
    float ring = sin(d * 28. - uTime * 4.) * exp(-d * 5.) * uHover;
    vec2 dir = normalize(uv - m + 1e-4);
    uv += dir * ring * .018 * (1. + uVel * 3.);
    uv.y += sin(uv.x * 6. + uTime * .5) * .003;
    uv.x += cos(uv.y * 5. + uTime * .4) * .003;
    vec2 cuv = cover(uv);
    float shift = .004 + abs(ring) * .02 + uVel * .01;
    vec3 col;
    col.r = texture2D(uTex, cover(uv + dir * shift)).r;
    col.g = texture2D(uTex, cuv).g;
    col.b = texture2D(uTex, cover(uv - dir * shift)).b;
    col *= .56;
    col = mix(col, col * uAccent * 1.6, .18);
    col += uAccent * smoothstep(.25, 0., d) * .08 * uHover;
    gl_FragColor = vec4(col, 1.);
  }`;

export class RippleImage {
  constructor(canvas, src, accent) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.mouse = new THREE.Vector2(.5, .5);
    this.target = new THREE.Vector2(.5, .5);
    this.hover = 0; this.hoverTarget = 0; this.vel = 0;
    this.uniforms = { uTex: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(1, 1) }, uMouse: { value: this.mouse }, uTime: { value: 0 }, uHover: { value: 0 }, uVel: { value: 0 }, uAccent: { value: new THREE.Color(accent) } };
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms })));
    new THREE.TextureLoader().load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.uniforms.uTex.value = tex;
      this.uniforms.uImg.value.set(tex.image.width, tex.image.height);
      canvas.classList.add("is-on");
    });
    this.timer = new THREE.Timer();
    this.resize();
    addEventListener("resize", () => this.resize());
    const host = canvas.parentElement;
    host.addEventListener("pointermove", (e) => {
      const b = canvas.getBoundingClientRect();
      const nx = (e.clientX - b.left) / b.width, ny = 1 - (e.clientY - b.top) / b.height;
      this.vel = Math.min(1, this.vel + Math.hypot(nx - this.target.x, ny - this.target.y) * 4);
      this.target.set(nx, ny);
      this.hoverTarget = 1;
    });
    host.addEventListener("pointerleave", () => { this.hoverTarget = 0; });
    this.visible = true;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
    r.setAnimationLoop(() => this.tick());
  }
  resize() { const w = this.canvas.clientWidth, h = this.canvas.clientHeight; this.renderer.setSize(w, h, false); this.uniforms.uRes.value.set(w, h); }
  tick() {
    if (!this.visible || document.hidden) return;
    this.timer.update();
    this.uniforms.uTime.value = this.timer.getElapsed();
    this.mouse.lerp(this.target, .08);
    this.hover += (this.hoverTarget - this.hover) * .05;
    this.vel *= .94;
    this.uniforms.uHover.value = .35 + this.hover * .65;
    this.uniforms.uVel.value = this.vel;
    this.renderer.render(this.scene, this.camera);
  }
}
