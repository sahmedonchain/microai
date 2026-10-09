"use client";
import React, { useEffect, useRef, useState } from "react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";
import { motion } from "framer-motion";
import {
  Grid2x2,
  List,
  MessageSquare,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { truncateAddress } from "@/lib/format";
import { categories, projects, type Project } from "@/lib/ecosystemData";

const PAGE_SIZE = 20;


const CATEGORY_COLORS: Record<string, string> = {
  "AI & AGENTS": "#f59e0b",
  "WALLETS": "#6366f1",
  "DEX & LIQUIDITY": "#ec4899",
  "BRIDGES": "#9333ea",
  "DEV TOOLS": "#3b82f6",
  "PAYMENTS": "#10b981",
  "STABLECOINS": "#2563eb",
  "INFRASTRUCTURE": "#64748b",
  "LENDING": "#b6509e",
  "INSTITUTIONS": "#94a3b8",
  "EXCHANGES": "#fbbf24",
  "COMMUNITY BUILDS": "#34d399",
};


export function EcosystemTab() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"tvl" | "name">("tvl");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [tvlByProject, setTvlByProject] = useState<Record<string, number>>({});

  const searchRef = useRef<HTMLInputElement>(null);

  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const askEcosystem = async () => {
    const query = aiQuery.trim();
    if (!query || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiAnswer("");
    try {
      const res = await fetch("/api/ecosystem-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) setAiError(data.error || "Search failed. Please try again.");
      else setAiAnswer(data.answer);
    } catch {
      setAiError("Search failed. Check your connection and try again.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecosystem-tvl")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.tvl) setTvlByProject(data.tvl);
      })
      .catch(() => { /* enrichment is optional — rows render fine without it */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = projects.filter((p) => {
    const matchCat = filter === "ALL" || p.category === filter;
    const matchSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.desc.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  // Sort: "tvl" puts real Arc-chain TVL first (highest on top, matching
  // DeFiLlama's own list), untracked projects after in their existing
  // order. "name" is a straight alphabetical sort — the only two sort
  // criteria we can back with real data (we don't track a "date added").
  const ranked = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const tvlA = tvlByProject[a.name] ?? -1;
    const tvlB = tvlByProject[b.name] ?? -1;
    return tvlB - tvlA;
  });

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = ranked.slice(pageStart, pageStart + PAGE_SIZE);

  const categoryList = categories.filter((c) => c !== "ALL");
  const categoryCounts = categoryList.map((c) => ({
    name: c,
    count: projects.filter((p) => p.category === c).length,
  }));
  const tvlTrackedCount = Object.keys(tvlByProject).length;

  return (
    <div className="min-h-full bg-space font-sans text-text">

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Ecosystem
          </p>

          <div className="mt-4 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
                Arc &amp; Circle
                <br />
                Ecosystem Directory
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Every project, protocol, and builder in the Arc + Circle ecosystem, from community dApps to
                institutional partners.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <EcosystemGlyph />
              <p className="max-w-[20ch] text-sm leading-relaxed text-muted">
                Built on Arc. Backed by real on-chain and DeFiLlama data.
              </p>
            </div>
          </div>

          {/* STAT STRIP — real counts only */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { label: "Total projects", value: projects.length },
              { label: "Categories", value: categoryList.length },
              { label: "Live TVL tracked", value: tvlTrackedCount },
            ].map((s) => (
              <div key={s.label} className="min-w-[140px] flex-1 rounded-lg border border-border bg-surface px-5 py-4 sm:flex-none">
                <p className="font-mono text-2xl text-text">{s.value}</p>
                <p className="mt-1 text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* AI SEARCH */}
          <div className="mb-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askEcosystem()}
                maxLength={300}
                placeholder="Ask about Arc ecosystem..."
                aria-label="Ask about the Arc ecosystem"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <button
                type="button"
                onClick={askEcosystem}
                disabled={aiLoading || !aiQuery.trim()}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Search
              </button>
            </div>
            {aiLoading && <p className="mt-3 text-sm text-muted" role="status">Searching ecosystem...</p>}
            {aiError && <p className="mt-3 text-sm text-danger">{aiError}</p>}
            {aiAnswer && (
              <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                <span className="mb-2 inline-block rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent-text">AI</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{aiAnswer}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              {projects.length} projects · {categoryList.length} categories · AI-powered search
            </p>
          </div>

          {/* SEARCH + FILTER BAR */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search projects, tags, categories..."
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                  className="appearance-none rounded-lg border border-border bg-surface py-2.5 pl-3 pr-8 text-sm text-text focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === "ALL" ? "All categories" : c}</option>
                  ))}
                </select>
                <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              </div>

              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as "tvl" | "name"); setPage(1); }}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
              >
                <option value="tvl">Sort: TVL</option>
                <option value="name">Sort: Name</option>
              </select>

              <div className="flex rounded-lg border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  className={`rounded-md p-1.5 transition ${view === "list" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"}`}
                >
                  <List className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  className={`rounded-md p-1.5 transition ${view === "grid" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"}`}
                >
                  <Grid2x2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            {ranked.length === 0
              ? `No results${search ? ` for "${search}"` : ""}`
              : `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, ranked.length)} of ${ranked.length}`}
          </p>

          {/* LIST / GRID */}
          {view === "list" ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
              <div className="ecosystem-grid hidden gap-3 border-b border-border px-4 py-2.5 text-xs text-muted sm:grid">
                <span>#</span>
                <span>Project</span>
                <span>Category</span>
                <span>Description</span>
                <span className="text-right">TVL on Arc</span>
                <span className="text-right">Link</span>
              </div>
              {pageItems.map((p, i) => (
                <ProjectRow key={p.name} project={p} rank={pageStart + i + 1} tvl={tvlByProject[p.name]} />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((p) => (
                <ProjectCard key={p.name} project={p} tvl={tvlByProject[p.name]} />
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {ranked.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
          <div>
            <p className="text-sm font-medium text-text">Categories</p>
            <div className="mt-3 flex flex-col gap-0.5">
              <button
                onClick={() => { setFilter("ALL"); setPage(1); }}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                  filter === "ALL" ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                }`}
              >
                All categories
                <span className="font-mono text-xs">{projects.length}</span>
              </button>
              {categoryCounts.map((c) => (
                <button
                  key={c.name}
                  onClick={() => { setFilter(c.name); setPage(1); }}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                    filter === c.name ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-xs">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-secondary/25 bg-secondary-dim p-4">
            <p className="text-sm font-semibold text-text">Want to list your project?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Open an issue on our GitHub with your project details and we&apos;ll review it for the directory.
            </p>
            <a
              href="https://github.com/sahmedonchain/microai/issues"
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-block text-xs font-medium text-secondary-text hover:underline"
            >
              Suggest a project on GitHub
            </a>
          </div>
        </aside>
      </div>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Get instant answers about any Arc or Circle ecosystem project for just $0.001 USDC.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            Ask MicroAI
          </Link>
        </div>
      </section>

      {/* FOOTER */}
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

      <style>{`
        .ecosystem-grid { grid-template-columns: 28px 1fr 130px minmax(0,2fr) 100px 60px; }
        select { color-scheme: dark; }
        @media (max-width: 640px) {
          .hide-on-mobile { display: none; }
          .ecosystem-row.ecosystem-grid { grid-template-columns: 24px 1fr 70px 60px; }
        }
      `}</style>
    </div>
  );
}

// Decorative hero graphic — two overlapping circles with connection nodes,
// in our own brand colors. Purely visual, no data.
function EcosystemGlyph() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="46" cy="44" r="34" stroke="var(--color-accent-text)" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="78" cy="44" r="34" stroke="var(--color-secondary-text)" strokeOpacity="0.4" strokeWidth="1.5" />
      <line x1="46" y1="44" x2="78" y2="44" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="46" y1="44" x2="30" y2="20" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="78" y1="44" x2="96" y2="66" stroke="var(--color-border)" strokeWidth="1" />
      <circle cx="46" cy="44" r="4" fill="var(--color-accent-text)" />
      <circle cx="78" cy="44" r="4" fill="var(--color-secondary-text)" />
      <circle cx="30" cy="20" r="3" fill="var(--color-accent-text)" fillOpacity="0.7" />
      <circle cx="96" cy="66" r="3" fill="var(--color-secondary-text)" fillOpacity="0.7" />
    </svg>
  );
}

function formatTvl(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function ProjectRow({ project: p, rank, tvl }: { project: Project; rank: number; tvl?: number }) {
  const catColor = CATEGORY_COLORS[p.category] ?? "#664c88";
  return (
    <motion.a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="ecosystem-grid ecosystem-row grid items-center gap-3 border-b border-border px-4 py-3 no-underline last:border-b-0"
    >
      <span className="font-mono text-xs text-muted">{rank}</span>

      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
          style={{ background: `${p.logoColor}20`, border: `1px solid ${p.logoColor}35`, color: p.logoColor }}
        >
          {p.logo}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{p.name}</span>
          {p.featured && (
            <span className="shrink-0 rounded border border-accent/30 bg-accent-dim px-1.5 py-0.5 font-mono text-[9px] text-accent-text">
              Featured
            </span>
          )}
        </div>
      </div>

      <span
        className="hide-on-mobile w-fit justify-self-start truncate rounded px-2 py-0.5 font-mono text-[10px] font-medium"
        style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}
      >
        {p.category}
      </span>

      <p className="hide-on-mobile truncate text-xs text-muted">{p.desc}</p>

      <span className="text-right font-mono text-xs font-semibold text-accent-text">
        {typeof tvl === "number" ? formatTvl(tvl) : ""}
      </span>

      <span className="text-right font-mono text-[11px] font-medium" style={{ color: catColor }}>
        Visit →
      </span>
    </motion.a>
  );
}

function ProjectCard({ project: p, tvl }: { project: Project; tvl?: number }) {
  const catColor = CATEGORY_COLORS[p.category] ?? "#664c88";
  return (
    <motion.a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, borderColor: "var(--color-accent)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 no-underline"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
          style={{ background: `${p.logoColor}20`, border: `1px solid ${p.logoColor}35`, color: p.logoColor }}
        >
          {p.logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-text">{p.name}</span>
            {p.featured && (
              <span className="shrink-0 rounded border border-accent/30 bg-accent-dim px-1.5 py-0.5 font-mono text-[9px] text-accent-text">
                Featured
              </span>
            )}
          </div>
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
            style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}
          >
            {p.category}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted">{p.desc}</p>
      {(p.usdcSupport || p.agentCompatible || p.apiAvailable || p.github || p.contract) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {p.usdcSupport && (
            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] text-success">USDC Support</span>
          )}
          {p.agentCompatible && (
            <span className="rounded-full border border-secondary/30 bg-secondary-dim px-2 py-0.5 text-[10px] text-secondary-text">Agent Compatible</span>
          )}
          {p.apiAvailable && (
            <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted">API Available</span>
          )}
          {p.github && (
            <span
              role="link"
              tabIndex={0}
              aria-label={`${p.name} on GitHub`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(p.github, "_blank", "noopener,noreferrer"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); window.open(p.github, "_blank", "noopener,noreferrer"); } }}
              className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-muted hover:text-text"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              GitHub
            </span>
          )}
          {p.contract && <span className="font-mono text-[10px] text-muted">{truncateAddress(p.contract)}</span>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-accent-text">
          {typeof tvl === "number" ? formatTvl(tvl) : ""}
        </span>
        <span className="font-mono text-[11px] font-medium" style={{ color: catColor }}>Visit →</span>
      </div>
    </motion.a>
  );
}
