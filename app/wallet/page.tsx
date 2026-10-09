"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";

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

const card = { padding: 18, borderRadius: 14, background: "rgba(3,17,10,0.25)", border: "1px solid rgba(16,185,129,0.08)" } as const;
const label = { fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 12 } as const;

export default function WalletPage() {
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
    <div style={{ minHeight: "100vh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      <section style={{ padding: "48px 20px 32px", borderBottom: "1px solid rgba(16,185,129,0.06)", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(1.6rem,6vw,2.6rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px", color: "#fff", letterSpacing: "-0.02em" }}>
          Wallet Intelligence
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>AI-powered wallet analysis on Arc Mainnet</p>
      </section>

      <section style={{ padding: "32px 16px 60px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ ...label, color: "#34d399" }}>WALLET ADDRESS</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze(address)}
              placeholder="0x..."
              style={{ flex: 1, minWidth: 0, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#fff", outline: "none", fontFamily: "monospace" }}
            />
            <button
              onClick={() => analyze(address)}
              disabled={loading}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: loading ? "rgba(16,185,129,0.1)" : "linear-gradient(135deg,#10b981,#059669)", color: loading ? "#34d399" : "#000", fontSize: 12, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
            >
              {isOwn ? "Analyze My Wallet" : "Analyze Wallet"}
            </button>
          </div>
          {ownAddress && !isOwn && (
            <button
              onClick={() => { setAddress(ownAddress); analyze(ownAddress); }}
              disabled={loading}
              style={{ marginTop: 10, background: "none", border: "none", color: "#34d399", fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Analyze my wallet ({short(ownAddress)})
            </button>
          )}
          {error && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", fontSize: 11, color: "#f87171", fontFamily: "monospace" }}>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }} role="status">
              <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>Analyzing wallet...</span>
            </div>
          )}
        </div>

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={card}>
              <div style={label}>WALLET OVERVIEW</div>
              {[
                { k: "ADDRESS", v: short(analyzed) },
                { k: "BALANCE (USDC)", v: formatUnits(result.profile.coin_balance, 18) },
                { k: "TX COUNT", v: String(result.profile.tx_count ?? "—") },
                { k: "FIRST SEEN*", v: fmtDate(firstSeen) },
                { k: "LAST SEEN", v: fmtDate(lastSeen) },
              ].map((r) => (
                <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em" }}>{r.k}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{r.v}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: "#334155" }}>*Earliest of the last 20 transactions.</div>
            </div>

            <div style={card}>
              <div style={label}>TOKEN BALANCES</div>
              {result.tokenBalances.length === 0 ? (
                <div style={{ fontSize: 12, color: "#475569" }}>No token balances</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.tokenBalances.map((t, i) => {
                    const contract = t.token?.address_hash || t.token?.address || "";
                    const key = contract.toLowerCase();
                    const hot = key === USDC || key === EURC;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: hot ? "8px 10px" : 0, borderRadius: 8, background: hot ? "rgba(16,185,129,0.08)" : "none", border: hot ? "1px solid rgba(52,211,153,0.2)" : "none" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: hot ? "#34d399" : "#e2e8f0", fontFamily: "monospace" }}>
                          {t.token?.symbol ?? "?"} {formatUnits(t.value, Number(t.token?.decimals ?? 18))}
                        </span>
                        <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{short(contract)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={label}>RECENT TRANSACTIONS</div>
              {result.transactions.length === 0 ? (
                <div style={{ fontSize: 12, color: "#475569" }}>No transactions</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.transactions.slice(0, 10).map((t, i) => {
                    const ok = (t.result ?? t.status) === "success" || t.status === "ok";
                    return (
                      <div key={t.hash ?? i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: "monospace", fontSize: 11 }}>
                        <a href={`https://explorer.arc.io/tx/${t.hash}`} target="_blank" rel="noreferrer" style={{ color: "#34d399", textDecoration: "none" }}>
                          {short(t.hash)}
                        </a>
                        <span style={{ color: "#64748b" }}>{short(t.from?.hash)} → {short(t.to?.hash)}</span>
                        <span style={{ color: "#94a3b8" }}>{formatUnits(t.value, 18)}</span>
                        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 10, color: ok ? "#34d399" : "#f87171", background: ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${ok ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                          {ok ? "● Confirmed" : "✕ Failed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={label}>RISK SIGNALS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {signals.map((s) => (
                  <span key={s.name} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.on ? "#f87171" : "#34d399", background: s.on ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", border: `1px solid ${s.on ? "rgba(239,68,68,0.25)" : "rgba(52,211,153,0.25)"}` }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
                AI SUMMARY
                <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 9, color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>AI</span>
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>{result.aiSummary}</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: 12, color: "#475569" }}>
          Need deeper answers? <Link href="/chat" style={{ color: "#34d399" }}>Ask MicroAI</Link>
        </div>
      </section>

      <style>{`
        html, body { background: #010503; margin: 0; overflow-x: hidden; }
        * { box-sizing: border-box; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
