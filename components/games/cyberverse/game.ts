import * as THREE from "three";
import { DCOL, DNAME, districtAt, roadAt, clamp, damp, loadSettings, saveSettings, N, X0, PITCH, type Settings } from "./config";
import { City } from "./city";
import { Extras, type POI } from "./pois";
import { Vehicle, type VInput } from "./vehicle";
import { NPCs } from "./npc";
import { Traffic } from "./traffic";
import { Sky, Rain, Lightning, Particles, Post, makeEnv } from "./effects";
import { Sound } from "./audio";
import { UI, type HudState } from "./ui";
import { beam, disposeDeep } from "./gfx";

export interface GameOpts { container: HTMLElement; onExit: () => void; logo?: string }
type Mode = "menu" | "play" | "pause";
const CAMS = ["CHASE", "FAR", "COCKPIT"];
const SPAWN = { x: roadAt(3) - 4, z: -100 };

export class Game {
  ui!: UI; renderer!: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(65, 1, 0.4, 3000);
  city!: City; extras!: Extras; veh!: Vehicle; npcs!: NPCs; traffic!: Traffic; sky!: Sky; rain!: Rain; light = new Lightning(); parts!: Particles; post!: Post; sound = new Sound();
  moon!: THREE.DirectionalLight; hemi!: THREE.HemisphereLight; fog!: THREE.Fog; settings: Settings = loadSettings();
  mode: Mode = "menu"; mapPause = false; t = 0; acc = 0; last = 0; raf = 0; hudT = 0; alive = true; hidden = false;
  keys = new Set<string>(); pulses = new Set<string>(); camMode = 0; yawOff = 0; pitchOff = 0; shake = 0; fov = 65; camInit = false;
  wp: { x: number; z: number } | null = null; route: [number, number][] = []; routeT = 0; routeLine!: THREE.Line; wpBeam!: THREE.Mesh; found = 0; totalFound = 0; target: POI | null = null; landmarkSeen = new Set<string>();
  ema = 16; adapt = 1; adaptT = 0; menuT = 0; dragging = false;
  private off: (() => void)[] = [];

