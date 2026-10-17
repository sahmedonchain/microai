import { Parser } from "htmlparser2";
import { decodeHTML } from "entities";

// Plain-text helpers for untrusted feed/page content. The output is only ever
// rendered as text by React (never as HTML), and is also plain text by itself:
// no tags, entities decoded exactly once.

/** Decodes HTML entities (named, decimal, hex) in one pass. No tag handling. */
export function decodeEntities(input: string): string {
  return decodeHTML(input);
}

// Elements whose contents are code or hidden text, not prose.
const SKIP = new Set(["script", "style", "noscript", "template"]);

/**
 * Turns an HTML fragment into plain text: tags removed by a real HTML tokenizer
 * (comments and script/style bodies dropped), entities decoded once by the
 * tokenizer, whitespace collapsed. Any `<` or `>` still present afterwards came
 * from an encoded entity (e.g. `&#x3C;`) or malformed markup; they are removed so
 * the result can never be mistaken for markup if it is reused somewhere else.
 */
export function htmlToText(html: string): string {
  const parts: string[] = [];
  let skipDepth = 0;
  const parser = new Parser(
    {
      onopentagname(name) {
        if (SKIP.has(name)) skipDepth++;
        parts.push(" ");
      },
      onclosetag(name) {
        if (SKIP.has(name) && skipDepth > 0) skipDepth--;
        parts.push(" ");
      },
      ontext(text) {
        if (skipDepth === 0) parts.push(text);
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return parts.join("").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}
