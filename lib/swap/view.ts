import { SWAP_FEE_BPS, SWAP_SLIPPAGE_BPS } from "./config";
import { fromUnits } from "./math";
import type { SwapRecord } from "./store";

const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

/** The quote card: everything the user sees before confirming. */
export function quoteView(r: SwapRecord) {
  return {
    id: r.id,
    from: r.from,
    to: r.to,
    amountIn: fromUnits(BigInt(r.amountIn)),
    estimatedReceive: fromUnits(BigInt(r.expectedOut)),
    minimumReceive: fromUnits(BigInt(r.minOut)),
    fee: fromUnits(BigInt(r.feeUnits)),
    feeToken: r.feeToken === "input" ? r.from : r.to,
    feePercent: pct(SWAP_FEE_BPS),
    slippage: pct(r.slippageBps ?? SWAP_SLIPPAGE_BPS),
    network: "Arc",
    expiresAt: r.expiresAt,
  };
}

export function historyView(r: SwapRecord) {
  return {
    id: r.id,
    from: r.from,
    to: r.to,
    amountIn: fromUnits(BigInt(r.amountIn)),
    expectedOut: fromUnits(BigInt(r.expectedOut)),
    actualOut: r.actualOut ? fromUnits(BigInt(r.actualOut)) : null,
    fee: fromUnits(BigInt(r.feeUnits)),
    slippage: pct(r.slippageBps),
    status: r.status,
    txHash: r.txHash ?? null,
    network: r.network,
    error: r.error ?? null,
    createdAt: r.createdAt,
  };
}
