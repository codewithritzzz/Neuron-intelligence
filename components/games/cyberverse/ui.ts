import { N, BLOCK, ROAD, HALF, roadAt, blockAt, districtOf, DCOL, PRESETS, type Settings, type Preset } from "./config";
import { POI_COLOR, type POI } from "./pois";

const CSS = `
.cv{position:fixed;inset:0;z-index:60;background:#02030a;color:#dfe8ff;font-family:var(--font-body,Manrope),system-ui,sans-serif;font-size:13px;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
.cv canvas.cv-gl{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.cv *{box-sizing:border-box}
.cv .g{background:rgba(5,9,22,.74);border:1px solid rgba(34,230,255,.28);border-radius:10px}
.cv button{font:inherit;color:inherit;cursor:pointer}
.cv .b{border:1px solid rgba(34,230,255,.55);background:rgba(8,20,40,.7);padding:11px 22px;border-radius:8px;letter-spacing:.14em;font-weight:600;text-transform:uppercase;font-size:.78rem;transition:background .2s,box-shadow .2s,transform .2s}
.cv .b:hover{background:rgba(34,230,255,.18);box-shadow:0 0 22px rgba(34,230,255,.4);transform:translateY(-1px)}
.cv .b.p{background:linear-gradient(135deg,#22e6ff,#9b5cff);border-color:transparent;color:#03040c;box-shadow:0 0 30px rgba(155,92,255,.55)}
.cv .ic{border:1px solid rgba(34,230,255,.35);background:rgba(5,9,22,.62);width:42px;height:42px;border-radius:9px;display:grid;place-items:center;font-size:.72rem;letter-spacing:.06em}
.cv .t{font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:#7fb4d8}
.cv-menu{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 8vw;background:linear-gradient(90deg,rgba(2,3,10,.88),rgba(2,3,10,.35) 55%,transparent)}
.cv-menu h1{font-family:var(--font-head,Sora),system-ui,sans-serif;font-size:clamp(2.2rem,6.2vw,5rem);line-height:1;margin:0;font-weight:700;letter-spacing:-.02em;text-shadow:0 0 28px rgba(34,230,255,.6),0 0 60px rgba(155,92,255,.45)}
.cv-menu h1 span{display:block;background:linear-gradient(90deg,#22e6ff,#ff3df0);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none}
.cv-menu p{color:#9ab6d6;max-width:46ch;margin:14px 0 26px}
.cv-menu .row{display:flex;flex-direction:column;gap:10px;width:min(280px,80vw)}
.cv-menu .foot{position:absolute;left:8vw;bottom:5vh;color:#6f8aa8;font-size:.72rem;letter-spacing:.08em}
.cv-modal{position:absolute;inset:0;display:none;place-items:center;background:rgba(2,3,10,.7);z-index:5}
.cv-modal.on{display:grid}
.cv-modal .box{width:min(560px,92vw);max-height:86vh;overflow:auto;padding:22px 24px}
.cv-modal h2{margin:0 0 14px;font-family:var(--font-head,Sora),system-ui;font-size:1.1rem;letter-spacing:.16em;text-transform:uppercase}
.cv-modal table{width:100%;border-collapse:collapse}.cv-modal td{padding:5px 0;border-bottom:1px solid rgba(34,230,255,.12)}.cv-modal td:first-child{color:#22e6ff;width:42%;font-weight:600}
.cv-set{display:grid;grid-template-columns:1fr 1.2fr;gap:9px 14px;align-items:center}
.cv-set label{color:#9ab6d6}.cv-set input[type=range]{width:100%;accent-color:#22e6ff}.cv-set select{background:#0a1226;color:#dfe8ff;border:1px solid rgba(34,230,255,.4);border-radius:6px;padding:6px}
.cv-pause{position:absolute;inset:0;display:none;place-items:center;background:rgba(2,3,10,.62);z-index:4}.cv-pause.on{display:grid}
.cv-pause .box{display:flex;flex-direction:column;gap:10px;width:min(300px,86vw);padding:22px;text-align:center}.cv-pause h2{margin:0 0 6px;letter-spacing:.2em;font-size:1rem}
.cv-hud{position:absolute;inset:0;pointer-events:none;display:none}.cv-hud.on{display:block}
.cv-hud>*{position:absolute}
.cv-tl{left:16px;top:calc(env(safe-area-inset-top,0px) + 14px);padding:9px 14px;min-width:200px}
.cv-tl b{display:block;font-family:var(--font-head,Sora),system-ui;font-size:.9rem;letter-spacing:.06em}
.cv-tr{right:16px;top:calc(env(safe-area-inset-top,0px) + 14px);display:flex;gap:8px;pointer-events:auto}
.cv-speed{left:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);padding:10px 16px;min-width:210px}
.cv-speed .n{font-family:var(--font-head,Sora),system-ui;font-size:2.3rem;font-weight:700;line-height:1;color:#fff;text-shadow:0 0 14px #22e6ff}
.cv-speed .n small{font-size:.7rem;color:#7fb4d8;margin-left:6px;letter-spacing:.14em}
.cv-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden;margin:3px 0 7px}.cv-bar i{display:block;height:100%;background:linear-gradient(90deg,#22e6ff,#9b5cff);transition:width .15s}
.cv-bar.h i{background:linear-gradient(90deg,#ff3df0,#ffb347)}
.cv-mode{display:flex;justify-content:space-between;margin-bottom:6px}.cv-mode b{color:#22e6ff;letter-spacing:.14em}
.cv-comp{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 12px);padding:4px;border-radius:8px}.cv-comp canvas{display:block}
.cv-mm{right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);width:184px;height:184px;border-radius:50%;padding:3px;overflow:hidden}.cv-mm canvas{display:block;border-radius:50%}
.cv-wp{right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 212px);padding:6px 10px;display:none;font-size:.72rem}
.cv-prompt{left:50%;transform:translateX(-50%);bottom:24%;padding:10px 20px;display:none;text-align:center;border-color:rgba(255,61,240,.6)}
.cv-toast{left:50%;transform:translateX(-50%);top:16%;padding:9px 18px;display:none;text-align:center;max-width:90vw}
.cv-info{left:50%;transform:translateX(-50%);bottom:30%;padding:14px 18px;display:none;max-width:min(420px,90vw);border-color:rgba(255,61,240,.6);pointer-events:auto}
.cv-info b{font-family:var(--font-head,Sora),system-ui;letter-spacing:.08em}.cv-info p{margin:6px 0 0;color:#b9cce6}
.cv-dmg{inset:0;background:radial-gradient(circle,transparent 45%,rgba(255,30,60,.55));opacity:0;transition:opacity .25s}
.cv-map{position:absolute;inset:0;display:none;place-items:center;background:rgba(2,3,10,.82);z-index:5}.cv-map.on{display:grid}
.cv-map .box{padding:14px;display:flex;flex-direction:column;gap:10px;align-items:center}.cv-map canvas{width:min(78vh,92vw);height:min(78vh,92vw);cursor:crosshair;border-radius:8px}
.cv-touch{position:absolute;inset:0;pointer-events:none;display:none}.cv-touch.on{display:block}
.cv-touch>*{position:absolute;pointer-events:auto;touch-action:none}
.cv-joy{left:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);width:130px;height:130px;border-radius:50%;background:rgba(34,230,255,.08);border:1px solid rgba(34,230,255,.4)}
.cv-joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border-radius:50%;background:rgba(34,230,255,.45);border:1px solid #fff}
.cv-tb{width:62px;height:62px;border-radius:50%;border:1px solid rgba(34,230,255,.55);background:rgba(5,9,22,.62);display:grid;place-items:center;font-size:.64rem;letter-spacing:.08em;font-weight:700}
.cv-tb.on{background:rgba(34,230,255,.4)}
.cv-load{position:absolute;inset:0;display:grid;place-items:center;background:#02030a;z-index:9;text-align:center}
.cv-load .ld{width:200px;height:4px;background:rgba(34,230,255,.2);border-radius:4px;overflow:hidden;margin:14px auto 0}.cv-load .ld i{display:block;width:40%;height:100%;background:#22e6ff;animation:cvld 1.1s ease-in-out infinite}
@keyframes cvld{from{transform:translateX(-100%)}to{transform:translateX(260%)}}
@media(max-width:760px){.cv-mm{width:132px;height:132px}.cv-wp{bottom:calc(env(safe-area-inset-bottom,0px) + 160px)}.cv-speed{min-width:150px;bottom:auto;top:calc(env(safe-area-inset-top,0px) + 70px)}.cv-speed .n{font-size:1.6rem}.cv-tl{display:none}.cv-comp{top:calc(env(safe-area-inset-top,0px) + 60px)}.cv-menu{padding:0 6vw}}
`;

