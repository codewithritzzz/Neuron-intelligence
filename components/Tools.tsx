"use client";
import { useState } from "react";
type T = { name: string; category: string; url: string };
export default function Tools({ tools }: { tools: T[] }) {
  const cats = ["All", ...Array.from(new Set(tools.map((t) => t.category)))];
  const [c, setC] = useState("All");
  return (
    <>
      <div className="tabs">{cats.map((x) => <button key={x} className="ib" aria-pressed={x === c} onClick={() => setC(x)}>{x}</button>)}</div>
      <div className="grid">
        {tools.filter((t) => c === "All" || t.category === c).map((t) => (
          <a key={t.name} className="card rv in" href={t.url} target="_blank" rel="noopener noreferrer">
            <span className="tag">{t.category}</span><h3>{t.name}</h3><p>Open {t.name}</p>
          </a>
        ))}
      </div>
    </>
  );
}
