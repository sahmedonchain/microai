import { safeFetch, SafeFetchError, type SafeFetchDeps, type SafeFetchErrorCode } from "@/lib/safeFetch";
import type { EndpointResponse } from "./types";

// Asks a developer's x402 endpoint for its payment requirements. The request
// carries no payment, and it goes through safeFetch: https only, private and
// internal addresses blocked, a short deadline and a small body cap.

export const VERIFY_TIMEOUT_MS = 5000;
export const VERIFY_MAX_BYTES = 64 * 1024;
export const VERIFY_MAX_REDIRECTS = 2;

export async function fetchChallenge(url: string, deps?: Partial<SafeFetchDeps>): Promise<EndpointResponse> {
  const res = await safeFetch(url, {
    timeoutMs: VERIFY_TIMEOUT_MS,
    maxBytes: VERIFY_MAX_BYTES,
    maxRedirects: VERIFY_MAX_REDIRECTS,
    headers: {
      Accept: "application/json",
      "User-Agent": "MicroAI-Verify/0.1 (+https://github.com/sahmedonchain/microai)",
    },
    deps,
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { status: res.status, headers, body: res.text() };
}

export interface FetchProblem {
  /** "invalid": the URL cannot be checked. "unreachable": it could not be reached in time. */
  kind: "invalid" | "unreachable";
  message: string;
}

// Plain-language messages. They never repeat the address or any detail of a
// refused destination.
const PROBLEMS: Record<SafeFetchErrorCode, FetchProblem> = {
  bad_url: { kind: "invalid", message: "That is not a valid URL. Use the full https:// address of the endpoint." },
  not_https: { kind: "invalid", message: "Only https:// URLs can be checked." },
  bad_port: { kind: "invalid", message: "Only the standard https port (443) can be checked." },
  userinfo: { kind: "invalid", message: "URLs with a username or password cannot be checked." },
  host_not_allowed: { kind: "invalid", message: "That host cannot be checked." },
  blocked_address: { kind: "invalid", message: "That address cannot be checked: private, internal and loopback addresses are not allowed." },
  dns_failed: { kind: "unreachable", message: "That host name could not be found." },
  too_many_redirects: { kind: "unreachable", message: "The endpoint redirected too many times." },
  bad_redirect: { kind: "unreachable", message: "The endpoint sent a redirect that could not be followed." },
  timeout: { kind: "unreachable", message: "The endpoint did not answer within 5 seconds." },
  too_large: { kind: "unreachable", message: "The endpoint's answer is larger than 64 KB, which is far more than a payment challenge needs." },
  network: { kind: "unreachable", message: "The endpoint could not be reached." },
};

export function describeFetchError(err: SafeFetchError): FetchProblem {
  return PROBLEMS[err.code];
}
