import { NextResponse } from "next/server";
import { ApiError, apiErrors, withApi } from "@/lib/api";
import { circleCall, CircleError } from "@/lib/swap/circle";
import { buildQuoteQuery, buildRatesQuery, buildStatusQuery, buildSwapBody, confirmedQuote, pathOf } from "@/lib/swap/proxy";
import { swapServerConfig } from "@/lib/swap/server-config";

// The only way the browser's wallet SDK reaches Circle's swap service. The API
// key is added here, on the server. Every request must belong to a swap the
// user confirmed, and the fee and its recipient are set here, not by the browser.

function handle(method: "GET" | "POST") {
  return async (req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> => {
    const { path } = await ctx.params;
    return withApi(
      { name: "swap-circle", auth: "required", onLimiterError: "closed", limits: [{ limit: 40, windowSec: 60 }] },
      async ({ session, log }) => {
        const op = pathOf(path);
        if (!op) throw apiErrors.notFound("Not found.");
        // The SDK's usage report goes to Circle by default. It is not forwarded.
        if (op === "logs") return new NextResponse(null, { status: 204 });
        const cfg = swapServerConfig();
        if (!cfg) throw new ApiError(503, "upstream_unavailable", "Swap is not available yet.");
        const search = new URL(req.url).searchParams;

        let call: Parameters<typeof circleCall>;
        if (op === "swap" && method === "POST") {
          const r = await confirmedQuote(req, session!.sub);
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            throw apiErrors.badRequest("Invalid request body.");
          }
          call = ["swap", { body: buildSwapBody(body, r, cfg.treasury) }];
        } else if (method === "GET" && op === "quote") {
          call = ["quote", { query: buildQuoteQuery(search, await confirmedQuote(req, session!.sub)) }];
        } else if (method === "GET" && op === "swap/status") {
          await confirmedQuote(req, session!.sub).catch(() => undefined);
          call = ["swap/status", { query: buildStatusQuery(search) }];
        } else if (method === "GET" && op === "rates") {
          call = ["rates", { query: buildRatesQuery(search) }];
        } else throw apiErrors.notFound("Not found.");

        try {
          const r = await circleCall(...call);
          // A refused key is MicroAI's problem, not the user's, and is not described to the browser.
          if (r.status === 401 || r.status === 403) {
            log.error("swap service rejected the server credential", { status: r.status });
            throw apiErrors.upstream("The swap service is unavailable right now.");
          }
          return new NextResponse(r.text, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
        } catch (err) {
          if (err instanceof CircleError) throw apiErrors.upstream(err.message);
          throw err;
        }
      }
    )(req);
  };
}

export const GET = handle("GET");
export const POST = handle("POST");
