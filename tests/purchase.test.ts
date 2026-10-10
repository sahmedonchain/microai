import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), the session cookie and the Arc RPC (stubbed fetch).
// No real chain or payment is involved; the purchase route and its checks are real code.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
const cookieJar: { value?: string } = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "microai_session" && cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));

import { POST } from "@/app/api/credits/purchase/route";
import { issueSessionToken } from "@/lib/session";
import { getCredit, creditKey } from "@/lib/credits";
import { submitPurchase } from "@/lib/pendingPurchase";
import { resetChainCheckCache } from "@/lib/purchaseVerification";
import { ERC20_TRANSFER_TOPIC, PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";

const WALLET = "0x" + "a1".repeat(20);
const OTHER = "0x" + "b2".repeat(20);
// A few days after the recovery window opened (2026-10-09T17:00Z), so 3-day-old payments are eligible.
const NOW = Date.parse("2026-10-15T12:00:00Z");
const DAY = 24 * 3600_000;
const pad = (a: string) => "0x" + a.slice(2).toLowerCase().padStart(64, "0");

interface Chain {
  receipts: Map<string, unknown>;
  blocks: Map<string, { timestamp: string }>;
  down: boolean;
  chainId: string;
  chainIdCalls: number;
}
let chain: Chain;

function mine(txHash: string, opts: { from?: string; to?: string; units?: number; token?: string; status?: string; ageMs?: number; block?: string } = {}) {
  const block = opts.block ?? "0x" + (16 + chain.receipts.size).toString(16);
  chain.receipts.set(txHash, {
    status: opts.status ?? "0x1",
    blockNumber: block,
    logs: [
      {
        address: opts.token ?? USDC_ADDRESS,
        topics: [ERC20_TRANSFER_TOPIC, pad(opts.from ?? WALLET), pad(opts.to ?? PAYMENT_RECEIVER)],
        data: "0x" + BigInt(opts.units ?? 5000).toString(16).padStart(64, "0"),
      },
    ],
  });
  chain.blocks.set(block, { timestamp: "0x" + Math.floor((Date.now() - (opts.ageMs ?? 60_000)) / 1000).toString(16) });
}

// A receipt with several USDC logs (or logs from other tokens), for batched transactions.
interface Xfer { from?: string; to?: string; units: number; token?: string }
function mineBatch(txHash: string, transfers: Xfer[], opts: { ageMs?: number } = {}) {
  const block = "0x" + (200 + chain.receipts.size).toString(16);
  chain.receipts.set(txHash, {
    status: "0x1",
    blockNumber: block,
    logs: transfers.map((t, i) => ({
      address: t.token ?? USDC_ADDRESS,
      logIndex: "0x" + (i + 5).toString(16),
      topics: [ERC20_TRANSFER_TOPIC, pad(t.from ?? WALLET), pad(t.to ?? PAYMENT_RECEIVER)],
      data: "0x" + BigInt(t.units).toString(16).padStart(64, "0"),
    })),
  });
  chain.blocks.set(block, { timestamp: "0x" + Math.floor((Date.now() - (opts.ageMs ?? 60_000)) / 1000).toString(16) });
}

const tx = (n: number) => "0x" + n.toString(16).padStart(64, "0");

beforeEach(() => {
  redis = makeFakeRedis();
  chain = { receipts: new Map(), blocks: new Map(), down: false, chainId: "0x13b2", chainIdCalls: 0 };
  resetChainCheckCache();
  process.env.SESSION_SECRET = "test-secret";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  cookieJar.value = issueSessionToken(WALLET); // issued after the clock is set, or it would already be expired
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      if (chain.down) return new Response("bad gateway", { status: 502 });
      const { method, params } = JSON.parse(init.body as string);
      if (method === "eth_chainId") chain.chainIdCalls++;
      const result = method === "eth_chainId" ? chain.chainId : method === "eth_getTransactionReceipt" ? (chain.receipts.get(params[0]) ?? null) : method === "eth_getBlockByNumber" ? chain.blocks.get(params[0]) : null;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
    })
  );
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

