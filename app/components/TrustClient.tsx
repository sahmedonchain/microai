"use client";
import { useState } from "react";
import Link from "next/link";
import type { TrustSummary } from "@/lib/verify/trust";

type NetworkChoice = "" | "mainnet" | "testnet";

const FIELD =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 text-base text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const TONE: Record<TrustSummary["result"], string> = {
  pass: "border-success/25 bg-success/10 text-success",
  warn: "border-warning/25 bg-warning/10 text-warning",
  fail: "border-danger/25 bg-danger/10 text-danger",
  unreachable: "border-border bg-surface text-muted",
};
const LABEL: Record<TrustSummary["result"], string> = {
  pass: "Passed",
  warn: "Warnings",
  fail: "Problems found",
  unreachable: "Unreachable",
};

export function TrustClient({ embedded = true }: { embedded?: boolean } = {}) {
  const [url, setUrl] = useState("");
  const [network, setNetwork] = useState<NetworkChoice>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrustSummary | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const q = new URLSearchParams({ url: url.trim() });
      if (network) q.set("network", network);
      const res = await fetch(`/api/trust?${q.toString()}`, { headers: { Accept: "application/json" } });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string" ? (data as { error: string }).error : `The check failed (HTTP ${res.status}). Try again shortly.`;
        setError(msg);
        return;
      }
      setResult(data as TrustSummary);
    } catch {
      setError("Could not reach MicroAI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const exampleUrl = `/api/trust?url=${encodeURIComponent(url.trim() || "https://example.com/paid")}${network ? `&network=${network}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-10">
      {!embedded && (
        <Link href="/" className="mb-6 block text-sm text-accent-text hover:underline">
          ← MicroAI
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Trust API</h1>
        <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Read-only</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        A short, machine-readable check of an endpoint&apos;s payment setup on Arc, for agents and scripts. It is a configuration check, not a rating of the service or its owner. It sends no payment.
      </p>

      <form
        className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !loading) void run();
        }}
      >
        <div>
          <label htmlFor="trust-url" className="mb-1.5 block text-sm font-medium">Endpoint URL</label>
          <input id="trust-url" className={FIELD} type="url" inputMode="url" autoComplete="off" placeholder="https://api.example.com/paid" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="trust-net" className="mb-1.5 block text-sm font-medium">Network</label>
          <select id="trust-net" className={FIELD} value={network} onChange={(e) => setNetwork(e.target.value as NetworkChoice)}>
            <option value="">Any Arc network</option>
            <option value="mainnet">Arc Mainnet</option>
            <option value="testnet">Arc Testnet</option>
          </select>
        </div>
        <button type="submit" className={BTN_PRIMARY} disabled={loading || !url.trim()}>
          {loading ? "Checking…" : "Check endpoint"}
        </button>
      </form>

      <div aria-live="polite">
        {error && <p role="alert" className="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{error}</p>}

        {result && (
          <section className="mt-6 rounded-lg border border-border bg-surface p-5" aria-labelledby="trust-result">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="trust-result" className="text-lg font-semibold">{result.endpoint.host}</h2>
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[result.result]}`}>{LABEL[result.result]}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{result.summary}</p>
            {result.arcNetworks.length > 0 && (
              <p className="mt-2 text-sm text-muted">Asks to be paid on: <span className="font-mono text-text">{result.arcNetworks.join(", ")}</span></p>
            )}
            {result.issues.length > 0 && (
              <ul className="mt-4 space-y-3">
                {result.issues.map((i) => (
                  <li key={i.id} className="rounded-md border border-border bg-space p-3 text-sm">
                    <p className={i.severity === "error" ? "font-medium text-danger" : "font-medium text-warning"}>{i.title}</p>
                    {i.fix && <p className="mt-1 text-muted">{i.fix}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted">{result.disclaimer}</p>
            <p className="mt-1 font-mono text-xs text-muted">Checked {result.checkedAt}</p>
          </section>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Use it from code</h2>
        <p className="mt-1 text-sm text-muted">Read-only GET. Limited to 5 requests a minute per IP, and each host is fetched at most 30 times an hour.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-text">{`curl "https://microai-tan.vercel.app${exampleUrl}"`}</pre>
      </section>
    </main>
  );
}
