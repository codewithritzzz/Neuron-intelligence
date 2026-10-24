import * as THREE from "three";
import { N, PITCH, ROAD, BLOCK, HALF, roadAt, blockAt, districtOf, DCOL, mulberry, lightState, type DistrictId } from "./config";
import { Collision } from "./collision";
import { buildingMaterial, roadTexture, glowTex, signTexture, basic } from "./gfx";

export interface Bld { x: number; z: number; w: number; d: number; h: number; dist: DistrictId; bi: number; bj: number; col: number }
const PAL: Record<DistrictId, number[]> = {
  downtown: [0x22e6ff, 0x9b5cff, 0x22e6ff, 0xff3df0], market: [0xff3df0, 0xffb347, 0x22e6ff, 0x9b5cff], residential: [0x9b5cff, 0x22e6ff, 0xffb347],
  industrial: [0xffb347, 0x22e6ff], sky: [0x22e6ff, 0x9b5cff, 0x7aa8ff], park: [0x3dffb0],
};
const LIT: Record<DistrictId, number> = { downtown: 0.62, market: 0.72, residential: 0.5, industrial: 0.3, sky: 0.52, park: 0.3 };
const FACADE = [0x0f1222, 0x13112a, 0x101a2c, 0x1a1226, 0x0c1424];
const LCOL = { g: new THREE.Color(0x2dff7a), y: new THREE.Color(0xffc233), r: new THREE.Color(0xff2d45) };

export class City {
  group = new THREE.Group(); cw = new Collision(); blds: Bld[] = []; timeU = { value: 0 };
  bmat: THREE.MeshStandardMaterial; rand = mulberry(20260928);
  roadMat!: THREE.MeshStandardMaterial; vLamps!: THREE.InstancedMesh; hLamps!: THREE.InstancedMesh; sigT = -1;
  boards: THREE.MeshBasicMaterial[] = []; beacons!: THREE.MeshBasicMaterial; holos: THREE.Object3D[] = [];
  env: THREE.Texture | null;

  constructor(scene: THREE.Scene, env: THREE.Texture | null) {
    this.env = env; this.bmat = buildingMaterial(this.timeU); scene.add(this.group);
    this.ground(); this.roads(); this.generate(); this.buildingMeshes(); this.outskirts(); this.streetFurniture(); this.signals(); this.highway();
  }

