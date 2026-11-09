import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (no session), the Arc RPC and
// the outbound endpoint fetch. Nothing here touches the network or the chain.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchMock, rpc } = vi.hoisted(() => ({ fetchMock: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/verify/fetchEndpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verify/fetchEndpoint")>()),
  fetchChallenge: fetchMock,
}));
vi.mock("@/lib/arcRpc", () => {
  class RpcError extends Error {
    constructor(message: string, readonly retryable: boolean) {
      super(message);
    }
  }
  return { rpcCall: rpc, RpcError };
});

import { POST } from "@/app/api/verify/route";
import { ERC20_TRANSFER_TOPIC, USDC_ADDRESS } from "@/lib/arcConfig";

const HASH = "0x" + "ab".repeat(32);
const PAYEE = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const transfer = (to: string, value: string) => ({
  address: USDC_ADDRESS,
  topics: [ERC20_TRANSFER_TOPIC, pad(PAYER), pad(to)],
  data: "0x" + BigInt(value).toString(16).padStart(64, "0"),
});
const goodReceipt = (value = "10000") => ({ transactionHash: HASH, status: "0x1", blockNumber: "0x10", logs: [transfer(PAYEE, value)] });
const EXPECT = { payTo: PAYEE, amount: "10000" };

const post = (body: unknown, ip = "198.51.100.7") =>
  new Request("https://microai.example/api/verify", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

beforeEach(() => {
  redis = makeFakeRedis();
  fetchMock.mockReset();
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.PAUSE_VERIFY;
});

describe("/api/verify delivery verdict", () => {
  it("delivered: matching payment and the service answered 200", async () => {
    rpc.mockResolvedValue(goodReceipt());
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 200 } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.delivery.status).toBe("delivered");
  });

  it("unknown: matching payment but no service answer given", async () => {
    rpc.mockResolvedValue(goodReceipt());
    const json = await (await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT }))).json();
    expect(json.delivery.status).toBe("unknown");
  });

  it("mismatch: paid but the service answered 503", async () => {
    rpc.mockResolvedValue(goodReceipt());
    const json = await (await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 503 } }))).json();
    expect(json.delivery.status).toBe("mismatch");
  });

  it("mismatch: paid too little, even though the service answered 200", async () => {
    rpc.mockResolvedValue(goodReceipt("5000"));
    const json = await (await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 200 } }))).json();
    expect(json.delivery.status).toBe("mismatch");
  });

  it("failed: the transaction reverted", async () => {
    rpc.mockResolvedValue({ transactionHash: HASH, status: "0x0", blockNumber: "0x10", logs: [] });
    const json = await (await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 200 } }))).json();
    expect(json.delivery.status).toBe("failed");
  });

  it("pending: the receipt is not there yet", async () => {
    rpc.mockResolvedValue(null);
    const json = await (await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT }))).json();
    expect(json.delivery.status).toBe("pending");
  });

  it("no delivery verdict when there is no transaction", async () => {
    fetchMock.mockResolvedValue({ status: 503, headers: {}, body: "" });
    const json = await (await POST(post({ url: "https://example.com/x" }))).json();
    expect(json.delivery).toBeUndefined();
  });

  it("rejects delivery without a transaction hash", async () => {
    const res = await POST(post({ url: "https://example.com/x", delivery: { httpStatus: 200 } }));
    expect(res.status).toBe(400);
  });

  it.each([99, 600, 200.5, "200", -1])("rejects a bad HTTP status %s", async (httpStatus) => {
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus } }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an oversized PAYMENT-RESPONSE before any chain call", async () => {
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 200, paymentResponse: "A".repeat(4097) } }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends no payment: only the receipt read is made", async () => {
    rpc.mockResolvedValue(goodReceipt());
    await POST(post({ txHash: HASH, network: "mainnet", expect: EXPECT, delivery: { httpStatus: 200 } }));
    expect(rpc.mock.calls.every((c) => c[0] === "eth_getTransactionReceipt")).toBe(true);
  });
});
