import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (no session), the Arc RPC and
// the outbound endpoint fetch. Nothing here touches the network or the chain.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchMock, rpc } = vi.hoisted(() => ({ fetchMock: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/verify/fetchEndpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verify/fetchEndpoint")>()),
  fetchChallenge: fetchMock,
}));
vi.mock("@/lib/arcRpc", () => {
  class RpcError extends Error {
    constructor(message: string, readonly retryable: boolean) {
      super(message);
    }
  }
  return { rpcCall: rpc, RpcError };
});

import { POST } from "@/app/api/verify/route";
import { DELETE } from "@/app/api/verify/report/[id]/route";
import { ERC20_TRANSFER_TOPIC, USDC_ADDRESS } from "@/lib/arcConfig";
import { loadReport } from "@/lib/verify/reportStore";

const HASH = "0x" + "ab".repeat(32);
const PAYEE = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const receipt = {
  transactionHash: HASH,
  status: "0x1",
  blockNumber: "0x10",
  logs: [{ address: USDC_ADDRESS, topics: [ERC20_TRANSFER_TOPIC, pad(PAYER), pad(PAYEE)], data: "0x" + (10000).toString(16).padStart(64, "0") }],
};
const BODY = { txHash: HASH, network: "mainnet", expect: { payTo: PAYEE, amount: "10000" } };

const post = (body: unknown, ip = "198.51.100.20") =>
  new Request("https://microai.example/api/verify", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const del = (id: string, body: unknown, ip = "198.51.100.30") =>
  DELETE(new Request(`https://microai.example/api/verify/report/${id}`, { method: "DELETE", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  redis = makeFakeRedis();
  fetchMock.mockReset();
  rpc.mockReset();
  rpc.mockResolvedValue(receipt);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.PAUSE_VERIFY;
  vi.useRealTimers();
});

describe("/api/verify share", () => {
  it("stores nothing and returns no link unless a link is asked for", async () => {
    const json = await (await POST(post(BODY))).json();
    expect(json.share).toBeUndefined();
    expect(json.shareError).toBeUndefined();
  });

  it("returns a link whose stored report is the server's own result", async () => {
    const json = await (await POST(post({ ...BODY, share: true }))).json();
    expect(json.share.path).toBe(`/verify/r/${json.share.id}`);
    const stored = await loadReport(json.share.id);
    expect(stored?.result.transaction?.txHash).toBe(HASH);
    expect(stored?.result.transaction?.counts.error).toBe(0);
    expect(json.transaction.counts.error).toBe(0);
  });

  it("cannot be used to store content of the caller's choosing", async () => {
    const forged = { title: "FORGED: all clear, send funds to 0xdead", findings: [] };
    const json = await (await POST(post({ ...BODY, share: true, result: forged, report: forged, transaction: forged }))).json();
    const stored = JSON.stringify((await loadReport(json.share.id))?.result);
    expect(stored).not.toContain("FORGED");
    expect(stored).not.toContain("0xdead");
  });

  it("stores the delivery verdict, labelled as reported", async () => {
    const json = await (await POST(post({ ...BODY, share: true, delivery: { httpStatus: 503 } }))).json();
    const stored = await loadReport(json.share.id);
    expect(stored?.result.delivery?.status).toBe("mismatch");
    expect(stored?.result.delivery?.notes.join(" ")).toMatch(/you reported/);
  });

  it("does not store the delete token with the report", async () => {
    const json = await (await POST(post({ ...BODY, share: true }))).json();
    expect(JSON.stringify(await redis.get(`microai:vreport:${json.share.id}`))).not.toContain(json.share.deleteToken);
  });

  it("still returns the check when sharing is rate limited (10 per hour per IP)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-09T10:00:00Z"));
    const outcomes: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      // Move on a minute each time so only the share limiter (not the 5 per minute check limiter) is hit.
      vi.setSystemTime(new Date(Date.parse("2026-11-09T10:00:00Z") + i * 61_000));
      const res = await POST(post({ ...BODY, share: true }, "203.0.113.9"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.transaction).toBeDefined();
      outcomes.push(Boolean(json.share));
      if (!json.share) expect(json.shareError).toMatch(/Too many shared reports/);
    }
    expect(outcomes.slice(0, 10).every(Boolean)).toBe(true);
    expect(outcomes.slice(10)).toEqual([false, false]);
  });

  it("returns shareError, not a failure, when the report cannot be saved", async () => {
    const spy = vi.spyOn(redis, "set").mockResolvedValue(null as never);
    const res = await POST(post({ ...BODY, share: true }));
    spy.mockRestore();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.share).toBeUndefined();
    expect(json.shareError).toMatch(/could not be saved/);
    expect(json.transaction).toBeDefined();
  });

  it("rejects share that is not a boolean", async () => {
    expect((await POST(post({ ...BODY, share: "yes" }))).status).toBe(400);
  });

  it("is blocked by the pause switch like the rest of Verify", async () => {
    process.env.PAUSE_VERIFY = "1";
    expect((await POST(post({ ...BODY, share: true }))).status).toBe(503);
  });
});

describe("DELETE /api/verify/report/[id]", () => {
  it("deletes with the right token", async () => {
    const { share } = await (await POST(post({ ...BODY, share: true }))).json();
    const res = await del(share.id, { token: share.deleteToken });
    expect(res.status).toBe(200);
    expect(await loadReport(share.id)).toBeNull();
  });

  it("answers 404 for a wrong token and keeps the report", async () => {
    const { share } = await (await POST(post({ ...BODY, share: true }))).json();
    expect((await del(share.id, { token: "z".repeat(22) })).status).toBe(404);
    expect(await loadReport(share.id)).not.toBeNull();
  });

  it("answers the same 404 for a missing report as for a wrong token", async () => {
    const { share } = await (await POST(post({ ...BODY, share: true }))).json();
    const wrong = await del(share.id, { token: "z".repeat(22) });
    const missing = await del("q".repeat(22), { token: "z".repeat(22) });
    expect(missing.status).toBe(wrong.status);
    expect((await missing.json()).error).toBe((await wrong.json()).error);
  });

  it("answers 404 for a malformed id and 400 for a malformed token", async () => {
    expect((await del("not-an-id", { token: "z".repeat(22) })).status).toBe(404);
    expect((await del("q".repeat(22), { token: "short" })).status).toBe(400);
  });

  it("is rate limited", async () => {
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await del("q".repeat(22), { token: "z".repeat(22) }, "203.0.113.77")).status;
    expect(last).toBe(429);
  });
});
