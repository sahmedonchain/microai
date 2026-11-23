import { SWAP_TOKENS, isSwapToken, type SwapToken } from "./config";

// Turns a chat message into a swap request. English and Bengali.
//   "100 USDC to EURC"   "Convert 100 USDC to EURC"   "Swap 100 USDC for EURC"
//   "100 USDC থেকে EURC করো"
// It reads three things: an amount, the token to sell and the token to buy.

export type ParsedSwap =
  | { kind: "swap"; amount: string; from: SwapToken; to: SwapToken }
  | { kind: "clarify"; question: string; from?: SwapToken; to?: SwapToken }
  | { kind: "unsupported"; message: string }
  | { kind: "none" };

const STOP = new Set(["to", "for", "into", "swap", "convert", "exchange", "change", "from", "my", "please", "pls", "of", "the", "a", "some", "worth", "in", "and", "now", "instantly", "karo", "koro", "kor", "kore"]);
export const UNSUPPORTED_MESSAGE = "Currently MicroAI supports USDC ↔ EURC swaps only.";

function readAmount(text: string): string | null {
  const m = /(?<![\w.])\d[\d,]*(?:\.\d+)?|(?<![\w.])\.\d+/.exec(text);
  if (!m) return null;
  let raw = m[0];
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) raw = raw.replace(/,/g, "");
  else raw = raw.replace(",", ".");
  if (!/^\d*\.?\d+$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const w = (whole || "0").replace(/^0+(?=\d)/, "");
  return frac ? `${w}.${frac}` : w;
}

export function parseSwapCommand(input: string): ParsedSwap {
  const text = input.trim().slice(0, 300);
  if (!text) return { kind: "none" };

  // Latin words that could be token symbols. Bengali words are ignored.
  const words = (text.match(/[A-Za-z][A-Za-z0-9]{1,9}/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w));
  const symbols = words.map((w) => w.toUpperCase());
  const amount = readAmount(text);
  const hasSwapWord = /\b(swap|convert|exchange)\b|থেকে|করো|করুন|কনভার্ট|সোয়াপ|\bto\b|\bfor\b|→|->/i.test(text);

  if (symbols.length === 0) return { kind: "none" };
  if (symbols.some((s) => !isSwapToken(s))) {
    // Only react when it looks like a swap, so ordinary chat is not answered with a refusal.
    return amount !== null || hasSwapWord ? { kind: "unsupported", message: UNSUPPORTED_MESSAGE } : { kind: "none" };
  }

  const toks = symbols as SwapToken[];
  const from = toks[0];
  const to = toks[1];
  if (!to) {
    const other = from === "USDC" ? "EURC" : "USDC";
    return { kind: "clarify", from, question: `Which token do you want to receive for your ${from}? Currently MicroAI supports ${from} ↔ ${other}.` };
  }
  if (from === to) return { kind: "clarify", question: "Pick two different tokens: USDC → EURC or EURC → USDC." };
  if (amount === null) return { kind: "clarify", from, to, question: `How much ${from} would you like to swap to ${to}?` };
  if (!(SWAP_TOKENS[from].decimals >= (amount.split(".")[1]?.length ?? 0))) return { kind: "clarify", from, to, question: `${from} has 6 decimal places. Use at most 6 after the point.` };
  return { kind: "swap", amount, from, to };
}
