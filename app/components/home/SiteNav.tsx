"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Brand } from "./Brand";

const LINKS = [
  { label: "Why", id: "why" },
  { label: "How it works", id: "how" },
  { label: "Tools", id: "tools" },
  { label: "Ways to use it", id: "ways" },
  { label: "Limits", id: "limits" },
] as const;

const HEADING_OFFSET = 120; // px between the viewport top and the section heading after a jump

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function targetTop(id: string): number | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const anchor = el.querySelector("h2") ?? el;
  return Math.max(
    0,
    anchor.getBoundingClientRect().top + window.scrollY - HEADING_OFFSET,
  );
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };

    // Glide to a y position: slow start, fast middle, soft landing.
    const glide = (to: number, after?: () => void) => {
      stop();
      const from = window.scrollY;
      const dist = to - from;
      if (reducedMotion() || Math.abs(dist) < 2) {
        window.scrollTo(0, to);
        after?.();
        return;
      }
      const duration = Math.min(1400, Math.max(750, Math.abs(dist) * 0.55));
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        window.scrollTo(0, from + dist * easeInOutCubic(t));
        if (t < 1) raf.current = requestAnimationFrame(tick);
        else {
          raf.current = null;
          after?.();
        }
      };
      raf.current = requestAnimationFrame(tick);
    };

    const arrive = (id: string) => {
      const head = document
        .getElementById(id)
        ?.querySelector("h2")?.parentElement;
      if (!head || reducedMotion()) return;
      head.classList.remove("hm-arrive");
      void head.offsetWidth; // restart the animation
      head.classList.add("hm-arrive");
    };

    // Any in-page link (menu, footer) glides instead of jumping.
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as Element | null)?.closest?.(
        "a[href^='#']",
      ) as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")!.slice(1);
      const top = targetTop(id);
      if (top === null) return;
      e.preventDefault();
      glide(top, () => arrive(id));
      history.replaceState(null, "", `#${id}`);
    };

    // The user takes over: stop the glide.
    const cancel = () => stop();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setScrolled(window.scrollY > 24);
        let current: string | null = null;
        for (const { id } of LINKS) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4)
            current = id;
        }
        setActive(current);
      });
    };

    document.addEventListener("click", onClick);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      stop();
      document.removeEventListener("click", onClick);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Mobile menu: Escape closes it, and so does growing past the breakpoint.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [open]);

  const toTop = (e: React.MouseEvent) => {
    setOpen(false);
    if (window.scrollY === 0) return;
    e.preventDefault();
    if (reducedMotion()) return window.scrollTo(0, 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled || open
          ? "border-b border-border/70 bg-space/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6"
        aria-label="Main"
      >
        <Link
          href="/"
          onClick={toTop}
          className="shrink-0"
          aria-label="MicroAI home"
        >
          <Brand />
        </Link>

        <ul className="hidden items-center gap-1 rounded-full border border-border bg-surface/70 px-2 py-1.5 text-sm text-muted backdrop-blur md:flex">
          {LINKS.map(({ label, id }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? "true" : undefined}
                className={`block rounded-full px-3 py-1.5 lg:px-4 transition-all duration-300 ${
                  active === id
                    ? "bg-accent-dim text-accent-text shadow-[0_0_20px_-4px_rgb(139_107_192/0.7)] ring-1 ring-accent/40"
                    : "hover:bg-surface-raised hover:text-text"
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/sahmedonchain/microai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-accent-text/40 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-text transition hover:border-accent-text/80 hover:bg-white/[0.08] max-[359px]:px-3 max-[359px]:text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text sm:px-5"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4 fill-current"
              aria-hidden="true"
            >
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            GitHub
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-surface/70 text-text transition hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text md:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="hm-menu-in border-t border-border/70 px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="mx-auto max-w-6xl">
            {LINKS.map(({ label, id }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active === id ? "true" : undefined}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-base transition-colors ${
                    active === id
                      ? "bg-accent-dim text-accent-text ring-1 ring-accent/40"
                      : "text-text/90 active:bg-surface-raised"
                  }`}
                >
                  {label}
                  {active === id && (
                    <span
                      className="size-1.5 rounded-full bg-accent-text"
                      aria-hidden="true"
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
