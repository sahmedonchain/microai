import { Redis } from "@upstash/redis";

const DEFILLAMA_TIMEOUT_MS = 5000;
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// Hand-verified against https://api.llama.fi/protocols (filtered to chains
// containing "Arc", chainId 5042) and each candidate's
// https://api.llama.fi/protocol/{slug} chainTvls.Arc. Only listed once
// confirmed to actually carry Arc-specific TVL data — NOT a blind
// name-similarity match, which risks attributing TVL to the wrong protocol.
const PROJECT_TO_DEFILLAMA_SLUG: Record<string, string> = {
  "morpho": "morpho-blue",
  "aave": "aave-v4",
  "aerodrome / velodrome": "aerodrome-slipstream",
  "synthra": "synthra-v3",
};

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

function cacheKey(slug: string) {
  return `microai:ecosystem:tvl:${slug}`;
}

interface CachedTvl {
  value: number | null;
}

// Fetches a protocol's Arc-chain-specific TVL only — never the global
// (all-chain) number DeFiLlama reports at the top level, which would be
// misleading for a chain-specific ecosystem page.
async function fetchArcTvl(slug: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFILLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.llama.fi/protocol/${slug}`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const points = data?.chainTvls?.Arc?.tvl;
    if (!Array.isArray(points) || points.length === 0) return null;
    const latest = points[points.length - 1]?.totalLiquidityUSD;
    if (typeof latest !== "number" || latest <= 0) return null;
    return latest;
  } catch {
    return null; // timeout, network error, or malformed response — fail silently, no fake data
  } finally {
    clearTimeout(timer);
  }
}

// Returns the Redis-cached (or freshly-fetched) Arc-specific TVL in USD for
// an ecosystem project name, or null if unavailable/unmapped. A project not
// in PROJECT_TO_DEFILLAMA_SLUG returns null without any network call.
export async function getArcTvlForProject(projectName: string): Promise<number | null> {
  const slug = PROJECT_TO_DEFILLAMA_SLUG[projectName.toLowerCase()];
  if (!slug) return null;

  const key = cacheKey(slug);
  try {
    const cached = await getRedis().get<CachedTvl>(key);
    if (cached) return cached.value;
  } catch {
    /* Redis unreachable — fall through to a live fetch */
  }

  const value = await fetchArcTvl(slug);
  try {
    await getRedis().set(key, { value } satisfies CachedTvl, { ex: CACHE_TTL_SECONDS });
  } catch {
    /* cache write failure shouldn't block returning the value to this request */
  }
  return value;
}

export function isEnrichableProject(projectName: string): boolean {
  return projectName.toLowerCase() in PROJECT_TO_DEFILLAMA_SLUG;
}
