"use client";
import { useEffect } from "react";
export default function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      el.style.transitionDelay = (Array.from(el.parentElement!.children).indexOf(el) % 6) * 80 + "ms";
      el.classList.add("in");
      io.unobserve(el);
    }), { threshold: 0.12 });
    document.querySelectorAll(".rv:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
