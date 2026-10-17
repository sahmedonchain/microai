import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, cspHeaderName, isCspEnforced, makeNonce } from "@/lib/csp";

// Sets the Content-Security-Policy with a per-request nonce. Report-Only unless
// CSP_ENFORCE=1 (see lib/csp.ts). The other security headers are static and live
// in next.config.ts.
export function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const csp = buildCsp(nonce);
  const name = cspHeaderName(isCspEnforced());

  // Next.js reads the nonce from the CSP header on the *request* and stamps it
  // on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(name, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(name, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, static assets and prefetches.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
