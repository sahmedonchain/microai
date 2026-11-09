import { readFileSync } from "node:fs";
import { Wallet, TypedDataEncoder } from "ethers";
import { describe, expect, it } from "vitest";
import { TRANSFER_WITH_AUTHORIZATION_TYPES } from "@/lib/verify/signature";
import { explainReason, inspectPayload } from "@/lib/verify/inspector";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const PAY_TO = "0x" + "ab".repeat(20);
// A throwaway key used only in tests, so signatures are real and checkable.
const WALLET = new Wallet("0x" + "11".repeat(32));
const PAYER = WALLET.address;
const USDC = "0x3600000000000000000000000000000000000000";
const NOW = new Date("2026-11-10T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

const option = { scheme: "exact", network: "eip155:5042002", amount: "1000", asset: USDC, payTo: PAY_TO, maxTimeoutSeconds: 60, extra: { name: "USDC", version: "2" } };
const REQUIRED = b64({ x402Version: 2, resource: { url: "https://api.example.com/paid" }, accepts: [option] });

const auth = (over: Record<string, unknown> = {}) => ({
  from: PAYER, to: PAY_TO, value: "1000", validAfter: "0", validBefore: String(NOW_SEC + 600), nonce: "0x" + "11".repeat(32), ...over,
});
// Signs the given authorization for the declared domain (sync, so no await in tests).
function sign(a: Record<string, unknown>, o: { chainId?: number; asset?: string; name?: string; version?: string } = {}) {
  try {
    const domain = { name: o.name ?? "USDC", version: o.version ?? "2", chainId: o.chainId ?? 5042002, verifyingContract: (o.asset ?? USDC).toLowerCase() };
    const value = { ...a, from: String(a.from).toLowerCase(), to: String(a.to).toLowerCase() } as Record<string, string>;
    return WALLET.signingKey.sign(TypedDataEncoder.hash(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, value)).serialized;
  } catch {
    return "0x" + "22".repeat(65);
  }
}
const sig = (a = auth(), accepted: unknown = option, signature = sign(a)) =>
  b64({ x402Version: 2, accepted, payload: { signature, authorization: a } });

const ids = (r: ReturnType<typeof inspectPayload>, severity?: string) => r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.id);
const step = (r: ReturnType<typeof inspectPayload>, id: string) => r.lifecycle.find((s) => s.id === id)!;

describe("inspectPayload: a matching payment", () => {
  const r = inspectPayload({ paymentRequired: REQUIRED, paymentSignature: sig(), now: NOW });

  it("has no errors and says the recipient and amount match", () => {
    expect(ids(r, "error")).toEqual([]);
    expect(ids(r, "ok")).toEqual(expect.arrayContaining(["match.payTo", "match.amount", "payload.validBefore"]));
  });

  it("confirms the signature recovers to the payer, and still lists what it does not check", () => {
    expect(ids(r, "ok")).toContain("payload.signature.check");
    expect(step(r, "signed").state).toBe("ok");
    expect(r.report.notChecked.join(" ")).toMatch(/token contract itself/);
    expect(r.report.notChecked.join(" ")).toMatch(/funds|used/);
  });

  it("never claims the service delivered", () => {
    expect(step(r, "delivered").state).toBe("unverified");
    expect(step(r, "settled").state).toBe("missing");
  });
});

describe("inspectPayload: mismatches", () => {
  const run = (a: Record<string, unknown>, accepted?: unknown) => inspectPayload({ paymentRequired: REQUIRED, paymentSignature: sig(auth(a), accepted), now: NOW });

  it("wrong recipient is an error", () => {
    const r = run({ to: "0x" + "ee".repeat(20) });
    expect(ids(r, "error")).toContain("match.payTo");
    expect(step(r, "signed").state).toBe("problem");
  });
  it("underpaying is an error, overpaying a warning", () => {
    expect(ids(run({ value: "999" }), "error")).toContain("match.amount");
    expect(ids(run({ value: "1001" }), "warning")).toContain("match.amount");
  });
  it("an expired authorization is an error", () => {
    expect(ids(run({ validBefore: String(NOW_SEC - 1) }), "error")).toContain("payload.validBefore");
  });
  it("a not-yet-valid authorization is a warning", () => {
    expect(ids(run({ validAfter: String(NOW_SEC + 100) }), "warning")).toContain("payload.validAfter");
  });
  it("a different network than requested is an error", () => {
    expect(ids(run({}, { ...option, network: "eip155:5042" }), "error")).toContain("match.network");
  });
  it("bad nonce, address and value are errors", () => {
    expect(ids(run({ nonce: "0x12" }), "error")).toContain("payload.nonce");
    expect(ids(run({ from: "nope" }), "error")).toContain("payload.from");
    expect(ids(run({ value: "1.5" }), "error")).toContain("payload.value");
  });
  it("compares addresses case-insensitively", () => {
    const r = run({ to: PAY_TO.toUpperCase().replace("0X", "0x") });
    expect(ids(r, "error")).toEqual([]);
  });
});

