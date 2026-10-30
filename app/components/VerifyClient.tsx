"use client";

import { useState } from "react";
import Link from "next/link";
import type { Finding, Severity, VerifyReport } from "@/lib/verify/types";
import { SEVERITY_LABEL, reportToText, sumCounts, usdcToUnits, verdict } from "@/lib/verify/ui";

interface TxResult {
  network?: "mainnet" | "testnet";
  txHash: string;
  explorerUrl?: string;
  findings: Finding[];
  counts: Record<Severity, number>;
}

interface VerifyResponse {
  url?: string;
  httpStatus?: number;
  report?: VerifyReport;
  transaction?: TxResult;
}

type NetworkChoice = "" | "mainnet" | "testnet";

const EXAMPLES = [
  { id: "good", label: "A correct setup" },
  { id: "decimals18", label: "18-decimals mistake" },
  { id: "testnet-address-on-mainnet", label: "Testnet address on Mainnet" },
  { id: "bad-recipient", label: "Wrong recipient" },
] as const;

const PILL: Record<Severity, string> = {
  error: "border-danger/20 bg-danger/10 text-danger",
  warning: "border-warning/25 bg-warning/10 text-warning",
  info: "border-secondary/30 bg-secondary-dim text-secondary-text",
  ok: "border-success/25 bg-success/10 text-success",
};
const MARK: Record<Severity, string> = { error: "✕", warning: "▲", info: "●", ok: "✓" };

