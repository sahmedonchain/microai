import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), the session cookie (real signed token), Circle's
// service (stubbed fetch) and the Arc RPC. Nothing touches the network or the chain.
let redis = makeFakeRedis();
const jar = vi.hoisted(() => ({ value: "" }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "microai_session" && jar.value ? { value: jar.value } : undefined) }) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/arcRpc", () => {
  class RpcError extends Error {
    constructor(message: string, readonly retryable: boolean) {
      super(message);
    }
  }
  return { rpcCall: rpc, RpcError };
});

import { POST as quote } from "@/app/api/swap/quote/route";
import { POST as execute } from "@/app/api/swap/execute/route";
import { POST as submit } from "@/app/api/swap/submit/route";
import { GET as history } from "@/app/api/swap/history/route";
import { GET as status } from "@/app/api/swap/status/[txHash]/route";
import { GET as circleGet, POST as circlePost } from "@/app/api/swap/circle/[...path]/route";
import { issueSessionToken } from "@/lib/session";
import { ERC20_TRANSFER_TOPIC } from "@/lib/arcConfig";
import { SWAP_TOKENS } from "@/lib/swap/config";

const KEY = "KIT_KEY:test-id:SUPER_SECRET_VALUE_123";
const TREASURY = "0x78c144a76614a8674285129810555c8bca78f044";
const ME = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const TX = "0x" + "ab".repeat(32);
const USDC = SWAP_TOKENS.USDC.address;
const EURC = SWAP_TOKENS.EURC.address;
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);

