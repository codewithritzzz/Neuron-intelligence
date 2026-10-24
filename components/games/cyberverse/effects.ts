import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export class Sky {
  mesh: THREE.Mesh; u = { uTime: { value: 0 }, uFlash: { value: 0 }, uCloud: { value: 0.3 } };
  constructor() {
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: `varying vec3 vD; uniform float uTime,uFlash,uCloud;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
void main(){
  float y=max(vD.y,0.0);
  vec3 col=mix(vec3(0.20,0.05,0.30),vec3(0.006,0.008,0.03),pow(y,0.42));
  col+=vec3(0.55,0.05,0.40)*exp(-y*12.0)*0.40+vec3(0.0,0.30,0.45)*exp(-y*34.0)*0.22;
  vec2 sp=vD.xz/(vD.y+0.25)*90.0; float st=step(0.9965,h(floor(sp)))*smoothstep(0.12,0.45,y);
  float cl=fbm(vD.xz/(vD.y+0.35)*2.2+uTime*0.01);
  col+=vec3(0.9)*st*(1.0-uCloud*0.9)*(0.6+0.4*sin(uTime*2.0+h(floor(sp))*30.0));
  col=mix(col,col*0.3+vec3(0.025,0.02,0.05),uCloud*smoothstep(0.0,0.4,y)*smoothstep(0.35,0.7,cl));
  col+=vec3(0.55,0.6,1.0)*uFlash*(0.35+cl*0.9)*smoothstep(0.0,0.3,y);
  gl_FragColor=vec4(col,1.0);
}`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), m); this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
  }
}

export function makeEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, vertexShader: "varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vD; void main(){ float y=vD.y*0.5+0.5; vec3 c=mix(vec3(0.02,0.01,0.05),vec3(0.35,0.08,0.45),exp(-abs(vD.y)*5.0)); c+=vec3(0.0,0.05,0.12)*y; gl_FragColor=vec4(c,1.0);} ",
  })));
  const cols = [0x22e6ff, 0xff3df0, 0x9b5cff, 0xffb347];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, p = new THREE.Mesh(new THREE.PlaneGeometry(10 + (i % 3) * 5, 1.4 + (i % 4)), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 4]).multiplyScalar(7), side: THREE.DoubleSide }));
    p.position.set(Math.cos(a) * 38, 2 + (i % 5) * 4, Math.sin(a) * 38); p.lookAt(0, p.position.y, 0); s.add(p);
  }
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.03); pm.dispose();
  s.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
  return rt.texture;
}

export class Rain {
  mesh: THREE.LineSegments; u = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(90, 46, 90) }, uOpacity: { value: 0.5 } };
  private max = 3200; private count = 0;
  constructor() {
    const base = new Float32Array(this.max * 6), end = new Float32Array(this.max * 2);
    for (let i = 0; i < this.max; i++) { const x = Math.random() * 90, y = Math.random() * 46, z = Math.random() * 90; base.set([x, y, z, x, y, z], i * 3 * 2); end[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.max * 6), 3)); g.setAttribute("aBase", new THREE.BufferAttribute(base, 3)); g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    this.mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute vec3 aBase; attribute float aEnd; uniform float uTime,uOpacity; uniform vec3 uCenter,uBox; varying float vA;
void main(){ float y=mod(aBase.y-uTime*38.0,uBox.y); vec2 rel=mod(aBase.xz-uCenter.xz,uBox.xz)-uBox.xz*0.5;
  vec3 w=vec3(uCenter.x+rel.x,uCenter.y-uBox.y*0.3+y,uCenter.z+rel.y); w+=vec3(0.07,1.0,0.0)*aEnd*1.1; vA=(1.0-aEnd*0.85)*uOpacity;
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }`,
      fragmentShader: "varying float vA; void main(){ gl_FragColor=vec4(0.55,0.75,1.0,vA); }",
    }));
    this.mesh.frustumCulled = false; this.mesh.geometry.setDrawRange(0, 0);
  }
  set(amount: number) { this.count = Math.floor(this.max * amount) * 2; this.mesh.geometry.setDrawRange(0, this.count); this.mesh.visible = this.count > 0; }
  update(t: number, cam: THREE.Vector3) { this.u.uTime.value = t; this.u.uCenter.value.copy(cam); }
}

export class Lightning {
  flash = 0; private next = 6; enabled = false;
  update(dt: number, onThunder: () => void) {
    this.flash = Math.max(0, this.flash - dt * 4);
    if (!this.enabled) return;
    this.next -= dt;
    if (this.next <= 0) { this.next = 6 + Math.random() * 9; this.flash = 1; setTimeout(onThunder, 700 + Math.random() * 1500); setTimeout(() => { this.flash = 0.8; }, 140); }
  }
}

export class Particles {
  mesh: THREE.Points; private max: number; private pos: Float32Array; private col: Float32Array; private siz: Float32Array; private alp: Float32Array; private vel: Float32Array; private life: Float32Array; private ml: Float32Array; private i = 0;
  u = { uScale: { value: 400 } }; density = 1;
  constructor(max = 500) {
    this.max = max; this.pos = new Float32Array(max * 3).fill(-9999); this.col = new Float32Array(max * 3); this.siz = new Float32Array(max); this.alp = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("aCol", new THREE.BufferAttribute(this.col, 3)); g.setAttribute("aSize", new THREE.BufferAttribute(this.siz, 1)); g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alp, 1));
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aCol; attribute float aSize,aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
void main(){ vC=aCol; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: "varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d)*vA; gl_FragColor=vec4(vC*a*1.4,a); }",
    }));
    this.mesh.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, g: number, b: number, size: number) {
    if (Math.random() > this.density) return;
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos.set([x, y, z], k * 3); this.vel.set([vx, vy, vz], k * 3); this.col.set([r, g, b], k * 3); this.siz[k] = size; this.life[k] = life; this.ml[k] = life;
  }
  update(dt: number) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { if (this.alp[k] !== 0) { this.alp[k] = 0; this.pos[k * 3 + 1] = -9999; } continue; }
      this.life[k] -= dt; const t = this.life[k] / this.ml[k];
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt; this.alp[k] = Math.max(0, t);
    }
    const a = this.mesh.geometry.attributes; a.position.needsUpdate = a.aAlpha.needsUpdate = a.aCol.needsUpdate = a.aSize.needsUpdate = true;
  }
}

export class Post {
  composer: EffectComposer; bloom: UnrealBloomPass; enabled = true;
  constructor(private r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, w: number, h: number) {
    this.composer = new EffectComposer(r); this.composer.addPass(new RenderPass(scene, cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.5, 0.78); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, pr: number) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  render(scene: THREE.Scene, cam: THREE.Camera) { if (this.enabled) this.composer.render(); else this.r.render(scene, cam); }
  dispose() { this.composer.dispose(); }
}
