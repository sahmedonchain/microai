import { withApi } from "@/lib/api";
import { getCredit } from "@/lib/credits";

export const GET = withApi({ name: "credits-balance", auth: "optional", limits: [{ limit: 60, windowSec: 60 }] }, async ({ session }) => {
  if (!session) return { authenticated: false, credits: 0 };
  return { authenticated: true, address: session.sub, credits: await getCredit(session.sub) };
});
