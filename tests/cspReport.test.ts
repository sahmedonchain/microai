import { describe, it, expect, vi, beforeEach } from "vitest";

// MOCK: the rate limiter is stubbed; no Redis.
const consume = vi.fn();
vi.mock("@/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("@/lib/rateLimit")>()), consume: (...a: unknown[]) => consume(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { POST, summarizeReport } from "@/app/api/csp-report/route";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://example.com/api/csp-report", { method: "POST", headers: { "content-type": "application/csp-report", "x-forwarded-for": "203.0.113.5", ...headers }, body });

const report = { "csp-report": { "document-uri": "https://example.com/news?token=secret#x", "violated-directive": "script-src-elem", "blocked-uri": "https://evil.example/x.js?k=1", disposition: "report", "line-number": 7 } };

beforeEach(() => {
  consume.mockReset();
  consume.mockResolvedValue({ ok: true, retryAfterSec: 0, remaining: 5 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("POST /api/csp-report", () => {
  it("accepts a legacy report with 204", async () => {
    const res = await POST(post(JSON.stringify(report)));
    expect(res.status).toBe(204);
  });

  it("accepts a Reporting API array", async () => {
    const body = [{ type: "csp-violation", body: { documentURL: "https://example.com/", effectiveDirective: "img-src", blockedURL: "inline" } }];
    expect((await POST(post(JSON.stringify(body), { "content-type": "application/reports+json" }))).status).toBe(204);
  });

  it("rejects a body over the 8 KB cap with 413 (declared and streamed)", async () => {
    const big = JSON.stringify({ "csp-report": { "violated-directive": "x", pad: "a".repeat(20_000) } });
    expect((await POST(post(big))).status).toBe(413);
    const noLength = new Request("https://example.com/api/csp-report", {
      method: "POST",
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("a".repeat(5000))); c.enqueue(new TextEncoder().encode("a".repeat(5000))); c.close(); } }),
      // @ts-expect-error duplex is required for streamed request bodies in Node
      duplex: "half",
    });
    expect((await POST(noLength)).status).toBe(413);
  });

  it.each(["not json", "{}", "[]", '"str"', "null", '{"csp-report":{}}'])("rejects invalid report %j with 400", async (b) => {
    expect((await POST(post(b))).status).toBe(400);
  });

  it("is rate limited per IP: 429 with Retry-After", async () => {
    consume.mockResolvedValue({ ok: false, retryAfterSec: 12 });
    const res = await POST(post(JSON.stringify(report)));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(consume.mock.calls[0][0]).toBe("csp-report:ip:203.0.113.5:0");
  });

  it("has a global daily cap and fails open when the limiter is down", async () => {
    await POST(post(JSON.stringify(report)));
    expect(consume.mock.calls.map((c) => c[0])).toContain("csp-report:global:1");
    expect(consume.mock.calls[0][3]).toEqual({ failClosed: false });
  });
});

describe("summarizeReport", () => {
  it("strips query strings and fragments and truncates", () => {
    const s = summarizeReport(report)!;
    expect(s.document).toBe("https://example.com/news");
    expect(s.blocked).toBe("https://evil.example/x.js");
    expect(JSON.stringify(s)).not.toMatch(/secret|k=1/);
    expect(s.directive).toBe("script-src-elem");
  });
  it("truncates long fields", () => {
    const s = summarizeReport({ "csp-report": { "violated-directive": "d".repeat(500), "blocked-uri": "x".repeat(900) } })!;
    expect((s.directive as string).length).toBeLessThanOrEqual(100);
    expect((s.blocked as string).length).toBeLessThanOrEqual(40);
  });
});
