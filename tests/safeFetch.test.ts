import { describe, it, expect, vi } from "vitest";
import { safeFetch, SafeFetchError, isBlockedIp, hostMatches, assertAllowedHost, readTextCapped, type RawRequest, type RawResponse } from "@/lib/safeFetch";

// MOCKS: DNS and the HTTPS transport are injected through `deps`; nothing touches the network.

const enc = new TextEncoder();
async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const p of parts) yield typeof p === "string" ? enc.encode(p) : p;
}
const ok = (body: string, headers: RawResponse["headers"] = {}): RawResponse => ({ status: 200, headers, body: chunks(body), destroy: vi.fn() });
const redirect = (location: string, status = 302): RawResponse => ({ status, headers: { location }, body: chunks(""), destroy: vi.fn() });

function setup(opts: { dns?: Record<string, string[]>; responses?: Record<string, RawResponse | (() => RawResponse)> } = {}) {
  const requests: RawRequest[] = [];
  const resolve = vi.fn(async (host: string) => {
    const r = opts.dns?.[host];
    if (!r) throw new Error("ENOTFOUND");
    return r;
  });
  const request = vi.fn(async (req: RawRequest) => {
    requests.push(req);
    const r = opts.responses?.[req.url.hostname];
    if (!r) throw new Error("no route");
    return typeof r === "function" ? r() : r;
  });
  return { deps: { resolve, request }, resolve, request, requests };
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

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "169.254.0.1",
    "0.0.0.0", "0.1.2.3", "100.64.0.1", "100.127.255.255", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:8.8.8.8", "ff02::1", "64:ff9b::7f00:1", "2002:7f00:1::",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false)
  );
});

describe("URL rules", () => {
  const run = (url: string) => safeFetch(url, { deps: setup({ dns: { "example.com": [PUBLIC] }, responses: { "example.com": ok("x") } }).deps });

  it("rejects http://", async () => expect(await code(run("http://example.com/"))).toBe("not_https"));
  it("rejects port 22", async () => expect(await code(run("https://example.com:22/"))).toBe("bad_port"));
  it("rejects port 8443", async () => expect(await code(run("https://example.com:8443/"))).toBe("bad_port"));
  it("accepts explicit :443", async () => expect((await run("https://example.com:443/")).ok).toBe(true));
  it("rejects user:pass@", async () => expect(await code(run("https://user:pw@example.com/"))).toBe("userinfo"));
  it("rejects user@ without password", async () => expect(await code(run("https://user@example.com/"))).toBe("userinfo"));
  it("rejects garbage", async () => expect(await code(run("not a url"))).toBe("bad_url"));
  it("rejects file:// and ftp://", async () => {
    expect(await code(run("file:///etc/passwd"))).toBe("not_https");
    expect(await code(run("ftp://example.com/"))).toBe("not_https");
  });
});

