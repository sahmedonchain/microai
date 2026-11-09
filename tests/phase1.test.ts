import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake) and next/headers (session cookie). No network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { POST as verifyPost } from "@/app/api/verify/route";
import { isCrossSiteRequest } from "@/lib/csrf";
import { isPaused } from "@/lib/killSwitch";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://microai.example/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  redis = makeFakeRedis();
  delete process.env.PAUSE_AI;
  delete process.env.PAUSE_VERIFY;
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});

describe("kill switch", () => {
  it("isPaused reads 1/true only", () => {
    expect(isPaused("ai", { PAUSE_AI: "1" })).toBe(true);
    expect(isPaused("ai", { PAUSE_AI: "TRUE" })).toBe(true);
    expect(isPaused("ai", { PAUSE_AI: "0" })).toBe(false);
    expect(isPaused("ai", {})).toBe(false);
    expect(isPaused("verify", { PAUSE_AI: "1" })).toBe(false);
  });

  it("PAUSE_VERIFY stops the Verify checker before it fetches anything", async () => {
    process.env.PAUSE_VERIFY = "1";
    const res = await verifyPost(post({ url: "https://example.com/paid" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("paused");
  });
});

describe("cross-site write guard", () => {
  const r = (method: string, headers: Record<string, string>) => new Request("https://microai.example/api/x", { method, headers });

  it("allows same-origin, no-header and safe-method requests", () => {
    expect(isCrossSiteRequest(r("POST", { origin: "https://microai.example" }))).toBe(false);
    expect(isCrossSiteRequest(r("POST", {}))).toBe(false);
    expect(isCrossSiteRequest(r("POST", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteRequest(r("GET", { origin: "https://evil.example" }))).toBe(false);
  });

  it("blocks a foreign or null Origin and a cross-site fetch", () => {
    expect(isCrossSiteRequest(r("POST", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "https://microai.example.evil.com" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "null" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "not a url" }))).toBe(true);
    expect(isCrossSiteRequest(r("DELETE", { "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("a routed POST from another site gets 403 and runs nothing", async () => {
    const res = await verifyPost(post({ url: "https://example.com/paid" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
  });
});
