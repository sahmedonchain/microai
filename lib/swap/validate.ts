import { PROVIDER_FEE_BPS, SWAP_CHAIN, SWAP_KNOWN_TARGETS, SWAP_TOKENS } from "./config";
import type { SwapRecord } from "./store";

// Checks Circle's answer to a swap request BEFORE it is handed to the browser.
// The browser's wallet SDK will ask the user to sign whatever this describes, so
// a payload that does not match the confirmed quote is refused (fail closed).

const ZERO = "0x0000000000000000000000000000000000000000";
const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "");
const isUnits = (v: unknown): v is string => typeof v === "string" && /^\d{1,30}$/.test(v);

export function validateSwapResponse(text: string, r: SwapRecord, treasury: string, extraTargets: readonly string[] = []): string | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return "The swap service answer could not be read.";
  }
  const tin = SWAP_TOKENS[r.from].address;
  const tout = SWAP_TOKENS[r.to].address;
  if (lower(j.tokenInAddress) !== tin || lower(j.tokenOutAddress) !== tout) return "The route uses different tokens than the confirmed swap.";
  if (j.tokenInChain !== SWAP_CHAIN || j.tokenOutChain !== SWAP_CHAIN) return "The route is not on Arc.";
  if (lower(j.fromAddress) !== r.wallet || lower(j.toAddress) !== r.wallet) return "The route pays a different wallet.";
  if (!isUnits(j.amount) || BigInt(j.amount) > BigInt(r.amountIn)) return "The route amount is larger than the confirmed amount.";

  const tx = j.transaction as { executionParams?: { tokens?: { beneficiary?: unknown }[]; instructions?: Record<string, unknown>[] }; signature?: unknown } | undefined;
  const ins = tx?.executionParams?.instructions;
  if (!tx || typeof tx.signature !== "string" || !Array.isArray(ins) || ins.length === 0 || ins.length > 6) return "The swap payload is missing or unusual.";
  for (const t of tx.executionParams?.tokens ?? []) if (lower(t.beneficiary) !== r.wallet) return "Swap output would go to a different wallet.";

  const allowed = new Set<string>([...SWAP_KNOWN_TARGETS, ...extraTargets]);
  const total = BigInt(r.amountIn);
  let approved = BigInt(0);
  let sawSwap = false;
  for (const i of ins) {
    if (!allowed.has(lower(i.target))) return "The route calls a contract MicroAI does not recognise.";
    if (!isUnits(i.amountToApprove) || !isUnits(i.minTokenOut)) return "The swap payload has an unreadable amount.";
    if (lower(i.tokenIn) !== tin) return "The route spends a different token.";
    const out = lower(i.tokenOut);
    if (out !== tout && out !== ZERO) return "The route pays out a different token.";
    if (BigInt(i.amountToApprove) > total) return "The route approves more than the confirmed amount.";
    approved += BigInt(i.amountToApprove);
    if (out === tout) {
      sawSwap = true;
      // The enforced floor must be close to what the user was shown.
      if (BigInt(i.minTokenOut) < (BigInt(r.minOut) * BigInt(98)) / BigInt(100)) return "The minimum output is lower than the confirmed limit.";
    }
  }
  if (!sawSwap) return "The payload contains no swap.";
  if (approved > total) return "The route would spend more than the confirmed amount.";

  // The platform fee must go to the treasury MicroAI configured, and nowhere else.
  const dev = (j.fees as { developer?: { beneficiary?: unknown }[] } | undefined)?.developer ?? [];
  for (const d of dev) if (lower(d.beneficiary) !== treasury.toLowerCase()) return "A fee in the route goes to an unexpected address.";
  const cfg = (j.config as { customFee?: { recipientAddress?: unknown } } | undefined)?.customFee;
  if (cfg && lower(cfg.recipientAddress) !== treasury.toLowerCase()) return "The fee recipient in the route is not the configured treasury.";
  return null;
}

/** Provider fee: 2 basis points of what is swapped after the platform fee. */
export const providerFee = (amount: bigint, platformFee: bigint) => ((amount - platformFee) * BigInt(PROVIDER_FEE_BPS)) / BigInt(10_000);
