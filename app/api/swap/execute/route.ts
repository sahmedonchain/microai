import { apiErrors, parseJson, withApi } from "@/lib/api";
import { EXECUTE_WINDOW_SEC, SWAP_CHAIN, SWAP_SLIPPAGE_BPS } from "@/lib/swap/config";
import { swapServerConfig } from "@/lib/swap/server-config";
import { executeBody } from "@/lib/swap/schemas";
import { loadSwap, releaseDaily, reserveDaily, saveSwap } from "@/lib/swap/store";
import { fromUnits } from "@/lib/swap/math";

// The user's yes (or no) to a quote. Saying yes does not move any money: it only
// opens a short window in which the user's own wallet can run exactly the swap
// that was quoted. The wallet still asks the user to sign, and MicroAI never signs.
export const POST = withApi(
  { name: "swap-execute", auth: "required", onLimiterError: "closed", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session }) => {
    const { quoteId, confirm } = await parseJson(req, executeBody);
    const r = await loadSwap(quoteId);
    if (!r || r.wallet !== session!.sub) throw apiErrors.notFound("Quote not found.");

    if (!confirm) {
      if (r.status === "QUOTED" && !r.confirmedAt) {
        r.status = "CANCELLED";
        await saveSwap(r);
      }
      return { status: r.status };
    }
    if (!swapServerConfig()) throw apiErrors.upstream("Swap is not available yet.");
    if (r.status !== "QUOTED" || r.confirmedAt) throw apiErrors.badRequest("This quote was already used. Ask for a new one.");
    if (Date.parse(r.expiresAt) < Date.now()) throw apiErrors.badRequest("This quote expired. Ask for a new one.");

    const units = BigInt(r.amountIn);
    if (!(await reserveDaily(r.wallet, units))) throw apiErrors.badRequest("This would go over the daily limit of 5,000 per wallet.");
    try {
      r.confirmedAt = new Date().toISOString();
      r.expiresAt = new Date(Date.now() + EXECUTE_WINDOW_SEC * 1000).toISOString();
      await saveSwap(r);
    } catch (err) {
      await releaseDaily(r.wallet, units).catch(() => undefined);
      throw err;
    }
    return {
      quoteId: r.id,
      status: r.status,
      // What the browser hands to the wallet SDK. The fee and recipient are not here: they are added server-side.
      swap: { chain: SWAP_CHAIN, tokenIn: r.from, tokenOut: r.to, amountIn: fromUnits(units), slippageBps: SWAP_SLIPPAGE_BPS },
      expiresAt: r.expiresAt,
    };
  }
);