const post = (body: unknown) =>
  POST(new Request("https://microai.example/api/credits/purchase", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.3" }, body: JSON.stringify(body) }));

describe("credit purchase verification (mocked chain)", () => {
  it("credits a valid payment once and records a permanent claim", async () => {
    mine(tx(1), { units: 5000 });
    const res = await post({ txHash: tx(1), queries: 5 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, credits: 5, added: 5 });
    expect(await getCredit(WALLET)).toBe(5);
    const claimKey = `microai:usedtx:${tx(1)}`;
    expect(await redis.get(claimKey)).toMatchObject({ wallet: WALLET, credits: 5 });
    expect(await redis.ttl(claimKey)).toBe(-1); // no expiry: replays stay impossible for the whole 7-day window
  });

  it("rejects a replayed txHash and credits nothing the second time", async () => {
    mine(tx(2), { units: 3000 });
    expect((await post({ txHash: tx(2), queries: 3 })).status).toBe(200);
    const replay = await post({ txHash: tx(2), queries: 3 });
    expect(replay.status).toBe(409);
    expect(await replay.json()).toMatchObject({ code: "payment_invalid", reason: "already_used", retryable: false });
    expect(await getCredit(WALLET)).toBe(3);
  });

  it("credits a payment exactly once when submitted twice at the same time", async () => {
    mine(tx(3), { units: 4000 });
    const [a, b] = await Promise.all([post({ txHash: tx(3), queries: 4 }), post({ txHash: tx(3), queries: 4 })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await getCredit(WALLET)).toBe(4);
  });

  it("slow receipt: not found yet is retryable and claims nothing; once mined the same tx is credited", async () => {
    const early = await post({ txHash: tx(4), queries: 2 });
    expect(early.status).toBe(402);
    expect(await early.json()).toMatchObject({ reason: "not_found", retryable: true });
    expect(await redis.get(`microai:usedtx:${tx(4)}`)).toBeNull();
    mine(tx(4), { units: 2000 });
    expect((await post({ txHash: tx(4), queries: 2 })).status).toBe(200);
    expect(await getCredit(WALLET)).toBe(2);
  });

  it("an old but valid payment (3 days) is credited, once", async () => {
    mine(tx(5), { units: 1000, ageMs: 3 * DAY });
    expect((await post({ txHash: tx(5), queries: 1 })).status).toBe(200);
    expect((await post({ txHash: tx(5), queries: 1 })).status).toBe(409);
    expect(await getCredit(WALLET)).toBe(1);
  });

  it("a payment mined shortly after the recovery window opened is credited once", async () => {
    // Mined 2026-10-09 16:42:01Z, verified the same evening.
    vi.setSystemTime(Date.parse("2026-10-09T17:10:00Z"));
    cookieJar.value = issueSessionToken(WALLET);
    mine(tx(30), { units: 5000, ageMs: Date.parse("2026-10-09T17:10:00Z") - Date.parse("2026-10-09T16:42:01Z") });
    const first = await post({ txHash: tx(30), queries: 5 });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ credits: 5, added: 5 });
    const replay = await post({ txHash: tx(30), queries: 5 });
    expect(replay.status).toBe(409);
    expect(await getCredit(WALLET)).toBe(5);
  });

  it("recovery of that same payment (no queries) credits it once too", async () => {
    vi.setSystemTime(Date.parse("2026-10-09T17:10:00Z"));
    cookieJar.value = issueSessionToken(WALLET);
    mine(tx(31), { units: 5000, ageMs: Date.parse("2026-10-09T17:10:00Z") - Date.parse("2026-10-09T16:42:01Z") });
    expect((await post({ txHash: tx(31) })).status).toBe(200);
    expect((await post({ txHash: tx(31) })).status).toBe(409);
    expect(await getCredit(WALLET)).toBe(5);
  });

  it("the window opens at 16:00Z: 16:00 is eligible, 15:59 is held with the 'before recovery' message", async () => {
    vi.setSystemTime(Date.parse("2026-10-09T17:10:00Z"));
    cookieJar.value = issueSessionToken(WALLET);
    const at = (iso: string) => Date.parse("2026-10-09T17:10:00Z") - Date.parse(iso);
    mine(tx(32), { units: 1000, ageMs: at("2026-10-09T16:00:00Z") });
    expect((await post({ txHash: tx(32), queries: 1 })).status).toBe(200);
    mine(tx(33), { units: 1000, ageMs: at("2026-10-09T15:59:00Z") });
    const held = await post({ txHash: tx(33), queries: 1 });
    expect(held.status).toBe(402);
    const body = await held.json();
    expect(body).toMatchObject({ reason: "before_recovery", retryable: false, error: "This payment was made before our recovery system went live. Contact support." });
    expect(body.error).not.toMatch(/7-day/);
    expect(await redis.get(`microai:usedtx:${tx(33)}`)).toBeNull();
  });

  it("a payment that already has a claim key in the old format is not credited again", async () => {
    vi.setSystemTime(Date.parse("2026-10-09T17:10:00Z"));
    cookieJar.value = issueSessionToken(WALLET);
    mine(tx(34), { units: 1000, ageMs: 40 * 60_000 });
    await redis.set(`microai:usedtx:${tx(34)}`, "1", { ex: 3600 }); // the old format: value "1", one-hour TTL
    const res = await post({ txHash: tx(34), queries: 1 });
    expect(res.status).toBe(409);
    expect(await getCredit(WALLET)).toBe(0);
  });

  it("rejects payments older than 7 days and ones mined before the recovery window opened", async () => {
    mine(tx(6), { units: 1000, ageMs: 8 * DAY });
    const old = await post({ txHash: tx(6), queries: 1 });
    expect(old.status).toBe(402);
    expect(await old.json()).toMatchObject({ reason: "too_old", retryable: false, error: expect.stringMatching(/7-day/) });
    // Younger than 7 days, but mined before the recovery window opened (2026-10-09T16:00Z): held for support.
    mine(tx(7), { units: 1000, ageMs: NOW - Date.parse("2026-10-09T10:00:00Z") });
    const held = await post({ txHash: tx(7), queries: 1 });
    expect(held.status).toBe(402);
    expect(await held.json()).toMatchObject({ reason: "before_recovery", error: "This payment was made before our recovery system went live. Contact support." });
    expect(await getCredit(WALLET)).toBe(0);
  });

  it.each([
    ["wrong sender", { from: OTHER }, "wrong_sender"],
    ["wrong recipient", { to: OTHER }, "wrong_recipient"],
    ["wrong amount", { units: 4999 }, "wrong_amount"],
    ["not USDC", { token: "0x" + "c3".repeat(20) }, "no_transfer"],
    ["failed transaction", { status: "0x0" }, "failed"],
  ])("rejects %s without crediting or claiming", async (_name, opts, reason) => {
    mine(tx(8), { units: 5000, ...opts });
    const res = await post({ txHash: tx(8), queries: 5 });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "payment_invalid", reason, retryable: false });
    expect(await getCredit(WALLET)).toBe(0);
    expect(await redis.get(`microai:usedtx:${tx(8)}`)).toBeNull();
  });

  it("a payment sent by someone else cannot be claimed by this session, even through recovery", async () => {
    mine(tx(9), { from: OTHER, units: 5000 });
    const res = await post({ txHash: tx(9) });
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("wrong_sender");
    expect(await getCredit(WALLET)).toBe(0);
  });

  it("recovery (no queries) derives the credit count from the amount paid", async () => {
    mine(tx(10), { units: 25_000 });
    const res = await post({ txHash: tx(10) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ credits: 25, added: 25 });
  });

  it("recovery rejects amounts that are not a whole bundle of 1 to 1000 queries", async () => {
    mine(tx(11), { units: 1500 });
    expect((await post({ txHash: tx(11) })).status).toBe(402);
    mine(tx(12), { units: 1_001_000 });
    expect((await post({ txHash: tx(12) })).status).toBe(402);
    expect(await getCredit(WALLET)).toBe(0);
  });

  it("an RPC outage is retryable, claims nothing, and the payment is credited once the node is back", async () => {
    mine(tx(13), { units: 2000 });
    chain.down = true;
    const down = await post({ txHash: tx(13), queries: 2 });
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ reason: "rpc_unavailable", retryable: true });
    expect(await redis.get(`microai:usedtx:${tx(13)}`)).toBeNull();
    chain.down = false;
    expect((await post({ txHash: tx(13), queries: 2 })).status).toBe(200);
  });

  it("releases the claim when crediting fails, so the same payment can be retried", async () => {
    mine(tx(14), { units: 2000 });
    const realIncr = redis.incrby.bind(redis);
    redis.incrby = async () => { throw new Error("redis write failed"); };
    const failed = await post({ txHash: tx(14), queries: 2 });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ reason: "credit_failed", retryable: true });
    expect(await redis.get(`microai:usedtx:${tx(14)}`)).toBeNull();
    redis.incrby = realIncr;
    expect((await post({ txHash: tx(14), queries: 2 })).status).toBe(200);
    expect(await redis.get(creditKey(WALLET))).toBe(2);
  });

  it("requires a session", async () => {
    cookieJar.value = undefined;
    mine(tx(15));
    expect((await post({ txHash: tx(15), queries: 5 })).status).toBe(401);
  });
});

