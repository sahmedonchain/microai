import Groq from "groq-sdk";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_QUERY_LENGTH = 300;
const MAX_PROJECTS = 500;
const MAX_NAME_LENGTH = 80;

// lib/ecosystemEnrichment only exports TVL helpers; the project directory
// itself lives in the ecosystem page, so the page sends its project names
// with the query. They are bounded and only ever used as a candidate list.
const body = z.object({
  query: z.string().trim().min(1, "Query is required.").max(MAX_QUERY_LENGTH, `Query must be ${MAX_QUERY_LENGTH} characters or fewer.`),
  projects: z.array(z.string()).max(MAX_PROJECTS).optional(),
});

export const POST = withApi({ name: "ecosystem-search", limits: [{ limit: 20, windowSec: 60 }] }, async ({ req, log }) => {
  const parsed = await parseJson(req, body);
  const query = parsed.query;
  const names = (parsed.projects ?? []).map((n) => n.trim().slice(0, MAX_NAME_LENGTH)).filter(Boolean);
  if (names.length === 0) throw apiErrors.badRequest("No projects provided to search.");

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
    return { answer, query };
  } catch (err) {
    log.error("Ecosystem search error", { err });
    throw apiErrors.internal("Search failed. Please try again.");
  }
});
