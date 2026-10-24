import * as THREE from "three";
import { N, roadAt, blockAt, districtOf, mulberry } from "./config";
import type { City } from "./city";
import type { Pad } from "./collision";
import { basic, beam, canvasTex, signTexture } from "./gfx";

export type POIType = "charge" | "repair" | "nav" | "hub" | "discovery" | "viewpoint" | "transit" | "landmark" | "pad";
export interface POI { id: string; type: POIType; name: string; desc: string; x: number; y: number; z: number; r: number; found: boolean; obj: THREE.Object3D; pad?: Pad }
export const POI_COLOR: Record<POIType, string> = { charge: "#22e6ff", repair: "#ffb347", nav: "#7aa8ff", hub: "#9b5cff", discovery: "#ff3df0", viewpoint: "#ffe066", transit: "#3dffb0", landmark: "#ffffff", pad: "#22e6ff" };

export class Extras {
  pois: POI[] = []; spinners: THREE.Object3D[] = []; group = new THREE.Group(); pads: Pad[] = []; water: THREE.Mesh[] = [];
  constructor(private city: City, scene: THREE.Scene) {
    scene.add(this.group); this.pads = city.cw.pads;
    this.park(); this.industrial(); this.arch(); this.padsBuild(); this.poiList();
  }
  private add(o: THREE.Object3D) { this.group.add(o); return o; }
  private corner(ii: number, jj: number, sx: number, sz: number) { return { x: roadAt(ii) + sx * 12.6, z: roadAt(jj) + sz * 12.6 }; }

