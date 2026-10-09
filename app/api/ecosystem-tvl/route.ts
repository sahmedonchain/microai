import { withApi } from "@/lib/api";
import { getArcTvlForProject } from "@/lib/ecosystemEnrichment";

// Only these project names have a verified DeFiLlama Arc-chain TVL mapping
// (see lib/ecosystemEnrichment.ts). Keeping the list here too, rather than
// querying every ecosystem project, avoids wasted lookups for the ~76
// projects that were never going to match.
const ENRICHABLE_PROJECTS = ["Morpho", "Aave", "Aerodrome / Velodrome", "Synthra", "Argus"];

export const GET = withApi({ name: "ecosystem-tvl", limits: [{ limit: 30, windowSec: 60 }] }, async () => {
  const entries = await Promise.all(
    ENRICHABLE_PROJECTS.map(async (name) => [name, await getArcTvlForProject(name)] as const)
  );

  const tvl: Record<string, number> = {};
  for (const [name, value] of entries) {
    if (value !== null) tvl[name] = value;
  }

  return { tvl };
});