  private ground() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x05050b, roughness: 0.95 }));
    g.position.y = -0.12; g.receiveShadow = true; this.group.add(g);
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x15142a, roughness: 0.7, metalness: 0.3, envMap: this.env, envMapIntensity: 0.4 }), N * N);
    const lp: number[] = [], lc: number[] = [], m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const d = districtOf(i, j), cx = blockAt(i), cz = blockAt(j);
      m4.compose(new THREE.Vector3(cx, 0.03, cz), new THREE.Quaternion(), new THREE.Vector3(BLOCK, 0.2, BLOCK)); base.setMatrixAt(i * N + j, m4);
      col.set(d === "park" ? 0x0a2218 : 0xffffff); base.setColorAt(i * N + j, col);
      const c = new THREE.Color(DCOL[d]), h = BLOCK / 2 - 0.4;
      const pts = [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]];
      for (const p of pts) { lp.push(cx + p[0], 0.15, cz + p[1], cx + p[2], 0.15, cz + p[3]); lc.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    }
    base.receiveShadow = true; this.group.add(base);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
    this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false })));
  }

  private roads() {
    const mkTex = (k: "lane" | "plain") => { const a = roadTexture(k, false), e = roadTexture(k, true); [a, e].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }); return [a, e]; };
    const [la, le] = mkTex("lane"), [pa, pe] = mkTex("plain");
    const mat = (a: THREE.Texture, e: THREE.Texture, off: number) => new THREE.MeshStandardMaterial({ map: a, emissiveMap: e, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.45, envMap: this.env, envMapIntensity: 0.32, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
    this.roadMat = mat(la, le, -1);
    const R = HALF, W = ROAD / 2, tile = 22;
    const vp: number[] = [], vu: number[] = [], hp: number[] = [], hu: number[] = [];
    for (let k = 0; k < N + 1; k++) {
      const c = roadAt(k);
      vp.push(c - W, 0.02, -R, c + W, 0.02, -R, c + W, 0.02, R, c - W, 0.02, -R, c + W, 0.02, R, c - W, 0.02, R);
      vu.push(0, -R / tile, 1, -R / tile, 1, R / tile, 0, -R / tile, 1, R / tile, 0, R / tile);
      hp.push(-R, 0.021, c - W, -R, 0.021, c + W, R, 0.021, c + W, -R, 0.021, c - W, R, 0.021, c + W, R, 0.021, c - W);
      hu.push(-R / tile, 0, -R / tile, 1, R / tile, 1, -R / tile, 0, R / tile, 1, R / tile, 0);
    }
    const mk = (p: number[], u: number[], m: THREE.Material) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals(); const me = new THREE.Mesh(g, m); me.receiveShadow = true; this.group.add(me); };
    mk(vp, vu, this.roadMat); mk(hp, hu, this.roadMat);
    const ip: number[] = [], iu: number[] = [];
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      const x = roadAt(a), z = roadAt(b);
      ip.push(x - W, 0.026, z - W, x + W, 0.026, z - W, x + W, 0.026, z + W, x - W, 0.026, z - W, x + W, 0.026, z + W, x - W, 0.026, z + W); iu.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
    mk(ip, iu, mat(pa, pe, -2));
    const cwm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x9aa4c8 }), (N + 1) * (N + 1) * 4 * 8);
    let n = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
      const x = roadAt(a), z = roadAt(b);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (a + dx < 0 || a + dx > N || b + dz < 0 || b + dz > N) continue;
        for (let t = 0; t < 8; t++) {
          const o = (t - 3.5) * 2;
          p.set(x + dx * 11.6 + (dz ? o : 0), 0.05, z + dz * 11.6 + (dx ? o : 0)); s.set(dx ? 2.4 : 0.8, 0.03, dz ? 2.4 : 0.8);
          m4.compose(p, q, s); cwm.setMatrixAt(n++, m4);
        }
      }
    }
    cwm.count = n; this.group.add(cwm);
  }

  private generate() {
    const r = this.rand, push = (b: Omit<Bld, "col">) => { const pal = PAL[b.dist]; this.blds.push({ ...b, col: pal[Math.floor(r() * pal.length)] }); };
    const sub = (i: number, j: number, cols: number, rows: number, gap: number, hf: (c: number, rr: number) => number, skip = 0) => {
      const d = districtOf(i, j), cx = blockAt(i), cz = blockAt(j), lot = 60, w = (lot - (cols - 1) * gap) / cols, dd = (lot - (rows - 1) * gap) / rows;
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        if (skip && r() < skip) continue;
        push({ x: cx - lot / 2 + w / 2 + c * (w + gap), z: cz - lot / 2 + dd / 2 + rr * (dd + gap), w, d: dd, h: hf(c, rr), dist: d, bi: i, bj: j });
      }
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const d = districtOf(i, j), cx = blockAt(i), cz = blockAt(j);
      if (d === "downtown") {
        if (i === 3 && j === 3) {
          push({ x: cx, z: cz, w: 26, d: 26, h: 300, dist: d, bi: i, bj: j });
          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) push({ x: cx + sx * 22, z: cz + sz * 22, w: 14, d: 14, h: 14, dist: d, bi: i, bj: j });
        } else { const dd = Math.max(Math.abs(i - 3), Math.abs(j - 3)); sub(i, j, 2, 2, 2, () => 55 + (3 - dd) * 38 + r() * 70, 0.12); }
      } else if (d === "sky") {
        const spire = i === 6 && j === 0;
        push({ x: cx, z: cz, w: 22, d: 22, h: spire ? 340 : 170 + r() * 150, dist: d, bi: i, bj: j });
        push({ x: cx - 21, z: cz - 21, w: 12, d: 12, h: 70 + r() * 60, dist: d, bi: i, bj: j }); push({ x: cx + 21, z: cz + 21, w: 12, d: 12, h: 60 + r() * 60, dist: d, bi: i, bj: j });
      } else if (d === "market") sub(i, j, 3, 3, 3, () => 9 + r() * 18 + (r() < 0.2 ? 16 : 0));
      else if (d === "residential") sub(i, j, 2, 2, 3, () => 26 + r() * 45);
      else if (d === "industrial") sub(i, j, 1, 2, 4, (_c, rr) => ((i + j) % 2 === 1 && rr === 1 ? 0 : 11 + r() * 11));
    }
    this.blds = this.blds.filter((b) => b.h > 0);
    for (const b of this.blds) this.cw.addBox({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, y0: 0, y1: b.h });
  }

  private buildingMeshes() {
    const B = this.blds, g = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(g, this.bmat, B.length), tint = new Float32Array(B.length * 4), info = new Float32Array(B.length * 2);
    const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), r = this.rand;
    const lp: number[] = [], lc: number[] = [], ants: Bld[] = [];
    B.forEach((b, n) => {
      m4.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d)); mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, c.set(FACADE[Math.floor(r() * FACADE.length)]));
      c.set(b.col); tint.set([c.r, c.g, c.b, r() * 50], n * 4); info.set([b.h, LIT[b.dist]], n * 2);
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y = b.h;
      const E = [[x0, y, z0, x1, y, z0], [x1, y, z0, x1, y, z1], [x1, y, z1, x0, y, z1], [x0, y, z1, x0, y, z0], [x0, 0, z0, x0, y, z0], [x1, 0, z0, x1, y, z0], [x1, 0, z1, x1, y, z1], [x0, 0, z1, x0, y, z1]];
      for (const e of E) { lp.push(...e); lc.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (b.h > 90) ants.push(b);
    });
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 4)); g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 2));
    mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
    this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.9 })));
    this.beacons = new THREE.MeshBasicMaterial({ color: 0xff3040, toneMapped: false });
    const am = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1, 0.5), new THREE.MeshStandardMaterial({ color: 0x222633 }), ants.length), bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), this.beacons, ants.length);
    ants.forEach((b, n) => { const h = 10 + (b.h > 200 ? 18 : 6); m4.compose(new THREE.Vector3(b.x, b.h + h / 2, b.z), q, new THREE.Vector3(1, h, 1)); am.setMatrixAt(n, m4); m4.compose(new THREE.Vector3(b.x, b.h + h, b.z), q, new THREE.Vector3(1, 1, 1)); bm.setMatrixAt(n, m4); });
    this.group.add(am, bm);
    const pool: { x: number; z: number; c: number }[] = [];
    for (const b of B) if (b.h < 70 && (b.dist === "market" || b.dist === "downtown" || b.dist === "residential")) {
      const cx = blockAt(b.bi), cz = blockAt(b.bj), ox = b.x - cx, oz = b.z - cz;
      if (Math.abs(ox) > Math.abs(oz)) pool.push({ x: b.x + Math.sign(ox) * (b.w / 2 + 3), z: b.z, c: b.col }); else pool.push({ x: b.x, z: b.z + Math.sign(oz || 1) * (b.d / 2 + 3), c: b.col });
    }
    this.pools(pool);
    const texts: [string[], string][] = [[["NEURON"], "#22e6ff"], [["NEXUS", "CITY"], "#ff3df0"], [["ROBO CAFE"], "#ffb347"], [["SKY LANES"], "#9b5cff"], [["NOODLE-BOT"], "#ff3df0"], [["AI-PAY"], "#22e6ff"], [["CYBERVERSE"], "#9b5cff"], [["NEON MARKET"], "#ffb347"]];
    const mats = texts.map(([l, c]) => { const m = new THREE.MeshBasicMaterial({ map: signTexture(l, c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); this.boards.push(m); return m; });
    const cand = B.filter((b) => b.h > 22 && b.h < 200 && b.dist !== "industrial"); let bn = 0;
    for (let n = 0; n < Math.min(16, cand.length); n++) {
      const b = cand[Math.floor(r() * cand.length)], cx = blockAt(b.bi), cz = blockAt(b.bj), ox = b.x - cx, oz = b.z - cz, xf = Math.abs(ox) > Math.abs(oz);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mats[bn++ % mats.length]);
      p.position.set(b.x + (xf ? Math.sign(ox) * (b.w / 2 + 0.3) : 0), Math.min(b.h - 6, 14 + r() * 24), b.z + (xf ? 0 : Math.sign(oz || 1) * (b.d / 2 + 0.3)));
      p.rotation.y = xf ? (ox > 0 ? Math.PI / 2 : -Math.PI / 2) : oz >= 0 ? 0 : Math.PI; this.group.add(p);
    }
    const hm = new THREE.MeshBasicMaterial({ map: signTexture(["NEURON", "CYBERVERSE"], "#22e6ff", 512, 256), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), hm); p.position.set(blockAt(3), 36 + k * 12, blockAt(3) - 24 - k * 6); this.holos.push(p); this.group.add(p); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 0.25, 8, 64).rotateX(Math.PI / 2), basic(0x22e6ff)); ring.position.set(blockAt(3), 30, blockAt(3)); this.holos.push(ring); this.group.add(ring);
  }

  pools(list: { x: number; z: number; c: number }[]) {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), list.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, 0.06, p.z), new THREE.Quaternion(), new THREE.Vector3(14, 1, 14)); m.setMatrixAt(i, m4); m.setColorAt(i, c.set(p.c)); });
    this.group.add(m);
  }

  private outskirts() {
    const r = this.rand, n = 220, g = new THREE.BoxGeometry(1, 1, 1), tint = new Float32Array(n * 4), info = new Float32Array(n * 2);
    const m = new THREE.InstancedMesh(g, this.bmat, n), m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = 380 + r() * 520, h = 40 + r() * 190, w = 18 + r() * 34;
      m4.compose(new THREE.Vector3(Math.cos(a) * d, h / 2, Math.sin(a) * d), q, new THREE.Vector3(w, h, w * (0.7 + r() * 0.6))); m.setMatrixAt(i, m4);
      m.setColorAt(i, c.set(FACADE[i % FACADE.length])); const pal = [0x22e6ff, 0xff3df0, 0x9b5cff, 0xffb347][i % 4]; c.set(pal); tint.set([c.r, c.g, c.b, r() * 50], i * 4); info.set([h, 0.4], i * 2);
    }
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 4)); g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 2));
    this.group.add(m);
  }

  private streetFurniture() {
    const heads: { x: number; z: number; rot: number; c: number }[] = [], poles: { x: number; z: number }[] = [], pools: { x: number; z: number; c: number }[] = [];
    const cols = [0x22e6ff, 0x9b5cff, 0xff3df0, 0xffb347];
    for (let k = 0; k <= N; k++) for (let seg = 0; seg < N; seg++) for (let t = 0; t < 2; t++) {
      const s = roadAt(seg) + 22 + t * 44, side = (seg + t + k) % 2 ? 1 : -1, c = cols[(k + seg + t) % 4];
      let x = roadAt(k) + side * 9.7, z = s; poles.push({ x, z }); heads.push({ x: x - side * 0.9, z, rot: 0, c }); pools.push({ x: x - side * 3.6, z, c });
      x = s; z = roadAt(k) + side * 9.7; poles.push({ x, z }); heads.push({ x, z: z - side * 0.9, rot: Math.PI / 2, c }); pools.push({ x, z: z - side * 3.6, c });
    }
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 8, 0.25), new THREE.MeshStandardMaterial({ color: 0x2a2e3e, metalness: 0.7, roughness: 0.4 }), poles.length);
    const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.22, 0.5), new THREE.MeshBasicMaterial({ toneMapped: false }), heads.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
    poles.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, 4, p.z), q, one); pm.setMatrixAt(i, m4); this.cw.addCirc({ x: p.x, z: p.z, r: 0.35, y0: 0, y1: 8 }); });
    heads.forEach((h, i) => { q.setFromEuler(new THREE.Euler(0, h.rot, 0)); m4.compose(new THREE.Vector3(h.x, 8, h.z), q, one); hm.setMatrixAt(i, m4); hm.setColorAt(i, c.set(h.c)); });
    this.group.add(pm, hm); this.pools(pools);
  }

  private signals() {
    const cnt = (N + 1) * (N + 1) * 4, pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 7, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2e3e, metalness: 0.7 }), cnt);
    this.vLamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ toneMapped: false }), cnt);
    this.hLamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ toneMapped: false }), cnt);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); let n = 0;
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = roadAt(a) + sx * 10.2, z = roadAt(b) + sz * 10.2;
      m4.compose(new THREE.Vector3(x, 3.5, z), q, one); pole.setMatrixAt(n, m4); this.cw.addCirc({ x, z, r: 0.3, y0: 0, y1: 7 });
      m4.compose(new THREE.Vector3(x, 6.6, z), q, one); this.vLamps.setMatrixAt(n, m4);
      m4.compose(new THREE.Vector3(x, 5.8, z), q, one); this.hLamps.setMatrixAt(n, m4); n++;
    }
    this.group.add(pole, this.vLamps, this.hLamps); this.updateSignals(0);
  }
  updateSignals(t: number) {
    const col = new THREE.Color(); let n = 0;
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) { const s = lightState(a, b, t); for (let c = 0; c < 4; c++) { this.vLamps.setColorAt(n, col.copy(LCOL[s.v])); this.hLamps.setColorAt(n, col.copy(LCOL[s.h])); n++; } }
    this.vLamps.instanceColor!.needsUpdate = true; this.hLamps.instanceColor!.needsUpdate = true;
  }

  private highway() {
    const z = roadAt(3), y = 22, len = HALF * 2, deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x12141f, metalness: 0.6, roughness: 0.4, envMap: this.env }));
    deck.position.set(0, y, z); deck.castShadow = true; this.group.add(deck);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.18), basic(s > 0 ? 0x22e6ff : 0xff3df0)); e.position.set(0, y + 0.7, z + s * 5.8); this.group.add(e); }
    this.cw.addBox({ x0: -HALF, x1: HALF, z0: z - 6, z1: z + 6, y0: y - 0.6, y1: y + 0.6 });
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.4, y, 10), new THREE.MeshStandardMaterial({ color: 0x1b1e2c, metalness: 0.6 }), N * 2);
    const m4 = new THREE.Matrix4(); let n = 0;
    for (let k = 0; k < N; k++) for (const s of [-1, 1]) { const x = roadAt(k) + PITCH / 2; m4.makeTranslation(x, y / 2, z + s * 9.9); pil.setMatrixAt(n++, m4); this.cw.addCirc({ x, z: z + s * 9.9, r: 1.2, y0: 0, y1: y }); }
    this.group.add(pil);
  }

  update(t: number, camera: THREE.Vector3) {
    this.timeU.value = t;
    const st = Math.floor(t * 4); if (st !== this.sigT) { this.sigT = st; this.updateSignals(t); }
    this.beacons.color.setRGB(Math.sin(t * 3) > 0 ? 1 : 0.12, 0.1, 0.15);
    this.boards.forEach((m, i) => { m.opacity = 0.82 + 0.18 * Math.sin(t * (3 + i) + i * 1.7) * (Math.sin(t * 0.7 + i) > 0.92 ? 4 : 1); });
    this.holos.forEach((h, i) => { h.rotation.y = t * (0.25 + i * 0.07); });
    void camera;
  }
}
