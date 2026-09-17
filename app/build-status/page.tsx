"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/app/components/Navbar";
import { AnimatedNumber } from "@/app/components/AnimatedNumber";

interface RepoStatus {
  name: string;
  org: string;
  repo: string;
  pushedAt: string | null;
  stars: number | null;
  status: "ACTIVE" | "SLOW" | "INACTIVE" | "LOADING" | "ERROR";
  daysAgo: number | null;
  url: string;
  projectUrl: string;
  category: string;
}

const REPOS: Omit<RepoStatus, "pushedAt" | "stars" | "status" | "daysAgo">[] = [
  { name: "MicroAI", org: "Community", repo: "sahmedonchain/microai", url: "https://github.com/sahmedonchain/microai", projectUrl: "https://microai-tan.vercel.app", category: "COMMUNITY BUILDS" },
  { name: "Uniswap v3", org: "Uniswap Labs", repo: "Uniswap/v3-core", url: "https://github.com/Uniswap/v3-core", projectUrl: "https://uniswap.org", category: "DEX & LIQUIDITY" },
  { name: "Aave v3", org: "Aave", repo: "aave/aave-v3-core", url: "https://github.com/aave/aave-v3-core", projectUrl: "https://aave.com", category: "LENDING" },
  { name: "Curve Finance", org: "Curve", repo: "curvefi/curve-contract", url: "https://github.com/curvefi/curve-contract", projectUrl: "https://curve.fi", category: "DEX & LIQUIDITY" },
  { name: "Morpho Blue", org: "Morpho", repo: "morpho-org/morpho-blue", url: "https://github.com/morpho-org/morpho-blue", projectUrl: "https://morpho.org", category: "LENDING" },
  { name: "Wormhole", org: "Wormhole Foundation", repo: "wormhole-foundation/wormhole", url: "https://github.com/wormhole-foundation/wormhole", projectUrl: "https://wormhole.com", category: "BRIDGES" },
  { name: "LayerZero", org: "LayerZero Labs", repo: "LayerZero-Labs/LayerZero", url: "https://github.com/LayerZero-Labs/LayerZero", projectUrl: "https://layerzero.network", category: "BRIDGES" },
  { name: "Across Protocol", org: "Across", repo: "across-protocol/contracts", url: "https://github.com/across-protocol/contracts", projectUrl: "https://across.to", category: "BRIDGES" },
  { name: "Chainlink", org: "Chainlink", repo: "smartcontractkit/chainlink", url: "https://github.com/smartcontractkit/chainlink", projectUrl: "https://chain.link", category: "DEV TOOLS" },
  { name: "thirdweb", org: "thirdweb", repo: "thirdweb-dev/js", url: "https://github.com/thirdweb-dev/js", projectUrl: "https://thirdweb.com", category: "DEV TOOLS" },
  { name: "Pimlico", org: "Pimlico", repo: "pimlicolabs/permissionless.js", url: "https://github.com/pimlicolabs/permissionless.js", projectUrl: "https://pimlico.io", category: "DEV TOOLS" },
  { name: "Maple Finance", org: "Maple", repo: "maple-labs/maple-core-v2", url: "https://github.com/maple-labs/maple-core-v2", projectUrl: "https://maple.finance", category: "LENDING" },
  { name: "Aerodrome", org: "Aerodrome", repo: "aerodrome-finance/contracts", url: "https://github.com/aerodrome-finance/contracts", projectUrl: "https://aerodrome.finance", category: "DEX & LIQUIDITY" },
  { name: "Fluid", org: "Fluid", repo: "fluid-contracts/public", url: "https://github.com/Instadapp/fluid", projectUrl: "https://fluid.cx", category: "DEX & LIQUIDITY" },
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

const STATUS_CONFIG = {
  ACTIVE:   { color: "#00ff88", bg: "rgba(0,255,136,0.08)", label: "ACTIVE" },
  SLOW:     { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", label: "SLOW" },
  INACTIVE: { color: "#aaaaaa", bg: "rgba(71,85,105,0.1)",  label: "INACTIVE" },
  LOADING:  { color: "#999999", bg: "rgba(51,65,85,0.1)",   label: "LOADING" },
  ERROR:    { color: "#f87171", bg: "rgba(239,68,68,0.06)", label: "ERROR" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "COMMUNITY BUILDS": "#00ff88",
  "DEX & LIQUIDITY":  "#ec4899",
  "LENDING":          "#b6509e",
  "BRIDGES":          "#9333ea",
  "DEV TOOLS":        "#3b82f6",
};

export default function BuildStatusPage() {
  const [repos, setRepos] = useState<RepoStatus[]>(
    REPOS.map(r => ({ ...r, pushedAt: null, stars: null, status: "LOADING", daysAgo: null }))
  );
  const [filter, setFilter] = useState("ALL");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatuses = async () => {
    const updated = await Promise.all(
      REPOS.map(async (r) => {
        try {
          const res = await fetch(`/api/github-status?repo=${r.repo}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          const days = data.pushedAt ? getDaysAgo(data.pushedAt) : null;
          return {
            ...r,
            pushedAt: data.pushedAt,
            stars: data.stars,
            status: getStatus(days),
            daysAgo: days,
          } as RepoStatus;
        } catch {
          return { ...r, pushedAt: null, stars: null, status: "ERROR" as const, daysAgo: null };
        }
      })
    );
    setRepos(updated);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const categories = ["ALL", ...Array.from(new Set(REPOS.map(r => r.category)))];
  const filtered = filter === "ALL" ? repos : repos.filter(r => r.category === filter);

  const activeCount = repos.filter(r => r.status === "ACTIVE").length;
  const slowCount = repos.filter(r => r.status === "SLOW").length;

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff", fontFamily: "var(--font-geist-sans), sans-serif" }}>
      <Navbar />

      {/* HERO */}
      <section style={{ padding: "48px 20px 32px", textAlign: "center", borderBottom: "1px solid rgba(0,255,136,0.06)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(0,255,136,0.15)", background: "rgba(0,0,0,0.6)", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace" }}>LIVE FROM GITHUB API</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw + 2rem, 5.5rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", background: "linear-gradient(180deg,#fff 0%,rgba(255,255,255,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
          Build Status Tracker
        </h1>
        <p style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)", color: "#e5e5e5", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Who's actually shipping in the Arc ecosystem? Live GitHub activity for every project — updated in real time.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "ACTIVE (7d)", value: activeCount, color: "#00ff88" },
            { label: "SLOW (30d)", value: slowCount, color: "#f59e0b" },
            { label: "TOTAL TRACKED", value: REPOS.length, color: "#aaaaaa" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.4rem,5vw,2rem)", fontWeight: 900, color: s.color, fontFamily: "var(--font-geist-mono), monospace" }}><AnimatedNumber value={s.value} /></div>
              <div style={{ fontSize: 9, color: "#aaaaaa", fontWeight: 700, letterSpacing: "0.15em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {lastUpdated && (
          <div style={{ marginTop: 16, fontSize: 9, color: "#999999", fontFamily: "var(--font-geist-mono), monospace" }}>
            LAST UPDATED {lastUpdated.toLocaleTimeString()}
            <button onClick={fetchStatuses} style={{ marginLeft: 12, background: "none", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 5, color: "#00ff88", fontSize: 9, fontFamily: "var(--font-geist-mono), monospace", cursor: "pointer", padding: "2px 8px" }}>
              REFRESH
            </button>
          </div>
        )}
      </section>

      {/* FILTERS */}
      <section style={{ padding: "20px 16px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <motion.button key={cat} whileTap={{ scale: 0.95 }} onClick={() => setFilter(cat)}
              style={{
                padding: "5px 12px", borderRadius: 7,
                border: filter === cat ? "1px solid rgba(0,255,136,0.3)" : "1px solid rgba(0,255,136,0.08)",
                background: filter === cat ? "rgba(0,255,136,0.08)" : "rgba(0,0,0,0.2)",
                color: filter === cat ? "#00ff88" : "#aaaaaa",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "var(--font-geist-mono), monospace", cursor: "pointer",
              }}
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </section>

      {/* REPO LIST */}
      <section style={{ padding: "16px 16px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((repo, i) => {
            const sc = STATUS_CONFIG[repo.status];
            const catColor = CATEGORY_COLORS[repo.category] ?? "#aaaaaa";
            return (
              <motion.div
                key={repo.repo}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
                whileHover={{ y: -2, borderColor: "rgba(0,255,136,0.25)" }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(0,255,136,0.07)", flexWrap: "wrap" }}>

                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.color, flexShrink: 0, animation: repo.status === "ACTIVE" ? "pulse 2s infinite" : "none" }} />

                {/* Name + category */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{repo.name}</div>
                  <span style={{ fontSize: 8, color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}25`, padding: "1px 6px", borderRadius: 4, fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.08em" }}>
                    {repo.category}
                  </span>
                </div>

                {/* Status badge */}
                <div style={{ padding: "3px 10px", borderRadius: 6, background: sc.bg, border: `1px solid ${sc.color}30`, fontSize: 9, fontWeight: 700, color: sc.color, fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.1em", flexShrink: 0 }}>
                  {repo.status === "LOADING" ? "..." : sc.label}
                </div>

                {/* Days ago */}
                <div style={{ fontSize: 11, color: "#aaaaaa", fontFamily: "var(--font-geist-mono), monospace", minWidth: 80, textAlign: "right" }}>
                  {repo.status === "LOADING" ? "—" :
                   repo.status === "ERROR" ? "API error" :
                   repo.daysAgo === 0 ? "today" :
                   repo.daysAgo === 1 ? "1 day ago" :
                   repo.daysAgo !== null ? `${repo.daysAgo}d ago` : "—"}
                </div>

                {/* Stars */}
                {repo.stars !== null && (
                  <div style={{ fontSize: 11, color: "#999999", fontFamily: "var(--font-geist-mono), monospace", minWidth: 50, textAlign: "right" }}>
                    ★ {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}
                  </div>
                )}

                {/* Links */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <a href={repo.url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#999999", fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none", fontWeight: 700, letterSpacing: "0.08em" }}>
                    GITHUB ↗
                  </a>
                  <a href={repo.projectUrl} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#00ff88", fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none", fontWeight: 700, letterSpacing: "0.08em" }}>
                    VISIT ↗
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(0,255,136,0.08)", background: "#000000", padding: "22px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 9, color: "#888888", fontFamily: "var(--font-geist-mono), monospace" }}>MICROAI · ARC & CIRCLE INTELLIGENCE HUB</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ l: "ECOSYSTEM", h: "/ecosystem" }, { l: "GRANTS", h: "/grants" }, { l: "DEBUGGER", h: "/debug" }, { l: "STATS", h: "/stats" }].map(link => (
              <Link key={link.l} href={link.h} style={{ fontSize: 9, color: "#888888", fontWeight: 700, letterSpacing: "0.12em", fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none" }}>{link.l}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
                html, body { background: #000000; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}