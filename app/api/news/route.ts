import { withApi, parseQuery } from "@/lib/api";
import { getNewsPayload } from "@/lib/news";
import { consume } from "@/lib/rateLimit";
import { newsQuery } from "@/lib/schemas";

const REFRESH_LIMIT = 6; // forced refreshes
const REFRESH_WINDOW_MS = 60_000; // per minute, per IP

export const GET = withApi({ name: "news", limits: [{ limit: 60, windowSec: 60 }] }, async ({ req, ip }) => {
  // ?refresh=1 skips the shared 30-minute cache and re-pulls every source.
  // Rate-limited so it cannot be used to hammer the upstream feeds.
  const wantsRefresh = parseQuery(req, newsQuery).refresh === "1";
  const forceRefresh = wantsRefresh && (await consume(`news-refresh:${ip}`, REFRESH_LIMIT, REFRESH_WINDOW_MS)).ok;

  const payload = await getNewsPayload({ forceRefresh });
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
});
