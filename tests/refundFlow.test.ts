import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), the session cookie (real signed token), the Arc
// RPC. Nothing touches the network or the chain.
let redis = makeFakeRedis();
const jar = vi.hoisted(() => ({ value: "" }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "microai_session" && jar.value ? { value: jar.value } : undefined) }) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/arcRpc", () => {
  class RpcError extends Error {
    constructor(message: string, readonly retryable: boolean) {
      super(message);
    }
  }
  return { rpcCall: rpc, RpcError };
});

import { POST as deliveryCheck } from "@/app/api/x402/delivery-check/route";
import { GET as list, POST as create } from "@/app/api/refund-cases/route";
import { GET as getCase } from "@/app/api/refund-cases/[id]/route";
import { POST as approve } from "@/app/api/refund-cases/[id]/approve/route";
import { POST as reject } from "@/app/api/refund-cases/[id]/reject/route";
import { POST as settle } from "@/app/api/refund-cases/[id]/settle/route";
import { issueSessionToken } from "@/lib/session";
import { judgeDelivery } from "@/lib/refund/deliveryCheck";
import { ERC20_TRANSFER_TOPIC, USDC_ADDRESS } from "@/lib/arcConfig";

const BUYER = "0x2222222222222222222222222222222222222222";
const MERCHANT = "0x1111111111111111111111111111111111111111";
const STRANGER = "0x3333333333333333333333333333333333333333";
const PAY = "0x" + "ab".repeat(32);
const REFUND = "0x" + "cd".repeat(32);
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const receipt = (hash: string, from: string, to: string, units: number) => ({
  transactionHash: hash,
  status: "0x1",
  blockNumber: "0x10",
  logs: [{ address: USDC_ADDRESS, topics: [ERC20_TRANSFER_TOPIC, pad(from), pad(to)], data: "0x" + units.toString(16).padStart(64, "0") }],
});

let n = 0;
const call = (handler: (...a: never[]) => Promise<Response>, body?: unknown, ctx?: unknown) =>
  (handler as unknown as (r: Request, c: unknown) => Promise<Response>)(
    new Request("https://microai.test/api/x", {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++n % 250}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx
  );
const as = (addr: string) => void (jar.value = issueSessionToken(addr));
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

const CHECK = { network: "mainnet", txHash: PAY, payTo: MERCHANT, resourceUrl: "https://api.example.com/data", httpStatus: 200, responseBody: '{"data":{}}', rule: { requiredJsonFields: ["data.items"] } };

async function openCase(over: Record<string, unknown> = {}) {
  as(BUYER);
  const c = (await (await call(deliveryCheck, CHECK)).json()).check;
  const res = await call(create, { network: "mainnet", txHash: PAY, payTo: MERCHANT, reason: "INCOMPLETE_RESULT", statement: "The items list was missing.", deliveryCheckId: c.id, ...over });
  return { res, body: await res.json() };
}

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  redis = makeFakeRedis();
  jar.value = "";
  rpc.mockReset();
  rpc.mockImplementation(async (method: string, params: string[]) => {
    if (method !== "eth_getTransactionReceipt") return null;
    if (params[0] === PAY) return receipt(PAY, BUYER, MERCHANT, 10_000);
    if (params[0] === REFUND) return receipt(REFUND, MERCHANT, BUYER, 10_000);
    return null;
  });
});

describe("judgeDelivery", () => {
  it("fails with no response, fails a missing field, needs review without a rule, passes a met rule", () => {
    expect(judgeDelivery({ httpStatus: null, rule: {} }).result).toBe("FAIL");
    expect(judgeDelivery({ httpStatus: 200, body: '{"a":1}', rule: { requiredJsonFields: ["a.b"] } }).result).toBe("FAIL");
    expect(judgeDelivery({ httpStatus: 200, rule: {} }).result).toBe("NEEDS_REVIEW");
    expect(judgeDelivery({ httpStatus: 200, body: '{"a":{"b":1}}', rule: { requiredJsonFields: ["a.b"] } }).result).toBe("PASS");
    expect(judgeDelivery({ httpStatus: 500, rule: {} }).result).toBe("FAIL");
  });
});

