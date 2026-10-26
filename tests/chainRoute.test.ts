import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (no session) and the Arc RPC client. No network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/arcRpc", async () => {
  class RpcError extends Error {
    constructor(message: string, readonly retryable: boolean) {
      super(message);
    }
  }
  return { rpcCall: rpc, RpcError };
});

import { GET } from "@/app/api/chain/route";
import { RpcError } from "@/lib/arcRpc";
import { PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";

const get = (qs: string, ip = "198.51.100.1") => new Request(`https://microai.example/api/chain?${qs}`, { headers: { "x-forwarded-for": ip } });
const ADDR = "0x1111111111111111111111111111111111111111";

beforeEach(() => {
  redis = makeFakeRedis();
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("/api/chain", () => {
  it("network: returns block, gas price and chain id", async () => {
    rpc.mockImplementation(async (m: string) => ({ eth_blockNumber: "0x10", eth_gasPrice: "0x5", eth_chainId: "0x13b2" })[m]);
    const res = await GET(get("kind=network"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blockHex: "0x10", gasPriceHex: "0x5", chainIdHex: "0x13b2" });
  });

  it("revenue: reads the USDC balance of the payment receiver only", async () => {
    rpc.mockResolvedValue("0x2710");
    const res = await GET(get("kind=revenue"));
    expect(await res.json()).toEqual({ usdcHex: "0x2710" });
    const [method, params] = rpc.mock.calls[0];
    expect(method).toBe("eth_call");
    expect(params[0].to).toBe(USDC_ADDRESS);
    expect(params[0].data).toBe("0x70a08231" + PAYMENT_RECEIVER.slice(2).toLowerCase().padStart(64, "0"));
  });

  it("balance: returns USDC, EURC and native balance for a valid address", async () => {
    rpc.mockResolvedValue("0x1");
    const res = await GET(get(`kind=balance&address=${ADDR}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ usdcHex: "0x1", eurcHex: "0x1", nativeHex: "0x1" });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("rejects unknown kinds and bad addresses without touching RPC", async () => {
    expect((await GET(get("kind=eth_sendRawTransaction"))).status).toBe(400);
    expect((await GET(get("kind=balance"))).status).toBe(400);
    expect((await GET(get("kind=balance&address=0x123"))).status).toBe(400);
    expect((await GET(get(""))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 502 upstream_unavailable when Arc RPC fails", async () => {
    rpc.mockRejectedValue(new RpcError("RPC HTTP 503", true));
    const res = await GET(get("kind=network"));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("upstream_unavailable");
  });

  it("allows 90 per minute per caller, then 429", async () => {
    rpc.mockResolvedValue("0x1");
    for (let i = 0; i < 90; i++) expect((await GET(get("kind=revenue"))).status).toBe(200);
    expect((await GET(get("kind=revenue"))).status).toBe(429);
    expect((await GET(get("kind=revenue", "198.51.100.2"))).status).toBe(200);
  });
});
