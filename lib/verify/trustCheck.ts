import { createHash } from "node:crypto";
import { apiErrors } from "@/lib/api";
import type { Logger } from "@/lib/logger";
import { consume, RateLimiterUnavailableError } from "@/lib/rateLimit";
import { getRedis } from "@/lib/redis";
import { SafeFetchError } from "@/lib/safeFetch";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { describeFetchError, fetchChallenge } from "@/lib/verify/fetchEndpoint";
import { buildTrustSummary, buildUnreachableSummary, type TrustSummary } from "@/lib/verify/trust";

// The Trust API's work, shared by GET /api/trust and the read-only MCP server so
// both are guarded the same way: a one-minute cache, a per-host hourly cap that
// protects the target, and the guarded outbound client (safeFetch).
//
// It sends no payment and no body, only a GET without payment. Callers must have
// already applied their own per-client rate limits.

const CACHE_TTL_SEC = 60;
const HOST_LIMIT = 30;

const cacheKey = (url: string, network: string | undefined) => `microai:trust:${createHash("sha256").update(`${network ?? ""}|${url}`).digest("hex")}`;

async function readCache(key: string): Promise<TrustSummary | null> {
  try {
    const v = await getRedis().get<TrustSummary>(key);
    return v && typeof v === "object" && (v as TrustSummary).version === 1 ? v : null;
  } catch {
    return null; // cache trouble is never a reason to fail the request
  }
}

async function writeCache(key: string, summary: TrustSummary): Promise<void> {
  try {
    await getRedis().set(key, summary, { ex: CACHE_TTL_SEC });
  } catch {
    /* best effort */
  }
}

export async function runTrustCheck(url: string, network: "mainnet" | "testnet" | undefined, log: Logger): Promise<TrustSummary & { cached: boolean }> {
  const key = cacheKey(url, network);
  const cached = await readCache(key);
  if (cached) return { ...cached, cached: true };

  // Protect the target: bound how often any single host is fetched through us.
  let host = "invalid";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw apiErrors.badRequest("That is not a valid URL. Use the full https:// address of the endpoint.");
  }
  try {
    const h = await consume(`trust:host:${host}`, HOST_LIMIT, 3_600_000, { failClosed: true });
    if (!h.ok) throw apiErrors.tooMany(h.retryAfterSec, "This host has been checked many times recently. Try again later.");
  } catch (err) {
    if (err instanceof RateLimiterUnavailableError) throw apiErrors.limiterDown();
    throw err;
  }

  let summary: TrustSummary;
  try {
    const response = await fetchChallenge(url);
    const report = verifyEndpointResponse(response, { expectedNetwork: network });
    summary = buildTrustSummary({ url, httpStatus: response.status, report });
  } catch (err) {
    if (!(err instanceof SafeFetchError)) throw err;
    const problem = describeFetchError(err);
    log.warn("trust fetch refused or failed", { code: err.code, host });
    if (problem.kind === "invalid") throw apiErrors.badRequest(problem.message);
    summary = buildUnreachableSummary({ url, reason: problem.message });
  }

  await writeCache(key, summary);
  return { ...summary, cached: false };
}
