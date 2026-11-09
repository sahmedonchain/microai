"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, ScanSearch, X } from "lucide-react";
import type { VerifyResponse } from "@/app/components/VerifyResult";

// The full report component is only needed after a check, so it loads on demand.
const VerifyResult = dynamic(() => import("@/app/components/VerifyResult").then((m) => m.VerifyResult), { ssr: false });

const EXAMPLES = [
  { id: "good", label: "A correct setup" },
  { id: "decimals18", label: "18-decimals mistake" },
  { id: "bad-recipient", label: "Wrong recipient" },
] as const;

// A real Verify check on the homepage: same API and same report as the Verify tool.
// It reads the endpoint's 402 answer and sends no payment.
export function TryIt() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  async function check(target: string) {
    if (loading) return;
    const u = target.trim();
    if (!u) return setError("Paste an endpoint URL to check.");
    if (!/^https?:\/\//i.test(u)) return setError("Start the URL with https://");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: u }) });
      const json = (await res.json().catch(() => ({}))) as VerifyResponse & { error?: string };
      if (!res.ok) {
        setResult(null);
        setError(res.status === 429 ? "Too many checks. Wait a minute and try again." : json.error || "Something went wrong. Try again.");
        return;
      }
      setResult(json);
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch {
      setResult(null);
      setError("Could not reach MicroAI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function runExample(id: string) {
    const u = `${window.location.origin}/api/lab/x402/${id}`;
    setUrl(u);
    void check(u);
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl text-left">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check(url);
        }}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/80 p-2 shadow-[0_20px_60px_-20px_rgb(139_107_192/0.5)] backdrop-blur sm:flex-row sm:items-center"
      >
        <label htmlFor="try-url" className="sr-only">
          Endpoint URL to check
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <ScanSearch className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
          <input
            id="try-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://your-api.com/paid-endpoint"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-text placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="hm-btn inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {loading ? "Checking" : "Check endpoint"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
        <span>Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => runExample(ex.id)}
            disabled={loading}
            className="rounded-full border border-border bg-surface/60 px-3 py-1.5 text-text/90 transition hover:border-accent/50 hover:text-accent-text disabled:opacity-60"
          >
            {ex.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Reads the endpoint&rsquo;s 402 answer. Sends no payment.</p>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div ref={panel} className="hm-arrive mt-4 rounded-2xl border border-border bg-space/90 p-4 shadow-[0_30px_80px_-30px_rgb(0,0,0,0.9)] backdrop-blur sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Verify report</p>
            <button
              type="button"
              onClick={() => setResult(null)}
              aria-label="Close report"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-raised hover:text-text"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <VerifyResult result={result} />
          </div>
        </div>
      )}
    </div>
  );
}
