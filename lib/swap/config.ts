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
export const SWAP_SLIPPAGE_BPS = 50; // 0.50%
/** Smallest swap: one cent. Below this the 0.10% fee rounds to almost nothing and gas costs more than the swap. */
export const SWAP_FLOOR_UNITS = BigInt(10_000);
export const SWAP_MAX_UNITS = BigInt(1_000_000_000); // 1,000 per transaction
export const SWAP_DAILY_MAX_UNITS = BigInt(5_000_000_000); // 5,000 per wallet per day
/** A quote can be confirmed for this long, then it expires. */
export const QUOTE_TTL_SEC = 120;
/** After confirming, the wallet has this long to finish signing. */
export const EXECUTE_WINDOW_SEC = 600;

/** USDC and EURC are treated as roughly one dollar each when applying the limits. */
export const LIMITS_NOTE = "Limits count 1 USDC or 1 EURC as about $1.";

/** Circle's swap adapter on Arc Mainnet (the contract that runs a swap in one transaction). */
export const SWAP_ADAPTER = "0x7fb8c7260b63934d8da38af902f87ae6e284a845";
/**
 * Contracts a swap payload may call, seen in a real Arc Mainnet payload on 2026-11-23:
 * the provider-fee collector and the Fly router (via LI.FI). Anything else is refused.
 * Add more with SWAP_EXTRA_TARGETS only after checking them.
 */
export const SWAP_KNOWN_TARGETS = ["0xf992efcb5fa2ed7cb48310d9dd8cb4ce5fb7ddc9", "0xa4072583658fae592a3506a42431cb6316a8d40b"] as const;
/** Provider fee: 2 basis points of the amount after the custom fee (Arc docs). */
export const PROVIDER_FEE_BPS = 2;
/** Native gas (USDC, 18 decimals) a wallet must hold to sign a swap: 0.02 USDC. */
export const MIN_GAS_WEI = BigInt("20000000000000000");