describe("batched transactions and the chain check (mocked chain)", () => {
  const THIRD = "0x" + "d4".repeat(20);

  it("credits a batched tx: the valid transfer is found among unrelated ones, wherever it sits", async () => {
    mineBatch(tx(40), [
      { to: THIRD, from: OTHER, units: 777 }, // someone else paying someone else
      { from: WALLET, to: THIRD, units: 9999 }, // our wallet paying a third party
      { units: 5000 }, // the payment to us
      { token: "0x" + "c3".repeat(20), units: 12345 }, // another token entirely
    ]);
    const res = await post({ txHash: tx(40), queries: 5 });
    expect(res.status).toBe(200);
    expect(await getCredit(WALLET)).toBe(5);
    expect(await redis.get(`microai:usedtx:${tx(40)}`)).toMatchObject({ wallet: WALLET, credits: 5, logIndexes: [7] });
  });

  it("sums two matching transfers in one transaction", async () => {
    mineBatch(tx(41), [{ units: 3000 }, { units: 2000 }]);
    expect((await post({ txHash: tx(41), queries: 5 })).status).toBe(200);
    expect(await redis.get(`microai:usedtx:${tx(41)}`)).toMatchObject({ credits: 5, logIndexes: [5, 6] });
  });

  it("sums matching transfers in recovery mode too", async () => {
    mineBatch(tx(42), [{ units: 7000 }, { units: 3000 }]);
    expect(await (await post({ txHash: tx(42) })).json()).toMatchObject({ added: 10, credits: 10 });
  });

  it("ignores a Transfer log from another token even if it is addressed to us, from us, for the right amount", async () => {
    mineBatch(tx(43), [{ token: "0x" + "c3".repeat(20), units: 5000 }, { units: 1000 }]);
    // only the 1000-unit USDC log counts, so a 5-credit claim must fail
    const res = await post({ txHash: tx(43), queries: 5 });
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("wrong_amount");
    expect(await getCredit(WALLET)).toBe(0);
  });

  it("only credits what matches: transfers to us from other senders are not counted for this wallet", async () => {
    mineBatch(tx(44), [{ from: OTHER, units: 4000 }, { units: 1000 }]);
    expect((await post({ txHash: tx(44), queries: 5 })).status).toBe(402);
    expect((await post({ txHash: tx(44), queries: 1 })).status).toBe(200);
  });

  it("rejects when no log matches (and says whether the sender or the recipient was wrong)", async () => {
    mineBatch(tx(45), [{ from: OTHER, units: 5000 }]);
    expect((await (await post({ txHash: tx(45), queries: 5 })).json()).reason).toBe("wrong_sender");
    mineBatch(tx(46), [{ to: THIRD, units: 5000 }]);
    expect((await (await post({ txHash: tx(46), queries: 5 })).json()).reason).toBe("wrong_recipient");
    mineBatch(tx(47), [{ token: "0x" + "c3".repeat(20), units: 5000 }]);
    expect((await (await post({ txHash: tx(47), queries: 5 })).json()).reason).toBe("no_transfer");
  });

  it("a replayed batched tx is rejected, and the same tx cannot be credited again through a different log", async () => {
    mineBatch(tx(48), [{ units: 2000 }, { units: 3000 }]);
    expect((await post({ txHash: tx(48), queries: 5 })).status).toBe(200);
    expect((await post({ txHash: tx(48), queries: 5 })).status).toBe(409);
    expect((await post({ txHash: tx(48), queries: 2 })).status).not.toBe(200); // asking for only part of the tx is no way in either
    expect((await post({ txHash: tx(48) })).status).toBe(409);
    expect(await getCredit(WALLET)).toBe(5);
  });

  it("concurrent submits of a batched tx credit once", async () => {
    mineBatch(tx(49), [{ units: 1000 }, { units: 1000 }]);
    const results = await Promise.all([1, 2, 3, 4].map(() => post({ txHash: tx(49), queries: 2 })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
    expect(await getCredit(WALLET)).toBe(2);
  });

  it("rejects when the RPC is not Arc Mainnet, credits nothing, claims nothing, and says to retry", async () => {
    mine(tx(50), { units: 5000 });
    chain.chainId = "0x1"; // Ethereum mainnet
    const res = await post({ txHash: tx(50), queries: 5 });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "wrong_chain", retryable: true });
    expect(await getCredit(WALLET)).toBe(0);
    expect(await redis.get(`microai:usedtx:${tx(50)}`)).toBeNull();
    // the mismatch is not cached as success: once the node is right again the payment goes through
    chain.chainId = "0x13b2";
    expect((await post({ txHash: tx(50), queries: 5 })).status).toBe(200);
  });

  it("rejects a non-string or empty chain id", async () => {
    mine(tx(51), { units: 1000 });
    chain.chainId = "0x" as string;
    expect((await post({ txHash: tx(51), queries: 1 })).status).toBe(503);
  });

  it("checks the chain on every verification but caches a good answer for a minute", async () => {
    mine(tx(52), { units: 1000 });
    mine(tx(53), { units: 1000 });
    await post({ txHash: tx(52), queries: 1 });
    await post({ txHash: tx(53), queries: 1 });
    expect(chain.chainIdCalls).toBe(1);
    vi.setSystemTime(Date.now() + 61_000);
    cookieJar.value = issueSessionToken(WALLET);
    mine(tx(54), { units: 1000 });
    await post({ txHash: tx(54), queries: 1 });
    expect(chain.chainIdCalls).toBe(2);
  });

  it("still requires a successful receipt every time", async () => {
    mine(tx(55), { units: 1000, status: "0x0" });
    expect((await (await post({ txHash: tx(55), queries: 1 })).json()).reason).toBe("failed");
  });
});