export interface HudState {
  kmh: number; energy: number; hull: number; mode: string; alt: number; showAlt: boolean; bearing: number; district: string; dcol: string; x: number; z: number; yaw: number;
  wp: { x: number; z: number } | null; route: [number, number][]; pois: POI[]; boost: boolean; found: number; total: number; cam: string; wpDist: number; nearby: string;
}
export interface TouchState { steer: number; gas: boolean; brake: boolean; up: boolean; down: boolean; boost: boolean; fly: boolean; cam: boolean; act: boolean; pause: boolean }
export interface UIOpts { logo: string; touch: boolean; settings: Settings; onEnter(): void; onResume(): void; onExit(): void; onSettings(s: Settings): void; onWaypoint(x: number, z: number): void; onClearWaypoint(): void; onPause(): void; onMap(): void; onCam(): void; onResetCam(): void; onSound(k: string): void }

export class UI {
  el: HTMLElement; gl: HTMLCanvasElement; touch: TouchState = { steer: 0, gas: false, brake: false, up: false, down: false, boost: false, fly: false, cam: false, act: false, pause: false };
  private q = (s: string) => this.el.querySelector(s) as HTMLElement; private mm!: CanvasRenderingContext2D; private comp!: CanvasRenderingContext2D; private map!: HTMLCanvasElement; private base: HTMLCanvasElement;
  private toastT = 0; mapOpen = false; private dmg = 0; private infoT = 0;
  constructor(parent: HTMLElement, private o: UIOpts) {
    if (!document.getElementById("cv-css")) { const s = document.createElement("style"); s.id = "cv-css"; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement("div"); this.el.className = "cv";
    this.el.innerHTML = `
<canvas class="cv-gl"></canvas>
<div class="cv-load"><div><div class="t">NEURON INTELLIGENCE</div><h2 style="font-family:var(--font-head,Sora),system-ui;letter-spacing:.1em">NEURON: CYBERVERSE</h2><div class="ld"><i></i></div></div></div>
<div class="cv-menu"><div class="t" style="margin-bottom:10px;display:flex;align-items:center;gap:8px"><img src="${o.logo}" height="22" alt="">NEURON INTELLIGENCE PRESENTS</div><h1>NEURON<span>CYBERVERSE</span></h1><p>Drive the streets of Nexus City, transform your vehicle and take off between the neon towers. Humans, robots and AI traffic share a living city.</p>
<div class="row"><button class="b p" data-a="enter">Enter city</button><button class="b" data-a="controls">Controls</button><button class="b" data-a="settings">Settings</button><button class="b" data-a="exit">Return to website</button></div>
<div class="foot">DESKTOP: WASD + C TO FLY &nbsp;|&nbsp; MOBILE: TOUCH CONTROLS</div></div>
<div class="cv-hud">
  <div class="cv-dmg"></div>
  <div class="cv-tl g"><div class="t">NEURON: CYBERVERSE</div><b class="dn">Downtown Core</b><div class="t" style="margin-top:4px" id="cvFound"></div></div>
  <div class="cv-comp g"><canvas width="300" height="30"></canvas></div>
  <div class="cv-tr"><button class="ic" data-a="cam" title="Camera (V)">CAM</button><button class="ic" data-a="rcam" title="Reset camera (R)">RST</button><button class="ic" data-a="map" title="Map (M)">MAP</button><button class="ic" data-a="pause" title="Pause (Esc)">II</button></div>
  <div class="cv-speed g"><div class="cv-mode"><span class="t">MODE</span><b class="md">DRIVE</b></div><div class="n"><span class="sp">0</span><small>KM/H</small></div><div class="t" style="margin-top:6px">BOOST ENERGY</div><div class="cv-bar e"><i></i></div><div class="t">VEHICLE CONDITION</div><div class="cv-bar h"><i></i></div><div class="t al" style="display:none"></div><div class="t cm"></div></div>
  <div class="cv-wp g"></div>
  <div class="cv-mm g"><canvas width="178" height="178"></canvas></div>
  <div class="cv-prompt g"></div><div class="cv-toast g"></div><div class="cv-info g"></div>
</div>
<div class="cv-touch">
  <div class="cv-joy"><i></i></div>
  <button class="cv-tb" style="right:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 100px)" data-h="gas">GAS</button>
  <button class="cv-tb" style="right:96px;bottom:calc(env(safe-area-inset-bottom,0px) + 30px)" data-h="brake">BRAKE</button>
  <button class="cv-tb" style="right:22px;bottom:calc(env(safe-area-inset-bottom,0px) + 172px)" data-h="boost">BOOST</button>
  <button class="cv-tb" style="right:96px;bottom:calc(env(safe-area-inset-bottom,0px) + 110px)" data-p="fly">FLY</button>
  <button class="cv-tb" style="right:170px;bottom:calc(env(safe-area-inset-bottom,0px) + 40px)" data-h="up">UP</button>
  <button class="cv-tb" style="right:170px;bottom:calc(env(safe-area-inset-bottom,0px) + 112px)" data-h="down">DOWN</button>
  <button class="cv-tb" style="left:166px;bottom:calc(env(safe-area-inset-bottom,0px) + 30px);width:54px;height:54px" data-p="act">F</button>
  <button class="cv-tb" style="left:166px;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);width:54px;height:54px" data-p="cam">CAM</button>
</div>
<div class="cv-pause"><div class="box g"><h2>PAUSED</h2><button class="b p" data-a="resume">Resume</button><button class="b" data-a="map">Map</button><button class="b" data-a="controls">Controls</button><button class="b" data-a="settings">Settings</button><button class="b" data-a="exit">Return to Neuron Intelligence</button></div></div>
<div class="cv-map"><div class="box g"><div class="t">CITY MAP: TAP OR CLICK TO SET A WAYPOINT</div><canvas width="640" height="640"></canvas><div style="display:flex;gap:10px"><button class="b" data-a="clearwp">Clear waypoint</button><button class="b" data-a="closemap">Close map</button></div></div></div>
<div class="cv-modal" id="cvControls"><div class="box g"><h2>Controls</h2><table>
<tr><td>W / Up</td><td>Accelerate / fly forward</td></tr><tr><td>S / Down</td><td>Brake, reverse / fly backward</td></tr><tr><td>A D / Left Right</td><td>Steer left, right / turn in flight</td></tr>
<tr><td>Space</td><td>Handbrake drift / ascend in flight</td></tr><tr><td>X</td><td>Descend (flight)</td></tr><tr><td>Q / E</td><td>Strafe left / right (flight)</td></tr><tr><td>Left Shift</td><td>Boost</td></tr><tr><td>C</td><td>Transform: drive / fly (press again to land)</td></tr>
<tr><td>F</td><td>Interact (charge, repair, terminals, discoveries)</td></tr><tr><td>V</td><td>Camera view: chase / far / cockpit</td></tr><tr><td>R</td><td>Reset camera (drag the mouse to orbit)</td></tr><tr><td>M</td><td>Map and waypoints</td></tr><tr><td>Esc</td><td>Pause</td></tr></table>
<div style="margin-top:16px;text-align:right"><button class="b p" data-a="close">Close</button></div></div></div>
<div class="cv-modal" id="cvSettings"><div class="box g"><h2>Settings</h2><div class="cv-set">
<label>Graphics preset</label><select id="sPreset"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="custom">Custom</option></select>
<label>Bloom</label><input type="checkbox" id="sBloom"><label>Shadow quality</label><select id="sShadow"><option value="0">Off</option><option value="1">Medium</option><option value="2">High</option></select>
<label>Render resolution</label><input type="range" id="sPR" min="0.75" max="2" step="0.05"><label>Particle density</label><input type="range" id="sPart" min="0.1" max="1" step="0.05">
<label>View distance</label><input type="range" id="sView" min="180" max="700" step="20"><label>Crowd and traffic</label><input type="range" id="sNpc" min="0.2" max="1" step="0.05">
<label>Weather</label><select id="sWeather"><option value="off">Clear</option><option value="rain">Light rain</option><option value="storm">Storm</option></select>
<label>Master volume</label><input type="range" id="sMaster" min="0" max="1" step="0.05"><label>Music volume</label><input type="range" id="sMusic" min="0" max="1" step="0.05"><label>Effects volume</label><input type="range" id="sSfx" min="0" max="1" step="0.05"></div>
<div style="margin-top:16px;text-align:right"><button class="b p" data-a="close">Close</button></div></div></div>`;
    parent.appendChild(this.el); this.gl = this.el.querySelector("canvas.cv-gl") as HTMLCanvasElement;
    this.mm = (this.el.querySelector(".cv-mm canvas") as HTMLCanvasElement).getContext("2d")!; this.comp = (this.el.querySelector(".cv-comp canvas") as HTMLCanvasElement).getContext("2d")!; this.map = this.el.querySelector(".cv-map canvas") as HTMLCanvasElement;
    this.base = this.makeBase(); this.wire(); this.syncSettings(o.settings);
  }
  private makeBase() {
    const c = document.createElement("canvas"); c.width = c.height = 700; const g = c.getContext("2d")!; g.fillStyle = "#04060f"; g.fillRect(0, 0, 700, 700); g.translate(350, 350);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { g.fillStyle = DCOL[districtOf(i, j)] + "33"; g.fillRect(blockAt(i) - BLOCK / 2, blockAt(j) - BLOCK / 2, BLOCK, BLOCK); }
    g.fillStyle = "#1c2a4a"; for (let k = 0; k <= N; k++) { g.fillRect(roadAt(k) - ROAD / 2, -HALF, ROAD, HALF * 2); g.fillRect(-HALF, roadAt(k) - ROAD / 2, HALF * 2, ROAD); }
    g.strokeStyle = "#22e6ff55"; g.lineWidth = 1; g.strokeRect(-HALF, -HALF, HALF * 2, HALF * 2); return c;
  }
  private syncSettings(s: Settings) {
    const set = (id: string, v: string | number | boolean) => { const e = this.q("#" + id) as HTMLInputElement; if (typeof v === "boolean") e.checked = v; else e.value = String(v); };
    set("sPreset", s.preset); set("sBloom", s.bloom); set("sShadow", s.shadows); set("sPR", s.pixelRatio); set("sPart", s.particles); set("sView", s.viewDist); set("sNpc", s.npc); set("sWeather", s.weather); set("sMaster", s.master); set("sMusic", s.music); set("sSfx", s.sfx);
  }
  private readSettings(fromPreset: boolean): Settings {
    const v = (id: string) => (this.q("#" + id) as HTMLInputElement).value, b = (id: string) => (this.q("#" + id) as HTMLInputElement).checked;
    let s: Settings = { ...this.o.settings, bloom: b("sBloom"), shadows: Number(v("sShadow")) as 0 | 1 | 2, pixelRatio: Number(v("sPR")), particles: Number(v("sPart")), viewDist: Number(v("sView")), npc: Number(v("sNpc")), weather: v("sWeather") as Settings["weather"], master: Number(v("sMaster")), music: Number(v("sMusic")), sfx: Number(v("sSfx")), preset: v("sPreset") as Settings["preset"] };
    if (fromPreset && s.preset !== "custom") s = { ...s, ...PRESETS[s.preset as Preset], pixelRatio: Math.min(PRESETS[s.preset as Preset].pixelRatio ?? 1, Math.max(1, window.devicePixelRatio || 1) * (s.preset === "high" ? 1.25 : 1)) };
    else if (!fromPreset) s.preset = "custom";
    return s;
  }
  private wire() {
    const act = (a: string) => {
      this.o.onSound("click");
      if (a === "enter") this.o.onEnter(); else if (a === "exit") this.o.onExit(); else if (a === "resume") this.o.onResume(); else if (a === "controls") this.q("#cvControls").classList.add("on");
      else if (a === "settings") this.q("#cvSettings").classList.add("on"); else if (a === "close") { this.q("#cvControls").classList.remove("on"); this.q("#cvSettings").classList.remove("on"); }
      else if (a === "pause") this.o.onPause(); else if (a === "map") this.o.onMap(); else if (a === "cam") this.o.onCam(); else if (a === "rcam") this.o.onResetCam();
      else if (a === "closemap") this.o.onMap(); else if (a === "clearwp") this.o.onClearWaypoint();
    };
    this.el.addEventListener("click", (e) => { const t = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null; if (t) act(t.dataset.a!); });
    const apply = (fp: boolean) => { const s = this.readSettings(fp); this.o.settings = s; this.syncSettings(s); this.o.onSettings(s); };
    this.q("#sPreset").addEventListener("change", () => apply(true));
    for (const id of ["sBloom", "sShadow", "sPR", "sPart", "sView", "sNpc", "sWeather"]) this.q("#" + id).addEventListener("input", () => apply(false));
    for (const id of ["sMaster", "sMusic", "sSfx"]) this.q("#" + id).addEventListener("input", () => { const s = this.readSettings(false); s.preset = this.o.settings.preset; this.o.settings = s; this.o.onSettings(s); });
    this.map.addEventListener("pointerdown", (e) => { const r = this.map.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 700 - 350, z = ((e.clientY - r.top) / r.height) * 700 - 350; this.o.onWaypoint(x, z); });
    const jb = this.q(".cv-joy"), js = jb.querySelector("i") as HTMLElement; let jid = -1;
    const jm = (e: PointerEvent) => { if (e.pointerId !== jid) return; const r = jb.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } js.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; this.touch.steer = -dx; };
    jb.addEventListener("pointerdown", (e) => { jid = e.pointerId; jb.setPointerCapture(e.pointerId); jm(e); }); jb.addEventListener("pointermove", jm);
    const je = (e: PointerEvent) => { if (e.pointerId === jid) { jid = -1; js.style.transform = ""; this.touch.steer = 0; } }; jb.addEventListener("pointerup", je); jb.addEventListener("pointercancel", je);
    this.el.querySelectorAll<HTMLElement>(".cv-tb").forEach((b) => {
      const h = b.dataset.h as keyof TouchState | undefined, p = b.dataset.p as keyof TouchState | undefined;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add("on"); if (h) (this.touch[h] as boolean) = true; if (p) (this.touch[p] as boolean) = true; });
      const up = () => { b.classList.remove("on"); if (h) (this.touch[h] as boolean) = false; }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    });
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  ready() { this.q(".cv-load").style.display = "none"; }
  setMenu(on: boolean) { this.q(".cv-menu").style.display = on ? "flex" : "none"; }
  setHud(on: boolean) { this.q(".cv-hud").classList.toggle("on", on); this.q(".cv-touch").classList.toggle("on", on && this.o.touch); }
  setPause(on: boolean) { this.q(".cv-pause").classList.toggle("on", on); if (!on) { this.q("#cvControls").classList.remove("on"); this.q("#cvSettings").classList.remove("on"); } }
  setMap(on: boolean) { this.mapOpen = on; this.q(".cv-map").classList.toggle("on", on); }
  modalOpen() { return this.q("#cvControls").classList.contains("on") || this.q("#cvSettings").classList.contains("on"); }
  closeModals() { this.q("#cvControls").classList.remove("on"); this.q("#cvSettings").classList.remove("on"); }
  fatal(msg: string) { this.q(".cv-load").style.display = "grid"; this.q(".cv-load").innerHTML = `<div><div class="t">NEURON: CYBERVERSE</div><p style="max-width:34ch">${msg}</p><button class="b p" data-a="exit">Return to website</button></div>`; }
  toast(m: string, s = 2.6) { const t = this.q(".cv-toast"); t.textContent = m; t.style.display = "block"; this.toastT = s; }
  prompt(m: string | null) { const p = this.q(".cv-prompt"); if (m) { p.textContent = m; p.style.display = "block"; } else p.style.display = "none"; }
  info(p: { name: string; desc: string } | null, secs = 7) { const i = this.q(".cv-info"); if (!p) { i.style.display = "none"; return; } i.innerHTML = `<div class="t">DISCOVERY LOG</div><b>${p.name}</b><p>${p.desc}</p>`; i.style.display = "block"; this.infoT = secs; }
  damage() { this.dmg = 1; }
  tick(dt: number) {
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.q(".cv-toast").style.display = "none";
    if (this.infoT > 0 && (this.infoT -= dt) <= 0) this.q(".cv-info").style.display = "none";
    if (this.dmg > 0) { this.dmg = Math.max(0, this.dmg - dt * 2); this.q(".cv-dmg").style.opacity = String(this.dmg); }
  }

  hud(s: HudState) {
    const q = this.q.bind(this);
    q(".sp").textContent = String(Math.round(s.kmh)); q(".e i").style.width = s.energy + "%"; q(".h i").style.width = s.hull + "%";
    q(".md").textContent = s.mode; const dn = q(".dn"); dn.textContent = s.district; dn.style.color = s.dcol; const al = q(".al"); al.style.display = s.showAlt ? "block" : "none"; al.textContent = `ALTITUDE ${Math.round(s.alt)} M`;
    q(".cm").textContent = `CAMERA: ${s.cam}`; q("#cvFound").textContent = `DISCOVERIES ${s.found}/${s.total}${s.nearby ? " | " + s.nearby : ""}`;
    const wp = q(".cv-wp"); if (s.wp) { wp.style.display = "block"; wp.textContent = `WAYPOINT ${Math.round(s.wpDist)} M`; } else wp.style.display = "none";
    this.drawCompass(s); this.drawMini(s); if (this.mapOpen) this.drawMap(s);
  }
  private drawCompass(s: HudState) {
    const g = this.comp, W = 300, H = 30; g.clearRect(0, 0, W, H); g.font = "600 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const px = (b: number) => W / 2 + ((((b - s.bearing + 540) % 360) - 180) / 110) * (W / 2);
    for (let d = 0; d < 360; d += 15) { const x = px(d); if (x < 6 || x > W - 6) continue; const card = d % 90 === 0; g.strokeStyle = card ? "#22e6ff" : "rgba(34,230,255,.45)"; g.beginPath(); g.moveTo(x, card ? 17 : 21); g.lineTo(x, 27); g.stroke(); if (card) { g.fillStyle = d === 0 ? "#ff6a6a" : "#dfe8ff"; g.fillText(["N", "E", "S", "W"][d / 90], x, 9); } }
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(W / 2 - 4, 0); g.lineTo(W / 2 + 4, 0); g.lineTo(W / 2, 6); g.fill();
    if (s.wp) { const b = ((Math.atan2(s.wp.x - s.x, -(s.wp.z - s.z)) * 180) / Math.PI + 360) % 360, x = Math.max(8, Math.min(W - 8, px(b))); g.fillStyle = "#ff3df0"; g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 5, 18); g.lineTo(x, 24); g.lineTo(x - 5, 18); g.fill(); }
  }
  private drawMini(s: HudState) {
    const g = this.mm, S = 178, sc = 0.62, t = performance.now() / 1000; g.save(); g.clearRect(0, 0, S, S); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip(); g.fillStyle = "#04060f"; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2); g.rotate(s.yaw + Math.PI); g.scale(sc, sc); g.translate(-s.x, -s.z); g.drawImage(this.base, -350, -350);
    if (s.route.length > 1) { g.strokeStyle = "#ff3df0"; g.lineWidth = 3 / sc; g.beginPath(); s.route.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    for (const p of s.pois) { if (Math.abs(p.x - s.x) > 170 || Math.abs(p.z - s.z) > 170) continue; g.fillStyle = POI_COLOR[p.type]; g.beginPath(); g.arc(p.x, p.z, (p.type === "landmark" ? 5 : 3.2) / sc, 0, 7); g.fill(); }
    if (s.wp) { g.strokeStyle = "#ff3df0"; g.lineWidth = 2 / sc; g.beginPath(); g.arc(s.wp.x, s.wp.z, 8 / sc, 0, 7); g.stroke(); }
    g.restore();
    g.save(); g.translate(S / 2, S / 2); g.rotate(t * 1.6); const gr = g.createConicGradient(0, 0, 0); gr.addColorStop(0, "rgba(34,230,255,.32)"); gr.addColorStop(0.16, "rgba(34,230,255,0)"); gr.addColorStop(1, "rgba(34,230,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S / 2, 0, 7); g.fill(); g.restore();
    g.save(); g.translate(S / 2, S / 2); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.fill(); g.restore();
    g.strokeStyle = "rgba(34,230,255,.7)"; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, 7); g.stroke();
    const th = s.yaw + Math.PI, R = S / 2 - 11; g.fillStyle = "#ff6a6a"; g.font = "700 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("N", S / 2 + Math.sin(th) * R, S / 2 - Math.cos(th) * R);
  }
  private drawMap(s: HudState) {
    const g = this.map.getContext("2d")!; g.clearRect(0, 0, 640, 640); g.drawImage(this.base, 0, 0, 640, 640); g.save(); g.scale(640 / 700, 640 / 700); g.translate(350, 350);
    g.font = "600 14px sans-serif"; g.textAlign = "center";
    const names: [string, number, number][] = [["DOWNTOWN", 0, 40], ["NEON MARKET", -255, -5], ["SKY DISTRICT", 220, -220], ["INDUSTRIAL", 220, 140], ["GREEN PARK", 0, 220], ["RESIDENTIAL", -200, 200]];
    g.fillStyle = "#dfe8ff99"; for (const [t, x, z] of names) g.fillText(t, x, z);
    if (s.route.length > 1) { g.strokeStyle = "#ff3df0"; g.lineWidth = 4; g.beginPath(); s.route.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    for (const p of s.pois) { g.fillStyle = POI_COLOR[p.type]; g.beginPath(); g.arc(p.x, p.z, p.type === "landmark" ? 7 : 4.5, 0, 7); g.fill(); if (p.type === "landmark" || p.type === "viewpoint") { g.fillStyle = "#fff"; g.font = "11px sans-serif"; g.fillText(p.name, p.x, p.z - 10); } }
    if (s.wp) { g.strokeStyle = "#ff3df0"; g.lineWidth = 3; g.beginPath(); g.arc(s.wp.x, s.wp.z, 11, 0, 7); g.stroke(); }
    g.translate(s.x, s.z); g.rotate(-s.yaw + Math.PI); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.fill(); g.restore();
  }
  dispose() { this.el.remove(); }
}
