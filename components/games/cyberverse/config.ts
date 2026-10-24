// World layout, districts, settings and small math helpers for NEURON: CYBERVERSE.
export const N = 7, PITCH = 88, ROAD = 18, BLOCK = 70;
export const X0 = -(N * PITCH) / 2;
export const roadAt = (k: number) => X0 + k * PITCH;
export const blockAt = (i: number) => X0 + (i + 0.5) * PITCH;
export const HALF = (N * PITCH) / 2 + ROAD / 2;

export type DistrictId = "downtown" | "market" | "residential" | "industrial" | "sky" | "park";
export const DNAME: Record<DistrictId, string> = { downtown: "Downtown Core", market: "Neon Market", residential: "Residential District", industrial: "Industrial Zone", sky: "Sky District", park: "Green Future Park" };
export const DCOL: Record<DistrictId, string> = { downtown: "#22e6ff", market: "#ff3df0", residential: "#9b5cff", industrial: "#ffb347", sky: "#7aa8ff", park: "#3dffb0" };
export function districtOf(i: number, j: number): DistrictId {
  if (i >= 5 && j <= 2) return "sky";
  if (i >= 5) return "industrial";
  if (i <= 1 && j >= 1 && j <= 3) return "market";
  if (i >= 3 && i <= 4 && j >= 5) return "park";
  if (i >= 2 && i <= 4 && j <= 4) return "downtown";
  return "residential";
}
export const blockIndex = (v: number) => Math.max(0, Math.min(N - 1, Math.floor((v - X0) / PITCH)));
export const districtAt = (x: number, z: number) => districtOf(blockIndex(x), blockIndex(z));

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const damp = (cur: number, target: number, k: number, dt: number) => lerp(cur, target, 1 - Math.exp(-k * dt));
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Preset = "low" | "medium" | "high";
export interface Settings {
  preset: Preset | "custom"; bloom: boolean; shadows: 0 | 1 | 2; pixelRatio: number; particles: number; viewDist: number; npc: number;
  weather: "off" | "rain" | "storm"; master: number; music: number; sfx: number;
}
export const PRESETS: Record<Preset, Partial<Settings>> = {
  low: { bloom: false, shadows: 0, pixelRatio: 1, particles: 0.35, viewDist: 260, npc: 0.4 },
  medium: { bloom: true, shadows: 1, pixelRatio: 1.25, particles: 0.7, viewDist: 420, npc: 0.7 },
  high: { bloom: true, shadows: 2, pixelRatio: 2, particles: 1, viewDist: 650, npc: 1 },
};
export const DEFAULTS: Settings = { preset: "medium", bloom: true, shadows: 1, pixelRatio: 1.25, particles: 0.7, viewDist: 420, npc: 0.7, weather: "rain", master: 0.8, music: 0.5, sfx: 0.8 };
const KEY = "neuron-cyberverse-settings";
export function loadSettings(): Settings {
  try { const s = localStorage.getItem(KEY); if (s) return { ...DEFAULTS, ...JSON.parse(s) }; } catch {}
  return { ...DEFAULTS };
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

// Traffic signals: v = vertical roads (running along z), h = horizontal roads (running along x)
export type Lamp = "g" | "y" | "r";
export function lightState(ii: number, jj: number, t: number): { v: Lamp; h: Lamp } {
  const p = (t + ((ii * 7 + jj * 13) % 21)) % 21;
  if (p < 8) return { v: "g", h: "r" };
  if (p < 9.5) return { v: "y", h: "r" };
  if (p < 10.5) return { v: "r", h: "r" };
  if (p < 18.5) return { v: "r", h: "g" };
  if (p < 20) return { v: "r", h: "y" };
  return { v: "r", h: "r" };
}
export function onRoad(x: number, z: number) {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return false;
  const dx = Math.abs(((x - X0) % PITCH + PITCH) % PITCH), dz = Math.abs(((z - X0) % PITCH + PITCH) % PITCH);
  return Math.min(dx, PITCH - dx) < ROAD / 2 || Math.min(dz, PITCH - dz) < ROAD / 2;
}
