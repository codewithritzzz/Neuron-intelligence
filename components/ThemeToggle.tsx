"use client";
import { useEffect, useState } from "react";
const modes = ["system", "dark", "light"] as const;
export default function ThemeToggle() {
  const [m, setM] = useState<(typeof modes)[number]>("system");
  useEffect(() => {
    try { const s = localStorage.getItem("ni-theme"); if (s === "dark" || s === "light") setM(s); } catch {}
  }, []);
  const next = () => {
    const n = modes[(modes.indexOf(m) + 1) % 3];
    setM(n);
    if (n === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", n);
    try { localStorage.setItem("ni-theme", n); } catch {}
  };
  return <button className="ib" id="tb" onClick={next} aria-label="Change theme">Theme: {m}</button>;
}
