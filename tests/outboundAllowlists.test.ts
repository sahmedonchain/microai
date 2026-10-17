import { describe, it, expect, vi, afterEach } from "vitest";
import { rpcCall, RpcError } from "@/lib/arcRpc";
import { explorerFetch } from "@/lib/arcExplorer";
import { isAllowedSitemapUrl, fetchXPosts } from "@/lib/news";

// MOCK: global fetch is stubbed; nothing here reaches the network.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
};

describe("Arc RPC hostname allowlist", () => {
  it.each(["http://rpc.mainnet.arc.io", "https://127.0.0.1", "https://169.254.169.254/latest", "https://evil.example", "https://rpc.mainnet.arc.io:8545", "https://user:pw@rpc.mainnet.arc.io"])(
    "refuses %s without making a request and without retrying",
    async (url) => {
      quiet();
      const f = vi.fn();
      vi.stubGlobal("fetch", f);
      await expect(rpcCall("eth_chainId", [], { url })).rejects.toBeInstanceOf(RpcError);
      expect(f).not.toHaveBeenCalled();
    }
  );

  it("allows the mainnet and testnet RPC hosts", async () => {
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ result: "0x1" })));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_chainId", [], { url: "https://rpc.testnet.arc.io" })).resolves.toBe("0x1");
    await expect(rpcCall("eth_chainId")).resolves.toBe("0x1");
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });

  it("does not follow redirects (a redirect surfaces as a retryable network error, not a request elsewhere)", async () => {
    quiet();
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed: unexpected redirect"));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_chainId", [], { retries: 0 })).rejects.toBeInstanceOf(RpcError);
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });

  it("aborts an oversized RPC body without retrying", async () => {
    quiet();
    const f = vi.fn().mockImplementation(async () => new Response("x".repeat(2 * 1024 * 1024)));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_getLogs", [])).rejects.toMatchObject({ retryable: false });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("Arc explorer client", () => {
  it("sends redirect:'error' and only to the configured explorer host", async () => {
    quiet();
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ a: 1 })));
    vi.stubGlobal("fetch", f);
    const r = await explorerFetch<{ a: number }>("/addresses/0x1");
    expect(r).toEqual({ ok: true, data: { a: 1 } });
    expect(new URL(f.mock.calls[0][0]).hostname).toBe("explorer.arc.io");
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });

  it("treats an oversized body as unavailable", async () => {
    quiet();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("x".repeat(2 * 1024 * 1024))));
    expect(await explorerFetch("/big", { retries: 0 })).toMatchObject({ ok: false, kind: "unavailable" });
  });
});

describe("sitemap-derived URLs", () => {
  it.each([
    "https://www.arc.io/blog/post",
    "https://arc.io/blog/post",
    "https://docs.arc.io/x",
    "https://www.circle.com/blog/post",
    "https://circle.com/pressroom/x",
  ])("accepts %s", (u) => expect(isAllowedSitemapUrl(u)).toBe(true));

  it.each([
    "http://www.arc.io/blog/post",
    "https://evil.example/blog/post",
    "https://arc.io.evil.example/blog/post",
    "https://notarc.io/blog/post",
    "https://evilcircle.com/x",
    "https://www.arc.io:8443/blog/post",
    "https://user:pw@www.arc.io/blog/post",
    "https://127.0.0.1/blog/post",
    "https://169.254.169.254/latest/meta-data",
    "javascript:alert(1)",
    "//www.arc.io/blog/post",
    "",
  ])("rejects %s", (u) => expect(isAllowedSitemapUrl(u)).toBe(false));
});

describe("fetchXPosts is inert and input-safe", () => {
  it("returns [] without a token and never touches the network", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubEnv("X_BEARER_TOKEN", "");
    expect(await fetchXPosts("arc")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses a handle that is not an X username, even with a token", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubEnv("X_BEARER_TOKEN", "test-token");
    for (const h of ["../../etc", "a/b", "a?x=1", "a b", "x".repeat(40), ""]) expect(await fetchXPosts(h)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
