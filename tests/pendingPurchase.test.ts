import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PENDING_MAX_AGE_MS,
  createPending,
  loadPending,
  removePending,
  resolvePurchase,
  savePending,
  submitPurchase,
  type PendingPurchase,
  type SubmitOutcome,
} from "@/lib/pendingPurchase";

// MOCKS: localStorage is an in-memory stand-in; fetch / the server answer are scripted.
const store = new Map<string, string>();
const WALLET = "0x" + "a1".repeat(20);
const HASH = "0x" + "11".repeat(32);
const entry = (over: Partial<PendingPurchase> = {}): PendingPurchase => ({ txHash: HASH, queries: 5, wallet: WALLET, timestamp: Date.now(), ...over });
const stored = () => JSON.parse(store.get("microai_pending_purchases") ?? "[]") as PendingPurchase[];

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});

describe("saving a payment before anything can go wrong", () => {
  it("writes { txHash, queries, wallet, timestamp } immediately", () => {
    const p = createPending(HASH, 5, WALLET.toUpperCase().replace("0X", "0x"));
    savePending(p);
    expect(stored()).toEqual([{ txHash: HASH, queries: 5, wallet: WALLET, timestamp: p.timestamp }]);
  });

  it("is idempotent per txHash", () => {
    savePending(entry());
    savePending(entry());
    expect(stored()).toHaveLength(1);
  });

  it("loads only this wallet's entries, case-insensitively", () => {
    savePending(entry());
    savePending(entry({ txHash: "0x" + "22".repeat(32), wallet: "0x" + "b2".repeat(20) }));
    expect(loadPending(WALLET.toUpperCase().replace("0X", "0x")).map((p) => p.txHash)).toEqual([HASH]);
  });

  it("drops entries older than the server's 7-day window", () => {
    savePending(entry({ timestamp: Date.now() - PENDING_MAX_AGE_MS - 1000 }));
    savePending(entry({ txHash: "0x" + "33".repeat(32) }));
    expect(loadPending(WALLET).map((p) => p.txHash)).toEqual(["0x" + "33".repeat(32)]);
    expect(stored()).toHaveLength(1);
  });

  it("ignores corrupt storage", () => {
    store.set("microai_pending_purchases", "{not json");
    expect(loadPending(WALLET)).toEqual([]);
    store.set("microai_pending_purchases", JSON.stringify([{ txHash: "nope" }, null, 5]));
    expect(loadPending(WALLET)).toEqual([]);
  });

  it("removePending clears one entry", () => {
    savePending(entry());
    removePending(HASH.toUpperCase().replace("0X", "0x"));
    expect(stored()).toEqual([]);
  });
});

describe("submitPurchase classification (scripted fetch)", () => {
  const answer = (status: number, body: object) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it.each([
    [200, { credits: 7, added: 5 }, { kind: "credited", credits: 7, added: 5 }],
    [401, { code: "session_required" }, { kind: "auth" }],
    [409, { error: "This payment has already been credited.", reason: "already_used", retryable: false }, { kind: "already" }],
    [402, { error: "not yet", reason: "not_found", retryable: true }, { kind: "retry" }],
    [503, { error: "node down", reason: "rpc_unavailable", retryable: true }, { kind: "retry" }],
    [500, { error: "boom" }, { kind: "retry" }],
    [402, { error: "Transfer sender does not match your session wallet.", reason: "wrong_sender", retryable: false }, { kind: "rejected" }],
  ])("HTTP %i -> %j", async (status, body, expected) => {
    expect(await submitPurchase({ txHash: HASH, queries: 5 }, answer(status, body))).toMatchObject(expected);
  });

  it("a network error is retried, not shown as a failure", async () => {
    const down = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect((await submitPurchase({ txHash: HASH, queries: 5 }, down)).kind).toBe("retry");
  });

  it("recovery omits queries from the request", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ credits: 1, added: 1 }), { status: 200 }));
    await submitPurchase({ txHash: HASH }, f as unknown as typeof fetch);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ txHash: HASH });
  });
});

