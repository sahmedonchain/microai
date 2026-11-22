import { createHmac, createHash } from "node:crypto";
import type { DeliveryCheck, PaymentRecord, RefundCase } from "./types";

// Evidence bundle: a read-only snapshot of one case, with a SHA-256 hash and a
// MicroAI attestation. The attestation is an HMAC made with a key only MicroAI
// holds, so it shows MicroAI produced this exact bundle, and MicroAI can check it
// again. Anyone else can still recompute the hash. It is evidence for the
// merchant to weigh, not a court ruling.

export interface EvidenceBundle {
  version: 1;
  caseId: string;
  status: RefundCase["status"];
  reason: RefundCase["reason"];
  buyerStatement: string;
  merchantResponse: RefundCase["merchantResponse"] | null;
  paymentProof: PaymentRecord;
  deliveryProof: Pick<DeliveryCheck, "id" | "createdAt" | "resourceUrl" | "httpStatus" | "responseHash" | "responseBytes" | "importantFields" | "rule" | "result" | "reasons"> | null;
  requestedAmount: string;
  approvedAmount: string | null;
  refund: RefundCase["refund"] | null;
  timestamps: { caseCreatedAt: string; caseUpdatedAt: string };
  notes: string[];
}

export interface SignedEvidence {
  bundle: EvidenceBundle;
  bundleHash: string;
  attestation: { by: "MicroAI"; alg: "HMAC-SHA256"; value: string };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

function key(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not configured");
  return createHash("sha256").update(`microai-evidence-v1:${secret}`).digest("hex");
}

export function buildEvidence(c: RefundCase): SignedEvidence {
  const d = c.delivery;
  const bundle: EvidenceBundle = {
    version: 1,
    caseId: c.id,
    status: c.status,
    reason: c.reason,
    buyerStatement: c.buyerStatement,
    merchantResponse: c.merchantResponse ?? null,
    paymentProof: c.payment,
    deliveryProof: d
      ? { id: d.id, createdAt: d.createdAt, resourceUrl: d.resourceUrl, httpStatus: d.httpStatus, responseHash: d.responseHash, responseBytes: d.responseBytes, importantFields: d.importantFields, rule: d.rule, result: d.result, reasons: d.reasons }
      : null,
    requestedAmount: c.requestedAmount,
    approvedAmount: c.approvedAmount ?? null,
    refund: c.refund ?? null,
    timestamps: { caseCreatedAt: c.createdAt, caseUpdatedAt: c.updatedAt },
    notes: [
      "The payment proof was read from the Arc chain by MicroAI.",
      "The delivery proof is what the buyer reported; MicroAI did not see the service's live answer. Only its hash is kept, not the body.",
      "The attestation shows MicroAI produced this bundle. It is not a ruling on who is right.",
    ],
  };
  const bundleHash = createHash("sha256").update(canonical(bundle)).digest("hex");
  const value = createHmac("sha256", key()).update(bundleHash).digest("hex");
  return { bundle, bundleHash, attestation: { by: "MicroAI", alg: "HMAC-SHA256", value } };
}
