import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { N, X0, PITCH, HALF, roadAt, lightState, mulberry, clamp, type Lamp } from "./config";
import { basic, glowTex } from "./gfx";
import type { Player } from "./npc";

type Axis = "x" | "z";
interface Car {
  g: THREE.Group; kind: string; x: number; z: number; h: number; axis: Axis; line: number; dir: 1 | -1; off: number; s: number; v: number; cruise: number; len: number;
  plan: { m: number; turn: 0 | 1 | -1 } | null; bez: { p: [number, number][]; len: number; t: number; axis: Axis; line: number; dir: 1 | -1; s: number } | null; tail: THREE.MeshBasicMaterial; brake: boolean; on: boolean;
}
const rs = (axis: Axis, dir: 1 | -1) => (axis === "z" ? (dir > 0 ? -1 : 1) : dir > 0 ? 1 : -1);
const head = (axis: Axis, dir: 1 | -1) => (axis === "z" ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2);
const STOP = 15.6;

export class Traffic {
  group = new THREE.Group(); cars: Car[] = []; rand = mulberry(4242); density = 0.7; MAX = 46;
  private flyers: { g: THREE.Group; axis: Axis; line: number; dir: 1 | -1; s: number; sp: number; off: number; alt: number }[] = [];
  private vmat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.3 }); private headMat = basic(0xdff6ff);
  constructor(scene: THREE.Scene, env: THREE.Texture | null) {
    scene.add(this.group); this.vmat.envMap = env; this.vmat.envMapIntensity = 0.9;
    const kinds = ["sedan", "sedan", "taxi", "van", "bus", "sedan", "taxi", "sedan"];
    for (let i = 0; i < this.MAX; i++) this.spawn(kinds[i % kinds.length], i);
    for (let i = 0; i < 9; i++) this.mkFlyer(i);
  }
  private build(kind: string, i: number) {
    const g = new THREE.Group(), neon = [0x22e6ff, 0xff3df0, 0x9b5cff, 0xffb347][i % 4];
    const col = kind === "taxi" ? 0xc9941c : kind === "van" ? 0xcfd6e6 : kind === "bus" ? 0x1a3a4a : [0x1a1e34, 0x2a1a34, 0x14283a, 0x30202a][i % 4];
    const len = kind === "bus" ? 10 : kind === "van" ? 4.8 : 4.1, wd = kind === "bus" ? 2.5 : 1.9, ht = kind === "bus" ? 2.5 : kind === "van" ? 1.9 : 0.6, bus = kind === "bus" ? 0.2 : 0;
    const parts: { g: THREE.BufferGeometry; c: number; p: [number, number, number] }[] = [{ g: new THREE.BoxGeometry(wd, ht, len), c: col, p: [0, 0.35 + ht / 2, 0] }];
    if (kind === "sedan" || kind === "taxi") parts.push({ g: new THREE.BoxGeometry(1.55, 0.5, 2.1), c: 0x0a1c2c, p: [0, 1.2, -0.1] });
    if (kind === "taxi") parts.push({ g: new THREE.BoxGeometry(0.6, 0.2, 0.3), c: 0xfff2c0, p: [0, 1.55, -0.1] });
    if (kind === "bus" || kind === "van") parts.push({ g: new THREE.BoxGeometry(wd + 0.02, 0.5, len * 0.8), c: neon, p: [0, 0.35 + ht * 0.66, 0] });
    for (const s of [-1, 1]) for (const z of [0.3, -0.3]) parts.push({ g: new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10).rotateZ(Math.PI / 2), c: 0x0b0c12, p: [s * (wd / 2 - 0.05), 0.4, len * z] });
    const geos = parts.map((q) => {
      const gg = q.g.index ? q.g.toNonIndexed() : q.g; gg.translate(...q.p); const n = gg.attributes.position.count, cl = new Float32Array(n * 3), c = new THREE.Color(q.c);
      for (let k = 0; k < n; k++) cl.set([c.r, c.g, c.b], k * 3); gg.setAttribute("color", new THREE.BufferAttribute(cl, 3)); gg.deleteAttribute("uv"); return gg;
    });
    g.add(new THREE.Mesh(mergeGeometries(geos)!, this.vmat));
    const lights = (z: number, mat: THREE.Material) => { const gs = [-1, 1].map((s) => new THREE.BoxGeometry(0.4, 0.12, 0.06).translate(s * wd * 0.33, 0.57 + bus, z)); g.add(new THREE.Mesh(mergeGeometries(gs)!, mat)); };
    const tail = new THREE.MeshBasicMaterial({ color: 0x661018, toneMapped: false }); lights(-len / 2 - 0.02, tail); lights(len / 2 + 0.02, this.headMat);
    const ug = new THREE.Mesh(new THREE.PlaneGeometry(wd + 1.2, len + 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: neon, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); ug.position.y = 0.07; g.add(ug);
    return { g, tail, len };
  }
  private spawn(kind: string, i: number) {
    const { g, tail, len } = this.build(kind, i); this.group.add(g);
    const c: Car = { g, kind, x: 0, z: 0, h: 0, axis: "z", line: 0, dir: 1, off: 0, s: 0, v: 0, cruise: 10 + this.rand() * 8, len, plan: null, bez: null, tail, brake: false, on: true };
    if (kind === "bus") c.cruise = 9;
    for (let tries = 0; tries < 40; tries++) {
      c.axis = this.rand() < 0.5 ? "x" : "z"; c.line = Math.floor(this.rand() * (N + 1)); c.dir = this.rand() < 0.5 ? 1 : -1; c.off = this.rand() < 0.5 ? 2.25 : 6.75; c.s = (this.rand() * 2 - 1) * (HALF - 30);
      const d = Math.abs(((c.s - X0) % PITCH + PITCH) % PITCH); if (Math.min(d, PITCH - d) < 22) continue;
      this.pos(c); if (this.cars.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > 14)) break;
    }
    c.v = c.cruise * 0.5; this.pos(c); this.cars.push(c);
  }
  private pos(c: Car) { const lc = roadAt(c.line) + rs(c.axis, c.dir) * c.off; if (c.axis === "z") { c.x = lc; c.z = c.s; } else { c.z = lc; c.x = c.s; } c.h = head(c.axis, c.dir); }
  private mkFlyer(i: number) {
    const g = new THREE.Group(), col = [0x22e6ff, 0xff3df0, 0x9b5cff][i % 3];
    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 5), new THREE.MeshStandardMaterial({ color: 0x1a1e34, metalness: 0.8, roughness: 0.3 })), new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.2), basic(col)));
    const tr = new THREE.Mesh(new THREE.ConeGeometry(0.7, 9, 10, 1, true).translate(0, 4.5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); tr.position.z = -2.5; g.add(tr);
    this.group.add(g);
    this.flyers.push({ g, axis: i % 2 ? "x" : "z", line: 1 + (i * 3) % (N - 1), dir: i % 4 < 2 ? 1 : -1, s: (this.rand() * 2 - 1) * HALF, sp: 22 + this.rand() * 18, off: (i % 2 ? 1 : -1) * (20 + this.rand() * 10), alt: 62 + (i % 4) * 14 });
  }

  setDensity(d: number) { this.density = d; }

  private turnPlan(c: Car, m: number): 0 | 1 | -1 {
    const ok = (turn: number) => (turn === 0 ? m + c.dir >= 0 && m + c.dir <= N : c.line + turn >= 0 && c.line + turn <= N);
    const opts = ([0, 0, 0, 1, -1] as (0 | 1 | -1)[]).filter((t) => ok(t));
    return opts.length ? opts[Math.floor(this.rand() * opts.length)] : 1;
  }

  update(dt: number, t: number, p: Player, viewDist: number, vehicle: { x: number; z: number; y: number; ground: boolean }) {
    const nAct = Math.round(this.MAX * this.density * 0.95), vd2 = viewDist * viewDist;
    for (let ci = 0; ci < this.cars.length; ci++) {
      const c = this.cars[ci]; c.on = ci < nAct; if (!c.on) { c.g.visible = false; continue; }
      let target = c.cruise; c.brake = false;
      if (c.bez) {
        const b = c.bez; b.t += (Math.max(c.v, 2) * dt) / b.len; const u = Math.min(1, b.t), a = 1 - u;
        const x = a * a * b.p[0][0] + 2 * a * u * b.p[1][0] + u * u * b.p[2][0], z = a * a * b.p[0][1] + 2 * a * u * b.p[1][1] + u * u * b.p[2][1];
        const tx = 2 * a * (b.p[1][0] - b.p[0][0]) + 2 * u * (b.p[2][0] - b.p[1][0]), tz = 2 * a * (b.p[1][1] - b.p[0][1]) + 2 * u * (b.p[2][1] - b.p[1][1]);
        c.x = x; c.z = z; c.h = Math.atan2(tx, tz); target = Math.min(target, 8);
        if (b.t >= 1) { c.axis = b.axis; c.line = b.line; c.dir = b.dir; c.s = b.s; c.bez = null; c.plan = null; this.pos(c); }
      } else {
        const cs = c.dir > 0 ? Math.ceil((c.s - X0) / PITCH) : Math.floor((c.s - X0) / PITCH), m = Math.max(0, Math.min(N, cs)), cc = roadAt(m), dist = c.dir > 0 ? cc - c.s : c.s - cc;
        if (dist >= 0 && dist < 44 && (!c.plan || c.plan.m !== m)) c.plan = { m, turn: this.turnPlan(c, m) };
        const ii = c.axis === "z" ? c.line : m, jj = c.axis === "z" ? m : c.line, st = lightState(ii, jj, t), lamp: Lamp = c.axis === "z" ? st.v : st.h;
        if (dist > STOP - 0.5 && dist < 80) {
          if (lamp === "r" || (lamp === "y" && dist > 24)) target = Math.min(target, Math.sqrt(2 * 7 * Math.max(0, dist - STOP - 0.3)));
        }
        if (dist <= STOP && dist > STOP - 3 && c.plan && c.plan.turn !== 0 && c.plan.m === m) {
          const turn = c.plan.turn, nax: Axis = c.axis === "z" ? "x" : "z", ndir = (turn > 0 ? 1 : -1) as 1 | -1;
          const cx = c.axis === "z" ? roadAt(c.line) : roadAt(m), cz = c.axis === "z" ? roadAt(m) : roadAt(c.line);
          let p1: [number, number], p2: [number, number], ns: number;
          if (c.axis === "z") { const lz = roadAt(m) + rs("x", ndir) * c.off; p1 = [c.x, lz]; p2 = [cx + ndir * STOP, lz]; ns = p2[0]; }
          else { const lx = roadAt(m) + rs("z", ndir) * c.off; p1 = [lx, c.z]; p2 = [lx, cz + ndir * STOP]; ns = p2[1]; }
          const p0: [number, number] = [c.x, c.z], d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
          c.bez = { p: [p0, p1, p2], len: (2 * d(p0, p2) + d(p0, p1) + d(p1, p2)) / 3, t: 0, axis: nax, line: m, dir: ndir, s: ns };
        }
        if (!c.bez) { c.s += c.dir * c.v * dt; this.pos(c); }
        if (Math.abs(c.s) > HALF + 40) { c.dir = -c.dir as 1 | -1; }
      }
      const sh = Math.sin(c.h), ch = Math.cos(c.h);
      const look = (ox: number, oz: number, olen: number) => { const dx = ox - c.x, dz = oz - c.z, f = dx * sh + dz * ch, l = dx * ch - dz * sh; if (f > 0.5 && f < 18 && Math.abs(l) < 2.8) target = Math.min(target, Math.max(0, (f - (c.len + olen) / 2 - 1.5) * 1.3)); };
      for (const o of this.cars) if (o !== c && o.on) look(o.x, o.z, o.len);
      if (vehicle.ground || vehicle.y < 4) look(vehicle.x, vehicle.z, 4.3);
      if (target < c.v - 0.5) c.brake = true;
      c.v += clamp(target - c.v, -9 * dt, 4.5 * dt); if (c.v < 0) c.v = 0;
      c.g.position.set(c.x, 0.02, c.z); c.g.rotation.y = c.h;
      c.g.visible = (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < vd2;
      c.tail.color.setRGB(c.brake ? 1 : 0.4, c.brake ? 0.08 : 0.06, c.brake ? 0.12 : 0.08);
    }
    for (const f of this.flyers) {
      f.s += f.dir * f.sp * dt; if (Math.abs(f.s) > HALF + 120) f.s = -Math.sign(f.s) * (HALF + 100);
      const lc = roadAt(f.line) + f.off; if (f.axis === "z") { f.g.position.set(lc, f.alt, f.s); f.g.rotation.y = f.dir > 0 ? 0 : Math.PI; } else { f.g.position.set(f.s, f.alt, lc); f.g.rotation.y = f.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      f.g.visible = (f.g.position.x - p.x) ** 2 + (f.g.position.z - p.z) ** 2 < vd2 * 1.5;
    }
  }
  collide(v: { x: number; y: number; z: number; vx: number; vz: number }): number {
    let imp = 0; if (v.y > 3) return 0;
    for (const c of this.cars) {
      if (!c.on) continue; const dx = v.x - c.x, dz = v.z - c.z, rr = 2.2 + c.len * 0.4, d2 = dx * dx + dz * dz; if (d2 > rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d, pen = rr - d; v.x += nx * pen; v.z += nz * pen; const vn = v.vx * nx + v.vz * nz;
      if (vn < 0) { imp = Math.max(imp, -vn); v.vx -= 1.4 * vn * nx; v.vz -= 1.4 * vn * nz; c.v = Math.max(0, c.v - 4); }
    }
    return imp;
  }
  collideFlyers(v: { x: number; y: number; z: number }) { for (const f of this.flyers) if (Math.hypot(f.g.position.x - v.x, f.g.position.z - v.z) < 5 && Math.abs(f.g.position.y - v.y) < 3.5) return true; return false; }
}
