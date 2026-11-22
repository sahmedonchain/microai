import { NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { getHealth } from "@/lib/health";

// GET /api/health for uptime monitors. 200 when Redis and the Arc RPC answer, 503
// when either does not, so a monitor can alert on any non-200. The body names only
// which dependency is down. Fails open on the limiter on purpose: it must still
// answer (and report Redis down) when Redis is the thing that is broken.

export const GET = withApi(
  { name: "health", limits: [{ limit: 30, windowSec: 60 }, { limit: 2000, windowSec: 3600, scope: "global" }], onLimiterError: "open" },
  async () => {
    const report = await getHealth();
    return NextResponse.json(report, { status: report.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
  }
);
