import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (fake), next/headers and the Arc RPC client. No network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/arcRpc", () => ({ rpcCall: rpc, RpcError: class extends Error {} }));

import { GET } from "@/app/api/health/route";
import { resetHealthCache } from "@/lib/health";

const get = (ip = "198.51.100.90") => GET(new Request("https://microai.example/api/health", { headers: { "x-forwarded-for": ip } }));

beforeEach(() => {
  redis = makeFakeRedis();
  resetHealthCache();
  rpc.mockReset();
  rpc.mockResolvedValue("0x13b2");
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});

describe("/api/health", () => {
  it("200 when Redis and the Arc mainnet RPC answer", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", checks: { redis: "ok", arcRpc: "ok" } });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("eth_chainId", [], { timeoutMs: 3000, retries: 0 });
  });

  it("503 and names the RPC when it fails, without leaking the error", async () => {
    rpc.mockRejectedValue(new Error("secret upstream detail https://rpc.example/key"));
    const res = await get();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({ status: "degraded", checks: { redis: "ok", arcRpc: "down" } });
    expect(text).not.toMatch(/secret|rpc\.example/);
  });

  it("treats the wrong chain as down", async () => {
    rpc.mockResolvedValue("0x1");
    expect((await get()).status).toBe(503);
  });

  it("503 and still answers when Redis is down", async () => {
    redis.get = async () => {
      throw new Error("redis down");
    };
    redis.multi = () => {
      throw new Error("redis down");
    };
    const res = await get();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "degraded", checks: { redis: "down", arcRpc: "ok" } });
  });

  it("caches for 15 seconds so repeated calls make one RPC call", async () => {
    await get("198.51.100.91");
    await get("198.51.100.92");
    await get("198.51.100.93");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("is rate limited per client", async () => {
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await get("198.51.100.94")).status;
    expect(last).toBe(429);
  });

  it("reveals nothing but states", () => {
    const src = readFileSync("lib/health.ts", "utf8");
    expect(src).not.toMatch(/process\.env|\.version|err\.message|String\(err/);
  });
});
