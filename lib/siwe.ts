// Sign-In with Ethereum (EIP-4361) message building, parsing and validation.
// https://eips.ethereum.org/EIPS/eip-4361
//
// Only the exact message shape we issue is accepted (no resources, no request
// id), so the parser is strict by design.

export const SIWE_STATEMENT = "Sign in to MicroAI to manage your query credits. This does not authorize any payment.";
export const SIWE_TTL_MS = 5 * 60 * 1000;
const MAX_LIFETIME_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export interface SiweFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

export function buildSiweMessage(f: SiweFields): string {
  return [
    `${f.domain} wants you to sign in with your Ethereum account:`,
    f.address,
    "",
    f.statement,
    "",
    `URI: ${f.uri}`,
    `Version: ${f.version}`,
    `Chain ID: ${f.chainId}`,
    `Nonce: ${f.nonce}`,
    `Issued At: ${f.issuedAt}`,
    `Expiration Time: ${f.expirationTime}`,
  ].join("\n");
}

function field(line: string | undefined, label: string): string | null {
  return line !== undefined && line.startsWith(`${label}: `) ? line.slice(label.length + 2) : null;
}

export function parseSiweMessage(text: string): SiweFields | null {
  const lines = text.split("\n");
  if (lines.length !== 11) return null;
  const header = /^([^\s]+) wants you to sign in with your Ethereum account:$/.exec(lines[0]);
  if (!header) return null;
  if (lines[2] !== "" || lines[4] !== "") return null;

  const uri = field(lines[5], "URI");
  const version = field(lines[6], "Version");
  const chainIdText = field(lines[7], "Chain ID");
  const nonce = field(lines[8], "Nonce");
  const issuedAt = field(lines[9], "Issued At");
  const expirationTime = field(lines[10], "Expiration Time");
  if (!uri || !version || !chainIdText || !nonce || !issuedAt || !expirationTime) return null;
  if (!/^\d+$/.test(chainIdText)) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(lines[1])) return null;
  if (!/^[a-zA-Z0-9]{8,}$/.test(nonce)) return null;

  return {
    domain: header[1],
    address: lines[1],
    statement: lines[3],
    uri,
    version,
    chainId: Number(chainIdText),
    nonce,
    issuedAt,
    expirationTime,
  };
}

export interface SiweExpectations {
  domain: string;
  uri: string;
  chainId: number;
  now?: number;
}

// Returns an error message, or null when every field is acceptable.
export function validateSiweFields(f: SiweFields, expect: SiweExpectations): string | null {
  const now = expect.now ?? Date.now();
  if (f.domain !== expect.domain) return "Sign-in message is for a different domain.";
  if (f.uri !== expect.uri) return "Sign-in message has an unexpected URI.";
  if (f.chainId !== expect.chainId) return "Sign-in message is for a different chain.";
  if (f.version !== "1") return "Unsupported sign-in message version.";
  if (f.statement !== SIWE_STATEMENT) return "Unexpected sign-in statement.";

  const issued = Date.parse(f.issuedAt);
  const expires = Date.parse(f.expirationTime);
  if (Number.isNaN(issued) || Number.isNaN(expires)) return "Sign-in message has an invalid timestamp.";
  if (issued > now + CLOCK_SKEW_MS) return "Sign-in message was issued in the future.";
  if (expires <= now) return "Signing request expired. Please try again.";
  if (expires - issued > MAX_LIFETIME_MS) return "Sign-in message lifetime is too long.";
  return null;
}

// Domain and URI of this deployment. SIWE_DOMAIN pins it in production;
// otherwise the host the request arrived on is used.
export function siweContext(req: Request): { domain: string; uri: string } {
  const configured = process.env.SIWE_DOMAIN?.trim();
  const url = new URL(req.url);
  const host = configured || req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = local ? (req.headers.get("x-forwarded-proto")?.split(",")[0] ?? url.protocol.replace(":", "")) : "https";
  return { domain: host, uri: `${proto}://${host}` };
}
