import { randomUUID } from "crypto";
import { getRedis } from "./redis";
import { createLogger } from "./logger";

// Redis-backed sliding-window limiter, shared by every serverless instance.
// Each request is a member of a sorted set scored by its timestamp; entries
// older than the window are dropped, and the request is allowed if fewer than
// `limit` remain. Rejected requests are removed again so they do not extend
// the penalty.
//
// If Redis is unreachable, behavior depends on the route:
//   - fail OPEN (default, cheap read routes): degrade to a per-instance
//     in-memory window, logged as a warning. Availability wins.
//   - fail CLOSED (`failClosed`, routes that spend money or touch wallets/AI):
//     throw RateLimiterUnavailableError, which withApi answers with 503 +
//     Retry-After. The in-memory fallback is never used, because a per-instance
//     counter lets an attacker multiply the limit by the instance count.
const log = createLogger({ lib: "rateLimit" });

export interface LimitSpec {
  limit: number;
  windowSec: number;
  // "actor" (default): per wallet when signed in, otherwise per IP.
  // "global": one shared budget for the whole route (daily AI spend caps).
  scope?: "actor" | "global";
}

export class RateLimiterUnavailableError extends Error {
  constructor() {
    super("rate limiter unavailable");
  }
}

export interface LimitResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

const memory = new Map<string, number[]>();

function consumeInMemory(key: string, limit: number, windowMs: number, now: number): LimitResult {
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    memory.set(key, hits);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)), remaining: 0 };
  }
  hits.push(now);
  memory.set(key, hits);
  return { ok: true, retryAfterSec: 0, remaining: limit - hits.length };
}

export async function consume(key: string, limit: number, windowMs: number, opts: { failClosed?: boolean } = {}): Promise<LimitResult> {
  const now = Date.now();
  const redisKey = `microai:rl:${key}`;
  try {
    const redis = getRedis();
    const member = `${now}:${randomUUID().slice(0, 8)}`;
    const results = (await redis
      .multi()
      .zremrangebyscore(redisKey, 0, now - windowMs)
      .zadd(redisKey, { score: now, member })
      .zcard(redisKey)
      .zrange(redisKey, 0, 0, { withScores: true })
      .pexpire(redisKey, windowMs)
      .exec()) as unknown[];

    const count = Number(results[2]);
    if (count > limit) {
      await redis.zrem(redisKey, member);
      const oldest = Number((results[3] as unknown[])?.[1] ?? now);
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)), remaining: 0 };
    }
    return { ok: true, retryAfterSec: 0, remaining: limit - count };
  } catch (err) {
    if (opts.failClosed) {
      log.error("redis limiter unavailable, failing closed", { err });
      throw new RateLimiterUnavailableError();
    }
    log.warn("redis limiter unavailable, using per-instance fallback", { err });
    return consumeInMemory(key, limit, windowMs, now);
  }
}

// Test hook: forget the in-memory fallback state.
export function resetMemoryLimiter() {
  memory.clear();
}

// Client IP for rate limiting.
//
// On Vercel the platform sets `x-vercel-forwarded-for` (and overwrites
// `x-forwarded-for` / `x-real-ip`) at the edge, so a client cannot choose them.
// That header is therefore preferred.
//
// SPOOFING RISK outside Vercel: on any other host (self-hosted, another PaaS,
// a proxy that appends instead of overwriting) every one of these headers is
// client-controlled unless your own trusted proxy strips them. An attacker
// could then rotate fake IPs to dodge the per-IP key (the per-wallet key still
// applies to signed-in users). Only deploy off Vercel behind a proxy that
// overwrites these headers, and adjust this function to match it.
export function getClientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  if (vercel) return vercel;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return forwardedFor || "unknown";
}
