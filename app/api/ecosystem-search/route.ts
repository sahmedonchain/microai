import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute, per IP

const MAX_QUERY_LENGTH = 300;
const MAX_PROJECTS = 500;
const MAX_NAME_LENGTH = 80;

// lib/ecosystemEnrichment only exports TVL helpers; the project directory
// itself lives in the ecosystem page, so the page sends its project names
// with the query. They are bounded and only ever used as a candidate list.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`ecosystem-search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  let query: string;
  let names: string[];
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
    names = Array.isArray(body?.projects)
      ? body.projects
          .filter((n: unknown): n is string => typeof n === "string")
          .map((n: string) => n.trim().slice(0, MAX_NAME_LENGTH))
          .filter(Boolean)
          .slice(0, MAX_PROJECTS)
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (names.length === 0) {
    return NextResponse.json({ error: "No projects provided to search." }, { status: 400 });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are MicroAI Ecosystem Search. You help developers find Arc projects. Answer in 2-3 sentences, then list matching project names as a bullet list. Only mention projects from the provided list.",
        },
        { role: "user", content: `${query}\n\nAvailable projects:\n${names.join("\n")}` },
      ],
      temperature: 0.1,
      max_tokens: 600,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "No answer could be generated.";
    return NextResponse.json({ answer, query });
  } catch (err) {
    console.error("Ecosystem search error:", err);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
