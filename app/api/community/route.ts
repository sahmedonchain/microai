import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getAutoFoundItems,
  getApprovedSubmissions,
  isAllowedSubmissionUrl,
  stripTrackingParams,
  isUrlAlreadySubmitted,
  markUrlSubmitted,
  addPendingSubmission,
  type SubmittedPost,
} from "@/lib/community";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const SUBMIT_RATE_LIMIT = 5;
const SUBMIT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface CreatorRank {
  name: string;
  xHandle?: string;
  verifiedCount: number;
}

export async function GET() {
  const [autoFound, approved] = await Promise.all([getAutoFoundItems(), getApprovedSubmissions()]);

  const creatorMap = new Map<string, CreatorRank>();
  for (const post of approved) {
    const key = (post.xHandle || post.creatorName).toLowerCase();
    const existing = creatorMap.get(key);
    if (existing) {
      existing.verifiedCount += 1;
    } else {
      creatorMap.set(key, { name: post.creatorName, xHandle: post.xHandle, verifiedCount: 1 });
    }
  }
  const creators = Array.from(creatorMap.values()).sort((a, b) => b.verifiedCount - a.verifiedCount);

  return NextResponse.json({ autoFound, approved, creators });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`community-submit:${ip}`, SUBMIT_RATE_LIMIT, SUBMIT_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  let body: { url?: unknown; title?: unknown; creatorName?: unknown; xHandle?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { url, title, creatorName, xHandle, note } = body;

  if (typeof url !== "string" || typeof title !== "string" || typeof creatorName !== "string") {
    return NextResponse.json({ error: "url, title, and creatorName are required." }, { status: 400 });
  }
  if (!title.trim() || !creatorName.trim()) {
    return NextResponse.json({ error: "title and creatorName cannot be empty." }, { status: 400 });
  }
  if (xHandle !== undefined && typeof xHandle !== "string") {
    return NextResponse.json({ error: "xHandle must be a string." }, { status: 400 });
  }
  if (note !== undefined && typeof note !== "string") {
    return NextResponse.json({ error: "note must be a string." }, { status: 400 });
  }

  if (!isAllowedSubmissionUrl(url)) {
    return NextResponse.json(
      { error: "Link must be an https URL from a supported platform (X, LinkedIn, YouTube, Medium, dev.to, Mirror, Paragraph, Substack, GitHub, or community.arc.io)." },
      { status: 400 }
    );
  }

  const cleanUrl = stripTrackingParams(url);

  if (await isUrlAlreadySubmitted(cleanUrl)) {
    return NextResponse.json({ error: "This link has already been submitted." }, { status: 409 });
  }

  const post: SubmittedPost = {
    id: crypto.randomUUID(),
    url: cleanUrl,
    title: title.trim().slice(0, 300),
    creatorName: creatorName.trim().slice(0, 120),
    xHandle: typeof xHandle === "string" && xHandle.trim() ? xHandle.trim().replace(/^@/, "").slice(0, 60) : undefined,
    note: typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : undefined,
    submittedAt: Date.now(),
  };

  await markUrlSubmitted(cleanUrl);
  await addPendingSubmission(post);

  return NextResponse.json({ ok: true, id: post.id });
}
