import { lookup as dnsLookup } from "dns/promises";
import { request as httpsRequest } from "https";
import { isIP } from "net";
import type { IncomingMessage } from "http";
import { createLogger } from "./logger";

// SSRF-safe outbound GET.
//
// Rules, enforced on the first request AND on every redirect hop:
//   - https only, port 443 only, no user:pass@ in the URL;
//   - the hostname must resolve (A and AAAA) and EVERY resolved address must be
//     public: loopback, private, link-local (incl. cloud metadata
//     169.254.169.254), CGNAT, multicast, reserved and IPv4-mapped IPv6 are
//     all rejected. IP-literal hosts are checked directly. The WHATWG URL
//     parser already normalizes decimal (2130706433), hex (0x7f000001) and
//     octal (0177.0.0.1) IPv4 spellings to dotted form, so they hit the same
//     range check;
//   - the TCP connection is made to the address that was validated (a pinned
//     `lookup`), while TLS still verifies the certificate against the
//     hostname. This closes the DNS-rebinding window between check and connect;
//   - redirects are followed manually, at most `maxRedirects` (3), each hop
//     re-validated and re-checked against `allowedHosts`;
//   - total deadline `timeoutMs` (5 s) covers connect, headers and body;
//   - the body is read as a stream and aborted past `maxBytes` (1 MB);
//   - cookie headers are never sent; Authorization and any `sensitiveHeaders`
//     are dropped when a redirect leaves the original host.
//
// Callers see only SafeFetchError with a generic message. The precise reason
// is in `.code` and is for server logs, never for the client.

const log = createLogger({ lib: "safeFetch" });

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_MAX_BYTES = 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 3;

export type SafeFetchErrorCode =
  | "bad_url"
  | "not_https"
  | "bad_port"
  | "userinfo"
  | "host_not_allowed"
  | "blocked_address"
  | "dns_failed"
  | "too_many_redirects"
  | "bad_redirect"
  | "timeout"
  | "too_large"
  | "network";

export class SafeFetchError extends Error {
  constructor(readonly code: SafeFetchErrorCode, readonly detail?: string) {
    super(code === "timeout" ? "Upstream request timed out." : code === "too_large" ? "Upstream response too large." : "Upstream request blocked or failed.");
  }
}

// ---------------------------------------------------------------- IP ranges

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4(ip: string): boolean {
  const o = parseIPv4(ip);
  if (!o) return true; // unparseable: refuse
  const [a, b, c] = o;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local incl. metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 0 && c === 0) || // 192.0.0/24
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 168) || // 192.168/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18/15 benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  );
}

// Expands an IPv6 literal to eight 16-bit groups, or null if malformed.
function parseIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  if (s.includes(".") && lastColon >= 0) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    s = s.slice(0, lastColon + 1) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (h: string) => (h === "" ? [] : h.split(":"));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...rest];
  const groups = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  if (groups.some((g) => Number.isNaN(g))) return null;
  if (tail.length) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

function isBlockedIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  if (!g) return true;
  const allZeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  return (
    (allZeroUpTo(7) && g[7] <= 1) || // :: and ::1
    (allZeroUpTo(5) && g[5] === 0xffff) || // ::ffff:0:0/96 IPv4-mapped
    allZeroUpTo(6) || // ::/96 IPv4-compatible (deprecated)
    (g[0] === 0x64 && g[1] === 0xff9b) || // 64:ff9b::/96 NAT64 (embeds IPv4)
    (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) || // 100::/64 discard
    (g[0] === 0x2001 && g[1] === 0) || // 2001::/32 Teredo
    (g[0] === 0x2001 && g[1] === 0xdb8) || // documentation
    g[0] === 0x2002 || // 6to4 (embeds IPv4)
    (g[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (g[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (g[0] & 0xff00) === 0xff00 // multicast
  );
}

/** True if the address must never be contacted. Unparseable input counts as blocked. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true;
}

// -------------------------------------------------------------- host rules

/**
 * Host allowlist entries: "example.com" matches that exact host,
 * "*.example.com" matches any subdomain (not the apex). To allow both, pass both.
 */
export function hostMatches(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase();
  return allowed.some((rule) => {
    const r = rule.toLowerCase();
    return r.startsWith("*.") ? h.endsWith(r.slice(1)) && h.length > r.length - 1 : h === r;
  });
}

/** Parses and checks scheme, port, userinfo and (optionally) the host allowlist. Throws SafeFetchError. */
export function assertSafeUrl(input: string | URL, allowedHosts?: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError("bad_url");
  }
  if (url.protocol !== "https:") throw new SafeFetchError("not_https");
  if (url.username || url.password) throw new SafeFetchError("userinfo");
  if (url.port !== "" && url.port !== "443") throw new SafeFetchError("bad_port", url.port);
  if (allowedHosts && !hostMatches(url.hostname, allowedHosts)) throw new SafeFetchError("host_not_allowed", url.hostname);
  return url;
}

/** Hostname allowlist only (no DNS, no fetch), for clients that use their own transport. */
export function assertAllowedHost(input: string | URL, allowedHosts: readonly string[]): URL {
  return assertSafeUrl(input, allowedHosts);
}

function isLocalName(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal");
}

// -------------------------------------------------------------- transport

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  destroy(): void;
}

export interface RawRequest {
  url: URL;
  address: string; // validated IP to connect to
  headers: Record<string, string>;
  signal: AbortSignal;
}

export interface SafeFetchDeps {
  /** Resolve every A/AAAA record. Replaceable in tests. */
  resolve: (hostname: string) => Promise<string[]>;
  /** Perform one request against `address`. Replaceable in tests. */
  request: (req: RawRequest) => Promise<RawResponse>;
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

function defaultRequest(req: RawRequest): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const r = httpsRequest(
      {
        protocol: "https:",
        hostname: req.url.hostname,
        port: 443,
        path: req.url.pathname + req.url.search,
        method: "GET",
        headers: req.headers,
        servername: req.url.hostname, // SNI + certificate check use the hostname...
        signal: req.signal,
        // ...but the socket connects to the address we validated.
        lookup: (_host, _opts, cb) => {
          const family = isIP(req.address);
          // Node may request `all: true`; answer in the matching shape.
          if ((_opts as { all?: boolean })?.all) (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address: req.address, family }]);
          else cb(null, req.address, family);
        },
      },
      (res: IncomingMessage) =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res as AsyncIterable<Uint8Array>,
          destroy: () => res.destroy(),
        })
    );
    r.on("error", reject);
    r.end();
  });
}

const defaultDeps: SafeFetchDeps = { resolve: defaultResolve, request: defaultRequest };

// ----------------------------------------------------------------- the API

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** If set, the host of the URL and of every redirect hop must match (see hostMatches). */
  allowedHosts?: readonly string[];
  /** Extra request headers. Cookie headers are always dropped. */
  headers?: Record<string, string>;
  /** Headers (besides Authorization) that are dropped when a redirect changes host. */
  sensitiveHeaders?: readonly string[];
  /** Test seam. */
  deps?: Partial<SafeFetchDeps>;
}

export interface SafeResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  text(): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors Response.json(), callers validate the shape
  json<T = any>(): T;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function resolveAndCheck(url: URL, deps: SafeFetchDeps): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError("blocked_address", host);
    return host;
  }
  if (isLocalName(host.toLowerCase())) throw new SafeFetchError("blocked_address", host);
  let addresses: string[];
  try {
    addresses = await deps.resolve(host);
  } catch {
    throw new SafeFetchError("dns_failed", host);
  }
  if (addresses.length === 0) throw new SafeFetchError("dns_failed", host);
  const bad = addresses.find(isBlockedIp);
  if (bad) throw new SafeFetchError("blocked_address", `${host} -> ${bad}`);
  return addresses[0];
}

function headerValue(h: RawResponse["headers"], name: string): string | undefined {
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
}

