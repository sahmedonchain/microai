import { apiErrors, withApi } from "@/lib/api";
import { ARC_NETWORKS } from "@/lib/arcConfig";
import { RpcError } from "@/lib/arcRpc";
import { SWAP_TOKENS } from "@/lib/swap/config";
import { loadSwap, recordCompleted, releaseDaily, saveSwap, swapIdForTx } from "@/lib/swap/store";
import { historyView } from "@/lib/swap/view";
import { fetchReceipt, readTransfers } from "@/lib/verify/txVerify";

// Reads the swap transaction from the Arc chain and updates the record: pending,
// success (with the amount actually received) or failed. Only the wallet that
// made the swap can ask.
export async function GET(req: Request, ctx: { params: Promise<{ txHash: string }> }): Promise<Response> {
  const { txHash } = await ctx.params;
  return withApi({ name: "swap-status", auth: "required", onLimiterError: "closed", limits: [{ limit: 60, windowSec: 60 }] }, async ({ session, log }) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw apiErrors.badRequest("Invalid transaction hash. Must be 0x followed by 64 hex characters.");
    const id = await swapIdForTx(txHash);
    const r = id ? await loadSwap(id) : null;
    if (!r || r.wallet !== session!.sub) throw apiErrors.notFound("No swap with this transaction.");
    const explorerUrl = `${ARC_NETWORKS.mainnet.explorerUrl}/tx/${r.txHash}`;
    if (r.status !== "PENDING") return { swap: historyView(r), explorerUrl };

    let receipt;
    try {
      receipt = await fetchReceipt(txHash, "mainnet");
    } catch (err) {
      if (err instanceof RpcError) {
        log.warn("swap status rpc failed");
        throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
      }
      throw err;
    }
    if (receipt && typeof receipt.blockNumber === "string") {
      if (receipt.status === "0x1") {
        const moves = readTransfers(receipt);
        const got = moves.filter((t) => t.token === SWAP_TOKENS[r.to].address && t.to === r.wallet).reduce((s, t) => s + t.value, BigInt(0));
        const spent = moves.filter((t) => t.token === SWAP_TOKENS[r.from].address && t.from === r.wallet).reduce((s, t) => s + t.value, BigInt(0));
        if (got > BigInt(0) && spent > BigInt(0)) {
          // Both sides of a swap are visible: the input left the wallet and the output arrived.
          r.status = "SUCCESS";
          r.actualOut = got.toString();
        } else {
          // A confirmed transaction that is not a swap result (for example only an approval) is never shown as a completed swap.
          r.status = "UNKNOWN";
          r.error = "The transaction succeeded, but no swap result was found in it. Check it on the explorer.";
        }
      } else {
        r.status = "FAILED";
        r.error = "The transaction failed on chain, for example because the slippage limit was exceeded.";
        await releaseDaily(r.wallet, BigInt(r.amountIn)).catch(() => undefined);
      }
      await saveSwap(r);
      if (r.status === "SUCCESS") await recordCompleted(r).catch(() => undefined);
    }
    return { swap: historyView(r), explorerUrl };
  })(req);
}
