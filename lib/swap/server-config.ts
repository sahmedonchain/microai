// Server-only: reads secrets from the environment. Never import this from a
// client component. Swap stays disabled until both values are set and valid.

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface SwapServerConfig {
  kitKey: string;
  treasury: string;
}

export function swapServerConfig(env: Record<string, string | undefined> = process.env): SwapServerConfig | null {
  const kitKey = env.KIT_KEY?.trim();
  const treasury = env.TREASURY_ADDRESS?.trim();
  if (!kitKey || !treasury || !ADDRESS.test(treasury)) return null;
  return { kitKey, treasury: treasury.toLowerCase() };
}
