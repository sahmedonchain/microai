import { describe, it, expect, vi } from "vitest";
import { fetchChallenge, describeFetchError, VERIFY_MAX_BYTES } from "@/lib/verify/fetchEndpoint";
import { SafeFetchError, type RawRequest, type RawResponse, type SafeFetchErrorCode } from "@/lib/safeFetch";

// MOCKS: DNS and the HTTPS transport are injected through `deps`; nothing touches the network.

const enc = new TextEncoder();
async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const p of parts) yield typeof p === "string" ? enc.encode(p) : p;
}
const raw = (status: number, headers: RawResponse["headers"], body: string | Uint8Array): RawResponse => ({ status, headers, body: chunks(body), destroy: vi.fn() });

function setup(dns: Record<string, string[]>, answer: RawResponse) {
  const requests: RawRequest[] = [];
  return {
    requests,
    deps: {
      resolve: vi.fn(async (host: string) => {
        const r = dns[host];
        if (!r) throw new Error("ENOTFOUND");
        return r;
      }),
      request: vi.fn(async (req: RawRequest) => {
        requests.push(req);
        return answer;
      }),
    },
  };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(SafeFetchError);
    return (e as SafeFetchError).code;
  }
  throw new Error("expected rejection");
};

const PUBLIC = "93.184.216.34";

describe("fetchChallenge", () => {
  it("returns status, lower-cased headers and the body of a 402 answer", async () => {
    const s = setup({ "api.example.com": [PUBLIC] }, raw(402, { "PAYMENT-REQUIRED": "abc", "content-type": "application/json" }, '{"x402Version":2}'));
    const r = await fetchChallenge("https://api.example.com/paid", s.deps);
    expect(r.status).toBe(402);
    expect(r.headers["payment-required"]).toBe("abc");
    expect(r.body).toBe('{"x402Version":2}');
  });

  it("sends no cookie, no body and an identifying User-Agent", async () => {
    const s = setup({ "api.example.com": [PUBLIC] }, raw(402, {}, "{}"));
    await fetchChallenge("https://api.example.com/paid", s.deps);
    const h = s.requests[0].headers;
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain("cookie");
    expect(h["User-Agent"]).toContain("MicroAI-Verify");
  });

  it("refuses http://", async () => {
    const s = setup({}, raw(402, {}, "{}"));
    expect(await code(fetchChallenge("http://api.example.com/paid", s.deps))).toBe("not_https");
    expect(s.deps.request).not.toHaveBeenCalled();
  });

  it("refuses a host that resolves to a private address", async () => {
    const s = setup({ "evil.example": ["10.0.0.5"] }, raw(402, {}, "{}"));
    expect(await code(fetchChallenge("https://evil.example/paid", s.deps))).toBe("blocked_address");
    expect(s.deps.request).not.toHaveBeenCalled();
  });

  it("refuses an answer larger than 64 KB", async () => {
    const s = setup({ "api.example.com": [PUBLIC] }, raw(402, {}, new Uint8Array(VERIFY_MAX_BYTES + 1)));
    expect(await code(fetchChallenge("https://api.example.com/paid", s.deps))).toBe("too_large");
  });

  it("accepts an answer of exactly 64 KB", async () => {
    const s = setup({ "api.example.com": [PUBLIC] }, raw(402, {}, new Uint8Array(VERIFY_MAX_BYTES)));
    const r = await fetchChallenge("https://api.example.com/paid", s.deps);
    expect(r.body.length).toBe(VERIFY_MAX_BYTES);
  });

  it("refuses a name that does not resolve", async () => {
    const s = setup({}, raw(402, {}, "{}"));
    expect(await code(fetchChallenge("https://nope.example/paid", s.deps))).toBe("dns_failed");
  });
});

describe("describeFetchError", () => {
  const codes: SafeFetchErrorCode[] = [
    "bad_url", "not_https", "bad_port", "userinfo", "host_not_allowed", "blocked_address",
    "dns_failed", "too_many_redirects", "bad_redirect", "timeout", "too_large", "network",
  ];

  it.each(codes)("has a plain message for %s that repeats no address", (c) => {
    const p = describeFetchError(new SafeFetchError(c, "10.0.0.5 internal-detail"));
    expect(p.message.length).toBeGreaterThan(10);
    expect(p.message).not.toContain("10.0.0.5");
    expect(p.message).not.toContain("internal-detail");
    expect(["invalid", "unreachable"]).toContain(p.kind);
  });

  it("treats URL mistakes as invalid and network trouble as unreachable", () => {
    expect(describeFetchError(new SafeFetchError("not_https")).kind).toBe("invalid");
    expect(describeFetchError(new SafeFetchError("blocked_address")).kind).toBe("invalid");
    expect(describeFetchError(new SafeFetchError("timeout")).kind).toBe("unreachable");
  });
});
