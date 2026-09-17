"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/app/components/Navbar";

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

interface DebugResult {
  summary: string;
  rootCause: string;
  solution: string;
  severity: "high" | "medium" | "low";
  txData: TxData;
}

function severity_color(s: string) {
  if (s === "high") return "#f87171";
  if (s === "medium") return "#f59e0b";
  return "#00ff88";
}

export default function DebugPage() {
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [result, setResult] = useState<DebugResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<string[]>([]);

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
      // Free, no-session endpoint: only ever accepts a tx hash, fetches the
      // real Explorer data and runs the AI analysis entirely server-side.
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
      });
      setHistory((prev) => [hash, ...prev.slice(0, 4)]);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Failed to reach the analyzer. Please try again.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#ffffff",
        fontFamily: "var(--font-geist-sans), sans-serif",
      }}
    >
      <Navbar />

      {/* HERO */}
      <section style={{ padding: "48px 20px 32px", textAlign: "center", borderBottom: "1px solid rgba(0,255,136,0.06)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(0,255,136,0.15)", background: "rgba(0,0,0,0.6)", marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace" }}>ARC MAINNET · LIVE DEBUGGER</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.5rem, 5vw + 2rem, 5.5rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", background: "linear-gradient(180deg,#fff 0%,rgba(255,255,255,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
          Transaction Debugger
        </h1>
        <p style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)", color: "#e5e5e5", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
          Paste any Arc MAINNET transaction hash. MicroAI fetches the data from Arc Explorer and explains exactly what happened — and how to fix it.
        </p>
      </section>

      {/* MAIN */}
      <section style={{ padding: "32px 16px 60px", maxWidth: 760, margin: "0 auto" }}>

        {/* Input */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.2em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>
            PASTE TRANSACTION HASH
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              placeholder="0x..."
              style={{
                flex: 1,
                minWidth: 0,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(0,255,136,0.15)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 12,
                color: "#fff",
                outline: "none",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={analyze}
              disabled={status === "analyzing"}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: status === "analyzing" ? "rgba(0,255,136,0.1)" : "linear-gradient(135deg,#00ff88,#00cc6a)",
                color: status === "analyzing" ? "#00ff88" : "#000",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                cursor: status === "analyzing" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {status === "analyzing" ? "ANALYZING..." : "DEBUG →"}
            </motion.button>
          </div>

          {errorMsg && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", fontSize: 11, color: "#f87171", fontFamily: "var(--font-geist-mono), monospace" }}>
              {errorMsg}
            </div>
          )}

          {status === "analyzing" && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#00ff88", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span style={{ fontSize: 10, color: "#aaaaaa", fontFamily: "var(--font-geist-mono), monospace" }}>
                Fetching transaction and analyzing...
              </span>
            </div>
          )}
        </div>

        {/* Result */}
        {result && status === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            <div style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: result.txData.result === "success" ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${result.txData.result === "success" ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: result.txData.result === "success" ? "#00ff88" : "#f87171", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: result.txData.result === "success" ? "#00ff88" : "#f87171" }}>
                  {result.txData.result === "success" ? "Transaction Successful" : "Transaction Failed"}
                </div>
                <div style={{ fontSize: 15, color: "#aaaaaa", marginTop: 2 }}>{result.summary}</div>
              </div>
            </div>

            <div style={{ padding: "18px", borderRadius: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,255,136,0.08)" }}>
              <div style={{ fontSize: 9, color: severity_color(result.severity), fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 8 }}>
                ROOT CAUSE · {result.severity.toUpperCase()} SEVERITY
              </div>
              <p style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)", color: "#e5e5e5", lineHeight: 1.7, margin: 0 }}>{result.rootCause}</p>
            </div>

            <div style={{ padding: "18px", borderRadius: 14, background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)" }}>
              <div style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 8 }}>
                HOW TO FIX
              </div>
              <p style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)", color: "#e5e5e5", lineHeight: 1.7, margin: 0 }}>{result.solution}</p>
            </div>

            <div style={{ padding: "18px", borderRadius: 14, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 9, color: "#aaaaaa", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>
                TRANSACTION DETAILS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "HASH", value: result.txData.hash.slice(0, 20) + "..." },
                  { label: "FROM", value: result.txData.from?.hash?.slice(0, 20) + "..." },
                  { label: "TO", value: result.txData.to?.hash ? result.txData.to.hash.slice(0, 20) + "..." : "Contract Creation" },
                  { label: "GAS USED", value: result.txData.gas_used },
                  { label: "GAS LIMIT", value: result.txData.gas_limit },
                  { label: "BLOCK", value: result.txData.block_number?.toString() || "Pending" },
                  { label: "FEE (USDC)", value: result.txData.fee?.value ? (parseInt(result.txData.fee.value) / 1e6).toFixed(6) : "—" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, color: "#999999", fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700, letterSpacing: "0.1em", flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: "#aaaaaa", fontFamily: "var(--font-geist-mono), monospace", textAlign: "right", wordBreak: "break-all" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <a
                href={`https://explorer.arc.io/tx/${result.txData.hash}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 14, fontSize: 10, color: "#00ff88", fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700, textDecoration: "none", letterSpacing: "0.08em" }}
              >
                VIEW ON ARC EXPLORER ↗
              </a>
            </div>
          </motion.div>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 9, color: "#999999", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 10 }}>
              RECENT HASHES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setTxHash(h); setStatus("idle"); setResult(null); }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    color: "#aaaaaa",
                    fontSize: 11,
                    fontFamily: "var(--font-geist-mono), monospace",
                    cursor: "pointer",
                    textAlign: "left",
                    letterSpacing: "0.02em",
                  }}
                >
                  {h.slice(0, 30)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "idle" && !result && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: "#999999", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>
              WHAT THIS DEBUGGER DETECTS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {[
                { icon: "⚡", label: "Insufficient USDC", desc: "Wallet didn't have enough USDC for gas or payment" },
                { icon: "🔗", label: "Wrong Chain", desc: "Transaction sent on wrong network, not Arc MAINNET" },
                { icon: "⛽", label: "Gas Limit Too Low", desc: "Gas ran out before transaction could complete" },
                { icon: "↩️", label: "Contract Revert", desc: "Smart contract rejected the call with a reason" },
                { icon: "📋", label: "Invalid Input", desc: "Wrong function selector or malformed calldata" },
                { icon: "🔢", label: "Nonce Issues", desc: "Transaction nonce conflict or out-of-order submission" },
              ].map((tip, i) => (
                <motion.div
                  key={tip.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ y: -3, borderColor: "rgba(0,255,136,0.2)" }}
                  style={{ padding: "14px", borderRadius: 12, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(0,255,136,0.06)" }}
                >
                  <div style={{ fontSize: 16, marginBottom: 6 }}>{tip.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>{tip.label}</div>
                  <div style={{ fontSize: 15, color: "#aaaaaa", lineHeight: 1.5 }}>{tip.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid rgba(0,255,136,0.06)", padding: "36px 16px", textAlign: "center", background: "rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.25em", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 12 }}>NEED MORE HELP?</div>
        <h2 style={{ fontSize: "clamp(2rem, 3vw + 1.5rem, 3.25rem)", fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>Ask MicroAI</h2>
        <p style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)", color: "#e5e5e5", maxWidth: 360, margin: "0 auto 20px", lineHeight: 1.65 }}>
          Get deeper answers about Arc transactions, USDC, CCTP, or any Circle integration for $0.001 USDC.
        </p>
        <Link href="/chat" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, background: "#00ff88", color: "#000", fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", textDecoration: "none" }}>
          LAUNCH CHAT TERMINAL →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(0,255,136,0.08)", background: "#000000", padding: "22px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 9, color: "#888888", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.1em" }}>MICROAI · ARC & CIRCLE INTELLIGENCE HUB</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { l: "ECOSYSTEM", h: "/ecosystem" },
              { l: "GRANTS", h: "/grants" },
              { l: "CHAT", h: "/chat" },
              { l: "EXPLORER", h: "https://explorer.arc.io" },
            ].map((link) => (
              <Link key={link.l} href={link.h} style={{ fontSize: 9, color: "#888888", fontWeight: 700, letterSpacing: "0.12em", fontFamily: "var(--font-geist-mono), monospace", textDecoration: "none" }}>
                {link.l}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
                html, body { background: #000000; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        input:focus { border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 0 3px rgba(0,255,136,0.1); }
        input::placeholder { color: #999999; }
      `}</style>
    </div>
  );
}