"use client";
import { useState, useEffect } from "react";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1";

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

const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—");

function formatUnits(raw: string | undefined | null, decimals: number): string {
  if (!raw || !/^\d+$/.test(raw)) return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).slice(0, 6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

const CARD = "rounded-lg border border-border bg-surface p-5";
const CARD_TITLE = "mb-3 text-xs text-muted";

export function WalletTab() {
  const [address, setAddress] = useState("");
  const [ownAddress, setOwnAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WalletResult | null>(null);
  const [analyzed, setAnalyzed] = useState("");

  // The session cookie is httpOnly, so the client reads it through the
  // session endpoint instead of verifying the token itself.
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
    <div className="min-h-[calc(100vh-4rem)] bg-space font-sans text-text">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold leading-tight text-text">Wallet intelligence</h1>
        <p className="mt-2 text-sm text-muted">AI-powered wallet analysis on Arc Mainnet</p>

        <div className={`${CARD} mt-8`}>
          <label htmlFor="wallet-address" className={CARD_TITLE}>Wallet address</label>
          <div className="flex flex-wrap gap-2.5">
            <input
              id="wallet-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze(address)}
              placeholder="0x..."
              className="min-w-0 flex-1 rounded-sm border border-border bg-space px-3.5 py-3 font-mono text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => analyze(address)}
              disabled={loading}
              className="whitespace-nowrap rounded-md bg-accent px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOwn ? "Analyze my wallet" : "Analyze wallet"}
            </button>
          </div>
          {ownAddress && !isOwn && (
            <button
              onClick={() => { setAddress(ownAddress); analyze(ownAddress); }}
              disabled={loading}
              className="mt-2.5 text-xs text-accent-text hover:underline"
            >
              Analyze my wallet ({short(ownAddress)})
            </button>
          )}
          {error && (
            <div className="mt-2.5 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">{error}</div>
          )}
          {loading && (
            <div className="mt-3 flex items-center gap-2.5" role="status">
              <span className="flex gap-1" aria-hidden="true">
                {["", "[animation-delay:200ms]", "[animation-delay:400ms]"].map((d, i) => (
                  <span key={i} className={`size-1.5 animate-bounce rounded-full bg-accent-text motion-reduce:animate-none ${d}`} />
                ))}
              </span>
              <span className="font-mono text-xs text-muted">Analyzing wallet...</span>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-4 flex flex-col gap-3">
            <div className={CARD}>
              <h2 className={CARD_TITLE}>Wallet overview</h2>
              <dl className="flex flex-col gap-2">
                {[
                  { k: "Address", v: short(analyzed) },
                  { k: "Balance (USDC)", v: formatUnits(result.profile.coin_balance, 18) },
                  { k: "TX count", v: String(result.profile.tx_count ?? "—") },
                  { k: "First seen*", v: fmtDate(firstSeen) },
                  { k: "Last seen", v: fmtDate(lastSeen) },
                ].map((r) => (
                  <div key={r.k} className="flex justify-between gap-2.5">
                    <dt className="text-xs text-muted">{r.k}</dt>
                    <dd className="font-mono text-xs text-text">{r.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted">*Earliest of the last 20 transactions.</p>
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Token balances</h2>
              {result.tokenBalances.length === 0 ? (
                <p className="text-sm text-muted">No token balances</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {result.tokenBalances.map((t, i) => {
                    const contract = t.token?.address_hash || t.token?.address || "";
                    const key = contract.toLowerCase();
                    const hot = key === USDC || key === EURC;
                    return (
                      <div
                        key={i}
                        className={`flex flex-wrap justify-between gap-2.5 rounded-md border px-2.5 py-2 ${
                          hot ? "border-accent/30 bg-accent-dim" : "border-transparent"
                        }`}
                      >
                        <span className={`font-mono text-xs font-medium ${hot ? "text-accent-text" : "text-text"}`}>
                          {t.token?.symbol ?? "?"} {formatUnits(t.value, Number(t.token?.decimals ?? 18))}
                        </span>
                        <span className="font-mono text-xs text-muted">{short(contract)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Recent transactions</h2>
              {result.transactions.length === 0 ? (
                <p className="text-sm text-muted">No transactions</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {result.transactions.slice(0, 10).map((t, i) => {
                    const ok = (t.result ?? t.status) === "success" || t.status === "ok";
                    return (
                      <div key={t.hash ?? i} className="flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs">
                        <a href={`https://explorer.arc.io/tx/${t.hash}`} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
                          {short(t.hash)}
                        </a>
                        <span className="text-muted">{short(t.from?.hash)} → {short(t.to?.hash)}</span>
                        <span className="text-text">{formatUnits(t.value, 18)}</span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                            ok ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger"
                          }`}
                        >
                          {ok ? "● Confirmed" : "✕ Failed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Risk signals</h2>
              <div className="flex flex-wrap gap-2">
                {signals.map((s) => (
                  <span
                    key={s.name}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      s.on ? "border-danger/25 bg-danger/10 text-danger" : "border-success/25 bg-success/10 text-success"
                    }`}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div className={CARD}>
              <h2 className={`${CARD_TITLE} flex items-center gap-2`}>
                AI summary
                <span className="rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent-text">AI</span>
              </h2>
              <p className="text-sm leading-relaxed text-muted">{result.aiSummary}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
