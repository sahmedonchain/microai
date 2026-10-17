// Shared client for the Arc Mainnet Blockscout API. Requests carry a Referer
// header, as the explorer's own frontend does, plus a timeout and one retry.
import { ARC_MAINNET } from "@/lib/arcConfig";
import { createLogger } from "@/lib/logger";
import { ARC_EXPLORER_HOSTS, assertAllowedHost, readTextCapped, SafeFetchError } from "@/lib/safeFetch";

export const ARC_EXPLORER_API = ARC_MAINNET.explorerApiUrl;
const log = createLogger({ lib: "arcExplorer" });

const REQUEST_HEADERS = {
  Accept: "application/json",
  Referer: "https://explorer.arc.io/",
  "User-Agent": "MicroAI/1.0 (+https://github.com/sahmedonchain/microai)",
};

const DEFAULT_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 400;

export type ExplorerResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "not_found" | "unavailable"; status?: number };

interface ExplorerFetchOptions {
  timeoutMs?: number;
  retries?: number;
}

async function attempt<T>(path: string, timeoutMs: number): Promise<ExplorerResult<T> & { retryable?: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = `${ARC_EXPLORER_API}${path}`;
    // Only Arc's own explorer hosts, https/443, and never a redirect.
    assertAllowedHost(target, ARC_EXPLORER_HOSTS);
    const res = await fetch(target, {
      redirect: "error",
      headers: REQUEST_HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 404) return { ok: false, kind: "not_found", status: 404 };

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
      const challenged = res.headers.get("cf-mitigated") === "challenge";
      log.error("explorer request failed", { path, status: res.status, cloudflareChallenge: challenged, body });
      return { ok: false, kind: "unavailable", status: res.status, retryable: res.status >= 500 || res.status === 429 };
    }

    try {
      return { ok: true, data: JSON.parse(await readTextCapped(res)) as T };
    } catch (err) {
      if (err instanceof SafeFetchError) {
        log.error("explorer response too large", { path });
        return { ok: false, kind: "unavailable", status: res.status };
      }
      log.error("explorer response was not JSON", { path, status: res.status });
      return { ok: false, kind: "unavailable", status: res.status };
    }
  } catch (err) {
    log.error("explorer request error", { path, err });
    return { ok: false, kind: "unavailable", retryable: true }; // timeout or network error
  } finally {
    clearTimeout(timer);
  }
}

// GET `path` (e.g. "/addresses/0x...") with a timeout and one retry on
// timeouts, network errors, 429 and 5xx. 404 is reported as "not_found"
// and never retried; every other failure is "unavailable".
export async function explorerFetch<T>(path: string, options: ExplorerFetchOptions = {}): Promise<ExplorerResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = options;
  let result = await attempt<T>(path, timeoutMs);
  for (let i = 0; i < retries && !result.ok && result.retryable; i++) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    result = await attempt<T>(path, timeoutMs);
  }
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, kind: result.kind, status: result.status };
}
