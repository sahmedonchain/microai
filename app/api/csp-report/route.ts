import { ApiError, apiErrors, withApi } from "@/lib/api";
import { readTextCapped, SafeFetchError } from "@/lib/safeFetch";

// Receives CSP violation reports from browsers. Public (browsers send no
// credentials) so it is rate limited per IP, has a small body cap, and logs
// only a few truncated, query-stripped fields.
//
// Rate limiter down: fails OPEN (in-memory fallback). A report is low value and
// dropping it is harmless, so availability of the rest of the site is not tied to it.
const MAX_BODY_BYTES = 8 * 1024;

const clip = (v: unknown, n = 200) => (typeof v === "string" ? v.slice(0, n) : undefined);
// Drop query and fragment: they can carry tokens or wallet addresses.
const stripUrl = (v: unknown) => {
  if (typeof v !== "string") return undefined;
  try {
    const u = new URL(v);
    return clip(`${u.origin}${u.pathname}`);
  } catch {
    return clip(v, 40); // "inline", "eval", "data" etc.
  }
};

export function summarizeReport(raw: unknown): Record<string, string | number | undefined> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Legacy `report-uri`: {"csp-report": {...}}. Reporting API: [{type:"csp-violation", body:{...}}].
  const first = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : undefined;
  const body = ((r["csp-report"] ?? first?.body ?? r) as Record<string, unknown>) ?? {};
  if (typeof body !== "object") return null;
  const directive = clip(body["violated-directive"] ?? body["effectiveDirective"] ?? body["effective-directive"], 100);
  if (!directive) return null;
  return {
    directive,
    blocked: stripUrl(body["blocked-uri"] ?? body["blockedURL"]),
    document: stripUrl(body["document-uri"] ?? body["documentURL"]),
    disposition: clip(body["disposition"], 20),
    line: typeof body["line-number"] === "number" ? (body["line-number"] as number) : undefined,
  };
}

export const POST = withApi(
  {
    name: "csp-report",
    limits: [
      { limit: 20, windowSec: 60 },
      { limit: 5000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    let text: string;
    try {
      text = await readTextCapped(req, MAX_BODY_BYTES);
    } catch (err) {
      if (err instanceof SafeFetchError) throw new ApiError(413, "invalid_request", "Report too large.");
      throw apiErrors.badRequest("Invalid report.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw apiErrors.badRequest("Invalid report.");
    }
    const summary = summarizeReport(parsed);
    if (!summary) throw apiErrors.badRequest("Invalid report.");
    log.warn("csp violation", summary);
    return new Response(null, { status: 204 });
  }
);
