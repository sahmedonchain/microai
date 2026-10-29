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
import { RpcError } from "@/lib/arcRpc";
import { ERC20_TRANSFER_TOPIC, USDC_ADDRESS } from "@/lib/arcConfig";
import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";

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

const post = (body: unknown, ip = "198.51.100.1") =>
  new Request("https://microai.example/api/verify", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

const lab = (id: string) => {
  const a = buildLabAnswer(findLabCase(id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
};

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

describe("/api/verify with a transaction", () => {
  it("checks a transaction against expect, with no endpoint fetched", async () => {
    rpc.mockResolvedValue(goodReceipt());
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "10000" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.report).toBeUndefined();
    expect(json.transaction.counts.error).toBe(0);
    expect(json.transaction.explorerUrl).toBe(`https://explorer.arc.io/tx/${HASH}`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("eth_getTransactionReceipt", [HASH], { url: "https://rpc.mainnet.arc.io" });
  });

  it("takes the expected payment and the network from the endpoint's own answer", async () => {
    fetchMock.mockResolvedValue(lab("good"));
    rpc.mockResolvedValue(goodReceipt());
    const res = await POST(post({ url: "https://api.example.com/paid", txHash: HASH }));
    const json = await res.json();
    expect(json.report.counts.error).toBe(0);
    expect(json.transaction.network).toBe("testnet");
    expect(json.transaction.counts.error).toBe(0);
    expect(rpc).toHaveBeenCalledWith("eth_getTransactionReceipt", [HASH], { url: "https://rpc.testnet.arc.io" });
  });

  it("reports an underpayment as an error", async () => {
    rpc.mockResolvedValue(goodReceipt("5000"));
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "10000" } }));
    const json = await res.json();
    expect(json.transaction.counts.error).toBe(1);
    expect(json.transaction.findings[0].id).toBe("tx.amount");
  });

  it("does not compare a Circle Gateway batched payment, and says why", async () => {
    const batched = lab("good");
    const payload = JSON.parse(batched.body);
    payload.accepts[0].extra = { name: "GatewayWalletBatched", version: "1" };
    const body = JSON.stringify(payload);
    fetchMock.mockResolvedValue({ status: 402, headers: { "payment-required": Buffer.from(body).toString("base64") }, body });
    const res = await POST(post({ url: "https://api.example.com/paid", txHash: HASH }));
    const json = await res.json();
    expect(json.transaction.findings.map((f: { id: string }) => f.id)).toEqual(["tx.batched"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("warns when the endpoint has nothing valid to compare against", async () => {
    fetchMock.mockResolvedValue({ status: 402, headers: {}, body: "pay me" });
    const res = await POST(post({ url: "https://api.example.com/paid", txHash: HASH }));
    const json = await res.json();
    expect(json.transaction.findings[0].id).toBe("tx.expected");
    expect(json.transaction.findings[0].severity).toBe("warning");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 502 when the Arc RPC is down", async () => {
    rpc.mockRejectedValue(new RpcError("RPC HTTP 503", true));
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "10000" } }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("upstream_unavailable");
  });

  it("is also stopped by PAUSE_VERIFY", async () => {
    process.env.PAUSE_VERIFY = "1";
    const res = await POST(post({ txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "10000" } }));
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("/api/verify request rules", () => {
  it.each([
    ["a hash with nothing to compare against", { txHash: HASH }],
    ["expect without a hash", { url: "https://api.example.com/paid", expect: { payTo: PAYEE, amount: "1" } }],
    ["a hash and expect but no network or url", { txHash: HASH, expect: { payTo: PAYEE, amount: "1" } }],
    ["a malformed hash", { txHash: "0x1234", network: "mainnet", expect: { payTo: PAYEE, amount: "1" } }],
    ["a decimal amount in expect", { txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "0.01" } }],
    ["an invalid recipient in expect", { txHash: HASH, network: "mainnet", expect: { payTo: "0xabc", amount: "1" } }],
  ])("rejects %s before any network call", async (_name, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