describe("blocked destinations", () => {
  const blocked = async (url: string) => {
    const s = setup({ dns: { localhost: ["127.0.0.1"] }, responses: {} });
    const c = await code(safeFetch(url, { deps: s.deps }));
    expect(s.request).not.toHaveBeenCalled(); // never connected
    return c;
  };

  it("localhost", async () => expect(await blocked("https://localhost/")).toBe("blocked_address"));
  it("sub.localhost", async () => expect(await blocked("https://a.localhost/")).toBe("blocked_address"));
  it("127.0.0.1", async () => expect(await blocked("https://127.0.0.1/")).toBe("blocked_address"));
  it("decimal 2130706433", async () => expect(await blocked("https://2130706433/")).toBe("blocked_address"));
  it("hex 0x7f000001", async () => expect(await blocked("https://0x7f000001/")).toBe("blocked_address"));
  it("octal 0177.0.0.1", async () => expect(await blocked("https://0177.0.0.1/")).toBe("blocked_address"));
  it("short form 127.1", async () => expect(await blocked("https://127.1/")).toBe("blocked_address"));
  it("[::1]", async () => expect(await blocked("https://[::1]/")).toBe("blocked_address"));
  it("[::ffff:127.0.0.1]", async () => expect(await blocked("https://[::ffff:127.0.0.1]/")).toBe("blocked_address"));
  it("169.254.169.254 (metadata)", async () => expect(await blocked("https://169.254.169.254/latest/meta-data/")).toBe("blocked_address"));
  it("10.x", async () => expect(await blocked("https://10.1.2.3/")).toBe("blocked_address"));
  it("192.168.x", async () => expect(await blocked("https://192.168.0.1/")).toBe("blocked_address"));
  it("172.16.x", async () => expect(await blocked("https://172.16.0.1/")).toBe("blocked_address"));
  it("0.0.0.0", async () => expect(await blocked("https://0.0.0.0/")).toBe("blocked_address"));
  it("100.64.x", async () => expect(await blocked("https://100.64.0.1/")).toBe("blocked_address"));
  it("fd00::1", async () => expect(await blocked("https://[fd00::1]/")).toBe("blocked_address"));
  it("fe80::1", async () => expect(await blocked("https://[fe80::1]/")).toBe("blocked_address"));

  it("a hostname resolving to a private address", async () => {
    const s = setup({ dns: { "evil.example": ["10.0.0.5"] } });
    expect(await code(safeFetch("https://evil.example/", { deps: s.deps }))).toBe("blocked_address");
    expect(s.request).not.toHaveBeenCalled();
  });

  it("rejects when ANY resolved address is private (mixed public + private)", async () => {
    const s = setup({ dns: { "mixed.example": [PUBLIC, "127.0.0.1"] } });
    expect(await code(safeFetch("https://mixed.example/", { deps: s.deps }))).toBe("blocked_address");
    const s6 = setup({ dns: { "mixed6.example": [PUBLIC, "::1"] } });
    expect(await code(safeFetch("https://mixed6.example/", { deps: s6.deps }))).toBe("blocked_address");
  });

  it("DNS failure and empty answers are refused", async () => {
    expect(await code(safeFetch("https://nx.example/", { deps: setup().deps }))).toBe("dns_failed");
    expect(await code(safeFetch("https://empty.example/", { deps: setup({ dns: { "empty.example": [] } }).deps }))).toBe("dns_failed");
  });

  it("client-facing message is generic and carries no address", async () => {
    const e = await safeFetch("https://evil.example/", { deps: setup({ dns: { "evil.example": ["10.0.0.5"] } }).deps }).catch((x) => x);
    expect(e.message).toBe("Upstream request blocked or failed.");
    expect(e.message).not.toMatch(/10\.0\.0\.5|evil/);
  });
});

describe("DNS rebinding", () => {
  it("connects to the validated address, not a second lookup", async () => {
    let calls = 0;
    const requests: RawRequest[] = [];
    const deps = {
      // First answer is public; a naive client that resolved again at connect time would get 127.0.0.1.
      resolve: async () => (calls++ === 0 ? [PUBLIC] : ["127.0.0.1"]),
      request: async (r: RawRequest) => {
        requests.push(r);
        return ok("fine");
      },
    };
    const res = await safeFetch("https://rebind.example/", { deps });
    expect(res.text()).toBe("fine");
    expect(calls).toBe(1);
    expect(requests[0].address).toBe(PUBLIC);
  });

  it("re-resolves and re-validates on each redirect hop (rebinding between hops)", async () => {
    const answers: Record<string, string[]> = { "a.example": [PUBLIC], "b.example": ["169.254.169.254"] };
    const s = setup({ dns: answers, responses: { "a.example": redirect("https://b.example/x") } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("blocked_address");
    expect(s.requests.map((r) => r.url.hostname)).toEqual(["a.example"]);
  });
});

describe("redirects", () => {
  it("blocks a redirect to an internal IP literal", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": redirect("https://169.254.169.254/latest/meta-data/") } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("blocked_address");
    expect(s.requests).toHaveLength(1);
  });

  it("blocks a redirect to localhost", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": redirect("https://localhost/admin") } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("blocked_address");
  });

  it("blocks a redirect to http://", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": redirect("http://a.example/") } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("not_https");
  });

  it("blocks a redirect to another port and to userinfo", async () => {
    const mk = (loc: string) => setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": redirect(loc) } });
    expect(await code(safeFetch("https://a.example/", { deps: mk("https://a.example:22/").deps }))).toBe("bad_port");
    expect(await code(safeFetch("https://a.example/", { deps: mk("https://u:p@a.example/").deps }))).toBe("userinfo");
  });

  it("follows up to 3 redirects and fails on the 4th", async () => {
    const hops: Record<string, () => RawResponse> = {};
    const dns: Record<string, string[]> = {};
    for (let i = 0; i < 6; i++) {
      dns[`h${i}.example`] = [PUBLIC];
      hops[`h${i}.example`] = () => redirect(`https://h${i + 1}.example/`);
    }
    hops["h3.example"] = () => ok("end"); // 3 redirects: h0 -> h1 -> h2 -> h3
    const three = setup({ dns, responses: hops });
    expect((await safeFetch("https://h0.example/", { deps: three.deps })).text()).toBe("end");

    hops["h3.example"] = () => redirect("https://h4.example/");
    hops["h4.example"] = () => ok("end");
    expect(await code(safeFetch("https://h0.example/", { deps: setup({ dns, responses: hops }).deps }))).toBe("too_many_redirects");
  });

  it("rejects a redirect with no Location", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": { status: 302, headers: {}, body: chunks(""), destroy: vi.fn() } } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("bad_redirect");
  });

  it("resolves relative Location against the current URL", async () => {
    let n = 0;
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": () => (n++ === 0 ? redirect("/next?x=1") : ok("done")) } });
    expect((await safeFetch("https://a.example/start", { deps: s.deps })).text()).toBe("done");
    expect(s.requests[1].url.toString()).toBe("https://a.example/next?x=1");
  });
});

