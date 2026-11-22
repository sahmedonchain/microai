import { parseJson, withApi } from "@/lib/api";
import { asMerchant } from "@/lib/refund/access";
import { rejectBody } from "@/lib/refund/schemas";
import { saveCase } from "@/lib/refund/store";
import { detail } from "@/lib/refund/view";

// The merchant rejects the request and must give a reason, which goes into the evidence.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return withApi({ name: "refund-case-reject", auth: "required", onLimiterError: "closed", limits: [{ limit: 20, windowSec: 60 }] }, async ({ session }) => {
    const b = await parseJson(req, rejectBody);
    const c = await asMerchant(id, session!.sub, "OPEN", async (c) => {
      const now = new Date().toISOString();
      c.status = "REJECTED";
      c.merchantResponse = { decision: "REJECTED", message: b.reason, at: now };
      c.updatedAt = now;
      await saveCase(c);
      return c;
    });
    return detail(c, session!.sub);
  })(req);
}
