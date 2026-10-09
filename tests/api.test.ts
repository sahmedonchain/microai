import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// MOCKS: next/headers cookies and the rate limiter are stubbed; the session token is real.
const cookieJar: { value?: string } = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "microai_session" && cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));
const consume = vi.fn();
vi.mock("@/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("@/lib/rateLimit")>()), consume: (...a: unknown[]) => consume(...a) }));

import { withApi, parseJson, apiErrors } from "@/lib/api";
import { issueSessionToken } from "@/lib/session";

const post = (body: unknown) => new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  cookieJar.value = undefined;
  consume.mockReset();
  consume.mockResolvedValue({ ok: true, retryAfterSec: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("withApi", () => {
  it("returns 401 session_required in the typed error format", async () => {
    const res = await withApi({ name: "t", auth: "required" }, async () => ({ ok: true }))(post({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: "session_required", code: "session_required" });
    expect(typeof body.requestId).toBe("string");
    expect(res.headers.get("x-request-id")).toBe(body.requestId);
  });

  it("passes the wallet from a valid session and serialises the result", async () => {
    cookieJar.value = issueSessionToken("0xAbC0000000000000000000000000000000000001");
    const res = await withApi({ name: "t", auth: "required" }, async ({ session }) => ({ wallet: session!.sub }))(post({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wallet: "0xabc0000000000000000000000000000000000001" });
  });

  it("answers 429 with Retry-After when a limit is exceeded", async () => {
    consume.mockResolvedValue({ ok: false, retryAfterSec: 17 });
    const handler = vi.fn();
    const res = await withApi({ name: "t", limits: [{ limit: 1, windowSec: 60 }] }, handler)(post({}));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("17");
    expect((await res.json()).code).toBe("rate_limited");
    expect(handler).not.toHaveBeenCalled();
  });

  it("keys limits by wallet when a session exists, otherwise by IP", async () => {
    cookieJar.value = issueSessionToken("0x0000000000000000000000000000000000000002");
    await withApi({ name: "t", auth: "optional", limits: [{ limit: 5, windowSec: 60 }] }, async () => ({}))(post({}));
    expect(consume.mock.calls[0][0]).toContain("w:0x0000000000000000000000000000000000000002");
    cookieJar.value = undefined;
    const req = new Request("http://localhost/api/x", { method: "POST", headers: { "x-forwarded-for": "203.0.113.9" }, body: "{}" });
    await withApi({ name: "t", auth: "optional", limits: [{ limit: 5, windowSec: 60 }] }, async () => ({}))(req);
    expect(consume.mock.calls[1][0]).toContain("ip:203.0.113.9");
  });

  it("uses one shared key for global limits", async () => {
    await withApi({ name: "t", limits: [{ limit: 9, windowSec: 60, scope: "global" }] }, async () => ({}))(post({}));
    expect(consume.mock.calls[0][0]).toBe("t:global:0");
  });

  it("turns zod failures into a 400 invalid_request", async () => {
    const schema = z.object({ n: z.number().int() });
    const res = await withApi({ name: "t" }, async ({ req }) => parseJson(req, schema))(post({ n: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_request");
  });

  it("rejects non-JSON bodies with 400", async () => {
    const res = await withApi({ name: "t" }, async ({ req }) => parseJson(req, z.object({})))(new Request("http://localhost/x", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });

  it("hides unexpected error details behind a 500", async () => {
    const res = await withApi({ name: "t" }, async () => { throw new Error("db password is hunter2"); })(post({}));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("hunter2");
    expect(text).toContain("internal");
  });

  it("reports a missing SESSION_SECRET as 500, not as a client error", async () => {
    delete process.env.SESSION_SECRET;
    cookieJar.value = "a.b.c";
    const res = await withApi({ name: "t", auth: "required" }, async () => ({}))(post({}));
    expect(res.status).toBe(500);
  });

  it("supports custom typed errors", async () => {
    const res = await withApi({ name: "t" }, async () => { throw apiErrors.noCredits(); })(post({}));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "no_credits", code: "no_credits" });
  });
});