describe("inspectPayload: partial and odd input", () => {
  it("checks the payload on its own when no requirements are given", () => {
    const r = inspectPayload({ paymentSignature: sig(), now: NOW });
    expect(ids(r)).toContain("match.missing");
    expect(step(r, "requested").state).toBe("missing");
  });
  it("accepts a header pasted with its name and plain JSON", () => {
    const r = inspectPayload({ paymentRequired: `PAYMENT-REQUIRED: ${REQUIRED}`, paymentSignature: JSON.stringify({ x402Version: 2, accepted: option, payload: { signature: sign(auth()), authorization: auth() } }), now: NOW });
    expect(ids(r, "error")).toEqual([]);
  });
  it("reports junk, oversized and non-object input without throwing", () => {
    for (const bad of ["not base64 !!", b64([1, 2]), b64("x"), "A".repeat(20_000), "{broken"]) {
      const r = inspectPayload({ paymentSignature: bad, now: NOW });
      expect(ids(r, "error").length).toBeGreaterThan(0);
    }
  });
  it("says so for ERC-7710 delegation payments instead of guessing", () => {
    const r = inspectPayload({ paymentSignature: b64({ x402Version: 2, accepted: { ...option, extra: { assetTransferMethod: "erc7710" } }, payload: { delegation: { x: 1 } } }), now: NOW });
    expect(ids(r, "info")).toContain("payload.kind");
    expect(ids(r, "error")).toEqual([]);
  });
  it("an empty form asks for input", () => {
    expect(ids(inspectPayload({ now: NOW }))).toEqual(["empty"]);
  });
  it("warns about legacy v1", () => {
    const r = inspectPayload({ paymentSignature: b64({ x402Version: 1, payload: { signature: "0x" + "22".repeat(65), authorization: auth() } }), now: NOW });
    expect(ids(r, "warning")).toContain("payload.version");
  });
});

describe("inspectPayload: PAYMENT-RESPONSE", () => {
  const TX = "0x" + "ab".repeat(32);
  it("a reported success is info, not proof, and points to the on-chain check", () => {
    const r = inspectPayload({ paymentResponse: b64({ success: true, transaction: TX, network: "eip155:5042002", payer: PAYER }), now: NOW });
    const f = r.findings.find((x) => x.id === "response.success")!;
    expect(f.severity).toBe("info");
    expect(f.reason).toMatch(/has not checked it on-chain/);
    expect(step(r, "settled").state).toBe("unverified");
  });
  it("a reported failure is an error with the reason explained", () => {
    const r = inspectPayload({ paymentResponse: b64({ success: false, errorReason: "invalid_exact_evm_payload_authorization_valid_before" }), now: NOW });
    expect(ids(r, "error")).toContain("response.success");
    expect(r.findings.find((x) => x.id === "response.success")!.reason).toMatch(/expired/);
    expect(step(r, "settled").state).toBe("problem");
  });
  it("an unknown reason code is shown, not invented", () => {
    const r = inspectPayload({ paymentResponse: b64({ success: false, errorReason: "weird_code" }), now: NOW });
    expect(r.findings.find((x) => x.id === "response.success")!.reason).toMatch(/weird_code/);
    expect(explainReason("weird_code")).toBeUndefined();
  });
});

