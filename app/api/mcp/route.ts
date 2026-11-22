import { NextResponse } from "next/server";
import { apiErrors, withApi } from "@/lib/api";
import { handleRpc, MAX_BODY_BYTES, parseRpc } from "@/lib/mcp/server";
import { runFacilitatorCheck } from "@/lib/verify/facilitatorCheck";
import { runTrustCheck } from "@/lib/verify/trustCheck";

// Read-only MCP server: POST /api/mcp (JSON-RPC 2.0, one request per call).
// See lib/mcp/server.ts for what it will and will not do. It has no sessions, no
// keys and no payments. Every call is rate limited per IP and shares one global
// budget; the endpoint-check tool also goes through the Trust API's cache, per-host
// cap and guarded outbound client, and the same PAUSE_VERIFY kill switch.

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export const POST = withApi(
  {
    name: "mcp",
    pause: "verify",
    onLimiterError: "closed",
    auth: "none",
    limits: [
      { limit: 20, windowSec: 60 },
      { limit: 200, windowSec: 86_400 },
      { limit: 5000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw apiErrors.badRequest("Request is too large.");
    const parsed = parseRpc(text);
    if ("error" in parsed) return json(parsed.error, 400);

    const out = await handleRpc(parsed, { checkEndpoint: (url, network) => runTrustCheck(url, network, log), checkFacilitator: (url, network) => runFacilitatorCheck(url, network, log) });
    if (out === null) return new Response(null, { status: 202 });
    return json(out);
  }
);

export const GET = () => new Response(null, { status: 405, headers: { allow: "POST" } });
