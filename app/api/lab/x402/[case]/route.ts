import { buildLabAnswer, findLabCase } from "@/lib/verify/labFixtures";

// Test fixtures for MicroAI Verify. They answer 402 on purpose, with one known
// mistake each, so the checker can be shown working against a real endpoint.
// They are not services and never take a payment. Read-only, no state.

export async function GET(_req: Request, { params }: { params: Promise<{ case: string }> }) {
  const { case: id } = await params;
  const c = findLabCase(id);
  if (!c) {
    return Response.json({ error: "Unknown fixture" }, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  const a = buildLabAnswer(c);
  return new Response(a.body, { status: a.status, headers: a.headers });
}
