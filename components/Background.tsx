"use client";
import { useEffect } from "react";

type St = { x: number; y: number; z: number; o: number };
type Pt = { tx: number; ty: number; sx: number; sy: number; vx: number; vy: number; k: number; r: number; o: number; dl: number };

export default function Background() {
  useEffect(() => {
    const c = document.getElementById("bg") as HTMLCanvasElement | null;
    const ht = document.getElementById("ht") as HTMLCanvasElement | null;
    const hero = document.getElementById("hero");
    if (!c || !ht || !hero) return;
    const x = c.getContext("2d")!, hx = ht.getContext("2d")!, root = document.documentElement;
    const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, S: St[] = [], P: Pt[] = [], v = 0, ly = scrollY, hp = 0, t0 = 0, raf = 0, ready = false;
    let run = !document.hidden, sc = "236,226,255", fam = "system-ui,sans-serif";
    const col = () => { sc = getComputedStyle(root).getPropertyValue("--star").trim() || sc; if (rm) { frame(0); heroFrame(t0 + 9999); } };

    function build() {
      const d = Math.min(devicePixelRatio || 1, 2);
      ht!.width = W * d; ht!.height = H * d; hx.setTransform(d, 0, 0, d, 0, 0);
      const fs = Math.min(W * 0.11, 150), o = document.createElement("canvas");
      o.width = W; o.height = H;
      const g = o.getContext("2d")!;
      g.fillStyle = "#fff"; g.font = `700 ${fs}px ${fam}`; g.textAlign = "center"; g.textBaseline = "middle";
      const cy = H * 0.34;
      g.fillText("Neuron", W / 2, cy - fs * 0.58); g.fillText("Intelligence", W / 2, cy + fs * 0.58);
      const st = Math.max(2, Math.round(fs / 34)), im = g.getImageData(0, 0, W, H).data;
      P = [];
      for (let y = 0; y < H; y += st) for (let q = 0; q < W; q += st) if (im[(y * W + q) * 4 + 3] > 128) {
        const a = Math.random() * 6.283;
        P.push({ tx: q, ty: y, sx: Math.random() * W, sy: Math.random() * H, vx: Math.cos(a), vy: Math.sin(a), k: 0.35 + Math.random() * 1.1, r: 0.8 + Math.random() * 1.1, o: Math.random() * 6.28, dl: Math.random() });
      }
      if (P.length > 12000) { const k = 12000 / P.length; P = P.filter(() => Math.random() < k); }
      t0 = performance.now();
      if (rm) heroFrame(t0 + 9999);
    }
    function size() {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight; c!.width = W * d; c!.height = H * d; x.setTransform(d, 0, 0, d, 0, 0);
      S = Array.from({ length: W < 700 ? 140 : 300 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.15 + Math.random() * 0.85, o: Math.random() * 6.28 }));
      if (ready) build();
      if (rm) frame(0);
    }
    function frame(n: number) {
      x.clearRect(0, 0, W, H); x.lineCap = "round";
      for (const s of S) {
        s.y += 0.14 * s.z + v * s.z * 4.5; s.x -= 0.05 * s.z + v * s.z * 1.6;
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
        if (s.x < -4) s.x = W + 4;
        x.strokeStyle = `rgba(${sc},${(0.3 + 0.7 * s.z) * (0.65 + 0.35 * Math.sin(n * 0.002 + s.o))})`;
        x.lineWidth = s.z * 1.7 + 0.3; x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x + v * s.z * 3 + 0.01, s.y - v * s.z * 9 - 0.01); x.stroke();
      }
    }
    function heroFrame(n: number) {
      hx.clearRect(0, 0, W, H);
      if (hp >= 1 || !P.length) return;
      const e = Math.min(1, (n - t0) / 2800), sp = Math.pow(hp, 1.3) * Math.max(W, H) * 0.75;
      hx.fillStyle = `rgb(${sc})`;
      for (const p of P) {
        let q = Math.max(0, Math.min(1, e * 1.4 - p.dl * 0.4)); q = 1 - Math.pow(1 - q, 3);
        hx.globalAlpha = Math.max(0, (1 - hp * 1.15) * (0.45 + 0.55 * q) * (0.65 + 0.35 * Math.sin(n * 0.003 + p.o)));
        hx.fillRect(p.sx + (p.tx - p.sx) * q + p.vx * p.k * sp, p.sy + (p.ty - p.sy) * q + p.vy * p.k * sp, p.r, p.r);
      }
      hx.globalAlpha = 1;
    }
    function prog() {
      const r = hero!.getBoundingClientRect();
      hp = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      hero!.style.setProperty("--p", hp.toFixed(3));
      if (rm) heroFrame(t0 + 9999);
    }
    function loop(n: number) {
      if (run && !root.dataset.game) { const dy = Math.abs(scrollY - ly); ly = scrollY; v += (Math.min(dy, 90) / 9 - v) * 0.1; frame(n); heroFrame(n); }
      raf = requestAnimationFrame(loop);
    }
    const vis = () => { run = !document.hidden; };
    const mq = matchMedia("(prefers-color-scheme: light)"), mo = new MutationObserver(col);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", col);
    addEventListener("resize", size); addEventListener("scroll", prog, { passive: true }); document.addEventListener("visibilitychange", vis);
    col(); size(); prog();
    if (!rm) raf = requestAnimationFrame(loop);
    fam = getComputedStyle(document.body).getPropertyValue("--font-head") || fam;
    Promise.race([document.fonts.load(`700 100px ${fam}`), new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(() => { ready = true; build(); });
    return () => {
      cancelAnimationFrame(raf); mo.disconnect(); mq.removeEventListener("change", col);
      removeEventListener("resize", size); removeEventListener("scroll", prog); document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return <canvas id="bg" aria-hidden="true" />;
}
