"use client";
import { useState } from "react";
import { submitPurchase } from "@/lib/pendingPurchase";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

// "I paid but my credits never arrived": the user pastes the transaction hash
// and the server runs the same checks as a normal purchase (mined on Arc
// Mainnet, USDC to our wallet, sent by the signed-in wallet, within 7 days,
// credited only once) and adds the credits.
export function RecoverPayment({ onRecovered }: { onRecovered: (credits: number) => void }) {
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const recover = async () => {
    const hash = txHash.trim();
    if (!TX_HASH.test(hash)) {
      setResult({ ok: false, text: "Enter a transaction hash: 0x followed by 64 hex characters." });
      return;
    }
    setBusy(true);
    setResult(null);
    const outcome = await submitPurchase({ txHash: hash });
    setBusy(false);
    switch (outcome.kind) {
      case "credited":
        setResult({ ok: true, text: `Added ${outcome.added} ${outcome.added === 1 ? "query" : "queries"}. Your balance is now ${outcome.credits}.` });
        setTxHash("");
        onRecovered(outcome.credits);
        break;
      case "already":
        setResult({ ok: true, text: "This payment has already been credited to your account." });
        break;
      case "auth":
        setResult({ ok: false, text: "Sign in with the wallet that sent the payment, then try again." });
        break;
      case "held":
        setResult({ ok: false, text: outcome.message });
        break;
      case "retry":
        setResult({ ok: false, text: "We can't see this transaction on Arc Mainnet yet. If you just paid, wait a minute and try again." });
        break;
      case "rejected":
        setResult({ ok: false, text: outcome.message });
        break;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-text">Recover a payment</h2>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
        Paid USDC but no credits arrived? Paste the transaction hash. It must be a USDC payment to MicroAI from your signed-in wallet, sent in the last 7 days, and not credited before.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <input
          type="text"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && recover()}
          placeholder="0x..."
          aria-label="Transaction hash"
          className="min-w-0 flex-1 rounded-sm border border-border bg-space px-3 py-2.5 font-mono text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={recover}
          disabled={busy || !txHash.trim()}
          className="whitespace-nowrap rounded-md border border-border px-4 py-2.5 text-sm text-text transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Checking..." : "Recover payment"}
        </button>
      </div>
      {result && (
        <p role="status" className={`mt-3 text-xs ${result.ok ? "text-success" : "text-danger"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
