import * as THREE from "three";
import { clamp, damp, smooth, HALF } from "./config";
import type { City } from "./city";
import type { Pad } from "./collision";
import { basic, glowTex } from "./gfx";

export interface VInput { throttle: number; steer: number; strafe: number; up: boolean; down: boolean; boost: boolean; brake: boolean; toggle: boolean }
export interface VEvents { toast(m: string): void; sound(k: string): void; hit(impact: number): void }
export type VPhase = "drive" | "toFly" | "fly" | "toDrive";

function bodyShape() { const s = new THREE.Shape(); s.moveTo(-2.3, 0.05); s.lineTo(2.4, 0.05); s.lineTo(2.45, 0.3); s.lineTo(1.9, 0.52); s.lineTo(0.6, 0.62); s.lineTo(-0.6, 0.72); s.lineTo(-1.8, 0.7); s.lineTo(-2.3, 0.5); s.closePath(); return s; }
function cabinShape() { const s = new THREE.Shape(); s.moveTo(-1.25, 0.66); s.lineTo(-0.85, 1.1); s.lineTo(0.15, 1.2); s.lineTo(0.95, 0.8); s.lineTo(1.05, 0.64); s.closePath(); return s; }
function extrude(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); return g;
}
const add = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

export class Vehicle {
  root = new THREE.Group(); rig = new THREE.Group();
  x = 0; y = 0; z = 0; yaw = 0; vx = 0; vz = 0; vy = 0; speed = 0; lat = 0;
  phase: VPhase = "drive"; tf = 0; t = 0; hull = 100; energy = 100; pitch = 0; roll = 0; steerVis = 0; spin = 0; braking = false; boosting = false; pad: Pad | null = null; support = 0; lastVf = 0;
  throttleVis = 0;
  private wheels: { assy: THREE.Group; fold: THREE.Group; spin: THREE.Group; front: boolean; side: number; bx: number; bz: number }[] = [];
  private pods: THREE.Mesh[] = []; private rear: THREE.Mesh[] = []; private wings: THREE.Group[] = []; private tail: THREE.MeshBasicMaterial;
  lights: THREE.SpotLight[] = []; under: THREE.PointLight; bodyMeshes: THREE.Mesh[] = [];

