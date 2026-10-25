import { siweContext } from "./siwe";

// Cross-site request forgery guard for every state-changing request.
//
// The session cookie is SameSite=Lax already; this is a second, independent
// layer. A write (anything but GET/HEAD/OPTIONS) is rejected when the browser
// says it came from another site:
//   - an Origin header whose host is not this site's host, or "null";
//   - or, with no Origin, Sec-Fetch-Site: cross-site.
// Requests carrying neither header (curl, server-to-server, tests) are allowed:
// a forged browser request always carries at least one of them.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (h: string | null | undefined) => {
    const v = h?.split(",")[0].trim().toLowerCase();
    if (v) hosts.add(v);
  };
  add(req.headers.get("x-forwarded-host"));
  add(req.headers.get("host"));
  add(new URL(req.url).host);
  add(siweContext(req).domain);
  return hosts;
}

export function isCrossSiteRequest(req: Request): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;

  const origin = req.headers.get("origin");
  if (origin !== null) {
    if (origin === "null") return true;
    try {
      return !allowedHosts(req).has(new URL(origin).host.toLowerCase());
    } catch {
      return true;
    }
  }
  return req.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site";
}