const FIELD =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 text-base text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function FindingCard({ f }: { f: Finding }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[f.severity]}`}>
          <span aria-hidden="true">{MARK[f.severity]}</span>
          {SEVERITY_LABEL[f.severity]}
        </span>
        <h3 className="min-w-0 text-base font-semibold">{f.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{f.reason}</p>
      {f.evidence && (
        <p className="mt-2 break-all rounded-sm border border-border bg-space px-2.5 py-1.5 font-mono text-xs text-text">{f.evidence}</p>
      )}
      {f.fix && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-medium text-accent-text">How to fix: </span>
          <span className="text-text">{f.fix}</span>
        </p>
      )}
    </li>
  );
}

function Findings({ items }: { items: Finding[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((f, i) => (
        <FindingCard key={`${f.id}-${i}`} f={f} />
      ))}
    </ul>
  );
}

export function VerifyClient() {
  const [url, setUrl] = useState("");
  const [network, setNetwork] = useState<NetworkChoice>("");
  const [txHash, setTxHash] = useState("");
  const [payTo, setPayTo] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  function fillExample(id: string) {
    setUrl(`${window.location.origin}/api/lab/x402/${id}`);
    setTxHash("");
    setPayTo("");
    setAmount("");
    setNetwork("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setCopied(false);

    const u = url.trim();
    const h = txHash.trim();
    const p = payTo.trim();
    const a = amount.trim();
    if (!u && !h) return setError("Enter an endpoint URL, a transaction hash, or both.");
    if (h && !/^0x[0-9a-fA-F]{64}$/.test(h)) return setError("A transaction hash is 0x followed by 64 characters. Paste the full hash.");

    const body: Record<string, unknown> = {};
    if (u) body.url = u;
    if (network) body.network = network;
    if (h) {
      body.txHash = h;
      const needExpect = !u || p || a;
      if (needExpect) {
        const units = usdcToUnits(a);
        if (!/^0x[0-9a-fA-F]{40}$/.test(p)) return setError("Enter the recipient address you expect (0x followed by 40 characters).");
        if (units === null) return setError("Enter the expected amount in USDC, for example 0.001 (up to 6 decimals).");
        if (!u && !network) return setError("Choose the network the transaction is on.");
        body.expect = { payTo: p, amount: units };
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as VerifyResponse & { error?: string };
      if (!res.ok) {
        setResult(null);
        setError(res.status === 429 ? "Too many checks. Wait a minute and try again." : json.error || "Something went wrong. Try again.");
        return;
      }
      setResult(json);
    } catch {
      setResult(null);
      setError("Could not reach MicroAI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const counts = result ? sumCounts(result.report?.counts, result.transaction?.counts) : undefined;
  const v = counts ? verdict(counts) : undefined;

  async function copyReport() {
    if (!result) return;
    const text = reportToText({
      url: result.url,
      httpStatus: result.httpStatus,
      findings: result.report?.findings ?? [],
      txHash: result.transaction?.txHash,
      explorerUrl: result.transaction?.explorerUrl,
      txFindings: result.transaction?.findings,
      notChecked: result.report?.notChecked,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the report text and copy it by hand.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-12">
      <Link href="/" className="text-sm text-accent-text hover:underline">
        ← MicroAI
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">MicroAI Verify</h1>
        <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Early preview</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        Check an x402 payment setup on Arc before real money moves. Give it your endpoint and it reads the payment requirements the way a client would, then tells you what is wrong and how to fix it. It can also match a transaction against what the endpoint asked for.
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        It sends no payment. Limits: 5 checks a minute and 40 a day. It is experimental and not audited, and a clean report is not a guarantee.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="v-url" className="block text-sm font-medium">
            Endpoint URL
          </label>
          <input
            id="v-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/paid"
            className={`${FIELD} mt-1.5 font-mono`}
          />
          <p className="mt-1.5 text-xs text-muted">Must be https. It is asked for its price with a plain GET and no payment.</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Try an example">
            <span className="w-full text-xs text-muted">Or try an example endpoint:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.id} type="button" onClick={() => fillExample(ex.id)} className={`${BTN_SECONDARY} !min-h-10 !px-3 text-xs`}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="v-net" className="block text-sm font-medium">
            Network
          </label>
          <select id="v-net" value={network} onChange={(e) => setNetwork(e.target.value as NetworkChoice)} className={`${FIELD} mt-1.5`}>
            <option value="">Detect from the endpoint</option>
            <option value="mainnet">Arc Mainnet (5042)</option>
            <option value="testnet">Arc Testnet (5042002)</option>
          </select>
        </div>

        <details className="rounded-lg border border-border bg-surface p-4" open={txHash.length > 0}>
          <summary className="min-h-6 cursor-pointer text-sm font-medium">Also check a payment transaction (optional)</summary>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="v-tx" className="block text-sm font-medium">
                Transaction hash
              </label>
              <input id="v-tx" type="text" autoComplete="off" spellCheck={false} value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" className={`${FIELD} mt-1.5 font-mono`} />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              With an endpoint URL above, the expected recipient and amount are taken from the endpoint. Leave the two fields below empty to use them, or fill them in to check against your own numbers. Without a URL they are required.
            </p>
            <div>
              <label htmlFor="v-to" className="block text-sm font-medium">
                Expected recipient
              </label>
              <input id="v-to" type="text" autoComplete="off" spellCheck={false} value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="0x…" className={`${FIELD} mt-1.5 font-mono`} />
            </div>
            <div>
              <label htmlFor="v-amt" className="block text-sm font-medium">
                Expected amount (USDC)
              </label>
              <input id="v-amt" type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.001" className={`${FIELD} mt-1.5 font-mono`} />
            </div>
          </div>
        </details>

        <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          {loading ? "Checking…" : "Check"}
        </button>
      </form>

      <div aria-live="polite" className="mt-8">
        {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        {result && v && counts && (
          <section>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[v.tone === "ok" ? "ok" : v.tone]}`}>
                  <span aria-hidden="true">{MARK[v.tone === "ok" ? "ok" : v.tone]}</span>
                  {v.text}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {counts.error} error{counts.error === 1 ? "" : "s"}, {counts.warning} warning{counts.warning === 1 ? "" : "s"}, {counts.info} note{counts.info === 1 ? "" : "s"}, {counts.ok} passed
                {result.httpStatus !== undefined && <> · the endpoint answered HTTP {result.httpStatus}</>}
              </p>
              <button type="button" onClick={copyReport} className={`${BTN_SECONDARY} mt-3`}>
                {copied ? "Copied" : "Copy report as text"}
              </button>
            </div>

            {result.report && (
              <>
                <h2 className="mt-6 text-lg font-semibold">Endpoint</h2>
                <Findings items={result.report.findings} />
              </>
            )}

            {result.transaction && (
              <>
                <h2 className="mt-6 text-lg font-semibold">Transaction</h2>
                <p className="mt-1 break-all font-mono text-xs text-muted">{result.transaction.txHash}</p>
                {result.transaction.explorerUrl && (
                  <a href={result.transaction.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-accent-text hover:underline">
                    View on Arc Explorer
                  </a>
                )}
                <Findings items={result.transaction.findings} />
              </>
            )}

            {result.report && (
              <details className="mt-6 rounded-lg border border-border bg-surface p-4">
                <summary className="min-h-6 cursor-pointer text-sm font-medium">What was and was not checked</summary>
                <h3 className="mt-3 text-sm font-semibold">Checked</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                  {result.report.checked.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <h3 className="mt-3 text-sm font-semibold">Not checked</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                  {result.report.notChecked.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Did Verify miss something, or get it wrong?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          This is an early preview and your experience decides what it checks next. Tell me what you tried and what you expected.
        </p>
        <a
          href="https://github.com/sahmedonchain/microai/issues/new?title=Verify%20feedback%3A%20"
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_SECONDARY} mt-3`}
        >
          Share feedback on GitHub
        </a>
        <p className="mt-6 text-xs text-muted">
          MicroAI is an independent project, not an official Arc or Circle product. <Link href="/security" className="text-accent-text hover:underline">Security</Link>
        </p>
      </section>
    </main>
  );
}