  constructor(env: THREE.Texture | null) {
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x1a1e30, metalness: 0.88, roughness: 0.26, envMap: env, envMapIntensity: 1.3 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0b2c3c, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.55, envMap: env, envMapIntensity: 1.8 });
    const body = new THREE.Mesh(extrude(bodyShape(), 1.8, 0.05), bodyM), glass = new THREE.Mesh(extrude(cabinShape(), 1.2, 0.03), glassM);
    body.castShadow = true; this.bodyMeshes.push(body, glass); this.rig.add(body, glass);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 4.3), new THREE.MeshStandardMaterial({ color: 0x07080f })); plate.position.y = 0.14; this.rig.add(plate); this.bodyMeshes.push(plate);
    const cy = basic(0x22e6ff), vi = basic(0x9b5cff);
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 3.3), cy); strip.position.set(s * 1.0, 0.4, -0.1); this.rig.add(strip);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.5), vi); hood.position.set(s * 0.45, 0.58, 1.35); hood.rotation.x = 0.3; this.rig.add(hood);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.07), basic(0xdff6ff)); hl.position.set(s * 0.62, 0.42, 2.4); this.rig.add(hl);
      const sp = new THREE.SpotLight(0xdff6ff, 380, 75, 0.5, 0.7, 1.5); sp.position.set(s * 0.62, 0.45, 2.3); const tg = new THREE.Object3D(); tg.position.set(s * 0.62, -0.5, 20); this.rig.add(tg); sp.target = tg; this.rig.add(sp); this.lights.push(sp);
      const wg = new THREE.Group(); const wm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.7), bodyM); wm.position.x = s * 0.5; const we = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.06), cy); we.position.set(s * 0.5, 0.02, -0.82); wg.add(wm, we); wg.position.set(s * 0.95, 0.55, -0.4); wg.scale.x = 0.01; this.rig.add(wg); this.wings.push(wg);
    }
    this.tail = new THREE.MeshBasicMaterial({ color: 0x661018, toneMapped: false });
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.05), this.tail); tl.position.set(0, 0.52, -2.34); this.rig.add(tl);
    const ug = new THREE.Mesh(new THREE.PlaneGeometry(3, 5.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x30e8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); ug.position.y = 0.06; this.rig.add(ug);
    this.under = new THREE.PointLight(0x35e0ff, 28, 15, 2); this.under.position.y = 0.2; this.rig.add(this.under);
    const tire = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 20).rotateZ(Math.PI / 2), rim = new THREE.CylinderGeometry(0.27, 0.27, 0.34, 14).rotateZ(Math.PI / 2), tm = new THREE.MeshStandardMaterial({ color: 0x0c0d14, roughness: 0.8 });
    for (const sx of [-1, 1]) for (const sz of [1, -1]) {
      const assy = new THREE.Group(), fold = new THREE.Group(), sp = new THREE.Group(); assy.add(fold); fold.add(sp);
      const t = new THREE.Mesh(tire, tm), r = new THREE.Mesh(rim, basic(sz > 0 ? 0x22e6ff : 0x9b5cff)); t.castShadow = true; sp.add(t, r);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.5), basic(0x0a0c18)); sp.add(spoke);
      assy.position.set(sx * 0.95, 0.43, sz * 1.38); this.rig.add(assy); this.wheels.push({ assy, fold, spin: sp, front: sz > 0, side: sx, bx: sx * 0.95, bz: sz * 1.38 });
    }
    const cone = (c: number) => { const g = new THREE.ConeGeometry(0.34, 1, 14, 1, true); g.translate(0, 0.5, 0); g.rotateX(Math.PI); return new THREE.Mesh(g, add(c, 0.75)); };
    for (const sx of [-1, 1]) for (const sz of [1, -1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x0b0d16, metalness: 0.8 })); pod.position.set(sx * 0.58, 0.2, sz * 0.95); pod.scale.setScalar(0.01); this.rig.add(pod);
      const f = cone(0x40e8ff); f.scale.set(1, 0.01, 1); pod.add(f); this.pods.push(pod);
    }
    for (const sx of [-1, 1]) {
      const g = new THREE.ConeGeometry(0.2, 1, 12, 1, true); g.translate(0, 0.5, 0); g.rotateX(-Math.PI / 2); const f = new THREE.Mesh(g, add(0x7ad8ff, 0.8)); f.position.set(sx * 0.45, 0.55, -2.35); this.rig.add(f); this.rear.push(f);
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.2, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0d16, metalness: 0.8 })); n.position.set(sx * 0.45, 0.55, -2.3); this.rig.add(n);
    }
    this.root.add(this.rig);
  }

  get altitude() { return this.y - this.support; }
  get kmh() { return Math.hypot(this.vx, this.vz) * 3.6; }

  place(x: number, z: number, yaw: number) { this.x = x; this.z = z; this.y = 0; this.yaw = yaw; this.vx = this.vz = this.vy = 0; this.phase = "drive"; this.tf = 0; this.t = 0; this.pad = null; this.speed = 0; }

  update(dt: number, inp: VInput, w: City, ev: VEvents) {
    const cw = w.cw, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), fwd = { x: sy, z: cy }, left = { x: cy, z: -sy };
    this.boosting = inp.boost && this.energy > 1 && (inp.throttle > 0 || this.phase === "fly");
    this.energy = clamp(this.energy + (this.boosting ? -24 : 7) * dt, 0, 100);
    const dmg = this.hull <= 0 ? 0.45 : 1;
    const resolve = (r: number, h: number) => { const v = { x: this.vx, z: this.vz }, imp = cw.resolve(this, r, h, v); this.vx = v.x; this.vz = v.z; if (imp > 5) { this.hull = Math.max(0, this.hull - (imp - 5) * 0.8); ev.hit(imp); } };
    const sup = cw.support(this.x, this.z, this.y + 0.2); this.support = sup.h; let vf = this.vx * fwd.x + this.vz * fwd.z;
    this.braking = false;

    if (this.phase === "drive") {
      const gH = this.pad ? this.pad.y : 0;
      const sp0 = Math.abs(vf), rate = (1.95 * clamp(sp0 / 7, 0, 1)) / (1 + sp0 / 38) * (inp.brake ? 1.5 : 1);
      this.yaw += inp.steer * rate * dt * (vf >= -0.5 ? 1 : -1);
      const sy2 = Math.sin(this.yaw), cy2 = Math.cos(this.yaw), f2 = { x: sy2, z: cy2 }, l2 = { x: cy2, z: -sy2 };
      vf = this.vx * f2.x + this.vz * f2.z; let vl = this.vx * l2.x + this.vz * l2.z;
      const maxF = (this.boosting ? 68 : 40) * dmg;
      if (inp.throttle > 0) { if (vf < maxF) vf += inp.throttle * (this.boosting ? 44 : 26) * dt; }
      else if (inp.throttle < 0) { if (vf > 0.5) { vf += inp.throttle * 50 * dt; this.braking = true; } else if (vf > -12) vf += inp.throttle * 16 * dt; }
      if (inp.brake) this.braking = true;
      vf *= Math.exp(-dt * (0.1 + (inp.throttle === 0 ? 0.35 : 0)));
      vl *= Math.exp(-dt * (inp.brake ? 1.3 : 7.5));
      this.vx = f2.x * vf + l2.x * vl; this.vz = f2.z * vf + l2.z * vl; this.speed = vf; this.lat = vl;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y = gH; resolve(2.3, 1.6);
      if (this.pad) { const dx = this.x - this.pad.x, dz = this.z - this.pad.z, d = Math.hypot(dx, dz), lim = this.pad.r - 2.4; if (d > lim) { this.x = this.pad.x + (dx / d) * lim; this.z = this.pad.z + (dz / d) * lim; this.vx *= 0.3; this.vz *= 0.3; } }
      if (inp.toggle) { this.phase = "toFly"; this.t = 0; this.pad = null; ev.sound("transform"); }
    } else if (this.phase === "toFly") {
      this.t += dt / 2.0; const k = Math.min(1, this.t); this.tf = smooth(clamp((k - 0.1) / 0.65, 0, 1));
      this.vx *= Math.exp(-dt * 2.4); this.vz *= Math.exp(-dt * 2.4);
      const base = sup.h; if (k > 0.5) this.vy = damp(this.vy, clamp((base + 7 - this.y) * 2.2, 0, 8), 3, dt);
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt; resolve(2.3, 1.6); this.speed = vf;
      if (k >= 1 && this.y > base + 5) { this.phase = "fly"; this.vy = 0; this.tf = 1; ev.toast("Flight mode online"); }
    } else if (this.phase === "fly") {
      const a = 38 * (this.boosting ? 1.8 : 1), ax = fwd.x * inp.throttle + left.x * inp.strafe * 0.8, az = fwd.z * inp.throttle + left.z * inp.strafe * 0.8;
      this.vx += ax * a * dt; this.vz += az * a * dt;
      const dr = Math.exp(-dt * (inp.throttle || inp.strafe ? 0.55 : 1.7)); this.vx *= dr; this.vz *= dr;
      const mx = (this.boosting ? 84 : 48) * dmg, sp = Math.hypot(this.vx, this.vz); if (sp > mx) { this.vx *= mx / sp; this.vz *= mx / sp; }
      this.yaw += inp.steer * 1.7 * dt;
      const vt = ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * (this.boosting ? 26 : 17); this.vy = damp(this.vy, vt, 3.2, dt);
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt; resolve(2.4, 1.6);
      const s2 = cw.support(this.x, this.z, this.y), fl = s2.h + 1.0; this.support = s2.h;
      if (this.y < fl) { this.y = fl; if (this.vy < 0) this.vy = 0; } if (this.y > 320) { this.y = 320; this.vy = Math.min(0, this.vy); }
      this.speed = vf;
      if (inp.toggle) { if (s2.landable) { this.phase = "toDrive"; this.t = 0; ev.sound("transform"); } else ev.toast("No landing zone below. Land on a road or a landing pad."); }
    } else {
      const s2 = cw.support(this.x, this.z, this.y), g = s2.h; this.support = g;
      if (!s2.landable) { this.phase = "fly"; ev.toast("No landing zone below. Land on a road or a landing pad."); }
      else {
        this.vx *= Math.exp(-dt * 2.2); this.vz *= Math.exp(-dt * 2.2); this.x += this.vx * dt; this.z += this.vz * dt;
        if (this.y > g + 0.7) { this.vy = -clamp((this.y - g) * 1.5, 2.5, 14); this.y += this.vy * dt; if (this.y < g + 0.7) this.y = g + 0.7; }
        else { this.vy = 0; this.y = damp(this.y, g, 6, dt); this.tf = Math.max(0, this.tf - dt / 1.3); if (this.tf <= 0.001) { this.tf = 0; this.phase = "drive"; this.pad = s2.pad; this.y = g; this.vy = 0; } }
        resolve(2.3, 1.6); this.speed = vf;
        if (inp.toggle && this.tf > 0.99) this.phase = "fly";
      }
    }
    const lim = HALF + 60; if (Math.abs(this.x) > lim) { this.x = Math.sign(this.x) * lim; this.vx = 0; } if (Math.abs(this.z) > lim) { this.z = Math.sign(this.z) * lim; this.vz = 0; }
    this.visuals(dt, inp, vf);
  }

  private visuals(dt: number, inp: VInput, vf: number) {
    const fly = this.phase === "fly" || this.phase === "toFly" || this.phase === "toDrive", acc = (vf - this.lastVf) / Math.max(dt, 1e-3); this.lastVf = vf;
    this.throttleVis = damp(this.throttleVis, clamp(inp.throttle, 0, 1), 8, dt);
    const tp = fly ? -inp.throttle * 0.1 + this.vy * 0.004 : clamp(-acc * 0.004, -0.07, 0.07), tr = fly ? -inp.steer * 0.35 - inp.strafe * 0.22 : -inp.steer * clamp(vf / 40, 0, 1) * 0.12;
    this.pitch = damp(this.pitch, tp, 6, dt); this.roll = damp(this.roll, tr, 5, dt);
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.set(0, this.yaw, 0);
    const bob = this.phase === "fly" ? Math.sin(performance.now() * 0.003) * 0.12 : Math.sin(performance.now() * 0.05) * 0.015 * clamp(Math.abs(vf) / 30, 0, 1);
    this.rig.rotation.set(-this.pitch, 0, this.roll); this.rig.position.y = bob;
    this.steerVis = damp(this.steerVis, inp.steer * 0.5, 10, dt); this.spin += vf * dt / 0.43;
    const tf = this.tf;
    for (const w of this.wheels) {
      w.assy.position.set(w.bx * (1 - 0.28 * tf), 0.43 + 0.3 * tf, w.bz); w.assy.scale.setScalar(1 - 0.45 * tf); w.assy.rotation.y = w.front ? this.steerVis * (1 - tf) : 0;
      w.fold.rotation.z = (Math.PI / 2) * tf * -w.side; w.spin.rotation.x = this.spin;
    }
    for (const w of this.wings) w.scale.x = Math.max(0.01, tf);
    const lift = this.phase === "fly" || this.phase === "toFly" ? 1 : 0, boost = this.boosting ? 1 : 0;
    for (const p of this.pods) { p.scale.setScalar(Math.max(0.01, tf)); const f = p.children[0] as THREE.Mesh; f.scale.set(1, Math.max(0.01, tf * (1.6 + 0.9 * lift + 1.2 * boost + 0.3 * Math.random())), 1); }
    for (const r of this.rear) r.scale.set(1, 1, Math.max(0.02, (this.throttleVis * 1.0 + (this.phase === "fly" ? clamp(Math.hypot(this.vx, this.vz) / 40, 0, 1) : 0)) * (1.2 + boost * 2.2) * (0.9 + Math.random() * 0.2)));
    this.tail.color.setRGB(this.braking ? 1 : 0.4, this.braking ? 0.08 : 0.06, this.braking ? 0.12 : 0.08);
    this.under.intensity = 24 + tf * 20 + boost * 25;
  }
}
