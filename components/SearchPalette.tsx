"use client";
import { useEffect, useRef, useState } from "react";
type Item = { title: string; url?: string; source: string; tag?: string; meta?: string };
export default function SearchPalette() {
  const [open, setOpen] = useState(false), [q, setQ] = useState(""), [r, setR] = useState<Item[]>([]), [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setR([]); return; }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const d = await (await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })).json();
        setR([...d.local, ...d.web]);
      } catch {}
      setBusy(false);
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  return (
    <>
      <button className="ib" onClick={() => setOpen(true)} aria-label="Search (Ctrl+K)">Search</button>
      <div className={`ov pal${open ? " on" : ""}`} onClick={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-label="Search">
        <div className="pb">
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news, tools, robots, models and the web" aria-label="Search" />
          {r.map((i, n) => (
            <a key={n} href={i.url} target="_blank" rel="noopener noreferrer"><span>{i.title}</span><small>{i.tag ?? i.source}</small></a>
          ))}
          {q.trim().length >= 2 && !busy && !r.length && <div className="r"><small>No matches</small></div>}
        </div>
      </div>
    </>
  );
}
