"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";

const ARC_RPC = "https://rpc.mainnet.arc.io";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const EURC_CONTRACT = "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1";
const RECEIVER_WALLET = "0x78C144A76614A8674285129810555C8bCa78f044";
const ARC_EXPLORER_API = "https://explorer.arc.io/api/v2";

interface NetworkStats {
  blockNumber: number;
  gasPrice: string;
  chainId: string;
}

interface WalletBalances {
  address: string;
  usdc: string;
  eurc: string;
  native: string;
}

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const data = await res.json();
  return data.result;
}

function formatUnits(hex: string, decimals: number): string {
  if (!hex || hex === "0x") return "0";
  const value = BigInt(hex);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

export default function StatsPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletInput, setWalletInput] = useState("");
  const [walletData, setWalletData] = useState<WalletBalances | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [revenue, setRevenue] = useState<string | null>(null);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isValidAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a.trim());

  const fetchNetworkStats = useCallback(async () => {
    try {
      const [blockHex, gasPriceHex, chainIdHex] = await Promise.all([
        rpcCall("eth_blockNumber"),
        rpcCall("eth_gasPrice"),
        rpcCall("eth_chainId"),
      ]);
      setStats({
        blockNumber: parseInt(blockHex, 16),
        gasPrice: formatUnits(gasPriceHex, 6),
        chainId: parseInt(chainIdHex, 16).toString(),
      });
      setLastUpdated(new Date());
    } catch {
      /* silent — RPC may be temporarily unavailable */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRevenue = useCallback(async () => {
    try {
      const data = "0x70a08231" + RECEIVER_WALLET.slice(2).padStart(64, "0");
      const result = await rpcCall("eth_call", [{ to: USDC_CONTRACT, data }, "latest"]);
      setRevenue(formatUnits(result, 6));
    } catch {
      /* silent */
    }
  }, []);

  const fetchTxCount = useCallback(async () => {
    try {
      const res = await fetch(`${ARC_EXPLORER_API}/addresses/${RECEIVER_WALLET}`);
      const data = await res.json();
      setTxCount(data.transactions_count ? parseInt(data.transactions_count) : null);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchNetworkStats();
    fetchRevenue();
    fetchTxCount();
    const interval = setInterval(fetchNetworkStats, 10000);
    return () => clearInterval(interval);
  }, [fetchNetworkStats, fetchRevenue, fetchTxCount]);

  const lookupWallet = async () => {
    const addr = walletInput.trim();
    if (!isValidAddress(addr)) {
      setWalletError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    setWalletData(null);
    try {
      const usdcData = "0x70a08231" + addr.slice(2).padStart(64, "0");
      const [usdcHex, eurcHex, nativeHex] = await Promise.all([
        rpcCall("eth_call", [{ to: USDC_CONTRACT, data: usdcData }, "latest"]),
        rpcCall("eth_call", [{ to: EURC_CONTRACT, data: usdcData }, "latest"]),
        rpcCall("eth_getBalance", [addr, "latest"]),
      ]);
      setWalletData({
        address: addr,
        usdc: formatUnits(usdcHex, 6),
        eurc: formatUnits(eurcHex, 6),
        native: formatUnits(nativeHex, 18),
      });
    } catch {
      setWalletError("Could not fetch balance. Check the address and try again.");
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      {/* HERO */}
      <section style={{ padding: "48px 20px 32px", textAlign: "center", borderBottom: "1px solid rgba(16,185,129,0.06)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.15)", background: "rgba(3,17,10,0.6)", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace" }}>LIVE FROM ARC RPC</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem,6vw,3.2rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", background: "linear-gradient(180deg,#fff 0%,rgba(148,163,184,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
          Arc Network Stats
        </h1>
        <p style={{ fontSize: "clamp(12px,3vw,14px)", color: "#94a3b8", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Real-time data pulled directly from Arc Mainnet RPC. No static numbers — this refreshes every 10 seconds.
        </p>
      </section>

      {/* NETWORK STATS */}
      <section style={{ padding: "32px 16px 20px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
          NETWORK STATUS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "BLOCK HEIGHT", value: loading ? "..." : stats?.blockNumber.toLocaleString() ?? "—", suffix: "" },
            { label: "GAS PRICE", value: loading ? "..." : stats?.gasPrice ?? "—", suffix: " USDC" },
            { label: "CHAIN ID", value: loading ? "..." : stats?.chainId ?? "—", suffix: "" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "20px", borderRadius: 14, background: "rgba(3,17,10,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 10 }}>{s.label}</div>
              <div style={{ fontSize: "clamp(1.3rem,4vw,1.8rem)", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
                {s.value}<span style={{ fontSize: 11, color: "#475569" }}>{s.suffix}</span>
              </div>
            </div>
          ))}
        </div>
        {lastUpdated && (
          <div style={{ textAlign: "right", marginTop: 10, fontSize: 9, color: "#334155", fontFamily: "monospace" }}>
            LAST UPDATED {lastUpdated.toLocaleTimeString()} · AUTO-REFRESH 10S
          </div>
        )}
      </section>

      {/* MICROAI REVENUE */}
      <section style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
          MICROAI ON-CHAIN ACTIVITY
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div style={{ padding: "20px", borderRadius: 14, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 10 }}>TOTAL USDC RECEIVED</div>
            <div style={{ fontSize: "clamp(1.3rem,4vw,1.8rem)", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
              {revenue === null ? "..." : `$${revenue}`}
            </div>
            <div style={{ fontSize: 9, color: "#334155", marginTop: 6, fontFamily: "monospace" }}>FROM AI QUERIES</div>
          </div>
          <div style={{ padding: "20px", borderRadius: 14, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 10 }}>TOTAL TRANSACTIONS</div>
            <div style={{ fontSize: "clamp(1.3rem,4vw,1.8rem)", fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>
              {txCount === null ? "..." : txCount.toLocaleString()}
            </div>
            <div style={{ fontSize: 9, color: "#334155", marginTop: 6, fontFamily: "monospace" }}>ON RECEIVER WALLET</div>
          </div>
        </div>
        <a
          href={`https://explorer.arc.io/address/${RECEIVER_WALLET}`}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: 10, fontSize: 10, color: "#34d399", fontFamily: "monospace", fontWeight: 700, textDecoration: "none", letterSpacing: "0.06em" }}
        >
          VIEW WALLET ON ARC EXPLORER ↗
        </a>
      </section>

      {/* WALLET LOOKUP */}
      <section style={{ padding: "20px 16px 60px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 12 }}>
          WALLET BALANCE LOOKUP
        </div>
        <div style={{ background: "rgba(3,17,10,0.2)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupWallet()}
              placeholder="0x... (any Arc mainnet address)"
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 12,
                color: "#fff",
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={lookupWallet}
              disabled={walletLoading}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: walletLoading ? "rgba(16,185,129,0.1)" : "linear-gradient(135deg,#10b981,#059669)",
                color: walletLoading ? "#34d399" : "#000",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                cursor: walletLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
            >
              {walletLoading ? "CHECKING..." : "LOOKUP →"}
            </button>
          </div>

          {walletError && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", fontSize: 11, color: "#f87171", fontFamily: "monospace" }}>
              {walletError}
            </div>
          )}

          {walletData && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {[
                { label: "USDC", value: walletData.usdc, color: "#2563eb" },
                { label: "EURC", value: walletData.eurc, color: "#2563eb" },
                { label: "NATIVE GAS", value: walletData.native, color: "#34d399" },
              ].map((b) => (
                <div key={b.label} style={{ padding: "14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 8, color: "#334155", fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 6 }}>{b.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: b.color, fontFamily: "monospace" }}>{b.value}</div>
                </div>
              ))}
            </div>
          )}

          {!walletData && !walletError && (
            <div style={{ marginTop: 12, fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
              Paste any Arc MAINNET wallet address to see live USDC, EURC, and native gas balance.
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid rgba(16,185,129,0.06)", padding: "36px 16px", textAlign: "center", background: "rgba(2,11,6,0.4)" }}>
        <div style={{ fontSize: 9, color: "#34d399", fontWeight: 700, letterSpacing: "0.25em", fontFamily: "monospace", marginBottom: 12 }}>NEED MORE HELP?</div>
        <h2 style={{ fontSize: "clamp(1.1rem,4vw,1.8rem)", fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>Ask MicroAI</h2>
        <p style={{ fontSize: 13, color: "#64748b", maxWidth: 360, margin: "0 auto 20px", lineHeight: 1.65 }}>
          Get deeper answers about Arc transactions, USDC, CCTP, or any Circle integration for $0.001 USDC.
        </p>
        <Link href="/chat" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, background: "#10b981", color: "#000", fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textDecoration: "none" }}>
          LAUNCH CHAT TERMINAL →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(16,185,129,0.08)", background: "#010402", padding: "22px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 9, color: "#1e3a29", fontFamily: "monospace", letterSpacing: "0.1em" }}>MICROAI · ARC & CIRCLE INTELLIGENCE HUB</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { l: "ECOSYSTEM", h: "/ecosystem" },
              { l: "GRANTS", h: "/grants" },
              { l: "DEBUGGER", h: "/debug" },
              { l: "EXPLORER", h: "https://explorer.arc.io" },
            ].map((link) => (
              <Link key={link.l} href={link.h} style={{ fontSize: 9, color: "#1e3a29", fontWeight: 700, letterSpacing: "0.12em", fontFamily: "monospace", textDecoration: "none" }}>
                {link.l}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        html, body { background: #010503; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}