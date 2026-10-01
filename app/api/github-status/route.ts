import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { isTrackedRepo } from "@/lib/trackedRepos";

const CACHE_TTL_SECONDS = 12 * 60; // 12 min, within the requested 10-15 min window
const FETCH_TIMEOUT_MS = 5000;

interface GithubStatusPayload {
  pushedAt: string;
  updatedAt: string;
  stars: number;
  forks: number;
  name: string;
}

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

function cacheKey(repo: string) {
  return `microai:ghstatus:${repo.toLowerCase()}`;
}

async function fetchGithub(repo: string): Promise<GithubStatusPayload> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    return {
      pushedAt: data.pushed_at,
      updatedAt: data.updated_at,
      stars: data.stargazers_count,
      forks: data.forks_count,
      name: data.full_name,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGithubWithRetry(repo: string): Promise<GithubStatusPayload> {
  try {
    return await fetchGithub(repo);
  } catch {
    return await fetchGithub(repo); // one retry
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");

  if (!repo) {
    return NextResponse.json({ error: "Missing repo" }, { status: 400 });
  }
  if (!isTrackedRepo(repo)) {
    return NextResponse.json({ error: "Repo not tracked" }, { status: 400 });
  }

  const key = cacheKey(repo);

  // Redis-cached fast path — instant load, avoids hammering the GitHub API
  // (and its rate limit) on every page view/refresh across every visitor.
  try {
    const cached = await getRedis().get<GithubStatusPayload>(key);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
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
    return NextResponse.json({ ...data, cached: false });
  } catch (err: unknown) {
    console.error(`GitHub status error for ${repo}:`, err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
