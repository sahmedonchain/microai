export function buildAuthMessage(address: string, nonce: string, expiresAt: string): string {
  return `MicroAI wants you to verify wallet ownership to manage your query credit.

This does not authorize any payment by itself — USDC transfers still require a separate transaction you approve.

Address: ${address}
Nonce: ${nonce}
Expires: ${expiresAt}`;
}
