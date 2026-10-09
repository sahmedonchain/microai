import { z } from "zod";

// Conversation history sent by the browser is untrusted: it may carry any
// role (including "system"), any length and any number of entries. Only
// well-formed user/assistant turns survive; the system prompt is server-only.
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_HISTORY_MESSAGE_LENGTH = 4000;
const MAX_ENTRIES_SCANNED = 50;

const turn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function parseChatHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const valid: ChatTurn[] = [];
  for (const entry of raw.slice(-MAX_ENTRIES_SCANNED)) {
    const parsed = turn.safeParse(entry);
    if (parsed.success) {
      valid.push({ role: parsed.data.role, content: parsed.data.content.slice(0, MAX_HISTORY_MESSAGE_LENGTH) });
    }
  }
  return valid.slice(-MAX_HISTORY_MESSAGES);
}
