interface PaymentReceiptProps {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  explorerUrl: string;
}

const short = (a: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—");

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (!ts || Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

export function PaymentReceipt({ txHash, from, to, amount, timestamp, explorerUrl }: PaymentReceiptProps) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: "rgba(3,17,10,0.25)", border: "1px solid rgba(16,185,129,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#34d399", fontFamily: "monospace" }}>{amount}</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`View transaction ${short(txHash)} on Arc Explorer`}
          style={{ color: "#34d399", display: "inline-flex" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
        <span style={{ fontFamily: "monospace" }}>{short(from)} → {short(to)}</span>
        <span>{formatTimestamp(timestamp)}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{short(txHash)}</div>
    </div>
  );
}
