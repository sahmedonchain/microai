"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { WalletModal } from "@/app/components/WalletModal";
import { PaymentReceipt } from "@/app/components/PaymentReceipt";
import { RecoverPayment } from "@/app/components/RecoverPayment";

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

              <RecoverPayment onRecovered={(c) => setCredits(c)} />

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