async function readCapped(res: RawResponse, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(headerValue(res.headers, "content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    throw new SafeFetchError("too_large");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const abort = new Promise<never>((_, reject) => {
    const onAbort = () => {
      res.destroy();
      reject(new SafeFetchError("timeout"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  const read = (async () => {
    try {
      for await (const chunk of res.body) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          res.destroy();
          throw new SafeFetchError("too_large");
        }
        chunks.push(chunk);
      }
    } catch (err) {
      if (err instanceof SafeFetchError) throw err;
      throw new SafeFetchError(signal.aborted ? "timeout" : "network");
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out;
  })();
  // Race so a stalled stream is cut at the deadline even if it never yields.
  return Promise.race([read, abort]);
}

export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, maxRedirects = DEFAULT_MAX_REDIRECTS, allowedHosts, sensitiveHeaders = [] } = options;
  const deps: SafeFetchDeps = { ...defaultDeps, ...options.deps };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const baseHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    if (k.toLowerCase() !== "cookie") baseHeaders[k] = v;
  }
  const dropOnCrossHost = new Set(["authorization", ...sensitiveHeaders.map((h) => h.toLowerCase())]);

  try {
    let url = assertSafeUrl(input, allowedHosts);
    const originalHost = url.hostname.toLowerCase();
    let headers = baseHeaders;

    for (let hop = 0; ; hop++) {
      const address = await resolveAndCheck(url, deps);
      let raw: RawResponse;
      try {
        raw = await Promise.race([
          deps.request({ url, address, headers, signal: controller.signal }),
          new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new SafeFetchError("timeout")), { once: true })),
        ]);
      } catch (err) {
        if (err instanceof SafeFetchError) throw err;
        throw new SafeFetchError(controller.signal.aborted ? "timeout" : "network");
      }

      if (REDIRECT_STATUSES.has(raw.status)) {
        const location = headerValue(raw.headers, "location");
        raw.destroy();
        if (hop >= maxRedirects) throw new SafeFetchError("too_many_redirects");
        if (!location) throw new SafeFetchError("bad_redirect");
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          throw new SafeFetchError("bad_redirect");
        }
        url = assertSafeUrl(next, allowedHosts);
        if (url.hostname.toLowerCase() !== originalHost) {
          headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !dropOnCrossHost.has(k.toLowerCase())));
        }
        continue;
      }

      const bytes = await readCapped(raw, maxBytes, controller.signal);
      const text = new TextDecoder().decode(bytes);
      const outHeaders = new Headers();
      for (const [k, v] of Object.entries(raw.headers)) {
        if (v !== undefined) outHeaders.set(k, Array.isArray(v) ? v.join(", ") : v);
      }
      return {
        ok: raw.status >= 200 && raw.status < 300,
        status: raw.status,
        headers: outHeaders,
        text: () => text,
        json: () => JSON.parse(text),
      };
    }
  } catch (err) {
    if (err instanceof SafeFetchError) {
      log.warn("outbound request refused or failed", { code: err.code, detail: err.detail });
      throw err;
    }
    log.warn("outbound request failed", { err });
    throw new SafeFetchError("network");
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------- fixed first-party endpoints
//
// Arc's own RPC and explorer have fixed, configured hostnames, so they use the
// platform `fetch` with a hostname allowlist, `redirect: "error"` and a body
// cap instead of the full DNS/IP pipeline.

export const ARC_RPC_HOSTS = ["rpc.mainnet.arc.io", "rpc.testnet.arc.io"] as const;
export const ARC_EXPLORER_HOSTS = ["explorer.arc.io", "explorer.testnet.arc.io"] as const;
export const JSON_BODY_CAP_BYTES = 1024 * 1024;

/** Reads a fetch Response or Request body as text, aborting once it exceeds `maxBytes`. */
export async function readTextCapped(res: { headers: Headers; body: ReadableStream<Uint8Array> | null }, maxBytes: number = JSON_BODY_CAP_BYTES): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new SafeFetchError("too_large");
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SafeFetchError("too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(out);
}
