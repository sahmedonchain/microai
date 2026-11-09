import { countFindings, sortFindings } from "./checks";
import type { Finding, Severity, VerifyReport } from "./types";

// Trust API summary: a small, stable, machine-readable version of a Verify
// endpoint check, for an agent that wants to ask "is this service's payment
// setup sound?" before paying.
//
// It is a CONFIGURATION check, not a reputation score. It says nothing about who
// runs the service or whether its content is good, and it never says "safe".
// Pure: the route fetches the endpoint, this only shapes the answer. Nothing here
// sends a payment or writes to a chain.

export type TrustResult = "pass" | "warn" | "fail" | "unreachable";

export interface TrustIssue {
  id: string;
  severity: "error" | "warning";
  title: string;
  fix?: string;
}

export interface TrustSummary {
  version: 1;
  checkedAt: string;
  endpoint: { url: string; host: string; httpStatus?: number };
  result: TrustResult;
  summary: string;
  counts: Record<Severity, number>;
  /** Arc networks the endpoint asks to be paid on, from the options that passed the network check. */
  arcNetworks: Array<"mainnet" | "testnet">;
  /** Errors and warnings only, errors first. */
  issues: TrustIssue[];
  notChecked: string[];
  disclaimer: string;
}

export const TRUST_DISCLAIMER =
  "This checks the endpoint's payment setup at the time shown. It is not a rating of the service, its owner or its content, and not a guarantee of safety. MicroAI sends no payment, and an Arc-only check says nothing about other networks.";

const MAX_ISSUES = 20;
const ZERO: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
}

function arcNetworksOf(findings: Finding[]): Array<"mainnet" | "testnet"> {
  const out = new Set<"mainnet" | "testnet">();
  for (const f of findings) {
    if (f.severity !== "ok" || !f.id.endsWith(".network")) continue;
    if (/mainnet/i.test(f.title)) out.add("mainnet");
    else if (/testnet/i.test(f.title)) out.add("testnet");
  }
  return Array.from(out);
}

const SUMMARY: Record<TrustResult, string> = {
  pass: "No problems found in the endpoint's payment setup.",
  warn: "The payment setup works but has warnings worth fixing.",
  fail: "The payment setup has errors. Paying this endpoint may fail or send the wrong amount.",
  unreachable: "The endpoint could not be checked.",
};

export function buildTrustSummary(input: { url: string; httpStatus: number; report: VerifyReport; now?: Date }): TrustSummary {
  const findings = sortFindings(input.report.findings);
  const counts = countFindings(findings);
  const result: TrustResult = counts.error > 0 ? "fail" : counts.warning > 0 ? "warn" : "pass";
  const issues: TrustIssue[] = findings
    .filter((f): f is Finding & { severity: "error" | "warning" } => f.severity === "error" || f.severity === "warning")
    .slice(0, MAX_ISSUES)
    .map((f) => ({ id: f.id, severity: f.severity, title: f.title, ...(f.fix ? { fix: f.fix } : {}) }));
  return {
    version: 1,
    checkedAt: (input.now ?? new Date()).toISOString(),
    endpoint: { url: input.url, host: hostOf(input.url), httpStatus: input.httpStatus },
    result,
    summary: SUMMARY[result],
    counts,
    arcNetworks: arcNetworksOf(findings),
    issues,
    notChecked: input.report.notChecked,
    disclaimer: TRUST_DISCLAIMER,
  };
}

/** The endpoint could not be reached, so nothing about its setup is known. */
export function buildUnreachableSummary(input: { url: string; reason: string; now?: Date }): TrustSummary {
  return {
    version: 1,
    checkedAt: (input.now ?? new Date()).toISOString(),
    endpoint: { url: input.url, host: hostOf(input.url) },
    result: "unreachable",
    summary: SUMMARY.unreachable,
    counts: { ...ZERO },
    arcNetworks: [],
    issues: [{ id: "reachable", severity: "error", title: input.reason }],
    notChecked: ["Everything: the endpoint did not answer, so its payment setup was not read."],
    disclaimer: TRUST_DISCLAIMER,
  };
}
