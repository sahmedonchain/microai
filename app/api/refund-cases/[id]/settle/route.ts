import { apiErrors, parseJson, withApi } from "@/lib/api";
import { ARC_NETWORKS } from "@/lib/arcConfig";
import { RpcError, rpcCall } from "@/lib/arcRpc";
import { asMerchant } from "@/lib/refund/access";
import { usdcMoved } from "@/lib/refund/payment";
import { settleBody } from "@/lib/refund/schemas";
import { claimRefundTx, releaseRefundTx, saveCase } from "@/lib/refund/store";
import { detail } from "@/lib/refund/view";
import { fetchReceipt } from "@/lib/verify/txVerify";

// Records the refund transaction the merchant sent from their own wallet. MicroAI
// reads the receipt and requires a successful USDC transfer from the merchant to
// the buyer of at least the approved amount. One refund transaction settles one case.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return withApi({ name: "refund-case-settle", auth: "required", onLimiterError: "closed", limits: [{ limit: 10, windowSec: 60 }] }, async ({ session, log }) => {
    const { txHash } = await parseJson(req, settleBody);
    const c = await asMerchant(id, session!.sub, "APPROVED", async (c) => {
      const { network, payer, payee } = c.payment;
      let moved: bigint;
      let blockTime = 0;
      try {
        const receipt = await fetchReceipt(txHash, network);
        moved = usdcMoved(receipt, payee, payer);
        // The refund must come after the payment and after the approval, so an
        // older transfer to the buyer cannot be passed off as this refund.
        if (moved > BigInt(0) && typeof receipt?.blockNumber === "string") {
          if (parseInt(receipt.blockNumber, 16) <= c.payment.blockNumber) throw apiErrors.badRequest("This transaction is not after the original payment.");
          const block = await rpcCall<{ timestamp?: string } | null>("eth_getBlockByNumber", [receipt.blockNumber, false], { url: ARC_NETWORKS[network].rpcUrl });
          blockTime = block?.timestamp ? parseInt(block.timestamp, 16) : 0;
        }
      } catch (err) {
        if (err instanceof RpcError) {
          log.warn("settle rpc failed");
          throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
        }
        throw err;
      }
      const approvedAt = Date.parse(c.merchantResponse?.at ?? "") / 1000;
      if (moved > BigInt(0) && (!blockTime || blockTime < approvedAt - 30)) throw apiErrors.badRequest("This transaction is older than the approval, so it cannot be this refund.");
      const approved = BigInt(c.approvedAmount ?? "0");
      if (moved === BigInt(0)) throw apiErrors.badRequest(`No successful USDC transfer from the merchant to the buyer in this transaction on ${network}.`);
      if (moved < approved) throw apiErrors.badRequest("This transaction refunds less than the approved amount.");
      if (!(await claimRefundTx(network, txHash, c.id))) throw apiErrors.badRequest("This refund transaction is already recorded for a case.");
      try {
        const now = new Date().toISOString();
        c.refund = { txHash: txHash.toLowerCase(), amount: moved.toString(), recordedAt: now };
        c.status = approved >= BigInt(c.payment.amount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
        c.updatedAt = now;
        await saveCase(c);
      } catch (err) {
        await releaseRefundTx(network, txHash).catch(() => undefined);
        throw err;
      }
      return c;
    });
    return detail(c, session!.sub);
  })(req);
}
