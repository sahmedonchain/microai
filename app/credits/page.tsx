"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";
import { PaymentReceipt } from "@/app/components/PaymentReceipt";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface Receipt {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  explorerUrl: string;
}

type State = "loading" | "unauthenticated" | "ready" | "error";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Ecosystem", href: "/ecosystem" },
  { label: "Grants", href: "/grants" },
  { label: "Build status", href: "/build-status" },
  { label: "Stats", href: "/stats" },
  { label: "News", href: "/news" },
  { label: "Copilot", href: "/build" },
  { label: "Wallet", href: "/wallet" },
  { label: "Debugger", href: "/debug" },
  { label: "Credits", href: "/credits" },
];

export default function CreditsPage() {
  const [state, setState] = useState<State>("loading");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [credits, setCredits] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/payment-history", { method: "POST" });
        if (res.status === 401) {
          setState("unauthenticated");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to load payment history.");
          setState("error");
          return;
        }
        setReceipts(data.receipts ?? []);
        setCredits(data.creditBalance ?? 0);
        setState("ready");
      } catch {
        setErrorMsg("Failed to load payment history. Please try again.");
        setState("error");
      }
    })();
  }, []);

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts?.[0]) setConnectedWallet(accounts[0]);
      } catch { /* user can connect manually */ }
    })();
  }, []);

  const totalSpent = receipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-space font-sans text-text">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border bg-space/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold text-text">MicroAI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex overflow-x-auto">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition whitespace-nowrap ${
                  l.href === "/credits" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
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

            {connectedWallet ? (
              <span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs text-text sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {truncateAddress(connectedWallet)}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-white transition hover:brightness-110"
              >
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* PAGE HEADER */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Credits
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-text sm:text-4xl">
            Credits &amp; Payments
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Your USDC payment history on Arc Mainnet</p>
        </div>
      </section>

      {/* MAIN */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {state === "loading" && (
            <div className="flex items-center gap-2" role="status">
              <span className="inline-flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-accent-text" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </span>
              <span className="font-mono text-xs text-muted">Loading payment history...</span>
            </div>
          )}

          {state === "unauthenticated" && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <p className="mb-4 text-sm text-muted">Connect your wallet to view your credits</p>
              <Link
                href="/chat"
                className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
              >
                Connect wallet
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 font-mono text-xs text-danger">
              {errorMsg}
            </div>
          )}

          {state === "ready" && (
            <div className="space-y-4">
              {/* Credit balance */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-6">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">Credits</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-5xl font-semibold text-text leading-none">{credits}</span>
                    <span className="text-sm text-muted">queries remaining</span>
                  </div>
                </div>
                <Link
                  href="/chat"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 whitespace-nowrap"
                >
                  Buy more credits
                </Link>
              </div>

              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface p-6">
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">Total payments</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-text">{receipts.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-6">
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">Total USDC spent</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-accent-text">{totalSpent.toFixed(3)}</p>
                </div>
              </div>

              {/* Payment history */}
              <div>
                <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Payment history</p>
                {receipts.length === 0 ? (
                  <p className="text-sm text-muted">No USDC payments found for this wallet</p>
                ) : (
                  <div className="space-y-2">
                    {receipts.map((r) => (
                      <PaymentReceipt key={r.txHash + r.from + r.to} {...r} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {walletModalOpen && (
        <WalletModal onConnect={(addr) => { setConnectedWallet(addr); setWalletModalOpen(false); }} onClose={() => setWalletModalOpen(false)} />
      )}

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </div>
  );
}
