import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (fake), next/headers and the facilitator fetch. No network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const { fetchSupportedMock } = vi.hoisted(() => ({ fetchSupportedMock: vi.fn() }));
vi.mock("@/lib/verify/facilitator", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/verify/facilitator")>()), fetchSupported: fetchSupportedMock }));

import { GET } from "@/app/api/facilitator/route";
import { summariseSupported, supportedUrl } from "@/lib/verify/facilitator";
import { SafeFetchError } from "@/lib/safeFetch";

const U = "https://fac.example/supported";
const sum = (body: unknown, expected?: "mainnet" | "testnet", status = 200) => summariseSupported({ url: U, httpStatus: status, body: typeof body === "string" ? body : JSON.stringify(body), expected });
const kinds = (...k: Array<[string, string, number?]>) => ({ kinds: k.map(([scheme, network, v]) => ({ x402Version: v ?? 2, scheme, network })) });

describe("supportedUrl", () => {
  it("adds /supported to a plain https base and refuses everything else", () => {
    expect(supportedUrl("https://fac.example")).toBe("https://fac.example/supported");
    expect(supportedUrl("https://fac.example/v1/")).toBe("https://fac.example/v1/supported");
    for (const bad of ["http://fac.example", "https://fac.example?x=1", "https://fac.example#a", "ftp://x", "nope", ""]) expect(supportedUrl(bad)).toBeNull();
  });
});

describe("summariseSupported", () => {
  it("passes when the expected Arc network is listed with exact, and calls it a claim", () => {
    const r = sum(kinds(["exact", "eip155:5042"], ["exact", "eip155:8453"]), "mainnet");
    expect(r.result).toBe("pass");
    expect(r.arc).toEqual({ mainnet: ["exact"], testnet: [] });
    expect(r.summary).toMatch(/its own claim/);
    expect(r.disclaimer).toMatch(/not proof that payments settle/);
    expect(r.notChecked.join(" ")).toMatch(/\/verify and \/settle/);
  });
  it("fails when the expected network is missing, even if the other Arc network is listed", () => {
    expect(sum(kinds(["exact", "eip155:5042002"]), "mainnet")).toMatchObject({ result: "fail", issues: [{ id: "supported.network" }] });
  });
  it("without an expected network: warns when no Arc network is listed, passes when one is", () => {
    expect(sum(kinds(["exact", "eip155:8453"]))).toMatchObject({ result: "warn", issues: [{ id: "supported.no_arc" }] });
    expect(sum(kinds(["exact", "eip155:5042002"])).result).toBe("pass");
  });
  it("warns when Arc is listed only with another scheme, or only as x402 v1", () => {
    expect(sum(kinds(["upto", "eip155:5042"]), "mainnet")).toMatchObject({ result: "warn", issues: [{ id: "supported.scheme" }] });
    expect(sum(kinds(["exact", "eip155:5042", 1]), "mainnet")).toMatchObject({ result: "warn", issues: [{ id: "supported.version" }] });
  });
  it("fails on a bad status, non-JSON, a missing kinds list, or an empty one", () => {
    expect(sum("{}", undefined, 500).issues[0].id).toBe("supported.status");
    expect(sum("<html>").issues[0].id).toBe("supported.json");
    expect(sum({ nope: 1 }).issues[0].id).toBe("supported.kinds");
    expect(sum({ kinds: [] }).issues[0].id).toBe("supported.empty");
  });
  it("ignores malformed entries and caps what it reads", () => {
    const r = sum({ kinds: [null, 5, { scheme: 1 }, ...Array.from({ length: 200 }, () => ({ scheme: "exact", network: "eip155:1" }))] });
    expect(r.kinds).toHaveLength(47); // only the first 50 entries are read; 3 of them were malformed
  });
});

describe("GET /api/facilitator", () => {
  const get = (qs: string, ip = "198.51.100.120") => GET(new Request(`https://microai.example/api/facilitator?${qs}`, { headers: { "x-forwarded-for": ip } }));
  const q = (u: string, extra = "") => `url=${encodeURIComponent(u)}${extra}`;
  beforeEach(() => {
    redis = makeFakeRedis();
    fetchSupportedMock.mockReset();
    fetchSupportedMock.mockResolvedValue({ url: U, status: 200, body: JSON.stringify(kinds(["exact", "eip155:5042002"])) });
    for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation(() => {});
    delete process.env.PAUSE_VERIFY;
  });

  it("answers the summary and makes exactly one GET /supported call", async () => {
    const res = await get(q("https://fac.example", "&network=testnet"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ version: 1, result: "pass", arc: { testnet: ["exact"] } });
    expect(fetchSupportedMock).toHaveBeenCalledTimes(1);
    expect(fetchSupportedMock).toHaveBeenCalledWith("https://fac.example");
  });
  it("rejects non-https and bad URLs without fetching", async () => {
    expect((await get(q("http://fac.example"))).status).toBe(400);
    expect((await get(q("https://fac.example?x=1"))).status).toBe(400);
    expect(fetchSupportedMock).not.toHaveBeenCalled();
  });
  it("a refused destination is a 400, an unreachable one is a summary", async () => {
    fetchSupportedMock.mockRejectedValueOnce(new SafeFetchError("blocked_address"));
    expect((await get(q("https://fac.example"))).status).toBe(400);
    fetchSupportedMock.mockRejectedValueOnce(new SafeFetchError("timeout"));
    const res = await get(q("https://fac2.example"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "unreachable" });
  });
  it("PAUSE_VERIFY stops it, Redis down fails closed, and one host is capped", async () => {
    process.env.PAUSE_VERIFY = "1";
    expect((await get(q("https://fac.example"))).status).toBe(503);
    delete process.env.PAUSE_VERIFY;
    redis.multi = () => {
      throw new Error("redis down");
    };
    expect((await get(q("https://fac.example"), "198.51.100.121")).status).toBe(503);
    expect(fetchSupportedMock).not.toHaveBeenCalled();
  });
  it("caps how often one host is asked", async () => {
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await get(q("https://capped.example"), `198.51.100.${130 + i}`)).status;
    expect(last).toBe(429);
  });
  it("never calls /verify or /settle and never takes a payment", () => {
    const src = ["lib/verify/facilitator.ts", "lib/verify/facilitatorCheck.ts", "app/api/facilitator/route.ts"].map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/\+\s*["'`]\/(verify|settle)|\/settle["'`]|\/verify["'`]|method:\s*["']POST|PAYMENT-SIGNATURE|payment-signature/);
  });
});
