import{B as e,D as t,I as n,L as r,P as i,U as a,c as o,n as s,o as c,v as l,z as u}from"./three.module-DIB5LREV.js";var d=`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,f=`
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
  }`,p=class{constructor(p,m,h){this.canvas=p;let g=this.renderer=new s({canvas:p,antialias:!1});g.setPixelRatio(Math.min(devicePixelRatio,1.5)),this.scene=new n,this.camera=new c,this.mouse=new a(.5,.5),this.target=new a(.5,.5),this.hover=0,this.hoverTarget=0,this.vel=0,this.uniforms={uTex:{value:null},uRes:{value:new a(1,1)},uImg:{value:new a(1,1)},uMouse:{value:this.mouse},uTime:{value:0},uHover:{value:0},uVel:{value:0},uAccent:{value:new o(h)}},this.scene.add(new l(new t(2,2),new r({vertexShader:d,fragmentShader:f,uniforms:this.uniforms}))),new u().load(m,e=>{e.colorSpace=i,this.uniforms.uTex.value=e,this.uniforms.uImg.value.set(e.image.width,e.image.height),p.classList.add(`is-on`)}),this.timer=new e,this.resize(),addEventListener(`resize`,()=>this.resize());let _=p.parentElement;_.addEventListener(`pointermove`,e=>{let t=p.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=1-(e.clientY-t.top)/t.height;this.vel=Math.min(1,this.vel+Math.hypot(n-this.target.x,r-this.target.y)*4),this.target.set(n,r),this.hoverTarget=1}),_.addEventListener(`pointerleave`,()=>{this.hoverTarget=0}),this.visible=!0,new IntersectionObserver(([e])=>{this.visible=e.isIntersecting}).observe(p),g.setAnimationLoop(()=>this.tick())}resize(){let e=this.canvas.clientWidth,t=this.canvas.clientHeight;this.renderer.setSize(e,t,!1),this.uniforms.uRes.value.set(e,t)}tick(){this.visible&&!document.hidden&&(this.timer.update(),this.uniforms.uTime.value=this.timer.getElapsed(),this.mouse.lerp(this.target,.08),this.hover+=(this.hoverTarget-this.hover)*.05,this.vel*=.94,this.uniforms.uHover.value=.35+this.hover*.65,this.uniforms.uVel.value=this.vel,this.renderer.render(this.scene,this.camera))}};export{p as RippleImage};