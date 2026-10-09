import crypto from "crypto";
import { ethers } from "ethers";
import { apiErrors, parseQuery, withApi } from "@/lib/api";
import { ARC_MAINNET } from "@/lib/arcConfig";
import { storeNonce } from "@/lib/nonce";
import { consume } from "@/lib/rateLimit";
import { nonceQuery } from "@/lib/schemas";
import { buildSiweMessage, siweContext, SIWE_STATEMENT, SIWE_TTL_MS } from "@/lib/siwe";

// Public by necessity (it starts the sign-in), so it is rate-limited per IP
// and per address.
export const GET = withApi({ name: "session-nonce", limits: [{ limit: 10, windowSec: 60 }] }, async ({ req }) => {
  const { address } = parseQuery(req, nonceQuery);
  const checksummed = ethers.getAddress(address);

  const perAddress = await consume(`session-nonce:addr:${checksummed.toLowerCase()}`, 5, 60_000);
  if (!perAddress.ok) throw apiErrors.tooMany(perAddress.retryAfterSec);

  const now = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(now + SIWE_TTL_MS).toISOString();
  const { domain, uri } = siweContext(req);

  const message = buildSiweMessage({
    domain,
    address: checksummed,
    statement: SIWE_STATEMENT,
    uri,
    version: "1",
    chainId: ARC_MAINNET.chainId,
    nonce,
    issuedAt: new Date(now).toISOString(),
    expirationTime: expiresAt,
  });

  await storeNonce(nonce, { address: checksummed.toLowerCase(), message, expiresAt });
  return { message };
});
