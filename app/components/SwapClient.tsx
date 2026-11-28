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
  providerFee: string;
  gasUsd: string | null;
  route: string;
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
  | { id: number; role: "quote"; quote: Quote; phase: "ready" | "awaiting_wallet" | "pending" | "confirmed" | "failed" | "unknown" | "cancelled"; note?: string; tx?: string; received?: string; reason?: string; timing?: string };

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

const clock = () => performance.now();
type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> };

const friendly = (e: unknown) => {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001 || /reject|denied|cancel/i.test(err?.message ?? "")) return "You rejected the request in your wallet. Nothing was sent.";
  if (/slippage|min.?out|price/i.test(err?.message ?? "")) return "Slippage limit exceeded";
  if (/insufficient|balance/i.test(err?.message ?? "")) return "Insufficient balance";
  if (/\b50[0-4]\b|server error|createSwap/i.test(err?.message ?? "")) return "The swap service had a problem on its side. Nothing was sent from your wallet. Try again in a moment.";
  return (err?.message || "Network error").slice(0, 160);
};

export function SwapClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const lock = useRef(false);
  const live = useRef<{ quoteId: number; serverId: string } | null>(null);
  const idRef = useRef(1);
  const next = () => idRef.current++;
  const patch = (id: number, p: Partial<Extract<Msg, { role: "quote" }>>) => setMsgs((m) => m.map((x) => (x.id === id && x.role === "quote" ? { ...x, ...p } : x)));
  const say = (t: string) => setMsgs((m) => [...m, { id: next(), role: "bot", text: t }]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await api<{ enabled: boolean; swaps: Hist[] }>("/api/swap/history");
      setEnabled(h.enabled);
      setHistory(h.swaps);
    } catch { /* signed out */ }
  }, []);
  useEffect(() => {
    if (me) void loadHistory();
  }, [me, loadHistory]);

  // A reload must not lose a swap that was still pending: keep checking those on chain.
  useEffect(() => {
    const pending = history.filter((h) => h.status === "PENDING" && h.txHash);
    if (pending.length === 0) return;
    const t = setInterval(async () => {
      await Promise.all(pending.map((h) => api(`/api/swap/status/${h.txHash}`).catch(() => null)));
      void loadHistory();
    }, 6000);
    return () => clearInterval(t);
  }, [history, loadHistory]);

  // If the account or network changes while a confirmation is open, that confirmation is cancelled.
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { on?(e: string, h: () => void): void; removeListener?(e: string, h: () => void): void } }).ethereum;
    const onChange = () => {
      const l = live.current;
      if (!l) return;
      live.current = null;
      setMsgs((m) => m.map((x) => (x.id === l.quoteId && x.role === "quote" && (x.phase === "ready" || x.phase === "awaiting_wallet") ? { ...x, phase: "failed", reason: "Your wallet account or network changed, so this confirmation was cancelled. Ask for a new quote." } : x)));
      void api("/api/swap/execute", { quoteId: l.serverId, confirm: false }).catch(() => undefined);
    };
    eth?.on?.("accountsChanged", onChange);
    eth?.on?.("chainChanged", onChange);
    return () => {
      eth?.removeListener?.("accountsChanged", onChange);
      eth?.removeListener?.("chainChanged", onChange);
    };
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t || lock.current) return;
    setText("");
    setMsgs((m) => [...m, { id: next(), role: "user", text: t }]);
    const p = parseSwapCommand(t);
    if (p.kind === "none") return say("Type an amount and both tokens, for example: 100 USDC to EURC, or 50 EURC to USDC.");
    if (p.kind === "clarify") return say(p.question);
    if (p.kind === "unsupported") return say(p.message);
    if (!me) return say("Connect your wallet first, then ask again.");
    if (!enabled) return say("Swap is currently disabled.");
    lock.current = true;
    setBusy(true);
    const loadingId = next();
    setMsgs((m) => [...m, { id: loadingId, role: "bot", text: "Getting your quote…" }]);
    const t0 = clock();
    try {
      const { quote } = await api<{ quote: Quote }>("/api/swap/quote", { amount: p.amount, fromToken: p.from, toToken: p.to });
      const ms = Math.round(clock() - t0);
      setMsgs((m) => [...m.filter((x) => x.id !== loadingId), { id: next(), role: "quote", quote, phase: "ready", timing: `Quote ready in ${(ms / 1000).toFixed(1)}s` }]);
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== loadingId));
      say((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const cancel = async (m: Extract<Msg, { role: "quote" }>) => {
    live.current = null;
    patch(m.id, { phase: "cancelled" });
    await api("/api/swap/execute", { quoteId: m.quote.id, confirm: false }).catch(() => undefined);
  };

  const confirm = async (m: Extract<Msg, { role: "quote" }>) => {
    if (lock.current) return;
    lock.current = true;
    const q = m.quote;
    setBusy(true);
    live.current = { quoteId: m.id, serverId: q.id };
    const tStart = clock();
    let restore: (() => void) | null = null;
    try {
      const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
      if (!eth) throw new Error("No wallet found. Install a browser wallet such as MetaMask.");
      const ex = await api<{ swap: { chain: string; tokenIn: string; tokenOut: string; amountIn: string; slippageBps: number } }>("/api/swap/execute", { quoteId: q.id, confirm: true });
      patch(m.id, { phase: "awaiting_wallet", note: "Please approve this swap in your wallet." });
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
        config: { slippageBps: ex.swap.slippageBps, allowanceStrategy: "approve" },
      });
      restore();
      restore = null;
      const tx = (result as { txHash?: string }).txHash;
      if (!tx) throw new Error("The wallet returned no transaction hash.");
      const tSigned = clock();
      live.current = null;
      await api("/api/swap/submit", { quoteId: q.id, txHash: tx });
      patch(m.id, { phase: "pending", tx, note: "Swap submitted. Waiting for confirmation on Arc." });
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await api<{ swap: Hist }>(`/api/swap/status/${tx}`).catch(() => null);
        const secs = (ms: number) => (ms / 1000).toFixed(1);
        if (s?.swap.status === "SUCCESS") return patch(m.id, { phase: "confirmed", received: s.swap.actualOut ?? undefined, timing: `${m.timing ?? ""} · Signed in ${secs(tSigned - tStart)}s · Confirmed ${secs(clock() - tSigned)}s after sending` });
        if (s?.swap.status === "FAILED") return patch(m.id, { phase: "failed", reason: "The transaction failed on chain (for example the slippage limit was exceeded). No swap happened; only network gas was used." });
        if (s?.swap.status === "UNKNOWN") return patch(m.id, { phase: "unknown", reason: s.swap.error ?? "The result could not be verified. Check the explorer." });
      }
      patch(m.id, { note: "Still pending. It will keep updating in your history, even after a reload." });
    } catch (e) {
      patch(m.id, { phase: "failed", reason: friendly(e) });
      // If the server kept the real reason for this swap, show it under the message.
      void api<{ swaps: Hist[] }>("/api/swap/history")
        .then((h) => {
          const why = h.swaps.find((x) => x.id === q.id)?.error;
          if (why) patch(m.id, { phase: "failed", reason: `${friendly(e)} Details: ${why}` });
        })
        .catch(() => undefined);
    } finally {
      restore?.();
      live.current = null;
      lock.current = false;
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
        Type what you want, such as <span className="text-text">100 USDC to EURC</span> or <span className="text-text">50 EURC to USDC</span>. You see the quote, fee and slippage first. Only your own wallet can sign. MicroAI never holds your keys and never swaps for you. Swap from 0.01 up to 1,000 at a time, 5,000 per wallet a day.
      </p>

      {!enabled && <p role="status" className="mt-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">Swap is currently disabled. Nothing can be swapped until it is switched on.</p>}
      <div className="mt-6"><ConnectWallet onChange={setMe} /></div>

      <ul className="mt-6 space-y-3" aria-live="polite">
        {msgs.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-accent/15 px-3.5 py-2.5 text-sm">{m.text}</li>
          ) : m.role === "bot" ? (
            <li key={m.id} className="max-w-[85%] rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm">{m.text}</li>
          ) : (
            <li key={m.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="font-semibold">{m.phase === "confirmed" ? "Swap completed." : m.phase === "failed" ? "Swap failed." : m.phase === "unknown" ? "Result unknown." : m.phase === "cancelled" ? "Swap cancelled." : m.phase === "pending" ? "Swap submitted. Pending." : m.phase === "awaiting_wallet" ? "Waiting for your wallet" : "Swap quote"}</div>
              <dl className="mt-2 space-y-1 text-muted">
                <div>From: <span className="text-text">{m.quote.amountIn} {m.quote.from}</span></div>
                <div>To: <span className="text-text">{m.quote.to}</span></div>
                {m.phase === "confirmed" ? (
                  <div>You received: <span className="text-text">{m.received ?? "?"} {m.quote.to}</span></div>
                ) : (
                  <>
                    <div>Estimated receive: <span className="text-text">{m.quote.estimatedReceive} {m.quote.to}</span></div>
                    <div>Minimum receive: <span className="text-text">{m.quote.minimumReceive} {m.quote.to}</span></div>
                  </>
                )}
                <div>MicroAI fee: <span className="text-text">{m.quote.feePercent} ({m.quote.fee} {m.quote.feeToken})</span></div>
                <div>Provider fee: <span className="text-text">≈ {m.quote.providerFee} {m.quote.feeToken} (0.02%, charged by the swap provider)</span></div>
                <div>Network gas: <span className="text-text">{m.quote.gasUsd ? `≈ $${m.quote.gasUsd}, paid in USDC from your wallet` : "paid in USDC from your wallet, shown by your wallet"}</span></div>
                {m.quote.route && <div>Route: <span className="text-text">{m.quote.route}</span></div>}
                <div>Slippage limit: <span className="text-text">{m.quote.slippage}</span></div>
                <div>Network: <span className="text-text">{m.quote.network}</span></div>
              </dl>
              {m.reason && <p role="alert" className="mt-2 text-danger">Reason: {m.reason}</p>}
              {m.timing && <p className="mt-2 text-xs text-muted">{m.timing}</p>}
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
        <button type="submit" className={BTN} disabled={busy || !enabled || !text.trim()}>{busy ? "Working…" : "Send"}</button>
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
