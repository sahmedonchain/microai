import { describe, it, expect } from "vitest";
import { usdcToUnits, verdict, sumCounts, reportToText } from "@/lib/verify/ui";
import type { Finding } from "@/lib/verify/types";

describe("usdcToUnits", () => {
  it.each([
    ["0.001", "1000"],
    ["1", "1000000"],
    ["12.5", "12500000"],
    ["0", "0"],
    ["0.000001", "1"],
    ["007.5", "7500000"],
    [" 0.01 ", "10000"],
  ])("%s -> %s", (input, units) => {
    expect(usdcToUnits(input)).toBe(units);
  });

  it.each(["", ".5", "-1", "1e3", "0.0000001", "1,5", "abc", "1.", "1234567890123456789"])("rejects %j", (input) => {
    expect(usdcToUnits(input)).toBeNull();
  });
});

describe("verdict", () => {
  const c = (error: number, warning: number) => ({ ok: 3, info: 0, warning, error });

  it("says problems found when there is any error", () => {
    expect(verdict(c(1, 2))).toEqual({ tone: "error", text: "1 problem found" });
    expect(verdict(c(3, 0)).text).toBe("3 problems found");
  });

  it("says no errors but warnings otherwise", () => {
    expect(verdict(c(0, 1))).toEqual({ tone: "warning", text: "No errors, 1 warning to look at" });
    expect(verdict(c(0, 2)).text).toBe("No errors, 2 warnings to look at");
  });

  it("a clean result never claims everything is fine, only that nothing was found in what was checked", () => {
    const v = verdict(c(0, 0));
    expect(v.tone).toBe("ok");
    expect(v.text).toBe("No problems found in the checks we ran");
  });
});

describe("sumCounts", () => {
  it("adds report and transaction counts and ignores missing parts", () => {
    expect(sumCounts({ ok: 1, info: 1, warning: 1, error: 1 }, undefined, { ok: 2, info: 0, warning: 0, error: 3 })).toEqual({ ok: 3, info: 1, warning: 1, error: 4 });
    expect(sumCounts()).toEqual({ ok: 0, info: 0, warning: 0, error: 0 });
  });
});

describe("reportToText", () => {
  const f: Finding = { id: "a", severity: "error", title: "Amount looks like 18 decimals", reason: "Because.", evidence: 'amount: "1"', fix: "Use 1000000." };

  it("lists every finding with severity, reason, evidence and fix", () => {
    const t = reportToText({ url: "https://api.example.com/paid", httpStatus: 402, findings: [f] });
    expect(t).toContain("Endpoint: https://api.example.com/paid (HTTP 402)");
    expect(t).toContain("[Error] Amount looks like 18 decimals");
    expect(t).toContain('Evidence: amount: "1"');
    expect(t).toContain("Fix: Use 1000000.");
  });

  it("includes the transaction and what was not checked, so a pasted report is not over-read", () => {
    const t = reportToText({
      findings: [],
      txHash: "0xabc",
      explorerUrl: "https://explorer.arc.io/tx/0xabc",
      txFindings: [{ ...f, severity: "ok", title: "Transaction succeeded" }],
      notChecked: ["No payment was sent"],
    });
    expect(t).toContain("Transaction: 0xabc");
    expect(t).toContain("[Passed] Transaction succeeded");
    expect(t).toContain("Not checked:");
    expect(t).toContain("- No payment was sent");
  });
});
