import { ARC_ADDRESSES } from "@/lib/arcAddresses";
import { USDC_ADDRESS } from "@/lib/arcConfig";

// Chat-Based Instant Swap (USDC <-> EURC on Arc Mainnet).
//
// Non-custodial: the user's own wallet signs everything. MicroAI never holds a
// key, never signs and never sends. Secrets (KIT_KEY) and the fee recipient
// (TREASURY_ADDRESS) are read from server environment variables only. This file
// is safe to import from client code: it never touches process.env.

export const SWAP_TOKENS = {
  USDC: { symbol: "USDC", address: USDC_ADDRESS.toLowerCase(), decimals: 6 },
  EURC: { symbol: "EURC", address: ARC_ADDRESSES.eurc.mainnet.toLowerCase(), decimals: 6 },
} as const;
export type SwapToken = keyof typeof SWAP_TOKENS;
export const isSwapToken = (t: string): t is SwapToken => t === "USDC" || t === "EURC";

/** Circle's name for Arc Mainnet. */
export const SWAP_CHAIN = "Arc";

export const SWAP_FEE_BPS = 10; // 0.10%
export const SWAP_MIN_FEE_UNITS = BigInt(10_000); // $0.01 in 6-decimal units
export const SWAP_SLIPPAGE_BPS = 50; // 0.50%
export const SWAP_MAX_UNITS = BigInt(1_000_000_000); // 1,000 per transaction
export const SWAP_DAILY_MAX_UNITS = BigInt(5_000_000_000); // 5,000 per wallet per day
/** A quote can be confirmed for this long, then it expires. */
export const QUOTE_TTL_SEC = 120;
/** After confirming, the wallet has this long to finish signing. */
export const EXECUTE_WINDOW_SEC = 600;

/** USDC and EURC are treated as roughly one dollar each when applying the limits. */
export const LIMITS_NOTE = "Limits count 1 USDC or 1 EURC as about $1.";
