import type { Finding, Severity } from "./types";

// Small pure helpers for the Verify page, kept here so they can be tested.

export const SEVERITY_LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Note", ok: "Passed" };

/** "0.001" -> "1000" (USDC has 6 decimals). Returns null for anything that is not a plain decimal. */
export function usdcToUnits(input: string): string | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  if (whole.length > 18) return null;
  return (whole + frac.padEnd(6, "0")).replace(/^0+(?=\d)/, "");
}

export type Tone = "error" | "warning" | "ok";

export function sumCounts(...parts: (Record<Severity, number> | undefined)[]): Record<Severity, number> {
  const total: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const c of parts) {
    if (!c) continue;
    for (const k of Object.keys(total) as Severity[]) total[k] += c[k];
  }
  return total;
}

/** A careful headline: a clean report only says nothing was found in what was checked. */
export function verdict(counts: Record<Severity, number>): { tone: Tone; text: string } {
  if (counts.error > 0) return { tone: "error", text: `${counts.error} problem${counts.error === 1 ? "" : "s"} found` };
  if (counts.warning > 0) return { tone: "warning", text: `No errors, ${counts.warning} warning${counts.warning === 1 ? "" : "s"} to look at` };
  return { tone: "ok", text: "No problems found in the checks we ran" };
}

function findingLines(f: Finding): string[] {
  const lines = [`[${SEVERITY_LABEL[f.severity]}] ${f.title}`, `  ${f.reason}`];
  if (f.evidence) lines.push(`  Evidence: ${f.evidence}`);
  if (f.fix) lines.push(`  Fix: ${f.fix}`);
  return lines;
}

export function reportToText(input: {
  url?: string;
  httpStatus?: number;
  findings: Finding[];
  txHash?: string;
  explorerUrl?: string;
  txFindings?: Finding[];
  notChecked?: string[];
}): string {
  const out: string[] = ["MicroAI Verify (early preview)"];
  if (input.url) out.push(`Endpoint: ${input.url}${input.httpStatus !== undefined ? ` (HTTP ${input.httpStatus})` : ""}`);
  if (input.findings.length) out.push("", ...input.findings.flatMap(findingLines));
  if (input.txHash) {
    out.push("", `Transaction: ${input.txHash}`);
    if (input.explorerUrl) out.push(`Explorer: ${input.explorerUrl}`);
    out.push(...(input.txFindings ?? []).flatMap(findingLines));
  }
  if (input.notChecked?.length) out.push("", "Not checked:", ...input.notChecked.map((n) => `  - ${n}`));
  return out.join("\n");
}
