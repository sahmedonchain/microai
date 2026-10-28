// Shared types for MicroAI Verify. The checks are pure: they read a captured
// HTTP response and never send a payment or touch the network.

export type Severity = "ok" | "info" | "warning" | "error";

export interface Finding {
  /** Stable id, e.g. "accepts[0].amount". */
  id: string;
  severity: Severity;
  title: string;
  /** Plain-language reason. */
  reason: string;
  /** The exact value or field the finding is based on. */
  evidence?: string;
  /** How to fix it, when there is something to fix. */
  fix?: string;
}

/** What the endpoint answered to a request that carried no payment. */
export interface EndpointResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type ExpectedNetwork = "mainnet" | "testnet";

export interface VerifyReport {
  expectedNetwork?: ExpectedNetwork;
  findings: Finding[];
  counts: Record<Severity, number>;
  /** What this report did look at. */
  checked: string[];
  /** What it did NOT look at, so a clean report is not over-read. */
  notChecked: string[];
}