describe("signature check (EIP-3009, offline)", () => {
  const run = (signature: string, accepted: unknown = option, a = auth()) =>
    inspectPayload({ paymentRequired: REQUIRED, paymentSignature: sig(a, accepted, signature), now: NOW });

  it("a signature over different data is an error", () => {
    const signedFor = auth({ value: "999" });
    const r = run(sign(signedFor));
    expect(ids(r, "error")).toContain("payload.signature.check");
    expect(step(r, "signed").state).toBe("problem");
  });
  it("a signature made for another token name or network is an error", () => {
    expect(ids(run(sign(auth(), { name: "Wrong" })), "error")).toContain("payload.signature.check");
    expect(ids(run(sign(auth(), { chainId: 5042 })), "error")).toContain("payload.signature.check");
  });
  it("a signature from another account is an error", () => {
    const other = new Wallet("0x" + "22".repeat(32));
    const a = auth();
    const hash = TypedDataEncoder.hash({ name: "USDC", version: "2", chainId: 5042002, verifyingContract: USDC }, TRANSFER_WITH_AUTHORIZATION_TYPES, { ...a, from: PAYER.toLowerCase(), to: PAY_TO });
    expect(ids(run(other.signingKey.sign(hash).serialized), "error")).toContain("payload.signature.check");
  });
  it("without extra.name and version the check is skipped with a note, not failed", () => {
    const noExtra = { ...option, extra: {} };
    const r = inspectPayload({ paymentSignature: sig(auth(), noExtra), now: NOW });
    const f = r.findings.find((x) => x.id === "payload.signature.check")!;
    expect(f.severity).toBe("info");
    expect(step(r, "signed").state).toBe("unverified");
  });
  it("a non-65-byte (smart wallet) signature is not checked, not failed", () => {
    const r = run("0x" + "ab".repeat(100));
    expect(r.findings.find((x) => x.id === "payload.signature.check")!.severity).toBe("info");
    expect(ids(r, "error")).not.toContain("payload.signature.check");
  });
  it("a matching signature never makes up for a wrong recipient", () => {
    const a = auth({ to: "0x" + "ee".repeat(20) });
    const r = run(sign(a), option, a);
    expect(ids(r, "ok")).toContain("payload.signature.check");
    expect(ids(r, "error")).toContain("match.payTo");
    expect(step(r, "signed").state).toBe("problem");
  });
});

describe("x402 v2 spec details", () => {
  it("warns when PaymentRequired has no resource.url, and when the payload has no accepted", () => {
    const noResource = b64({ x402Version: 2, accepts: [option] });
    expect(ids(inspectPayload({ paymentRequired: noResource, now: NOW }), "warning")).toContain("requirements.resource");
    const noAccepted = b64({ x402Version: 2, payload: { signature: sign(auth()), authorization: auth() } });
    expect(ids(inspectPayload({ paymentSignature: noAccepted, now: NOW }), "warning")).toContain("payload.accepted");
  });
  it("explains every error code listed in the v2 spec", () => {
    for (const code of ["insufficient_funds", "invalid_exact_evm_payload_authorization_valid_after", "invalid_exact_evm_payload_authorization_valid_before", "invalid_exact_evm_payload_authorization_value_mismatch", "invalid_exact_evm_payload_signature", "invalid_exact_evm_payload_recipient_mismatch", "invalid_network", "invalid_payload", "invalid_payment_requirements", "invalid_scheme", "unsupported_scheme", "invalid_x402_version", "invalid_transaction_state", "unexpected_verify_error", "unexpected_settle_error", "settlement_pending"]) {
      expect(explainReason(code), code).toBeTruthy();
    }
  });
  it("settlement_pending is a warning to recheck, not a failure", () => {
    const TX = "0x" + "ab".repeat(32);
    const r = inspectPayload({ paymentResponse: b64({ success: false, errorReason: "settlement_pending", transaction: TX, network: "eip155:5042" }), now: NOW });
    expect(ids(r, "error")).toEqual([]);
    expect(ids(r, "warning")).toContain("response.pending");
    expect(step(r, "settled").state).toBe("unverified");
  });
  it("a success with an empty transaction is flagged", () => {
    const r = inspectPayload({ paymentResponse: b64({ success: true, transaction: "", network: "eip155:5042" }), now: NOW });
    expect(ids(r, "warning")).toContain("response.transaction");
  });
});