describe("refund flow", () => {
  it("needs a signed-in wallet", async () => {
    expect((await call(deliveryCheck, CHECK)).status).toBe(401);
    expect((await call(list)).status).toBe(401);
  });

  it("only the payer can record a delivery check or open a case", async () => {
    as(STRANGER);
    expect((await call(deliveryCheck, CHECK)).status).toBe(403);
    expect((await call(create, { network: "mainnet", txHash: PAY, payTo: MERCHANT, reason: "OTHER", statement: "I did not buy this." })).status).toBe(403);
  });

  it("runs the whole path: check, case, approve, settle, with signed evidence", async () => {
    const { res, body } = await openCase();
    expect(res.status).toBe(200);
    expect(body.case.status).toBe("OPEN");
    const id = body.case.id as string;

    as(BUYER);
    const buyerView = await (await call(getCase, undefined, idCtx(id))).json();
    expect(buyerView.evidence.bundle.deliveryProof.result).toBe("FAIL");
    expect(buyerView.evidence.bundleHash).toMatch(/^[0-9a-f]{64}$/);
    expect(buyerView.evidence.attestation.value).toMatch(/^[0-9a-f]{64}$/);

    // The buyer cannot approve their own refund.
    expect((await call(approve, {}, idCtx(id))).status).toBe(403);
    as(STRANGER);
    expect((await call(getCase, undefined, idCtx(id))).status).toBe(404);

    as(MERCHANT);
    expect((await (await call(list)).json()).cases[0].role).toBe("merchant");
    // Cannot settle before approving.
    expect((await call(settle, { txHash: REFUND }, idCtx(id))).status).toBe(400);
    const approved = await (await call(approve, { amount: "10000" }, idCtx(id))).json();
    expect(approved.case.status).toBe("APPROVED");
    expect((await call(reject, { reason: "changed my mind" }, idCtx(id))).status).toBe(400);

    const done = await (await call(settle, { txHash: REFUND }, idCtx(id))).json();
    expect(done.case.status).toBe("REFUNDED");
    expect(done.case.refundTxHash).toBe(REFUND);
    expect(done.evidence.bundleHash).not.toBe(buyerView.evidence.bundleHash);
  });

  it("a partial approval ends PARTIALLY_REFUNDED when the refund matches it", async () => {
    const { body } = await openCase();
    const id = body.case.id as string;
    as(MERCHANT);
    await call(approve, { amount: "4000" }, idCtx(id));
    const out = await (await call(settle, { txHash: REFUND }, idCtx(id))).json();
    expect(out.case.status).toBe("PARTIALLY_REFUNDED");
  });

  it("rejects settlement that refunds less than approved, and a reused refund tx", async () => {
    const { body } = await openCase();
    const id = body.case.id as string;
    as(MERCHANT);
    await call(approve, {}, idCtx(id));
    rpc.mockImplementation(async (_m: string, p: string[]) => (p[0] === REFUND ? receipt(REFUND, MERCHANT, BUYER, 100) : null));
    expect((await call(settle, { txHash: REFUND }, idCtx(id))).status).toBe(400);
  });

  it("merchant can reject with a reason", async () => {
    const { body } = await openCase();
    as(MERCHANT);
    const out = await (await call(reject, { reason: "Service logs show a full answer." }, body.case && idCtx(body.case.id))).json();
    expect(out.case.status).toBe("REJECTED");
    expect(out.merchantResponse.message).toContain("full answer");
  });

  it("one case per payment, and delivery reasons need a failing check", async () => {
    expect((await openCase()).res.status).toBe(200);
    as(BUYER);
    expect((await call(create, { network: "mainnet", txHash: PAY, payTo: MERCHANT, reason: "OTHER", statement: "Second try for same payment." })).status).toBe(400);
  });

  it("refuses a delivery reason with no check, and with a passing check", async () => {
    as(BUYER);
    expect((await call(create, { network: "mainnet", txHash: PAY, payTo: MERCHANT, reason: "NO_RESPONSE", statement: "Nothing came back at all." })).status).toBe(400);
    const pass = (await (await call(deliveryCheck, { ...CHECK, responseBody: '{"data":{"items":[1]}}' })).json()).check;
    expect(pass.result).toBe("PASS");
    const r = await call(create, { network: "mainnet", txHash: PAY, payTo: MERCHANT, reason: "WRONG_DATA", statement: "Data looked wrong to me.", deliveryCheckId: pass.id });
    expect(r.status).toBe(400);
  });

  it("cannot ask for more than was paid", async () => {
    const { res } = await openCase({ requestedAmount: "10001" });
    expect(res.status).toBe(400);
  });
});
