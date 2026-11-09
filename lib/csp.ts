// Content-Security-Policy builder. Used by proxy.ts, which creates a fresh nonce
// per request. Kept free of Next imports so it is unit-testable.
//
// Mode switch: set CSP_ENFORCE=1 (or "true") in the environment to send the
// policy as `Content-Security-Policy` (enforced). Anything else keeps it as
// `Content-Security-Policy-Report-Only` (violations are reported, nothing is blocked).

export const CSP_REPORT_PATH = "/api/csp-report";

export function isCspEnforced(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.CSP_ENFORCE?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function cspHeaderName(enforce: boolean): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

export function makeNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

// Reviewed against the code on 10 Nov 2026: the browser's own fetch() calls all go to
// our /api routes (Stats reads the chain through /api/chain, not the RPC directly),
// wallet calls go through the injected wallet provider, fonts are self-hosted by
// next/font, and no component renders a remote <img>. So connections and images need
// only this origin. No third-party scripts, frames or widgets are used.
export function buildCsp(nonce: string, opts: { dev?: boolean } = {}): string {
  const dev = opts.dev ?? process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // Nonce + strict-dynamic: no 'unsafe-inline' for scripts. Next.js stamps the
    // nonce on its own scripts when it sees it in the request's CSP header.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Styles keep 'unsafe-inline': the UI uses inline style attributes widely,
    // which nonces cannot cover. Inline CSS cannot run script.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
  ].join("; ");
}
