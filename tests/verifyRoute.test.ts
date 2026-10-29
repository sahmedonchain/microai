import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (no session) and the outbound
// fetch. Nothing here touches the network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/verify/fetchEndpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verify/fetchEndpoint")>()),
  fetchChallenge: fetchMock,
}));

import { POST } from "@/app/api/verify/route";
import { SafeFetchError } from "@/lib/safeFetch";
import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";

const post = (body: unknown, ip = "198.51.100.1") =>
  new Request("https://microai.example/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const lab = (id: string) => {
  const a = buildLabAnswer(findLabCase(id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
};

beforeEach(() => {
  redis = makeFakeRedis();
  fetchMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.PAUSE_VERIFY;
});

describe("/api/verify", () => {
  it("checks an endpoint and returns the report, the final status and no raw body", async () => {
    fetchMock.mockResolvedValue(lab("decimals18"));
    const res = await POST(post({ url: "https://api.example.com/paid" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.httpStatus).toBe(402);
    expect(json.report.counts.error).toBeGreaterThan(0);
    expect(JSON.stringify(json)).not.toContain("this-is-not-base64");
    expect(json.body).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/paid");
  });

  it("passes the expected network on to the checks", async () => {
    fetchMock.mockResolvedValue(lab("good"));
    const res = await POST(post({ url: "https://api.example.com/paid", network: "mainnet" }));
    const json = await res.json();
    expect(json.report.expectedNetwork).toBe("mainnet");
    expect(json.report.findings.some((f: { id: string; severity: string }) => f.id === "network" && f.severity === "error")).toBe(true);
  });

  it("rejects a bad body without fetching anything", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ url: "x" }))).status).toBe(400);
    expect((await POST(post({ url: "https://a.example/p", network: "solana" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 with a plain message when the URL may not be checked, without echoing it", async () => {
    fetchMock.mockRejectedValue(new SafeFetchError("blocked_address", "10.0.0.5"));
    const res = await POST(post({ url: "https://internal.example/paid" }));
    expect(res.status).toBe(400);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("cannot be checked");
    expect(text).not.toContain("10.0.0.5");
  });

  it("answers 502 when the endpoint cannot be reached in time", async () => {
    fetchMock.mockRejectedValue(new SafeFetchError("timeout"));
    const res = await POST(post({ url: "https://slow.example/paid" }));
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("upstream_unavailable");
  });

  it("is stopped by PAUSE_VERIFY before any fetch", async () => {
    process.env.PAUSE_VERIFY = "1";
    const res = await POST(post({ url: "https://api.example.com/paid" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("paused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows 5 checks a minute per caller, then 429", async () => {
    fetchMock.mockResolvedValue(lab("good"));
    for (let i = 0; i < 5; i++) expect((await POST(post({ url: "https://api.example.com/paid" }))).status).toBe(200);
    expect((await POST(post({ url: "https://api.example.com/paid" }))).status).toBe(429);
    expect((await POST(post({ url: "https://api.example.com/paid" }, "198.51.100.2"))).status).toBe(200);
  });

  it("fails closed when Redis is down", async () => {
    fetchMock.mockResolvedValue(lab("good"));
    redis = { ...makeFakeRedis(), eval: async () => { throw new Error("redis down"); }, evalsha: async () => { throw new Error("redis down"); } } as unknown as typeof redis;
    const res = await POST(post({ url: "https://api.example.com/paid" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("rate_limiter_unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
