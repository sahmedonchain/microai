import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (fake), next/headers (no session), groq-sdk (stub) and the Explorer (stubbed fetch).
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("groq-sdk", () => ({ default: class { chat = { completions: { create: async () => ({ choices: [{ message: { content: "ok" } }] }) } }; } }));

import { POST } from "@/app/api/wallet/route";
import { USDC_ADDRESS } from "@/lib/arcConfig";

const WALLET = "0x" + "1".repeat(40);
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const recent = new Date(Date.now() - 3600_000).toISOString();

let n = 0;
async function signalsFor(txs: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith(`/addresses/${WALLET}`)) return json({ coin_balance: "0" });
    if (url.includes("/transactions")) return json({ items: txs });
    if (url.includes("/token-balances")) return json([]);
    return json({ transactions_count: String(txs.length) });
  }));
  const res = await POST(new Request("https://microai.example/api/wallet", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++n}` }, body: JSON.stringify({ address: WALLET }) }));
  expect(res.status).toBe(200);
  return (await res.json()).riskSignals as { highValueTx: boolean };
}
const usdcTx = (units: string, token = USDC_ADDRESS) => ({ hash: "0x1", value: "0", timestamp: recent, token_transfers: [{ token: { address_hash: token }, total: { value: units } }] });

beforeEach(() => {
  redis = makeFakeRedis();
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});

describe("wallet high-value rule (mocked Explorer)", () => {
  it("flags a USDC payment above 100 USDC sent through the ERC-20 interface", async () => {
    expect((await signalsFor([usdcTx("150000000")])).highValueTx).toBe(true); // 150 USDC, 6 decimals
  });
  it("does not flag 100 USDC or less", async () => {
    expect((await signalsFor([usdcTx("100000000")])).highValueTx).toBe(false);
    expect((await signalsFor([usdcTx("5000")])).highValueTx).toBe(false);
  });
  it("ignores large transfers of other tokens", async () => {
    expect((await signalsFor([usdcTx("999999999999", "0x" + "c3".repeat(20))])).highValueTx).toBe(false);
  });
  it("still flags a large native-balance transfer (18 decimals)", async () => {
    expect((await signalsFor([{ hash: "0x2", value: (BigInt(101) * BigInt(10) ** BigInt(18)).toString(), timestamp: recent }])).highValueTx).toBe(true);
    expect((await signalsFor([{ hash: "0x3", value: (BigInt(99) * BigInt(10) ** BigInt(18)).toString(), timestamp: recent }])).highValueTx).toBe(false);
  });
  it("handles transactions with no token_transfers field", async () => {
    expect((await signalsFor([{ hash: "0x4", value: "0", timestamp: recent }])).highValueTx).toBe(false);
  });
});