describe("client classification of the real server answers", () => {
  const bridge = ((url: string, init: RequestInit) => POST(new Request("https://microai.example" + url, init))) as unknown as typeof fetch;

  it("a payment from before the recovery window is held, not rejected", async () => {
    mine(tx(23), { units: 1000, ageMs: NOW - Date.parse("2026-10-09T10:00:00Z") });
    expect(await submitPurchase({ txHash: tx(23), queries: 1 }, bridge)).toMatchObject({ kind: "held", message: expect.stringMatching(/before our recovery system went live/) });
  });

  it("credited, retry (not mined yet), already credited, rejected, auth", async () => {
    expect((await submitPurchase({ txHash: tx(20), queries: 1 }, bridge)).kind).toBe("retry");
    mine(tx(20), { units: 1000 });
    expect(await submitPurchase({ txHash: tx(20), queries: 1 }, bridge)).toMatchObject({ kind: "credited", added: 1 });
    expect((await submitPurchase({ txHash: tx(20), queries: 1 }, bridge)).kind).toBe("already");
    mine(tx(21), { to: OTHER, units: 1000 });
    expect((await submitPurchase({ txHash: tx(21), queries: 1 }, bridge)).kind).toBe("rejected");
    chain.down = true;
    expect((await submitPurchase({ txHash: tx(22), queries: 1 }, bridge)).kind).toBe("retry");
    cookieJar.value = undefined;
    expect((await submitPurchase({ txHash: tx(22), queries: 1 }, bridge)).kind).toBe("auth");
  });
});
