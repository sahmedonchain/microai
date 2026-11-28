import { withApi } from "@/lib/api";
import { fromUnits } from "@/lib/swap/math";
import { recentCompleted } from "@/lib/swap/store";

// Public, read-only: completed swaps for the stats page. No wallet addresses.
export const GET = withApi({ name: "swap-activity", limits: [{ limit: 30, windowSec: 60 }], onLimiterError: "closed" }, async () => {
  const { total, swaps } = await recentCompleted(10);
  return {
    total,
    swaps: swaps.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      amountIn: fromUnits(BigInt(r.amountIn)),
      received: r.actualOut ? fromUnits(BigInt(r.actualOut)) : null,
      txHash: r.txHash ?? null,
      at: r.confirmedAt ?? r.createdAt,
    })),
  };
});
