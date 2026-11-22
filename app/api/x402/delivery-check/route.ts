import { apiErrors, parseJson, withApi } from "@/lib/api";
import { RpcError } from "@/lib/arcRpc";
import { judgeDelivery, sha256Hex } from "@/lib/refund/deliveryCheck";
import { PaymentReadError, readPayment } from "@/lib/refund/payment";
import { deliveryCheckBody } from "@/lib/refund/schemas";
import { newId, saveDeliveryCheck } from "@/lib/refund/store";
import type { DeliveryCheck } from "@/lib/refund/types";

// Records whether an x402 service delivered after payment. The payment is read
// from the chain. The service's answer is reported by the signed-in payer, and
// only its hash and the fields the rule checks are stored. Sends no payment.
export const POST = withApi(
  {
    name: "x402-delivery-check",
    auth: "required",
    onLimiterError: "closed",
    limits: [
      { limit: 10, windowSec: 60 },
      { limit: 100, windowSec: 86_400 },
    ],
  },
  async ({ req, session, log }) => {
    const b = await parseJson(req, deliveryCheckBody);
    let payment;
    try {
      payment = await readPayment(b.network, b.txHash, b.payTo);
    } catch (err) {
      if (err instanceof PaymentReadError) throw err.kind === "not_found" ? apiErrors.notFound(err.message) : apiErrors.badRequest(err.message);
      if (err instanceof RpcError) {
        log.warn("delivery-check rpc failed");
        throw apiErrors.upstream("Arc RPC is unavailable right now. Try again shortly.");
      }
      throw err;
    }
    if (payment.payer !== session!.sub) throw apiErrors.forbidden("Only the wallet that made the payment can record its delivery.");

    const httpStatus = b.httpStatus ?? null;
    const judged = judgeDelivery({ httpStatus, body: b.responseBody, rule: b.rule });
    const check: DeliveryCheck = {
      v: 1,
      id: newId(),
      createdAt: new Date().toISOString(),
      payment,
      resourceUrl: b.resourceUrl,
      httpStatus,
      responseHash: b.responseBody === undefined ? null : sha256Hex(b.responseBody),
      responseBytes: b.responseBody === undefined ? 0 : Buffer.byteLength(b.responseBody),
      importantFields: judged.importantFields,
      rule: b.rule,
      result: judged.result,
      reasons: judged.reasons,
    };
    await saveDeliveryCheck(check);
    return { check };
  }
);
