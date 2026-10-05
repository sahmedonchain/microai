"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { motion } from "framer-motion";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { timeAgo } from "@/lib/format";
import type { NewsItem, NewsTag, NewsPayload, SourceStatus } from "@/lib/news";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Grants", href: "/grants" },
  { label: "Build status", href: "/build-status" },
  { label: "Stats", href: "/stats" },
  { label: "News", href: "/news" },
];

const TAG_COLORS: Record<NewsTag, string> = {
  Partnership: "#5ea2ec",
  Integration: "#b89eea",
  Launch: "#3dd68c",
  Funding: "#f5b544",
  Developer: "#60a5fa",
  Regulation: "#f2555a",
  Event: "#f472b6",
};

const SOURCE_COLORS: Record<string, string> = {
  "Arc Blog": "#b89eea",
  "Circle Blog": "#5ea2ec",
  "Circle Pressroom": "#5ea2ec",
  Press: "#8592a8",
  "BSC News": "#f5b544",
  "Yahoo Finance": "#8592a8",
  "CNBC World": "#8592a8",
};

const ALL_TAGS: NewsTag[] = ["Partnership", "Integration", "Launch", "Funding", "Developer", "Regulation", "Event"];

type NewsFilter = "all" | "important" | "official" | "x" | "press";

const POLL_INTERVAL_MS = 60_000;

