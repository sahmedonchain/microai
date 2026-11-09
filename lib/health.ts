import { ARC_MAINNET } from "@/lib/arcConfig";
import { rpcCall } from "@/lib/arcRpc";
import { getRedis } from "@/lib/redis";

// Health check for uptime monitors. It reports only whether two dependencies
// answer, with no error text, details, keys or addresses. "degraded" means the app
// is up but a dependency is not, which is what an alert should fire on.

export type CheckState = "ok" | "down";
export interface HealthReport {
  status: "ok" | "degraded";
  checks: { redis: CheckState; arcRpc: CheckState };
  checkedAt: string;
}

const CACHE_MS = 15_000;
let cache: { at: number; report: HealthReport } | null = null;

export function resetHealthCache(): void {
  cache = null;
}

async function redisState(): Promise<CheckState> {
  try {
    await getRedis().get("microai:health:probe"); // a read of a key that need not exist
    return "ok";
  } catch {
    return "down";
  }
}

async function rpcState(): Promise<CheckState> {
  try {
    const id = await rpcCall<string>("eth_chainId", [], { timeoutMs: 3000, retries: 0 });
    return id?.toLowerCase() === ARC_MAINNET.chainIdHex ? "ok" : "down"; // a wrong chain counts as down
  } catch {
    return "down";
  }
}

/** Cached per server instance for 15 seconds, so a monitor or an attacker cannot turn this into RPC load. */
export async function getHealth(now: number = Date.now()): Promise<HealthReport> {
  if (cache && now - cache.at < CACHE_MS) return cache.report;
  const [redis, arcRpc] = await Promise.all([redisState(), rpcState()]);
  const report: HealthReport = { status: redis === "ok" && arcRpc === "ok" ? "ok" : "degraded", checks: { redis, arcRpc }, checkedAt: new Date(now).toISOString() };
  cache = { at: now, report };
  return report;
}
