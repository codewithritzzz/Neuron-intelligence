"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// NEURON: CYBERVERSE is loaded lazily on click, so it adds nothing to the initial page weight.
export default function CyberverseLauncher() {
  const [on, setOn] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<{ dispose(): void } | null>(null);
  const exit = useCallback(() => {
    setOn(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    if (!on || !host.current) return;
    let dead = false;
    document.documentElement.dataset.game = "1";
    import("./games/cyberverse").then((m) => {
      if (dead || !host.current) return;
      ctl.current = m.createCyberverse({ container: host.current, onExit: exit, logo: "/logo.png" });
    });
    return () => { dead = true; ctl.current?.dispose(); ctl.current = null; delete document.documentElement.dataset.game; };
  }, [on, exit]);
  return (
    <>
      <button className="btn cv" onClick={() => { setOn(true); document.documentElement.requestFullscreen?.().catch(() => {}); }}>NEURON: CYBERVERSE</button>
      {on && createPortal(<div ref={host} />, document.body)}
    </>
  );
}
