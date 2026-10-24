import * as THREE from "three";
import { N, blockAt, lightState, mulberry } from "./config";
import type { City } from "./city";
import type { Extras } from "./pois";
import { basic } from "./gfx";

interface Edge { to: number; cross?: { ii: number; jj: number; axis: "v" | "h" } }
interface GNode { x: number; z: number; nb: Edge[]; block: number }
const OFF: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
export function buildGraph(): GNode[] {
  const nodes: GNode[] = [], id = (i: number, j: number, k: number) => (i * N + j) * 8 + k;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < 8; k++) nodes.push({ x: blockAt(i) + OFF[k][0] * 32.5, z: blockAt(j) + OFF[k][1] * 32.5, nb: [], block: i * N + j });
  const link = (a: number, b: number, cross?: Edge["cross"]) => { nodes[a].nb.push({ to: b, cross }); nodes[b].nb.push({ to: a, cross }); };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    for (let k = 0; k < 8; k++) link(id(i, j, k), id(i, j, (k + 1) % 8));
    if (i < N - 1) { link(id(i, j, 2), id(i + 1, j, 0), { ii: i + 1, jj: j, axis: "v" }); link(id(i, j, 4), id(i + 1, j, 6), { ii: i + 1, jj: j + 1, axis: "v" }); }
    if (j < N - 1) { link(id(i, j, 6), id(i, j + 1, 0), { ii: i, jj: j + 1, axis: "h" }); link(id(i, j, 4), id(i, j + 1, 2), { ii: i + 1, jj: j + 1, axis: "h" }); }
  }
  return nodes;
}

export interface Player { x: number; y: number; z: number; vx: number; vz: number; ground: boolean }
interface W { x: number; z: number; h: number; n: number; t: number; prev: number; sp: number; st: 0 | 1 | 2 | 3; tm: number; ph: number; sc: number; flee: number; pend: Edge | null; acc: number; vis: boolean; kind: number; ring: boolean; gest: number }

const metals = [0xb8c0d0, 0x7a8090, 0xd0d4e0, 0x4a5068], eyes = [0x22e6ff, 0xff3df0, 0xffb347, 0x3dffb0];

function humanoid(v: number) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: metals[v % 4], metalness: 0.85, roughness: 0.3 }), d = new THREE.MeshStandardMaterial({ color: 0x20232f, metalness: 0.7, roughness: 0.4 }), glow = basic(eyes[v % 4]);
  const box = (w: number, h: number, dd: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat); b.position.set(x, y, z); parent.add(b); return b; };
  box(0.5, 0.65, 0.3, m, 0, 1.15, 0); box(0.38, 0.08, 0.05, glow, 0, 1.25, 0.16); box(0.3, 0.12, 0.26, d, 0, 0.78, 0);
  const head = new THREE.Group(); head.position.y = 1.6; g.add(head); box(0.3, 0.26, 0.28, m, 0, 0, 0, head); box(0.24, 0.07, 0.04, glow, 0, 0.02, 0.15, head); box(0.06, 0.2, 0.06, d, 0.12, 0.2, 0, head);
  const limb = (x: number, y: number, a: number, b: number, w: number) => {
    const top = new THREE.Group(); top.position.set(x, y, 0); g.add(top); box(w, a, w, m, 0, -a / 2, 0, top);
    const low = new THREE.Group(); low.position.y = -a; top.add(low); box(w * 0.85, b, w * 0.85, d, 0, -b / 2, 0, low); return { top, low };
  };
  const la = limb(-0.34, 1.42, 0.3, 0.3, 0.12), ra = limb(0.34, 1.42, 0.3, 0.3, 0.12), ll = limb(-0.13, 0.82, 0.4, 0.4, 0.15), rl = limb(0.13, 0.82, 0.4, 0.4, 0.15);
  return { g, head, la, ra, ll, rl };
}

