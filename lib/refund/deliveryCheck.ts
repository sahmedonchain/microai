import { createHash } from "node:crypto";
import type { AcceptanceRule, CheckResult } from "./types";

// Judges a reported service answer against the buyer's acceptance rule. Pure and
// offline: MicroAI sends no payment and never sees the live response, so the
// status and body are what the caller reports, and the record says so.

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

function dig(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v) ?? "undefined").slice(0, 120);

export interface Judged {
  result: CheckResult;
  reasons: string[];
  importantFields: Record<string, string>;
}

export function judgeDelivery(input: { httpStatus: number | null; body?: string; rule: AcceptanceRule }): Judged {
  const { httpStatus, body, rule } = input;
  const reasons: string[] = [];
  const importantFields: Record<string, string> = {};

  if (httpStatus === null) return { result: "FAIL", reasons: ["No response was received from the service after payment."], importantFields };

  const statusOk = rule.expectedStatus !== undefined ? httpStatus === rule.expectedStatus : httpStatus >= 200 && httpStatus < 300;
  if (!statusOk) reasons.push(rule.expectedStatus !== undefined ? `HTTP ${httpStatus}, expected ${rule.expectedStatus}.` : `HTTP ${httpStatus}, expected a 2xx answer.`);

  const text = body ?? "";
  for (const s of rule.mustContain ?? []) if (!text.includes(s)) reasons.push(`The response does not contain "${s.slice(0, 60)}".`);

  if (rule.requiredJsonFields?.length) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (json === undefined) reasons.push("The response is not valid JSON, so required fields cannot be found.");
    else {
      for (const f of rule.requiredJsonFields) {
        const v = dig(json, f);
        if (v === undefined || v === null || v === "") reasons.push(`Required field "${f}" is missing or empty.`);
        else importantFields[f] = show(v);
      }
    }
  }

  if (reasons.length) return { result: "FAIL", reasons, importantFields };

  const hasRule = rule.expectedStatus !== undefined || (rule.mustContain?.length ?? 0) > 0 || (rule.requiredJsonFields?.length ?? 0) > 0;
  if (!hasRule) return { result: "NEEDS_REVIEW", reasons: [`The service answered HTTP ${httpStatus}, but no acceptance rule was given, so MicroAI cannot say the content was right.`], importantFields };
  return { result: "PASS", reasons: ["The reported answer meets every part of the acceptance rule."], importantFields };
}
