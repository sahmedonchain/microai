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
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold text-success">{amount}</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`View transaction ${short(txHash)} on Arc Explorer`}
          className="inline-flex text-muted transition hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span className="font-mono">{short(from)} → {short(to)}</span>
        <span>{formatTimestamp(timestamp)}</span>
      </div>
      <div className="mt-1.5 font-mono text-xs text-muted">{short(txHash)}</div>
    </div>
  );
}
