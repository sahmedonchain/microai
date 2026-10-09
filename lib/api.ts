import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifySessionToken, SESSION_COOKIE, type SessionPayload } from "@/lib/session";
import { consume, getClientIp, type LimitSpec } from "@/lib/rateLimit";
import { createLogger, type Logger } from "@/lib/logger";

// Shared API plumbing: typed errors, request parsing, session lookup and rate
// limiting for every route handler.
//
// Error body (all non-2xx responses):
//   { error: string, code: ApiErrorCode, requestId: string, details?: unknown }
// `error` stays a plain string so existing clients that read `data.error`
// keep working; `code` is the stable machine-readable value.

export type ApiErrorCode =
  | "invalid_request"
  | "session_required"
  | "no_credits"
  | "payment_invalid"
  | "not_found"
  | "gone"
  | "rate_limited"
  | "upstream_unavailable"
  | "internal";

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  requestId: string;
  details?: unknown;
  [extra: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly opts: { retryAfterSec?: number; details?: unknown; extra?: Record<string, unknown> } = {}
  ) {
    super(message);
  }
}

export const apiErrors = {
  badRequest: (message: string, details?: unknown) => new ApiError(400, "invalid_request", message, { details }),
  // "session_required" and "no_credits" are literal strings existing clients match on.
  sessionRequired: () => new ApiError(401, "session_required", "session_required"),
  noCredits: () => new ApiError(402, "no_credits", "no_credits"),
  paymentInvalid: (message: string) => new ApiError(402, "payment_invalid", message),
  notFound: (message: string) => new ApiError(404, "not_found", message),
  gone: (message: string) => new ApiError(410, "gone", message),
  tooMany: (retryAfterSec: number, message = "Too many requests. Please slow down and try again shortly.") =>
    new ApiError(429, "rate_limited", message, { retryAfterSec }),
  upstream: (message: string) => new ApiError(502, "upstream_unavailable", message),
  internal: (message = "Server error occurred.") => new ApiError(500, "internal", message),
};

export function errorResponse(err: ApiError, requestId: string): Response {
  const body: ApiErrorBody = {
    ...err.opts.extra,
    error: err.message,
    code: err.code,
    requestId,
    ...(err.opts.details !== undefined ? { details: err.opts.details } : {}),
  };
  const headers: Record<string, string> = { "x-request-id": requestId };
  if (err.opts.retryAfterSec !== undefined) headers["Retry-After"] = String(Math.max(1, Math.ceil(err.opts.retryAfterSec)));
  return NextResponse.json(body, { status: err.status, headers });
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw apiErrors.badRequest("Invalid request body.");
  }
  return parseWith(schema, raw);
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return parseWith(schema, params);
}

function parseWith<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  throw apiErrors.badRequest(`${where}${issue.message}`, result.error.issues.slice(0, 5).map((i) => ({ path: i.path, message: i.message })));
}

export interface ApiContext {
  req: Request;
  requestId: string;
  log: Logger;
  session: SessionPayload | null;
  ip: string;
}

export interface RouteOptions {
  // Used for logging and as the rate-limit namespace.
  name: string;
  // "required": 401 without a valid session. "optional": session if present.
  auth?: "required" | "optional" | "none";
  // Applied in order. scope "actor" (default) keys by wallet when a session
  // exists, otherwise by IP; scope "global" is one shared budget for the route.
  limits?: LimitSpec[];
}

async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export function withApi(opts: RouteOptions, handler: (ctx: ApiContext) => Promise<Response | object>) {
  const auth = opts.auth ?? "none";
  return async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const log = createLogger({ route: opts.name, requestId });
    try {
      let session: SessionPayload | null = null;
      if (auth !== "none") {
        try {
          session = await readSession();
        } catch (err) {
          // e.g. SESSION_SECRET missing: a server misconfiguration, not a client error.
          log.error("session lookup failed", { err });
          throw apiErrors.internal();
        }
        if (auth === "required" && !session) throw apiErrors.sessionRequired();
      }

      const ip = getClientIp(req);
      const actor = session ? `w:${session.sub}` : `ip:${ip}`;
      for (const [i, spec] of (opts.limits ?? []).entries()) {
        const key = spec.scope === "global" ? `${opts.name}:global:${i}` : `${opts.name}:${actor}:${i}`;
        const result = await consume(key, spec.limit, spec.windowSec * 1000);
        if (!result.ok) {
          log.warn("rate limited", { scope: spec.scope ?? "actor", windowSec: spec.windowSec });
          throw apiErrors.tooMany(result.retryAfterSec);
        }
      }

      const out = await handler({ req, requestId, log, session, ip });
      if (out instanceof Response) {
        if (!out.headers.has("x-request-id")) out.headers.set("x-request-id", requestId);
        return out;
      }
      return NextResponse.json(out, { headers: { "x-request-id": requestId } });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status >= 500) log.error("request failed", { code: err.code, err });
        return errorResponse(err, requestId);
      }
      log.error("unhandled error", { err });
      return errorResponse(apiErrors.internal(), requestId);
    }
  };
}
