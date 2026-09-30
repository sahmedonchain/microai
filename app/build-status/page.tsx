"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";

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

const STATUS_CONFIG = {
  ACTIVE:   { color: "#34d399", bg: "rgba(16,185,129,0.08)", label: "ACTIVE" },
  SLOW:     { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", label: "SLOW" },
  INACTIVE: { color: "#475569", bg: "rgba(71,85,105,0.1)",  label: "INACTIVE" },
  LOADING:  { color: "#334155", bg: "rgba(51,65,85,0.1)",   label: "LOADING" },
  ERROR:    { color: "#f87171", bg: "rgba(239,68,68,0.06)", label: "ERROR" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "OFFICIAL ARC/CIRCLE": "#2563eb",
  "COMMUNITY BUILDS": "#34d399",
  "DEX & LIQUIDITY":  "#ec4899",
  "LENDING":          "#b6509e",
  "BRIDGES":          "#9333ea",
  "DEV TOOLS":        "#3b82f6",
  "INFRASTRUCTURE":   "#64748b",
  "WALLETS":          "#6366f1",
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
    <div style={{ minHeight: "100vh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      {/* HERO */}
      <section style={{ padding: "48px 20px 32px", textAlign: "center", borderBottom: "1px solid rgba(16,185,129,0.06)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.15)", background: "rgba(3,17,10,0.6)", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace" }}>LIVE FROM GITHUB API</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem,6vw,3.2rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", background: "linear-gradient(180deg,#fff 0%,rgba(148,163,184,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
          Build Status Tracker
        </h1>
        <p style={{ fontSize: "clamp(12px,3vw,14px)", color: "#94a3b8", maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Who's actually shipping in the Arc ecosystem? Live GitHub activity for every project — updated in real time.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "ACTIVE (7d)", value: activeCount.toString(), color: "#34d399" },
            { label: "SLOW (30d)", value: slowCount.toString(), color: "#f59e0b" },
            { label: "TOTAL TRACKED", value: REPOS.length.toString(), color: "#94a3b8" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.4rem,5vw,2rem)", fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {lastUpdated && (
          <div style={{ marginTop: 16, fontSize: 9, color: "#334155", fontFamily: "monospace" }}>
            LAST UPDATED {lastUpdated.toLocaleTimeString()}
            <button onClick={fetchStatuses} style={{ marginLeft: 12, background: "none", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 5, color: "#34d399", fontSize: 9, fontFamily: "monospace", cursor: "pointer", padding: "2px 8px" }}>
              REFRESH
            </button>
          </div>
        )}
      </section>

      {/* FILTERS */}
      <section style={{ padding: "20px 16px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{
                padding: "5px 12px", borderRadius: 7,
                border: filter === cat ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(16,185,129,0.08)",
                background: filter === cat ? "rgba(16,185,129,0.08)" : "rgba(0,0,0,0.2)",
                color: filter === cat ? "#34d399" : "#64748b",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace", cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* REPO LIST */}
      <section style={{ padding: "16px 16px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((repo) => {
            const sc = STATUS_CONFIG[repo.status];
            const catColor = CATEGORY_COLORS[repo.category] ?? "#64748b";
            return (
              <div key={repo.repo} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(3,17,10,0.2)", border: "1px solid rgba(16,185,129,0.07)", flexWrap: "wrap" }}>

                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.color, flexShrink: 0, animation: repo.status === "ACTIVE" ? "pulse 2s infinite" : "none" }} />

                {/* Name + category */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{repo.name}</div>
                  <span style={{ fontSize: 8, color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}25`, padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", letterSpacing: "0.08em" }}>
                    {repo.category}
                  </span>
                </div>

                {/* Status badge */}
                <div style={{ padding: "3px 10px", borderRadius: 6, background: sc.bg, border: `1px solid ${sc.color}30`, fontSize: 9, fontWeight: 700, color: sc.color, fontFamily: "monospace", letterSpacing: "0.1em", flexShrink: 0 }}>
                  {repo.status === "LOADING" ? "..." : sc.label}
                </div>

                {/* Days ago */}
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", minWidth: 80, textAlign: "right" }}>
                  {repo.status === "LOADING" ? "—" :
                   repo.status === "ERROR" ? "API error" :
                   repo.daysAgo === 0 ? "today" :
                   repo.daysAgo === 1 ? "1 day ago" :
                   repo.daysAgo !== null ? `${repo.daysAgo}d ago` : "—"}
                </div>

                {/* Stars */}
                {repo.stars !== null && (
                  <div style={{ fontSize: 11, color: "#334155", fontFamily: "monospace", minWidth: 50, textAlign: "right" }}>
                    ★ {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}
                  </div>
                )}

                {/* Links */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <a href={repo.url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", textDecoration: "none", fontWeight: 700, letterSpacing: "0.08em" }}>
                    GITHUB ↗
                  </a>
                  <a href={repo.projectUrl} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#34d399", fontFamily: "monospace", textDecoration: "none", fontWeight: 700, letterSpacing: "0.08em" }}>
                    VISIT ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(16,185,129,0.08)", background: "#010402", padding: "22px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 9, color: "#1e3a29", fontFamily: "monospace" }}>MICROAI · ARC & CIRCLE INTELLIGENCE HUB</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ l: "ECOSYSTEM", h: "/ecosystem" }, { l: "GRANTS", h: "/grants" }, { l: "DEBUGGER", h: "/debug" }, { l: "STATS", h: "/stats" }].map(link => (
              <Link key={link.l} href={link.h} style={{ fontSize: 9, color: "#1e3a29", fontWeight: 700, letterSpacing: "0.12em", fontFamily: "monospace", textDecoration: "none" }}>{link.l}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        html, body { background: #010503; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}