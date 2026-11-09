"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VerifyResult, type VerifyResponse } from "@/app/components/VerifyResult";
import { HISTORY_KEY, addEntry, labelFor, parseHistory, removeEntry, type HistoryEntry } from "@/lib/verify/history";
import { parsePrefill, sumCounts, usdcToUnits, verdict } from "@/lib/verify/ui";

type NetworkChoice = "" | "mainnet" | "testnet";

interface SharedLink {
  id: string;
  path: string;
  deleteToken: string;
  expiresAt: string;
}
type ApiResult = VerifyResponse & { share?: SharedLink; shareError?: string; error?: string };

const day = (iso: string) => iso.slice(0, 10);

function saveHistory(list: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage can be blocked; the list then lives only until the page closes */
  }
}

const EXAMPLES = [
  { id: "good", label: "A correct setup" },
  { id: "decimals18", label: "18-decimals mistake" },
  { id: "testnet-address-on-mainnet", label: "Testnet address on Mainnet" },
  { id: "bad-recipient", label: "Wrong recipient" },
  { id: "slow", label: "Too slow (7 s)" },
  { id: "server-error", label: "Server error (503)" },
] as const;

const FIELD =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 text-base text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function VerifyClient() {
  const [url, setUrl] = useState("");
  const [network, setNetwork] = useState<NetworkChoice>("");
  const [txHash, setTxHash] = useState("");
  const [payTo, setPayTo] = useState("");
  const [amount, setAmount] = useState("");
  const [answerStatus, setAnswerStatus] = useState("");
  const [paymentResponse, setPaymentResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [autoRun, setAutoRun] = useState(false);
  const [wantLink, setWantLink] = useState(false);
  const [shared, setShared] = useState<SharedLink | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // A link such as /verify?url=...&tx=...&run=1 fills the form and can start the check.
  useEffect(() => {
    // The form must render empty on the server and on first paint, then take the
    // link's values once, so this one-time state set is intended.
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = parsePrefill(window.location.search);
    if (p.url) setUrl(p.url);
    if (p.tx) setTxHash(p.tx);
    if (p.network) setNetwork(p.network);
    if (p.to) setPayTo(p.to);
    if (p.amount) setAmount(p.amount);
    if (p.run && (p.url || p.tx)) setAutoRun(true);
    try {
      setHistory(parseHistory(window.localStorage.getItem(HISTORY_KEY)));
    } catch {
      /* storage blocked: start with an empty list */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function fillExample(id: string) {
    setUrl(`${window.location.origin}/api/lab/x402/${id}`);
    setTxHash("");
    setPayTo("");
    setAmount("");
    setNetwork("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void runCheck();
  }

  async function runCheck() {
    if (loading) return;
    setError(null);

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
      const st = answerStatus.trim();
      const pr = paymentResponse.trim();
      if (st || pr) {
        if (!/^[1-5][0-9]{2}$/.test(st)) return setError("Enter the HTTP status the service answered after you paid, for example 200 or 503.");
        body.delivery = pr ? { httpStatus: Number(st), paymentResponse: pr } : { httpStatus: Number(st) };
      }
    }

    if (wantLink) body.share = true;
    setShared(null);
    setShareError(null);
    setLinkCopied(false);

    setLoading(true);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as ApiResult;
      if (!res.ok) {
        setResult(null);
        setError(res.status === 429 ? "Too many checks. Wait a minute and try again." : json.error || "Something went wrong. Try again.");
        return;
      }
      setResult(json);
      if (json.share) {
        setShared(json.share);
        const v = verdict(sumCounts(json.report?.counts, json.transaction?.counts));
        const next = addEntry(history, {
          id: json.share.id,
          createdAt: new Date().toISOString(),
          expiresAt: json.share.expiresAt,
          label: labelFor({ url: json.url, txHash: json.transaction?.txHash }),
          verdict: v.text,
          deleteToken: json.share.deleteToken,
        });
        setHistory(next);
        saveHistory(next);
      } else if (json.shareError) {
        setShareError(json.shareError);
      }
    } catch {
      setResult(null);
      setError("Could not reach MicroAI. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shared) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shared.path}`);
      setLinkCopied(true);
    } catch {
      setShareError("Could not copy. Select the link and copy it by hand.");
    }
  }

  async function removeReport(id: string, token: string) {
    try {
      const res = await fetch(`/api/verify/report/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      // 404 means it is already gone (expired or deleted), so drop it from the list too.
      if (!res.ok && res.status !== 404) {
        setShareError("Could not delete the report. Try again.");
        return;
      }
    } catch {
      setShareError("Could not reach MicroAI. Try again.");
      return;
    }
    const next = removeEntry(history, id);
    setHistory(next);
    saveHistory(next);
    if (shared?.id === id) setShared(null);
  }

  useEffect(() => {
    if (!autoRun) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoRun(false);
    void runCheck();
    // runCheck reads the state set by the prefill effect, which has been applied by now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

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
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Want to test with real payments, without real money?{" "}
            <Link href="/lab" className="text-accent-text hover:underline">
              Open the Testnet lab
            </Link>
            .
          </p>
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
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">Did the service deliver? (optional)</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Tell MicroAI what the service answered after you paid. MicroAI sends no payment and cannot see this itself, so it uses what you enter.
              </p>
              <label htmlFor="v-ans" className="mt-3 block text-sm font-medium">
                HTTP status of the service&apos;s answer
              </label>
              <input id="v-ans" type="text" inputMode="numeric" autoComplete="off" value={answerStatus} onChange={(e) => setAnswerStatus(e.target.value)} placeholder="200" className={`${FIELD} mt-1.5 font-mono`} />
              <label htmlFor="v-pr" className="mt-3 block text-sm font-medium">
                PAYMENT-RESPONSE header (if you have it)
              </label>
              <input id="v-pr" type="text" autoComplete="off" spellCheck={false} value={paymentResponse} onChange={(e) => setPaymentResponse(e.target.value)} placeholder="base64…" className={`${FIELD} mt-1.5 font-mono`} />
            </div>
          </div>
        </details>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={wantLink} onChange={(e) => setWantLink(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" />
          <span>
            <span className="font-medium">Create a link to share this result</span>
            <span className="block text-xs leading-relaxed text-muted">Anyone with the link can read the report for 30 days. It is not listed anywhere, and you can delete it.</span>
          </span>
        </label>

        <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          {loading ? "Checking…" : "Check"}
        </button>
      </form>

      <div aria-live="polite" className="mt-8">
        {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        {result && (
          <VerifyResult
            result={result}
            top={
              shared ? (
                <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-medium">Shareable link</p>
                  <p className="mt-1 break-all rounded-sm border border-border bg-space px-2.5 py-1.5 font-mono text-xs text-text">{typeof window !== "undefined" ? window.location.origin : ""}{shared.path}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">Works until {day(shared.expiresAt)}. It shows this check as it is now, not later.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={copyLink} className={BTN_SECONDARY}>
                      {linkCopied ? "Link copied" : "Copy link"}
                    </button>
                    <button type="button" onClick={() => void removeReport(shared.id, shared.deleteToken)} className={BTN_SECONDARY}>
                      Delete this link
                    </button>
                  </div>
                </div>
              ) : shareError ? (
                <p role="alert" className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm">{shareError}</p>
              ) : null
            }
          />
        )}
      </div>

      {history.length > 0 && (
        <section className="mt-12 border-t border-border pt-6" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold">
            Your shared reports
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">Kept only in this browser. Clearing your browser data removes this list, not the links.</p>
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/verify/r/${h.id}`} className="break-all text-sm font-medium text-accent-text hover:underline">
                    {h.label}
                  </Link>
                  <p className="text-xs text-muted">
                    {h.verdict} · {day(h.createdAt)} · until {day(h.expiresAt)}
                  </p>
                </div>
                <button type="button" onClick={() => void removeReport(h.id, h.deleteToken)} className={BTN_SECONDARY}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <p className="mt-6 max-w-prose text-xs leading-relaxed text-muted">
          Building an agent? There is a read-only JSON version of the endpoint check: <code className="font-mono">GET /api/trust?url=https://…</code>. It is a configuration check, not a reputation score.
        </p>
        <p className="mt-3 text-xs text-muted">
          MicroAI is an independent project, not an official Arc or Circle product. <Link href="/security" className="text-accent-text hover:underline">Security</Link>
        </p>
      </section>
    </main>
  );
}