describe("headers", () => {
  it("never sends cookies, even if the caller asks", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": ok("x") } });
    await safeFetch("https://a.example/", { deps: s.deps, headers: { Cookie: "microai_session=secret", cookie: "a=b", "User-Agent": "t" } });
    const sent = Object.keys(s.requests[0].headers).map((h) => h.toLowerCase());
    expect(sent).not.toContain("cookie");
    expect(sent).toContain("user-agent");
  });

  it("keeps Authorization on a same-host redirect but never forwards it to another host", async () => {
    let n = 0;
    const same = setup({ dns: { "api.example": [PUBLIC] }, responses: { "api.example": () => (n++ === 0 ? redirect("/v2") : ok("x")) } });
    await safeFetch("https://api.example/", { deps: same.deps, headers: { Authorization: "Bearer TOKEN" } });
    expect(same.requests[1].headers.Authorization).toBe("Bearer TOKEN");

    let m = 0;
    const cross = setup({
      dns: { "api.example": [PUBLIC], "cdn.example": [PUBLIC] },
      responses: { "api.example": () => (m++ === 0 ? redirect("https://cdn.example/f") : ok("x")), "cdn.example": ok("x") },
    });
    await safeFetch("https://api.example/", { deps: cross.deps, headers: { Authorization: "Bearer TOKEN", "X-Api-Key": "k" }, sensitiveHeaders: ["x-api-key"] });
    const second = cross.requests[1];
    expect(second.url.hostname).toBe("cdn.example");
    expect(Object.keys(second.headers).map((h) => h.toLowerCase())).not.toContain("authorization");
    expect(Object.keys(second.headers).map((h) => h.toLowerCase())).not.toContain("x-api-key");
  });

  it("GitHub-style: allowlist refuses a cross-host redirect, so the token never leaves api.github.com", async () => {
    const s = setup({ dns: { "api.github.com": [PUBLIC], "evil.example": [PUBLIC] }, responses: { "api.github.com": redirect("https://evil.example/steal"), "evil.example": ok("x") } });
    expect(await code(safeFetch("https://api.github.com/repos/a/b", { deps: s.deps, allowedHosts: ["api.github.com"], headers: { Authorization: "Bearer TOKEN" } }))).toBe("host_not_allowed");
    expect(s.requests.map((r) => r.url.hostname)).toEqual(["api.github.com"]);
  });
});

describe("host allowlist", () => {
  it("matches exact and wildcard rules", () => {
    expect(hostMatches("arc.io", ["arc.io"])).toBe(true);
    expect(hostMatches("www.arc.io", ["arc.io"])).toBe(false);
    expect(hostMatches("www.arc.io", ["*.arc.io"])).toBe(true);
    expect(hostMatches("arc.io", ["*.arc.io"])).toBe(false);
    expect(hostMatches("evilarc.io", ["arc.io", "*.arc.io"])).toBe(false);
    expect(hostMatches("arc.io.evil.com", ["arc.io", "*.arc.io"])).toBe(false);
    expect(hostMatches("WWW.Circle.COM", ["*.circle.com"])).toBe(true);
  });

  it("rejects a non-allowed host before any DNS lookup", async () => {
    const s = setup({ dns: { "other.example": [PUBLIC] } });
    expect(await code(safeFetch("https://other.example/", { deps: s.deps, allowedHosts: ["arc.io", "*.arc.io"] }))).toBe("host_not_allowed");
    expect(s.resolve).not.toHaveBeenCalled();
  });

  it("assertAllowedHost guards the fixed Arc endpoints", () => {
    expect(() => assertAllowedHost("https://rpc.mainnet.arc.io", ["rpc.mainnet.arc.io"])).not.toThrow();
    expect(() => assertAllowedHost("https://127.0.0.1", ["rpc.mainnet.arc.io"])).toThrow(SafeFetchError);
    expect(() => assertAllowedHost("http://rpc.mainnet.arc.io", ["rpc.mainnet.arc.io"])).toThrow(SafeFetchError);
    expect(() => assertAllowedHost("https://rpc.mainnet.arc.io:8545", ["rpc.mainnet.arc.io"])).toThrow(SafeFetchError);
  });
});

