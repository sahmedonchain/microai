"use client";
import { ShieldCheck, ScanSearch, FlaskConical, Plug, Bug, Wallet, BarChart3, type LucideIcon } from "lucide-react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";

interface Service {
  href: string;
  title: string;
  icon: LucideIcon;
  text: string;
  tag: string;
}

const VERIFY_SERVICES: Service[] = [
  { href: "/verify", title: "Verify", icon: ShieldCheck, tag: "Early preview", text: "Check an x402 endpoint's payment setup on Arc and match a transaction against it. Sends no payment." },
  { href: "/inspect", title: "Payload inspector", icon: ScanSearch, tag: "Early preview", text: "Paste x402 headers and see what was asked, what was signed and what was reported. Runs in your browser, sends nothing." },
  { href: "/lab", title: "Testnet lab", icon: FlaskConical, tag: "Arc Testnet", text: "Send small test payments and see how Verify judges each one. No real money." },
  { href: "/trust", title: "Trust API", icon: Plug, tag: "Read-only", text: "A machine-readable endpoint check for agents that want to know a service's setup before paying it." },
];

const TOOLS: Service[] = [
  { href: "/debug", title: "Debug", icon: Bug, tag: "Tool", text: "Paste a failing transaction or error and get a plain explanation." },
  { href: "/wallet", title: "Wallet", icon: Wallet, tag: "Tool", text: "Look up an Arc address: balances, activity and risk signals." },
  { href: "/stats", title: "Stats", icon: BarChart3, tag: "Tool", text: "Live Arc network numbers." },
];

const LIMITS = [
  "Verify is a configuration check. It is not an audit and not a guarantee of safety.",
  "MicroAI Verify never sends a payment and never asks for a private key or seed phrase.",
  "Arc only. Other networks are not checked.",
];

function Card({ s }: { s: Service }) {
  const Icon = s.icon;
  return (
    <Link
      href={s.href}
      className="group flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-md border border-accent/20 bg-accent-dim text-accent-text">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{s.tag}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-text">{s.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
      <span className="mt-4 text-sm font-medium text-accent-text group-hover:underline">Open {s.title}</span>
    </Link>
  );
}

export function OverviewTab() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 text-text sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-muted">
          MicroAI Verify checks that an x402 payment on Arc did what it should: the setup is sound, the payment matches, and the service delivered.
        </p>
      </header>

      <section aria-labelledby="ov-verify" className="mt-8">
        <h2 id="ov-verify" className="text-xl font-semibold">Verify services</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VERIFY_SERVICES.map((s) => (
            <Card key={s.href} s={s} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ov-tools" className="mt-10">
        <h2 id="ov-tools" className="text-xl font-semibold">Arc tools</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((s) => (
            <Card key={s.href} s={s} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ov-limits" className="mt-10 rounded-lg border border-border bg-surface p-5">
        <h2 id="ov-limits" className="text-lg font-semibold">What to know</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
