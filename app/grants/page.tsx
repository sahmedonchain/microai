"use client";
import { Navbar } from "@/app/components/Navbar";
import React, { useState } from "react";
import Link from "next/link";

const grants = [
  // ===== LIVE / OPEN =====
  {
    id: 1,
    type: "GRANT",
    status: "OPEN",
    org: "DoraHacks x Arc",
    title: "Arc Microgrants",
    desc: "20 microgrants of $500 USDC each, from a $10,000 pool, for projects already deployed and working on Arc MAINNET — PoC, small apps, demos, hackathon continuations. No company or traction required. Pseudonymous submission allowed.",
    reward: "$500 USDC each",
    deadline: "Oct 14, 2026, 23:59 ET",
    tags: ["Microgrant", "USDC", "Arc MAINNET", "Rolling Review"],
    url: "https://dorahacks.io/hackathon/arc-microgrants",
    logo: "MG",
    logoColor: "#34d399",
  },
  {
    id: 2,
    type: "GRANT",
    status: "OPEN — ROLLING",
    org: "Circle",
    title: "Circle Developer Grants (2026 Cohort 2)",
    desc: "Milestone-based USDC funding, mentorship, and co-marketing for production-grade apps on Arc and the Circle Developer Platform. Focus areas: onchain lending, capital markets, FX, agentic commerce, payments, treasury management, prediction markets. ~$204K available this cohort. Traction, pilot, or revenue proof prioritized.",
    reward: "~$204K pool",
    deadline: "Rolling",
    tags: ["USDC", "Arc", "Payments", "AI Agents", "Treasury"],
    url: "https://circle.com/grant",
    logo: "C",
    logoColor: "#2563eb",
  },
  {
    id: 3,
    type: "HACKATHON",
    status: "LIVE NOW",
    org: "Canteen x Circle x Arc",
    title: "Tameion Agents Hackathon",
    desc: "Builder series for AI agents that hold, allocate, and disburse a business's money — treasury, invoices, contractors, autonomous operations, audit trail. Settled on Arc in USDC.",
    reward: "~$40,000 pool",
    deadline: "Sep 27 – Oct 10, 2026",
    tags: ["AI Agents", "Treasury", "USDC", "Canteen"],
    url: "https://tameion.thecanteenapp.com/",
    logo: "TM",
    logoColor: "#a78bfa",
  },
  {
    id: 4,
    type: "ACCELERATOR",
    status: "IN PROGRESS",
    org: "Circle x Arc x Crecimiento",
    title: "Arc Acceleration Season",
    desc: "6-week accelerator: onboard, build on testnet, ship on mainnet, Demo Day. Primarily for LatAm fintech and AI startups with existing traction, with direct support from the Circle/Arc team. Applications closed Sep 22 — program is actively running.",
    reward: "Accelerator + Mentorship",
    deadline: "Sep 22 – Oct 24, 2026",
    tags: ["Accelerator", "LatAm", "Fintech", "AI"],
    url: "https://crecimiento.build",
    logo: "AS",
    logoColor: "#f59e0b",
  },
  {
    id: 5,
    type: "BOUNTY",
    status: "OPEN — ONGOING",
    org: "Arc",
    title: "Arc Bug Bounty Program",
    desc: "HackerOne-hosted, ongoing, no fixed deadline. Rewards: Extreme (unlimited mint, consensus failure) up to $1,000,000; Critical $20K–$200K; High $10K–$20K; Medium/Low lower tiers.",
    reward: "Up to $1,000,000",
    deadline: "Ongoing",
    tags: ["Security", "HackerOne", "MAINNET"],
    url: "https://hackerone.com/arc-bbp",
    logo: "A",
    logoColor: "#10b981",
  },
  {
    id: 6,
    type: "BOUNTY",
    status: "OPEN — ROLLING",
    org: "Circle",
    title: "Circle Developer Bounties",
    desc: "Specific integration challenges — USDC, CCTP, Paymaster, Wallets — for USDC rewards. $20,000 total pool, $1,500 per challenge, multiple winners possible. New bounties added on a rolling basis.",
    reward: "$1,500 per challenge",
    deadline: "Rolling",
    tags: ["USDC", "CCTP", "Paymaster", "Wallets"],
    url: "https://circle.com/grant",
    logo: "CB",
    logoColor: "#2563eb",
  },
  {
    id: 7,
    type: "PROGRAM",
    status: "OPEN — ONGOING",
    org: "Arc",
    title: "Arc Architects Program",
    desc: "Community contribution rewards for hackathons, meetups, content, and beta testing. Points-based system (not token/airdrop) granting ecosystem visibility and special access. Ongoing, rolling.",
    reward: "Points + Access",
    deadline: "Ongoing",
    tags: ["Community", "Contribution", "Points"],
    url: "https://community.arc.io",
    logo: "AR",
    logoColor: "#60a5fa",
  },
  // ===== UPCOMING =====
  {
    id: 8,
    type: "EVENT",
    status: "UPCOMING",
    org: "Circle",
    title: "Circle House @ TOKEN2049 Singapore",
    desc: "In-person Circle House at TOKEN2049 Singapore.",
    reward: "—",
    deadline: "Oct 7–8, 2026",
    tags: ["In-Person", "Singapore", "TOKEN2049"],
    url: "https://community.arc.io/public/events",
    logo: "T2",
    logoColor: "#a5b4fc",
  },
  {
    id: 9,
    type: "EVENT",
    status: "UPCOMING",
    org: "Arc",
    title: "Arc Community Co-working",
    desc: "In-person Arc builder co-working session in London.",
    reward: "Free",
    deadline: "Oct 12, 2026",
    tags: ["In-Person", "London", "Community"],
    url: "https://community.arc.io/public/events",
    logo: "AC",
    logoColor: "#a5b4fc",
  },
  {
    id: 10,
    type: "HACKATHON",
    status: "UPCOMING",
    org: "Encode",
    title: "Encode London Hackathon & Conference",
    desc: "Hackathon and conference in London.",
    reward: "TBA",
    deadline: "Oct 23, 2026",
    tags: ["Encode", "London", "Conference"],
    url: "https://encode.club",
    logo: "EN",
    logoColor: "#a5b4fc",
  },
  {
    id: 11,
    type: "EVENT",
    status: "UPCOMING",
    org: "Arc",
    title: "Arc Demos & Meetup",
    desc: "In-person Arc builder demos and meetup in London.",
    reward: "Free",
    deadline: "Oct 26, 2026",
    tags: ["In-Person", "London", "Demos"],
    url: "https://community.arc.io/public/events",
    logo: "AD",
    logoColor: "#a5b4fc",
  },
  {
    id: 12,
    type: "EVENT",
    status: "UPCOMING",
    org: "Pragma",
    title: "Pragma Mumbai",
    desc: "In-person conference in Mumbai.",
    reward: "—",
    deadline: "Nov 5, 2026",
    tags: ["Conference", "Mumbai"],
    url: "https://community.arc.io/public/events",
    logo: "PG",
    logoColor: "#a5b4fc",
  },
  {
    id: 13,
    type: "HACKATHON",
    status: "UPCOMING",
    org: "ETHGlobal x Arc",
    title: "ETHGlobal Mumbai",
    desc: "In-person ETHGlobal hackathon in Mumbai. Arc typically sponsors a $10K–$15K USDC track.",
    reward: "$10K–$15K USDC (typical)",
    deadline: "Nov 6–8, 2026",
    tags: ["ETHGlobal", "Mumbai", "USDC"],
    url: "https://ethglobal.com/events",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  // ===== ENDED =====
  {
    id: 14,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc",
    title: "ETHOnline 2026 — Arc Track",
    desc: "$10K total: $5K for testnet submission, $5K for mainnet push.",
    reward: "$10,000 USDC",
    deadline: "Ended Sep 30, 2026",
    tags: ["ETHGlobal", "Arc", "USDC"],
    url: "https://ethglobal.com/events",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 15,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc x Circle",
    title: "ETHGlobal Tokyo",
    desc: "In-person ETHGlobal hackathon in Tokyo.",
    reward: "TBA",
    deadline: "Sep 25–27, 2026",
    tags: ["ETHGlobal", "Tokyo"],
    url: "https://ethglobal.com/events",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 16,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc x Circle",
    title: "HackMoney 2026 — Arc Track",
    desc: "155 teams built on Arc MAINNET. $10,000 USDC awarded across 3 tracks: chain-abstracted USDC apps, global treasury systems, agentic commerce.",
    reward: "$10,000 USDC",
    deadline: "Mar 2026",
    tags: ["ETHGlobal", "CCTP", "AI Agents", "Treasury"],
    url: "https://community.arc.io/public/events/ethglobal-hack-money-defi-hackathon-x4185sibue",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 17,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc",
    title: "ETHGlobal Cannes — Arc Track",
    desc: "Arc sponsored bounties for builders powering onchain lending, capital markets, FX, and payments.",
    reward: "$15,000 USDC",
    deadline: "Apr 2026",
    tags: ["ETHGlobal", "Cannes", "Lending", "FX"],
    url: "https://community.arc.io/public/events/ethglobal-cannes-hackathon-aejsg2lm44",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 18,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc x Circle",
    title: "ETHGlobal New York 2026",
    desc: "In-person ETHGlobal hackathon. Circle sponsored Arc-track bounties for stablecoin payments, wallets, and onchain financial apps.",
    reward: "$15,000 USDC",
    deadline: "Jun 12–14, 2026",
    tags: ["ETHGlobal", "Arc", "USDC", "New York"],
    url: "https://community.arc.io/public/events/ethglobal-new-york-2026-2wbc20jux8",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 19,
    type: "HACKATHON",
    status: "ENDED",
    org: "Canteen x Circle x Arc",
    title: "Lepton Agents Hackathon",
    desc: "Two-week builder series for AI agents that pay, receive, and orchestrate nanopayments — settled on Arc. Six published Requests for Builders (RFBs) with concrete buildable angles.",
    reward: "$50,000",
    deadline: "Jun 2026",
    tags: ["AI Agents", "Nanopayments", "Canteen", "USDC"],
    url: "https://community.arc.io/public/events/hackathon-lepton-agents-ohhczsazvd",
    logo: "L",
    logoColor: "#a78bfa",
  },
  {
    id: 20,
    type: "HACKATHON",
    status: "ENDED",
    org: "Encode",
    title: "Programmable Money Hackathon",
    desc: "Online + in-person hackathon on programmable money, organized by Encode.",
    reward: "TBA",
    deadline: "Jul–Aug 2026",
    tags: ["Encode", "Programmable Money"],
    url: "https://encode.club",
    logo: "PM",
    logoColor: "#60a5fa",
  },
  {
    id: 21,
    type: "HACKATHON",
    status: "ENDED",
    org: "Canteen x Circle x Arc",
    title: "Agora Agents Hackathon",
    desc: "AI agents that trade, invest, create, and interface with markets, settled on Arc using USDC. Winners: Mimir Markets (AI Oracle prediction market), Precall (USDC-bonded prediction calls, 68% win rate), Archimedes (quant finance + arXiv research system). All projects open source.",
    reward: "~$50,000",
    deadline: "May 2026",
    tags: ["AI Agents", "Canteen", "USDC", "Open Source"],
    url: "https://arc-showcase.thecanteenapp.com/",
    logo: "AG",
    logoColor: "#a78bfa",
  },
  {
    id: 22,
    type: "HACKATHON",
    status: "ENDED",
    org: "Circle",
    title: "USDC OpenClaw Hackathon",
    desc: "USDC-focused open hackathon.",
    reward: "$30,000",
    deadline: "Feb 2026",
    tags: ["USDC", "Open Hackathon"],
    url: "https://circle.com/grant",
    logo: "OC",
    logoColor: "#2563eb",
  },
  {
    id: 23,
    type: "GRANT",
    status: "ENDED",
    org: "Circle",
    title: "Circle Developer Grants — Cohort 1",
    desc: "Closed. Funded Africa/Global South-focused teams: Blockradar, Kolan, Myaza, Payrit, ViFi, SFx Money.",
    reward: "Closed",
    deadline: "Closed",
    tags: ["USDC", "Africa", "Global South"],
    url: "https://circle.com/grant",
    logo: "C",
    logoColor: "#2563eb",
  },
];

const FILTER_TYPES = ["ALL", "GRANT", "HACKATHON", "BOUNTY", "ACCELERATOR", "PROGRAM", "EVENT"];
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "OPEN":            { bg: "rgba(16,185,129,0.08)", text: "#34d399", dot: "#34d399" },
  "OPEN — ONGOING":  { bg: "rgba(16,185,129,0.08)", text: "#34d399", dot: "#34d399" },
  "OPEN — ROLLING":  { bg: "rgba(16,185,129,0.08)", text: "#34d399", dot: "#34d399" },
  "LIVE NOW":        { bg: "rgba(239,68,68,0.08)",  text: "#f87171", dot: "#f87171" },
  "IN PROGRESS":     { bg: "rgba(245,158,11,0.08)", text: "#fbbf24", dot: "#fbbf24" },
  "UPCOMING":        { bg: "rgba(99,102,241,0.08)", text: "#a5b4fc", dot: "#a5b4fc" },
  "ENDED":           { bg: "rgba(71,85,105,0.15)",  text: "#64748b", dot: "#475569" },
};
const TYPE_COLORS: Record<string, string> = {
  GRANT:       "#34d399",
  BOUNTY:      "#f59e0b",
  HACKATHON:   "#a78bfa",
  ACCELERATOR: "#fb923c",
  PROGRAM:     "#38bdf8",
  EVENT:       "#60a5fa",
};

