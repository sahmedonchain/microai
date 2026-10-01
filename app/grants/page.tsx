"use client";
import React, { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, MessageSquare } from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Grants", href: "/grants" },
  { label: "Build status", href: "/build-status" },
  { label: "Stats", href: "/stats" },
];

const grants = [
  // ===== LIVE / OPEN =====
  {
    id: 1,
    type: "GRANT",
    status: "OPEN",
    org: "DoraHacks x Arc",
    title: "Arc Microgrants",
    desc: "20 microgrants of $500 USDC each, from a $10,000 pool, for projects already deployed and working on Arc MAINNET: PoC, small apps, demos, hackathon continuations. No company or traction required. Pseudonymous submission allowed.",
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
    status: "OPEN (ROLLING)",
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
    desc: "Builder series for AI agents that hold, allocate, and disburse a business's money: treasury, invoices, contractors, autonomous operations, audit trail. Settled on Arc in USDC.",
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
    desc: "6-week accelerator: onboard, build on testnet, ship on mainnet, Demo Day. Primarily for LatAm fintech and AI startups with existing traction, with direct support from the Circle/Arc team. Applications closed Sep 22. Program is actively running.",
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
    status: "OPEN (ONGOING)",
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
    status: "OPEN (ROLLING)",
    org: "Circle",
    title: "Circle Developer Bounties",
    desc: "Specific integration challenges (USDC, CCTP, Paymaster, Wallets) for USDC rewards. $20,000 total pool, $1,500 per challenge, multiple winners possible. New bounties added on a rolling basis.",
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
    status: "OPEN (ONGOING)",
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
    reward: "N/A",
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
    reward: "N/A",
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
    title: "ETHOnline 2026: Arc Track",
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
    title: "HackMoney 2026: Arc Track",
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
    title: "ETHGlobal Cannes: Arc Track",
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
    desc: "Two-week builder series for AI agents that pay, receive, and orchestrate nanopayments, settled on Arc. Six published Requests for Builders (RFBs) with concrete buildable angles.",
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
    title: "Circle Developer Grants: Cohort 1",
    desc: "Closed. Funded Africa/Global South-focused teams: Blockradar, Kolan, Myaza, Payrit, ViFi, SFx Money.",
    reward: "Closed",
    deadline: "Closed",
    tags: ["USDC", "Africa", "Global South"],
    url: "https://circle.com/grant",
    logo: "C",
    logoColor: "#2563eb",
  },
];

type Grant = (typeof grants)[number];

const FILTER_TYPES = ["ALL", "GRANT", "HACKATHON", "BOUNTY", "ACCELERATOR", "PROGRAM", "EVENT"];

const STATUS_COLORS: Record<string, string> = {
  "OPEN": "#3dd68c",
  "OPEN (ONGOING)": "#3dd68c",
  "OPEN (ROLLING)": "#3dd68c",
  "LIVE NOW": "#f2555a",
  "IN PROGRESS": "#f5b544",
  "UPCOMING": "#5ea2ec",
  "ENDED": "#8592a8",
};

const TYPE_COLORS: Record<string, string> = {
  GRANT: "#3dd68c",
  BOUNTY: "#f5b544",
  HACKATHON: "#b89eea",
  ACCELERATOR: "#f97316",
  PROGRAM: "#5ea2ec",
  EVENT: "#8592a8",
};

function isActiveStatus(status: string) {
  return status.startsWith("OPEN") || status === "LIVE NOW" || status === "IN PROGRESS";
}