describe("Permit2 and upto", () => {
  const permitOption = (scheme = "exact") => ({ ...option, scheme, extra: { assetTransferMethod: "permit2" } });
  const p2 = (over: Record<string, unknown> = {}, witness: Record<string, unknown> = {}, permitted: Record<string, unknown> = {}) => ({
    permitted: { token: USDC, amount: "1000", ...permitted },
    from: PAYER, spender: "0x" + "40".repeat(20), nonce: "12345", deadline: String(NOW_SEC + 600),
    witness: { to: PAY_TO, validAfter: "0", ...witness }, ...over,
  });
  const run = (permit: unknown, scheme = "exact", sigValue = "0x" + "22".repeat(65)) => {
    const o = permitOption(scheme);
    return inspectPayload({ paymentRequired: b64({ x402Version: 2, resource: { url: "https://x.example/p" }, accepts: [o] }), paymentSignature: b64({ x402Version: 2, accepted: o, payload: { signature: sigValue, permit2Authorization: permit } }), now: NOW });
  };

  it("a matching exact Permit2 payment has no errors, and says the signature is not verified", () => {
    const r = run(p2());
    expect(ids(r, "error")).toEqual([]);
    expect(ids(r, "ok")).toEqual(expect.arrayContaining(["match.payTo", "match.asset", "match.amount"]));
    expect(r.findings.find((f) => f.id === "payload.kind")!.reason).toMatch(/not verified/);
    expect(step(r, "signed").state).toBe("unverified");
  });
  it("wrong recipient, wrong token, underpaying and expiry are errors", () => {
    expect(ids(run(p2({}, { to: "0x" + "ee".repeat(20) })), "error")).toContain("match.payTo");
    expect(ids(run(p2({}, {}, { token: "0x" + "ee".repeat(20) })), "error")).toContain("match.asset");
    expect(ids(run(p2({}, {}, { amount: "999" })), "error")).toContain("match.amount");
    expect(ids(run(p2({ deadline: String(NOW_SEC - 1) })), "error")).toContain("payload.validBefore");
  });
  it("upto: a higher maximum is a note, not an error; a lower one is a warning", () => {
    expect(ids(run(p2({}, {}, { amount: "5000" }), "upto"), "error")).toEqual([]);
    expect(run(p2({}, {}, { amount: "5000" }), "upto").findings.find((f) => f.id === "match.amount")!.severity).toBe("info");
    expect(run(p2({}, {}, { amount: "10" }), "upto").findings.find((f) => f.id === "match.amount")!.severity).toBe("warning");
  });
  it("upto: shows the facilitator binding, and never claims the scheme is verified", () => {
    const fac = "0x" + "fa".repeat(20);
    const withFac = run(p2({}, { facilitator: fac }), "upto");
    expect(withFac.findings.find((f) => f.id === "payload.facilitator")).toMatchObject({ severity: "info", evidence: `facilitator: ${fac}` });
    const without = run(p2(), "upto").findings.find((f) => f.id === "payload.facilitator")!;
    expect(without.severity).toBe("info");
    expect(without.reason).toMatch(/has not checked the upto scheme against its specification/);
    expect(ids(run(p2({}, { facilitator: "junk" }), "upto"), "error")).toEqual([]);
    expect(run(p2(), "exact").findings.some((f) => f.id === "payload.facilitator")).toBe(false);
    expect(run(p2({}, {}, { amount: "5000" }), "upto").findings.find((f) => f.id === "match.amount")!.reason).toMatch(/could not confirm/);
  });
  it("rejects malformed Permit2 fields", () => {
    const r = run(p2({ from: "nope", nonce: "abc", deadline: undefined }));
    expect(ids(r, "error")).toEqual(expect.arrayContaining(["payload.from", "payload.nonce", "payload.validBefore"]));
  });
});

describe("the inspector never leaves the browser", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  for (const file of ["app/components/InspectorClient.tsx", "lib/verify/inspector.ts", "lib/verify/b64.ts", "lib/verify/signature.ts"]) {
    it(`${file} has no network, storage or logging calls`, () => {
      const src = read(file).replace(/\/\/.*$/gm, "");
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
      expect(src).not.toMatch(/console\./);
    });
  }
  it("lib/verify/inspector.ts imports nothing that can reach the network", () => {
    const imports = [...read("lib/verify/inspector.ts").matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./b64", "./checks", "./signature", "./types", "@/lib/arcConfig"].sort());
  });
});
