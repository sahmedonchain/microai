import Groq from "groq-sdk";
import { apiErrors, parseJson, withApi } from "@/lib/api";
import { projects } from "@/lib/ecosystemData";
import { ecosystemSearchBody } from "@/lib/schemas";
import { UNTRUSTED_DATA_NOTICE, dataBlock } from "@/lib/untrusted";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// The candidate list is built here, from the directory in lib/ecosystemData.ts.
// The request body carries only the user's question: no project names or other
// client-supplied text ever becomes prompt context.
const PROJECT_LIST = dataBlock(
  "ecosystem_projects",
  projects.map((p) => `${p.name} | ${p.category} | ${p.tags.join(", ")} | ${p.desc.slice(0, 110)}`),
  { maxLineLen: 300, maxLines: 500 }
);

// Public AI endpoint: strict per-minute and per-day limits for each caller
// (wallet if signed in, otherwise IP) plus one shared daily budget for the route.
export const POST = withApi(
  {
    name: "ecosystem-search",
    auth: "optional",
    limits: [
      { limit: 10, windowSec: 60 },
      { limit: 60, windowSec: 86_400 },
      { limit: 3000, windowSec: 86_400, scope: "global" },
    ],
  },
  async ({ req, log }) => {
    const { query } = await parseJson(req, ecosystemSearchBody);

    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content:
              `You are MicroAI Ecosystem Search. You help developers find Arc projects. Answer in 2-3 sentences, then list matching project names as a bullet list. Only mention projects from the provided list. ${UNTRUSTED_DATA_NOTICE}`,
          },
          { role: "user", content: `${query}\n\nAvailable projects (name | category | tags | description):\n${PROJECT_LIST}` },
        ],
        temperature: 0.1,
        max_tokens: 600,
      });

      const answer = completion.choices[0]?.message?.content?.trim() || "No answer could be generated.";
      return { answer, query };
    } catch (err) {
      log.error("ecosystem search error", { err });
      throw apiErrors.internal("Search failed. Please try again.");
    }
  }
);
