// Simple in-memory per-key rate limiter. Resets on cold start / per-instance
// in serverless environments — acceptable here since this only protects a
// free, non-monetary endpoint from being hammered, not a security boundary.
// A rate-limit rule. Interim in-memory implementation; replaced by the
// Redis-backed limiter in the rate-limiting commit.
export interface LimitSpec {
  limit: number;
  windowSec: number;
  scope?: "actor" | "global";
}

export interface LimitResult {
  ok: boolean;
  retryAfterSec: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function consume(key: string, limit: number, windowMs: number): Promise<LimitResult> {
  const ok = checkRateLimit(key, limit, windowMs);
  const bucket = buckets.get(key);
  return { ok, retryAfterSec: bucket ? Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)) : 1 };
}
