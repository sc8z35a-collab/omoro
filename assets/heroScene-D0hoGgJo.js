import{c as e}from"./data-CQRK9EnX.js";import{r as t}from"./env-B9lK7qgX.js";import{i as n,n as r}from"./cardTexture-DVF1C8Uc.js";import{A as i,B as a,D as o,I as s,L as c,P as l,R as u,T as d,U as f,W as p,a as m,c as h,i as g,k as _,m as v,n as y,p as b,s as x,u as S,v as C,y as w}from"./three.module-DIB5LREV.js";import{i as T,n as E,r as D,t as O}from"./OutputPass-h45KQoJx.js";var k=14e3,A=6500;function j(e,t,{family:n=`"Dela Gothic One", "Zen Kaku Gothic New", sans-serif`}={}){let r=1400,i=document.createElement(`canvas`);i.width=r,i.height=700;let a=i.getContext(`2d`,{willReadFrequently:!0});a.fillStyle=`#000`,a.fillRect(0,0,r,700),a.fillStyle=`#fff`,a.textAlign=`center`,a.textBaseline=`middle`;let o=300;do a.font=`400 ${o}px ${n}`,o-=6;while(Math.max(...e.map(e=>a.measureText(e).width))>r*.92||o*1.1*e.length>644);let s=o*1.14;e.forEach((t,n)=>a.fillText(t,r/2,350+(n-(e.length-1)/2)*s));let c=a.getImageData(0,0,r,700).data,l=[];for(let e=0;e<700;e+=3)for(let t=0;t<r;t+=3)c[(e*r+t)*4]>128&&l.push(t,e);let u=new Float32Array(t*3),d=l.length/2;for(let e=0;e<t;e++){let t=d?Math.floor(Math.random()*d):0;u[e*3]=d?(l[t*2]/r-.5)*2+(Math.random()-.5)*.004:(Math.random()-.5)*2,u[e*3+1]=d?-(l[t*2+1]/700-.5)*1:Math.random()-.5,u[e*3+2]=(Math.random()-.5)*.06}return u}var M=`
  uniform float uTime, uMix, uSize, uScatter, uPixel;
  uniform vec3 uMouse;
  attribute vec3 aFrom, aTo;
  attribute float aRand;
  varying float vAlpha, vRand;
  // cheap hash noise
  vec3 hash3(float n){ return fract(sin(vec3(n, n+1.0, n+2.0)) * vec3(43758.5453, 22578.1459, 19642.3490)) - .5; }
  void main(){
    float t = clamp((uMix * 1.7) - aRand * .7, 0., 1.);
    t = t * t * (3. - 2. * t);
    vec3 p = mix(aFrom, aTo, t);
    // swirl mid-transition
    float mid = sin(t * 3.14159);
    p += hash3(aRand * 100.) * mid * 1.6;
    p.z += mid * (aRand - .5) * 2.;
    // idle breathing
    p += vec3(sin(uTime * .9 + aRand * 40.), cos(uTime * .7 + aRand * 30.), sin(uTime * .5 + aRand * 20.)) * .012;
    // scatter on scroll
    p += hash3(aRand * 71.) * uScatter * 9.;
    // mouse repulsion (in world units)
    vec3 d = p - uMouse;
    float dist = length(d.xy);
    float force = smoothstep(.9, 0., dist);
    p.xy += normalize(d.xy + 1e-4) * force * .45;
    p.z += force * .6;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (0.6 + aRand * .8) * (1. / -mv.z);
    vAlpha = .55 + .45 * (1. - mid) ;
    vRand = aRand;
  }`,N=`
  uniform vec3 uColorA, uColorB;
  uniform float uTime;
  varying float vAlpha, vRand;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float d = length(c);
    if (d > .5) discard;
    float core = smoothstep(.5, .0, d);
    vec3 col = mix(uColorA, uColorB, step(.86, vRand));
    col += .25 * sin(uTime * 2. + vRand * 30.);
    gl_FragColor = vec4(col * (0.55 + core * .6), core * vAlpha * .85);
  }`,P=`
  varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,F=`
  uniform vec3 uColor; uniform float uOpacity, uTime;
  varying float vY; varying vec3 vN; varying vec3 vV;
  void main(){
    float rim = pow(abs(dot(vN, vV)), 1.6);
    float fall = pow(vY, 1.4);
    float flicker = .92 + .08 * sin(uTime * 3. + vY * 10.);
    gl_FragColor = vec4(uColor, rim * fall * uOpacity * flicker);
  }`,I=`
  uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
  void main(){
    vec2 g = vUv * 60.;
    vec2 grid = abs(fract(g - .5) - .5) / fwidth(g);
    float line = 1. - min(min(grid.x, grid.y), 1.);
    float r = distance(vUv, vec2(.5));
    float fade = smoothstep(.5, .05, r);
    float pulse = smoothstep(.02, .0, abs(fract(r * 4. - uTime * .12) - .5) - .47);
    vec3 col = uColor * (line * .35 + pulse * .25) * fade;
    col += vec3(.02, .022, .02) * fade;
    gl_FragColor = vec4(col, fade);
  }`,L=class{constructor(e,n,{onReady:r}={}){this.canvas=e,this.moments=n,this.index=0,this.mobile=t(),this.count=this.mobile?A:k,this.pointer=new f(0,0),this.mouseWorld=new p(99,99,0),this.scroll=0,this.visible=!0,this.clock=new a,this.onReady=r,this.init()}async init(){let e=this.renderer=new y({canvas:this.canvas,antialias:!1,alpha:!1,powerPreference:`high-performance`});e.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.5:1.75)),e.setClearColor(723981,1),e.toneMapping=4;let t=this.scene=new s;t.fog=new b(723981,.045);let n=this.camera=new d(this.mobile?55:42,1,.1,200);n.position.set(0,.3,9),this.root=new v,t.add(this.root),await r(),this.buildParticles(),this.buildCones(),this.buildFloor(),this.buildDust(),this.buildCards(),this.composer=new T(e),this.composer.addPass(new D(t,n)),this.bloom=new E(new f(512,512),this.mobile?.55:.7,.45,.42),this.composer.addPass(this.bloom),this.composer.addPass(new O),this.resize(),this.bind(),e.setAnimationLoop(()=>this.tick()),this.onReady?.()}buildParticles(){let t=new m,n=new Float32Array(this.count*3);for(let e=0;e<n.length;e++)n[e]=(Math.random()-.5)*14;this.targets=this.moments.map(e=>j(e.lines,this.count)),this.introTarget=j([`面白い`,`ねえ。`],this.count);let r=new Float32Array(this.count);for(let e=0;e<this.count;e++)r[e]=Math.random();t.setAttribute(`position`,new g(new Float32Array(this.count*3),3)),t.setAttribute(`aFrom`,new g(n,3)),t.setAttribute(`aTo`,new g(this.introTarget.slice(),3)),t.setAttribute(`aRand`,new g(r,1)),t.boundingSphere=new u(new p,50),this.pMat=new c({vertexShader:M,fragmentShader:N,transparent:!0,depthWrite:!1,blending:2,uniforms:{uTime:{value:0},uMix:{value:0},uSize:{value:this.mobile?30:24},uPixel:{value:1},uScatter:{value:0},uMouse:{value:this.mouseWorld},uColorA:{value:new h(`#eef0e8`)},uColorB:{value:new h(`#d8ff4f`)}}}),this.points=new _(t,this.pMat),this.textScale=this.mobile?2.1:3.7,this.points.scale.set(this.textScale,this.textScale,this.textScale),this.points.position.y=1.45,this.root.add(this.points),e.to(this.pMat.uniforms.uMix,{value:1,duration:3.2,ease:`power2.inOut`,delay:.2})}morphTo(t,n){let r=this.points.geometry,i=r.getAttribute(`aFrom`),a=r.getAttribute(`aTo`);if(i.array.set(a.array),i.needsUpdate=!0,a.array.set(t),a.needsUpdate=!0,this.pMat.uniforms.uMix.value=0,e.killTweensOf(this.pMat.uniforms.uMix),e.to(this.pMat.uniforms.uMix,{value:1,duration:2.1,ease:`power3.inOut`}),n){let t=new h(n);e.to(this.pMat.uniforms.uColorB.value,{r:t.r,g:t.g,b:t.b,duration:1.2}),this.cones.forEach((n,r)=>{r===1&&e.to(n.material.uniforms.uColor.value,{r:t.r,g:t.g,b:t.b,duration:1.4})}),e.to(this.floor.material.uniforms.uColor.value,{r:t.r,g:t.g,b:t.b,duration:1.4})}}show(t){this.index=(t+this.moments.length)%this.moments.length,this.morphTo(this.targets[this.index],this.moments[this.index].accent),this.cardGroup&&e.to(this.cardGroup.rotation,{y:-this.index*(Math.PI*2/this.moments.length),duration:2,ease:`power3.inOut`})}showIntro(){this.morphTo(this.introTarget,`#d8ff4f`)}buildCones(){this.cones=[];for(let[e,t,n]of[[-5.5,`#b6a2ec`,-.35],[0,`#d8ff4f`,0],[5.5,`#ff90b4`,.35]]){let r=new S(2.6,12,48,1,!0);r.translate(0,-6,0);let i=new c({vertexShader:P,fragmentShader:F,transparent:!0,depthWrite:!1,blending:2,side:2,uniforms:{uColor:{value:new h(t)},uOpacity:{value:e===0?.11:.07},uTime:{value:0}}}),a=new C(r,i);a.position.set(e,7.5,-3),a.rotation.z=n,a.userData.baseTilt=n,this.root.add(a),this.cones.push(a)}}buildFloor(){let e=new o(80,80),t=new c({vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,fragmentShader:I,transparent:!0,depthWrite:!1,uniforms:{uColor:{value:new h(`#d8ff4f`)},uTime:{value:0}}});t.extensions={derivatives:!0},this.floor=new C(e,t),this.floor.rotation.x=-Math.PI/2,this.floor.position.y=-2.6,this.root.add(this.floor)}buildDust(){let e=this.mobile?500:1400,t=new Float32Array(e*3);for(let n=0;n<e;n++)t[n*3]=(Math.random()-.5)*30,t[n*3+1]=Math.random()*12-3,t[n*3+2]=(Math.random()-.5)*30;let n=new m;n.setAttribute(`position`,new g(t,3));let r=new i({size:.035,color:15659240,transparent:!0,opacity:.45,depthWrite:!1,blending:2});this.dust=new _(n,r),this.root.add(this.dust)}async buildCards(){let t=this.cardGroup=new v;t.position.set(0,.6,-17),this.root.add(t);let r=this.mobile?8:10,i=Math.PI*2/this.moments.length;(await Promise.all(this.moments.map(e=>n(e,{width:512,height:700,small:!0})))).forEach((n,a)=>{let s=new x(n);s.colorSpace=l,s.anisotropy=4;let c=new w({map:s,transparent:!0,opacity:0,side:2,fog:!0}),u=new C(new o(2.6,3.55),c),d=a*i;u.position.set(Math.sin(d)*r,Math.sin(a*1.7)*.6,Math.cos(d)*r-0),u.lookAt(0,u.position.y,0),u.rotateY(Math.PI),t.add(u),e.to(c,{opacity:.5,duration:2,delay:.6+a*.12})})}bind(){this.onMove=e=>{let t=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1);let n=new p(this.pointer.x,this.pointer.y,.5).unproject(this.camera).sub(this.camera.position).normalize(),r=(0-this.camera.position.z)/n.z,i=this.camera.position.clone().add(n.multiplyScalar(r));this.mouseWorld.set((i.x-this.points.position.x)/this.textScale,(i.y-this.points.position.y)/this.textScale,0)},this.onLeave=()=>this.mouseWorld.set(99,99,0),addEventListener(`pointermove`,this.onMove,{passive:!0}),this.canvas.addEventListener(`pointerleave`,this.onLeave),this.onResize=()=>this.resize(),addEventListener(`resize`,this.onResize),this.io=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting},{threshold:0}),this.io.observe(this.canvas),document.addEventListener(`visibilitychange`,()=>{this.hidden=document.hidden})}resize(){let e=this.canvas.clientWidth||innerWidth,n=this.canvas.clientHeight||innerHeight;this.mobile=t(),this.renderer.setSize(e,n,!1),this.composer?.setSize(e,n),this.camera.aspect=e/n,this.camera.fov=e/n<1?60:42,this.camera.updateProjectionMatrix(),this.textScale=e/n<1?2.1:3.7,this.points?.scale.setScalar(this.textScale),this.pMat&&(this.pMat.uniforms.uPixel.value=this.renderer.getPixelRatio()*(n/900))}setScroll(e){this.scroll=e}tick(){if(!this.visible||this.hidden)return;this.clock.update();let e=this.clock.getElapsed(),t=this.pMat.uniforms;t.uTime.value=e,t.uScatter.value+=(this.scroll*this.scroll*.9-t.uScatter.value)*.12,this.cones.forEach((t,n)=>{t.material.uniforms.uTime.value=e,t.rotation.z=t.userData.baseTilt+Math.sin(e*.4+n*2)*.12}),this.floor.material.uniforms.uTime.value=e,this.dust.rotation.y=e*.015,this.dust.position.y=Math.sin(e*.2)*.2,this.cardGroup&&this.cardGroup.children.forEach((t,n)=>{t.position.y=Math.sin(e*.6+n*1.7)*.5});let n=this.pointer.x*.9,r=this.pointer.y*.45;this.camera.position.x+=(n-this.camera.position.x)*.04,this.camera.position.y+=(.3+r-this.scroll*2-this.camera.position.y)*.05,this.camera.position.z+=(9-this.scroll*4-this.camera.position.z)*.06,this.camera.lookAt(0,.2-this.scroll*1.5,-2),this.composer.render()}dispose(){this.renderer.setAnimationLoop(null),removeEventListener(`pointermove`,this.onMove),removeEventListener(`resize`,this.onResize),this.io?.disconnect(),this.renderer.dispose()}};export{L as HeroScene};