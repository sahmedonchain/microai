import { describe, it, expect, vi } from "vitest";
import { rpcCall } from "@/lib/arcRpc";

// MOCK: fetch is stubbed; nothing here talks to a real Arc node.
const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });

describe("rpcCall (mocked fetch)", () => {
  it("returns the result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("0x1")));
    await expect(rpcCall("eth_chainId")).resolves.toBe("0x1");
  });

  it("retries once after a 503 and then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok("0x2"));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_blockNumber")).resolves.toBe("0x2");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("retries after a network error", async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(ok("0x3"));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_blockNumber")).resolves.toBe("0x3");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("aborts a hung request at the timeout and retries", async () => {
    const f = vi
      .fn()
      .mockImplementationOnce((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))))
      .mockResolvedValueOnce(ok("0x4"));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_blockNumber", [], { timeoutMs: 20 })).resolves.toBe("0x4");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not retry a JSON-RPC error answer", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "execution reverted" } }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_call", [])).rejects.toThrow("execution reverted");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const f = vi.fn().mockResolvedValue(new Response("down", { status: 502 }));
    vi.stubGlobal("fetch", f);
    await expect(rpcCall("eth_blockNumber")).rejects.toThrow("RPC HTTP 502");
    expect(f).toHaveBeenCalledTimes(2);
  });
});
