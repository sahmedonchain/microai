"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ARC_MAINNET } from "@/lib/arcConfig";
import { parseSwapCommand } from "@/lib/swap/parse";
import { ConnectWallet } from "@/app/components/ConnectWallet";

// Chat-based swap, USDC <-> EURC on Arc. You type what you want, MicroAI shows a
// quote card, and only your own wallet can sign. MicroAI never holds a key, never
// signs and never sends. The swap itself is run by Circle's App Kit in your
// browser; its service calls go through MicroAI's server, which holds the API key
// and sets the fee, so no secret ever reaches this page.

const FIELD =
  "w-full rounded-lg border border-border bg-space px-3.5 py-3 text-base text-text placeholder:text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const BTN2 =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm text-text hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface Quote {
  id: string;
  from: string;
  to: string;
  amountIn: string;
  estimatedReceive: string;
  minimumReceive: string;
  fee: string;
  feeToken: string;
  feePercent: string;
  slippage: string;
  network: string;
  expiresAt: string;
}
interface Hist {
  id: string;
  from: string;
  to: string;
  amountIn: string;
  actualOut: string | null;
  expectedOut: string;
  status: string;
  txHash: string | null;
  createdAt: string;
  error: string | null;
}
type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; text: string }
  | { id: number; role: "quote"; quote: Quote; phase: "ready" | "signing" | "pending" | "done" | "failed" | "cancelled"; note?: string; tx?: string; received?: string; reason?: string };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed.");
  return data as T;
}

/** While a confirmed swap runs, the SDK's calls to Circle are sent to MicroAI's server instead. */
function routeCircleCalls(quoteId: string): () => void {
  const original = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = /^https:\/\/api\.circle\.com\/v1\/stablecoinKits\/(.+)$/.exec(url);
    if (!m) return original(input, init);
    const headers = new Headers(init?.headers);
    headers.set("x-swap-quote", quoteId);
    return original(`/api/swap/circle/${m[1]}`, { ...init, headers, credentials: "same-origin" });
  };
  return () => {
    window.fetch = original;
  };
}

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> };

const friendly = (e: unknown) => {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001 || /reject|denied|cancel/i.test(err?.message ?? "")) return "You rejected the request in your wallet. Nothing was sent.";
  if (/slippage|min.?out|price/i.test(err?.message ?? "")) return "Slippage limit exceeded";
  if (/insufficient|balance/i.test(err?.message ?? "")) return "Insufficient balance";
  return (err?.message || "Network error").slice(0, 160);
};

