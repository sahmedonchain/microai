import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { claimTxHash, releaseTxHash } from "@/lib/usedTx";
import { addCredit } from "@/lib/credits";
import { RpcError } from "@/lib/arcRpc";
import { PaymentVerificationError, checkPurchaseTx } from "@/lib/purchaseVerification";
import { purchaseBody } from "@/lib/schemas";

// Verifies the payment, then atomically marks it credited (SET NX) so it can be
// credited only once. Returns the number of queries to credit.
async function verifyAndClaim(txHash: string, walletAddress: string, requestedQueries: number | undefined): Promise<number> {
  const queries = await checkPurchaseTx(txHash, walletAddress, requestedQueries);
  const claimed = await claimTxHash(txHash, { wallet: walletAddress.toLowerCase(), credits: queries, at: new Date().toISOString() });
  if (!claimed) {
    throw new PaymentVerificationError("This payment has already been credited.", "already_used");
  }
  return queries;
}

export const POST = withApi(
  { name: "credits-purchase", auth: "required", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const { txHash, queries: requestedQueries } = await parseJson(req, purchaseBody);

    // The expected charge is derived on the server: from the requested bundle
    // size, or (recovery, no `queries`) from the amount actually paid. The client
    // never supplies the amount itself.
    let queries: number;
    try {
      queries = await verifyAndClaim(txHash, walletAddress, requestedQueries);
    } catch (err) {
      if (err instanceof PaymentVerificationError) {
        log.warn("credit purchase rejected", { reason: err.reason });
        const status = err.reason === "already_used" ? 409 : 402;
        throw new ApiError(status, "payment_invalid", err.message, { extra: { reason: err.reason, retryable: err.retryable } });
      }
      if (err instanceof RpcError) {
        // The node is unreachable: nothing was claimed, so asking again is safe.
        log.error("credit purchase verification could not reach the RPC", { err });
        throw new ApiError(503, "upstream_unavailable", "Could not reach Arc right now. Your payment is safe; try again shortly.", {
          extra: { reason: "rpc_unavailable", retryable: true },
        });
      }
      log.error("credit purchase verification error", { err });
      throw apiErrors.internal("Payment verification failed.");
    }

    // verifyPurchase() already claimed txHash (atomic NX) to block concurrent
    // double-spends of the same transaction. If crediting then fails, release
    // that claim rather than leaving the payer with a burned, uncreditable
    // txHash and no way to retry the same on-chain payment.
    let newTotal: number;
    try {
      newTotal = await addCredit(walletAddress, queries);
    } catch (err) {
      log.error("addCredit failed after claiming txHash, releasing claim", { err });
      await releaseTxHash(txHash).catch((releaseErr) => {
        log.error("failed to release txHash after addCredit failure", { err: releaseErr });
      });
      throw new ApiError(500, "internal", "Payment verified but crediting failed. Please retry with the same transaction.", {
        extra: { reason: "credit_failed", retryable: true },
      });
    }

    return { ok: true, credits: newTotal, added: queries, txHash };
  }
);
