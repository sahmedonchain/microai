import { NextResponse } from "next/server";
import { ethers } from "ethers";
import crypto from "crypto";
import { storeNonce } from "@/lib/nonce";
import { buildAuthMessage } from "@/lib/siwe";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  try {
    await storeNonce(address, nonce, expiresAt);
  } catch (err) {
    console.error("Nonce store error:", err);
    return NextResponse.json({ error: "Could not start signing request" }, { status: 500 });
  }

  const message = buildAuthMessage(address, nonce, expiresAt);
  return NextResponse.json({ message });
}