export default function NewsPage() {
  const [payload, setPayload] = useState<NewsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [tagFilter, setTagFilter] = useState<NewsTag | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string> | null>(null);
  const xSidebarRef = useRef<HTMLDivElement>(null);

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/news");
      const data: NewsPayload = await res.json();
      setFailed(false);

      if (prevIdsRef.current) {
        const freshIds = new Set(data.items.filter((i) => !prevIdsRef.current!.has(i.id)).map((i) => i.id));
        setNewIds(freshIds);
      }
      prevIdsRef.current = new Set(data.items.map((i) => i.id));
      setPayload(data);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    (async () => { await fetchNews(); })();
    const interval = setInterval(fetchNews, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const items = useMemo(() => payload?.items ?? [], [payload]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter === "important" && !item.important) return false;
      if (filter === "official" && !item.official) return false;
      if (filter === "x" && item.source !== "X") return false;
      if (filter === "press" && item.source !== "Press") return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, tagFilter, search]);

  const tagCounts = useMemo(() => {
    const counts = new Map<NewsTag, number>();
    for (const item of items) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const handleFilterClick = (f: NewsFilter) => {
    setFilter(f);
    if (f === "x") {
      xSidebarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-space font-sans text-text">
      <header className="sticky top-0 z-50 border-b border-border bg-space/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold text-text">MicroAI</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  l.href === "/news" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-3 py-1.5 text-xs text-accent-text">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-text opacity-75" aria-hidden="true" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
              </span>
              Arc Mainnet
            </span>
          </div>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / News
          </p>
          <div className="mt-4 max-w-xl">
            <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
              Arc &amp; Circle
              <br />
              News
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Announcements and press coverage of Arc and Circle, pulled from free public sources.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search news..."
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <button
              type="button"
              onClick={fetchNews}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm text-muted transition hover:text-text"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: "all" as const, label: "All" },
              { id: "important" as const, label: "Key announcements" },
              { id: "official" as const, label: "Official" },
              { id: "x" as const, label: "Official on X" },
              { id: "press" as const, label: "Press" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFilterClick(f.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  filter === f.id ? "border-accent/40 bg-accent-dim text-accent-text" : "border-border text-muted hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {tagCounts.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_TAGS.filter((t) => tagCounts.has(t)).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium transition"
                  style={{
                    borderColor: tagFilter === tag ? TAG_COLORS[tag] : "var(--color-border)",
                    background: tagFilter === tag ? `${TAG_COLORS[tag]}18` : "transparent",
                    color: tagFilter === tag ? TAG_COLORS[tag] : "var(--color-muted)",
                  }}
                >
                  {tag} ({tagCounts.get(tag)})
                </button>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-muted">
            {payload === null
              ? "Loading..."
              : filtered.length === 0
              ? `No results${search ? ` for "${search}"` : ""}`
              : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}${payload.stale ? " · showing last known data" : ""}`}
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
            {payload === null ? (
              failed ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Could not load news. <button onClick={fetchNews} className="text-accent-text hover:underline">Retry</button></p>
              ) : (
                <div className="flex flex-col gap-3 p-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-accent-dim" />
                  ))}
                </div>
              )
            ) : payload.unavailable ? (
              <p className="px-4 py-8 text-center text-sm text-muted">News sources are temporarily unavailable. Please check back soon.</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Nothing matches this filter yet.</p>
            ) : (
              filtered.map((item) => <NewsRow key={item.id} item={item} isNew={newIds.has(item.id)} />)
            )}
          </div>
        </div>

        <aside ref={xSidebarRef} className="flex w-full shrink-0 flex-col gap-6 lg:w-72">
          <XTimelinePanel />

          <div>
            <p className="text-sm font-medium text-text">Links</p>
            <div className="mt-3 flex flex-col gap-0.5">
              {[
                { label: "@arc on X", href: "https://x.com/arc" },
                { label: "@circle on X", href: "https://x.com/circle" },
                { label: "Arc blog", href: "https://arc.io/blog" },
                { label: "Circle pressroom", href: "https://circle.com/pressroom" },
                { label: "Arc community", href: "https://community.arc.io" },
                { label: "Arc events", href: "https://community.arc.io/public/events" },
                { label: "Discord", href: "https://discord.com/invite/buildonarc" },
              ].map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-text"
                >
                  {l.label}
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {payload?.sources && (
            <div>
              <p className="text-sm font-medium text-text">Live sources</p>
              <div className="mt-3 flex flex-col gap-1.5">
                {payload.sources.map((s: SourceStatus) => (
                  <div key={s.name} className="flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className={`size-1.5 rounded-full ${s.status === "ok" ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
                      {s.name}
                    </span>
                    <span className="font-mono text-muted">{s.status === "ok" ? s.count : "error"}</span>
                  </div>
                ))}
              </div>
              {payload.updatedAt > 0 && (
                <p className="mt-2 text-xs text-muted">Updated {timeAgo(new Date(payload.updatedAt).toISOString())}</p>
              )}
            </div>
          )}
        </aside>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-5" />
            <span className="text-xs text-muted">MicroAI · The Arc &amp; Circle hub</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {[
              { l: "Arc", h: "https://arc.io" },
              { l: "Circle", h: "https://circle.com" },
              { l: "GitHub", h: "https://github.com/sahmedonchain/microai" },
              { l: "Explorer", h: "https://explorer.arc.io" },
            ].map((link) => (
              <a key={link.l} href={link.h} target="_blank" rel="noreferrer" className="text-xs text-muted transition hover:text-text">
                {link.l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function NewsRow({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const sourceColor = SOURCE_COLORS[item.source] ?? "#8592a8";
  const label = item.source === "Press" && item.outlet ? item.outlet : item.source;
  return (
    <motion.a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-1.5 border-b border-border px-4 py-3.5 no-underline last:border-b-0"
      style={isNew ? { boxShadow: "inset 2px 0 0 var(--color-accent-text)" } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
          style={{ background: `${sourceColor}18`, border: `1px solid ${sourceColor}30`, color: sourceColor }}
        >
          {label}
        </span>
        <span className="text-xs text-muted">Source: {item.source}</span>
        {item.important && (
          <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium text-accent-text" style={{ background: "var(--color-accent-dim)", border: "1px solid rgba(102,76,136,0.3)" }}>
            Key announcement
          </span>
        )}
        {isNew && (
          <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium text-success" style={{ background: "rgba(61,214,140,0.12)", border: "1px solid rgba(61,214,140,0.3)" }}>
            New
          </span>
        )}
        <span className="text-xs text-muted">{item.publishedAt ? timeAgo(item.publishedAt) : "recently"}</span>
      </div>
      <p className="text-sm font-medium text-text">{item.title}</p>
      {item.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{item.description}</p>}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ color: TAG_COLORS[tag] }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.a>
  );
}

function XTimelinePanel() {
  const [handle, setHandle] = useState<"arc" | "circle">("arc");
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (() => setShowFallback(false))();
    const timer = setTimeout(() => {
      const hasIframe = containerRef.current?.querySelector("iframe");
      if (!hasIframe) setShowFallback(true);
    }, 8000);

    const win = window as unknown as { twttr?: { widgets?: { load: (el?: HTMLElement) => void } } };
    if (widgetLoaded && win.twttr?.widgets && containerRef.current) {
      win.twttr.widgets.load(containerRef.current);
    }

    return () => clearTimeout(timer);
  }, [handle, widgetLoaded]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text">On X</p>
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {(["arc", "circle"] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHandle(h)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                handle === h ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
              }`}
            >
              @{h}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="mt-3 overflow-hidden rounded-lg border border-border" style={{ minHeight: showFallback ? "auto" : 400 }}>
        {showFallback ? (
          <a
            href={`https://x.com/${handle}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 bg-surface px-4 py-8 text-sm text-accent-text no-underline hover:underline"
          >
            View @{handle} on X <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          <a
            key={handle}
            className="twitter-timeline"
            data-theme="dark"
            data-chrome="noheader nofooter noborders transparent"
            href={`https://twitter.com/${handle}`}
          >
            Tweets by {handle}
          </a>
        )}
      </div>

      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onLoad={() => setWidgetLoaded(true)} />
    </div>
  );
}
