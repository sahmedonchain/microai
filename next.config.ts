import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy is per-request (nonce)
// and is set in proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Enforced anti-framing now, while the CSP (frame-ancestors 'none') is still report-only.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()" },
];

const nextConfig: NextConfig = {
  // Pages that were retired: send old links to the overview.
  async redirects() {
    return ["/grants", "/chat", "/build", "/credits"].map((source) => ({ source, destination: "/", permanent: false }));
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
