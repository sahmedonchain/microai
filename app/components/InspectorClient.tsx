"use client";

import { useState } from "react";
import Link from "next/link";
import { VerifyResult } from "@/app/components/VerifyResult";
import { inspectPayload, type InspectResult, type LifecycleStep, type StepState } from "@/lib/verify/inspector";

// Everything here runs in the browser. There is deliberately no fetch, no
// storage and no logging: a pasted PAYMENT-SIGNATURE is a signed authorization
// to spend money, and it must never leave this page. A test enforces that.

const AREA =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 font-mono text-xs leading-relaxed text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATE_STYLE: Record<StepState, { pill: string; text: string }> = {
  ok: { pill: "border-success/25 bg-success/10 text-success", text: "Looks right" },
  problem: { pill: "border-danger/20 bg-danger/10 text-danger", text: "Problem" },
  unverified: { pill: "border-secondary/30 bg-secondary-dim text-secondary-text", text: "Not verified" },
  missing: { pill: "border-border bg-surface text-muted", text: "Not provided" },
};

function Lifecycle({ steps }: { steps: LifecycleStep[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2" aria-label="Payment lifecycle">
      {steps.map((s) => {
        const st = STATE_STYLE[s.state];
        return (
          <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-text">{s.label}</p>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.pill}`}>{st.text}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.note}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function InspectorClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [required, setRequired] = useState("");
  const [signature, setSignature] = useState("");
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<InspectResult | null>(null);

  const empty = !required.trim() && !signature.trim() && !response.trim();

  function run() {
    setResult(inspectPayload({ paymentRequired: required, paymentSignature: signature, paymentResponse: response }));
  }
  function clearAll() {
    setRequired("");
    setSignature("");
    setResponse("");
    setResult(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-10">
      {!embedded && (
        <Link href="/" className="mb-6 block text-sm text-accent-text hover:underline">
          ← MicroAI
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Payload inspector</h1>
        <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Early preview</span>
        <span className="inline-flex items-center rounded-full border border-success/25 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Runs in your browser</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        Paste the x402 headers from a payment attempt. The inspector decodes them, checks the fields against the x402 v2 specification, recovers the signer of an EIP-3009 signature, and compares what the payer signed with what the service asked for. It sends nothing anywhere and saves nothing.
      </p>
      <p className="mt-3 max-w-prose rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm leading-relaxed text-warning">
        A PAYMENT-SIGNATURE is a signed authorization to move money until it is used. Only paste one from a test payment, or one that has already been settled or has expired.
      </p>

      <form
        className="mt-6 space-y-5 rounded-lg border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!empty) run();
        }}
      >
        <div>
          <label htmlFor="ins-required" className="mb-1.5 block text-sm font-medium">PAYMENT-REQUIRED <span className="font-normal text-muted">(what the service asked for)</span></label>
          <textarea id="ins-required" className={AREA} rows={3} spellCheck={false} autoComplete="off" value={required} onChange={(e) => setRequired(e.target.value)} placeholder="eyJ4NDAyVmVyc2lvbiI6Miw…" />
        </div>
        <div>
          <label htmlFor="ins-signature" className="mb-1.5 block text-sm font-medium">PAYMENT-SIGNATURE <span className="font-normal text-muted">(what the payer sent)</span></label>
          <textarea id="ins-signature" className={AREA} rows={3} spellCheck={false} autoComplete="off" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="eyJ4NDAyVmVyc2lvbiI6Miw…" />
        </div>
        <div>
          <label htmlFor="ins-response" className="mb-1.5 block text-sm font-medium">PAYMENT-RESPONSE <span className="font-normal text-muted">(what the service reported after settling)</span></label>
          <textarea id="ins-response" className={AREA} rows={2} spellCheck={false} autoComplete="off" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="eyJzdWNjZXNzIjp0cnVlLC…" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BTN_PRIMARY} disabled={empty}>Inspect headers</button>
          <button type="button" className={BTN_SECONDARY} onClick={clearAll} disabled={empty && !result}>Clear</button>
        </div>
      </form>

      {result && (
        <div className="mt-8 space-y-6" aria-live="polite">
          <section aria-labelledby="ins-life">
            <h2 id="ins-life" className="mb-3 text-xl font-semibold">Payment lifecycle</h2>
            <Lifecycle steps={result.lifecycle} />
          </section>
          <section aria-labelledby="ins-findings">
            <h2 id="ins-findings" className="mb-3 text-xl font-semibold">Findings</h2>
            <VerifyResult result={{ report: result.report }} />
          </section>
        </div>
      )}
    </main>
  );
}
