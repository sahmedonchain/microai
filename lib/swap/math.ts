import { SWAP_DAILY_MAX_UNITS, SWAP_FEE_BPS, SWAP_MAX_UNITS, SWAP_MIN_FEE_UNITS, SWAP_SLIPPAGE_BPS } from "./config";

/** "100.5" -> 100500000n. Returns null when it is not a plain amount with at most 6 decimals. */
export function toUnits(amount: string): bigint | null {
  const m = /^(\d{1,15})(?:\.(\d{1,6}))?$/.exec(amount.trim());
  return m ? BigInt(m[1]) * BigInt(1_000_000) + BigInt((m[2] ?? "").padEnd(6, "0") || "0") : null;
}

/** 99800000n -> "99.8". */
export function fromUnits(units: bigint): string {
  const s = units.toString().padStart(7, "0");
  const whole = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export interface FeePlan {
  /** Fee in 6-decimal units of the fee token. */
  units: bigint;
  /** How it is sent to Circle: a percentage, or a fixed amount when the minimum applies. */
  mode: { percentageBps: number } | { amount: string };
}

/** 0.10% of the amount, never less than $0.01. Computed here, on the server, never by the browser. */
export function planFee(amountUnits: bigint): FeePlan {
  const pct = (amountUnits * BigInt(SWAP_FEE_BPS)) / BigInt(10_000);
  return pct >= SWAP_MIN_FEE_UNITS ? { units: pct, mode: { percentageBps: SWAP_FEE_BPS } } : { units: SWAP_MIN_FEE_UNITS, mode: { amount: SWAP_MIN_FEE_UNITS.toString() } };
}

/** The smallest output the user will accept: the estimate minus the slippage limit. */
export const minOutFor = (estimated: bigint, bps = SWAP_SLIPPAGE_BPS) => (estimated * BigInt(10_000 - bps)) / BigInt(10_000);

export type LimitProblem = "not_above_fee" | "above_max" | "daily_exceeded";
export function checkAmount(units: bigint, usedToday: bigint = BigInt(0)): LimitProblem | null {
  // No minimum swap size. The only floor is practical: the fee is never less than $0.01, so the amount must be more than that.
  if (units <= SWAP_MIN_FEE_UNITS) return "not_above_fee";
  if (units > SWAP_MAX_UNITS) return "above_max";
  if (usedToday + units > SWAP_DAILY_MAX_UNITS) return "daily_exceeded";
  return null;
}
export const LIMIT_MESSAGES: Record<LimitProblem, string> = {
  not_above_fee: "The swap fee is at least 0.01, so the amount must be more than 0.01.",
  above_max: "The maximum swap is 1,000 per transaction.",
  daily_exceeded: "This would go over the daily limit of 5,000 per wallet. Try a smaller amount, or come back tomorrow.",
};
