import { SWAP_CHAIN } from "./config";
import { swapServerConfig } from "./server-config";

// Server-only client for Circle's Stablecoin Service (the service behind the
// Arc App Kit swap). Holds KIT_KEY: the key is added here, as an Authorization
// header, and goes nowhere else. It is never returned, logged or put in an error.

const BASE = "https://api.circle.com/v1/stablecoinKits";
const MAX_BYTES = 200_000;

export class CircleError extends Error {
  constructor(message: string, readonly status: number, readonly retryable = false) {
    super(message);
  }
}

export type CirclePath = "quote" | "swap" | "swap/status" | "rates";
export const CIRCLE_PATHS: readonly CirclePath[] = ["quote", "swap", "swap/status", "rates"];

/** Calls Circle with the server's key. Returns the status and raw JSON text, size-capped. */
export async function circleCall(
  path: CirclePath,
  init: { query?: Record<string, string>; body?: unknown },
  fetchImpl: typeof fetch = fetch
): Promise<{ status: number; text: string }> {
  // Reads are tried at most twice. A swap request is never repeated.
  const reads = init.body === undefined;
  let last: { status: number; text: string } | CircleError | null = null;
  for (let attempt = 0; attempt < (reads ? 2 : 1); attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300));
    try {
      const r = await circleOnce(path, init, fetchImpl);
      if (!(reads && (r.status >= 500 || r.status === 429))) return r;
      last = r;
    } catch (err) {
      if (!(err instanceof CircleError && err.retryable && reads)) throw err;
      last = err;
    }
  }
  if (last instanceof CircleError) throw last;
  return last as { status: number; text: string };
}

async function circleOnce(
  path: CirclePath,
  init: { query?: Record<string, string>; body?: unknown },
  fetchImpl: typeof fetch
): Promise<{ status: number; text: string }> {
  const cfg = swapServerConfig();
  if (!cfg) throw new CircleError("Swap is not configured.", 503);
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: init.body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${cfg.kitKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.body === undefined ? 8_000 : 12_000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new CircleError("The swap service did not answer. Try again shortly.", 502, true);
  }
  const text = (await res.text()).slice(0, MAX_BYTES);
  return { status: res.status, text };
}

export interface CircleQuote {
  estimatedAmount: bigint;
  minAmount: bigint;
  feeToken: "input" | "output";
  /** From the route: which provider and DEX, and the gas estimate in USD, as text. */
  route: string;
  gasUsd: string | null;
}

/** The fields of Circle's quote answer that MicroAI uses. Anything else is ignored. */
export function readQuote(text: string): CircleQuote | null {
  try {
    const j = JSON.parse(text) as { quote?: { estimatedAmount?: unknown; minAmount?: unknown; route?: { provider?: unknown; steps?: { toolName?: unknown; estimate?: { gasCostUSD?: unknown } }[] } }; feeContext?: { type?: unknown } };
    const e = j.quote?.estimatedAmount;
    const m = j.quote?.minAmount;
    if (typeof e !== "string" || typeof m !== "string" || !/^\d+$/.test(e) || !/^\d+$/.test(m)) return null;
    const t = j.feeContext?.type;
    if (t !== "input" && t !== "output") return null;
    const steps = j.quote?.route?.steps ?? [];
    const gas = steps.reduce((sum, st) => sum + (typeof st.estimate?.gasCostUSD === "string" ? Number(st.estimate.gasCostUSD) || 0 : 0), 0);
    const route = [j.quote?.route?.provider, ...steps.map((st) => st.toolName)].filter((x): x is string => typeof x === "string").join(" / ").slice(0, 60);
    return { estimatedAmount: BigInt(e), minAmount: BigInt(m), feeToken: t, route, gasUsd: gas > 0 ? gas.toFixed(4) : null };
  } catch {
    return null;
  }
}

export const quoteQuery = (p: { tokenIn: string; tokenOut: string; wallet: string; amount: string; slippageBps: number }) => ({
  tokenInAddress: p.tokenIn,
  tokenInChain: SWAP_CHAIN,
  tokenOutAddress: p.tokenOut,
  tokenOutChain: SWAP_CHAIN,
  fromAddress: p.wallet,
  toAddress: p.wallet,
  amount: p.amount,
  slippageBps: String(p.slippageBps),
});
