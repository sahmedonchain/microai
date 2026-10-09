import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { ApiError, apiErrors, parseJson, withApi } from "@/lib/api";
import { ARC_MAINNET } from "@/lib/arcConfig";
import { consumeNonce } from "@/lib/nonce";
import { sessionPostBody } from "@/lib/schemas";
import { issueSessionToken, SESSION_COOKIE } from "@/lib/session";
import { parseSiweMessage, siweContext, validateSiweFields } from "@/lib/siwe";

const isProd = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export const GET = withApi({ name: "session-get", auth: "optional", limits: [{ limit: 60, windowSec: 60 }] }, async ({ session }) => {
  if (!session) return { authenticated: false };
  return { authenticated: true, address: session.sub, expiresAt: session.exp * 1000 };
});

export const POST = withApi({ name: "session-create", limits: [{ limit: 10, windowSec: 60 }] }, async ({ req, log }) => {
  const { address, signature, message } = await parseJson(req, sessionPostBody);

  const fields = parseSiweMessage(message);
  if (!fields) throw apiErrors.badRequest("Invalid sign-in message.");

  // Consume first: a nonce is spent by any attempt, valid or not.
  const stored = await consumeNonce(fields.nonce);
  if (!stored) throw apiErrors.badRequest("Signing request expired or already used. Please try again.");

  const context = siweContext(req);
  const problem = validateSiweFields(fields, { ...context, chainId: ARC_MAINNET.chainId });
  if (problem) throw apiErrors.badRequest(problem);

  // The message must be byte-for-byte the one we issued for this wallet.
  if (
    message !== stored.message ||
    fields.address.toLowerCase() !== stored.address ||
    address.toLowerCase() !== stored.address
  ) {
    throw apiErrors.badRequest("Sign-in message does not match the request.");
  }

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    throw new ApiError(401, "session_required", "Invalid signature");
  }
  if (recovered.toLowerCase() !== stored.address) {
    log.warn("sign-in signature did not match the address");
    throw new ApiError(401, "session_required", "Signature does not match address");
  }

  const res = NextResponse.json({
    ok: true,
    address: stored.address,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  res.cookies.set(SESSION_COOKIE, issueSessionToken(stored.address), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
});

export const DELETE = withApi({ name: "session-delete", limits: [{ limit: 30, windowSec: 60 }] }, async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
