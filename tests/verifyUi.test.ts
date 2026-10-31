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

import { groupFindings } from "@/lib/verify/ui";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { PAYMENT_RECEIVER, USDC_ADDRESS } from "@/lib/arcConfig";

describe("groupFindings", () => {
  const opt = (over: Record<string, unknown> = {}) => ({
    scheme: "exact",
    network: "eip155:5042",
    amount: "1000",
    asset: USDC_ADDRESS,
    payTo: PAYMENT_RECEIVER,
    maxTimeoutSeconds: 60,
    extra: { name: "USDC", version: "2" },
    ...over,
  });
  const run = (accepts: unknown[]) => {
    const payload = { x402Version: 2, accepts };
    const header = Buffer.from(JSON.stringify(payload)).toString("base64");
    return verifyEndpointResponse({ status: 402, headers: { "payment-required": header }, body: "" });
  };

  it("puts Arc options first and folds the other networks into one list", () => {
    const r = run([
      opt({ network: "eip155:8453" }),
      opt({ network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" }),
      opt(),
      opt({ extra: { name: "GatewayWalletBatched", version: "1" }, maxTimeoutSeconds: 604900 }),
      opt({ network: "stellar:pubnet" }),
    ]);
    const g = groupFindings(r.findings);
    expect(g.otherNetworks).toEqual([
      { index: 0, network: "eip155:8453" },
      { index: 1, network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
      { index: 4, network: "stellar:pubnet" },
    ]);
    expect(g.arcOptions.map((o) => [o.index, o.label])).toEqual([
      [2, "Arc Mainnet, exact payment"],
      [3, "Arc Mainnet, Circle Gateway batched"],
    ]);
    expect(g.general).toHaveLength(0);
  });

  it("keeps endpoint-wide findings apart from options", () => {
    const r = verifyEndpointResponse({ status: 200, headers: {}, body: "{}" });
    const g = groupFindings(r.findings);
    expect(g.general.length).toBeGreaterThan(0);
    expect(g.arcOptions).toHaveLength(0);
    expect(g.otherNetworks).toHaveLength(0);
  });

  it("an option with a malformed network stays visible as needing attention, not folded away", () => {
    const g = groupFindings(run([opt({ network: "arc" })]).findings);
    expect(g.otherNetworks).toHaveLength(0);
    expect(g.arcOptions[0].label).toBe("needs attention");
    expect(g.arcOptions[0].findings[0].severity).toBe("error");
  });

  it("a Testnet option is labelled as Testnet", () => {
    const g = groupFindings(run([opt({ network: "eip155:5042002" })]).findings);
    expect(g.arcOptions[0].label).toBe("Arc Testnet, exact payment");
  });

  it("reportToText lists the other networks on one line instead of repeating notes", () => {
    const r = run([opt({ network: "eip155:8453" }), opt({ network: "eip155:137" }), opt()]);
    const t = reportToText({ url: "https://api.example.com/paid", httpStatus: 402, findings: r.findings });
    expect(t).toContain("Option 3: Arc Mainnet, exact payment");
    expect(t).toContain("Other networks, not verified (2): eip155:8453, eip155:137");
    expect(t.match(/Not an Arc network/g)).toBeNull();
  });
});