export function SwapClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const next = () => idRef.current++;
  const patch = (id: number, p: Partial<Extract<Msg, { role: "quote" }>>) => setMsgs((m) => m.map((x) => (x.id === id && x.role === "quote" ? { ...x, ...p } : x)));
  const say = (t: string) => setMsgs((m) => [...m, { id: next(), role: "bot", text: t }]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await api<{ swaps: Hist[] }>("/api/swap/history")).swaps);
    } catch { /* signed out */ }
  }, []);
  useEffect(() => {
    if (me) void loadHistory();
  }, [me, loadHistory]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setMsgs((m) => [...m, { id: next(), role: "user", text: t }]);
    const p = parseSwapCommand(t);
    if (p.kind === "none") return say("Try: 100 USDC to EURC, or 50 EURC to USDC.");
    if (p.kind === "clarify") return say(p.question);
    if (p.kind === "unsupported") return say(p.message);
    if (!me) return say("Connect your wallet first, then ask again.");
    setBusy(true);
    try {
      const { quote } = await api<{ quote: Quote }>("/api/swap/quote", { amount: p.amount, fromToken: p.from, toToken: p.to });
      setMsgs((m) => [...m, { id: next(), role: "quote", quote, phase: "ready" }]);
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (m: Extract<Msg, { role: "quote" }>) => {
    patch(m.id, { phase: "cancelled" });
    await api("/api/swap/execute", { quoteId: m.quote.id, confirm: false }).catch(() => undefined);
  };

  const confirm = async (m: Extract<Msg, { role: "quote" }>) => {
    const q = m.quote;
    setBusy(true);
    let restore: (() => void) | null = null;
    try {
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
      if (!eth) throw new Error("No wallet found. Install a browser wallet such as MetaMask.");
      const ex = await api<{ swap: { chain: string; tokenIn: string; tokenOut: string; amountIn: string; slippageBps: number } }>("/api/swap/execute", { quoteId: q.id, confirm: true });
      patch(m.id, { phase: "signing", note: "Please approve this swap in your wallet." });
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_MAINNET.chainIdHex }] });
      } catch {
        throw new Error("Switch your wallet to Arc Mainnet, then ask for a new quote.");
      }
      const [{ SwapKit }, { createAdapterFromProvider }] = await Promise.all([import("@circle-fin/swap-kit"), import("@circle-fin/adapter-viem-v2")]);
      const adapter = await createAdapterFromProvider({ provider: eth as never });
      restore = routeCircleCalls(q.id);
      const result = await new SwapKit().swap({
        from: { adapter, chain: ex.swap.chain as never },
        tokenIn: ex.swap.tokenIn,
        tokenOut: ex.swap.tokenOut,
        amountIn: ex.swap.amountIn,
        config: { slippageBps: ex.swap.slippageBps, allowanceStrategy: "permit" },
      });
      restore();
      restore = null;
      const tx = (result as { txHash?: string }).txHash;
      if (!tx) throw new Error("The wallet returned no transaction hash.");
      await api("/api/swap/submit", { quoteId: q.id, txHash: tx });
      patch(m.id, { phase: "pending", tx, note: "Swap submitted." });
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await api<{ swap: Hist }>(`/api/swap/status/${tx}`).catch(() => null);
        if (s?.swap.status === "SUCCESS") return patch(m.id, { phase: "done", received: s.swap.actualOut ?? undefined });
        if (s?.swap.status === "FAILED") return patch(m.id, { phase: "failed", reason: "Slippage limit exceeded, or the network rejected it" });
      }
      patch(m.id, { note: "Still pending. Check the explorer, or ask again later." });
    } catch (e) {
      patch(m.id, { phase: "failed", reason: friendly(e) });
    } finally {
      restore?.();
      setBusy(false);
      void loadHistory();
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Swap</h1>
        <span className="inline-flex items-center rounded-full border border-success/25 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">USDC ↔ EURC on Arc Mainnet</span>
      </div>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        Type what you want, such as <span className="text-text">100 USDC to EURC</span> or <span className="text-text">50 EURC থেকে USDC করো</span>. You see the quote, fee and slippage first. Only your own wallet can sign. MicroAI never holds your keys and never swaps for you. Limits: 1 to 1,000 per swap, 5,000 per wallet a day.
      </p>

      <div className="mt-6"><ConnectWallet onChange={setMe} /></div>

      <ul className="mt-6 space-y-3" aria-live="polite">
        {msgs.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-accent/15 px-3.5 py-2.5 text-sm">{m.text}</li>
          ) : m.role === "bot" ? (
            <li key={m.id} className="max-w-[85%] rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm">{m.text}</li>
          ) : (
            <li key={m.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="font-semibold">{m.phase === "done" ? "Swap completed." : m.phase === "failed" ? "Swap failed." : m.phase === "cancelled" ? "Swap cancelled." : m.phase === "pending" ? "Swap submitted." : "Swap quote"}</div>
              <dl className="mt-2 space-y-1 text-muted">
                <div>From: <span className="text-text">{m.quote.amountIn} {m.quote.from}</span></div>
                <div>To: <span className="text-text">{m.quote.to}</span></div>
                {m.phase === "done" ? (
                  <div>You received: <span className="text-text">{m.received ?? "?"} {m.quote.to}</span></div>
                ) : (
                  <>
                    <div>Estimated receive: <span className="text-text">{m.quote.estimatedReceive} {m.quote.to}</span></div>
                    <div>Minimum receive: <span className="text-text">{m.quote.minimumReceive} {m.quote.to}</span></div>
                  </>
                )}
                <div>Swap fee: <span className="text-text">{m.quote.feePercent} ({m.quote.fee} {m.quote.feeToken}, minimum 0.01)</span></div>
                <div>Slippage limit: <span className="text-text">{m.quote.slippage}</span></div>
                <div>Network: <span className="text-text">{m.quote.network}</span></div>
              </dl>
              {m.reason && <p role="alert" className="mt-2 text-danger">Reason: {m.reason}</p>}
              {m.note && m.phase !== "failed" && <p className="mt-2">{m.note}</p>}
              {m.tx && (
                <p className="mt-2 break-all">
                  Transaction hash: <span className="font-mono text-xs">{m.tx}</span>{" "}
                  <a className="text-accent-text hover:underline" href={`${ARC_MAINNET.explorerUrl}/tx/${m.tx}`} target="_blank" rel="noopener noreferrer">View on explorer</a>
                </p>
              )}
              {m.phase === "ready" && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" className={BTN} disabled={busy} onClick={() => confirm(m)}>Confirm Swap</button>
                  <button type="button" className={BTN2} disabled={busy} onClick={() => cancel(m)}>Cancel</button>
                </div>
              )}
            </li>
          )
        )}
      </ul>

      <form className="mt-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input aria-label="Swap command" className={`${FIELD} min-w-0 flex-1`} placeholder="100 USDC to EURC" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className={BTN} disabled={busy || !text.trim()}>{busy ? "Working…" : "Send"}</button>
      </form>

      {me && (
        <section className="mt-8">
          <h2 className="text-base font-semibold">Swap history</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No swaps yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm">
                  <span className="text-muted">{new Date(h.createdAt).toLocaleString()}</span> · {h.from} → {h.to} · {h.amountIn} · <span className="font-medium">{h.status}</span>
                  {h.txHash && (
                    <> · <a className="font-mono text-xs text-accent-text hover:underline" href={`${ARC_MAINNET.explorerUrl}/tx/${h.txHash}`} target="_blank" rel="noopener noreferrer">{h.txHash.slice(0, 10)}…</a></>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {!embedded && <p className="sr-only">Swap</p>}
    </main>
  );
}