  constructor(private o: GameOpts) {
    const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.ui = new UI(o.container, {
      logo: o.logo ?? "", touch, settings: this.settings, onEnter: () => this.enter(), onResume: () => this.setPause(false), onExit: () => this.exit(), onSettings: (s) => this.apply(s), onWaypoint: (x, z) => this.setWaypoint(x, z),
      onClearWaypoint: () => this.setWaypoint(null), onPause: () => this.setPause(true), onMap: () => this.toggleMap(), onCam: () => this.cycleCam(), onResetCam: () => this.resetCam(), onSound: (k) => { this.sound.init(); this.sound.play(k); },
    });
    try { this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.gl, antialias: false, powerPreference: "high-performance" }); } catch { this.ui.fatal("WebGL is not available on this device or browser. NEURON: CYBERVERSE needs 3D graphics."); this.alive = false; return; }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const sc = this.scene; sc.background = new THREE.Color(0x05030c); this.fog = new THREE.Fog(0x0d0820, 40, this.settings.viewDist); sc.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0x5a4aa0, 0x140a24, 0.9); this.moon = new THREE.DirectionalLight(0x7a8aff, 0.55); this.moon.castShadow = true; Object.assign(this.moon.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 500 }); this.moon.shadow.bias = -0.0006;
    sc.add(this.hemi, this.moon, this.moon.target);
    const env = makeEnv(this.renderer); this.sky = new Sky(); sc.add(this.sky.mesh);
    this.city = new City(sc, env); this.extras = new Extras(this.city, sc); this.veh = new Vehicle(env); sc.add(this.veh.root); this.npcs = new NPCs(sc, this.city, this.extras); this.traffic = new Traffic(sc, env);
    this.rain = new Rain(); sc.add(this.rain.mesh); this.parts = new Particles(600); sc.add(this.parts.mesh); this.post = new Post(this.renderer, sc, this.camera, innerWidth, innerHeight);
    this.routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xff3df0, toneMapped: false })); this.routeLine.visible = false; this.routeLine.frustumCulled = false; sc.add(this.routeLine);
    this.wpBeam = beam(0xff3df0, 260, 1.2, 0.4); this.wpBeam.visible = false; sc.add(this.wpBeam);
    this.totalFound = this.extras.pois.filter((p) => p.type !== "charge" && p.type !== "repair" && p.type !== "nav" && p.type !== "hub" && p.type !== "pad").length;
    this.veh.place(SPAWN.x, SPAWN.z, 0); this.veh.phase = "fly"; this.veh.y = 7; this.veh.tf = 1;
    this.apply(this.settings); this.bind(); this.ui.setHud(false); this.ui.setMenu(true); this.ui.ready();
    this.last = performance.now(); this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- setup ----------
  private on(t: Window | Document | HTMLElement, k: string, f: (e: Event) => void, opt?: boolean | AddEventListenerOptions) { t.addEventListener(k, f, opt); this.off.push(() => t.removeEventListener(k, f, opt)); }
  private bind() {
    const typing = (e: Event) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === "INPUT" || t.tagName === "SELECT"); };
    this.on(window, "keydown", (e) => {
      const ev = e as KeyboardEvent; if (typing(e) && ev.code !== "Escape") { ev.stopPropagation(); return; }
      ev.stopPropagation(); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(ev.code)) ev.preventDefault();
      if (!ev.repeat) { this.pulses.add(ev.code); this.sound.init(); }
      this.keys.add(ev.code);
      if (ev.code === "Escape" && !ev.repeat) this.escape();
    }, true);
    this.on(window, "keyup", (e) => { (e as KeyboardEvent).stopPropagation(); this.keys.delete((e as KeyboardEvent).code); }, true);
    this.on(window, "blur", () => { this.keys.clear(); if (this.mode === "play") this.setPause(true); });
    this.on(document, "visibilitychange", () => { this.hidden = document.hidden; if (this.hidden) { if (this.mode === "play") this.setPause(true); this.sound.suspend(); cancelAnimationFrame(this.raf); } else if (this.alive) { this.sound.resume(); this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } });
    this.on(window, "resize", () => this.resize());
    const gl = this.ui.gl; let lx = 0, ly = 0;
    this.on(gl, "pointerdown", (e) => { const p = e as PointerEvent; this.dragging = true; lx = p.clientX; ly = p.clientY; gl.setPointerCapture(p.pointerId); this.sound.init(); });
    this.on(gl, "pointermove", (e) => { const p = e as PointerEvent; if (!this.dragging || this.mode !== "play") return; this.yawOff -= (p.clientX - lx) * 0.005; this.pitchOff = clamp(this.pitchOff + (p.clientY - ly) * 0.03, -3, 8); lx = p.clientX; ly = p.clientY; });
    this.on(gl, "pointerup", () => { this.dragging = false; }); this.on(gl, "pointercancel", () => { this.dragging = false; });
    this.on(gl, "wheel", (e) => { e.preventDefault(); }, { passive: false });
    this.resize();
  }
  resize() { const w = this.o.container.clientWidth || innerWidth, h = this.o.container.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.post.setSize(w, h, this.renderer.getPixelRatio()); }
  apply(s: Settings) {
    this.settings = s; saveSettings(s); const pr = Math.max(0.6, s.pixelRatio * this.adapt);
    this.renderer.setPixelRatio(pr); this.resize(); this.post.enabled = s.bloom; this.post.bloom.strength = 0.5;
    this.moon.castShadow = s.shadows > 0; const ms = s.shadows === 2 ? 2048 : 1024; if (this.moon.shadow.mapSize.x !== ms) { this.moon.shadow.mapSize.set(ms, ms); this.moon.shadow.map?.dispose(); this.moon.shadow.map = null; }
    this.parts.density = s.particles; this.fog.far = s.viewDist * this.adapt; this.fog.near = Math.min(60, s.viewDist * 0.2);
    const wet = s.weather === "off" ? 0.34 : s.weather === "rain" ? 0.24 : 0.16; this.city.roadMat.roughness = wet;
    this.rain.set(s.weather === "off" ? 0 : s.weather === "rain" ? 0.45 * Math.min(1, s.particles + 0.3) : Math.min(1, s.particles + 0.4)); this.rain.u.uOpacity.value = s.weather === "storm" ? 0.7 : 0.5;
    this.light.enabled = s.weather === "storm"; this.sky.u.uCloud.value = s.weather === "off" ? 0.2 : s.weather === "rain" ? 0.55 : 0.95;
    this.npcs.setDensity(s.npc); this.traffic.setDensity(s.npc); this.sound.setVol({ master: s.master, music: s.music, sfx: s.sfx });
  }

  // ---------- state ----------
  enter() { this.sound.init(); this.mode = "play"; this.ui.setMenu(false); this.ui.setHud(true); this.veh.phase = "toDrive"; this.veh.vy = 0; this.camInit = false; this.yawOff = 0; this.pitchOff = 0; this.ui.toast("Welcome to Nexus City. Press C to transform and fly.", 4); }
  escape() {
    if (this.ui.mapOpen) { this.toggleMap(); return; } if (this.ui.modalOpen()) { this.ui.closeModals(); return; }
    if (this.mode === "play") this.setPause(true); else if (this.mode === "pause") this.setPause(false);
  }
  setPause(p: boolean) { if (this.mode === "menu") return; this.mode = p ? "pause" : "play"; this.ui.setPause(p); this.sound.play("pause"); if (!p) this.ui.closeModals(); }
  toggleMap() { if (this.mode === "menu") return; const open = !this.ui.mapOpen; this.ui.setMap(open); this.mapPause = open; if (open && this.mode === "pause") { this.ui.setPause(false); this.mode = "play"; } this.sound.play("ui"); }
  cycleCam() { this.camMode = (this.camMode + 1) % 3; this.veh.bodyMeshes.forEach((m) => (m.visible = this.camMode !== 2)); this.sound.play("ui"); }
  resetCam() { this.yawOff = 0; this.pitchOff = 0; }
  exit() { this.o.onExit(); }
  setWaypoint(x: number | null, z?: number) {
    if (x === null) { this.wp = null; this.route = []; this.ui.toast("Waypoint cleared"); return; }
    this.wp = { x, z: z! }; this.routeT = 0; this.buildRoute(); this.ui.toast("Waypoint set. Follow the magenta route."); this.sound.play("found");
  }
  private buildRoute() {
    if (!this.wp) { this.route = []; return; }
    const v = this.veh, nearest = (c: number) => clamp(Math.round((c - X0) / PITCH), 0, N);
    const i0 = nearest(v.x), j0 = nearest(v.z), i1 = nearest(this.wp.x), j1 = nearest(this.wp.z);
    this.route = [[v.x, v.z], [roadAt(i0), roadAt(j0)], [roadAt(i1), roadAt(j0)], [roadAt(i1), roadAt(j1)], [this.wp.x, this.wp.z]];
    const pos = this.routeLine.geometry.attributes.position as THREE.BufferAttribute; this.route.forEach((q, i) => pos.setXYZ(i, q[0], 0.5, q[1])); pos.setXYZ(5, this.wp.x, 0.5, this.wp.z); pos.needsUpdate = true;
  }

  // ---------- main loop ----------
  loop = (now: number) => {
    if (!this.alive || this.hidden) return; this.raf = requestAnimationFrame(this.loop);
    const frame = now - this.last; this.last = now; this.acc += Math.min(0.1, frame / 1000);
    let steps = 0; while (this.acc >= 1 / 60 && steps < 4) { this.simulate(1 / 60); this.acc -= 1 / 60; steps++; } if (steps === 4) this.acc = 0;
    this.render(frame);
  };
  private input(): VInput {
    const k = (c: string) => this.keys.has(c), tc = this.ui.touch, fly = this.veh.phase === "fly" || this.veh.phase === "toFly";
    const thr = clamp((k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0) + (tc.gas ? 1 : 0) - (tc.brake ? 1 : 0), -1, 1);
    const st = clamp((k("KeyA") || k("ArrowLeft") ? 1 : 0) - (k("KeyD") || k("ArrowRight") ? 1 : 0) + tc.steer, -1, 1);
    const toggle = this.pulses.has("KeyC") || tc.fly; tc.fly = false;
    return { throttle: thr, steer: st, strafe: (k("KeyQ") ? 1 : 0) - (k("KeyE") ? 1 : 0), up: k("Space") || tc.up, down: k("KeyX") || tc.down, boost: k("ShiftLeft") || k("ShiftRight") || tc.boost, brake: !fly && k("Space"), toggle };
  }
  simulate(h: number) {
    if (this.mode === "pause" || this.mapPause) { this.pulses.clear(); return; }
    this.t += h; const v = this.veh, w = this.city, tc = this.ui.touch;
    let inp: VInput;
    if (this.mode === "menu") { this.menuT += h; v.phase = "fly"; v.tf = 1; v.y = 7 + Math.sin(this.menuT * 0.8) * 0.4; v.vy = 0; inp = { throttle: 0, steer: 0.06, strafe: 0, up: false, down: false, boost: false, brake: false, toggle: false }; }
    else inp = this.input();
    if (this.pulses.has("KeyV") || tc.cam) { this.cycleCam(); tc.cam = false; } if (this.pulses.has("KeyR")) this.resetCam(); if (this.pulses.has("KeyM")) this.toggleMap();
    const act = this.pulses.has("KeyF") || tc.act; tc.act = false;
    v.update(h, inp, w, {
      toast: (m) => this.ui.toast(m), sound: (k) => this.sound.play(k),
      hit: (imp) => { this.shake = Math.min(1, this.shake + imp * 0.05); this.ui.damage(); this.sound.play("hit"); const q = this.veh; for (let i = 0; i < 14; i++) this.parts.emit(q.x, q.y + 1, q.z, (Math.random() - 0.5) * 14, Math.random() * 8, (Math.random() - 0.5) * 14, 0.6, 1, 0.7, 0.2, 0.3); },
    });
    if (this.mode === "play") {
      const vv = { x: v.x, y: v.y, z: v.z, vx: v.vx, vz: v.vz }, imp = this.traffic.collide(vv);
      if (imp > 0) { v.x = vv.x; v.z = vv.z; v.vx = vv.vx; v.vz = vv.vz; if (imp > 4) { v.hull = Math.max(0, v.hull - (imp - 4) * 0.5); this.shake = Math.min(1, this.shake + imp * 0.04); this.ui.damage(); this.sound.play("hit"); } }
      if (this.traffic.collideFlyers(v) && Math.random() < 0.1) { v.hull = Math.max(0, v.hull - 2); this.shake = 0.5; this.ui.damage(); this.sound.play("hit"); this.ui.toast("Aerial traffic: collision warning"); }
      this.interact(act);
      if (this.wp) { this.routeT -= h; if (this.routeT <= 0) { this.routeT = 1.2; this.buildRoute(); } if (this.wp && Math.hypot(this.wp.x - v.x, this.wp.z - v.z) < 18) { this.ui.toast("Destination reached"); this.sound.play("found"); this.wp = null; this.route = []; } }
    }
    const p = { x: v.x, y: v.y, z: v.z, vx: v.vx, vz: v.vz, ground: v.phase === "drive" };
    w.update(this.t, this.camera.position); this.extras.update(this.t, v.x, v.z); this.npcs.update(h, this.t, p, this.settings.viewDist * this.adapt); this.traffic.update(h, this.t, p, this.settings.viewDist * this.adapt, { x: v.x, z: v.z, y: v.y, ground: p.ground });
    this.sky.u.uTime.value = this.t; this.sky.mesh.position.copy(this.camera.position);
    this.light.update(h, () => this.sound.play("thunder")); this.sky.u.uFlash.value = this.light.flash; this.hemi.intensity = 0.9 + this.light.flash * 3;
    this.rain.update(this.t, this.camera.position);
    this.moon.position.set(v.x + 90, 220, v.z + 60); this.moon.target.position.set(v.x, 0, v.z);
    this.emit(); this.parts.update(h); this.shake = Math.max(0, this.shake - h * 1.6);
    this.sound.update(h, { speed: v.kmh / 3.6, max: 70, throttle: inp.throttle, fly: v.phase !== "drive", boost: v.boosting, drift: Math.abs(v.lat) > 4 && v.phase === "drive", rain: this.settings.weather === "off" ? 0 : this.settings.weather === "rain" ? 0.5 : 1, paused: false, menu: this.mode === "menu", tf: v.tf, robot: this.mode === "play" ? this.npcs.nearestRobot(p) : 99 });
    this.pulses.clear();
    this.cameraStep(h);
    this.hudT -= h; if (this.hudT <= 0) { this.hudT = 1 / 15; if (this.mode !== "menu") this.updateHud(); }
    this.ui.tick(h);
    this.routeLine.visible = !!this.wp && v.phase === "drive" && this.route.length > 1;
    this.wpBeam.visible = !!this.wp; if (this.wp) this.wpBeam.position.set(this.wp.x, 0, this.wp.z);
  }
  private emit() {
    const v = this.veh, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), P = this.parts, boost = v.boosting;
    const rear = (lx: number, ly: number, lz: number) => ({ x: v.x + cy * lx + sy * lz, y: v.y + ly, z: v.z - sy * lx + cy * lz });
    const thr = v.throttleVis + (v.phase === "fly" ? clamp(Math.hypot(v.vx, v.vz) / 40, 0, 1) : 0);
    if (thr > 0.1 || boost) for (const sx of [-0.45, 0.45]) { const r = rear(sx, 0.55, -2.5); P.emit(r.x, r.y, r.z, -sy * (6 + thr * 8) + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, -cy * (6 + thr * 8) + (Math.random() - 0.5), 0.4, boost ? 1 : 0.4, boost ? 0.3 : 0.85, boost ? 0.9 : 1, boost ? 0.4 : 0.2); }
    if (v.tf > 0.4) for (const sx of [-0.58, 0.58]) for (const sz of [-0.95, 0.95]) { const r = rear(sx, 0.1, sz); P.emit(r.x, r.y, r.z, (Math.random() - 0.5) * 1.5, -7, (Math.random() - 0.5) * 1.5, 0.3, 0.3, 0.9, 1, 0.22); }
    if (v.phase === "drive" && Math.abs(v.lat) > 4) for (const sx of [-0.95, 0.95]) { const r = rear(sx, 0.2, -1.4); P.emit(r.x, r.y, r.z, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0.7, 0.3, 0.3, 0.4, 0.7); }
  }
  private cameraStep(dt: number) {
    const v = this.veh, c = this.camera, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw), spd = clamp(v.kmh / 250, 0, 1);
    let tx: number, ty: number, tz: number, lx: number, ly: number, lz: number;
    if (this.mode === "menu") { const a = this.menuT * 0.25 + 0.6; tx = v.x + Math.cos(a) * 15; tz = v.z + Math.sin(a) * 15; ty = v.y + 3.5; lx = v.x; ly = v.y + 0.6; lz = v.z; }
    else if (this.camMode === 2) { tx = v.x + sy * 0.2; ty = v.y + 1.2; tz = v.z + cy * 0.2; lx = v.x + sy * 12; ly = v.y + 1.0 - v.pitch * 10; lz = v.z + cy * 12; }
    else {
      const fy = v.yaw + this.yawOff, far = this.camMode === 1, dist = (far ? 20 : 9.5) + spd * 6 + (v.boosting ? 2 : 0), hgt = (far ? 8 : 3.4) + this.pitchOff + (v.phase !== "drive" ? 1.2 : 0);
      tx = v.x - Math.sin(fy) * dist; tz = v.z - Math.cos(fy) * dist; ty = v.y + hgt; lx = v.x + sy * 6; ly = v.y + 1.3; lz = v.z + cy * 6;
      const bx = v.x, by = v.y + 1.5, bz = v.z; let k = 1;
      for (let s = 1; s >= 0.15; s -= 0.1) { const px = bx + (tx - bx) * s, py = by + (ty - by) * s, pz = bz + (tz - bz) * s; let hit = py < 1; for (const b of this.city.cw.nearBoxes(px, pz, 2)) if (px > b.x0 - 0.6 && px < b.x1 + 0.6 && pz > b.z0 - 0.6 && pz < b.z1 + 0.6 && py > b.y0 && py < b.y1 + 0.6) { hit = true; break; } if (!hit) { k = s; break; } k = 0.15; }
      tx = bx + (tx - bx) * k; ty = Math.max(1.2, by + (ty - by) * k); tz = bz + (tz - bz) * k;
    }
    if (!this.camInit) { c.position.set(tx, ty, tz); this.camInit = true; } else { const kf = this.mode === "menu" ? 4 : this.camMode === 2 ? 30 : 7; c.position.x = damp(c.position.x, tx, kf, dt); c.position.y = damp(c.position.y, ty, kf, dt); c.position.z = damp(c.position.z, tz, kf, dt); }
    if (this.shake > 0) { const s = this.shake * 0.35; c.position.x += (Math.random() - 0.5) * s; c.position.y += (Math.random() - 0.5) * s; c.position.z += (Math.random() - 0.5) * s; }
    c.lookAt(lx, ly, lz); const tf = 65 + spd * 14 + (v.boosting ? 8 : 0); this.fov = damp(this.fov, this.camMode === 2 ? tf + 10 : tf, 4, dt); if (Math.abs(c.fov - this.fov) > 0.05) { c.fov = this.fov; c.updateProjectionMatrix(); }
    this.parts.u.uScale.value = (this.renderer.domElement.height * 0.5) / Math.tan((c.fov * Math.PI) / 360);
  }

  // ---------- interactions ----------
  private interact(act: boolean) {
    const v = this.veh; let best: POI | null = null, bd = 1e9;
    for (const p of this.extras.pois) {
      const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz), dy = Math.abs(p.y - v.y);
      if (p.type === "landmark") { if (d < p.r && !this.landmarkSeen.has(p.id)) { this.landmarkSeen.add(p.id); p.found = true; this.found++; this.ui.toast(`Landmark discovered: ${p.name}`, 3.5); this.ui.info(p, 6); this.sound.play("found"); } continue; }
      if (d < p.r && dy < (p.pad ? 10 : 6) && d < bd) { best = p; bd = d; }
    }
    this.target = best;
    if (!best) { this.ui.prompt(null); return; }
    const label: Record<string, string> = { charge: "recharge boost energy", repair: "repair your vehicle", nav: "open navigation", hub: "request robot service", discovery: "inspect", viewpoint: "recharge and enjoy the view", pad: "recharge", transit: "inspect station" };
    this.ui.prompt(`${best.name}: press F to ${label[best.type]}`);
    if (!act) return;
    const t = best.type;
    if (t === "charge" || t === "pad" || t === "viewpoint") { v.energy = 100; this.sound.play("charge"); this.ui.toast("Boost energy fully restored", 2.5); }
    if (t === "repair") { v.hull = 100; this.sound.play("repair"); this.ui.toast("Vehicle condition restored to 100%"); }
    if (t === "hub") { v.hull = Math.min(100, v.hull + 25); this.sound.play("repair"); this.ui.toast(best.desc); }
    if (t === "nav") { this.toggleMap(); this.ui.toast("Navigation terminal online. Choose a destination."); }
    if (t === "discovery" || t === "viewpoint" || t === "transit") { if (!best.found) { best.found = true; this.found++; this.sound.play("found"); } this.ui.info(best, 8); }
  }
  private updateHud() {
    const v = this.veh, d = districtAt(v.x, v.z), fly = v.phase === "fly", mode = { drive: "DRIVE", toFly: "TRANSFORMING", fly: "FLIGHT", toDrive: "LANDING" }[v.phase];
    const b = ((Math.atan2(Math.sin(v.yaw), -Math.cos(v.yaw)) * 180) / Math.PI + 360) % 360;
    const s: HudState = {
      kmh: v.kmh, energy: Math.round(v.energy), hull: Math.round(v.hull), mode, alt: Math.max(0, v.altitude), showAlt: fly || v.phase !== "drive", bearing: b, district: DNAME[d], dcol: DCOL[d], x: v.x, z: v.z, yaw: v.yaw,
      wp: this.wp, route: this.route, pois: this.extras.pois, boost: v.boosting, found: this.found, total: this.totalFound, cam: CAMS[this.camMode], wpDist: this.wp ? Math.hypot(this.wp.x - v.x, this.wp.z - v.z) : 0, nearby: this.target ? this.target.name : "",
    };
    this.ui.hud(s);
  }
  render(frame: number) {
    this.ema = this.ema * 0.95 + Math.min(100, frame) * 0.05; this.adaptT += frame / 1000;
    if (this.adaptT > 2.5 && this.mode !== "menu") { this.adaptT = 0; const old = this.adapt; if (this.ema > 30 && this.adapt > 0.62) this.adapt = Math.max(0.6, this.adapt - 0.12); else if (this.ema < 15 && this.adapt < 1) this.adapt = Math.min(1, this.adapt + 0.08); if (old !== this.adapt) this.apply(this.settings); }
    this.post.render(this.scene, this.camera);
  }

  dispose() {
    this.alive = false; cancelAnimationFrame(this.raf); this.off.forEach((f) => f()); this.sound.dispose(); this.ui?.dispose();
    try { this.post?.dispose(); disposeDeep(this.scene); this.renderer?.dispose(); this.renderer?.forceContextLoss(); } catch { /* ignore */ }
  }
}
