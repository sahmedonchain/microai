import { NextResponse } from "next/server";
import { parseQuery, withApi } from "@/lib/api";
import { trustQuery } from "@/lib/schemas";
import { runTrustCheck } from "@/lib/verify/trustCheck";

// Trust API: GET /api/trust?url=https://...&network=mainnet|testnet
//
// A read-only, machine-readable version of MicroAI Verify's endpoint check, for
// agents that want to know whether a service's payment setup is sound before
// paying it. It is a configuration check, not a reputation score.
//
// What it does not do: it sends no payment, writes nothing on-chain (no ERC-8004
// registry entry), and does not charge per call. Those are deliberately left out
// until there is proven demand, because each one handles real money or state.
//
// It fetches a third party's URL, so it is guarded like Verify (safeFetch, same
// kill switch). The cache and per-host cap live in lib/verify/trustCheck.ts.

export const GET = withApi(
  {
    name: "trust",
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
    const { url, network } = parseQuery(req, trustQuery);
    const result = await runTrustCheck(url, network, log);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  }
);
