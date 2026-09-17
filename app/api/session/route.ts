import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ethers } from "ethers";
import { consumeNonce } from "@/lib/nonce";
import { buildAuthMessage } from "@/lib/siwe";
import { issueSessionToken, verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const isProd = process.env.NODE_ENV === "production";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, address: session.sub, expiresAt: session.exp * 1000 });
}

export async function POST(req: Request) {
  try {
    const { address, signature } = await req.json();

    if (!address || !ethers.isAddress(address) || typeof signature !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const stored = await consumeNonce(address);
    if (!stored) {
      return NextResponse.json({ error: "Signing request expired. Please try again." }, { status: 400 });
    }

    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "Signing request expired. Please try again." }, { status: 400 });
    }

    const message = buildAuthMessage(address, stored.nonce, stored.expiresAt);

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Signature does not match address" }, { status: 401 });
    }

    const token = issueSessionToken(address);
    const res = NextResponse.json({
      ok: true,
      address: address.toLowerCase(),
      expiresAt: Date.now() + 60 * 60 * 24 * 1000,
    });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return res;
  } catch (err: unknown) {
    console.error("Session creation error:", err);
    return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