export class NPCs {
  graph = buildGraph(); rand = mulberry(99); group = new THREE.Group();
  private humans: W[] = []; private hm: THREE.InstancedMesh[] = []; private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private agents: { w: W; obj: THREE.Group; kind: string; parts: Record<string, THREE.Object3D>; v?: ReturnType<typeof humanoid> }[] = [];
  private statics: { obj: THREE.Group; kind: string; parts: Record<string, THREE.Object3D>; x: number; z: number }[] = [];
  private m1 = new THREE.Matrix4(); private m2 = new THREE.Matrix4(); private m3 = new THREE.Matrix4(); private m4 = new THREE.Matrix4(); private m5 = new THREE.Matrix4(); private tc = new THREE.Color();
  density = 0.7; MAXH = 150; robotCount = 0; humanCount = 0;

  constructor(scene: THREE.Scene, private city: City, extras: Extras) {
    scene.add(this.group); this.buildHumans(); this.buildAgents(); this.buildStatics(extras);
  }
  private pickNode(blockFilter?: (i: number, j: number) => boolean) {
    for (let k = 0; k < 60; k++) { const n = Math.floor(this.rand() * this.graph.length), b = this.graph[n].block; if (!blockFilter || blockFilter(Math.floor(b / N), b % N)) return n; }
    return 0;
  }
  private mkW(n: number, sp: number, kind: number, ring = false): W {
    const g = this.graph[n], e = g.nb[Math.floor(this.rand() * g.nb.length)], tn = ring ? this.ringNext(n, 1) : e.to, t = this.graph[tn];
    return { x: g.x, z: g.z, h: Math.atan2(t.x - g.x, t.z - g.z), n, t: tn, prev: -1, sp, st: 0, tm: 0, ph: this.rand() * 6, sc: 0.94 + this.rand() * 0.14, flee: 0, pend: null, acc: 0, vis: true, kind, ring, gest: 0 };
  }
  private ringNext(n: number, dir: number) { const b = Math.floor(n / 8) * 8; return b + ((n - b + dir + 8) % 8); }

