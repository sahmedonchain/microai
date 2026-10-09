"use client";
import { useState, useEffect } from "react";
import { TabLink as Link } from "@/app/components/tabs/TabNav";
import { PaymentReceipt } from "@/app/components/PaymentReceipt";
import { RecoverPayment } from "@/app/components/RecoverPayment";

interface Receipt {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  explorerUrl: string;
}

type State = "loading" | "unauthenticated" | "ready" | "error";

export function CreditsTab() {
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
    <div className="min-h-full bg-space font-sans text-text">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold leading-tight text-text">Credits &amp; payments</h1>
        <p className="mt-2 text-sm text-muted">Your USDC payment history on Arc Mainnet</p>

        <div className="mt-8">
          {state === "loading" && (
            <div className="flex items-center gap-3" role="status">
              <span className="flex gap-1" aria-hidden="true">
                {["", "[animation-delay:200ms]", "[animation-delay:400ms]"].map((d, i) => (
                  <span key={i} className={`size-1.5 animate-bounce rounded-full bg-accent-text motion-reduce:animate-none ${d}`} />
                ))}
              </span>
              <span className="font-mono text-xs text-muted">Loading payment history...</span>
            </div>
          )}

          {state === "unauthenticated" && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="mb-4 text-sm text-muted">Connect wallet to view your credits</p>
              <Link href="/chat" className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
                Connect wallet
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="rounded-md border border-danger/20 bg-danger/10 px-3.5 py-2.5 font-mono text-xs text-danger">
              {errorMsg}
            </div>
          )}

          {state === "ready" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5">
                <div>
                  <p className="mb-2 text-xs text-muted">Credits</p>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-4xl font-semibold leading-none text-text">{credits}</span>
                    <span className="text-sm text-muted">queries remaining</span>
                  </div>
                </div>
                <Link href="/chat" className="whitespace-nowrap rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110">
                  Buy more credits
                </Link>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                <div className="rounded-lg border border-border bg-surface p-5">
                  <p className="mb-2 text-xs text-muted">Total payments</p>
                  <p className="font-mono text-2xl font-semibold text-text">{receipts.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-5">
                  <p className="mb-2 text-xs text-muted">Total USDC spent</p>
                  <p className="font-mono text-2xl font-semibold text-text">{totalSpent.toFixed(3)}</p>
                </div>
              </div>

              <RecoverPayment onRecovered={(c) => setCredits(c)} />

              <div>
                <h2 className="mb-3 text-xs text-muted">Payment history</h2>
                {receipts.length === 0 ? (
                  <p className="text-sm text-muted">No USDC payments found for this wallet</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {receipts.map((r) => (
                      <PaymentReceipt key={r.txHash + r.from + r.to} {...r} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
