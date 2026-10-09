"use client";
import { useState } from "react";

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

const SEVERITY_TEXT: Record<string, string> = {
  high: "text-danger",
  medium: "text-warning",
  low: "text-success",
};

const CARD = "rounded-lg border border-border bg-surface p-5";
const CARD_TITLE = "mb-3 text-xs text-muted";

const DETECTS = [
  { label: "Insufficient USDC", desc: "Wallet didn't have enough USDC for gas or payment" },
  { label: "Wrong chain", desc: "Transaction sent on wrong network, not Arc Mainnet" },
  { label: "Gas limit too low", desc: "Gas ran out before transaction could complete" },
  { label: "Contract revert", desc: "Smart contract rejected the call with a reason" },
  { label: "Invalid input", desc: "Wrong function selector or malformed calldata" },
  { label: "Nonce issues", desc: "Transaction nonce conflict or out-of-order submission" },
];

export function DebuggerTab() {
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
        tokenTransfers: data.tokenTransfers ?? [],
        internalTxs: data.internalTxs ?? [],
        decodedFunction: data.decodedFunction ?? "unknown",
        correctedFlow: data.correctedFlow ?? [],
      });
      setHistory((prev) => [hash, ...prev.filter((h) => h !== hash).slice(0, 4)]);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Failed to reach the analyzer. Please try again.");
    }
  };

  const ok = result?.txData.result === "success";

  return (
    <div className="min-h-full bg-space font-sans text-text">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold leading-tight text-text">Transaction debugger</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Paste any Arc Mainnet transaction hash. MicroAI fetches the data from Arc Explorer and explains what happened, and how to fix it.
        </p>

        <div className={`${CARD} mt-8`}>
          <label htmlFor="tx-hash" className={CARD_TITLE}>Transaction hash</label>
          <div className="flex flex-wrap gap-2.5">
            <input
              id="tx-hash"
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              placeholder="0x..."
              className="min-w-0 flex-1 rounded-sm border border-border bg-space px-3.5 py-3 font-mono text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              onClick={analyze}
              disabled={status === "analyzing"}
              className="whitespace-nowrap rounded-md bg-accent px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "analyzing" ? "Analyzing..." : "Debug transaction"}
            </button>
          </div>

          {errorMsg && (
            <div className="mt-2.5 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">{errorMsg}</div>
          )}

          {status === "analyzing" && (
            <div className="mt-3 flex items-center gap-2.5" role="status">
              <span className="flex gap-1" aria-hidden="true">
                {["", "[animation-delay:200ms]", "[animation-delay:400ms]"].map((d, i) => (
                  <span key={i} className={`size-1.5 animate-bounce rounded-full bg-accent-text motion-reduce:animate-none ${d}`} />
                ))}
              </span>
              <span className="font-mono text-xs text-muted">Fetching transaction and analyzing...</span>
            </div>
          )}
        </div>

        {result && status === "done" && (
          <div className="mt-4 flex flex-col gap-3">
            <div
              className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 ${
                ok ? "border-success/20 bg-success/10" : "border-danger/20 bg-danger/10"
              }`}
            >
              <span className={`size-2.5 shrink-0 rounded-full ${ok ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
              <div>
                <p className={`text-sm font-medium ${ok ? "text-success" : "text-danger"}`}>
                  {ok ? "Transaction successful" : "Transaction failed"}
                </p>
                <p className="mt-0.5 text-xs text-muted">{result.summary}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-muted">Function decoded</span>
              <span
                className={`break-all rounded-full border px-3 py-1 font-mono text-xs font-medium ${
                  result.decodedFunction === "unknown"
                    ? "border-border bg-surface text-muted"
                    : "border-accent/30 bg-accent-dim text-accent-text"
                }`}
              >
                {result.decodedFunction}
              </span>
            </div>

            <div className={CARD}>
              <h2 className={`${CARD_TITLE} ${SEVERITY_TEXT[result.severity] ?? "text-muted"}`}>
                Root cause, {result.severity} severity
              </h2>
              <p className="text-sm leading-relaxed text-muted">{result.rootCause}</p>
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>How to fix</h2>
              <p className="text-sm leading-relaxed text-muted">{result.solution}</p>
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Transaction details</h2>
              <dl className="flex flex-col gap-2">
                {[
                  { label: "Hash", value: result.txData.hash.slice(0, 20) + "..." },
                  { label: "From", value: result.txData.from?.hash?.slice(0, 20) + "..." },
                  { label: "To", value: result.txData.to?.hash ? result.txData.to.hash.slice(0, 20) + "..." : "Contract creation" },
                  { label: "Gas used", value: result.txData.gas_used },
                  { label: "Gas limit", value: result.txData.gas_limit },
                  { label: "Block", value: result.txData.block_number?.toString() || "Pending" },
                  { label: "Fee (USDC)", value: result.txData.fee?.value ? (parseInt(result.txData.fee.value) / 1e6).toFixed(6) : "N/A" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2.5">
                    <dt className="shrink-0 text-xs text-muted">{row.label}</dt>
                    <dd className="break-all text-right font-mono text-xs text-text">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <a
                href={`https://explorer.arc.io/tx/${result.txData.hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3.5 inline-block text-xs font-medium text-accent-text hover:underline"
              >
                View on Arc Explorer ↗
              </a>
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Token movements</h2>
              {result.tokenTransfers.length === 0 ? (
                <p className="text-sm text-muted">No token transfers</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {result.tokenTransfers.map((t, i) => (
                    <div key={i} className="flex flex-wrap justify-between gap-2.5 font-mono text-xs">
                      <span className="font-medium text-text">{t.value} {t.symbol}</span>
                      <span className="text-muted">{shortAddr(t.from)} → {shortAddr(t.to)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Internal transactions</h2>
              {result.internalTxs.length === 0 ? (
                <p className="text-sm text-muted">No internal transactions</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {result.internalTxs.map((t, i) => (
                    <div key={i} className="flex flex-wrap justify-between gap-2.5 font-mono text-xs">
                      <span className="text-text">{t.type}</span>
                      <span className="text-muted">{shortAddr(t.from)} → {shortAddr(t.to)}</span>
                      <span className="text-text">{t.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={CARD}>
              <h2 className={CARD_TITLE}>Corrected flow</h2>
              <ol className="flex flex-col gap-2">
                {result.correctedFlow.map((step, i) => (
                  <li key={i} className="flex items-center gap-2.5 font-mono text-xs text-muted">
                    <span className="font-medium text-accent-text">{i + 1}.</span>
                    <span className="text-accent-text" aria-hidden="true">→</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2.5 text-xs text-muted">Recent hashes</h2>
            <div className="flex flex-col gap-1.5">
              {history.map((h) => (
                <button
                  key={h}
                  onClick={() => { setTxHash(h); setStatus("idle"); setResult(null); }}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-left font-mono text-xs text-muted transition hover:text-text"
                >
                  {h.slice(0, 30)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {status === "idle" && !result && (
          <div className="mt-8">
            <h2 className="mb-3 text-xs text-muted">What this debugger detects</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {DETECTS.map((tip) => (
                <div key={tip.label} className="rounded-lg border border-border bg-surface p-3.5">
                  <p className="mb-1 text-sm font-medium text-text">{tip.label}</p>
                  <p className="text-xs leading-relaxed text-muted">{tip.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
