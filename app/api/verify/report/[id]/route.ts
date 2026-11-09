import { z } from "zod";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { deleteReport, isReportId } from "@/lib/verify/reportStore";

// Deletes a shared Verify report early. Needs the delete token that was returned
// once, when the link was created. A wrong token and a missing report look the
// same, so this cannot be used to find out which ids exist.

const deleteBody = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{22}$/, "Invalid delete token.") });

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  return handler(req, id);
}

function handler(req: Request, id: string): Promise<Response> {
  return withApi(
    { name: "verify-report-delete", auth: "none", onLimiterError: "closed", limits: [{ limit: 20, windowSec: 3600 }] },
    async () => {
      if (!isReportId(id)) throw apiErrors.notFound("Report not found.");
      const { token } = await parseJson(req, deleteBody);
      if (!(await deleteReport(id, token))) throw apiErrors.notFound("Report not found.");
      return { deleted: true };
    }
  )(req);
}
