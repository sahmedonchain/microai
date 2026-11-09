import type { Finding } from "./types";

// Delivery check: "the payment went through, but did the service deliver?"
//
// Pure and offline. It combines what MicroAI verified on-chain (the findings
// from verifyTransaction) with what the person says the service answered after
// they paid. MicroAI sends no payment and never sees that answer itself, so the
// HTTP status and PAYMENT-RESPONSE header are reported by the caller and are
// labelled that way in the evidence.
//
//   delivered  payment confirmed and matches the request, service answered 2xx
//   mismatch   payment and request/response do not line up (wrong amount,
//              recipient, token or network; paid but the service answered an error)
//   pending    the payment is not confirmed yet (not found, not in a block)
//   failed     the payment transaction itself failed on-chain
//   unknown    not enough to tell (nothing to compare, or no service answer given)
//
// "Delivered" means the service answered successfully after a matching payment.
// It does not mean the content of the answer was correct.

export type DeliveryStatus = "delivered" | "mismatch" | "pending" | "failed" | "unknown";

/** What the person observed after paying. Untrusted input. */
export interface ReportedDelivery {
  httpStatus: number;
  /** The PAYMENT-RESPONSE header value (base64 JSON), if they have it. */
  paymentResponse?: string;
}

export interface DeliveryVerdict {
  status: DeliveryStatus;
  title: string;
  reason: string;
  fix?: string;
  /** Facts the verdict rests on. */
  evidence: string[];
  /** Limits of this verdict, so it is not over-read. */
  notes: string[];
}

const MAX_HEADER_CHARS = 4096;

interface SettlementResponse {
  success?: boolean;
  transaction?: string;
  network?: string;
}

/** Decodes an x402 PAYMENT-RESPONSE header. Returns null when it is not base64 JSON. */
export function decodePaymentResponse(value: string): SettlementResponse | null {
  const v = value.trim();
  if (!v || v.length > MAX_HEADER_CHARS) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(v)) return null;
  try {
    const json = Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    return {
      success: typeof o.success === "boolean" ? o.success : undefined,
      transaction: typeof o.transaction === "string" ? o.transaction : undefined,
      network: typeof o.network === "string" ? o.network : undefined,
    };
  } catch {
    return null;
  }
}

const find = (findings: Finding[], id: string) => findings.filter((f) => f.id === id);
const has = (findings: Finding[], id: string, severity: Finding["severity"]) => find(findings, id).some((f) => f.severity === severity);

const ALWAYS_NOTE = "Delivered means the service answered successfully after a matching payment. It does not mean the answer's content was correct.";
const REPORTED_NOTE = "The HTTP status and PAYMENT-RESPONSE header are what you reported. MicroAI sends no payment and did not see the service's answer.";

export function classifyDelivery(input: { txHash: string; findings: Finding[]; reported?: ReportedDelivery }): DeliveryVerdict {
  const { txHash, findings, reported } = input;
  const notes = [ALWAYS_NOTE];
  const evidence: string[] = [];
  const out = (v: Omit<DeliveryVerdict, "evidence" | "notes">): DeliveryVerdict => ({ ...v, evidence, notes });

  // 1. The payment itself.
  if (has(findings, "tx.status", "error")) {
    return out({
      status: "failed",
      title: "The payment failed",
      reason: "The transaction was committed but reverted, so no funds moved and the service was never paid.",
      fix: "Look at the revert reason on the explorer, then pay again.",
    });
  }
  if (has(findings, "tx.found", "warning")) {
    return out({
      status: "pending",
      title: "The payment is not confirmed yet",
      reason: "The node has no committed receipt for this transaction. It may still be on its way, or the hash or network may be wrong.",
      fix: "Wait a minute and check again, and confirm the hash and the network.",
    });
  }
  if (has(findings, "tx.found", "error")) {
    return out({ status: "unknown", title: "The payment could not be read", reason: "The node returned a receipt that does not belong to this hash, so nothing was verified.", fix: "Try again shortly." });
  }
  if (has(findings, "tx.network", "error")) {
    return out({ status: "mismatch", title: "The payment is on a different network", reason: "The transaction exists, but not on the network the service asked to be paid on.", fix: "Pay on the network the endpoint asks for." });
  }
  const wrongPart = ["tx.token", "tx.recipient", "tx.amount"].find((id) => has(findings, id, "error") || has(findings, id, "warning"));
  if (wrongPart) {
    const f = find(findings, wrongPart).find((x) => x.severity === "error" || x.severity === "warning");
    if (f?.evidence) evidence.push(f.evidence);
    return out({ status: "mismatch", title: "The payment does not match what the service asked for", reason: f?.title ?? "The payment differs from the request.", fix: f?.fix });
  }
  if (!has(findings, "tx.amount", "ok")) {
    return out({
      status: "unknown",
      title: "There was nothing to compare the payment with",
      reason: "The expected recipient and amount are not known (the endpoint has no valid option, or it uses batched settlement), so the payment cannot be matched to the request.",
      fix: "Give the expected recipient and amount, or fix the endpoint first.",
    });
  }

  // 2. The payment is confirmed and matches. What did the service do?
  if (!reported) {
    return out({
      status: "unknown",
      title: "The payment matches, but the service's answer is not known",
      reason: "The payment reached the right recipient in the right amount. Whether the service then delivered cannot be seen from the chain.",
      fix: "Add what the service answered after you paid (the HTTP status, and the PAYMENT-RESPONSE header if you have it).",
    });
  }

  notes.push(REPORTED_NOTE);
  evidence.push(`Reported HTTP status after payment: ${reported.httpStatus}`);

  if (reported.paymentResponse) {
    const s = decodePaymentResponse(reported.paymentResponse);
    if (!s) {
      notes.push("The PAYMENT-RESPONSE header could not be read as base64 JSON, so it was not used.");
    } else {
      if (s.success === false) {
        evidence.push("PAYMENT-RESPONSE says success: false");
        return out({ status: "mismatch", title: "The service reports the settlement failed", reason: "The transaction succeeded on-chain, but the service's own PAYMENT-RESPONSE says settlement did not succeed.", fix: "Ask the service operator why it did not accept this payment, with the transaction hash." });
      }
      if (s.transaction && s.transaction.toLowerCase() !== txHash.toLowerCase()) {
        evidence.push(`PAYMENT-RESPONSE transaction: ${s.transaction}`);
        return out({ status: "mismatch", title: "The service points to a different transaction", reason: "The PAYMENT-RESPONSE names another transaction than the one you checked, so the service may have settled a different payment.", fix: "Check which transaction the service actually used." });
      }
      if (s.transaction) evidence.push("PAYMENT-RESPONSE names this transaction");
    }
  }

  const code = reported.httpStatus;
  if (code >= 200 && code < 300) {
    return out({ status: "delivered", title: "Delivered", reason: `The payment is confirmed and matches the request, and the service answered HTTP ${code}.` });
  }
  if (code === 402) {
    return out({ status: "mismatch", title: "Paid, but the service still asks for payment", reason: "The payment is confirmed and matches, yet the service answered 402 again. It did not recognise or accept the payment.", fix: "Retry the request with the payment proof, and tell the service operator the transaction hash if it keeps happening." });
  }
  if (code >= 400) {
    return out({ status: "mismatch", title: `Paid, but the service answered HTTP ${code}`, reason: "The payment is confirmed and matches, but the service did not deliver.", fix: "Contact the service operator with the transaction hash. Your payment reached them." });
  }
  return out({ status: "unknown", title: `The service answered HTTP ${code}`, reason: "A redirect or informational answer does not say whether the service delivered.", fix: "Follow the redirect and report the final status." });
}
