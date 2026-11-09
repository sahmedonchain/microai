import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (no session) and the outbound
// endpoint fetch. Nothing here touches the network or the chain.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/verify/fetchEndpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verify/fetchEndpoint")>()),
  fetchChallenge: fetchMock,
}));

import { GET } from "@/app/api/trust/route";
import { SafeFetchError } from "@/lib/safeFetch";
import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";

const lab = (id: string) => {
  const a = buildLabAnswer(findLabCase(id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
};
const get = (qs: string, ip = "198.51.100.40") => GET(new Request(`https://microai.example/api/trust?${qs}`, { headers: { "x-forwarded-for": ip } }));
const q = (url: string, extra = "") => `url=${encodeURIComponent(url)}${extra}`;

beforeEach(() => {
  redis = makeFakeRedis();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(lab("good"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.PAUSE_VERIFY;
  vi.useRealTimers();
});

describe("GET /api/trust", () => {
  it("answers a stable, machine-readable summary", async () => {
    const res = await get(q("https://svc.example/api"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(json).toMatchObject({ version: 1, result: "pass", cached: false, endpoint: { host: "svc.example", httpStatus: 402 } });
    expect(json.disclaimer).toMatch(/not a guarantee of safety/);
  });

  it("reports a bad setup as fail with the issues", async () => {
    fetchMock.mockResolvedValue(lab("decimals18"));
    const json = await (await get(q("https://svc.example/bad"))).json();
    expect(json.result).toBe("fail");
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("fetches with the URL only: no payment, no body, no extra input", async () => {
    await get(q("https://svc.example/api", "&network=mainnet"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(["https://svc.example/api"]);
  });

  it("serves a repeat from the cache and does not fetch the target again", async () => {
    await get(q("https://svc.example/api"));
    const again = await (await get(q("https://svc.example/api"), "198.51.100.41")).json();
    expect(again.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches per network, so a different expectation is checked fresh", async () => {
    await get(q("https://svc.example/api", "&network=mainnet"));
    await get(q("https://svc.example/api", "&network=testnet"), "198.51.100.42");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the cache lasts a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T10:00:00Z"));
    await get(q("https://svc.example/api"));
    vi.setSystemTime(new Date("2026-11-09T10:01:30Z"));
    const json = await (await get(q("https://svc.example/api"), "198.51.100.43")).json();
    expect(json.cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still answers when the cache is broken", async () => {
    vi.spyOn(redis, "get").mockRejectedValueOnce(new Error("boom"));
    const res = await get(q("https://svc.example/api"));
    expect(res.status).toBe(200);
  });

  it("protects the target host: at most 30 fetches an hour, however many callers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T10:00:00Z"));
    let last = 200;
    for (let i = 0; i < 32; i++) {
      // A different path each time so the cache does not answer; a different IP so the per-caller limit does not.
      last = (await get(q(`https://victim.example/p${i}`), `203.0.113.${i + 1}`)).status;
    }
    expect(last).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(30);
  });

  it("does not spend the host budget on cache hits", async () => {
    for (let i = 0; i < 6; i++) await get(q("https://same.example/api"), `203.0.113.${100 + i}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("limits each caller to 5 a minute", async () => {
    let last = 200;
    for (let i = 0; i < 6; i++) last = (await get(q(`https://svc${i}.example/api`), "198.51.100.99")).status;
    expect(last).toBe(429);
  });

  it("answers 400 for URLs that cannot be checked, without fetching", async () => {
    for (const bad of ["http://svc.example/api", "ftp://svc.example", "not a url", "https://", "javascript:alert(1)"]) {
      const res = await get(q(bad), `198.51.100.${Math.floor(Math.random() * 200) + 1}`);
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 when the fetch guard refuses the destination (private address)", async () => {
    fetchMock.mockRejectedValue(new SafeFetchError("blocked_address"));
    const res = await get(q("https://internal.example/api"));
    expect(res.status).toBe(400);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/127\.0\.0\.1|169\.254/);
  });

  it("returns 200 'unreachable' when the endpoint does not answer", async () => {
    fetchMock.mockRejectedValue(new SafeFetchError("timeout"));
    const res = await get(q("https://slow.example/api"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBe("unreachable");
    expect(json.arcNetworks).toEqual([]);
  });

  it("rejects an invalid network", async () => {
    expect((await get(q("https://svc.example/api", "&network=solana"))).status).toBe(400);
  });

  it("is blocked by the Verify pause switch", async () => {
    process.env.PAUSE_VERIFY = "1";
    expect((await get(q("https://svc.example/api"))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes nothing but the short-lived cache entry", async () => {
    const set = vi.spyOn(redis, "set");
    await get(q("https://svc.example/api"));
    const keys = set.mock.calls.map((c) => String(c[0]));
    expect(keys.every((k) => k.startsWith("microai:trust:"))).toBe(true);
    expect(set.mock.calls.every((c) => (c[2] as { ex?: number } | undefined)?.ex === 60)).toBe(true);
  });
});
