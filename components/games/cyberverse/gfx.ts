import * as THREE from "three";

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
}
export const glowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => t ?? (t = canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  }));
})();

export function roadTexture(kind: "lane" | "plain", emissive: boolean) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = emissive ? "#000" : "#090a12"; g.fillRect(0, 0, 256, 256);
    if (!emissive) for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(160,170,220,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    if (kind === "lane") {
      const col = (c: string, e: string) => (emissive ? e : c);
      g.fillStyle = col("#c99a3a", "#ffb347"); g.fillRect(125, 0, 2, 256); g.fillRect(130, 0, 2, 256);
      g.fillStyle = col("#9fb4d0", "#bcd6ff");
      for (let y = 0; y < 256; y += 128) { g.fillRect(63, y, 3, 64); g.fillRect(190, y, 3, 64); }
      g.fillStyle = col("#1d7a88", "#22e6ff"); g.fillRect(8, 0, 3, 256); g.fillRect(245, 0, 3, 256);
    }
  }, !emissive);
}

export function signTexture(lines: string[], color: string, w = 512, h = 256) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = "rgba(4,6,18,.82)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    const sz = lines.length > 1 ? h / (lines.length + 1.1) : h * 0.45;
    lines.forEach((t, i) => { g.font = `700 ${sz}px Sora, system-ui, sans-serif`; g.shadowColor = color; g.shadowBlur = 18; g.fillText(t, w / 2, (h / (lines.length + 1)) * (i + 1)); });
  });
}

/** Building material: instanced boxes with procedural lit windows, roof neon band and shopfront glow. */
export function buildingMaterial(timeU: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec4 aTint; attribute vec2 aInfo; varying vec3 vWP; varying vec3 vNW; varying vec4 vTint; varying vec2 vInfo;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vTint=aTint; vInfo=aInfo; vec4 wp4=vec4(transformed,1.0);
#ifdef USE_INSTANCING
wp4=instanceMatrix*wp4;
#endif
wp4=modelMatrix*wp4; vWP=wp4.xyz; vNW=normalize(mat3(modelMatrix)*objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uTime; varying vec3 vWP; varying vec3 vNW; varying vec4 vTint; varying vec2 vInfo;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{ vec3 n=normalize(vNW);
  if(abs(n.y)<0.5){
    bool xf=abs(n.x)>0.5; float u=xf?vWP.z:vWP.x; float v=vWP.y;
    vec2 cell=vec2(floor(u/2.3),floor(v/3.5)); vec2 f=vec2(fract(u/2.3),fract(v/3.5));
    float win=step(0.24,f.x)*step(f.x,0.76)*step(0.30,f.y)*step(f.y,0.76);
    float id=h21(cell+vTint.a*17.0+(xf?3.7:0.0));
    float lit=step(1.0-vInfo.y,id);
    float pulse=0.78+0.22*sin(uTime*1.3+id*40.0);
    vec3 col=mix(vec3(0.75,0.88,1.0),vTint.rgb,step(0.5,fract(id*7.3)));
    float fw=fwidth(u/2.3)+fwidth(v/3.5); float fade=smoothstep(0.22,0.6,fw);
    float wl=mix(win*lit*pulse,vInfo.y*0.2,fade);
    totalEmissiveRadiance+=wl*col*1.05*step(2.0,v);
    float band=smoothstep(vInfo.x-1.6,vInfo.x-0.7,v)*step(v,vInfo.x-0.3);
    totalEmissiveRadiance+=vTint.rgb*band*1.3;
    float shop=step(v,3.2)*step(0.9,v)*step(0.1,f.x)*step(f.x,0.9);
    totalEmissiveRadiance+=vTint.rgb*shop*0.4*step(0.5,h21(cell+9.1));
  } }`);
  };
  return m;
}

export function beam(color: number, h: number, r = 0.6, op = 0.35) {
  const g = new THREE.CylinderGeometry(r, r * 1.6, h, 14, 1, true); g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
}
export const basic = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: o < 1, opacity: o });

export function disposeDeep(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      for (const k of Object.keys(x)) { const v = (x as unknown as Record<string, unknown>)[k]; if (v instanceof THREE.Texture) v.dispose(); }
      x.dispose();
    }
  });
}
