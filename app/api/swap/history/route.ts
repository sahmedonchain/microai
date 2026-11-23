import { withApi } from "@/lib/api";
import { listSwaps } from "@/lib/swap/store";
import { historyView } from "@/lib/swap/view";

export const GET = withApi({ name: "swap-history", auth: "required", onLimiterError: "closed", limits: [{ limit: 30, windowSec: 60 }] }, async ({ session }) => {
  const all = await listSwaps(session!.sub);
  // Quotes that were never confirmed are noise in a history.
  return { swaps: all.filter((r) => r.status !== "QUOTED" || r.confirmedAt).map(historyView) };
});
