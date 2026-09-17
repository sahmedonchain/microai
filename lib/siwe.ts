export function buildAuthMessage(address: string, nonce: string, expiresAt: string): string {
  return `MicroAI wants you to authorize per-query USDC charges.

Address: ${address}
Nonce: ${nonce}
Expires: ${expiresAt}`;
}
