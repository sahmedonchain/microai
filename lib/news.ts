import { XMLParser } from "fast-xml-parser";
import { Redis } from "@upstash/redis";

const FETCH_TIMEOUT_MS = 4000;
const SITEMAP_PAGE_LIMIT = 8;

export type NewsTag = "Partnership" | "Integration" | "Launch" | "Funding" | "Developer" | "Regulation" | "Event";

export type NewsSourceName = "Arc Blog" | "Circle Blog" | "Circle Pressroom" | "Press" | "X";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: NewsSourceName;
  outlet?: string;
  publishedAt: string | null;
  tags: NewsTag[];
  official: boolean;
  important: boolean;
}

export interface SourceStatus {
  name: string;
  status: "ok" | "error";
  count: number;
}

const IMPORTANT_TAGS: NewsTag[] = ["Partnership", "Integration", "Launch", "Funding", "Regulation"];

const TAG_RULES: [NewsTag, RegExp][] = [
  ["Partnership", /partner|partnership|collaborat/i],
  ["Integration", /integrat/i],
  ["Launch", /\blaunch|debut|unveil|now live|goes live/i],
  ["Funding", /\braise[sd]?\b|funding|series [a-z]\b|investment|valuation/i],
  ["Developer", /developer|\bsdk\b|\bapi\b|hackathon|tutorial/i],
  ["Regulation", /regulat|compliance|licens|\bsec\b|cftc|legal/i],
  ["Event", /\bevent\b|conference|summit|meetup|webinar/i],
];

// Belt-and-suspenders filter against the generic "Arc" name (Arc browser,
// Azure Arc, Intel Arc, Arc Raiders, etc.) — require an Arc mention AND a
// Circle/stablecoin-context mention, and reject known false-positive phrases.
const REJECT_PATTERN = /arc browser|azure arc|intel arc|arc raiders/i;
const ARC_PATTERN = /\barc\b/i;
const CONTEXT_PATTERN = /circle|usdc|stablecoin|mainnet|blockchain/i;

export function isArcRelevant(text: string): boolean {
  if (REJECT_PATTERN.test(text)) return false;
  return ARC_PATTERN.test(text) && CONTEXT_PATTERN.test(text);
}

export function tagItem(title: string, description: string): NewsTag[] {
  const text = `${title} ${description}`;
  const tags: NewsTag[] = [];
  for (const [tag, pattern] of TAG_RULES) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags;
}

function isImportant(official: boolean, tags: NewsTag[]): boolean {
  return official || tags.some((t) => IMPORTANT_TAGS.includes(t));
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": "MicroAI-NewsBot/1.0" } });
  } finally {
    clearTimeout(timer);
  }
}

