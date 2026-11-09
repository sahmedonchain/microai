import { describe, expect, it } from "vitest";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";
import { TRUST_DISCLAIMER, buildTrustSummary, buildUnreachableSummary } from "@/lib/verify/trust";
import type { EndpointResponse, Finding, VerifyReport } from "@/lib/verify/types";

const NOW = new Date("2026-11-10T00:00:00Z");
const lab = (id: string): EndpointResponse => {
  const a = buildLabAnswer(findLabCase(id)!);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) headers[k.toLowerCase()] = v;
  return { status: a.status, headers, body: a.body };
};
const summarize = (id: string) => {
  const res = lab(id);
  return buildTrustSummary({ url: `https://example.com/${id}`, httpStatus: res.status, report: verifyEndpointResponse(res), now: NOW });
};

describe("buildTrustSummary on the lab endpoints", () => {
  it("pass: a correct setup, with no issues listed", () => {
    const s = summarize("good");
    expect(s.result).toBe("pass");
    expect(s.counts.error).toBe(0);
    expect(s.issues).toEqual([]);
    expect(s.arcNetworks.length).toBeGreaterThan(0);
  });

  it.each(["decimals18", "testnet-address-on-mainnet", "wrong-chain-id", "bad-recipient", "malformed-header", "server-error"])("fail: %s", (id) => {
    const s = summarize(id);
    expect(s.result).toBe("fail");
    expect(s.issues.length).toBeGreaterThan(0);
    expect(s.issues[0].severity).toBe("error");
  });

  it("lists only errors and warnings, errors first", () => {
    for (const id of ["decimals18", "bad-recipient", "good"]) {
      const sev = summarize(id).issues.map((i) => i.severity);
      expect(sev.every((v) => v === "error" || v === "warning")).toBe(true);
      expect(sev).toEqual([...sev].sort((a, b) => (a === b ? 0 : a === "error" ? -1 : 1)));
    }
  });

  it("carries the endpoint, host, time and version", () => {
    const s = summarize("good");
    expect(s.version).toBe(1);
    expect(s.checkedAt).toBe("2026-11-10T00:00:00.000Z");
    expect(s.endpoint).toMatchObject({ url: "https://example.com/good", host: "example.com", httpStatus: 402 });
  });

  it("always carries the disclaimer and never says 'safe' or 'trusted'", () => {
    for (const id of ["good", "decimals18", "server-error"]) {
      const s = summarize(id);
      expect(s.disclaimer).toBe(TRUST_DISCLAIMER);
      expect(s.disclaimer).toMatch(/not a guarantee of safety/);
      expect(s.summary.toLowerCase()).not.toMatch(/\b(safe|trusted|trustworthy|legit)\b/);
    }
  });
});

describe("buildTrustSummary result rules", () => {
  const report = (findings: Finding[]): VerifyReport => ({
    findings,
    counts: { ok: 0, info: 0, warning: 0, error: 0 },
    checked: [],
    notChecked: ["n"],
  });
  const f = (severity: Finding["severity"], id = "x"): Finding => ({ id, severity, title: "t", reason: "r" });

  it("warn when there are warnings and no errors", () => {
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: report([f("warning"), f("ok")]) }).result).toBe("warn");
  });
  it("fail wins over warn", () => {
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: report([f("warning"), f("error")]) }).result).toBe("fail");
  });
  it("pass with only ok and info", () => {
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: report([f("ok"), f("info")]) }).result).toBe("pass");
  });
  it("caps the issue list at 20", () => {
    const many = Array.from({ length: 80 }, (_, i) => f("error", `e${i}`));
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: report(many) }).issues).toHaveLength(20);
  });
  it("recomputes counts from the findings instead of trusting the report's", () => {
    const r = report([f("error")]);
    r.counts = { ok: 99, info: 0, warning: 0, error: 0 };
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: r }).counts.error).toBe(1);
  });
  it("reads Arc networks only from passing network findings", () => {
    const r = report([
      { id: "accepts[0].network", severity: "ok", title: "Network is Arc Mainnet", reason: "r" },
      { id: "accepts[1].network", severity: "error", title: "Network is Arc Testnet", reason: "r" },
      { id: "accepts[2].network", severity: "ok", title: "Network is Arc Testnet", reason: "r" },
    ]);
    expect(buildTrustSummary({ url: "https://a.example", httpStatus: 402, report: r }).arcNetworks.sort()).toEqual(["mainnet", "testnet"]);
  });
});

describe("buildUnreachableSummary", () => {
  it("is 'unreachable', not 'pass' or 'fail', and says nothing was checked", () => {
    const s = buildUnreachableSummary({ url: "https://down.example/x", reason: "The endpoint did not answer within 5 seconds.", now: NOW });
    expect(s.result).toBe("unreachable");
    expect(s.endpoint.httpStatus).toBeUndefined();
    expect(s.arcNetworks).toEqual([]);
    expect(s.issues[0].title).toMatch(/5 seconds/);
    expect(s.notChecked[0]).toMatch(/did not answer/);
    expect(s.disclaimer).toBe(TRUST_DISCLAIMER);
  });
});
