import { Redis } from "@upstash/redis";

// One lazily created Upstash client for the whole app. Tests replace this
// module with an in-memory fake (see tests/helpers/fakeRedis.ts).
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}
