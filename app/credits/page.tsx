"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";
import { PaymentReceipt } from "@/app/components/PaymentReceipt";

interface Receipt {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  explorerUrl: string;
}

type State = "loading" | "unauthenticated" | "ready" | "error";

const card = { padding: 20, borderRadius: 14, background: "rgba(3,17,10,0.25)", border: "1px solid rgba(16,185,129,0.08)" } as const;
const label = { fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", marginBottom: 12 } as const;

export default function CreditsPage() {
  const [state, setState] = useState<State>("loading");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [credits, setCredits] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

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

  const totalSpent = receipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      <section style={{ padding: "48px 20px 32px", borderBottom: "1px solid rgba(16,185,129,0.06)", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(1.6rem,6vw,2.6rem)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px", color: "#fff", letterSpacing: "-0.02em" }}>
          Credits &amp; Payments
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>Your USDC payment history on Arc Mainnet</p>
      </section>

      <section style={{ padding: "32px 16px 60px", maxWidth: 760, margin: "0 auto" }}>
        {state === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} role="status">
            <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>Loading payment history...</span>
          </div>
        )}

        {state === "unauthenticated" && (
          <div style={card}>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "#94a3b8" }}>Connect wallet to view your credits</p>
            <Link href="/chat" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, background: "#10b981", color: "#000", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
              Connect wallet
            </Link>
          </div>
        )}

        {state === "error" && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", fontSize: 12, color: "#f87171", fontFamily: "monospace" }}>
            {errorMsg}
          </div>
        )}

        {state === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={label}>CREDITS</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 40, fontWeight: 600, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>{credits}</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>queries remaining</span>
                </div>
              </div>
              <Link href="/chat" style={{ padding: "12px 24px", borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", color: "#000", fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                Buy More Credits
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div style={card}>
                <div style={label}>TOTAL PAYMENTS</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#e2e8f0", fontFamily: "monospace" }}>{receipts.length}</div>
              </div>
              <div style={card}>
                <div style={label}>TOTAL USDC SPENT</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#34d399", fontFamily: "monospace" }}>{totalSpent.toFixed(3)}</div>
              </div>
            </div>

            <div>
              <div style={label}>PAYMENT HISTORY</div>
              {receipts.length === 0 ? (
                <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>No USDC payments found for this wallet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {receipts.map((r) => (
                    <PaymentReceipt key={r.txHash + r.from + r.to} {...r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <style>{`
        html, body { background: #010503; margin: 0; overflow-x: hidden; }
        * { box-sizing: border-box; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </div>
  );
}
