"use client";
import { Navbar } from "@/app/components/Navbar";
import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/app/components/AnimatedNumber";

const grants = [
  // ===== GRANTS =====
  {
    id: 1,
    type: "GRANT",
    status: "OPEN",
    org: "Circle",
    title: "Circle Developer Grant Program",
    desc: "Milestone-based funding for teams building production-grade apps on Arc & Circle platform. Focus areas: payments, treasury, FX, agentic economy.",
    reward: "$5K – $100K USDC",
    deadline: "Rolling",
    tags: ["USDC", "Arc", "Payments", "AI Agents"],
    url: "https://www.circle.com/grant",
    logo: "C",
    logoColor: "#2563eb",
  },
  // ===== BOUNTY =====
  {
    id: 2,
    type: "BOUNTY",
    status: "OPEN",
    org: "Arc",
    title: "Arc Bug Bounty Program",
    desc: "HackerOne-hosted security bounty for Arc MAINNET. Submit reproducible findings on network safety, liveness, or correctness. Test locally only.",
    reward: "Varies",
    deadline: "Ongoing",
    tags: ["Security", "HackerOne", "MAINNET"],
    url: "https://www.arc.io/blog/open-sourcing-arc-run-your-own-arc-node-and-bug-bounty-program",
    logo: "A",
    logoColor: "#00ff88",
  },
  // ===== LIVE NOW =====
  {
    id: 3,
    type: "HACKATHON",
    status: "LIVE NOW",
    org: "Arc x Circle",
    title: "Hackathon: Programmable Money",
    desc: "Build real products on Arc in 4 weeks. Top teams win places in an 8-week accelerator programme with weekly workshops, 1-1 mentorship, and a direct path to launch. Use Circle's full dev stack — Wallets, CCTP, Gateway, Paymaster, Nanopayments.",
    reward: "8-Week Accelerator",
    deadline: "Jul 13 – Aug 22, 2026",
    tags: ["Accelerator", "USDC", "Arc", "Online", "Circle Stack"],
    url: "https://community.arc.io/public/events/hackathon-programmable-money-74llz8htis",
    logo: "PM",
    logoColor: "#00ff88",
  },
  {
    id: 4,
    type: "HACKATHON",
    status: "LIVE NOW",
    org: "Arc x Circle",
    title: "Stablecoins Commerce Stack Challenge",
    desc: "The official Arc + Circle hackathon. Build on the stablecoin commerce stack — payments, treasury, agentic economy, FX. Online + in-person. Running Apr 14 – Jul 13.",
    reward: "TBA",
    deadline: "Apr 14 – Jul 13, 2026",
    tags: ["USDC", "Commerce", "Arc", "Circle", "Agentic"],
    url: "https://community.arc.io/public/events/hackathon-the-stablecoins-commerce-stack-challenge-ozc0ih6kba",
    logo: "S",
    logoColor: "#00ff88",
  },
  // ===== UPCOMING =====
  {
    id: 5,
    type: "HACKATHON",
    status: "UPCOMING",
    org: "ETHGlobal x Arc",
    title: "ETHGlobal Cannes Hackathon",
    desc: "Arc sponsoring $15,000 in bounties for builders powering the next era of onchain lending, capital markets, FX, and payments. In-person ETHGlobal hackathon in Cannes.",
    reward: "$15,000 USDC",
    deadline: "Jul 2026",
    tags: ["ETHGlobal", "Cannes", "Lending", "FX", "Capital Markets"],
    url: "https://community.arc.io/public/events/ethglobal-cannes-hackathon-aejsg2lm44",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 6,
    type: "HACKATHON",
    status: "UPCOMING",
    org: "ETHGlobal x Circle",
    title: "ETHGlobal Lisbon 2026",
    desc: "Next major ETHGlobal in-person hackathon. Circle & Arc expected to sponsor bounty tracks. Build on Arc MAINNET for prizes.",
    reward: "TBA",
    deadline: "Jul 24–26, 2026",
    tags: ["ETHGlobal", "Lisbon", "Arc", "USDC"],
    url: "https://ethglobal.com/events",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 7,
    type: "EVENT",
    status: "UPCOMING",
    org: "Arc",
    title: "Buenos Aires Community Meetup",
    desc: "In-person Arc builder meetup in Buenos Aires. Network with local builders, share projects, and explore Arc ecosystem opportunities in Latin America.",
    reward: "Free",
    deadline: "Aug 5, 2026",
    tags: ["In-Person", "Argentina", "Community", "LATAM"],
    url: "https://community.arc.io/public/events",
    logo: "AR",
    logoColor: "#f59e0b",
  },
  // ===== ENDED =====
  {
    id: 8,
    type: "HACKATHON",
    status: "ENDED",
    org: "Canteen x Arc x Circle",
    title: "Agora Hackathon — AI Agents on Arc",
    desc: "Build AI agents that trade, invest, create, and interface with markets, settled on Arc using USDC. Winners: Mimir Markets (AI Oracle prediction market), Precall (USDC-bonded prediction calls, 68% win rate), Archimedes (quant finance + arXiv research system). All projects open source.",
    reward: "TBA",
    deadline: "Jul 2026",
    tags: ["AI Agents", "Canteen", "USDC", "Open Source"],
    url: "https://arc-showcase.thecanteenapp.com/",
    logo: "AG",
    logoColor: "#a78bfa",
  },
  {
    id: 9,
    type: "HACKATHON",
    status: "ENDED",
    org: "Canteen x Arc x Circle",
    title: "Lepton Agents Hackathon",
    desc: "Two-week builder series for AI agents that pay, receive, and orchestrate nanopayments — settled on Arc. $50K prize pool. Six published Requests for Builders (RFBs) with concrete buildable angles.",
    reward: "$50,000",
    deadline: "Jun 15–29, 2026",
    tags: ["AI Agents", "Nanopayments", "Canteen", "USDC"],
    url: "https://community.arc.io/public/events/hackathon-lepton-agents-ohhczsazvd",
    logo: "L",
    logoColor: "#a78bfa",
  },
  {
    id: 10,
    type: "HACKATHON",
    status: "ENDED",
    org: "ETHGlobal x Arc x Circle",
    title: "ETHGlobal New York 2026",
    desc: "In-person ETHGlobal hackathon. Circle sponsored Arc-track bounties for stablecoin payments, wallets, and onchain financial apps.",
    reward: "Arc Track Bounties",
    deadline: "Jun 12–14, 2026",
    tags: ["ETHGlobal", "Arc", "USDC", "In-Person", "New York"],
    url: "https://community.arc.io/public/events/ethglobal-new-york-2026-2wbc20jux8",
    logo: "E",
    logoColor: "#8b5cf6",
  },
  {
    id: 11,
    type: "HACKATHON",
    status: "ENDED",
    org: "Arc x Circle x lablab.ai",
    title: "Agentic Economy on Arc Hackathon",
    desc: "Hybrid hackathon using Circle Nanopayments + Arc for sub-cent agentic transactions. $10,000 prize pool. Online + SF on-site finale.",
    reward: "$10,000 USDC",
    deadline: "Apr 20–26, 2026",
    tags: ["Nanopayments", "AI Agents", "USDC", "lablab.ai"],
    url: "https://community.arc.io/public/events/agentic-economy-on-arc-hackathon-xoayqenc6j",
    logo: "AE",
    logoColor: "#f59e0b",
  },
  {
    id: 12,
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
];

const FILTER_TYPES = ["ALL", "GRANT", "HACKATHON", "BOUNTY", "EVENT"];
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "OPEN":     { bg: "rgba(0,255,136,0.08)", text: "#00ff88", dot: "#00ff88" },
  "LIVE NOW": { bg: "rgba(239,68,68,0.08)",  text: "#f87171", dot: "#f87171" },
  "UPCOMING": { bg: "rgba(99,102,241,0.08)", text: "#a5b4fc", dot: "#a5b4fc" },
  "ENDED":    { bg: "rgba(71,85,105,0.15)",  text: "#888888", dot: "#666666" },
};
const TYPE_COLORS: Record<string, string> = {
  GRANT:     "#00ff88",
  BOUNTY:    "#f59e0b",
  HACKATHON: "#a78bfa",
  EVENT:     "#60a5fa",
};

