// Spatial-hash collision world (boxes + circles) and support-surface queries.
export interface Box { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
export interface Circ { x: number; z: number; r: number; y0: number; y1: number }
export interface Pad { x: number; y: number; z: number; r: number; name: string }
export interface Support { h: number; landable: boolean; pad: Pad | null }

export class Collision {
  boxes: Box[] = []; circs: Circ[] = []; pads: Pad[] = [];
  private cell = 48; private hb = new Map<number, Box[]>(); private hc = new Map<number, Circ[]>();
  private key(cx: number, cz: number) { return (cx + 64) * 256 + (cz + 64); }
  private cells(x0: number, x1: number, z0: number, z1: number, fn: (k: number) => void) {
    const c = this.cell;
    for (let a = Math.floor(x0 / c); a <= Math.floor(x1 / c); a++) for (let b = Math.floor(z0 / c); b <= Math.floor(z1 / c); b++) fn(this.key(a, b));
  }
  addBox(b: Box) { this.boxes.push(b); this.cells(b.x0, b.x1, b.z0, b.z1, (k) => { (this.hb.get(k) ?? this.hb.set(k, []).get(k)!).push(b); }); }
  addCirc(c: Circ) { this.circs.push(c); this.cells(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, (k) => { (this.hc.get(k) ?? this.hc.set(k, []).get(k)!).push(c); }); }
  nearBoxes(x: number, z: number, r: number): Box[] {
    const out: Box[] = [], seen = new Set<Box>();
    this.cells(x - r, x + r, z - r, z + r, (k) => { const l = this.hb.get(k); if (l) for (const b of l) if (!seen.has(b)) { seen.add(b); out.push(b); } });
    return out;
  }
  nearCircs(x: number, z: number, r: number): Circ[] {
    const out: Circ[] = [], seen = new Set<Circ>();
    this.cells(x - r, x + r, z - r, z + r, (k) => { const l = this.hc.get(k); if (l) for (const b of l) if (!seen.has(b)) { seen.add(b); out.push(b); } });
    return out;
  }
  /** Push a vertical cylinder (radius r, spanning p.y..p.y+h) out of obstacles; returns the strongest impact speed. */
  resolve(p: { x: number; y: number; z: number }, r: number, h: number, v: { x: number; z: number }): number {
    let impact = 0;
    for (const b of this.nearBoxes(p.x, p.z, r + 1)) {
      if (p.y + h < b.y0 || p.y >= b.y1 - 0.15) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx: number, nz: number, pen: number;
      if (d2 < 1e-6) {
        const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rr, t, bt);
        if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
        pen = m + r;
      } else { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
      p.x += nx * pen; p.z += nz * pen;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); v.x -= 1.25 * vn * nx; v.z -= 1.25 * vn * nz; }
    }
    for (const c of this.nearCircs(p.x, p.z, r + 1)) {
      if (p.y + h < c.y0 || p.y >= c.y1 - 0.15) continue;
      const dx = p.x - c.x, dz = p.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d;
      p.x = c.x + nx * rr; p.z = c.z + nz * rr;
      const vn = v.x * nx + v.z * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); v.x -= 1.25 * vn * nx; v.z -= 1.25 * vn * nz; }
    }
    return impact;
  }
  /** Highest surface under (x,z) that is not above y+1. */
  support(x: number, z: number, y: number): Support {
    let best: Support = { h: 0, landable: true, pad: null };
    for (const b of this.nearBoxes(x, z, 2)) {
      if (x < b.x0 - 1.2 || x > b.x1 + 1.2 || z < b.z0 - 1.2 || z > b.z1 + 1.2) continue;
      if (b.y1 <= y + 1.0 && b.y1 > best.h) best = { h: b.y1, landable: false, pad: null };
    }
    for (const p of this.pads) {
      if (Math.hypot(x - p.x, z - p.z) <= p.r && p.y <= y + 1.0 && p.y >= best.h - 0.05) best = { h: p.y, landable: true, pad: p };
    }
    return best;
  }
}