describe("body limits and deadlines", () => {
  const big = (n: number) => new Uint8Array(n).fill(97);

  it("aborts a streamed body past the cap", async () => {
    const destroy = vi.fn();
    const res: RawResponse = { status: 200, headers: {}, body: chunks(big(600), big(600)), destroy };
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": res } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps, maxBytes: 1000 }))).toBe("too_large");
    expect(destroy).toHaveBeenCalled();
  });

  it("rejects early from Content-Length", async () => {
    const destroy = vi.fn();
    const res: RawResponse = { status: 200, headers: { "content-length": "5000000" }, body: chunks("x"), destroy };
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": res } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps }))).toBe("too_large");
    expect(destroy).toHaveBeenCalled();
  });

  it("default cap is 1 MB: 1 MB passes, 1 MB + 1 fails", async () => {
    const mk = (n: number) => setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": () => ({ status: 200, headers: {}, body: chunks(big(n)), destroy: vi.fn() }) } });
    expect((await safeFetch("https://a.example/", { deps: mk(1024 * 1024).deps })).text()).toHaveLength(1024 * 1024);
    expect(await code(safeFetch("https://a.example/", { deps: mk(1024 * 1024 + 1).deps }))).toBe("too_large");
  });

  it("times out a body that stalls forever", async () => {
    const destroy = vi.fn();
    const stalled: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise<IteratorResult<Uint8Array>>(() => {}),
      }),
    };
    const res: RawResponse = { status: 200, headers: {}, body: stalled, destroy };
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": res } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps, timeoutMs: 50 }))).toBe("timeout");
    expect(destroy).toHaveBeenCalled();
  });

  it("times out a slow-drip body (data keeps arriving, deadline still applies)", async () => {
    async function* drip() {
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 20));
        yield enc.encode("x");
      }
    }
    const res: RawResponse = { status: 200, headers: {}, body: drip(), destroy: vi.fn() };
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": res } });
    expect(await code(safeFetch("https://a.example/", { deps: s.deps, timeoutMs: 100 }))).toBe("timeout");
  });

  it("times out a server that never answers", async () => {
    const deps = { resolve: async () => [PUBLIC], request: () => new Promise<RawResponse>(() => {}) };
    expect(await code(safeFetch("https://a.example/", { deps, timeoutMs: 50 }))).toBe("timeout");
  });

  it("a transport error becomes a generic network error", async () => {
    const deps = { resolve: async () => [PUBLIC], request: async () => { throw new Error("ECONNRESET 10.0.0.1"); } };
    const e = await safeFetch("https://a.example/", { deps }).catch((x) => x);
    expect(e.code).toBe("network");
    expect(e.message).not.toMatch(/ECONNRESET|10\.0/);
  });
});

describe("response", () => {
  it("exposes ok/status/headers/text/json", async () => {
    const s = setup({ dns: { "a.example": [PUBLIC] }, responses: { "a.example": { status: 404, headers: { "x-ratelimit-remaining": "0" }, body: chunks('{"a":1}'), destroy: vi.fn() } } });
    const r = await safeFetch("https://a.example/", { deps: s.deps });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(r.json()).toEqual({ a: 1 });
  });
});

describe("readTextCapped (fixed first-party endpoints)", () => {
  it("reads a small body", async () => expect(await readTextCapped(new Response('{"ok":true}'))).toBe('{"ok":true}'));
  it("rejects an oversized body", async () => {
    await expect(readTextCapped(new Response("a".repeat(2000)), 1000)).rejects.toMatchObject({ code: "too_large" });
  });
  it("rejects an oversized body with no Content-Length (stream)", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(800));
        c.enqueue(new Uint8Array(800));
        c.close();
      },
    });
    await expect(readTextCapped(new Response(stream), 1000)).rejects.toMatchObject({ code: "too_large" });
  });
});
