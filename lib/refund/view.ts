import { buildEvidence } from "./evidence";
import type { RefundCase } from "./types";

/** What an API response shows about a case, with the viewer's role. */
export function summary(c: RefundCase, viewer: string) {
  return {
    id: c.id,
    status: c.status,
    reason: c.reason,
    role: viewer === c.payment.payer ? "buyer" : "merchant",
    network: c.payment.network,
    payer: c.payment.payer,
    payee: c.payment.payee,
    paidAmount: c.payment.amount,
    requestedAmount: c.requestedAmount,
    approvedAmount: c.approvedAmount ?? null,
    refundTxHash: c.refund?.txHash ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function detail(c: RefundCase, viewer: string) {
  return { case: summary(c, viewer), buyerStatement: c.buyerStatement, merchantResponse: c.merchantResponse ?? null, refund: c.refund ?? null, evidence: buildEvidence(c) };
}

export const isParty = (c: RefundCase, addr: string) => addr === c.payment.payer || addr === c.payment.payee;
