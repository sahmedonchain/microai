import { XMLParser } from "fast-xml-parser";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { isArcRelevant } from "@/lib/news";

const FETCH_TIMEOUT_MS = 4000;

export interface CommunityItem {
  id: string;
  title: string;
  url: string;
  creatorName: string;
  source: "DEV Community" | "Medium";
  publishedAt: string | null;
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
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  published_at: string;
  user?: { name?: string };
}

async function fetchDevTo(tag: string): Promise<CommunityItem[]> {
  const res = await fetchWithTimeout(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=30`);
  if (!res.ok) throw new Error(`${res.status}`);
  const articles: DevToArticle[] = await res.json();
  return articles
    .filter((a) => isArcRelevant(a.title))
    .map((a) => ({
      id: makeId(a.url),
      title: a.title,
      url: a.url,
      creatorName: a.user?.name ?? "Unknown",
      source: "DEV Community" as const,
      publishedAt: a.published_at ?? null,
    }));
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  "dc:creator"?: string;
}

async function fetchMediumTag(tag: string): Promise<CommunityItem[]> {
  const res = await fetchWithTimeout(`https://medium.com/feed/tag/${encodeURIComponent(tag)}`);
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const items: RssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return items
    .filter((it) => it.title && it.link && isArcRelevant(it.title))
    .map((it) => ({
      id: makeId(it.link!),
      title: it.title!,
      url: it.link!,
      creatorName: it["dc:creator"] ?? "Unknown",
      source: "Medium" as const,
      publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
    }));
}

const DEV_TO_TAGS = ["arc", "circle", "usdc", "stablecoin"];
const MEDIUM_TAGS = ["arc-blockchain", "usdc"];

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function fetchAutoFound(): Promise<CommunityItem[]> {
  const results = await Promise.allSettled([
    ...DEV_TO_TAGS.map(fetchDevTo),
    ...MEDIUM_TAGS.map(fetchMediumTag),
  ]);

  const items: CommunityItem[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      const key = normalizeUrl(item.url);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  return items.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

const COMMUNITY_CACHE_KEY = "microai:community:cache";
const COMMUNITY_CACHE_TTL_SECONDS = 15 * 60;

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

export async function getAutoFoundItems(): Promise<CommunityItem[]> {
  try {
    const cached = await getRedis().get<CommunityItem[]>(COMMUNITY_CACHE_KEY);
    if (cached) return cached;
  } catch {
    /* Redis unreachable — fall through to a live fetch */
  }

  const items = await fetchAutoFound();
  try {
    await getRedis().set(COMMUNITY_CACHE_KEY, items, { ex: COMMUNITY_CACHE_TTL_SECONDS });
  } catch {
    /* cache write failure shouldn't block returning the value to this request */
  }
  return items;
}

// ---------------------------------------------------------------------------
// Submission validation — submitted URLs are never fetched server-side, only
// stored as metadata after passing these checks.
// ---------------------------------------------------------------------------

const ALLOWED_EXACT_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "medium.com",
  "dev.to",
  "mirror.xyz",
  "paragraph.xyz",
  "github.com",
  "community.arc.io",
]);

export function isAllowedSubmissionUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_EXACT_HOSTS.has(host)) return true;
  if (host.endsWith(".substack.com")) return true;
  return false;
}

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "si",
];

export function stripTrackingParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export function urlHash(url: string): string {
  return crypto.createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

// ---------------------------------------------------------------------------
// Pending / approved submission storage (Redis hashes).
// ---------------------------------------------------------------------------

export interface SubmittedPost {
  id: string;
  url: string;
  title: string;
  creatorName: string;
  xHandle?: string;
  note?: string;
  submittedAt: number;
  approvedAt?: number;
}

const PENDING_KEY = "microai:community:pending";
const APPROVED_KEY = "microai:community:approved";
const URLHASH_PREFIX = "microai:community:urlhash:";

export async function isUrlAlreadySubmitted(url: string): Promise<boolean> {
  const exists = await getRedis().get(URLHASH_PREFIX + urlHash(url));
  return exists !== null;
}

export async function markUrlSubmitted(url: string): Promise<void> {
  await getRedis().set(URLHASH_PREFIX + urlHash(url), "1");
}

export async function addPendingSubmission(post: SubmittedPost): Promise<void> {
  await getRedis().hset(PENDING_KEY, { [post.id]: JSON.stringify(post) });
}

export async function getPendingSubmissions(): Promise<SubmittedPost[]> {
  const raw = await getRedis().hgetall<Record<string, string>>(PENDING_KEY);
  if (!raw) return [];
  return Object.values(raw).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
}

export async function getApprovedSubmissions(): Promise<SubmittedPost[]> {
  const raw = await getRedis().hgetall<Record<string, string>>(APPROVED_KEY);
  if (!raw) return [];
  return Object.values(raw).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
}

export async function approveSubmission(id: string): Promise<boolean> {
  const raw = await getRedis().hget<string>(PENDING_KEY, id);
  if (!raw) return false;
  const post: SubmittedPost = typeof raw === "string" ? JSON.parse(raw) : raw;
  post.approvedAt = Date.now();
  await getRedis().hset(APPROVED_KEY, { [id]: JSON.stringify(post) });
  await getRedis().hdel(PENDING_KEY, id);
  return true;
}

export async function rejectSubmission(id: string): Promise<boolean> {
  const removed = await getRedis().hdel(PENDING_KEY, id);
  return removed > 0;
}

export async function deleteApprovedSubmission(id: string): Promise<boolean> {
  const removed = await getRedis().hdel(APPROVED_KEY, id);
  return removed > 0;
}
