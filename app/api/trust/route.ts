import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiErrors, parseQuery, withApi } from "@/lib/api";
import { consume, RateLimiterUnavailableError } from "@/lib/rateLimit";
import { getRedis } from "@/lib/redis";
import { trustQuery } from "@/lib/schemas";
import { SafeFetchError } from "@/lib/safeFetch";
import { verifyEndpointResponse } from "@/lib/verify/checks";
import { describeFetchError, fetchChallenge } from "@/lib/verify/fetchEndpoint";
import { buildTrustSummary, buildUnreachableSummary, type TrustSummary } from "@/lib/verify/trust";

// Trust API: GET /api/trust?url=https://...&network=mainnet|testnet
//
// A read-only, machine-readable version of MicroAI Verify's endpoint check, for
// agents that want to know whether a service's payment setup is sound before
// paying it. It is a configuration check, not a reputation score.
//
// What it does not do: it sends no payment, writes nothing on-chain (no ERC-8004
// registry entry), and does not charge per call. Those are deliberately left out
// until there is proven demand, because each one handles real money or state.
//
// It fetches a third party's URL, so it is guarded like Verify (safeFetch, same
// kill switch) and also protects the *target*: results are cached for a minute,
// and no one host is fetched more than 30 times an hour through MicroAI.

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

export const GET = withApi(
  {
    name: "trust",
    pause: "verify",
    onLimiterError: "closed",
    auth: "none",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 40, windowSec: 86_400 },
      { limit: 1000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    const { url, network } = parseQuery(req, trustQuery);
    const noStore = { "cache-control": "no-store" };

    const key = cacheKey(url, network);
    const cached = await readCache(key);
    if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: noStore });

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
    return NextResponse.json({ ...summary, cached: false }, { headers: noStore });
  }
);
