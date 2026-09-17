import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getCredit } from "@/lib/credits";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false, credits: 0 });
  }

  const credits = await getCredit(session.sub);
  return NextResponse.json({ authenticated: true, address: session.sub, credits });
}
