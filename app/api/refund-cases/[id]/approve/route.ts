import { apiErrors, parseJson, withApi } from "@/lib/api";
import { asMerchant } from "@/lib/refund/access";
import { approveBody } from "@/lib/refund/schemas";
import { saveCase } from "@/lib/refund/store";
import { detail } from "@/lib/refund/view";

// The merchant approves a full or partial refund. This only records the
// decision. The merchant then sends the USDC from their own wallet and reports
// the transaction at /settle. MicroAI never holds a key or sends money.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return withApi({ name: "refund-case-approve", auth: "required", onLimiterError: "closed", limits: [{ limit: 20, windowSec: 60 }] }, async ({ session }) => {
    const b = await parseJson(req, approveBody);
    const c = await asMerchant(id, session!.sub, "OPEN", async (c) => {
      const amount = b.amount ? BigInt(b.amount) : BigInt(c.requestedAmount);
      if (amount > BigInt(c.requestedAmount)) throw apiErrors.badRequest("You cannot approve more than the buyer asked for.");
      const now = new Date().toISOString();
      c.status = "APPROVED";
      c.approvedAmount = amount.toString();
      c.merchantResponse = { decision: "APPROVED", message: b.message ?? "", at: now };
      c.updatedAt = now;
      await saveCase(c);
      return c;
    });
    return detail(c, session!.sub);
  })(req);
}
