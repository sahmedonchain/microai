"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { WalletModal } from "@/app/components/WalletModal";
import { truncateAddress } from "@/lib/format";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface TokenBalance {
  token?: { symbol?: string; address_hash?: string; address?: string; decimals?: string | null };
  value?: string;
}

interface Tx {
  hash?: string;
  value?: string;
  status?: string;
  result?: string;
  timestamp?: string;
  from?: { hash?: string };
  to?: { hash?: string } | null;
}

interface WalletResult {
  profile: { coin_balance?: string | null; tx_count?: string | number };
  transactions: Tx[];
  tokenBalances: TokenBalance[];
  riskSignals: {
    hasUnlimitedApproval: boolean;
    highValueTx: boolean;
    newContract: boolean;
    frequentSmallTx: boolean;
  };
  aiSummary: string;
}

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

const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—");

function formatUnits(raw: string | undefined | null, decimals: number): string {
  if (!raw || !/^\d+$/.test(raw)) return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).slice(0, 6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export default function WalletPage() {
  const [address, setAddress] = useState("");
  const [ownAddress, setOwnAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WalletResult | null>(null);
  const [analyzed, setAnalyzed] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        if (data.authenticated && typeof data.address === "string") {
          setOwnAddress(data.address);
          setAddress((prev) => prev || data.address);
        }
      } catch { /* optional convenience */ }
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

  const analyze = async (target: string) => {
    const addr = target.trim();
    if (!ADDRESS_RE.test(addr)) {
      setError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to analyze wallet.");
      } else {
        setResult(data);
        setAnalyzed(addr);
      }
    } catch {
      setError("Failed to reach the analyzer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isOwn = ownAddress && address.trim().toLowerCase() === ownAddress.toLowerCase();
  const signals = result
    ? [
        { name: "Unlimited approval", on: result.riskSignals.hasUnlimitedApproval },
        { name: "High value TX", on: result.riskSignals.highValueTx },
        { name: "New contract", on: result.riskSignals.newContract },
        { name: "Frequent small TX", on: result.riskSignals.frequentSmallTx },
      ]
    : [];
  const timestamps = result?.transactions.map((t) => t.timestamp).filter(Boolean) as string[] | undefined;
  const lastSeen = timestamps?.[0];
  const firstSeen = timestamps?.[timestamps.length - 1];
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—");

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
                  l.href === "/wallet" ? "bg-accent-dim text-accent-text" : "text-muted hover:text-text"
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
            <Link href="/" className="hover:text-text">Home</Link> / Wallet
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-text sm:text-4xl">
            Wallet Intelligence
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">AI-powered wallet analysis on Arc Mainnet</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Public", "No wallet required", "AI-powered", "Arc Mainnet"].map((pill) => (
              <span key={pill} className="rounded-full border border-accent/25 bg-accent-dim px-3 py-1 font-mono text-xs text-accent-text">
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Input card */}
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Wallet address</p>
            <p className="mb-4 text-xs text-muted">Enter any Arc Mainnet wallet address for instant AI analysis</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze(address)}
                placeholder="0x..."
                className="flex-1 min-w-0 rounded-lg border border-border bg-space px-4 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => analyze(address)}
                disabled={loading}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOwn ? "Analyze my wallet" : "Analyze wallet"}
              </button>
            </div>
            {ownAddress && !isOwn && (
              <button
                onClick={() => { setAddress(ownAddress); analyze(ownAddress); }}
                disabled={loading}
                className="mt-3 text-xs text-accent-text hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Analyze my wallet ({short(ownAddress)})
              </button>
            )}
            {error && (
              <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
                {error}
              </div>
            )}
            {loading && (
              <div className="mt-3 flex items-center gap-2" role="status">
                <span className="inline-flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-bounce rounded-full bg-accent-text" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </span>
                <span className="font-mono text-xs text-muted">Analyzing wallet...</span>
              </div>
            )}
          </div>

          {result && (
            <div className="space-y-3">
              {/* Wallet overview */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Wallet overview</p>
                <div className="space-y-2">
                  {[
                    { k: "Address", v: short(analyzed) },
                    { k: "Balance (USDC)", v: formatUnits(result.profile.coin_balance, 18) },
                    { k: "TX count", v: String(result.profile.tx_count ?? "—") },
                    { k: "First seen*", v: fmtDate(firstSeen) },
                    { k: "Last seen", v: fmtDate(lastSeen) },
                  ].map((r) => (
                    <div key={r.k} className="flex justify-between gap-4">
                      <span className="font-mono text-xs text-muted">{r.k}</span>
                      <span className="font-mono text-xs text-text">{r.v}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">*Earliest of the last 20 transactions.</p>
              </div>

              {/* Token balances */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Token balances</p>
                {result.tokenBalances.length === 0 ? (
                  <p className="text-xs text-muted">No token balances</p>
                ) : (
                  <div className="space-y-2">
                    {result.tokenBalances.map((t, i) => {
                      const contract = t.token?.address_hash || t.token?.address || "";
                      const key = contract.toLowerCase();
                      const hot = key === USDC || key === EURC;
                      return (
                        <div key={i} className={`flex justify-between gap-4 flex-wrap ${hot ? "rounded-lg border border-accent/25 bg-accent-dim px-3 py-2" : ""}`}>
                          <span className={`font-mono text-sm font-semibold ${hot ? "text-accent-text" : "text-text"}`}>
                            {t.token?.symbol ?? "?"} {formatUnits(t.value, Number(t.token?.decimals ?? 18))}
                          </span>
                          <span className="font-mono text-xs text-muted">{short(contract)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Recent transactions</p>
                {result.transactions.length === 0 ? (
                  <p className="text-xs text-muted">No transactions</p>
                ) : (
                  <div className="space-y-3">
                    {result.transactions.slice(0, 10).map((t, i) => {
                      const ok = (t.result ?? t.status) === "success" || t.status === "ok";
                      return (
                        <div key={t.hash ?? i} className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                          <a href={`https://explorer.arc.io/tx/${t.hash}`} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
                            {short(t.hash)}
                          </a>
                          <span className="text-muted">{short(t.from?.hash)} → {short(t.to?.hash)}</span>
                          <span className="text-text">{formatUnits(t.value, 18)}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                            {ok ? "● Confirmed" : "✕ Failed"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Risk signals */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Risk signals</p>
                <div className="flex flex-wrap gap-2">
                  {signals.map((s) => (
                    <span key={s.name} className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.on ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success"}`}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI summary */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <div className="mb-4 flex items-center gap-2">
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">AI summary</p>
                  <span className="rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent-text">AI</span>
                </div>
                <p className="text-sm leading-relaxed text-muted">{result.aiSummary}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            Need deeper answers?{" "}
            <Link href="/chat" className="text-accent-text hover:underline">Ask MicroAI</Link>
          </p>
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
