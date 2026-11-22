import { withApi } from "@/lib/api";
import { loadForParty } from "@/lib/refund/access";
import { detail } from "@/lib/refund/view";

// One case with its evidence bundle. Only the buyer and the merchant can read it.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return withApi({ name: "refund-case-get", auth: "required", onLimiterError: "closed", limits: [{ limit: 60, windowSec: 60 }] }, async ({ session }) => {
    return detail(await loadForParty(id, session!.sub), session!.sub);
  })(req);
}