describe("resolving a pending payment", () => {
  const script = (outcomes: SubmitOutcome[]) => {
    let i = 0;
    return vi.fn(async () => outcomes[Math.min(i++, outcomes.length - 1)]);
  };
  const noSleep = vi.fn(async () => {});

  it("slow receipt: keeps retrying, stays saved the whole time, clears only on success", async () => {
    savePending(entry());
    const seenWhileWaiting: number[] = [];
    const submit = vi.fn(async () => {
      seenWhileWaiting.push(stored().length);
      return seenWhileWaiting.length < 4 ? ({ kind: "retry", message: "not yet" } as SubmitOutcome) : ({ kind: "credited", credits: 5, added: 5 } as SubmitOutcome);
    });
    const status = vi.fn();
    const result = await resolvePurchase(entry(), { submit, ensureSession: async () => true, sleep: noSleep, onStatus: status });
    expect(result).toEqual({ status: "credited", credits: 5 });
    expect(seenWhileWaiting).toEqual([1, 1, 1, 1]);
    expect(stored()).toEqual([]);
    expect(status).toHaveBeenCalledWith("Payment pending, verifying…");
    expect(noSleep.mock.calls.map((c) => (c as unknown as [number])[0])).toEqual([3000, 5000, 8000]); // backoff
  });

  it("tab closed then reopened: the saved entry is picked up and credited", async () => {
    savePending(entry()); // first visit: paid, then the tab closed
    // second visit, fresh state: only localStorage survives
    const [resumed] = loadPending(WALLET);
    expect(resumed.txHash).toBe(HASH);
    const result = await resolvePurchase(resumed, { submit: script([{ kind: "credited", credits: 5, added: 5 }]), ensureSession: async () => true, sleep: noSleep });
    expect(result.status).toBe("credited");
    expect(loadPending(WALLET)).toEqual([]);
  });

  it("no session: signs in once, then submits again straight away", async () => {
    savePending(entry());
    const ensure = vi.fn(async () => true);
    const submit = script([{ kind: "auth" }, { kind: "credited", credits: 5, added: 5 }]);
    expect((await resolvePurchase(entry(), { submit, ensureSession: ensure, sleep: noSleep })).status).toBe("credited");
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("no session and sign-in declined: stays saved for later, never loops", async () => {
    savePending(entry());
    const result = await resolvePurchase(entry(), { submit: script([{ kind: "auth" }]), ensureSession: async () => false, sleep: noSleep });
    expect(result.status).toBe("needs-session");
    expect(stored()).toHaveLength(1);
  });

  it("a definitive rejection (wrong sender / amount / recipient) clears the entry and reports why", async () => {
    savePending(entry());
    const result = await resolvePurchase(entry(), { submit: script([{ kind: "rejected", message: "Transfer sender does not match your session wallet." }]), ensureSession: async () => true, sleep: noSleep });
    expect(result).toEqual({ status: "rejected", message: "Transfer sender does not match your session wallet." });
    expect(stored()).toEqual([]);
  });

  it("an already-credited payment (replayed txHash) clears the entry without crediting again", async () => {
    savePending(entry());
    const result = await resolvePurchase(entry(), { submit: script([{ kind: "already", message: "already credited" }]), ensureSession: async () => true, sleep: noSleep });
    expect(result.status).toBe("already");
    expect(stored()).toEqual([]);
  });

  it("gives up after the attempt budget but keeps the payment saved for the next visit", async () => {
    savePending(entry());
    const submit = script([{ kind: "retry", message: "still not mined" }]);
    const result = await resolvePurchase(entry(), { submit, ensureSession: async () => true, sleep: noSleep, maxAttempts: 5 });
    expect(result.status).toBe("gave-up");
    expect(submit).toHaveBeenCalledTimes(5);
    expect(stored()).toHaveLength(1);
  });
});
