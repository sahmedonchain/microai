import { NextResponse } from "next/server";
import { getNewsPayload } from "@/lib/news";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const REFRESH_LIMIT = 6; // forced refreshes
const REFRESH_WINDOW_MS = 60_000; // per minute, per IP

export async function GET(req: Request) {
  // ?refresh=1 skips the shared 30-minute cache and re-pulls every source.
  // Rate-limited so it cannot be used to hammer the upstream feeds.
  const wantsRefresh = new URL(req.url).searchParams.get("refresh") === "1";
  const forceRefresh = wantsRefresh && checkRateLimit(`news-refresh:${getClientIp(req)}`, REFRESH_LIMIT, REFRESH_WINDOW_MS);

  const payload = await getNewsPayload({ forceRefresh });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
