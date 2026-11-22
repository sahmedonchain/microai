import { apiErrors } from "@/lib/api";
import type { Logger } from "@/lib/logger";
import { consume, RateLimiterUnavailableError } from "@/lib/rateLimit";
import { SafeFetchError } from "@/lib/safeFetch";
import { describeFetchError } from "@/lib/verify/fetchEndpoint";
import { fetchSupported, summariseSupported, supportedUrl, unreachableSummary, type FacilitatorSummary } from "@/lib/verify/facilitator";

// Shared by GET /api/facilitator and the MCP tool. Callers apply their own per-client
// limits first. This adds the per-host cap that protects the facilitator being asked.

const HOST_LIMIT = 30;

export async function runFacilitatorCheck(base: string, network: "mainnet" | "testnet" | undefined, log: Logger): Promise<FacilitatorSummary> {
  const url = supportedUrl(base);
  if (!url) throw apiErrors.badRequest("Use the facilitator's plain https:// address, without a query or fragment.");
  const host = new URL(url).hostname.toLowerCase();
  try {
    const h = await consume(`facilitator:host:${host}`, HOST_LIMIT, 3_600_000, { failClosed: true });
    if (!h.ok) throw apiErrors.tooMany(h.retryAfterSec, "This host has been checked many times recently. Try again later.");
  } catch (err) {
    if (err instanceof RateLimiterUnavailableError) throw apiErrors.limiterDown();
    throw err;
  }
  try {
    const r = await fetchSupported(base);
    return summariseSupported({ url: r.url, httpStatus: r.status, body: r.body, expected: network });
  } catch (err) {
    if (!(err instanceof SafeFetchError)) throw err;
    const problem = describeFetchError(err);
    log.warn("facilitator fetch refused or failed", { code: err.code, host });
    if (problem.kind === "invalid") throw apiErrors.badRequest(problem.message);
    return unreachableSummary(url, problem.message);
  }
}
