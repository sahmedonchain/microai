"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, MessageSquare, ExternalLink } from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { timeAgo } from "@/lib/format";
import type { AchSwapOnchainPayload } from "@/lib/achswapTypes";
import { SCAN_WINDOW_LABEL } from "@/lib/achswapTypes";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Grants", href: "/grants" },
  { label: "Build status", href: "/build-status" },
  { label: "Stats", href: "/stats" },
  { label: "News", href: "/news" },
];

interface RepoStatus {
  name: string;
  org: string;
  repo: string;
  pushedAt: string | null;
  stars: number | null;
  status: "ACTIVE" | "SLOW" | "INACTIVE" | "LOADING" | "ERROR";
  errorKind?: "not_found" | "rate_limited" | "api_error";
  daysAgo: number | null;
  url: string;
  projectUrl: string;
  category: string;
}

const REPOS: Omit<RepoStatus, "pushedAt" | "stars" | "status" | "daysAgo">[] = [
  // Official Circle/Arc reference repos — verified live under github.com/circlefin
  { name: "Arc Multichain Wallet", org: "Circle", repo: "circlefin/arc-multichain-wallet", url: "https://github.com/circlefin/arc-multichain-wallet", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc P2P Payments", org: "Circle", repo: "circlefin/arc-p2p-payments", url: "https://github.com/circlefin/arc-p2p-payments", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc Commerce", org: "Circle", repo: "circlefin/arc-commerce", url: "https://github.com/circlefin/arc-commerce", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc Fintech", org: "Circle", repo: "circlefin/arc-fintech", url: "https://github.com/circlefin/arc-fintech", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc Nanopayments", org: "Circle", repo: "circlefin/arc-nanopayments", url: "https://github.com/circlefin/arc-nanopayments", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc Escrow", org: "Circle", repo: "circlefin/arc-escrow", url: "https://github.com/circlefin/arc-escrow", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },
  { name: "Arc Prediction Markets", org: "Circle", repo: "circlefin/arc-prediction-markets", url: "https://github.com/circlefin/arc-prediction-markets", projectUrl: "https://docs.arc.io", category: "OFFICIAL ARC/CIRCLE" },

  // Established DeFi protocols with confirmed Arc-relevant deployments
  { name: "Uniswap v3", org: "Uniswap Labs", repo: "Uniswap/v3-core", url: "https://github.com/Uniswap/v3-core", projectUrl: "https://uniswap.org", category: "DEX & LIQUIDITY" },
  { name: "Aave v3", org: "Aave", repo: "aave/aave-v3-origin", url: "https://github.com/aave/aave-v3-origin", projectUrl: "https://aave.com", category: "LENDING" },
  { name: "Curve Finance", org: "Curve", repo: "curvefi/curve-contract", url: "https://github.com/curvefi/curve-contract", projectUrl: "https://curve.fi", category: "DEX & LIQUIDITY" },
  { name: "Morpho Blue", org: "Morpho", repo: "morpho-org/morpho-blue", url: "https://github.com/morpho-org/morpho-blue", projectUrl: "https://morpho.org", category: "LENDING" },
  { name: "Maple Finance", org: "Maple", repo: "maple-labs/maple-core-v2", url: "https://github.com/maple-labs/maple-core-v2", projectUrl: "https://maple.finance", category: "LENDING" },
  { name: "Aerodrome", org: "Aerodrome", repo: "aerodrome-finance/contracts", url: "https://github.com/aerodrome-finance/contracts", projectUrl: "https://aerodrome.finance", category: "DEX & LIQUIDITY" },
  { name: "Fluid", org: "Instadapp", repo: "Instadapp/fluid-contracts-public", url: "https://github.com/Instadapp/fluid-contracts-public", projectUrl: "https://fluid.instadapp.io", category: "DEX & LIQUIDITY" },

  // Bridges
  { name: "Wormhole", org: "Wormhole Foundation", repo: "wormhole-foundation/wormhole", url: "https://github.com/wormhole-foundation/wormhole", projectUrl: "https://wormhole.com", category: "BRIDGES" },
  { name: "LayerZero", org: "LayerZero Labs", repo: "LayerZero-Labs/LayerZero-v2", url: "https://github.com/LayerZero-Labs/LayerZero-v2", projectUrl: "https://layerzero.network", category: "BRIDGES" },
  { name: "Across Protocol", org: "Across", repo: "across-protocol/contracts", url: "https://github.com/across-protocol/contracts", projectUrl: "https://across.to", category: "BRIDGES" },

  // Infrastructure & dev tools
  { name: "Chainlink", org: "Chainlink", repo: "smartcontractkit/chainlink", url: "https://github.com/smartcontractkit/chainlink", projectUrl: "https://chain.link", category: "DEV TOOLS" },
  { name: "thirdweb", org: "thirdweb", repo: "thirdweb-dev/js", url: "https://github.com/thirdweb-dev/js", projectUrl: "https://thirdweb.com", category: "DEV TOOLS" },
  { name: "Pimlico", org: "Pimlico", repo: "pimlicolabs/permissionless.js", url: "https://github.com/pimlicolabs/permissionless.js", projectUrl: "https://pimlico.io", category: "DEV TOOLS" },
  { name: "Blockscout", org: "Blockscout", repo: "blockscout/blockscout", url: "https://github.com/blockscout/blockscout", projectUrl: "https://www.blockscout.com", category: "DEV TOOLS" },
  { name: "Malachite", org: "Informal Systems", repo: "informalsystems/malachite", url: "https://github.com/informalsystems/malachite", projectUrl: "https://informal.systems", category: "INFRASTRUCTURE" },

  // Wallets
  { name: "Rainbow Wallet", org: "Rainbow", repo: "rainbow-me/rainbow", url: "https://github.com/rainbow-me/rainbow", projectUrl: "https://rainbow.me", category: "WALLETS" },

  // Community builds
  { name: "MicroAI", org: "Community", repo: "sahmedonchain/microai", url: "https://github.com/sahmedonchain/microai", projectUrl: "https://microai-tan.vercel.app", category: "COMMUNITY BUILDS" },
];

function getDaysAgo(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function getStatus(days: number | null): "ACTIVE" | "SLOW" | "INACTIVE" {
  if (days === null) return "INACTIVE";
  if (days <= 7) return "ACTIVE";
  if (days <= 30) return "SLOW";
  return "INACTIVE";
}

const STATUS_CONFIG: Record<RepoStatus["status"], { color: string; label: string }> = {
  ACTIVE:   { color: "#3dd68c", label: "Active" },
  SLOW:     { color: "#f5b544", label: "Slow" },
  INACTIVE: { color: "#8592a8", label: "Inactive" },
  LOADING:  { color: "#8592a8", label: "Loading" },
  ERROR:    { color: "#f2555a", label: "Error" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "OFFICIAL ARC/CIRCLE": "#2775ca",
  "COMMUNITY BUILDS": "#3dd68c",
  "DEX & LIQUIDITY":  "#ec4899",
  "LENDING":          "#b6509e",
  "BRIDGES":          "#9333ea",
  "DEV TOOLS":        "#5ea2ec",
  "INFRASTRUCTURE":   "#8592a8",
  "WALLETS":          "#664c88",
};

export default function BuildStatusPage() {
  const [repos, setRepos] = useState<RepoStatus[]>(
    REPOS.map(r => ({ ...r, pushedAt: null, stars: null, status: "LOADING", daysAgo: null }))
  );
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchStatuses = async () => {
    // Limited concurrency: 24 simultaneous requests would burst the GitHub
    // rate limit on a cold cache. Each repo fails on its own.
    const results: RepoStatus[] = new Array(REPOS.length);
    let next = 0;
    const worker = async () => {
      while (next < REPOS.length) {
        const i = next++;
        const r = REPOS[i];
        try {
          const res = await fetch(`/api/github-status?repo=${r.repo}`);
          const data = await res.json();
          if (data.error) {
            const errorKind = data.error === "not_found" || data.error === "rate_limited" ? data.error : "api_error";
            results[i] = { ...r, pushedAt: null, stars: null, status: "ERROR", daysAgo: null, errorKind };
            continue;
          }
          const days = data.pushedAt ? getDaysAgo(data.pushedAt) : null;
          results[i] = { ...r, pushedAt: data.pushedAt, stars: data.stars, status: getStatus(days), daysAgo: days };
        } catch {
          results[i] = { ...r, pushedAt: null, stars: null, status: "ERROR", daysAgo: null, errorKind: "api_error" };
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setRepos(results);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const categoryList = Array.from(new Set(REPOS.map(r => r.category)));
  const categoryCounts = categoryList.map((c) => ({
    name: c,
    count: REPOS.filter((r) => r.category === c).length,
  }));

  const filtered = repos.filter((r) => {
    const matchCat = filter === "ALL" || r.category === filter;
    const q = search.toLowerCase();
    const matchSearch = search === "" || r.name.toLowerCase().includes(q) || r.org.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const activeCount = repos.filter(r => r.status === "ACTIVE").length;
  const slowCount = repos.filter(r => r.status === "SLOW").length;
  const inactiveCount = repos.filter(r => r.status === "INACTIVE").length;

  return (
    <div className="min-h-screen bg-space font-sans text-text">
      {/* NAV */}
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
                  l.href === "/build-status" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              aria-label="Search repos"
              className="hidden rounded-lg border border-border p-2 text-muted transition hover:text-text sm:flex"
            >
              <Search className="size-4" aria-hidden="true" />
            </button>

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

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Build status
          </p>

          <div className="mt-4 max-w-xl">
            <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
              Build Status
              <br />
              Tracker
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Who&apos;s actually shipping in the Arc ecosystem? Live GitHub activity for every tracked project.
            </p>
          </div>

          {/* STAT STRIP — real counts only */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { label: "Active (7d)", value: activeCount },
              { label: "Slow (30d)", value: slowCount },
              { label: "Inactive", value: inactiveCount },
              { label: "Projects tracked", value: REPOS.length },
            ].map((s) => (
              <div key={s.label} className="min-w-[140px] flex-1 rounded-lg border border-border bg-surface px-5 py-4 sm:flex-none">
                <p className="font-mono text-2xl text-text">{s.value}</p>
                <p className="mt-1 text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {lastUpdated && (
            <div className="mt-4 flex items-center gap-3 text-xs text-muted">
              Last updated {lastUpdated.toLocaleTimeString()}
              <button
                type="button"
                onClick={fetchStatuses}
                className="rounded-md border border-border px-2 py-1 text-xs text-accent-text transition hover:bg-surface"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* SEARCH + FILTER BAR */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>

            <div className="relative shrink-0">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-surface py-2.5 pl-3 pr-8 text-sm text-text focus:outline-none"
              >
                <option value="ALL">All categories</option>
                {categoryList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
            </div>
          </div>

          {/* ACHSWAP: on-chain proof, GitHub org is private */}
          <AchSwapCard />

          <p className="mt-3 text-xs text-muted">
            {filtered.length === 0
              ? `No results${search ? ` for "${search}"` : ""}`
              : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
          </p>

          {/* REPO LIST */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
            {filtered.map((repo) => {
              const sc = STATUS_CONFIG[repo.status];
              const catColor = CATEGORY_COLORS[repo.category] ?? "#664c88";
              return (
                <motion.a
                  key={repo.repo}
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 no-underline last:border-b-0 sm:flex-nowrap"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: sc.color }}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text">{repo.name}</span>
                    </div>
                    <span
                      className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
                      style={{ background: `${catColor}18`, border: `1px solid ${catColor}30`, color: catColor }}
                    >
                      {repo.category}
                    </span>
                  </div>

                  <span
                    className="shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-medium"
                    style={{ background: `${sc.color}18`, border: `1px solid ${sc.color}30`, color: sc.color }}
                  >
                    {repo.status === "LOADING" ? "..." : sc.label}
                  </span>

                  <span className="w-20 shrink-0 text-right font-mono text-xs text-muted">
                    {repo.status === "LOADING" ? "N/A" :
                     repo.status === "ERROR" ? (repo.errorKind === "not_found" ? "Repo not found" : repo.errorKind === "rate_limited" ? "Rate limited" : "API error") :
                     repo.daysAgo === 0 ? "today" :
                     repo.daysAgo === 1 ? "1 day ago" :
                     repo.daysAgo !== null ? `${repo.daysAgo}d ago` : "N/A"}
                  </span>

                  {repo.stars !== null && (
                    <span className="w-14 shrink-0 text-right font-mono text-xs text-muted">
                      ★ {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}
                    </span>
                  )}

                  <span className="shrink-0 font-mono text-[11px] font-medium text-accent-text">
                    View repo →
                  </span>
                </motion.a>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">No projects match this filter.</p>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
          <div>
            <p className="text-sm font-medium text-text">Status</p>
            <div className="mt-3 flex flex-col gap-0.5">
              {[
                { label: "Active", count: activeCount, color: "#3dd68c" },
                { label: "Slow", count: slowCount, color: "#f5b544" },
                { label: "Inactive", count: inactiveCount, color: "#8592a8" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-mono text-xs">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-text">Categories</p>
            <div className="mt-3 flex flex-col gap-0.5">
              <button
                onClick={() => setFilter("ALL")}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                  filter === "ALL" ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                }`}
              >
                All categories
                <span className="font-mono text-xs">{REPOS.length}</span>
              </button>
              {categoryCounts.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setFilter(c.name)}
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
        </aside>
      </div>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Get instant answers about any tracked project&apos;s activity for just $0.001 USDC.
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
        select { color-scheme: dark; }
      `}</style>
    </div>
  );
}

const ACHSWAP_EXPLORER_BASE = "https://arc.etherscan.io/address/";

function AchSwapCard() {
  const [data, setData] = useState<AchSwapOnchainPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/achswap-onchain");
        const json = await res.json();
        setData(json);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  const unavailable = failed || data?.unavailable;

  // Names the exact contract the swap-activity log was found on (currently
  // always AchRouteExecutor -- neither native adapter has emitted its own
  // log in any scan so far) rather than implying all three swap-role
  // contracts show activity.
  const contractNameFor = (address: string | null) =>
    address ? data?.contracts.find((c) => c.address.toLowerCase() === address.toLowerCase())?.name ?? null : null;
  const swapSourceName = contractNameFor(data?.swap.lastActivityAddress ?? null);

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">AchSwap</p>
          <p className="mt-0.5 text-xs text-muted">On-chain activity (Arc Mainnet) &middot; GitHub: not public</p>
        </div>
        <a
          href="https://trade.achswap.app/"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-mono text-[11px] font-medium text-accent-text"
        >
          Visit &rarr;
        </a>
      </div>

      {data === null && !failed ? (
        <div className="mt-3 h-20 animate-pulse rounded-md bg-accent-dim" />
      ) : unavailable ? (
        <p className="mt-3 text-sm text-danger">On-chain data unavailable</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted">Contracts verified</p>
              <p className="mt-0.5 font-mono text-sm text-text">
                {data!.verifiedCount}/{data!.totalCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">
                Swap activity{swapSourceName ? ` (${swapSourceName})` : ""}
              </p>
              <p className="mt-0.5 font-mono text-sm text-text">
                {data!.swap.lastActivityAt
                  ? timeAgo(data!.swap.lastActivityAt)
                  : `No activity found in the last ${SCAN_WINDOW_LABEL}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Liquidity activity</p>
              <p className="mt-0.5 font-mono text-sm text-text">
                {data!.liquidity.lastActivityAt
                  ? timeAgo(data!.liquidity.lastActivityAt)
                  : `No activity found in the last ${SCAN_WINDOW_LABEL}`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {data!.contracts.map((c) => (
              <a
                key={c.address}
                href={`${ACHSWAP_EXPLORER_BASE}${c.address}`}
                target="_blank"
                rel="noreferrer"
                title={c.address}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium transition hover:brightness-110"
                style={
                  c.hasCode
                    ? { background: "rgba(61,214,140,0.1)", border: "1px solid rgba(61,214,140,0.3)", color: "#3dd68c" }
                    : { background: "rgba(242,85,90,0.1)", border: "1px solid rgba(242,85,90,0.3)", color: "#f2555a" }
                }
              >
                {c.name}
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-muted">
            Contract addresses from AchSwap docs, verified on-chain by MicroAI.
          </p>
        </>
      )}
    </div>
  );
}