function makeId(url: string): string {
  // Stable, dependency-free string hash — only used as a React key / dedupe
  // id, not for anything security-sensitive.
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function extractMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchPageMeta(url: string): Promise<{ title: string | null; description: string | null; publishedAt: string | null }> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const html = await res.text();

  const title = extractMetaContent(html, [
    /<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i,
    /<meta\s+content=["']([^"']*)["']\s+property=["']og:title["']/i,
  ]);
  const description = extractMetaContent(html, [
    /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i,
    /<meta\s+content=["']([^"']*)["']\s+property=["']og:description["']/i,
  ]);
  const publishedAt = extractMetaContent(html, [
    /<meta\s+property=["']article:published_time["']\s+content=["']([^"']*)["']/i,
    /<meta\s+content=["']([^"']*)["']\s+property=["']article:published_time["']/i,
  ]);

  return { title, description, publishedAt };
}

interface SitemapUrlEntry {
  loc: string;
  lastmod: string;
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<SitemapUrlEntry[]> {
  const res = await fetchWithTimeout(sitemapUrl);
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawUrls = parsed?.urlset?.url;
  const urls = Array.isArray(rawUrls) ? rawUrls : rawUrls ? [rawUrls] : [];
  return urls
    .map((u: { loc?: string; lastmod?: string }) => ({ loc: String(u.loc ?? ""), lastmod: String(u.lastmod ?? "") }))
    .filter((u: SitemapUrlEntry) => u.loc);
}

async function buildBlogItems(
  sitemapUrl: string,
  source: NewsSourceName,
  pathMatch: (path: string) => boolean
): Promise<NewsItem[]> {
  const entries = await fetchSitemapUrls(sitemapUrl);
  const matched = entries
    .filter((e) => {
      try {
        return pathMatch(new URL(e.loc).pathname);
      } catch {
        return false;
      }
    })
    .sort((a, b) => new Date(b.lastmod).getTime() - new Date(a.lastmod).getTime())
    .slice(0, SITEMAP_PAGE_LIMIT);

  const results = await Promise.allSettled(matched.map((e) => fetchPageMeta(e.loc)));

  const items: NewsItem[] = [];
  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const entry = matched[i];
    const meta = result.value;
    const title = meta.title;
    if (!title) return;
    const description = meta.description ?? "";
    if (!isArcRelevant(`${title} ${description}`)) return;
    const publishedAt = meta.publishedAt ?? entry.lastmod ?? null;
    const tags = tagItem(title, description);
    items.push({
      id: makeId(entry.loc),
      title,
      description,
      url: entry.loc,
      source,
      publishedAt,
      tags,
      official: true,
      important: isImportant(true, tags),
    });
  });
  return items;
}

export async function fetchArcBlog(): Promise<NewsItem[]> {
  return buildBlogItems("https://www.arc.io/sitemap.xml", "Arc Blog", (path) => /^\/blog\/[^/]+\/?$/.test(path));
}

export async function fetchCircleBlog(): Promise<NewsItem[]> {
  return buildBlogItems("https://www.circle.com/sitemap.xml", "Circle Blog", (path) => /^\/blog\/[^/]+\/?$/.test(path));
}

export async function fetchCirclePressroom(): Promise<NewsItem[]> {
  return buildBlogItems("https://www.circle.com/sitemap.xml", "Circle Pressroom", (path) =>
    /^\/pressroom\/[^/]+\/?$/.test(path)
  );
}

const PRESS_QUERIES = [
  '"Arc" Circle blockchain',
  '"Arc Mainnet" OR "Arc network" USDC',
  "Circle USDC partnership",
];

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: { "#text"?: string } | string;
}

async function fetchGoogleNewsQuery(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:30d`)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const rawList: RssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const items: NewsItem[] = [];
  for (const raw of rawList) {
    const rawTitle = raw.title ?? "";
    const link = raw.link ?? "";
    if (!rawTitle || !link) continue;

    const splitAt = rawTitle.lastIndexOf(" - ");
    const title = splitAt > 0 ? rawTitle.slice(0, splitAt) : rawTitle;
    const outlet = typeof raw.source === "string" ? raw.source : raw.source?.["#text"];

    if (!isArcRelevant(title)) continue;

    const publishedAt = raw.pubDate ? new Date(raw.pubDate).toISOString() : null;
    const tags = tagItem(title, "");
    items.push({
      id: makeId(link),
      title,
      description: "",
      url: link,
      source: "Press",
      outlet: outlet || undefined,
      publishedAt,
      tags,
      official: false,
      important: isImportant(false, tags),
    });
  }
  return items;
}

export async function fetchPressCoverage(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(PRESS_QUERIES.map(fetchGoogleNewsQuery));
  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items;
}

// Server-side X API fetch — inert unless X_BEARER_TOKEN is configured. Kept
// here so wiring it in later is just setting the env var, no code change.
export async function fetchXPosts(handle: string): Promise<NewsItem[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return [];
  try {
    const userRes = await fetchWithTimeout(`https://api.twitter.com/2/users/by/username/${handle}`);
    if (!userRes.ok) return [];
    const userData = await userRes.json();
    const userId = userData?.data?.id;
    if (!userId) return [];

    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!tweetsRes.ok) return [];
    const tweetsData = await tweetsRes.json();
    const tweets: { id: string; text: string; created_at?: string }[] = tweetsData?.data ?? [];

    return tweets
      .filter((t) => isArcRelevant(t.text))
      .map((t) => {
        const tags = tagItem(t.text, "");
        return {
          id: makeId(`x:${t.id}`),
          title: t.text.slice(0, 120),
          description: t.text,
          url: `https://x.com/${handle}/status/${t.id}`,
          source: "X" as const,
          outlet: `@${handle}`,
          publishedAt: t.created_at ?? null,
          tags,
          official: true,
          important: isImportant(true, tags),
        };
      });
  } catch {
    return [];
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function dedupeAndSort(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = normalizeTitle(item.title);
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    deduped.push(item);
  }

  return deduped.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

const NEWS_CACHE_KEY = "microai:news:cache";
const NEWS_LASTGOOD_KEY = "microai:news:lastgood";
const NEWS_CACHE_TTL_SECONDS = 10 * 60;
const NEWS_LASTGOOD_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface NewsPayload {
  items: NewsItem[];
  sources: SourceStatus[];
  updatedAt: number;
  stale: boolean;
  unavailable: boolean;
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

async function fetchAllSources(): Promise<{ items: NewsItem[]; sources: SourceStatus[] }> {
  const fetchers: [string, () => Promise<NewsItem[]>][] = [
    ["Arc Blog", fetchArcBlog],
    ["Circle Blog", fetchCircleBlog],
    ["Circle Pressroom", fetchCirclePressroom],
    ["Press", fetchPressCoverage],
  ];

  const results = await Promise.allSettled(fetchers.map(([, fn]) => fn()));

  const sources: SourceStatus[] = [];
  const allItems: NewsItem[] = [];
  results.forEach((result, i) => {
    const [name] = fetchers[i];
    if (result.status === "fulfilled") {
      sources.push({ name, status: "ok", count: result.value.length });
      allItems.push(...result.value);
    } else {
      sources.push({ name, status: "error", count: 0 });
    }
  });

  return { items: dedupeAndSort(allItems), sources };
}

export async function getNewsPayload(): Promise<NewsPayload> {
  try {
    const cached = await getRedis().get<NewsPayload>(NEWS_CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* Redis unreachable — fall through to a live fetch */
  }

  const { items, sources } = await fetchAllSources();

  if (items.length > 0) {
    const payload: NewsPayload = { items, sources, updatedAt: Date.now(), stale: false, unavailable: false };
    try {
      await getRedis().set(NEWS_CACHE_KEY, payload, { ex: NEWS_CACHE_TTL_SECONDS });
      await getRedis().set(NEWS_LASTGOOD_KEY, payload, { ex: NEWS_LASTGOOD_TTL_SECONDS });
    } catch {
      /* cache write failure shouldn't block returning the value to this request */
    }
    return payload;
  }

  try {
    const lastGood = await getRedis().get<NewsPayload>(NEWS_LASTGOOD_KEY);
    if (lastGood) return { ...lastGood, sources, stale: true };
  } catch {
    /* Redis unreachable too — fall through to the unavailable payload */
  }

  return { items: [], sources, updatedAt: Date.now(), stale: false, unavailable: true };
}
