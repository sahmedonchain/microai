import Link from "next/link";
import {
  Bot,
  Bug,
  Check,
  Code2,
  EyeOff,
  FlaskConical,
  Globe2,
  KeyRound,
  Lock,
  Network,
  ScanSearch,
  ShieldCheck,
  Store,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { Brand } from "./Brand";
import { FlowDiagram } from "./FlowDiagram";
import { MouseEffects } from "./MouseEffects";
import { SiteNav } from "./SiteNav";
import "./home.css";

// Every tool link on this page goes through one button.
const LAUNCH_HREF = "/overview";

function LaunchButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href={LAUNCH_HREF}
      className={`hm-btn inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text ${className}`}
    >
      Launch tools
    </Link>
  );
}

function Moon({ variant }: { variant: "hero" | "cta" }) {
  return (
    <div className={`hm-moon-wrap hm-moon-wrap--${variant}`} aria-hidden="true">
      <div className="hm-moon" />
      <div className="hm-sweep" />
      <div className="hm-sweep hm-sweep--slow" style={{ opacity: 0.45 }} />
    </div>
  );
}

function SectionHead({ id, title, text }: { id: string; title: React.ReactNode; text: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 id={id} className="hm-title text-3xl font-semibold leading-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "error" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "error"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-secondary/30 bg-secondary-dim text-secondary-text";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/* ---------------- Hero dashboard preview ---------------- */

const SIDE_ITEMS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Overview", icon: Globe2 },
  { label: "Verify", icon: ShieldCheck, active: true },
  { label: "Inspector", icon: ScanSearch },
  { label: "Testnet lab", icon: FlaskConical },
  { label: "Trust API", icon: Network },
  { label: "Debug", icon: Bug },
  { label: "Wallet", icon: Wallet },
];

const REPORT: { title: string; note: string }[] = [
  { title: "Network is Arc Testnet", note: "eip155:5042002" },
  { title: "Asset is USDC on Arc Testnet", note: "address matches" },
  { title: "Amount is 0.01 USDC", note: "read with 6 decimals" },
  { title: "Recipient is a valid address", note: "format checked" },
  { title: "Timeout is 300 seconds", note: "normal range" },
];

function DashboardPreview() {
  return (
    <div className="hm-dash relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-[#080c16]" aria-label="Preview of the Verify tool">
      <div className="flex">
        {/* sidebar */}
        <aside className="hidden w-52 shrink-0 border-r border-border bg-surface/60 p-4 md:block">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold text-text">MicroAI</span>
          </div>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-wider text-muted/70">Menu</p>
          <ul className="mt-2 space-y-1">
            {SIDE_ITEMS.map(({ label, icon: Icon, active }) => (
              <li
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
                  active ? "bg-accent-dim text-accent-text ring-1 ring-accent/30" : "text-muted"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Verify an endpoint</p>
              <p className="text-[11px] text-muted">Reads the 402 answer. Sends no payment.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/25 bg-accent-dim px-2.5 py-1 text-[11px] text-accent-text">
              <span className="hm-pulse size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
              Arc Mainnet
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-space/80 p-1.5">
            <span className="min-w-0 flex-1 truncate px-2 font-mono text-[11px] text-muted">https://microai-tan.vercel.app/api/lab/x402/good</span>
            <span className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-medium text-white">Check endpoint</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Network", "Arc Mainnet"],
              ["Chain ID", "5042"],
              ["Asset", "USDC, 6 decimals"],
              ["Mode", "Read-only"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface/70 p-3">
                <p className="text-[10px] text-muted">{k}</p>
                <p className="mt-1 truncate font-mono text-xs text-text">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface/70 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text">Report for the Testnet lab fixture &ldquo;good&rdquo;</p>
              <Pill tone="ok">
                <Check className="size-3" aria-hidden="true" /> No problems found in the checks we ran
              </Pill>
            </div>
            <ul className="mt-3 divide-y divide-border/70">
              {REPORT.map((r, i) => (
                <li key={r.title} className="hm-find flex items-center justify-between gap-3 py-2" style={{ "--i": i } as React.CSSProperties}>
                  <span className="flex min-w-0 items-center gap-2 text-xs text-text">
                    <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                    <span className="truncate">{r.title}</span>
                  </span>
                  <span className="hidden shrink-0 font-mono text-[10px] text-muted sm:block">{r.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-24" aria-labelledby="hero-title">
      <div className="hm-grid" aria-hidden="true" />
      <Moon variant="hero" />
      <div className="h-[72px]" aria-hidden="true" />

      <div className="relative z-20 mx-auto max-w-6xl px-4 pt-20 text-center sm:px-6 md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs text-muted backdrop-blur">
          <span className="hm-pulse size-1.5 rounded-full bg-success" aria-hidden="true" />
          Live on Arc Mainnet. Early preview.
        </span>

        <h1 id="hero-title" className="hm-title mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl md:text-6xl">
          Check x402 payments on Arc before money moves
        </h1>
        <p className="mx-auto mt-5 max-w-[56ch] text-base leading-relaxed text-muted sm:text-lg">
          Read-only tools to inspect, verify and debug USDC and x402 payments. Built for API sellers, AI agent builders and Arc developers.
        </p>

        <div className="mt-8 flex justify-center">
          <LaunchButton />
        </div>
      </div>

      <div className="relative z-20 mx-auto mt-14 max-w-6xl px-4 sm:px-6 md:mt-20">
        <DashboardPreview />
      </div>
    </section>
  );
}

/* ---------------- Standards strip ---------------- */

const STANDARDS = [
  "Arc Mainnet 5042",
  "Arc Testnet 5042002",
  "USDC, 6 decimals",
  "x402 v2",
  "PAYMENT-REQUIRED",
  "PAYMENT-SIGNATURE",
  "PAYMENT-RESPONSE",
  "MCP over HTTP",
  "Read-only",
];

function Standards() {
  const row = [...STANDARDS, ...STANDARDS];
  return (
    <section aria-labelledby="std-title" className="relative border-y border-border/60 bg-surface/30 py-10">
      <h2 id="std-title" className="text-center text-sm font-medium text-muted">
        Built on the standards you already use
      </h2>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <ul className="hm-marquee gap-4 pr-4" aria-label="Standards and networks">
          {row.map((s, i) => (
            <li
              key={`${s}-${i}`}
              aria-hidden={i >= STANDARDS.length}
              className="shrink-0 rounded-full border border-border bg-surface px-5 py-2 font-mono text-xs text-text/85"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Why ---------------- */

const WHY: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: EyeOff,
    title: "Reads, never pays",
    text: "Every tool is read-only. MicroAI sends no payment and never accepts a signed payload for settlement.",
  },
  {
    icon: KeyRound,
    title: "No keys, ever",
    text: "It never asks for a private key or seed phrase. Wallet signing happens in your own wallet.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence for every finding",
    text: "Each result shows what was checked, what was found and how to fix it. A guess is labelled as a guess.",
  },
];

function Why() {
  return (
    <section id="why" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="why-title">
      <SectionHead id="why-title" title="Catch the mistake before it costs money" text="USDC has 6 decimals in its token interface and 18 as the gas token. One wrong chain, address or amount and a payment goes to the wrong place." />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {WHY.map(({ icon: Icon, title, text }) => (
          <article key={title} className="hm-card p-6">
            <span className="relative z-10 flex size-11 items-center justify-center rounded-xl border border-accent/30 bg-accent-dim text-accent-text shadow-[0_0_30px_-4px_rgb(139_107_192/0.6)]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="relative z-10 mt-6 text-lg font-semibold text-text">{title}</h3>
            <p className="relative z-10 mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */

function How() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="how-title">
      <SectionHead id="how-title" title={<>See where MicroAI fits<br className="hidden sm:block" /> in an x402 payment</>} text="An x402 payment is a short conversation between a client, a server and a facilitator. MicroAI reads it from the side and never touches the money." />
      <div className="mt-14">
        <FlowDiagram />
      </div>
    </section>
  );
}

/* ---------------- Tools (bento) ---------------- */

function MistakeTile() {
  return (
    <article className="hm-card p-6 md:col-span-3">
      <h3 className="relative z-10 text-lg font-semibold text-text">Verify catches the costly mistakes</h3>
      <p className="relative z-10 mt-1 max-w-[46ch] text-sm text-muted">
        Network, USDC address, decimals, recipient and format, read straight from the endpoint&rsquo;s 402 answer.
      </p>
      <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-space/70 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">amount</span>
            <Pill tone="ok">
              <Check className="size-3" aria-hidden="true" /> Passed
            </Pill>
          </div>
          <p className="mt-3 break-all font-mono text-sm text-text">&quot;10000&quot;</p>
          <p className="mt-2 text-xs text-muted">Amount is 0.01 USDC, read with 6 decimals.</p>
        </div>
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">amount</span>
            <Pill tone="error">
              <X className="size-3" aria-hidden="true" /> Error
            </Pill>
          </div>
          <p className="mt-3 break-all font-mono text-sm text-text">&quot;1000000000000000000&quot;</p>
          <p className="mt-2 text-xs text-muted">Looks like 18 decimals. USDC uses 6 in its token interface.</p>
        </div>
      </div>
    </article>
  );
}

function InspectorTile() {
  const rows = ["PAYMENT-REQUIRED", "PAYMENT-SIGNATURE", "PAYMENT-RESPONSE"];
  return (
    <article className="hm-card p-6 md:col-span-2">
      <h3 className="relative z-10 text-lg font-semibold text-text">Payload inspector</h3>
      <p className="relative z-10 mt-1 text-sm text-muted">Decode x402 headers. Runs in your browser, sends nothing.</p>
      <ul className="relative z-10 mt-5 space-y-2">
        {rows.map((r) => (
          <li key={r} className="flex items-center justify-between rounded-lg border border-border bg-space/70 px-3 py-2.5">
            <span className="font-mono text-[11px] text-text/90">{r}</span>
            <Lock className="size-3.5 text-accent-text" aria-hidden="true" />
          </li>
        ))}
      </ul>
      <p className="relative z-10 mt-4 text-xs leading-relaxed text-muted">
        A signed payload can move money until it is used, so it never leaves your browser.
      </p>
    </article>
  );
}

function AgentTile() {
  const tools = ["check_x402_endpoint", "explain_x402_error", "arc_network_info"];
  return (
    <article className="hm-card p-6 md:col-span-2">
      <h3 className="relative z-10 text-lg font-semibold text-text">Made for AI agents</h3>
      <p className="relative z-10 mt-1 text-sm text-muted">A read-only MCP server and a Trust API.</p>
      <div className="relative z-10 mt-5 rounded-xl border border-border bg-space/80 p-3 font-mono text-[11px] leading-relaxed">
        <p className="text-muted">tools/list</p>
        {tools.map((t) => (
          <p key={t} className="text-secondary-text">
            {t}
          </p>
        ))}
      </div>
      <p className="relative z-10 mt-4 text-xs leading-relaxed text-muted">
        Tried in the Claude app: a correct Pass on a test endpoint.
      </p>
    </article>
  );
}

function MatchTile() {
  const rows: [string, string][] = [
    ["Network", "Matches what was asked"],
    ["Asset", "USDC"],
    ["Amount", "Paid what was asked"],
    ["Recipient", "Matches payTo"],
  ];
  return (
    <article className="hm-card p-6 md:col-span-3">
      <h3 className="relative z-10 text-lg font-semibold text-text">Match a transaction to what was asked</h3>
      <p className="relative z-10 mt-1 max-w-[46ch] text-sm text-muted">
        Paste a transaction hash. MicroAI compares the on-chain transfer with the endpoint&rsquo;s request.
      </p>
      <ul className="relative z-10 mt-5 divide-y divide-border/70 rounded-xl border border-border bg-space/70">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted">{k}</span>
            <span className="flex items-center gap-2 text-xs text-text">
              {v}
              <Check className="size-3.5 text-success" aria-hidden="true" />
            </span>
          </li>
        ))}
      </ul>
      <p className="relative z-10 mt-3 text-[11px] text-muted">Example layout. Real results come from your own endpoint and transaction.</p>
    </article>
  );
}

function LabTile() {
  return (
    <article className="hm-card relative p-6 md:col-span-3">
      <h3 className="relative z-10 text-lg font-semibold text-text">Try it safely on Arc Testnet</h3>
      <p className="relative z-10 mt-1 max-w-[46ch] text-sm text-muted">
        Test endpoints with one known mistake each, and small Testnet payments from your own wallet. No real money.
      </p>
      <div className="relative z-10 mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
        {["good", "decimals18", "wrong network", "zero address", "timeout"].map((c) => (
          <span key={c} className="rounded-full border border-border bg-space/70 px-3 py-1.5 text-text/85">
            {c}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
    </article>
  );
}

function DebugTile() {
  return (
    <article className="hm-card p-6 md:col-span-2">
      <h3 className="relative z-10 text-lg font-semibold text-text">Debug a failed transaction</h3>
      <p className="relative z-10 mt-1 text-sm text-muted">Revert reasons and events are decoded locally. Each finding is confirmed, probable or unknown.</p>
      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        <Pill tone="ok">Confirmed</Pill>
        <Pill tone="info">Probable</Pill>
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted">Unknown</span>
      </div>
    </article>
  );
}

function Tools() {
  return (
    <section id="tools" className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="tools-title">
      <SectionHead id="tools-title" title={<>Every check a payment needs,<br className="hidden sm:block" /> in one place</>} text="Inspect a header, verify an endpoint, match a transaction, debug a failure. All read-only, all with evidence." />
      <div className="mt-14 grid gap-5 md:grid-cols-5">
        <MistakeTile />
        <InspectorTile />
        <MatchTile />
        <AgentTile />
        <LabTile />
        <DebugTile />
      </div>
    </section>
  );
}

/* ---------------- Who it is for ---------------- */

const AUDIENCE: { icon: LucideIcon; who: string; question: string; text: string }[] = [
  {
    icon: Store,
    who: "API sellers",
    question: "Is my 402 answer correct?",
    text: "Check the network, USDC address, amount and recipient your endpoint asks for, before a client pays the wrong thing.",
  },
  {
    icon: Bot,
    who: "AI agent builders",
    question: "Does this service ask for what I expect?",
    text: "Let an agent call a read-only check before it pays. Use the Trust API or connect the MCP server.",
  },
  {
    icon: Code2,
    who: "Arc developers",
    question: "Why did my transaction fail?",
    text: "Paste a hash and get decoded revert reasons, transfers and a plain explanation, with confidence labels.",
  },
];

function Audience() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="who-title">
      <SectionHead id="who-title" title="Made for people who ship payments" text="If you build, sell or automate USDC payments on Arc, MicroAI answers the question you would otherwise find out the hard way." />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {AUDIENCE.map(({ icon: Icon, who, question, text }) => (
          <article key={who} className="hm-card p-6">
            <div className="relative z-10 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-secondary/30 bg-secondary-dim text-secondary-text">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-text">{who}</span>
            </div>
            <p className="relative z-10 mt-5 text-lg font-semibold leading-snug text-text">{question}</p>
            <p className="relative z-10 mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Ways to use it ---------------- */

const WAYS: { name: string; tag: string; lead: string; items: string[]; featured?: boolean }[] = [
  {
    name: "In the browser",
    tag: "For people",
    lead: "Open the tools and paste an endpoint, header or transaction.",
    items: ["Verify an endpoint", "Payload inspector", "Testnet lab", "Debug, Wallet and Stats"],
  },
  {
    name: "Through MCP",
    tag: "For AI agents",
    lead: "Connect the read-only server to an agent and let it check before paying.",
    items: ["check_x402_endpoint", "explain_x402_error", "arc_network_info", "Tried in the Claude app"],
    featured: true,
  },
  {
    name: "Over the Trust API",
    tag: "For scripts",
    lead: "One GET request returns a machine-readable check of an endpoint.",
    items: ["GET /api/trust?url=...", "Configuration check, not a reputation score", "Rate limited", "Read-only"],
  },
];

function Ways() {
  return (
    <section id="ways" className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="ways-title">
      <SectionHead id="ways-title" title={<>Use it the way<br className="hidden sm:block" /> your stack works</>} text="The same checks, three ways in. Pick the one that fits who or what is asking." />
      <div className="mt-14 grid items-stretch gap-5 md:grid-cols-3">
        {WAYS.map((w) => (
          <article
            key={w.name}
            className={`hm-card flex flex-col p-6 ${w.featured ? "border-accent/50 shadow-[0_0_80px_-20px_rgb(139_107_192/0.7)]" : ""}`}
          >
            <div className="relative z-10 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-text">{w.name}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${w.featured ? "bg-accent text-white" : "border border-border text-muted"}`}>{w.tag}</span>
            </div>
            <p className="relative z-10 mt-3 text-sm leading-relaxed text-muted">{w.lead}</p>
            <ul className="relative z-10 mt-6 space-y-3 text-sm text-text/90">
              {w.items.map((it) => (
                <li key={it} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
                  <span className={it.includes("_") || it.includes("/") ? "font-mono text-xs leading-5" : ""}>{it}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Limits ---------------- */

const LIMITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: "A configuration check", text: "Verify tells you if a payment setup looks right. It is not an audit and not a guarantee of safety." },
  { icon: Globe2, title: "Arc only", text: "MicroAI checks Arc Mainnet and Arc Testnet. Other networks are not checked." },
  { icon: Lock, title: "Not independently audited", text: "Built and maintained by one developer. Do not rely on it for large amounts." },
  { icon: EyeOff, title: "It cannot know who owns an address", text: "It can confirm a recipient is valid, not whose it is. Confirm that it is yours." },
  { icon: FlaskConical, title: "Early preview", text: "Tests so far use mocks. A live Testnet end-to-end run is the next step." },
  { icon: Network, title: "Independent project", text: "Not an official Arc or Circle product, and not endorsed by either." },
];

function Limits() {
  return (
    <section id="limits" className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:pb-16" aria-labelledby="limits-title">
      <SectionHead id="limits-title" title="Honest about what it does and does not do" text="A payment tool should say where it stops. This is where MicroAI stops." />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LIMITS.map(({ icon: Icon, title, text }) => (
          <article key={title} className="hm-card p-6">
            <div className="relative z-10 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-space/70 text-accent-text">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-text">{title}</h3>
            </div>
            <p className="relative z-10 mt-3 text-sm leading-relaxed text-muted">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Final call to action ---------------- */

function FinalCta() {
  return (
    <section className="relative pt-36 pb-24 md:pt-44 md:pb-28" style={{ clipPath: "inset(-240px 0 0 0)" }} aria-labelledby="cta-title">
      <Moon variant="cta" />
      <div className="relative z-20 mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 id="cta-title" className="hm-title text-3xl font-semibold leading-tight sm:text-5xl">
          Ready to check your x402 setup?
        </h2>
        <p className="mx-auto mt-5 max-w-[50ch] text-base leading-relaxed text-muted">
          Open the tools, paste an endpoint and get a report in seconds. Nothing is paid and no key is asked for.
        </p>
        <div className="mt-8 flex justify-center">
          <LaunchButton />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="relative z-20 border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label="MicroAI home" className="inline-flex">
            <Brand />
          </Link>
          <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-muted">
            Read-only tools to inspect, verify and debug USDC and x402 payments on Arc. By BuildOrbit.
          </p>
        </div>
        <nav aria-label="Page sections">
          <p className="text-sm font-medium text-text">On this page</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {[
              ["Why", "#why"],
              ["How it works", "#how"],
              ["Tools", "#tools"],
              ["Ways to use it", "#ways"],
              ["Limits", "#limits"],
            ].map(([l, h]) => (
              <li key={h}>
                <a href={h} className="transition hover:text-text">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Project">
          <p className="text-sm font-medium text-text">Project</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/security" className="transition hover:text-text">Security</Link></li>
            <li><Link href="/terms" className="transition hover:text-text">Terms</Link></li>
            <li><Link href="/privacy" className="transition hover:text-text">Privacy</Link></li>
            <li><a href="https://github.com/sahmedonchain/microai" target="_blank" rel="noopener noreferrer" className="transition hover:text-text">GitHub</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} MicroAI. All rights reserved. A product of{" "}
            <a href="https://buildorbit-phi.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-semibold text-text transition hover:text-accent-text">
              BuildOrbit
            </a>
            .
          </p>
          <p>MicroAI is an independent project, not an official Arc or Circle product, and is not endorsed by either.</p>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="hm-root font-sans text-text">
      <SiteNav />
      <MouseEffects />
      <main>
        <Hero />
        <Standards />
        <Why />
        <How />
        <Tools />
        <Audience />
        <Ways />
        <Limits />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
