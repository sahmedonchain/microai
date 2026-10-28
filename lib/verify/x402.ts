import type { EndpointResponse, Finding } from "./types";

// Reads the payment requirements out of a 402 response. x402 v2 puts them in
// the PAYMENT-REQUIRED header as base64-encoded JSON; v1 put them in the body.

export interface ParsedRequirements {
  version: number | null;
  /** Where the requirements were read from. */
  source: "header" | "body";
  accepts: unknown[];
}

export interface ParseOutcome {
  parsed?: ParsedRequirements;
  findings: Finding[];
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === wanted) return v;
  return undefined;
}

function tryJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function looksLikeX402(v: unknown): v is Record<string, unknown> {
  return isObject(v) && ("accepts" in v || "x402Version" in v);
}

function short(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

export function parseResponse(res: EndpointResponse): ParseOutcome {
  const findings: Finding[] = [];

  if (res.status !== 402) {
    if (res.status >= 200 && res.status < 300) {
      findings.push({
        id: "status",
        severity: "warning",
        title: "Endpoint did not ask for payment",
        reason: `It answered HTTP ${res.status} to a request without payment. Either the endpoint is free or the paywall is not active.`,
        evidence: `HTTP ${res.status}`,
        fix: "Return HTTP 402 with the payment requirements when no valid payment is attached.",
      });
    } else {
      findings.push({
        id: "status",
        severity: "error",
        title: "Endpoint did not answer with 402",
        reason: `An x402 endpoint must answer HTTP 402 when no payment is attached. This one answered ${res.status}, so a client cannot learn the price.`,
        evidence: `HTTP ${res.status}`,
        fix: "Check the URL and the route. A paid route should return 402 before any other error.",
      });
    }
  }

  const rawHeader = headerValue(res.headers, "payment-required");
  const bodyJson = tryJson(res.body);

  let headerJson: unknown;
  if (rawHeader !== undefined) {
    const compact = rawHeader.trim();
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) {
      findings.push({
        id: "header",
        severity: "error",
        title: "PAYMENT-REQUIRED header is not base64",
        reason: "The header must hold the payment requirements as base64-encoded JSON.",
        evidence: `PAYMENT-REQUIRED: ${short(compact, 60)}`,
        fix: "Send PAYMENT-REQUIRED: base64(JSON.stringify(paymentRequired)).",
      });
    } else {
      const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(normalized, "base64").toString("utf8");
      headerJson = tryJson(decoded);
      if (headerJson === undefined) {
        findings.push({
          id: "header",
          severity: "error",
          title: "PAYMENT-REQUIRED header is not valid JSON",
          reason: "The header decodes from base64, but the result is not JSON.",
          evidence: `decoded: ${short(decoded, 60)}`,
          fix: "Base64-encode the JSON text of the payment requirements, nothing else.",
        });
      }
    }
  }

  const headerOk = looksLikeX402(headerJson);
  const bodyOk = looksLikeX402(bodyJson);

  if (!headerOk && !bodyOk) {
    if (!findings.some((f) => f.id === "header")) {
      findings.push({
        id: "requirements",
        severity: "error",
        title: "No x402 payment requirements found",
        reason: "There is no PAYMENT-REQUIRED header and the body is not x402 JSON, so a client cannot tell what to pay.",
        fix: "Return PAYMENT-REQUIRED: base64(JSON) with an accepts list (x402 v2).",
      });
    }
    return { findings };
  }

  const payload = (headerOk ? headerJson : bodyJson) as Record<string, unknown>;
  const source: "header" | "body" = headerOk ? "header" : "body";
  const version = typeof payload.x402Version === "number" ? payload.x402Version : null;

  if (headerOk && bodyOk) {
    const a = JSON.stringify((headerJson as Record<string, unknown>).accepts);
    const b = JSON.stringify((bodyJson as Record<string, unknown>).accepts);
    if (a !== b) {
      findings.push({
        id: "header-body",
        severity: "warning",
        title: "Header and body disagree",
        reason: "The PAYMENT-REQUIRED header and the JSON body list different payment options. Clients read different ones.",
        fix: "Build both from the same object, or return the requirements in the header only.",
      });
    }
  }

  if (version === 2) {
    if (source === "body") {
      findings.push({
        id: "header",
        severity: "warning",
        title: "Requirements are only in the body",
        reason: "x402 v2 clients read the PAYMENT-REQUIRED header. A body-only answer may not work with them.",
        fix: "Also send PAYMENT-REQUIRED: base64(JSON).",
      });
    }
  } else if (version === 1) {
    findings.push({
      id: "version",
      severity: "warning",
      title: "Legacy x402 v1 format",
      reason: "This endpoint uses x402 v1. MicroAI Verify checks the current v2 format, so the fields were not checked.",
      evidence: "x402Version: 1",
      fix: "Move to x402 v2 (PAYMENT-REQUIRED header, accepts[] with amount, asset and payTo).",
    });
    return { findings };
  } else {
    findings.push({
      id: "version",
      severity: "warning",
      title: version === null ? "x402Version is missing" : `Unknown x402 version ${version}`,
      reason: "Clients use x402Version to choose how to read the response.",
      evidence: version === null ? undefined : `x402Version: ${version}`,
      fix: "Set x402Version to 2.",
    });
  }

  const accepts = payload.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    findings.push({
      id: "accepts",
      severity: "error",
      title: "accepts is missing or empty",
      reason: "accepts lists the ways to pay. With none, a client has nothing to sign.",
      fix: "Add at least one entry with scheme, network, amount, asset, payTo and maxTimeoutSeconds.",
    });
    return { findings };
  }

  return { parsed: { version, source, accepts }, findings };
}
