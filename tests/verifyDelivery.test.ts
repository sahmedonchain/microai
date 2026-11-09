import { describe, expect, it } from "vitest";
import { classifyDelivery, decodePaymentResponse } from "@/lib/verify/delivery";
import type { Finding } from "@/lib/verify/types";

const TX = "0x" + "ab".repeat(32);
const OTHER_TX = "0x" + "cd".repeat(32);

const f = (id: string, severity: Finding["severity"], title = id): Finding => ({ id, severity, title, reason: "r" });
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

// What verifyTransaction returns for a payment that matches exactly.
const MATCHED = [f("tx.status", "ok"), f("tx.amount", "ok"), f("tx.sender", "info")];

describe("classifyDelivery: the payment itself", () => {
  it("failed: the transaction reverted", () => {
    const v = classifyDelivery({ txHash: TX, findings: [f("tx.status", "error")], reported: { httpStatus: 200 } });
    expect(v.status).toBe("failed");
  });

  it("pending: no receipt yet", () => {
    expect(classifyDelivery({ txHash: TX, findings: [f("tx.found", "warning")] }).status).toBe("pending");
  });

  it("pending even if the caller reports a 200 (the payment is not confirmed)", () => {
    expect(classifyDelivery({ txHash: TX, findings: [f("tx.found", "warning")], reported: { httpStatus: 200 } }).status).toBe("pending");
  });

  it("unknown: the node returned someone else's receipt", () => {
    expect(classifyDelivery({ txHash: TX, findings: [f("tx.found", "error")] }).status).toBe("unknown");
  });

  it.each(["tx.network", "tx.token", "tx.recipient", "tx.amount"])("mismatch: %s error", (id) => {
    const v = classifyDelivery({ txHash: TX, findings: [f("tx.status", "ok"), f(id, "error")], reported: { httpStatus: 200 } });
    expect(v.status).toBe("mismatch");
  });

  it("mismatch: overpayment is a warning on tx.amount", () => {
    const v = classifyDelivery({ txHash: TX, findings: [f("tx.status", "ok"), f("tx.amount", "warning", "Paid more than the endpoint asked for")], reported: { httpStatus: 200 } });
    expect(v.status).toBe("mismatch");
    expect(v.reason).toMatch(/more than/);
  });

  it("failed beats everything else", () => {
    const v = classifyDelivery({ txHash: TX, findings: [f("tx.status", "error"), f("tx.amount", "error")] });
    expect(v.status).toBe("failed");
  });

  it("unknown: nothing to compare with (no expected payment)", () => {
    expect(classifyDelivery({ txHash: TX, findings: [f("tx.expected", "warning")], reported: { httpStatus: 200 } }).status).toBe("unknown");
    expect(classifyDelivery({ txHash: TX, findings: [f("tx.batched", "info")], reported: { httpStatus: 200 } }).status).toBe("unknown");
  });
});

describe("classifyDelivery: what the service answered", () => {
  it("unknown when the payment matches but no service answer is given", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED });
    expect(v.status).toBe("unknown");
    expect(v.fix).toMatch(/HTTP status/);
  });

  it.each([200, 201, 204, 299])("delivered on HTTP %i", (code) => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: code } });
    expect(v.status).toBe("delivered");
  });

  it("mismatch when the service asks for payment again (402)", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 402 } });
    expect(v.status).toBe("mismatch");
    expect(v.title).toMatch(/still asks/);
  });

  it.each([400, 401, 403, 404, 429, 500, 502, 503])("mismatch when paid but the service answered %i", (code) => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: code } });
    expect(v.status).toBe("mismatch");
    expect(v.title).toContain(String(code));
  });

  it.each([100, 301, 302])("unknown on %i (does not say whether it delivered)", (code) => {
    expect(classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: code } }).status).toBe("unknown");
  });
});

describe("classifyDelivery: PAYMENT-RESPONSE header", () => {
  it("delivered and notes that the header names this transaction", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: b64({ success: true, transaction: TX, network: "eip155:5042" }) } });
    expect(v.status).toBe("delivered");
    expect(v.evidence.join(" ")).toMatch(/names this transaction/);
  });

  it("is case-insensitive about the transaction hash", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: b64({ success: true, transaction: TX.toUpperCase().replace("0X", "0x") }) } });
    expect(v.status).toBe("delivered");
  });

  it("mismatch when the service settled a different transaction, even on HTTP 200", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: b64({ success: true, transaction: OTHER_TX }) } });
    expect(v.status).toBe("mismatch");
    expect(v.title).toMatch(/different transaction/);
  });

  it("mismatch when the service says success: false, even on HTTP 200", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: b64({ success: false }) } });
    expect(v.status).toBe("mismatch");
  });

  it("an unreadable header is ignored with a note, the HTTP status still decides", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: "not base64 !!" } });
    expect(v.status).toBe("delivered");
    expect(v.notes.join(" ")).toMatch(/could not be read/);
  });

  it("a header without a transaction field does not block delivery", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200, paymentResponse: b64({ success: true }) } });
    expect(v.status).toBe("delivered");
  });
});

describe("classifyDelivery: honesty of the verdict", () => {
  it("always says delivered does not mean the content was correct", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200 } });
    expect(v.notes.join(" ")).toMatch(/does not mean the answer's content was correct/);
  });

  it("labels the service answer as reported by the user, not seen by MicroAI", () => {
    const v = classifyDelivery({ txHash: TX, findings: MATCHED, reported: { httpStatus: 200 } });
    expect(v.notes.join(" ")).toMatch(/you reported/);
    expect(v.notes.join(" ")).toMatch(/did not see/);
  });

  it("never returns delivered without a confirmed, matching payment", () => {
    const bad: Finding[][] = [[], [f("tx.found", "warning")], [f("tx.status", "error")], [f("tx.expected", "warning")], [f("tx.status", "ok")]];
    for (const findings of bad) {
      expect(classifyDelivery({ txHash: TX, findings, reported: { httpStatus: 200 } }).status).not.toBe("delivered");
    }
  });
});

describe("decodePaymentResponse", () => {
  it("decodes base64 and base64url JSON", () => {
    const o = { success: true, transaction: TX, network: "eip155:5042" };
    expect(decodePaymentResponse(b64(o))).toEqual(o);
    const url = b64(o).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodePaymentResponse(url)).toEqual(o);
  });

  it("rejects non-JSON, arrays, scalars, empty and oversized input", () => {
    expect(decodePaymentResponse("")).toBeNull();
    expect(decodePaymentResponse("   ")).toBeNull();
    expect(decodePaymentResponse(Buffer.from("not json").toString("base64"))).toBeNull();
    expect(decodePaymentResponse(b64([1, 2]))).toBeNull();
    expect(decodePaymentResponse(b64("x"))).toBeNull();
    expect(decodePaymentResponse(b64(null))).toBeNull();
    expect(decodePaymentResponse("A".repeat(5000))).toBeNull();
  });

  it("ignores fields of the wrong type instead of trusting them", () => {
    const d = decodePaymentResponse(b64({ success: "yes", transaction: 5, network: {} }));
    expect(d).toEqual({ success: undefined, transaction: undefined, network: undefined });
  });
});
