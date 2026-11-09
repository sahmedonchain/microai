import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (fake), next/headers (no session) and the outbound endpoint fetch.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/verify/fetchEndpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verify/fetchEndpoint")>()),
  fetchChallenge: fetchMock,
}));

import { GET, POST } from "@/app/api/mcp/route";
import { TOOLS } from "@/lib/mcp/server";
import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";

const lab = (id: string) => {
  const a = buildLabAnswer(findLabCase(id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
};
const rpc = (body: unknown, ip = "198.51.100.60") =>
  POST(new Request("https://microai.example/api/mcp", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const call = (name: string, args: unknown, id = 1) => rpc({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
const text = async (res: Response) => JSON.parse((await res.json()).result.content[0].text);

beforeEach(() => {
  redis = makeFakeRedis();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(lab("good"));
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.PAUSE_VERIFY;
});

describe("MCP protocol", () => {
  it("initialize announces tools only", async () => {
    const j = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })).json();
    expect(j.result.serverInfo.name).toBe("microai-readonly");
    expect(Object.keys(j.result.capabilities)).toEqual(["tools"]);
  });
  it("lists exactly the read-only tools", async () => {
    const j = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    expect(j.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["arc_network_info", "check_x402_endpoint", "explain_x402_error"]);
  });
  it("notifications get 202 and no body", async () => {
    const res = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });
  it("rejects bad JSON, batches and unknown methods", async () => {
    expect((await (await rpc("{nope")).json()).error.code).toBe(-32700);
    expect((await (await rpc([{ jsonrpc: "2.0", id: 1, method: "ping" }])).json()).error.code).toBe(-32600);
    expect((await (await rpc({ jsonrpc: "2.0", id: 1, method: "resources/list" })).json()).error.code).toBe(-32601);
    expect((await (await call("send_payment", {})).json()).error.code).toBe(-32602);
  });
  it("GET is not allowed", () => {
    expect(GET().status).toBe(405);
  });
  it("refuses an oversized body", async () => {
    expect((await rpc(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", pad: "x".repeat(20_000) }))).status).toBe(400);
  });
});

describe("MCP tools", () => {
  it("check_x402_endpoint returns the Trust summary and sends no payment", async () => {
    const out = await text(await call("check_x402_endpoint", { url: "https://svc.example/api" }));
    expect(out).toMatchObject({ version: 1, result: "pass", endpoint: { host: "svc.example" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(["https://svc.example/api"]);
  });
  it("rejects non-https URLs as a tool error without fetching", async () => {
    const j = await (await call("check_x402_endpoint", { url: "http://svc.example/api" })).json();
    expect(j.result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("explains known codes and says unknown for the rest", async () => {
    expect(await text(await call("explain_x402_error", { code: "insufficient_funds" }))).toMatchObject({ known: true });
    expect(await text(await call("explain_x402_error", { code: "made_up" }))).toMatchObject({ known: false });
  });
  it("arc_network_info is static", async () => {
    const out = await text(await call("arc_network_info", {}));
    expect(out.networks.map((n: { chainId: number }) => n.chainId)).toEqual([5042, 5042002]);
    expect(out.usdc.erc20Decimals).toBe(6);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("MCP guards", () => {
  it("honours the PAUSE_VERIFY kill switch", async () => {
    process.env.PAUSE_VERIFY = "1";
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "ping" })).status).toBe(503);
  });
  it("rate limits per client", async () => {
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await rpc({ jsonrpc: "2.0", id: i, method: "ping" }, "198.51.100.61")).status;
    expect(last).toBe(429);
  });
  it("fails closed when Redis is down", async () => {
    redis = { ...makeFakeRedis(), eval: async () => { throw new Error("down"); }, incr: async () => { throw new Error("down"); } } as never;
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, "198.51.100.62");
    expect([429, 503]).toContain(res.status);
  });
});

describe("MCP never takes a signed payload, a key or a payment", () => {
  it("no tool schema asks for signature, key, seed or payment input", () => {
    const names = JSON.stringify(TOOLS.map((t) => Object.keys((t.inputSchema as { properties: object }).properties))).toLowerCase();
    for (const bad of ["signature", "payment-signature", "private", "seed", "mnemonic", "authorization", "payload"]) expect(names).not.toContain(bad);
  });
  it("the server code does not import signing, wallet or transaction-sending code", () => {
    const src = readFileSync("lib/mcp/server.ts", "utf8") + readFileSync("app/api/mcp/route.ts", "utf8");
    expect(src).not.toMatch(/Wallet|Signer|sendTransaction|signMessage|signTypedData|eth_sendRawTransaction|privateKey/);
  });
});
