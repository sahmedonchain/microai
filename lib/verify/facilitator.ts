import { safeFetch } from "@/lib/safeFetch";

// Read-only check of an x402 facilitator's GET /supported answer.
//
// It asks one question: does this facilitator say it supports Arc, and with which
// schemes? It sends no payment and no payload. It deliberately does NOT call the
// facilitator's /verify or /settle: those take a signed payment authorization, and
// /settle moves money. A signed authorization must never be handed to MicroAI.
//
// A facilitator listing a network in /supported is a claim by that facilitator. It
// is not proof that it settles on Arc reliably, that it is honest, or that it is up.

export const FACILITATOR_TIMEOUT_MS = 5000;
export const FACILITATOR_MAX_BYTES = 64 * 1024;
const ARC_NETWORKS = { "eip155:5042": "mainnet", "eip155:5042002": "testnet" } as const;
type ArcId = (typeof ARC_NETWORKS)[keyof typeof ARC_NETWORKS];
const MAX_KINDS = 50;

export type FacilitatorResult = "pass" | "warn" | "fail" | "unreachable";

export interface FacilitatorKind {
  x402Version?: number;
  scheme: string;
  network: string;
}

export interface FacilitatorSummary {
  version: 1;
  checkedAt: string;
  facilitator: { url: string; host: string; httpStatus?: number };
  result: FacilitatorResult;
  summary: string;
  /** Schemes the facilitator lists for each Arc network ([] = Arc network not listed). */
  arc: Record<ArcId, string[]>;
  kinds: FacilitatorKind[];
  issues: Array<{ id: string; severity: "error" | "warning"; title: string }>;
  notChecked: string[];
  disclaimer: string;
}

export const FACILITATOR_NOT_CHECKED = [
  "The facilitator's /verify and /settle endpoints (not called on purpose: they take a signed payment, and settling moves money)",
  "Whether it really settles on Arc, how fast, at what fee, or how reliably",
  "Who runs it, or whether it can be trusted",
];

export const FACILITATOR_DISCLAIMER =
  "This shows what the facilitator says it supports at the time shown. It is a claim by the facilitator, not proof that payments settle, and not a rating or a guarantee of safety. MicroAI sends no payment.";

/** The /supported address for a facilitator base URL, or null when the base is not a plain https address. */
export function supportedUrl(base: string): string | null {
  try {
    const u = new URL(base.trim());
    if (u.protocol !== "https:" || u.search || u.hash) return null;
    u.pathname = u.pathname.replace(/\/+$/, "") + "/supported";
    return u.toString();
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function summariseSupported(input: { url: string; httpStatus: number; body: string; expected?: ArcId; now?: Date }): FacilitatorSummary {
  const { url, httpStatus, body, expected } = input;
  const host = new URL(url).hostname;
  const base: Omit<FacilitatorSummary, "result" | "summary" | "issues" | "arc" | "kinds"> = {
    version: 1,
    checkedAt: (input.now ?? new Date()).toISOString(),
    facilitator: { url, host, httpStatus },
    notChecked: FACILITATOR_NOT_CHECKED,
    disclaimer: FACILITATOR_DISCLAIMER,
  };
  const arc: Record<ArcId, string[]> = { mainnet: [], testnet: [] };
  const fail = (title: string, id: string): FacilitatorSummary => ({ ...base, result: "fail", summary: title, arc, kinds: [], issues: [{ id, severity: "error", title }] });

  if (httpStatus !== 200) return fail(`/supported answered HTTP ${httpStatus}, not 200.`, "supported.status");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return fail("/supported did not answer with JSON.", "supported.json");
  }
  const rawKinds = isObj(json) && Array.isArray(json.kinds) ? json.kinds : null;
  if (!rawKinds) return fail('/supported has no "kinds" list.', "supported.kinds");

  const kinds: FacilitatorKind[] = [];
  for (const k of rawKinds.slice(0, MAX_KINDS)) {
    if (!isObj(k) || typeof k.scheme !== "string" || typeof k.network !== "string") continue;
    kinds.push({ ...(typeof k.x402Version === "number" ? { x402Version: k.x402Version } : {}), scheme: k.scheme.slice(0, 40), network: k.network.slice(0, 80) });
  }
  for (const k of kinds) {
    const id = ARC_NETWORKS[k.network as keyof typeof ARC_NETWORKS];
    if (id && !arc[id].includes(k.scheme)) arc[id].push(k.scheme);
  }

  const issues: FacilitatorSummary["issues"] = [];
  if (kinds.length === 0) issues.push({ id: "supported.empty", severity: "error", title: "/supported lists no usable payment kinds." });
  const arcListed = (arc.mainnet.length > 0 ? 1 : 0) + (arc.testnet.length > 0 ? 1 : 0);
  if (kinds.length > 0 && arcListed === 0) issues.push({ id: "supported.no_arc", severity: expected ? "error" : "warning", title: "It does not list Arc Mainnet (eip155:5042) or Arc Testnet (eip155:5042002)." });
  if (expected && arc[expected].length === 0 && arcListed > 0) issues.push({ id: "supported.network", severity: "error", title: `It does not list Arc ${expected === "mainnet" ? "Mainnet (eip155:5042)" : "Testnet (eip155:5042002)"}.` });
  if (expected && arc[expected].length > 0 && !arc[expected].includes("exact")) issues.push({ id: "supported.scheme", severity: "warning", title: `It lists Arc ${expected} but not with the "exact" scheme (it lists: ${arc[expected].join(", ")}).` });
  const arcKinds = kinds.filter((k) => k.network in ARC_NETWORKS);
  if (arcKinds.length > 0 && arcKinds.every((k) => k.x402Version === 1)) issues.push({ id: "supported.version", severity: "warning", title: "Its Arc entries are x402 version 1; version 2 uses CAIP-2 network ids and the PAYMENT-* headers." });

  const errors = issues.filter((i) => i.severity === "error").length;
  const result: FacilitatorResult = errors > 0 ? "fail" : issues.length > 0 ? "warn" : "pass";
  const summary =
    result === "pass"
      ? `It says it supports Arc ${[arc.mainnet.length ? "Mainnet" : "", arc.testnet.length ? "Testnet" : ""].filter(Boolean).join(" and ")}. This is its own claim.`
      : issues[0].title;
  return { ...base, result, summary, issues, arc, kinds };
}

export function unreachableSummary(url: string, reason: string, now: Date = new Date()): FacilitatorSummary {
  return {
    version: 1,
    checkedAt: now.toISOString(),
    facilitator: { url, host: new URL(url).hostname },
    result: "unreachable",
    summary: reason,
    arc: { mainnet: [], testnet: [] },
    kinds: [],
    issues: [],
    notChecked: FACILITATOR_NOT_CHECKED,
    disclaimer: FACILITATOR_DISCLAIMER,
  };
}

/** One GET to {base}/supported through the guarded outbound client. Throws SafeFetchError. */
export async function fetchSupported(base: string): Promise<{ url: string; status: number; body: string }> {
  const url = supportedUrl(base);
  if (!url) throw new Error("bad facilitator url");
  const res = await safeFetch(url, {
    timeoutMs: FACILITATOR_TIMEOUT_MS,
    maxBytes: FACILITATOR_MAX_BYTES,
    maxRedirects: 2,
    headers: { Accept: "application/json", "User-Agent": "MicroAI-Verify/0.1 (+https://github.com/sahmedonchain/microai)" },
  });
  return { url, status: res.status, body: res.text() };
}
