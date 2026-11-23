// Server-only: reads secrets from the environment. Never import this from a
// client component. Swap stays disabled until both values are set and valid.

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface SwapServerConfig {
  kitKey: string;
  treasury: string;
  /** Extra router addresses (public) allowed in a swap payload, comma separated in SWAP_EXTRA_TARGETS. */
  extraTargets: string[];
}

/** Live swap is OFF unless SWAP_ENABLED is exactly "1". To roll back, unset it and redeploy. */
export const swapEnabled = (env: Record<string, string | undefined> = process.env) => env.SWAP_ENABLED?.trim() === "1";

export function swapServerConfig(env: Record<string, string | undefined> = process.env): SwapServerConfig | null {
  if (!swapEnabled(env)) return null;
  const kitKey = env.KIT_KEY?.trim();
  const treasury = env.TREASURY_ADDRESS?.trim();
  if (!kitKey || !treasury || !ADDRESS.test(treasury)) return null;
  const extraTargets = (env.SWAP_EXTRA_TARGETS ?? "").split(",").map((a) => a.trim().toLowerCase()).filter((a) => ADDRESS.test(a));
  return { kitKey, treasury: treasury.toLowerCase(), extraTargets };
}
