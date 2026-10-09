import { getRedis } from "@/lib/redis";
import { ApiError, apiErrors, parseQuery, withApi } from "@/lib/api";
import { githubStatusQuery } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";

const CACHE_TTL_SECONDS = 12 * 60; // 12 min, within the requested 10-15 min window
const FETCH_TIMEOUT_MS = 5000;

interface GithubStatusPayload {
  pushedAt: string;
  updatedAt: string;
  stars: number;
  forks: number;
  name: string;
}

function cacheKey(repo: string) {
  return `microai:ghstatus:${repo.toLowerCase()}`;
}

class GithubError extends Error {
  constructor(readonly kind: "not_found" | "rate_limited" | "api_error", message: string) {
    super(message);
  }
}

async function requestRepo(repo: string, token: string | undefined): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MicroAI",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`https://api.github.com/repos/${repo}`, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGithub(repo: string): Promise<GithubStatusPayload> {
  const token = process.env.GITHUB_TOKEN;
  let res = await requestRepo(repo, token);

  // A rejected token fails every request. Say so loudly in the logs, then
  // fall back to unauthenticated access (lower rate limit, same data) so the
  // page still works until the token is replaced.
  if (res.status === 401 && token) {
    log.error("GITHUB_TOKEN was rejected by GitHub (401 Bad credentials). Replace it; falling back to unauthenticated requests.");
    res = await requestRepo(repo, undefined);
  }

  if (res.status === 404) throw new GithubError("not_found", `${repo} not found`);
  if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
    throw new GithubError("rate_limited", `GitHub rate limit hit while fetching ${repo}`);
  }
  if (!res.ok) throw new GithubError("api_error", `GitHub API ${res.status} for ${repo}`);

  const data = await res.json();
  return {
    pushedAt: data.pushed_at,
    updatedAt: data.updated_at,
    stars: data.stargazers_count,
    forks: data.forks_count,
    name: data.full_name,
  };
}

async function fetchGithubWithRetry(repo: string): Promise<GithubStatusPayload> {
  try {
    return await fetchGithub(repo);
  } catch (err) {
    // 404 and rate limits will not change on an immediate retry.
    if (err instanceof GithubError && err.kind !== "api_error") throw err;
    return await fetchGithub(repo); // one retry for timeouts and 5xx
  }
}

// The error strings are the literal values the Build status UI matches on.
const log = createLogger({ route: "github-status" });

export const GET = withApi({ name: "github-status", limits: [{ limit: 60, windowSec: 60 }] }, async ({ req }) => {
  const { repo } = parseQuery(req, githubStatusQuery);
  const key = cacheKey(repo);

  // Redis-cached fast path — instant load, avoids hammering the GitHub API
  // (and its rate limit) on every page view/refresh across every visitor.
  try {
    const cached = await getRedis().get<GithubStatusPayload>(key);
    if (cached) return { ...cached, cached: true };
  } catch {
    /* Redis unreachable — fall through to a live fetch */
  }

  try {
    const data = await fetchGithubWithRetry(repo);
    try {
      await getRedis().set(key, data, { ex: CACHE_TTL_SECONDS });
    } catch {
      /* Redis write failure shouldn't fail the request — still return live data */
    }
    return { ...data, cached: false };
  } catch (err: unknown) {
    log.error("GitHub status error", { repo, err });
    if (err instanceof GithubError && err.kind === "not_found") throw new ApiError(404, "not_found", "not_found");
    if (err instanceof GithubError && err.kind === "rate_limited") throw apiErrors.tooMany(60, "rate_limited");
    throw apiErrors.upstream("api_error");
  }
});
