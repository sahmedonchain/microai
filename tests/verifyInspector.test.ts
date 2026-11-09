import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { explainReason, inspectPayload } from "@/lib/verify/inspector";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const PAY_TO = "0x" + "ab".repeat(20);
const PAYER = "0x" + "cd".repeat(20);
const USDC = "0x3600000000000000000000000000000000000000";
const NOW = new Date("2026-11-10T00:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

const option = { scheme: "exact", network: "eip155:5042002", amount: "1000", asset: USDC, payTo: PAY_TO, maxTimeoutSeconds: 60, extra: { name: "USDC", version: "2" } };
const REQUIRED = b64({ x402Version: 2, accepts: [option] });

const auth = (over: Record<string, unknown> = {}) => ({
  from: PAYER, to: PAY_TO, value: "1000", validAfter: "0", validBefore: String(NOW_SEC + 600), nonce: "0x" + "11".repeat(32), ...over,
});
const sig = (a = auth(), accepted: unknown = option, signature = "0x" + "22".repeat(65)) =>
  b64({ x402Version: 2, accepted, payload: { signature, authorization: a } });

const ids = (r: ReturnType<typeof inspectPayload>, severity?: string) => r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.id);
const step = (r: ReturnType<typeof inspectPayload>, id: string) => r.lifecycle.find((s) => s.id === id)!;

describe("inspectPayload: a matching payment", () => {
  const r = inspectPayload({ paymentRequired: REQUIRED, paymentSignature: sig(), now: NOW });

  it("has no errors and says the recipient and amount match", () => {
    expect(ids(r, "error")).toEqual([]);
    expect(ids(r, "ok")).toEqual(expect.arrayContaining(["match.payTo", "match.amount", "payload.validBefore"]));
  });

  it("marks signed as not verified, never as proven", () => {
    expect(step(r, "signed").state).toBe("unverified");
    expect(r.report.notChecked.join(" ")).toMatch(/signature itself/);
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
    const r = inspectPayload({ paymentRequired: `PAYMENT-REQUIRED: ${REQUIRED}`, paymentSignature: JSON.stringify({ x402Version: 2, accepted: option, payload: { signature: "0x" + "22".repeat(65), authorization: auth() } }), now: NOW });
    expect(ids(r, "error")).toEqual([]);
  });
  it("reports junk, oversized and non-object input without throwing", () => {
    for (const bad of ["not base64 !!", b64([1, 2]), b64("x"), "A".repeat(20_000), "{broken"]) {
      const r = inspectPayload({ paymentSignature: bad, now: NOW });
      expect(ids(r, "error").length).toBeGreaterThan(0);
    }
  });
  it("does not inspect permit2 payloads, and says so", () => {
    const r = inspectPayload({ paymentSignature: b64({ x402Version: 2, payload: { permit2Authorization: { x: 1 } } }), now: NOW });
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

describe("the inspector never leaves the browser", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  for (const file of ["app/components/InspectorClient.tsx", "lib/verify/inspector.ts", "lib/verify/b64.ts"]) {
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
    expect(imports.sort()).toEqual(["./b64", "./checks", "./types", "@/lib/arcConfig"].sort());
  });
});
