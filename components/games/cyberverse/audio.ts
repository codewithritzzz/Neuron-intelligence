// Fully synthesized audio (no files): engine, flight, boost, road, rain, city ambience, thunder, UI and a soft generative score.
export class Sound {
  ctx?: AudioContext; master?: GainNode; musicBus?: GainNode; sfxBus?: GainNode;
  private eng?: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode };
  private fly?: { g: GainNode; f: BiquadFilterNode }; private road?: { g: GainNode; f: BiquadFilterNode }; private boost?: { g: GainNode }; private rain?: { g: GainNode }; private amb?: { g: GainNode };
  private noise?: AudioBuffer; private tm = 0; vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  private notes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; private timer = 0; private chord = 0;

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext, c = new AC(); this.ctx = c;
      this.master = c.createGain(); this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.musicBus.connect(this.master); this.sfxBus.connect(this.master); this.master.connect(c.destination); this.setVol(this.vol);
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
      const loopNoise = (type: BiquadFilterType, freq: number, q = 0.7) => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxBus!); s.start(); return { g, f }; };
      const o1 = c.createOscillator(), o2 = c.createOscillator(), eg = c.createGain(), ef = c.createBiquadFilter(); o1.type = "sawtooth"; o2.type = "square"; ef.type = "lowpass"; ef.frequency.value = 400; eg.gain.value = 0;
      o1.connect(ef); o2.connect(ef); ef.connect(eg); eg.connect(this.sfxBus); o1.start(); o2.start(); this.eng = { o1, o2, g: eg, f: ef };
      this.fly = loopNoise("bandpass", 500, 0.8); this.road = loopNoise("bandpass", 300, 0.6); this.rain = loopNoise("highpass", 2200); this.amb = loopNoise("lowpass", 180);
      const bs = c.createBufferSource(); bs.buffer = b; bs.loop = true; const bf = c.createBiquadFilter(); bf.type = "highpass"; bf.frequency.value = 900; const bg = c.createGain(); bg.gain.value = 0; bs.connect(bf); bf.connect(bg); bg.connect(this.sfxBus); bs.start(); this.boost = { g: bg };
    } catch { /* audio unavailable */ }
  }
  setVol(v: { master: number; music: number; sfx: number }) { this.vol = v; if (this.master) { this.master.gain.value = v.master; this.musicBus!.gain.value = v.music * 0.5; this.sfxBus!.gain.value = v.sfx; } }
  suspend() { this.ctx?.suspend(); } resume() { this.ctx?.resume(); }
  private set(p: AudioParam | undefined, v: number) { if (p && this.ctx) p.setTargetAtTime(v, this.ctx.currentTime, 0.08); }

  update(dt: number, s: { speed: number; max: number; throttle: number; fly: boolean; boost: boolean; drift: boolean; rain: number; paused: boolean; menu: boolean; tf: number; robot: number }) {
    if (!this.ctx) return; const f = Math.min(1, s.speed / s.max);
    this.set(this.eng?.g.gain, s.paused ? 0 : (s.fly ? 0.025 : 0.035) + 0.08 * Math.abs(s.throttle) * (1 - 0.4 * s.tf));
    this.set(this.eng?.o1.frequency, (s.fly ? 70 : 52) + f * (s.fly ? 110 : 190) + (s.boost ? 50 : 0)); this.set(this.eng?.o2.frequency, ((s.fly ? 70 : 52) + f * (s.fly ? 110 : 190)) * 1.005);
    this.set(this.eng?.f.frequency, 260 + f * 900);
    this.set(this.fly?.g.gain, s.paused ? 0 : s.fly || s.tf > 0.3 ? 0.05 + f * 0.22 + s.tf * 0.05 : 0); this.set(this.fly?.f.frequency, 400 + f * 1200);
    this.set(this.road?.g.gain, s.paused || s.fly ? 0 : f * 0.1 + (s.drift ? 0.12 : 0)); this.set(this.boost?.g.gain, s.paused ? 0 : s.boost ? 0.12 : 0);
    this.set(this.rain?.g.gain, s.paused ? 0 : s.rain * 0.05); this.set(this.amb?.g.gain, s.paused ? 0.02 : 0.12 + (s.menu ? 0.05 : 0));
    this.timer -= dt; this.tm -= dt;
    if (this.tm <= 0 && s.robot < 24 && !s.paused) { this.tm = 1 + Math.random() * 2; this.tone(900 + Math.random() * 500, 0.06, "square", 0.015, 1.3); }
    if (this.timer <= 0) this.music();
  }
  private music() {
    const c = this.ctx!, t0 = c.currentTime; this.timer = 0.5 + Math.random() * 0.7;
    if (Math.random() < 0.18) this.chord = (this.chord + 1) % 4;
    const root = [110, 98, 130.81, 116.54][this.chord];
    if (Math.random() < 0.3) for (const k of [1, 1.5, 2]) this.padTone(root * k, 3.2);
    if (Math.random() < 0.7) { const n = this.notes[Math.floor(Math.random() * this.notes.length)], o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = n; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.6); o.connect(g); g.connect(this.musicBus!); o.start(t0); o.stop(t0 + 1.7); }
  }
  private padTone(f: number, d: number) {
    const c = this.ctx!, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 1.2); g.gain.linearRampToValueAtTime(0, t + d); o.connect(lp); lp.connect(g); g.connect(this.musicBus!); o.start(t); o.stop(t + d + 0.1);
  }
  tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.1, slide = 1) {
    const c = this.ctx; if (!c || !this.sfxBus) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  private burst(dur: number, freq: number, vol: number, type: BiquadFilterType = "lowpass", sweep = 1) {
    const c = this.ctx; if (!c || !this.noise || !this.sfxBus) return; const t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }
  play(k: string) {
    switch (k) {
      case "ui": this.tone(660, 0.07, "sine", 0.08, 1.4); break;
      case "click": this.tone(440, 0.05, "square", 0.05, 0.8); break;
      case "transform": this.burst(1.6, 300, 0.25, "bandpass", 8); this.tone(180, 1.4, "sawtooth", 0.07, 4); break;
      case "hit": this.burst(0.35, 600, 0.5, "lowpass", 0.2); this.tone(90, 0.3, "square", 0.12, 0.5); break;
      case "charge": this.tone(500, 0.5, "sine", 0.1, 3); this.tone(750, 0.5, "triangle", 0.06, 3); break;
      case "repair": this.tone(300, 0.15, "square", 0.07, 1.5); setTimeout(() => this.tone(450, 0.2, "square", 0.07, 1.5), 130); break;
      case "found": this.tone(523, 0.12, "sine", 0.09); setTimeout(() => this.tone(784, 0.25, "sine", 0.09), 110); break;
      case "thunder": this.burst(2.4, 220, 0.6, "lowpass", 0.25); break;
      case "pause": this.tone(300, 0.12, "sine", 0.08, 0.6); break;
    }
  }
  dispose() { try { this.ctx?.close(); } catch { /* ignore */ } this.ctx = undefined; }
}