export default function GrantsPage() {
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? grants : grants.filter((g) => g.type === filter);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#ffffff",
        fontFamily: "var(--font-geist-sans), sans-serif",
      }}
    >
      <Navbar />

      {/* HERO */}
      <section
        style={{
          position: "relative",
          padding: "48px 20px 36px",
          textAlign: "center",
          borderBottom: "1px solid rgba(0,255,136,0.06)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 20,
            border: "1px solid rgba(0,255,136,0.15)",
            background: "rgba(0,0,0,0.6)",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00ff88",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: "#00ff88",
              fontWeight: 700,
              letterSpacing: "0.15em",
              fontFamily: "var(--font-geist-mono), monospace",
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
            background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
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
            color: "#888888",
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
            { label: "OPEN NOW", num: grants.filter((g) => g.status === "OPEN" || g.status === "LIVE NOW").length },
            { label: "TOTAL LISTINGS", num: grants.length },
            { label: "MAX PRIZE", value: "$100K" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "clamp(1.4rem, 5vw, 2rem)",
                  fontWeight: 900,
                  color: "#00ff88",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {s.num !== undefined ? <AnimatedNumber value={s.num} /> : s.value}
              </div>
              <div style={{ fontSize: 9, color: "#666666", fontWeight: 700, letterSpacing: "0.15em" }}>
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
            <motion.button
              key={f}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border:
                  filter === f
                    ? "1px solid rgba(0,255,136,0.4)"
                    : "1px solid rgba(0,255,136,0.1)",
                background:
                  filter === f
                    ? "rgba(0,255,136,0.1)"
                    : "rgba(0,0,0,0.2)",
                color: filter === f ? "#00ff88" : "#888888",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                fontFamily: "var(--font-geist-mono), monospace",
                cursor: "pointer",
              }}
            >
              {f}
            </motion.button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#666666", alignSelf: "center", fontFamily: "var(--font-geist-mono), monospace" }}>
            {filtered.length} RESULT{filtered.length !== 1 ? "S" : ""}
          </div>
        </div>
      </section>

      {/* GRANT CARDS */}
      <section style={{ padding: "20px 16px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((grant, i) => {
            const sc = STATUS_COLORS[grant.status] ?? STATUS_COLORS["ENDED"];
            return (
              <motion.div
                key={grant.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
                whileHover={{ y: -3, borderColor: "rgba(0,255,136,0.25)" }}
                style={{
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(0,255,136,0.08)",
                  borderRadius: 16,
                  padding: "20px 18px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {(grant.status === "OPEN" || grant.status === "LIVE NOW") && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      background:
                        "linear-gradient(90deg, transparent, rgba(0,255,136,0.25), transparent)",
                    }}
                  />
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
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
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    {grant.logo}
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 800,
                          color: TYPE_COLORS[grant.type] ?? "#888888",
                          background: `${TYPE_COLORS[grant.type]}15`,
                          border: `1px solid ${TYPE_COLORS[grant.type]}25`,
                          padding: "2px 8px",
                          borderRadius: 5,
                          fontFamily: "var(--font-geist-mono), monospace",
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
                          fontFamily: "var(--font-geist-mono), monospace",
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
                            animation:
                              grant.status !== "ENDED" ? "pulse 2s infinite" : undefined,
                          }}
                        />
                        {grant.status}
                      </span>

                      <span
                        style={{
                          fontSize: 9,
                          color: "#666666",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
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

                    <p
                      style={{
                        fontSize: 12,
                        color: "#888888",
                        lineHeight: 1.65,
                        margin: "0 0 12px",
                      }}
                    >
                      {grant.desc}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      {grant.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 9,
                            color: "#666666",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            padding: "2px 8px",
                            borderRadius: 5,
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <div>
                          <div
                            style={{ fontSize: 8, color: "#666666", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 2 }}
                          >
                            REWARD
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>
                            {grant.reward}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{ fontSize: 8, color: "#666666", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 2 }}
                          >
                            DEADLINE
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#888888" }}>
                            {grant.deadline}
                          </div>
                        </div>
                      </div>

                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "8px 18px",
                          borderRadius: 10,
                          background:
                            grant.status === "ENDED"
                              ? "rgba(255,255,255,0.03)"
                              : "rgba(0,255,136,0.1)",
                          border:
                            grant.status === "ENDED"
                              ? "1px solid rgba(255,255,255,0.07)"
                              : "1px solid rgba(0,255,136,0.25)",
                          color: grant.status === "ENDED" ? "#666666" : "#00ff88",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textDecoration: "none",
                          fontFamily: "var(--font-geist-mono), monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {grant.status === "ENDED" ? "VIEW RECAP →" : "APPLY NOW →"}
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          borderTop: "1px solid rgba(0,255,136,0.06)",
          padding: "40px 16px",
          textAlign: "center",
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.25em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>
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
        <p style={{ fontSize: 13, color: "#888888", maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.65 }}>
          Get personalized guidance on which grant or hackathon fits your project — straight from the Arc & Circle Intelligence Hub.
        </p>
        <Link
          href="/chat"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 12,
            background: "#00ff88",
            color: "#000",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textDecoration: "none",
            boxShadow: "0 0 18px rgba(0,255,136,0.2)",
          }}
        >
          LAUNCH CHAT TERMINAL →
        </Link>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid rgba(0,255,136,0.08)",
          background: "#000000",
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
                background: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#00ff88",
              }}
            >
              M
            </div>
            <div style={{ fontSize: 10, color: "#666666" }}>MICROAI · THE ARC & CIRCLE HUB</div>
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
                  color: "#666666",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  fontFamily: "var(--font-geist-mono), monospace",
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
                html { scroll-behavior: smooth; }
        html, body { background: #000000; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}