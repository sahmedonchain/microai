import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { buildCsp, cspHeaderName, isCspEnforced, makeNonce } from "@/lib/csp";
import { proxy, config } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `) || d === name);

describe("buildCsp", () => {
  const csp = buildCsp("NONCE123", { dev: false });

  it("script-src uses the nonce and strict-dynamic and has NO unsafe-inline / unsafe-eval", () => {
    const s = directive(csp, "script-src")!;
    expect(s).toContain("'nonce-NONCE123'");
    expect(s).toContain("'strict-dynamic'");
    expect(s).not.toContain("unsafe-inline");
    expect(s).not.toContain("unsafe-eval");
  });

  it("allows unsafe-eval only in development", () => {
    expect(directive(buildCsp("n", { dev: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildCsp("n", { dev: false }), "script-src")).not.toContain("'unsafe-eval'");
  });

  it("locks down framing, plugins, base and forms", () => {
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("limits connections and images to this origin; no third-party script origins", () => {
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob:");
    expect(directive(csp, "script-src")).not.toMatch(/https?:/);
  });

  it("does not allow X/Twitter origins (the app has no X widget)", () => {
    expect(csp).not.toMatch(/twitter|twimg|x\.com/);
  });

  it("reports to the CSP endpoint", () => expect(csp).toContain("report-uri /api/csp-report"));
});

describe("nonce", () => {
  it("is unique per call and base64", () => {
    const a = makeNonce();
    const b = makeNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });
});

describe("CSP_ENFORCE switch", () => {
  it("is report-only by default", () => {
    expect(isCspEnforced({})).toBe(false);
    expect(cspHeaderName(false)).toBe("Content-Security-Policy-Report-Only");
  });
  it.each(["1", "true", "TRUE", " true "])("enforces for %j", (v) => {
    expect(isCspEnforced({ CSP_ENFORCE: v })).toBe(true);
    expect(cspHeaderName(true)).toBe("Content-Security-Policy");
  });
  it.each(["", "0", "false", "yes", "enforce"])("stays report-only for %j", (v) => expect(isCspEnforced({ CSP_ENFORCE: v })).toBe(false));
});

describe("proxy", () => {
  const run = () => proxy(new NextRequest("https://example.com/news"));

  beforeEach(() => vi.stubEnv("CSP_ENFORCE", ""));

  it("sends Report-Only by default and does not enforce", () => {
    const res = run();
    expect(res.headers.get("content-security-policy-report-only")).toContain("script-src 'self' 'nonce-");
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("sends an enforced policy when CSP_ENFORCE=1", () => {
    vi.stubEnv("CSP_ENFORCE", "1");
    const res = run();
    expect(res.headers.get("content-security-policy")).toContain("'strict-dynamic'");
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("uses a fresh nonce per request, and the same nonce in the header as in the request forwarded to Next", () => {
    const a = run();
    const b = run();
    const nonceOf = (r: Response) => /'nonce-([^']+)'/.exec(r.headers.get("content-security-policy-report-only")!)![1];
    expect(nonceOf(a)).not.toBe(nonceOf(b));
    // NextResponse.next({request}) exposes forwarded request headers via x-middleware-request-* headers.
    expect(a.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(a));
    expect(a.headers.get("x-middleware-request-content-security-policy-report-only")).toContain(`'nonce-${nonceOf(a)}'`);
  });

  it("matcher skips API routes, static assets and prefetches", () => {
    const m = config.matcher[0];
    const re = new RegExp(`^${m.source}$`);
    expect(re.test("/news")).toBe(true);
    expect(re.test("/")).toBe(true);
    expect(re.test("/api/chat")).toBe(false);
    expect(re.test("/_next/static/x.js")).toBe(false);
    expect(re.test("/favicon.ico")).toBe(false);
    expect(m.missing).toContainEqual({ type: "header", key: "next-router-prefetch" });
  });
});

describe("the CSP matches what the browser code actually does", () => {
  // If a client component starts calling another origin, this fails and the CSP must be reviewed first.
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n: string) => {
      const p = `${dir}/${n}`;
      return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) ? [p] : [];
    });
  const clientFiles = walk("app").filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));

  it("client components fetch only same-origin /api paths or relative URLs", () => {
    for (const f of clientFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/fetch\(\s*["'`]https?:/);
      expect(src, f).not.toMatch(/new WebSocket\(|new EventSource\(/);
    }
  });
  it("no component renders a remote image", () => {
    for (const f of walk("app")) expect(readFileSync(f, "utf8"), f).not.toMatch(/<img\b|next\/image|src=["']https?:/);
  });
});