export default function GrantsPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showEnded, setShowEnded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = grants.filter((g) => {
    const matchType = filter === "ALL" || g.type === filter;
    const q = search.toLowerCase();
    const matchSearch =
      search === "" ||
      g.title.toLowerCase().includes(q) ||
      g.desc.toLowerCase().includes(q) ||
      g.org.toLowerCase().includes(q) ||
      g.tags.some((t) => t.toLowerCase().includes(q));
    return matchType && matchSearch;
  });

  const activeList = filtered.filter((g) => isActiveStatus(g.status));
  const upcomingList = filtered.filter((g) => g.status === "UPCOMING");
  const endedList = filtered.filter((g) => g.status === "ENDED");

  const typeList = FILTER_TYPES.filter((t) => t !== "ALL");
  const typeCounts = typeList.map((t) => ({
    name: t,
    count: grants.filter((g) => g.type === t).length,
  }));

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
                  l.href === "/grants" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
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
              aria-label="Search grants"
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
            <Link href="/" className="hover:text-text">Home</Link> / Grants
          </p>

          <div className="mt-4 max-w-xl">
            <h1 className="text-3xl font-semibold leading-[1.15] text-text sm:text-4xl">
              Arc &amp; Circle
              <br />
              Grants &amp; Hackathons
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              All active grants, bounties, accelerators, and hackathons from the Arc and Circle ecosystem, curated for builders.
            </p>
          </div>

          {/* STAT STRIP — real counts only */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { label: "Open now", value: grants.filter((g) => isActiveStatus(g.status)).length },
              { label: "Total tracked", value: grants.length },
              { label: "Categories", value: typeList.length },
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
          {/* SEARCH + FILTER BAR */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search grants, orgs, tags..."
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>

            <div className="relative shrink-0">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-surface py-2.5 pl-3 pr-8 text-sm text-text focus:outline-none"
              >
                {FILTER_TYPES.map((t) => (
                  <option key={t} value={t}>{t === "ALL" ? "All categories" : t}</option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            {filtered.length === 0
              ? `No results${search ? ` for "${search}"` : ""}`
              : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
          </p>

          {/* LIVE & OPEN */}
          <div className="mt-6">
            <p className="text-sm font-medium text-text">Live &amp; open now ({activeList.length})</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {activeList.map((g) => <GrantRow key={g.id} grant={g} />)}
              {activeList.length === 0 && (
                <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
                  No open opportunities for this filter.
                </p>
              )}
            </div>
          </div>

          {/* UPCOMING */}
          <div className="mt-8">
            <p className="text-sm font-medium text-text">Upcoming ({upcomingList.length})</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {upcomingList.map((g) => <GrantRow key={g.id} grant={g} />)}
              {upcomingList.length === 0 && (
                <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
                  No upcoming events for this filter.
                </p>
              )}
            </div>
          </div>

          {/* ENDED (collapsible) */}
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowEnded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-text"
            >
              Ended ({endedList.length})
              <span className="text-xs text-muted">{showEnded ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {showEnded && (
              <div className="mt-3 flex flex-col gap-2.5 opacity-75">
                {endedList.map((g) => <GrantRow key={g.id} grant={g} />)}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex">
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
                <span className="font-mono text-xs">{grants.length}</span>
              </button>
              {typeCounts.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setFilter(t.name)}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                    filter === t.name ? "bg-accent-dim text-accent-text" : "text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="font-mono text-xs">{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-secondary/25 bg-secondary-dim p-4">
            <p className="text-sm font-semibold text-text">Know a grant we&apos;re missing?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Open an issue on our GitHub with the details and we&apos;ll review it for the list.
            </p>
            <a
              href="https://github.com/sahmedonchain/microai/issues"
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-block text-xs font-medium text-secondary-text hover:underline"
            >
              Suggest a listing on GitHub
            </a>
          </div>
        </aside>
      </div>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Get personalized guidance on which grant or hackathon fits your project for just $0.001 USDC.
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

function GrantRow({ grant: g }: { grant: Grant }) {
  const statusColor = STATUS_COLORS[g.status] ?? STATUS_COLORS["ENDED"];
  const typeColor = TYPE_COLORS[g.type] ?? "#664c88";
  const ended = g.status === "ENDED";

  return (
    <motion.a
      href={g.url}
      target="_blank"
      rel="noreferrer"
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 no-underline sm:flex-row sm:items-start sm:gap-4"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
        style={{ background: `${g.logoColor}20`, border: `1px solid ${g.logoColor}35`, color: g.logoColor }}
      >
        {g.logo}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
            style={{ background: `${typeColor}18`, border: `1px solid ${typeColor}30`, color: typeColor }}
          >
            {g.type}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
            style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}30`, color: statusColor }}
          >
            <span className="size-1 rounded-full" style={{ background: statusColor }} />
            {g.status}
          </span>
          <span className="text-xs text-muted">{g.org}</span>
        </div>

        <p className="mt-1.5 text-sm font-medium text-text">{g.title}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{g.desc}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {g.tags.map((tag) => (
            <span key={tag} className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-6 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
        <div className="text-left sm:text-right">
          <p className="font-mono text-xs font-semibold text-accent-text">{g.reward}</p>
          <p className="mt-0.5 text-[11px] text-muted">{g.deadline}</p>
        </div>
        <span className="font-mono text-[11px] font-medium" style={{ color: ended ? "#8592a8" : typeColor }}>
          View →
        </span>
      </div>
    </motion.a>
  );
}
