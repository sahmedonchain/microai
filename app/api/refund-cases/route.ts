import { apiErrors, parseJson, withApi } from "@/lib/api";
import { RpcError } from "@/lib/arcRpc";
import { PaymentReadError, readPayment } from "@/lib/refund/payment";
import { createCaseBody } from "@/lib/refund/schemas";
import { claimPayment, indexCase, listCasesFor, loadDeliveryCheck, newId, releasePayment, saveCase } from "@/lib/refund/store";
import { DELIVERY_REASONS, type RefundCase } from "@/lib/refund/types";
import { summary } from "@/lib/refund/view";

// Lists the signed-in wallet's cases (as buyer or merchant), and opens a new one.
export const GET = withApi({ name: "refund-cases-list", auth: "required", onLimiterError: "closed", limits: [{ limit: 60, windowSec: 60 }] }, async ({ session }) => {
  const cases = await listCasesFor(session!.sub);
  return { cases: cases.map((c) => summary(c, session!.sub)) };
});

export const POST = withApi(
  {
    name: "refund-cases-create",
    auth: "required",
    onLimiterError: "closed",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 20, windowSec: 86_400 },
    ],
  },
  async ({ req, session, log }) => {
    const b = await parseJson(req, createCaseBody);

    let payment;
    try {
      payment = await readPayment(b.network, b.txHash, b.payTo);
    } catch (err) {
      if (err instanceof PaymentReadError) throw err.kind === "not_found" ? apiErrors.notFound(err.message) : apiErrors.badRequest(err.message);
      if (err instanceof RpcError) {
        log.warn("refund case rpc failed");
        throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
      }
      throw err;
    }
    // Only the wallet that paid can ask for the money back.
    if (payment.payer !== session!.sub) throw apiErrors.forbidden("Only the wallet that made the payment can open a refund case for it.");

    if (payment.payer === payment.payee) throw apiErrors.badRequest("The payer and the recipient are the same wallet, so there is nothing to refund.");
    const paid = BigInt(payment.amount);
    const requested = b.requestedAmount ? BigInt(b.requestedAmount) : paid;
    if (requested > paid) throw apiErrors.badRequest("You cannot ask for more than was paid.");

    let delivery = null;
    if (b.deliveryCheckId) {
      delivery = await loadDeliveryCheck(b.deliveryCheckId);
      if (!delivery || delivery.payment.txHash !== payment.txHash || delivery.payment.network !== payment.network || delivery.payment.payer !== session!.sub) {
        throw apiErrors.badRequest("That delivery check does not belong to this payment and wallet.");
      }
    }
    if (DELIVERY_REASONS.includes(b.reason)) {
      if (!delivery) throw apiErrors.badRequest("Run a delivery check first. This reason needs one.");
      if (delivery.result === "PASS") throw apiErrors.badRequest("The delivery check passed, so this reason does not apply. Pick another reason, or fix the acceptance rule and check again.");
    }

    const id = newId();
    if (!(await claimPayment(payment.network, payment.txHash, id))) throw apiErrors.badRequest("A refund case already exists for this payment.");
    const now = new Date().toISOString();
    const c: RefundCase = { v: 1, id, status: "OPEN", createdAt: now, updatedAt: now, reason: b.reason, buyerStatement: b.statement, requestedAmount: requested.toString(), payment, delivery };
    try {
      await saveCase(c);
      await indexCase(c);
    } catch (err) {
      await releasePayment(payment.network, payment.txHash).catch(() => undefined);
      throw err;
    }
    return { case: summary(c, session!.sub) };
  }
);
