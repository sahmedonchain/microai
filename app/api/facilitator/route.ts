import { NextResponse } from "next/server";
import { parseQuery, withApi } from "@/lib/api";
import { facilitatorQuery } from "@/lib/schemas";
import { runFacilitatorCheck } from "@/lib/verify/facilitatorCheck";

// GET /api/facilitator?url=https://facilitator.example&network=mainnet|testnet
//
// Read-only: asks the facilitator's GET /supported whether it lists Arc. Sends no
// payment and never calls /verify or /settle (see lib/verify/facilitator.ts for why).
// Guarded like Verify: safeFetch, PAUSE_VERIFY kill switch, fail-closed limiter and a
// per-host cap.

export const GET = withApi(
  {
    name: "facilitator",
    pause: "verify",
    onLimiterError: "closed",
    auth: "none",
    limits: [
      { limit: 5, windowSec: 60 },
      { limit: 40, windowSec: 86_400 },
      { limit: 1000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    const { url, network } = parseQuery(req, facilitatorQuery);
    return NextResponse.json(await runFacilitatorCheck(url, network, log), { headers: { "cache-control": "no-store" } });
  }
);