  private park() {
    const r = mulberry(77), cw = this.city.cw, trees: { x: number; z: number; s: number; c: number }[] = [];
    const lawn = new THREE.MeshStandardMaterial({ color: 0x0b2a1c, emissive: 0x04180f, roughness: 0.9 }), path = basic(0x3dffb0, 0.8);
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x06202a, emissive: 0x04202c, roughness: 0.08, metalness: 0.95, envMap: this.city.env, envMapIntensity: 1.4 });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (districtOf(i, j) !== "park") continue;
      const cx = blockAt(i), cz = blockAt(j), keep: { x: number; z: number; r: number }[] = [];
      const l = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), lawn); l.position.set(cx, 0.17, cz); this.add(l);
      for (const [w, d] of [[60, 2], [2, 60]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), path); p.position.set(cx, 0.19, cz); this.add(p); }
      if ((i === 3 && j === 5) || (i === 4 && j === 6)) {
        const rad = i === 3 ? 14 : 12, w = new THREE.Mesh(new THREE.CircleGeometry(rad, 48).rotateX(-Math.PI / 2), pondMat); w.position.set(cx, 0.22, cz); this.add(w); this.water.push(w);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.2, 6, 64).rotateX(Math.PI / 2), basic(0x22e6ff)); rim.position.set(cx, 0.3, cz); this.add(rim);
        cw.addCirc({ x: cx, z: cz, r: rad, y0: 0, y1: 2 }); keep.push({ x: cx, z: cz, r: rad + 3 });
      } else if (i === 4 && j === 5) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5affc8, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.6, envMap: this.city.env, side: THREE.DoubleSide, depthWrite: false }));
        dome.position.set(cx, 0.2, cz); this.add(dome);
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), basic(0x3dffb0, 0.9)); core.position.set(cx, 8, cz); this.add(core); this.spinners.push(core);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.3, 6, 64).rotateX(Math.PI / 2), basic(0x3dffb0)); rim.position.set(cx, 0.4, cz); this.add(rim);
        cw.addCirc({ x: cx, z: cz, r: 16, y0: 0, y1: 16 }); keep.push({ x: cx, z: cz, r: 20 });
      }
      for (let n = 0; n < 26; n++) {
        const x = cx + (r() - 0.5) * 56, z = cz + (r() - 0.5) * 56;
        if (Math.abs(x - cx) < 3 || Math.abs(z - cz) < 3 || keep.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
        trees.push({ x, z, s: 0.8 + r() * 0.9, c: [0x2ad8ff, 0x3dffb0, 0x7a5cff, 0x2affd0][Math.floor(r() * 4)] }); cw.addCirc({ x, z, r: 0.6, y0: 0, y1: 6 });
      }
    }
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 6), new THREE.MeshStandardMaterial({ color: 0x1b1626 }), trees.length);
    const cn = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }), trees.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    trees.forEach((t, i) => { m4.compose(new THREE.Vector3(t.x, 2.5 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s)); tr.setMatrixAt(i, m4); m4.compose(new THREE.Vector3(t.x, 6.2 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s * 1.2, t.s)); cn.setMatrixAt(i, m4); cn.setColorAt(i, c.set(t.c)); });
    this.add(tr); this.add(cn);
  }

  private industrial() {
    const cw = this.city.cw, cols = [0x7a2a2a, 0x2a4a7a, 0x2a6a4a, 0x8a6a2a, 0x555a66], list: { x: number; y: number; z: number; c: number }[] = [], stacks: { x: number; z: number }[] = [];
    const r = mulberry(5);
    for (let i = 5; i < N; i++) for (let j = 3; j < N; j++) {
      if ((i + j) % 2 !== 1) continue;
      const cx = blockAt(i), cz = blockAt(j) + 16;
      for (let c = 0; c < 5; c++) for (let rr = 0; rr < 4; rr++) {
        const h = 1 + Math.floor(r() * 3), x = cx - 24 + c * 12.5, z = cz + (rr - 1.5) * 6.5;
        for (let k = 0; k < h; k++) list.push({ x, y: 1.3 + k * 2.6, z, c: cols[Math.floor(r() * cols.length)] });
        cw.addBox({ x0: x - 6, x1: x + 6, z0: z - 1.4, z1: z + 1.4, y0: 0, y1: h * 2.6 });
      }
      stacks.push({ x: cx - 27, z: cz + 11 }, { x: cx + 27, z: cz + 11 });
    }
    const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.8), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 }), list.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((b, i) => { m4.makeTranslation(b.x, b.y, b.z); cm.setMatrixAt(i, m4); cm.setColorAt(i, c.set(b.c)); }); this.add(cm);
    const sm = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 3, 44, 10), new THREE.MeshStandardMaterial({ color: 0x242634, metalness: 0.5 }), stacks.length), tip = new THREE.InstancedMesh(new THREE.SphereGeometry(2.6, 10, 8), basic(0xff7a2a), stacks.length);
    stacks.forEach((s, i) => { m4.makeTranslation(s.x, 22, s.z); sm.setMatrixAt(i, m4); m4.makeTranslation(s.x, 44, s.z); tip.setMatrixAt(i, m4); cw.addCirc({ x: s.x, z: s.z, r: 3, y0: 0, y1: 44 }); });
    this.add(sm); this.add(tip);
  }

  private arch() {
    const x = roadAt(1), z = blockAt(2), cw = this.city.cw, mat = new THREE.MeshStandardMaterial({ color: 0x1a1226, metalness: 0.7, roughness: 0.3 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 2), mat); p.position.set(x + s * 11.5, 9, z); this.add(p); cw.addCirc({ x: x + s * 11.5, z, r: 1.5, y0: 0, y1: 18 }); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), mat); top.position.set(x, 18, z); this.add(top);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(26, 0.25, 0.25), basic(0xff3df0)); tr.position.set(x, 16.9, z); this.add(tr);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5), new THREE.MeshBasicMaterial({ map: signTexture(["NEON MARKET"], "#ff3df0", 512, 160), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); sign.position.set(x, 21.5, z); sign.rotation.y = Math.PI / 2; this.add(sign);
  }

  private padsBuild() {
    const cw = this.city.cw, want: [number, number][] = [[2, 2], [4, 4], [3, 1], [5, 1], [6, 2], [2, 5]], tex = canvasTex(128, 128, (g) => { g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#22e6ff"; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke(); g.fillStyle = "#22e6ff"; g.font = "700 76px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("H", 64, 68); });
    const mk = (name: string, x: number, y: number, z: number, r: number, floating: boolean): Pad => {
      const pad: Pad = { x, y: y + 0.3, z, r, name }; cw.pads.push(pad);
      const g = new THREE.Group(); g.position.set(x, y, z);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, floating ? 1.4 : 0.6, 40), new THREE.MeshStandardMaterial({ color: 0x141829, metalness: 0.7, roughness: 0.35, envMap: this.city.env })); disc.position.y = floating ? -0.4 : 0.0; g.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.4, 0.18, 6, 64).rotateX(Math.PI / 2), basic(0x22e6ff)); ring.position.y = 0.35; g.add(ring);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.2, r * 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); h.position.y = 0.34; g.add(h);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), basic(0xff3df0)); l.position.set(Math.cos(a) * (r - 0.8), 0.9, Math.sin(a) * (r - 0.8)); g.add(l); }
      if (floating) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 10, 20, 1, true).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); cone.position.y = -6; g.add(cone);
        cw.addCirc({ x, z, r, y0: y - 1.2, y1: y + 0.1 });
      }
      g.add(beam(0x22e6ff, 60, 0.35, 0.3)); this.add(g); return pad;
    };
    const names = ["Downtown Pad", "Central Pad", "Plaza Pad", "Sky Pad North", "Sky Pad East", "Garden Pad"];
    const pads: { pad: Pad; i: number }[] = [];
    want.forEach(([bi, bj], i) => {
      const bl = this.city.blds.filter((b) => b.bi === bi && b.bj === bj && !(bi === 3 && bj === 3)).sort((a, b) => b.h - a.h)[0]; if (!bl) return;
      pads.push({ pad: mk(names[i], bl.x, bl.h, bl.z, Math.min(9, Math.min(bl.w, bl.d) / 2 - 2), false), i });
    });
    const f1 = mk("Skyline Platform", roadAt(6), 95, roadAt(1), 16, true), f2 = mk("Aerial Hub", roadAt(5), 130, roadAt(0), 14, true);
    const info: Record<string, [POIType, string]> = {
      "Downtown Pad": ["pad", "Rooftop landing pad. Land here to recharge your vehicle."], "Central Pad": ["viewpoint", "A clear look down the canyon of the Downtown Core, with the Neuron Tower rising beside you."],
      "Plaza Pad": ["pad", "Landing pad above the plaza district. Power couplings recharge boost energy."], "Sky Pad North": ["viewpoint", "Scenic viewpoint: the Sky District towers lean into the clouds, and the aerial lanes glow below."],
      "Sky Pad East": ["pad", "Landing pad on the east spires. Aerial traffic runs just below."], "Garden Pad": ["viewpoint", "Scenic viewpoint over the Green Future Park and its glowing biodome."],
      "Skyline Platform": ["viewpoint", "A floating transit platform. The whole city grid spreads out below like a circuit board."], "Aerial Hub": ["pad", "Floating transit hub. Land to recharge, then dive back into the city."],
    };
    for (const p of [...pads.map((x) => x.pad), f1, f2]) {
      const [type, desc] = info[p.name]; this.pois.push({ id: "pad-" + p.name, type, name: p.name, desc, x: p.x, y: p.y, z: p.z, r: p.r + 4, found: false, obj: new THREE.Object3D(), pad: p });
    }
  }

  private poiMesh(type: POIType): THREE.Object3D {
    const g = new THREE.Group(), dk = new THREE.MeshStandardMaterial({ color: 0x1b1e2c, metalness: 0.7, roughness: 0.35 });
    const col = parseInt(POI_COLOR[type].slice(1), 16);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.4, 20), dk); base.position.y = 0.2; g.add(base);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); disc.position.y = 0.2; g.add(disc);
    if (type === "charge") { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 0.7), basic(0x22e6ff)); p.position.y = 3.2; g.add(p); const r = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 6, 28), basic(0x22e6ff)); r.position.y = 6.4; g.add(r); this.spinners.push(r); }
    else if (type === "repair") { for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), dk); p.position.set(s * 2.2, 2.5, 0); g.add(p); } const t = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 0.8), basic(0xffb347)); t.position.y = 5; g.add(t); }
    else if (type === "nav") { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.4), dk); m.position.y = 1.9; g.add(m); const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ map: signTexture(["NAV"], "#7aa8ff", 128, 256), toneMapped: false })); s.position.set(0, 2.1, 0.22); g.add(s); }
    else if (type === "hub") { const d = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.55, metalness: 0.8, roughness: 0.1 })); d.position.y = 0.4; g.add(d); const a = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.1, 6, 24), basic(0x9b5cff)); a.position.y = 3.1; g.add(a); this.spinners.push(a); }
    else if (type === "discovery") { const o = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), basic(0xff3df0)); o.position.y = 3.2; g.add(o); this.spinners.push(o); g.add(beam(0xff3df0, 40, 0.25, 0.3)); }
    else if (type === "transit") { for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), dk); p.position.set(s * 3.4, 1.8, 0); g.add(p); } const r = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 4), dk); r.position.y = 3.7; g.add(r); const u = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.4).rotateX(Math.PI / 2), basic(0x3dffb0, 0.8)); u.position.y = 3.48; g.add(u); }
    else if (type === "landmark") { g.add(beam(0xffffff, 120, 0.8, 0.2)); }
    return g;
  }

  private poiList() {
    const cs = (ii: number, jj: number, sx: number, sz: number) => this.corner(ii, jj, sx, sz);
    const defs: [POIType, string, string, number, number, number, number][] = [
      ["charge", "Downtown Charging Station", "Boost energy restored.", 3, 2, 1, 1], ["charge", "Market Charging Point", "Boost energy restored.", 1, 2, -1, 1], ["charge", "Residential Charger", "Boost energy restored.", 1, 5, 1, -1],
      ["charge", "Foundry Charger", "Boost energy restored.", 6, 4, -1, 1], ["charge", "Park Charging Pylon", "Boost energy restored.", 4, 6, 1, -1], ["charge", "Sky District Charger", "Boost energy restored.", 6, 1, -1, -1],
      ["repair", "Repair Bay: Core", "Hull repaired.", 4, 4, -1, -1], ["repair", "Repair Bay: Garden", "Hull repaired.", 2, 5, 1, 1], ["repair", "Repair Bay: Foundry", "Hull repaired.", 5, 3, -1, 1], ["repair", "Repair Bay: Market", "Hull repaired.", 0, 2, 1, -1],
      ["nav", "Navigation Terminal: Plaza", "", 3, 3, 1, -1], ["nav", "Navigation Terminal: Market", "", 1, 3, 1, 1], ["nav", "Navigation Terminal: Sky", "", 6, 2, -1, 1], ["nav", "Navigation Terminal: Garden", "", 2, 6, -1, -1], ["nav", "Navigation Terminal: Foundry", "", 5, 5, 1, -1],
      ["hub", "Robot Service Hub: Market", "Service units patched your hull (+25%).", 1, 2, 1, 1], ["hub", "Robot Service Hub: Residential", "Service units patched your hull (+25%).", 2, 4, 1, -1], ["hub", "Robot Service Hub: Foundry", "Service units patched your hull (+25%).", 5, 4, 1, 1], ["hub", "Robot Service Hub: Garden", "Service units patched your hull (+25%).", 4, 5, -1, 1],
      ["discovery", "Data Fountain", "A fountain of light that streams the city's public data feeds in real time.", 2, 2, -1, -1], ["discovery", "Mural Wall", "A kinetic mural painted by service robots every night, never the same twice.", 1, 1, 1, -1], ["discovery", "Server Monument", "The first municipal AI core, retired and preserved in glass.", 5, 3, 1, -1],
      ["discovery", "Glow Grove", "Bioluminescent trees tuned to pulse with the rhythm of the traffic grid.", 3, 6, 1, -1], ["discovery", "Foundry Gate", "The old gate of the automated foundry: it hasn't had a human shift since the Rollout.", 6, 6, -1, -1], ["discovery", "Skyline Plaza", "A plaza where humans and robots trade stories at the edge of the Sky District.", 5, 2, 1, 1],
      ["transit", "Line A Station", "Hyperloop Line A. Service opens in a future update.", 4, 1, 1, -1], ["transit", "Line B Station", "Hyperloop Line B. Service opens in a future update.", 0, 3, 1, -1], ["transit", "Line C Station", "Hyperloop Line C. Service opens in a future update.", 6, 5, -1, -1],
    ];
    defs.forEach(([type, name, desc, ii, jj, sx, sz], n) => {
      const p = cs(ii, jj, sx, sz), obj = this.poiMesh(type); obj.position.set(p.x, 0, p.z); this.add(obj);
      this.pois.push({ id: type + n, type, name, desc, x: p.x, y: 0, z: p.z, r: 7, found: false, obj });
      this.city.cw.addCirc({ x: p.x, z: p.z, r: 1.2, y0: 0, y1: 4 });
    });
    const lm: [string, string, number, number, number][] = [
      ["Neuron Tower", "The tallest tower in Nexus City. Its crown beacon is visible from every district.", blockAt(3), blockAt(3), 62], ["Sky Spire", "A 340 m needle of glass at the edge of the Sky District.", blockAt(6), blockAt(0), 55],
      ["Green Biodome", "A glass dome sheltering the oldest bioluminescent garden in the city.", blockAt(4), blockAt(5), 42], ["Foundry Stacks", "Twin smokestacks that glow with the heat of the automated foundry.", blockAt(6), blockAt(6), 50], ["Neon Market Gate", "The great arch over the market boulevard.", roadAt(1), blockAt(2), 34],
    ];
    lm.forEach(([name, desc, x, z, r], n) => { const obj = this.poiMesh("landmark"); obj.position.set(x, 0, z); this.add(obj); this.pois.push({ id: "lm" + n, type: "landmark", name, desc, x, y: 0, z, r, found: false, obj }); });
  }

  update(t: number, px: number, pz: number) {
    this.spinners.forEach((s, i) => { s.rotation.y = t * (0.8 + (i % 3) * 0.3); s.rotation.x = (i % 2) * t * 0.4; });
    for (const p of this.pois) if (p.type !== "pad" && p.type !== "viewpoint") p.obj.visible = Math.hypot(p.x - px, p.z - pz) < 360 || p.type === "landmark";
  }
}