const circle = vi.fn();
const logs: string[] = [];
let n = 0;
const call = (h: unknown, body?: unknown, opts: { ctx?: unknown; headers?: Record<string, string>; url?: string; method?: string } = {}) =>
  (h as (r: Request, c: unknown) => Promise<Response>)(
    new Request(opts.url ?? "https://microai.test/api/x", {
      method: opts.method ?? (body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++n % 250}`, ...opts.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    opts.ctx
  );
const as = (a: string) => void (jar.value = issueSessionToken(a));
const quoteBody = (amount: string, fromToken = "USDC", toToken = "EURC") => ({ amount, fromToken, toToken });
const quoteAnswer = (est = "99800000", min = "99300000", type: "input" | "output" = "input") => ({ quote: { estimatedAmount: est, minAmount: min, route: {} }, feeContext: type === "input" ? { type, tokenAddress: USDC, tokenSymbol: "USDC", amount: "100000" } : { type, tokenAddress: EURC, tokenSymbol: "EURC", minAmount: min, estimatedAmount: est } });

async function confirmed(amount = "100") {
  as(ME);
  const q = (await (await call(quote, quoteBody(amount))).json()).quote;
  const ex = await call(execute, { quoteId: q.id, confirm: true });
  return { q, ex };
}
const swapBody = (over: Record<string, unknown> = {}) => ({ tokenInAddress: USDC, tokenInChain: "Arc", tokenOutAddress: EURC, tokenOutChain: "Arc", fromAddress: ME, toAddress: ME, amount: "100000000", stopLimit: "99300000", ...over });
const proxy = (q: string, body: unknown) => call(circlePost, body, { ctx: { params: Promise.resolve({ path: ["swap"] }) }, headers: { "x-swap-quote": q } });

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  process.env.KIT_KEY = KEY;
  process.env.TREASURY_ADDRESS = TREASURY;
  redis = makeFakeRedis();
  jar.value = "";
  rpc.mockReset();
  circle.mockReset();
  circle.mockImplementation(async (url: URL) => (String(url).includes("/quote") ? new Response(JSON.stringify(quoteAnswer()), { status: 200 }) : new Response(JSON.stringify({ transaction: {} }), { status: 200 })));
  vi.stubGlobal("fetch", circle);
  logs.length = 0;
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a.join(" ")));
});

describe("swap quote", () => {
  it("needs a signed-in wallet and a configured server", async () => {
    expect((await call(quote, quoteBody("100"))).status).toBe(401);
    as(ME);
    delete process.env.KIT_KEY;
    const r = await call(quote, quoteBody("100"));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe("Swap is not available yet.");
    process.env.KIT_KEY = KEY;
    process.env.TREASURY_ADDRESS = "not-an-address";
    expect((await call(quote, quoteBody("100"))).status).toBe(503);
  });

  it("returns the card with fee, slippage and network, and the key stays on the server", async () => {
    as(ME);
    const res = await call(quote, quoteBody("100"));
    const text = await res.text();
    const q = JSON.parse(text).quote;
    expect(q).toMatchObject({ from: "USDC", to: "EURC", amountIn: "100", estimatedReceive: "99.8", fee: "0.1", feePercent: "0.10%", slippage: "0.50%", network: "Arc" });
    const [url, init] = circle.mock.calls[0];
    expect(String(url)).toContain("/v1/stablecoinKits/quote");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(text).not.toContain("SUPER_SECRET");
    expect(logs.join("\n")).not.toContain("SUPER_SECRET");
  });

  it("takes the fee off the output when Circle says the fee comes from the output", async () => {
    circle.mockResolvedValue(new Response(JSON.stringify(quoteAnswer("99800000", "99300000", "output")), { status: 200 }));
    as(ME);
    const q = (await (await call(quote, quoteBody("100"))).json()).quote;
    expect(q.estimatedReceive).toBe("99.7");
  });

  it("enforces amount limits and the token allowlist", async () => {
    as(ME);
    for (const amount of ["0.5", "1000.01", "abc", "-5"]) expect((await call(quote, quoteBody(amount))).status).toBe(400);
    expect((await call(quote, quoteBody("10", "USDC", "USDT"))).status).toBe(400);
    expect((await call(quote, quoteBody("10", "USDC", "USDC"))).status).toBe(400);
    expect(circle).not.toHaveBeenCalled();
  });

  it("uses a minimum fee for small swaps", async () => {
    as(ME);
    const q = (await (await call(quote, quoteBody("5"))).json()).quote;
    expect(q.fee).toBe("0.01");
  });
});

describe("confirm, cancel and daily limit", () => {
  it("a quote can be confirmed once, and cancelling stops it", async () => {
    const { q, ex } = await confirmed();
    expect(ex.status).toBe(200);
    expect((await call(execute, { quoteId: q.id, confirm: true })).status).toBe(400);
    const q2 = (await (await call(quote, quoteBody("10"))).json()).quote;
    expect((await (await call(execute, { quoteId: q2.id, confirm: false })).json()).status).toBe("CANCELLED");
    expect((await call(execute, { quoteId: q2.id, confirm: true })).status).toBe(400);
  });

  it("another wallet cannot confirm or see a quote", async () => {
    const { q } = await confirmed();
    as(OTHER);
    expect((await call(execute, { quoteId: q.id, confirm: true })).status).toBe(404);
  });

  it("stops at the daily limit of 5,000", async () => {
    for (let i = 0; i < 5; i++) expect((await confirmed("1000")).ex.status).toBe(200);
    as(ME);
    expect((await call(quote, quoteBody("1"))).status).toBe(400);
  });
});

describe("proxy to Circle", () => {
  it("needs a confirmed quote of the same wallet", async () => {
    as(ME);
    const q = (await (await call(quote, quoteBody("100"))).json()).quote;
    expect((await proxy(q.id, swapBody())).status).toBe(403);
    await call(execute, { quoteId: q.id, confirm: true });
    as(OTHER);
    expect((await proxy(q.id, swapBody())).status).toBe(404);
    expect((await call(circleGet, undefined, { ctx: { params: Promise.resolve({ path: ["quote"] }) } })).status).toBe(404);
  });

  it("sets the fee and recipient itself and drops what the browser sent", async () => {
    const { q } = await confirmed();
    circle.mockClear();
    const res = await proxy(q.id, swapBody({ config: { customFee: { percentageBps: 1, recipientAddress: OTHER } } }));
    expect(res.status).toBe(200);
    const [url, init] = circle.mock.calls[0];
    expect(String(url)).toContain("/swap");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const sent = JSON.parse(init.body);
    expect(sent.config).toEqual({ customFee: { percentageBps: 10, recipientAddress: TREASURY } });
    expect(JSON.stringify(sent)).not.toContain(OTHER.slice(2));
  });

  it("rejects a different amount, token, wallet or price limit", async () => {
    const { q } = await confirmed();
    for (const over of [{ amount: "200000000" }, { tokenOutAddress: USDC }, { toAddress: OTHER }, { fromAddress: OTHER }, { stopLimit: "1" }, { tokenInChain: "Ethereum" }]) {
      expect((await proxy(q.id, swapBody(over))).status).toBe(400);
    }
    expect(circle.mock.calls.filter(([u]) => String(u).includes("/swap")).length).toBe(0);
  });

  it("never forwards the browser's usage reports, and hides a refused key", async () => {
    as(ME);
    expect((await call(circleGet, undefined, { ctx: { params: Promise.resolve({ path: ["logs"] }) } })).status).toBe(204);
    expect(circle).not.toHaveBeenCalled();
    const { q } = await confirmed();
    circle.mockResolvedValue(new Response(JSON.stringify({ message: "bad key SUPER_SECRET_VALUE_123" }), { status: 401 }));
    const r = await proxy(q.id, swapBody());
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain("SUPER_SECRET");
    expect(logs.join("\n")).not.toContain("SUPER_SECRET");
  });
});

const receipt = (hash: string, ok: boolean, eurcTo = ME) => ({ transactionHash: hash, status: ok ? "0x1" : "0x0", blockNumber: "0x10", logs: ok ? [{ address: EURC, topics: [ERC20_TRANSFER_TOPIC, pad(TREASURY), pad(eurcTo)], data: "0x" + (99_780_000).toString(16).padStart(64, "0") }] : [] });
const statusOf = (hash: string) => call(status, undefined, { ctx: { params: Promise.resolve({ txHash: hash }) } });

describe("submit, status and history", () => {
  it("records the hash, then reads the result from the chain", async () => {
    const { q } = await confirmed();
    rpc.mockResolvedValue(receipt(TX, true));
    expect((await call(submit, { quoteId: q.id, txHash: TX })).status).toBe(200);
    const s = await (await statusOf(TX)).json();
    expect(s.swap).toMatchObject({ status: "SUCCESS", actualOut: "99.78", txHash: TX });
    expect(s.explorerUrl).toContain(TX);
    const h = (await (await call(history)).json()).swaps;
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ from: "USDC", to: "EURC", status: "SUCCESS" });
  });

  it("marks a failed swap FAILED and frees the daily allowance", async () => {
    const { q } = await confirmed("1000");
    rpc.mockResolvedValue(receipt(TX, false));
    await call(submit, { quoteId: q.id, txHash: TX });
    expect((await (await statusOf(TX)).json()).swap.status).toBe("FAILED");
    for (let i = 0; i < 5; i++) expect((await confirmed("1000")).ex.status).toBe(200);
  });

  it("stays PENDING until the chain has it, and rejects bad or reused hashes", async () => {
    const { q } = await confirmed();
    rpc.mockResolvedValue(null);
    expect((await call(submit, { quoteId: q.id, txHash: "0x12" })).status).toBe(400);
    await call(submit, { quoteId: q.id, txHash: TX });
    expect((await (await statusOf(TX)).json()).swap.status).toBe("PENDING");
    const second = await confirmed();
    expect((await call(submit, { quoteId: second.q.id, txHash: TX })).status).toBe(400);
  });

  it("only the owner sees a swap, and an unconfirmed quote cannot be submitted", async () => {
    const { q } = await confirmed();
    await call(submit, { quoteId: q.id, txHash: TX });
    as(OTHER);
    expect((await statusOf(TX)).status).toBe(404);
    expect((await (await call(history)).json()).swaps).toEqual([]);
    as(ME);
    const unconfirmed = (await (await call(quote, quoteBody("10"))).json()).quote;
    expect((await call(submit, { quoteId: unconfirmed.id, txHash: "0x" + "cd".repeat(32) })).status).toBe(400);
  });
});
