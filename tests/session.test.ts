import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis is an in-memory fake and next/headers is stubbed. Signatures are
// real: messages are signed with a freshly generated ethers wallet.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
const cookieJar: { value?: string } = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "microai_session" && cookieJar.value ? { value: cookieJar.value } : undefined) }),
}));

import { GET as nonceGET } from "@/app/api/session/nonce/route";
import { GET as sessionGET, POST as sessionPOST, DELETE as sessionDELETE } from "@/app/api/session/route";
import { buildSiweMessage, parseSiweMessage } from "@/lib/siwe";
import { verifySessionToken } from "@/lib/session";

const HOST = "microai.example";
const headers = { host: HOST, "x-forwarded-for": "198.51.100.7" };
const wallet = ethers.Wallet.createRandom();

async function getNonce(address = wallet.address) {
  const res = await nonceGET(new Request(`https://${HOST}/api/session/nonce?address=${address}`, { headers }));
  return { res, body: await res.json() };
}
const postSession = (payload: unknown) =>
  sessionPOST(new Request(`https://${HOST}/api/session`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(payload) }));

beforeEach(() => {
  redis = makeFakeRedis();
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.SIWE_DOMAIN;
  cookieJar.value = undefined;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe("sign-in with Ethereum (fake Redis, real signatures)", () => {
  it("issues an EIP-4361 message for Arc Mainnet bound to the request host", async () => {
    const { res, body } = await getNonce();
    expect(res.status).toBe(200);
    const f = parseSiweMessage(body.message)!;
    expect(f).toMatchObject({ domain: HOST, uri: `https://${HOST}`, chainId: 5042, version: "1", address: wallet.address });
    expect(Date.parse(f.expirationTime) - Date.parse(f.issuedAt)).toBe(5 * 60_000);
  });

  it("stores the nonce in Redis with a short TTL", async () => {
    const { body } = await getNonce();
    const nonce = parseSiweMessage(body.message)!.nonce;
    const key = `microai:siwe:nonce:${nonce}`;
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it("completes sign-in and sets an httpOnly session cookie", async () => {
    const { body } = await getNonce();
    const signature = await wallet.signMessage(body.message);
    const res = await postSession({ address: wallet.address, signature, message: body.message });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("microai_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
    const token = /microai_session=([^;]+)/.exec(cookie)![1];
    expect(verifySessionToken(token)?.sub).toBe(wallet.address.toLowerCase());
  });

  it("deletes the nonce on use, so a replay fails", async () => {
    const { body } = await getNonce();
    const signature = await wallet.signMessage(body.message);
    const payload = { address: wallet.address, signature, message: body.message };
    expect((await postSession(payload)).status).toBe(200);
    expect(await redis.get(`microai:siwe:nonce:${parseSiweMessage(body.message)!.nonce}`)).toBeNull();
    const replay = await postSession(payload);
    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toMatch(/expired or already used/);
  });

  it("burns the nonce even when the signature is wrong", async () => {
    const { body } = await getNonce();
    const other = ethers.Wallet.createRandom();
    const bad = await postSession({ address: wallet.address, signature: await other.signMessage(body.message), message: body.message });
    expect(bad.status).toBe(401);
    const retry = await postSession({ address: wallet.address, signature: await wallet.signMessage(body.message), message: body.message });
    expect(retry.status).toBe(400);
  });

  it("rejects a message for a different domain", async () => {
    const { body } = await getNonce();
    const f = parseSiweMessage(body.message)!;
    const forged = buildSiweMessage({ ...f, domain: "evil.example", uri: "https://evil.example" });
    // The attacker needs the victim to sign it; the server must still refuse it.
    redis.clear();
    await redis.set(`microai:siwe:nonce:${f.nonce}`, { address: wallet.address.toLowerCase(), message: forged, expiresAt: f.expirationTime }, { ex: 300 });
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(forged), message: forged });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/different domain/);
  });

  it("rejects a message for the wrong chain", async () => {
    const { body } = await getNonce();
    const f = parseSiweMessage(body.message)!;
    const forged = buildSiweMessage({ ...f, chainId: 1 });
    await redis.set(`microai:siwe:nonce:${f.nonce}`, { address: wallet.address.toLowerCase(), message: forged, expiresAt: f.expirationTime }, { ex: 300 });
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(forged), message: forged });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/different chain/);
  });

  it("rejects a tampered message even with a valid signature over it", async () => {
    const { body } = await getNonce();
    const tampered = body.message.replace("This does not authorize any payment.", "Authorize everything.");
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(tampered), message: tampered });
    expect(res.status).toBe(400);
  });

  it("rejects an expired request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    const { body } = await getNonce();
    const signature = await wallet.signMessage(body.message);
    vi.setSystemTime(new Date("2026-10-09T12:06:00Z"));
    const res = await postSession({ address: wallet.address, signature, message: body.message });
    expect(res.status).toBe(400);
  });

  it("rejects a body whose address differs from the signed one", async () => {
    const { body } = await getNonce();
    const other = ethers.Wallet.createRandom();
    const res = await postSession({ address: other.address, signature: await wallet.signMessage(body.message), message: body.message });
    expect(res.status).toBe(400);
  });

  it("requires the message (older clients are told to reload)", async () => {
    const { body } = await getNonce();
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(body.message) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/message/i);
  });

  it("does not let one caller overwrite another wallet's pending nonce", async () => {
    const a = await getNonce(wallet.address);
    await getNonce(ethers.Wallet.createRandom().address);
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(a.body.message), message: a.body.message });
    expect(res.status).toBe(200);
  });

  it("rate-limits the nonce endpoint per address with Retry-After", async () => {
    for (let i = 0; i < 5; i++) expect((await getNonce()).res.status).toBe(200);
    const limited = await getNonce();
    expect(limited.res.status).toBe(429);
    expect(Number(limited.res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });

  it("rate-limits the nonce endpoint per IP", async () => {
    for (let i = 0; i < 10; i++) expect((await getNonce(ethers.Wallet.createRandom().address)).res.status).toBe(200);
    expect((await getNonce(ethers.Wallet.createRandom().address)).res.status).toBe(429);
  });

  it("honours SIWE_DOMAIN when set", async () => {
    process.env.SIWE_DOMAIN = "app.microai.example";
    const { body } = await getNonce();
    expect(parseSiweMessage(body.message)!.domain).toBe("app.microai.example");
  });

  it("GET reflects the cookie and DELETE clears it", async () => {
    expect(await (await sessionGET(new Request(`https://${HOST}/api/session`, { headers }))).json()).toEqual({ authenticated: false });
    const { body } = await getNonce();
    const res = await postSession({ address: wallet.address, signature: await wallet.signMessage(body.message), message: body.message });
    cookieJar.value = /microai_session=([^;]+)/.exec(res.headers.get("set-cookie")!)![1];
    const me = await (await sessionGET(new Request(`https://${HOST}/api/session`, { headers }))).json();
    expect(me).toMatchObject({ authenticated: true, address: wallet.address.toLowerCase() });
    const out = await sessionDELETE(new Request(`https://${HOST}/api/session`, { method: "DELETE", headers }));
    expect(out.headers.get("set-cookie")).toMatch(/microai_session=;|Max-Age=0/i);
  });
});
