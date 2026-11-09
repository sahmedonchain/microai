"use client";
import { useEffect, useRef } from "react";

// Three small mouse effects for the homepage, only for real mice (not touch)
// and only when the visitor has not asked for reduced motion:
//   C  the moon's rim light follows the cursor (and drifts on its own when idle)
//   B  card borders glow where the cursor is
//   I  a soft signal ripple under the cursor
export function MouseEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!fine || calm || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hero = document.getElementById("top");
    const sweeps = hero ? Array.from(hero.querySelectorAll<HTMLElement>(".hm-moon-wrap--hero .hm-sweep")) : [];
    const moonR = (hero?.querySelector<HTMLElement>(".hm-moon-wrap--hero")?.offsetWidth ?? 1500) / 2;
    hero?.classList.add("hm-js");
    canvas.style.display = "block";

    // ---- C: moon light
    let inside = false;
    let target = 0;
    let a1 = 0;
    let a2 = 0;
    let heroVisible = true;
    const io = hero ? new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }) : null;
    if (hero) io?.observe(hero);

    const onHeroMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !hero) return;
      const r = hero.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const s = Math.max(-0.95, Math.min(0.95, dx / moonR));
      target = Math.max(-42, Math.min(42, (Math.asin(s) * 180) / Math.PI));
      inside = true;
    };
    const onHeroLeave = () => { inside = false; };
    hero?.addEventListener("pointermove", onHeroMove);
    hero?.addEventListener("pointerleave", onHeroLeave);

    // ---- I: ripples
    type Ripple = { x: number; y: number; r: number; a: number };
    let ripples: Ripple[] = [];
    let lastRipple = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);

    // ---- B: card glow + ripples share one pointer listener
    let cards: HTMLElement[] = [];
    const collect = () => { cards = Array.from(document.querySelectorAll<HTMLElement>(".hm-card")); };
    collect();
    let pending: PointerEvent | null = null;
    let raf = 0;
    const flushPointer = () => {
      raf = 0;
      const e = pending;
      pending = null;
      if (!e) return;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (r.bottom < -150 || r.top > window.innerHeight + 150) continue;
        c.style.setProperty("--cx", `${e.clientX - r.left}px`);
        c.style.setProperty("--cy", `${e.clientY - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pending = e;
      if (!raf) raf = requestAnimationFrame(flushPointer);
      const now = performance.now();
      if (now - lastRipple > 190) {
        lastRipple = now;
        ripples.push({ x: e.clientX, y: e.clientY, r: 2, a: 0.5 });
        if (ripples.length > 14) ripples.shift();
      }
    };
    const onLeaveDoc = () => {
      for (const c of cards) {
        c.style.setProperty("--cx", "-300px");
        c.style.setProperty("--cy", "-300px");
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveDoc);

    // ---- one animation loop
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (heroVisible && sweeps.length) {
        const t = now / 1000;
        const idle1 = 36 * Math.sin((t * Math.PI * 2) / 18);
        const idle2 = 36 * Math.sin(((t + 4) * Math.PI * 2) / 24);
        a1 += ((inside ? target : idle1) - a1) * 0.07;
        a2 += ((inside ? target * 0.8 : idle2) - a2) * 0.05;
        sweeps[0].style.transform = `rotate(${a1.toFixed(2)}deg)`;
        if (sweeps[1]) sweeps[1].style.transform = `rotate(${a2.toFixed(2)}deg)`;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!ripples.length) return;
      ripples = ripples.filter((p) => p.a > 0.01);
      for (const p of ripples) {
        p.r += 1.1;
        p.a -= 0.011;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(94,162,236,${p.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(184,158,234,${(p.a * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      hero?.removeEventListener("pointermove", onHeroMove);
      hero?.removeEventListener("pointerleave", onHeroLeave);
      hero?.classList.remove("hm-js");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", fit);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
      canvas.style.display = "none";
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ display: "none" }} className="pointer-events-none fixed inset-0 z-40 h-full w-full" />;
}
