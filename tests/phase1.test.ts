import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake), next/headers (session cookie) and groq-sdk (spy). No network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
const cookieJar: { value?: string } = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "microai_session" && cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("groq-sdk", () => ({ default: class { chat = { completions: { create } }; } }));

import { POST as chatPost } from "@/app/api/chat/route";
import { POST as copilotPost } from "@/app/api/copilot/route";
import { POST as purchasePost } from "@/app/api/credits/purchase/route";
import { issueSessionToken } from "@/lib/session";
import { creditKey, getCredit, refundCredit } from "@/lib/credits";
import { isCrossSiteRequest } from "@/lib/csrf";
import { isPaused } from "@/lib/killSwitch";

const WALLET = "0x" + "2".repeat(40);
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://microai.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  redis = makeFakeRedis();
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.PAUSE_AI;
  delete process.env.PAUSE_PURCHASES;
  cookieJar.value = issueSessionToken(WALLET);
  create.mockReset();
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});

describe("credit refund when the AI fails", () => {
  it("chat: an AI error gives the credit back and says so", async () => {
    await redis.set(creditKey(WALLET), 3);
    create.mockRejectedValue(new Error("groq down"));
    const res = await chatPost(post("/api/chat", { message: "What is Arc?" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reply).toMatch(/refunded/i);
    expect(body.credits).toBe(3);
    expect(await getCredit(WALLET)).toBe(3);
  });

  it("chat: an empty AI answer is refunded too", async () => {
    await redis.set(creditKey(WALLET), 3);
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] });
    const body = await (await chatPost(post("/api/chat", { message: "What is Arc?" }))).json();
    expect(body.credits).toBe(3);
    expect(await getCredit(WALLET)).toBe(3);
  });

  it("chat: a good answer still costs exactly one credit", async () => {
    await redis.set(creditKey(WALLET), 3);
    create.mockResolvedValue({ choices: [{ message: { content: "Arc is a chain." } }] });
    const body = await (await chatPost(post("/api/chat", { message: "What is Arc?" }))).json();
    expect(body.reply).toBe("Arc is a chain.");
    expect(body.credits).toBe(2);
    expect(await getCredit(WALLET)).toBe(2);
  });

  it("copilot: an AI error gives the credit back", async () => {
    await redis.set(creditKey(WALLET), 3);
    create.mockRejectedValue(new Error("groq down"));
    const body = await (await copilotPost(post("/api/copilot", { message: "Write a USDC contract" }))).json();
    expect(body.reply).toMatch(/refunded/i);
    expect(await getCredit(WALLET)).toBe(3);
  });

  it("refundCredit adds one credit and keeps it permanent", async () => {
    await redis.set(creditKey(WALLET), 4, { ex: 1000 });
    expect(await refundCredit(WALLET)).toBe(5);
    expect(await redis.ttl(creditKey(WALLET))).toBe(-1);
  });

  it("no credit is spent or refunded when the user has none", async () => {
    const res = await chatPost(post("/api/chat", { message: "hi" }));
    expect(res.status).toBe(402);
    expect(await getCredit(WALLET)).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("kill switch", () => {
  it("isPaused reads 1/true only", () => {
    expect(isPaused("ai", { PAUSE_AI: "1" })).toBe(true);
    expect(isPaused("ai", { PAUSE_AI: "TRUE" })).toBe(true);
    expect(isPaused("ai", { PAUSE_AI: "0" })).toBe(false);
    expect(isPaused("ai", {})).toBe(false);
    expect(isPaused("purchases", { PAUSE_AI: "1" })).toBe(false);
  });

  it("PAUSE_AI stops chat before any credit is spent or AI called", async () => {
    process.env.PAUSE_AI = "1";
    await redis.set(creditKey(WALLET), 3);
    const res = await chatPost(post("/api/chat", { message: "hi" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("paused");
    expect(await getCredit(WALLET)).toBe(3);
    expect(create).not.toHaveBeenCalled();
  });

  it("PAUSE_PURCHASES stops purchases but not chat", async () => {
    process.env.PAUSE_PURCHASES = "1";
    const res = await purchasePost(post("/api/credits/purchase", { txHash: "0x" + "a".repeat(64), queries: 5 }));
    expect(res.status).toBe(503);
    await redis.set(creditKey(WALLET), 2);
    create.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    expect((await chatPost(post("/api/chat", { message: "hi" }))).status).toBe(200);
  });
});

describe("cross-site write guard", () => {
  const r = (method: string, headers: Record<string, string>) => new Request("https://microai.example/api/x", { method, headers });

  it("allows same-origin, no-header and safe-method requests", () => {
    expect(isCrossSiteRequest(r("POST", { origin: "https://microai.example" }))).toBe(false);
    expect(isCrossSiteRequest(r("POST", {}))).toBe(false);
    expect(isCrossSiteRequest(r("POST", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteRequest(r("GET", { origin: "https://evil.example" }))).toBe(false);
  });

  it("blocks a foreign or null Origin and a cross-site fetch", () => {
    expect(isCrossSiteRequest(r("POST", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "https://microai.example.evil.com" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "null" }))).toBe(true);
    expect(isCrossSiteRequest(r("POST", { origin: "not a url" }))).toBe(true);
    expect(isCrossSiteRequest(r("DELETE", { "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("a routed POST from another site gets 403 and runs nothing", async () => {
    await redis.set(creditKey(WALLET), 3);
    const res = await chatPost(post("/api/chat", { message: "hi" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
    expect(await getCredit(WALLET)).toBe(3);
  });

  it("the site's own Origin still works end to end", async () => {
    await redis.set(creditKey(WALLET), 3);
    create.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    const res = await chatPost(post("/api/chat", { message: "hi" }, { origin: "https://microai.example" }));
    expect(res.status).toBe(200);
  });
});
