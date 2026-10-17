import { ApiError, parseJson, withApi } from "@/lib/api";
import { claimAndCredit, getClaim } from "@/lib/usedTx";
import { getCredit } from "@/lib/credits";
import { RpcError } from "@/lib/arcRpc";
import { PaymentVerificationError, checkPurchaseTx } from "@/lib/purchaseVerification";
import { purchaseBody } from "@/lib/schemas";

const alreadyUsed = () => new PaymentVerificationError("This payment has already been credited.", "already_used");

export const POST = withApi(
  { name: "credits-purchase", onLimiterError: "closed", auth: "required", limits: [{ limit: 10, windowSec: 60 }] },
  async ({ req, session, log }) => {
    const walletAddress = session!.sub;
    const { txHash, queries: requestedQueries } = await parseJson(req, purchaseBody);

    try {
      // A retry of a payment this wallet already had credited is a success, not an error.
      // Checked first so it also works after the 7-day verification window has passed.
      const existing = await getClaim(txHash);
      if (existing.exists) {
        if (existing.claim?.wallet !== walletAddress.toLowerCase()) throw alreadyUsed();
        return { ok: true, alreadyCredited: true, credits: await getCredit(walletAddress), added: 0, txHash };
      }

      // The expected charge is derived on the server: from the requested bundle
      // size, or (recovery, no `queries`) from the amount actually paid.
      const { queries, logIndexes } = await checkPurchaseTx(txHash, walletAddress, requestedQueries);

      // One atomic Redis operation claims the txHash and adds the credit. The claim is
      // never released: if this call fails ambiguously, the retry finds the claim and
      // reports "already credited", so a payment can never be credited twice.
      const result = await claimAndCredit(txHash, walletAddress, queries, logIndexes);
      if (result.outcome === "already") {
        if (result.claim?.wallet !== walletAddress.toLowerCase()) throw alreadyUsed();
        return { ok: true, alreadyCredited: true, credits: await getCredit(walletAddress), added: 0, txHash };
      }
      return { ok: true, credits: result.balance, added: queries, txHash };
    } catch (err) {
      if (err instanceof PaymentVerificationError) {
        log.warn("credit purchase rejected", { reason: err.reason });
        // A network mismatch or odd receipt is a service problem, not a problem with the payment.
        if (err.reason === "wrong_chain" || err.reason === "bad_receipt") {
          throw new ApiError(503, "upstream_unavailable", err.message, { extra: { reason: err.reason, retryable: true } });
        }
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
      if (err instanceof ApiError) throw err;
      // Redis failed around the claim. The outcome may be ambiguous; the claim is kept, and a
      // retry either credits the payment or reports it as already credited. Never twice.
      log.error("credit purchase failed", { err });
      throw new ApiError(503, "upstream_unavailable", "Could not record your payment right now. Try again shortly; you will not be charged twice.", {
        extra: { reason: "credit_failed", retryable: true },
      });
    }
  }
);
