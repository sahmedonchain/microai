import type { NextConfig } from "next";

// The browser reads Arc RPC directly (live stats), everything else goes through our own API.
const CSP = [
  "default-src 'self'",
  // Next.js hydration and the inline styles used across the UI need 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://rpc.mainnet.arc.io",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // Report-only for now: violations show in the browser console without blocking
  // anything (wallet extensions and Vercel preview tooling inject their own scripts).
  // Switch the key to "Content-Security-Policy" once the console stays clean in production.
  { key: "Content-Security-Policy-Report-Only", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