function isActiveStatus(status: string) {
  return status.startsWith("OPEN") || status === "LIVE NOW" || status === "IN PROGRESS";
}

export default function GrantsPage() {
  const [filter, setFilter] = useState("ALL");
  const [showEnded, setShowEnded] = useState(false);

  const filtered = filter === "ALL" ? grants : grants.filter((g) => g.type === filter);
  const activeList = filtered.filter((g) => isActiveStatus(g.status));
  const upcomingList = filtered.filter((g) => g.status === "UPCOMING");
  const endedList = filtered.filter((g) => g.status === "ENDED");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#010503",
        color: "#e2e8f0",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Navbar />

      {/* HERO */}
      <section
        style={{
          position: "relative",
          padding: "48px 20px 36px",
          textAlign: "center",
          borderBottom: "1px solid rgba(16,185,129,0.06)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 20,
            border: "1px solid rgba(16,185,129,0.15)",
            background: "rgba(3,17,10,0.6)",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#34d399",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: "#34d399",
              fontWeight: 700,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
            }}
          >
            LIVE OPPORTUNITIES
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(1.6rem, 6vw, 3.5rem)",
            fontWeight: 900,
            lineHeight: 1.1,
            margin: "0 0 14px",
            background: "linear-gradient(180deg, #fff 0%, rgba(148,163,184,0.5) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Arc & Circle<br />Grants & Hackathons
        </h1>

        <p
          style={{
            fontSize: "clamp(12px, 3vw, 14px)",
            color: "#94a3b8",
            maxWidth: 480,
            margin: "0 auto 28px",
            lineHeight: 1.7,
          }}
        >
          All active grants, bounties, and hackathons from the Arc and Circle ecosystem — updated and curated for builders.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "OPEN NOW", value: grants.filter((g) => isActiveStatus(g.status)).length.toString() },
            { label: "TOTAL LISTINGS", value: grants.length.toString() },
            { label: "MAX PRIZE", value: "$1M" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "clamp(1.4rem, 5vw, 2rem)",
                  fontWeight: 900,
                  color: "#34d399",
                  fontFamily: "monospace",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ padding: "24px 16px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTER_TYPES.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border:
                  filter === f
                    ? "1px solid rgba(52,211,153,0.4)"
                    : "1px solid rgba(16,185,129,0.1)",
                background:
                  filter === f
                    ? "rgba(16,185,129,0.1)"
                    : "rgba(0,0,0,0.2)",
                color: filter === f ? "#34d399" : "#64748b",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                fontFamily: "monospace",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#475569", alignSelf: "center", fontFamily: "monospace" }}>
            {filtered.length} RESULT{filtered.length !== 1 ? "S" : ""}
          </div>
        </div>
      </section>

      {/* LIVE / OPEN */}
      <section style={{ padding: "20px 16px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
          LIVE &amp; OPEN NOW ({activeList.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {activeList.map((grant) => (
            <GrantCard key={grant.id} grant={grant} />
          ))}
          {activeList.length === 0 && (
            <div style={{ padding: "20px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
              No open opportunities for this filter.
            </div>
          )}
        </div>
      </section>

      {/* UPCOMING */}
      <section style={{ padding: "36px 16px 0", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: "#a5b4fc", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
          UPCOMING ({upcomingList.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {upcomingList.map((grant) => (
            <GrantCard key={grant.id} grant={grant} />
          ))}
          {upcomingList.length === 0 && (
            <div style={{ padding: "20px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
              No upcoming events for this filter.
            </div>
          )}
        </div>
      </section>

      {/* ENDED (collapsible) */}
      <section style={{ padding: "36px 16px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <button
          onClick={() => setShowEnded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: showEnded ? 12 : 0,
          }}
        >
          <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            ENDED ({endedList.length})
          </span>
          <span style={{ fontSize: 9, color: "#475569" }}>{showEnded ? "▲ HIDE" : "▼ SHOW"}</span>
        </button>
        {showEnded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: 0.75 }}>
            {endedList.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section
        style={{
          borderTop: "1px solid rgba(16,185,129,0.06)",
          padding: "40px 16px",
          textAlign: "center",
          background: "rgba(2,11,6,0.4)",
        }}
      >
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.25em", fontFamily: "monospace", marginBottom: 12 }}>
          NOT SURE WHERE TO START?
        </div>
        <h2
          style={{
            fontSize: "clamp(1.2rem, 4vw, 2rem)",
            fontWeight: 900,
            color: "#fff",
            margin: "0 0 12px",
          }}
        >
          Ask MicroAI
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.65 }}>
          Get personalized guidance on which grant or hackathon fits your project — straight from the Arc & Circle Intelligence Hub.
        </p>
        <Link
          href="/chat"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 12,
            background: "#10b981",
            color: "#000",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textDecoration: "none",
            boxShadow: "0 0 18px rgba(16,185,129,0.2)",
          }}
        >
          LAUNCH CHAT TERMINAL →
        </Link>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid rgba(16,185,129,0.08)",
          background: "#010402",
          padding: "24px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#34d399",
              }}
            >
              M
            </div>
            <div style={{ fontSize: 10, color: "#475569" }}>MICROAI · THE ARC & CIRCLE HUB</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              { l: "ARC", h: "https://arc.io" },
              { l: "CIRCLE", h: "https://circle.com" },
              { l: "GITHUB", h: "https://github.com/sahmedonchain/microai" },
              { l: "EXPLORER", h: "https://explorer.arc.io" },
            ].map((link) => (
              <a
                key={link.l}
                href={link.h}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 10,
                  color: "#475569",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                  textDecoration: "none",
                }}
              >
                {link.l}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        html, body { background: #010503; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function GrantCard({ grant }: { grant: (typeof grants)[number] }) {
  const sc = STATUS_COLORS[grant.status] ?? STATUS_COLORS["ENDED"];
  return (
    <div
      style={{
        background: "rgba(3,17,10,0.2)",
        border: "1px solid rgba(16,185,129,0.08)",
        borderRadius: 16,
        padding: "20px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isActiveStatus(grant.status) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.25), transparent)",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `${grant.logoColor}18`,
            border: `1px solid ${grant.logoColor}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 900,
            color: grant.logoColor,
            flexShrink: 0,
            fontFamily: "monospace",
          }}
        >
          {grant.logo}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                color: TYPE_COLORS[grant.type] ?? "#94a3b8",
                background: `${TYPE_COLORS[grant.type]}15`,
                border: `1px solid ${TYPE_COLORS[grant.type]}25`,
                padding: "2px 8px",
                borderRadius: 5,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
              }}
            >
              {grant.type}
            </span>

            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: sc.text,
                background: sc.bg,
                padding: "2px 8px",
                borderRadius: 5,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: sc.dot,
                  display: "inline-block",
                  animation: grant.status !== "ENDED" ? "pulse 2s infinite" : undefined,
                }}
              />
              {grant.status}
            </span>

            <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>
              {grant.org}
            </span>
          </div>

          <div
            style={{
              fontSize: "clamp(13px, 3.5vw, 15px)",
              fontWeight: 800,
              color: "#fff",
              marginBottom: 8,
              lineHeight: 1.3,
            }}
          >
            {grant.title}
          </div>

          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65, margin: "0 0 12px" }}>
            {grant.desc}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {grant.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 9,
                  color: "#475569",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "2px 8px",
                  borderRadius: 5,
                  fontFamily: "monospace",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 8, color: "#475569", fontFamily: "monospace", marginBottom: 2 }}>
                  REWARD
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>{grant.reward}</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: "#475569", fontFamily: "monospace", marginBottom: 2 }}>
                  DEADLINE
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{grant.deadline}</div>
              </div>
            </div>

            <a
              href={grant.url}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                background: grant.status === "ENDED" ? "rgba(255,255,255,0.03)" : "rgba(16,185,129,0.1)",
                border: grant.status === "ENDED" ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(52,211,153,0.25)",
                color: grant.status === "ENDED" ? "#475569" : "#34d399",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textDecoration: "none",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              {grant.status === "ENDED" ? "VIEW RECAP →" : "APPLY NOW →"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}