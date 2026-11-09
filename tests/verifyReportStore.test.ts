import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRedis } from "./helpers/fakeRedis";

// MOCKS: Redis (in-memory fake). Nothing touches the network.
let redis = makeFakeRedis();
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

import { REPORT_TTL_SEC, deleteReport, isDeleteToken, isReportId, loadReport, sanitizeResult, saveReport, type SharedResult } from "@/lib/verify/reportStore";
import type { Finding } from "@/lib/verify/types";

const finding = (over: Partial<Finding> = {}): Finding => ({ id: "x", severity: "ok", title: "t", reason: "r", ...over });
const counts = { ok: 1, info: 0, warning: 0, error: 0 };
const result = (over: Partial<SharedResult> = {}): SharedResult => ({
  url: "https://example.com/api",
  httpStatus: 402,
  report: { findings: [finding()], counts, checked: ["a"], notChecked: ["b"] },
  ...over,
});

beforeEach(() => {
  redis = makeFakeRedis();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("saveReport / loadReport", () => {
  it("round-trips a result under a random 22-character id", async () => {
    const saved = await saveReport(result());
    expect(saved).not.toBeNull();
    expect(isReportId(saved!.id)).toBe(true);
    expect(isDeleteToken(saved!.deleteToken)).toBe(true);
    const loaded = await loadReport(saved!.id);
    expect(loaded?.result.url).toBe("https://example.com/api");
    expect(loaded?.result.report?.findings[0].title).toBe("t");
  });

  it("gives every report a different id and delete token", async () => {
    const a = await saveReport(result());
    const b = await saveReport(result());
    expect(a!.id).not.toBe(b!.id);
    expect(a!.deleteToken).not.toBe(b!.deleteToken);
  });

  it("expires after 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    const saved = await saveReport(result());
    expect(REPORT_TTL_SEC).toBe(30 * 86_400);
    vi.setSystemTime(new Date("2026-12-08T00:00:00Z"));
    expect(await loadReport(saved!.id)).not.toBeNull();
    vi.setSystemTime(new Date("2026-12-10T00:00:00Z"));
    expect(await loadReport(saved!.id)).toBeNull();
  });

  it("reports when the link stops working", async () => {
    const saved = await saveReport(result(), new Date("2026-11-09T00:00:00Z"));
    expect(saved!.expiresAt).toBe("2026-12-09T00:00:00.000Z");
  });

  it("never stores the delete token in plain text", async () => {
    const saved = await saveReport(result());
    const raw = JSON.stringify(await redis.get(`microai:vreport:${saved!.id}`));
    expect(raw).not.toContain(saved!.deleteToken);
  });

  it("does not look anything up for an id that is not well formed", async () => {
    const spy = vi.spyOn(redis, "get");
    for (const bad of ["", "short", "../../etc/passwd", "a".repeat(23), "a".repeat(21) + "!", "a b".padEnd(22, "c")]) {
      expect(await loadReport(bad)).toBeNull();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null for an unknown id", async () => {
    expect(await loadReport("a".repeat(22))).toBeNull();
  });

  it("returns null for a malformed stored value instead of crashing", async () => {
    const id = "b".repeat(22);
    for (const junk of ["not json", 42, { v: 2 }, { v: 1, createdAt: "x" }, null, [1, 2]]) {
      await redis.set(`microai:vreport:${id}`, junk);
      expect(await loadReport(id)).toBeNull();
    }
  });
});

describe("sanitizeResult", () => {
  it("caps long strings", () => {
    const out = sanitizeResult(result({ url: "https://e.com/" + "a".repeat(5000), report: { findings: [finding({ title: "t".repeat(1000), reason: "r".repeat(5000), evidence: "e".repeat(5000), fix: "f".repeat(5000) })], counts, checked: ["c".repeat(5000)], notChecked: [] } }))!;
    expect(out.url!.length).toBeLessThanOrEqual(2048);
    const f = out.report!.findings[0];
    expect(f.title.length).toBeLessThanOrEqual(200);
    expect(f.reason.length).toBeLessThanOrEqual(600);
    expect(f.evidence!.length).toBeLessThanOrEqual(600);
    expect(f.fix!.length).toBeLessThanOrEqual(600);
    expect(out.report!.checked[0].length).toBeLessThanOrEqual(300);
  });

  it("caps the number of findings", () => {
    const out = sanitizeResult(result({ report: { findings: Array.from({ length: 500 }, () => finding()), counts, checked: [], notChecked: [] } }))!;
    expect(out.report!.findings).toHaveLength(100);
  });

  it("drops fields it does not know, at every level", () => {
    const dirty = { ...result(), evil: "<script>alert(1)</script>", report: { findings: [{ ...finding(), html: "<img onerror=x>" }], counts, checked: [], notChecked: [], extra: 1 } } as unknown as SharedResult;
    const out = sanitizeResult(dirty)! as Record<string, unknown>;
    expect(out.evil).toBeUndefined();
    const rep = out.report as Record<string, unknown>;
    expect(rep.extra).toBeUndefined();
    expect((rep.findings as Record<string, unknown>[])[0].html).toBeUndefined();
  });

  it("drops findings with an unknown severity", () => {
    const bad = { ...finding(), severity: "critical" } as unknown as Finding;
    const out = sanitizeResult(result({ report: { findings: [bad, finding()], counts, checked: [], notChecked: [] } }))!;
    expect(out.report!.findings).toHaveLength(1);
  });

  it("returns null when the whole record would be too large", () => {
    const big = Array.from({ length: 100 }, () => finding({ title: "t".repeat(200), reason: "r".repeat(600), evidence: "e".repeat(600), fix: "f".repeat(600) }));
    const r = result({ report: { findings: big, counts, checked: [], notChecked: [] }, transaction: { txHash: "0x" + "a".repeat(64), findings: big, counts } });
    expect(sanitizeResult(r)).toBeNull();
  });

  it("keeps the delivery verdict, capped", () => {
    const out = sanitizeResult(result({ delivery: { status: "delivered", title: "t", reason: "r", evidence: Array(50).fill("e"), notes: Array(50).fill("n") } }))!;
    expect(out.delivery!.evidence).toHaveLength(10);
    expect(out.delivery!.notes).toHaveLength(10);
  });
});

describe("deleteReport", () => {
  it("deletes with the right token", async () => {
    const saved = (await saveReport(result()))!;
    expect(await deleteReport(saved.id, saved.deleteToken)).toBe(true);
    expect(await loadReport(saved.id)).toBeNull();
  });

  it("keeps the report when the token is wrong", async () => {
    const saved = (await saveReport(result()))!;
    expect(await deleteReport(saved.id, "z".repeat(22))).toBe(false);
    expect(await loadReport(saved.id)).not.toBeNull();
  });

  it("one report's token cannot delete another report", async () => {
    const a = (await saveReport(result()))!;
    const b = (await saveReport(result()))!;
    expect(await deleteReport(a.id, b.deleteToken)).toBe(false);
    expect(await loadReport(a.id)).not.toBeNull();
  });

  it("is false for a missing report, a malformed id or a malformed token", async () => {
    const saved = (await saveReport(result()))!;
    expect(await deleteReport("a".repeat(22), saved.deleteToken)).toBe(false);
    expect(await deleteReport("nope", saved.deleteToken)).toBe(false);
    expect(await deleteReport(saved.id, "nope")).toBe(false);
    expect(await loadReport(saved.id)).not.toBeNull();
  });
});
