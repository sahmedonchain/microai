import { ARC_MAINNET } from "@/lib/arcConfig";
import { createLogger } from "@/lib/logger";

// Shared JSON-RPC client for Arc. Every method used by the app is a read, so
// timeouts, network errors and 429/5xx responses are retried once.
const log = createLogger({ lib: "arcRpc" });

const DEFAULT_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 300;

export class RpcError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

interface RpcOptions {
  timeoutMs?: number;
  retries?: number;
  url?: string;
}

async function attempt(url: string, method: string, params: unknown[], timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 429 || res.status >= 500) throw new RpcError(`RPC HTTP ${res.status}`, true);
    const data = await res.json();
    // A JSON-RPC error is a definitive answer from the node, so it is not retried.
    if (data.error) throw new RpcError(data.error.message || JSON.stringify(data.error), false);
    return data.result;
  } catch (err) {
    if (err instanceof RpcError) throw err;
    throw new RpcError(err instanceof Error ? `${err.name}: ${err.message}` : "RPC request failed", true);
  } finally {
    clearTimeout(timer);
  }
}

export async function rpcCall<T = unknown>(method: string, params: unknown[] = [], options: RpcOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1, url = ARC_MAINNET.rpcUrl } = options;
  let lastError: RpcError | undefined;
  for (let i = 0; i <= retries; i++) {
    try {
      return (await attempt(url, method, params, timeoutMs)) as T;
    } catch (err) {
      lastError = err as RpcError;
      if (!lastError.retryable || i === retries) break;
      log.warn("rpc retry", { method, err });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw lastError ?? new RpcError("RPC request failed", false);
}
