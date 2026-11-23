import { apiErrors, parseJson, withApi } from "@/lib/api";
import { submitBody } from "@/lib/swap/schemas";
import { claimTx, loadSwap, saveSwap } from "@/lib/swap/store";
import { historyView } from "@/lib/swap/view";

// The browser reports the transaction hash its wallet produced for a confirmed
// swap. MicroAI only records it; the status route reads the chain for the result.
export const POST = withApi(
  { name: "swap-submit", auth: "required", onLimiterError: "closed", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session }) => {
    const { quoteId, txHash } = await parseJson(req, submitBody);
    const r = await loadSwap(quoteId);
    if (!r || r.wallet !== session!.sub) throw apiErrors.notFound("Swap not found.");
    if (!r.confirmedAt || r.status !== "QUOTED") throw apiErrors.badRequest("This swap was not confirmed, or already has a transaction.");
    if (!(await claimTx(txHash, r.id))) throw apiErrors.badRequest("This transaction is already recorded for a swap.");
    r.txHash = txHash.toLowerCase();
    r.status = "PENDING";
    await saveSwap(r);
    return { swap: historyView(r) };
  }
);
