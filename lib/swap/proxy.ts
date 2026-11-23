import { apiErrors } from "@/lib/api";
import { SWAP_CHAIN, SWAP_TOKENS } from "./config";
import { SwapRecord, loadSwap } from "./store";
import type { CirclePath } from "./circle";

// Rules for the server-side proxy between the browser's wallet SDK and Circle's
// swap service. The browser never sees the API key; the proxy checks that every
// request matches the quote the user confirmed, and it alone sets the fee and
// the fee recipient. A browser that sends a different amount, token, wallet,
// fee or recipient gets an error, not a swap.

const ALLOWED = new Set<string>([SWAP_TOKENS.USDC.address, SWAP_TOKENS.EURC.address]);
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const UNITS = /^\d{1,24}$/;

/** The confirmed quote this request belongs to, for the signed-in wallet, still inside its window. */
export async function confirmedQuote(req: Request, wallet: string): Promise<SwapRecord> {
  const id = req.headers.get("x-swap-quote") ?? "";
  const r = await loadSwap(id);
  if (!r || r.wallet !== wallet) throw apiErrors.notFound("Quote not found.");
  if (!r.confirmedAt || r.status !== "QUOTED" || r.txHash) throw apiErrors.forbidden("This swap was not confirmed.");
  if (Date.parse(r.expiresAt) < Date.now()) throw apiErrors.badRequest("This swap window expired. Ask for a new quote.");
  return r;
}

type Q = Record<string, string>;
const bad = (m: string) => apiErrors.badRequest(m);

/** Amount the SDK may send: the confirmed amount, or that amount less up to twice the fee (if it nets the fee out first). */
function amountOk(a: unknown, r: SwapRecord): a is string {
  if (typeof a !== "string" || !UNITS.test(a)) return false;
  const n = BigInt(a);
  const top = BigInt(r.amountIn);
  return n <= top && n >= top - BigInt(r.feeUnits) * BigInt(2);
}

function checkCommon(p: Q | Record<string, unknown>, r: SwapRecord) {
  const tin = SWAP_TOKENS[r.from].address;
  const tout = SWAP_TOKENS[r.to].address;
  const low = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "");
  if (low(p.tokenInAddress) !== tin || low(p.tokenOutAddress) !== tout) throw bad("The tokens do not match the confirmed swap.");
  if (p.tokenInChain !== SWAP_CHAIN || (p.tokenOutChain ?? SWAP_CHAIN) !== SWAP_CHAIN) throw bad("Only Arc swaps are supported.");
  if (low(p.fromAddress) !== r.wallet || (p.toAddress !== undefined && low(p.toAddress) !== r.wallet)) throw bad("The wallet does not match the confirmed swap.");
  if (!amountOk(p.amount, r)) throw bad("The amount does not match the confirmed swap.");
}

export function buildQuoteQuery(search: URLSearchParams, r: SwapRecord): Q {
  const p = Object.fromEntries(search.entries());
  checkCommon(p, r);
  const out: Q = {
    tokenInAddress: SWAP_TOKENS[r.from].address,
    tokenInChain: SWAP_CHAIN,
    tokenOutAddress: SWAP_TOKENS[r.to].address,
    tokenOutChain: SWAP_CHAIN,
    fromAddress: r.wallet,
    toAddress: r.wallet,
    amount: p.amount,
    slippageBps: String(r.slippageBps),
  };
  return out;
}

export function buildSwapBody(body: unknown, r: SwapRecord, treasury: string): Record<string, unknown> {
  // The quote was shown with one fee recipient. If the configuration changed since, it is no longer valid.
  if (r.feeRecipient !== treasury.toLowerCase()) throw bad("The fee settings changed. Ask for a new quote.");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("Invalid request body.");
  const p = body as Record<string, unknown>;
  checkCommon(p, r);
  const stop = p.stopLimit;
  // The user's floor must be close to the confirmed minimum, so a tampered request cannot accept any price.
  if (stop !== undefined && (typeof stop !== "string" || !UNITS.test(stop) || BigInt(stop) < (BigInt(r.minOut) * BigInt(98)) / BigInt(100))) throw bad("The price limit does not match the confirmed swap.");
  if (p.slippageBps !== undefined && !(typeof p.slippageBps === "number" && p.slippageBps >= 0 && p.slippageBps <= r.slippageBps)) throw bad("The slippage limit does not match the confirmed swap.");
  if (!ADDR.test(treasury)) throw bad("Swap is not configured.");
  const provider = typeof p.provider === "string" && /^[\w-]{1,40}$/.test(p.provider) ? p.provider : undefined;
  return {
    tokenInAddress: SWAP_TOKENS[r.from].address,
    tokenInChain: SWAP_CHAIN,
    tokenOutAddress: SWAP_TOKENS[r.to].address,
    tokenOutChain: SWAP_CHAIN,
    fromAddress: r.wallet,
    toAddress: r.wallet,
    amount: p.amount,
    ...(stop !== undefined ? { stopLimit: stop } : {}),
    ...(p.slippageBps !== undefined ? { slippageBps: p.slippageBps } : {}),
    ...(provider ? { provider } : {}),
    // Fee and recipient are set here and only here. Anything the browser sent is dropped.
    config: { customFee: { ...r.feeMode, recipientAddress: treasury } },
  };
}

export function buildStatusQuery(search: URLSearchParams): Q {
  const txHash = search.get("txHash") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw bad("Invalid transaction hash.");
  const out: Q = { txHash };
  for (const k of ["chainIn", "chainOut"]) {
    const v = search.get(k);
    if (v !== null) {
      if (v !== SWAP_CHAIN) throw bad("Only Arc swaps are supported.");
      out[k] = v;
    }
  }
  return out;
}

export function buildRatesQuery(search: URLSearchParams): Q {
  if (search.get("chain") !== SWAP_CHAIN) throw bad("Only Arc is supported.");
  const addrs = search.getAll("addresses").flatMap((a) => a.split(","));
  if (addrs.length === 0 || addrs.some((a) => !ADDRESS_OK(a))) throw bad("Only USDC and EURC rates can be read.");
  return { chain: SWAP_CHAIN, addresses: addrs.join(",") };
}
const ADDRESS_OK = (a: string) => ALLOWED.has(a.toLowerCase());

export const pathOf = (segments: string[]): CirclePath | "logs" | null => {
  const p = segments.join("/");
  return p === "quote" || p === "swap" || p === "swap/status" || p === "rates" || p === "logs" ? p : null;
};
