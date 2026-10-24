"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Direct route to the game: /games/cyberverse (the home page button opens the same game as an overlay).
export default function CyberversePage() {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    let c: { dispose(): void } | null = null, dead = false;
    import("@/components/games/cyberverse").then((m) => {
      if (dead || !host.current) return;
      c = m.createCyberverse({ container: host.current, onExit: () => router.push("/"), logo: "/logo.png" });
    });
    return () => { dead = true; c?.dispose(); };
  }, [router]);
  return <div ref={host} style={{ position: "fixed", inset: 0, background: "#000" }} />;
}
