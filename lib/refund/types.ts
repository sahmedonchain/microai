import type { ArcNetworkId } from "@/lib/arcConfig";

// X402 Refund Evidence & Dispute Receipt.
//
// Storage is Redis (the app has no SQL database). The five records in the plan:
//   PaymentRecord      embedded in DeliveryCheck and RefundCase (read from the chain)
//   DeliveryCheck      its own key, written by POST /api/x402/delivery-check
//   RefundCase         its own key, written by POST /api/refund-cases
//   EvidenceBundle     derived from the case on every read (see evidence.ts)
//   RefundTransaction  embedded in RefundCase, plus a unique key per refund tx hash
// MicroAI never holds a private key and never sends a payment: the merchant sends
// the USDC refund from their own wallet, and MicroAI checks it on chain.

export const REFUND_REASONS = ["NO_RESPONSE", "WRONG_DATA", "INCOMPLETE_RESULT", "WRONG_PRICE", "UNAUTHORIZED_PURCHASE", "OTHER"] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];
/** Reasons that claim the delivery was bad, so they need a delivery check that did not pass. */
export const DELIVERY_REASONS: readonly RefundReason[] = ["NO_RESPONSE", "WRONG_DATA", "INCOMPLETE_RESULT"];

export type CaseStatus = "OPEN" | "APPROVED" | "REJECTED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type CheckResult = "PASS" | "FAIL" | "NEEDS_REVIEW";

/** A USDC payment as read from the transaction receipt. Lower-case addresses, smallest units. */
export interface PaymentRecord {
  network: ArcNetworkId;
  txHash: string;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  blockNumber: number;
}

export interface AcceptanceRule {
  /** Exact HTTP status that counts as delivered. Default: any 2xx. */
  expectedStatus?: number;
  /** Strings the response body must contain. */
  mustContain?: string[];
  /** Dot paths that must exist in the JSON body, e.g. "data.items". */
  requiredJsonFields?: string[];
}

export interface DeliveryCheck {
  v: 1;
  id: string;
  createdAt: string;
  payment: PaymentRecord;
  resourceUrl: string;
  /** What the buyer reports MicroAI's caller saw. MicroAI did not see the response itself. */
  httpStatus: number | null;
  responseHash: string | null;
  responseBytes: number;
  importantFields: Record<string, string>;
  rule: AcceptanceRule;
  result: CheckResult;
  reasons: string[];
}

export interface RefundTransaction {
  txHash: string;
  amount: string;
  recordedAt: string;
}

export interface RefundCase {
  v: 1;
  id: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  reason: RefundReason;
  buyerStatement: string;
  requestedAmount: string;
  payment: PaymentRecord;
  delivery: DeliveryCheck | null;
  approvedAmount?: string;
  merchantResponse?: { decision: "APPROVED" | "REJECTED"; message: string; at: string };
  refund?: RefundTransaction;
}
