"use client";
import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import { WalletModal } from "@/app/components/WalletModal";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

type TxStatus = "idle" | "analyzing" | "done" | "error";

interface TxData {
  hash: string;
  status: string;
  result: string;
  block_number: number | null;
  from: { hash: string };
  to: { hash: string } | null;
  value: string;
  gas_used: string;
  gas_limit: string;
  error?: string;
  revert_reason?: string;
  raw_input?: string;
  fee?: { value: string };
  timestamp?: string;
}

interface TokenTransfer {
  symbol: string;
  from: string;
  to: string;
  value: string;
}

interface InternalTx {
  from: string;
  to: string;
  value: string;
  type: string;
}

interface DebugResult {
  summary: string;
  rootCause: string;
  solution: string;
  severity: "high" | "medium" | "low";
  txData: TxData;
  tokenTransfers: TokenTransfer[];
  internalTxs: InternalTx[];
  decodedFunction: string;
  correctedFlow: string[];
}

const shortAddr = (a: string) => (a ? `${a.slice(0, 8)}...${a.slice(-6)}` : "—");

function severityClass(s: string) {
  if (s === "high") return "text-danger";
  if (s === "medium") return "text-warning";
  return "text-success";
}

export default function DebugPage() {
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [result, setResult] = useState<DebugResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const isValidHash = (h: string) => /^0x([A-Fa-f0-9]{64})$/.test(h.trim());

  const analyze = async () => {
    const hash = txHash.trim();
    if (!isValidHash(hash)) {
      setErrorMsg("Invalid tx hash. Must be 0x followed by 64 hex characters.");
      return;
    }

    setStatus("analyzing");
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch("/api/debug-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to analyze transaction.");
        return;
      }

      setResult({
        summary: data.summary,
        rootCause: data.rootCause,
        solution: data.solution,
        severity: data.severity,
        txData: data.txData,
        tokenTransfers: data.tokenTransfers ?? [],
        internalTxs: data.internalTxs ?? [],
        decodedFunction: data.decodedFunction ?? "unknown",
        correctedFlow: data.correctedFlow ?? [],
      });
      setHistory((prev) => [hash, ...prev.slice(0, 4)]);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Failed to reach the analyzer. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-space font-sans text-text">

      {/* PAGE HEADER */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-text">Home</Link> / Debugger
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-text opacity-75" aria-hidden="true" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent-text" aria-hidden="true" />
            </span>
            <span className="font-mono text-xs text-accent-text">Arc Mainnet · Live debugger</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-text sm:text-4xl">
            Transaction Debugger
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Paste any Arc Mainnet transaction hash. MicroAI fetches the data from Arc Explorer and explains exactly what happened, and how to fix it.
          </p>
        </div>
      </section>

      {/* MAIN */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Input */}
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Paste transaction hash</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                placeholder="0x..."
                className="flex-1 min-w-0 rounded-lg border border-border bg-space px-4 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                onClick={analyze}
                disabled={status === "analyzing"}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "analyzing" ? "Analyzing..." : "Debug"}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
                {errorMsg}
              </div>
            )}

            {status === "analyzing" && (
              <div className="mt-3 flex items-center gap-2" role="status">
                <span className="inline-flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-bounce rounded-full bg-accent-text" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </span>
                <span className="font-mono text-xs text-muted">Fetching transaction and analyzing...</span>
              </div>
            )}
          </div>

          {/* Result */}
          {result && status === "done" && (
            <div className="space-y-3">
              {/* Status banner */}
              <div className={`flex items-center gap-3 rounded-lg border p-4 ${result.txData.result === "success" ? "border-success/25 bg-success/10" : "border-danger/25 bg-danger/10"}`}>
                <div className={`size-2.5 shrink-0 rounded-full ${result.txData.result === "success" ? "bg-success" : "bg-danger"}`} />
                <div>
                  <p className={`text-sm font-semibold ${result.txData.result === "success" ? "text-success" : "text-danger"}`}>
                    {result.txData.result === "success" ? "Transaction successful" : "Transaction failed"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{result.summary}</p>
                </div>
              </div>

              {/* Decoded function */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <span className="font-mono text-xs text-muted">Function decoded</span>
                <span className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold ${result.decodedFunction === "unknown" ? "border-border text-muted" : "border-accent/30 bg-accent-dim text-accent-text"}`}>
                  {result.decodedFunction}
                </span>
              </div>

              {/* Root cause */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className={`mb-3 font-mono text-xs font-semibold uppercase tracking-widest ${severityClass(result.severity)}`}>
                  Root cause · {result.severity} severity
                </p>
                <p className="text-sm leading-relaxed text-muted">{result.rootCause}</p>
              </div>

              {/* Solution */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-accent-text">How to fix</p>
                <p className="text-sm leading-relaxed text-muted">{result.solution}</p>
              </div>

              {/* TX details */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Transaction details</p>
                <div className="space-y-2">
                  {[
                    { label: "Hash", value: result.txData.hash.slice(0, 20) + "..." },
                    { label: "From", value: result.txData.from?.hash?.slice(0, 20) + "..." },
                    { label: "To", value: result.txData.to?.hash ? result.txData.to.hash.slice(0, 20) + "..." : "Contract creation" },
                    { label: "Gas used", value: result.txData.gas_used },
                    { label: "Gas limit", value: result.txData.gas_limit },
                    { label: "Block", value: result.txData.block_number?.toString() || "Pending" },
                    { label: "Fee (USDC)", value: result.txData.fee?.value ? (parseInt(result.txData.fee.value) / 1e6).toFixed(6) : "N/A" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4">
                      <span className="font-mono text-xs text-muted">{row.label}</span>
                      <span className="break-all text-right font-mono text-xs text-text">{row.value}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`https://explorer.arc.io/tx/${result.txData.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block font-mono text-xs text-accent-text hover:underline"
                >
                  View on Arc Explorer ↗
                </a>
              </div>

              {/* Token movements */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Token movements</p>
                {result.tokenTransfers.length === 0 ? (
                  <p className="text-xs text-muted">No token transfers</p>
                ) : (
                  <div className="space-y-2">
                    {result.tokenTransfers.map((t, i) => (
                      <div key={i} className="flex flex-wrap justify-between gap-2 font-mono text-xs">
                        <span className="font-semibold text-accent-text">{t.value} {t.symbol}</span>
                        <span className="text-muted">{shortAddr(t.from)} → {shortAddr(t.to)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Internal transactions */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Internal transactions</p>
                {result.internalTxs.length === 0 ? (
                  <p className="text-xs text-muted">No internal transactions</p>
                ) : (
                  <div className="space-y-2">
                    {result.internalTxs.map((t, i) => (
                      <div key={i} className="flex flex-wrap justify-between gap-2 font-mono text-xs">
                        <span className="text-text">{t.type}</span>
                        <span className="text-muted">{shortAddr(t.from)} → {shortAddr(t.to)}</span>
                        <span className="text-accent-text">{t.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Corrected flow */}
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-accent-text">Corrected flow</p>
                <ol className="space-y-2">
                  {result.correctedFlow.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-xs">
                      <span className="shrink-0 font-semibold text-accent-text">{i + 1}.</span>
                      <span className="text-muted">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Recent hashes */}
          {history.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-muted">Recent hashes</p>
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setTxHash(h); setStatus("idle"); setResult(null); }}
                    className="w-full rounded-lg border border-border bg-space px-3 py-2 text-left font-mono text-xs text-muted transition hover:text-text"
                  >
                    {h.slice(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* What this detects */}
          {status === "idle" && !result && (
            <div className="rounded-lg border border-border bg-surface p-6">
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-muted">What this debugger detects</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: "⚡", label: "Insufficient USDC", desc: "Wallet didn't have enough USDC for gas or payment" },
                  { icon: "🔗", label: "Wrong chain", desc: "Transaction sent on wrong network, not Arc Mainnet" },
                  { icon: "⛽", label: "Gas limit too low", desc: "Gas ran out before transaction could complete" },
                  { icon: "↩️", label: "Contract revert", desc: "Smart contract rejected the call with a reason" },
                  { icon: "📋", label: "Invalid input", desc: "Wrong function selector or malformed calldata" },
                  { icon: "🔢", label: "Nonce issues", desc: "Transaction nonce conflict or out-of-order submission" },
                ].map((tip) => (
                  <div key={tip.label} className="rounded-lg border border-border bg-space p-4">
                    <div className="mb-2 text-base">{tip.icon}</div>
                    <p className="text-sm font-medium text-text">{tip.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="font-mono text-xs text-accent-text">Need more help?</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">Ask MicroAI</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Get deeper answers about Arc transactions, USDC, CCTP, or any Circle integration for $0.001 USDC.
          </p>
          <Link
            href="/chat"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            Launch chat terminal
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
              { l: "Ecosystem", h: "/ecosystem" },
              { l: "Grants", h: "/grants" },
              { l: "Chat", h: "/chat" },
              { l: "Explorer", h: "https://explorer.arc.io" },
            ].map((link) => (
              <Link key={link.l} href={link.h} className="text-xs text-muted transition hover:text-text">
                {link.l}
              </Link>
            ))}
          </div>
        </div>
      </footer>

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
