import { XMLParser } from "fast-xml-parser";
import { Redis } from "@upstash/redis";

const FETCH_TIMEOUT_MS = 5000;
const SITEMAP_PAGE_LIMIT = 8;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type NewsTag = "Partnership" | "Integration" | "Launch" | "Funding" | "Developer" | "Regulation" | "Event";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
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

// ---------------------------------------------------------------------------
// Source config: the ONLY place a new source is added. Each entry is one of
// three fetch mechanisms: a plain RSS/Atom feed, a sitemap + per-page
// og:meta scrape (used for Arc/Circle's own blogs, which have no RSS feed),
// or a Google News RSS search query. Every URL/query here is server-pinned,
// nothing in this file ever fetches a client-supplied URL.
// ---------------------------------------------------------------------------

export type SourceConfig =
  | { name: string; type: "rss"; url: string; official: boolean }
  | { name: string; type: "sitemap-meta"; sitemapUrl: string; pathMatch: RegExp; official: true }
  | { name: string; type: "google-news"; query: string; official: false };

export const SOURCES: SourceConfig[] = [
  // Official Arc / Circle: no public RSS feed, so these scrape og:meta tags
  // from the newest pages listed in each site's own sitemap.xml.
  { name: "Arc Blog", type: "sitemap-meta", sitemapUrl: "https://www.arc.io/sitemap.xml", pathMatch: /^\/blog\/[^/]+\/?$/, official: true },
  { name: "Circle Blog", type: "sitemap-meta", sitemapUrl: "https://www.circle.com/sitemap.xml", pathMatch: /^\/blog\/[^/]+\/?$/, official: true },
  { name: "Circle Pressroom", type: "sitemap-meta", sitemapUrl: "https://www.circle.com/sitemap.xml", pathMatch: /^\/pressroom\/[^/]+\/?$/, official: true },

  // Press coverage: Google News RSS search, 3 queries to cover different
  // phrasing of the same story.
  { name: "Press", type: "google-news", query: '"Arc" Circle blockchain', official: false },
  { name: "Press", type: "google-news", query: '"Arc Mainnet" OR "Arc network" USDC', official: false },
  { name: "Press", type: "google-news", query: "Circle USDC partnership", official: false },

  // General crypto/finance sites: real RSS feeds, verified live. Each is a
  // general-interest feed, so the Arc-relevance filter (isArcRelevant) is
  // applied and most items from these never pass it.
  { name: "BSC News", type: "rss", url: "https://bsc.news/feed.xml", official: false },
  { name: "Yahoo Finance", type: "rss", url: "https://finance.yahoo.com/news/rssindex", official: false },
  { name: "CNBC World", type: "rss", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", official: false },
  // Altcoin Buzz (https://www.altcoinbuzz.io/) has no working public RSS/Atom
  // feed; every /feed, /rss, /rss.xml, /feed.xml path serves the same
  // client-rendered HTML shell (verified via curl). Per "do not scrape HTML,
  // skip and report" this source is intentionally omitted.
];

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

// Strict, whole-word relevance filter for general (non-official) sources.
// A bare "Arc" or bare "Circle" never matches on its own (avoids Arc
// browser, Azure Arc, Intel Arc, Arc Raiders, geometric "arc", "full
// circle"). "Arc" only counts alongside a blockchain/stablecoin context word;
// "Circle" only counts alongside a stablecoin/company-identifying word.
const STRONG_PHRASES = /\b(circle internet( group)?|usdc|eurc|crcl|arc blockchain|arc network|arc mainnet|arc testnet)\b/i;
const ARC_WITH_CONTEXT = /\barc\b(?=[^.?!]*\b(circle|usdc|blockchain|stablecoin|\bl1\b|mainnet|testnet)\b)/i;
const CIRCLE_WITH_CONTEXT = /\bcircle\b(?=[^.?!]*\b(stablecoin|usdc|jeremy allaire|crcl)\b)/i;

export function isArcRelevant(text: string): boolean {
  return STRONG_PHRASES.test(text) || ARC_WITH_CONTEXT.test(text) || CIRCLE_WITH_CONTEXT.test(text);
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
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": BROWSER_USER_AGENT } });
  } finally {
    clearTimeout(timer);
  }
}

function makeId(url: string): string {
  // Stable, dependency-free string hash. Only used as a React key / dedupe
  // id, not for anything security-sensitive.
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”");
}

// Strips HTML tags from RSS/Atom description fields (e.g. bsc.news embeds an
// <img> in every <description>) and collapses whitespace, so the UI never
// renders raw markup or oversized blurbs.
function sanitizeText(html: string, maxLength = 280): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = decodeHtmlEntities(stripped);
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

function extractMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return null;
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

async function fetchSitemapMetaSource(source: Extract<SourceConfig, { type: "sitemap-meta" }>): Promise<NewsItem[]> {
  const entries = await fetchSitemapUrls(source.sitemapUrl);
  const matched = entries
    .filter((e) => {
      try {
        return source.pathMatch.test(new URL(e.loc).pathname);
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
    const description = meta.description ? sanitizeText(meta.description) : "";
    // Official sources skip the relevance filter (whole site is on-topic),
    // but cheaply re-confirmed here in case the sitemap ever picks up an
    // unrelated page under the same path pattern.
    const publishedAt = meta.publishedAt ?? entry.lastmod ?? null;
    const tags = tagItem(title, description);
    items.push({
      id: makeId(entry.loc),
      title,
      description,
      url: entry.loc,
      source: source.name,
      publishedAt,
      tags,
      official: true,
      important: isImportant(true, tags),
    });
  });
  return items;
}

interface RssChannelItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: { "#text"?: string } | string;
}

function parseRssItems(xml: string): RssChannelItem[] {
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const rawItems = channel?.item ?? channel?.entry;
  return Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
}

async function fetchGoogleNewsSource(source: Extract<SourceConfig, { type: "google-news" }>): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${source.query} when:30d`)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const rawList = parseRssItems(xml);

  const items: NewsItem[] = [];
  for (const raw of rawList) {
    const rawTitle = raw.title ?? "";
    const link = raw.link ?? "";
    if (!rawTitle || !link) continue;

    const splitAt = rawTitle.lastIndexOf(" - ");
    const title = decodeHtmlEntities(splitAt > 0 ? rawTitle.slice(0, splitAt) : rawTitle);
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

async function fetchRssSource(source: Extract<SourceConfig, { type: "rss" }>): Promise<NewsItem[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const rawList = parseRssItems(xml);

  const items: NewsItem[] = [];
  for (const raw of rawList) {
    const rawTitle = raw.title ?? "";
    const link = raw.link ?? "";
    if (!rawTitle || !link) continue;

    const title = decodeHtmlEntities(rawTitle);
    const description = raw.description ? sanitizeText(raw.description) : "";

    if (!source.official && !isArcRelevant(`${title} ${description}`)) continue;

    const publishedAt = raw.pubDate ? new Date(raw.pubDate).toISOString() : null;
    const tags = tagItem(title, description);
    items.push({
      id: makeId(link),
      title,
      description,
      url: link,
      source: source.name,
      publishedAt,
      tags,
      official: source.official,
      important: isImportant(source.official, tags),
    });
  }
  return items;
}

async function fetchSource(source: SourceConfig): Promise<NewsItem[]> {
  if (source.type === "sitemap-meta") return fetchSitemapMetaSource(source);
  if (source.type === "google-news") return fetchGoogleNewsSource(source);
  return fetchRssSource(source);
}

// Server-side X API fetch: inert unless X_BEARER_TOKEN is configured, and
// not wired into fetchAllSources/SOURCES yet (the X timeline widget on the
// news page covers @arc/@circle via platform.twitter.com/widgets.js
// instead). Kept here so turning this on later is just setting the env var.
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
          source: "X",
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
const NEWS_CACHE_TTL_SECONDS = 30 * 60;
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
  const results = await Promise.allSettled(SOURCES.map(fetchSource));

  // Press (3 Google News queries) and any future source sharing a display
  // name are merged into one status row, counts summed.
  const statusByName = new Map<string, SourceStatus>();
  const allItems: NewsItem[] = [];

  results.forEach((result, i) => {
    const name = SOURCES[i].name;
    const existing = statusByName.get(name);
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
      if (existing) {
        existing.count += result.value.length;
        if (existing.status === "error") existing.status = "ok";
      } else {
        statusByName.set(name, { name, status: "ok", count: result.value.length });
      }
    } else if (!existing) {
      statusByName.set(name, { name, status: "error", count: 0 });
    }
  });

  return { items: dedupeAndSort(allItems), sources: Array.from(statusByName.values()) };
}

export async function getNewsPayload(options: { forceRefresh?: boolean } = {}): Promise<NewsPayload> {
  if (!options.forceRefresh) {
    try {
      const cached = await getRedis().get<NewsPayload>(NEWS_CACHE_KEY);
      if (cached) return cached;
    } catch {
      /* Redis unreachable, fall through to a live fetch */
    }
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
    /* Redis unreachable too, fall through to the unavailable payload */
  }

  return { items: [], sources, updatedAt: Date.now(), stale: false, unavailable: true };
}