  private buildHumans() {
    const mat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x1a1a2c });
    const geos = [new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(1, 10, 8), new THREE.BoxGeometry(1, 1, 1), new THREE.BoxGeometry(1, 1, 1), new THREE.BoxGeometry(1, 1, 1), new THREE.BoxGeometry(1, 1, 1)];
    this.hm = geos.map((g) => { const m = new THREE.InstancedMesh(g, mat(), this.MAXH); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(m); return m; });
    const cloth = [0x1c2a4a, 0x4a1c3a, 0x1d5a66, 0x2a2a3a, 0x6a2a6a, 0x7a5a1c, 0x2a4a2a, 0x5a1c1c, 0x3a3a60], skin = [0xe0b090, 0xc08060, 0x8a5a3a, 0xf0cfb0, 0x5a3a2a];
    for (let i = 0; i < this.MAXH; i++) {
      const w = this.mkW(this.pickNode(), 1.1 + this.rand() * 0.7, 0); this.humans.push(w);
      const c = cloth[Math.floor(this.rand() * cloth.length)], c2 = cloth[Math.floor(this.rand() * cloth.length)], s = skin[Math.floor(this.rand() * skin.length)];
      this.hm[0].setColorAt(i, this.tc.set(c)); this.hm[1].setColorAt(i, this.tc.set(s)); this.hm[2].setColorAt(i, this.tc.set(c)); this.hm[3].setColorAt(i, this.tc.set(c)); this.hm[4].setColorAt(i, this.tc.set(c2)); this.hm[5].setColorAt(i, this.tc.set(c2));
      for (const m of this.hm) m.setMatrixAt(i, this.zero);
    }
  }

  private buildAgents() {
    const mk = (kind: string, count: number, ring: ((i: number, j: number) => boolean) | null, sp: number) => {
      for (let n = 0; n < count; n++) {
        const w = this.mkW(this.pickNode(ring ?? undefined), sp, 1, !!ring), g = new THREE.Group(), parts: Record<string, THREE.Object3D> = {}; let v: ReturnType<typeof humanoid> | undefined;
        const dk = new THREE.MeshStandardMaterial({ color: 0x20232f, metalness: 0.7, roughness: 0.4 }), mt = new THREE.MeshStandardMaterial({ color: metals[n % 4], metalness: 0.85, roughness: 0.3 });
        const box = (x: number, y: number, z: number, a: number, b: number, c: number, m: THREE.Material, p: THREE.Object3D = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), m); o.position.set(x, y, z); p.add(o); return o; };
        if (kind === "companion") { v = humanoid(n); g.add(v.g); }
        else if (kind === "delivery") { box(0, 0.4, 0, 0.8, 0.45, 1.0, mt); box(0, 0.85, 0, 0.6, 0.4, 0.6, new THREE.MeshStandardMaterial({ color: 0xc88a2a, roughness: 0.6 })); parts.light = box(0, 1.15, 0.2, 0.12, 0.12, 0.12, basic(0x22e6ff)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10).rotateZ(Math.PI / 2), dk); wh.position.set(sx * 0.42, 0.16, sz * 0.36); g.add(wh); } }
        else if (kind === "security") { box(0, 0.25, 0, 0.9, 0.3, 1.3, dk); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.3, 12), mt); t.position.y = 1.0; g.add(t); const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mt); h.position.y = 1.85; g.add(h); parts.eye = box(0, 1.85, 0.27, 0.34, 0.07, 0.06, basic(0xff3040)); const sc = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 16, 1, true).translate(0, -4.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); sc.position.set(0, 1.85, 0.3); const pv = new THREE.Group(); pv.add(sc); g.add(pv); parts.scan = pv; }
        else if (kind === "maint") { box(0, 0.4, 0, 1.0, 0.5, 1.5, mt); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3f55 })); br.position.set(0, 0.28, 0.9); g.add(br); parts.brush = br; parts.light = box(0, 0.92, -0.3, 0.2, 0.2, 0.2, basic(0xffb347)); box(0.3, 0.8, -0.4, 0.12, 0.5, 0.12, dk); }
        else if (kind === "transport") { box(0, 0.3, 0, 2.2, 0.3, 1.4, dk); box(0, 1.0, 0, 1.8, 1.2, 1.1, new THREE.MeshStandardMaterial({ color: [0x7a2a2a, 0x2a4a7a, 0x2a6a4a][n % 3], roughness: 0.7 })); box(0, 0.5, 0.72, 2.0, 0.06, 0.04, basic(0x22e6ff)); }
        this.group.add(g); this.agents.push({ w, obj: g, kind, parts, v });
      }
    };
    mk("companion", 10, null, 1.2); mk("delivery", 8, null, 2.0);
    mk("security", 5, (i, j) => (i >= 2 && i <= 4 && j >= 2 && j <= 4) || (i <= 1 && j >= 1 && j <= 3), 1.1);
    mk("maint", 6, (i, j) => (i >= 3 && i <= 4 && j >= 5) || (i <= 2 && j >= 4), 0.9); mk("transport", 5, (i) => i >= 5, 2.4);
  }

  private buildStatics(ex: Extras) {
    const mt = new THREE.MeshStandardMaterial({ color: 0xb8c0d0, metalness: 0.85, roughness: 0.3 }), dk = new THREE.MeshStandardMaterial({ color: 0x20232f, metalness: 0.7 });
    const hubs = ex.pois.filter((p) => p.type === "hub");
    hubs.forEach((p, n) => {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.Group(), parts: Record<string, THREE.Object3D> = {};
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 12), mt); body.position.y = 0.9; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mt); head.position.y = 1.75; g.add(head); parts.head = head;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.05), basic(0x9b5cff)); eye.position.set(0, 0.03, 0.27); head.add(eye);
        for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.5, 1.4, 0); const ar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), dk); ar.position.y = -0.3; a.add(ar); g.add(a); parts[s < 0 ? "armL" : "armR"] = a; }
        const wheelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), dk); wheelBase.position.y = 0.15; g.add(wheelBase);
        const x = p.x + (k ? 5 : -5) + (n % 2) * 1, z = p.z + (k ? 4 : -2); g.position.set(x, 0, z); g.rotation.y = this.rand() * 6; this.group.add(g); this.statics.push({ obj: g, kind: "service", parts, x, z });
        this.city.cw.addCirc({ x, z, r: 0.6, y0: 0, y1: 2 });
      }
    });
    const sites: [number, number][] = [[5, 4], [6, 6], [5, 6]];
    sites.forEach(([i, j], n) => {
      const x = blockAt(i) + 12, z = blockAt(j) - 32.5, g = new THREE.Group(), parts: Record<string, THREE.Object3D> = {};
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xc8962a, metalness: 0.5, roughness: 0.5 })); base.position.y = 0.8; g.add(base);
      const turret = new THREE.Group(); turret.position.y = 1.4; g.add(turret); parts.turret = turret;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), dk); cab.position.y = 0.5; turret.add(cab);
      const b1 = new THREE.Group(); b1.position.set(0, 0.9, 0.6); turret.add(b1); parts.b1 = b1; const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 4.2), mt); a1.position.z = 2; b1.add(a1);
      const b2 = new THREE.Group(); b2.position.z = 4.2; b1.add(b2); parts.b2 = b2; const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 3.2), mt); a2.position.z = 1.5; b2.add(a2); b2.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), basic(0xffb347)).translateZ(3.1));
      g.position.set(x, 0, z); g.rotation.y = n; this.group.add(g); this.statics.push({ obj: g, kind: "construction", parts, x, z }); this.city.cw.addCirc({ x, z, r: 2.1, y0: 0, y1: 4 });
    });
  }

  setDensity(d: number) { this.density = d; }

  private step(w: W, dt: number, t: number, p: Player, nodes: GNode[]) {
    if (w.st === 1 || w.st === 3) {
      w.tm -= dt; if (w.st === 3) w.gest += dt;
      if (w.pend && w.st === 1) { const c = w.pend.cross!, s = lightState(c.ii, c.jj, t); if ((c.axis === "v" ? s.v : s.h) === "r") { w.st = 2; w.t = w.pend.to; w.pend = null; } }
      else if (w.tm <= 0) { w.st = 0; w.gest = 0; if (w.t === w.n) this.choose(w, nodes); }
      if (w.st !== 0 && w.st !== 2) return;
    }
    const tg = nodes[w.t], dx = tg.x - w.x, dz = tg.z - w.z, d = Math.hypot(dx, dz);
    if (d < 0.45) {
      w.prev = w.n; w.n = w.t; w.st = 0;
      const r = this.rand();
      if (!w.ring && w.kind === 0 && r < 0.14) { w.st = 1; w.tm = 1 + this.rand() * 5; w.t = w.n; return; }
      if (!w.ring && w.kind === 0 && r < 0.24) { w.st = 3; w.tm = 3 + this.rand() * 4; w.t = w.n; const o = this.humans[Math.floor(this.rand() * this.humans.length)]; w.h = Math.atan2(o.x - w.x, o.z - w.z); return; }
      this.choose(w, nodes); return;
    }
    let sp = w.sp * (w.st === 2 ? 1.25 : 1);
    if (p.ground && w.flee <= 0) { const vd = Math.hypot(p.x - w.x, p.z - w.z); if (vd < 9 && Math.hypot(p.vx, p.vz) > 4) w.flee = 1.4; }
    let mx = dx / d, mz = dz / d;
    if (w.flee > 0) { w.flee -= dt; sp *= 1.8; const ax = w.x - p.x, az = w.z - p.z, ad = Math.hypot(ax, az) || 1; mx = mx * 0.6 + (ax / ad) * 0.4; mz = mz * 0.6 + (az / ad) * 0.4; }
    w.x += mx * sp * dt; w.z += mz * sp * dt; w.ph += sp * dt * 5.2;
    const th = Math.atan2(dx, dz); let dh = th - w.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); w.h += dh * Math.min(1, dt * 8);
    if (w.st === 2 && d < 1.2) w.st = 0;
  }
  private choose(w: W, nodes: GNode[]) {
    const g = nodes[w.n];
    if (w.ring) { const dir = w.kind === 1 && this.rand() < 0.5 ? -1 : 1; w.t = this.ringNext(w.n, w.prev >= 0 && this.ringNext(w.n, -1) === w.prev ? 1 : this.ringNext(w.n, 1) === w.prev ? -1 : dir); return; }
    const opts = g.nb.filter((e) => e.to !== w.prev || g.nb.length === 1);
    let e = opts[Math.floor(this.rand() * opts.length)];
    if (e.cross && this.rand() < 0.55) e = opts.find((o) => !o.cross) ?? e;
    if (e.cross) { w.pend = e; w.st = 1; w.tm = 0.2; w.t = w.n; } else w.t = e.to;
  }

  private setPart(m: THREE.InstancedMesh, i: number, hx: number, hy: number, hz: number, hh: number, px: number, py: number, pz: number, rot: number, sx: number, sy: number, sz: number, limb: boolean) {
    this.m1.makeRotationY(hh); this.m1.setPosition(hx, hy, hz); this.m2.makeTranslation(px, py, pz);
    if (limb) { this.m3.makeRotationX(rot); this.m4.makeTranslation(0, -sy / 2, 0); this.m2.multiply(this.m3).multiply(this.m4); }
    this.m5.makeScale(sx, sy, sz); this.m1.multiply(this.m2).multiply(this.m5); m.setMatrixAt(i, this.m1);
  }

  update(dt: number, t: number, p: Player, viewDist: number) {
    const nodes = this.graph, far = viewDist * 0.55, nAct = Math.round(this.MAXH * this.density); this.humanCount = nAct;
    for (let i = 0; i < this.MAXH; i++) {
      const w = this.humans[i], on = i < nAct;
      if (!on) { if (w.vis) { for (const m of this.hm) m.setMatrixAt(i, this.zero); w.vis = false; } continue; }
      const d2 = (w.x - p.x) ** 2 + (w.z - p.z) ** 2, near = d2 < far * far;
      if (!near) { w.acc += dt; if (w.acc >= 0.3) { this.step(w, w.acc, t, p, nodes); w.acc = 0; } if (w.vis) { for (const m of this.hm) m.setMatrixAt(i, this.zero); w.vis = false; } continue; }
      w.acc = 0; this.step(w, dt, t, p, nodes); w.vis = true;
      const moving = w.st === 0 || w.st === 2, sw = moving ? Math.sin(w.ph) * 0.65 : 0, arm = w.st === 3 ? -1.1 + Math.sin(w.gest * 6) * 0.35 : -sw, s = w.sc, y = 0.13, hh = w.h;
      this.setPart(this.hm[0], i, w.x, y, w.z, hh, 0, 1.15 * s, 0, 0, 0.46 * s, 0.62 * s, 0.26 * s, false);
      this.setPart(this.hm[1], i, w.x, y, w.z, hh, 0, 1.62 * s, 0, 0, 0.15 * s, 0.17 * s, 0.15 * s, false);
      this.setPart(this.hm[2], i, w.x, y, w.z, hh, -0.29 * s, 1.44 * s, 0, w.st === 3 ? arm : sw, 0.11 * s, 0.6 * s, 0.12 * s, true);
      this.setPart(this.hm[3], i, w.x, y, w.z, hh, 0.29 * s, 1.44 * s, 0, arm, 0.11 * s, 0.6 * s, 0.12 * s, true);
      this.setPart(this.hm[4], i, w.x, y, w.z, hh, -0.11 * s, 0.84 * s, 0, -sw, 0.15 * s, 0.82 * s, 0.17 * s, true);
      this.setPart(this.hm[5], i, w.x, y, w.z, hh, 0.11 * s, 0.84 * s, 0, sw, 0.15 * s, 0.82 * s, 0.17 * s, true);
    }
    for (const m of this.hm) m.instanceMatrix.needsUpdate = true;

    let rc = 0; const cnt: Record<string, number> = {}, maxN: Record<string, number> = { companion: 10, delivery: 8, security: 5, maint: 6, transport: 5 };
    for (const a of this.agents) {
      const idx = (cnt[a.kind] = (cnt[a.kind] ?? 0) + 1) - 1, on = idx < Math.ceil(maxN[a.kind] * this.density);
      const w = a.w; a.obj.visible = false; if (!on) continue;
      const d = Math.hypot(w.x - p.x, w.z - p.z), near = d < Math.min(far, 200);
      if (!near) { w.acc += dt; if (w.acc > 0.3) { this.step(w, w.acc, t, p, nodes); w.acc = 0; } continue; }
      w.acc = 0; rc++; this.step(w, dt, t, p, nodes);
      a.obj.visible = true; a.obj.position.set(w.x, 0.13, w.z); a.obj.rotation.y = w.h;
      const mv = w.st === 0 || w.st === 2;
      if (a.v) { const sw = mv ? Math.sin(w.ph) * 0.6 : 0, v = a.v; v.la.top.rotation.x = -sw; v.ra.top.rotation.x = sw; v.ll.top.rotation.x = sw; v.rl.top.rotation.x = -sw; v.ll.low.rotation.x = Math.max(0, -sw) * 0.9; v.rl.low.rotation.x = Math.max(0, sw) * 0.9; v.la.low.rotation.x = -0.3; v.ra.low.rotation.x = -0.3; v.head.rotation.y = w.st === 3 ? Math.sin(t * 2) * 0.5 : 0; if (w.st === 3) v.ra.top.rotation.x = -1.2 + Math.sin(w.gest * 6) * 0.3; }
      if (a.kind === "delivery" && a.parts.light) a.parts.light.visible = Math.sin(t * 8 + w.ph) > 0;
      if (a.kind === "security") { a.parts.scan.rotation.y = Math.sin(t * 1.4) * 1.1; (a.parts.eye as THREE.Mesh).visible = Math.sin(t * 5) > -0.3; }
      if (a.kind === "maint") { a.parts.brush.rotation.x = t * 12; a.parts.light.visible = Math.sin(t * 6) > 0; }
    }
    this.robotCount = rc;
    for (const s of this.statics) {
      const near = Math.hypot(s.x - p.x, s.z - p.z) < Math.min(far, 220); s.obj.visible = near; if (!near) continue;
      if (s.kind === "service") {
        const dd = Math.hypot(s.x - p.x, s.z - p.z), wave = dd < 22; s.parts.head.rotation.y = wave ? Math.atan2(p.x - s.x, p.z - s.z) - s.obj.rotation.y : Math.sin(t * 0.8 + s.x) * 0.7;
        s.parts.armR.rotation.z = wave ? -2.4 + Math.sin(t * 7) * 0.4 : -0.15; s.parts.armL.rotation.x = Math.sin(t * 1.2 + s.z) * 0.15;
      } else { s.parts.turret.rotation.y = Math.sin(t * 0.35 + s.x) * 1.0; s.parts.b1.rotation.x = -0.5 + Math.sin(t * 0.6 + s.z) * 0.3; s.parts.b2.rotation.x = 0.7 + Math.sin(t * 0.8 + s.x) * 0.4; }
    }
  }
  /** Nearest NPC robot distance (for servo sounds). */
  nearestRobot(p: Player) { let b = 1e9; for (const a of this.agents) if (a.obj.visible) b = Math.min(b, Math.hypot(a.w.x - p.x, a.w.z - p.z)); for (const s of this.statics) if (s.obj.visible) b = Math.min(b, Math.hypot(s.x - p.x, s.z - p.z)); return b; }
}
