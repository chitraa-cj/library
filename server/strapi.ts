import type {
  Book,
  VerseTranslation,
  VerseTransliteration,
  Explanation,
  BookTitle,
  Language,
  VerseWithTranslations,
  BookWithDetails,
  BookWithVerseMeta,
  VerseMeta,
  VerseWordMeaning,
  SectionPathEntry,
} from "@shared/schema";
import { transliterateSanskrit, LANGUAGE_TO_SCHEME } from "./strapi-transliterate";
import type { CommentaryOptions, CommentaryOption } from "./storage";
import {
  parseYouTubeUrl,
  EMPTY_BOOK_VIDEOS,
  type BookVideos,
  type VideoResource,
  type VideoTargetType,
} from "@shared/video-resource";
import { Agent, fetch as undiciFetch } from "undici";
import { withFetchSlot } from "./fetch-priority";
import { createContentStore } from "./content-cache";
import { createCircuitBreaker, CircuitOpenError } from "./resilience";
import { incr, observe } from "./observability";

const STRAPI_URL = (process.env.STRAPI_URL ?? "").trim().replace(/\/+$/, "");
const STRAPI_API_TOKEN = (process.env.STRAPI_API_TOKEN ?? "").trim();

const strapiTlsAgent =
  process.env.STRAPI_TLS_SKIP_VERIFY === "1"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

if (strapiTlsAgent) {
  console.warn(
    "[Strapi] STRAPI_TLS_SKIP_VERIFY=1 — TLS verification is disabled for Strapi requests only (local dev). Fix the CMS certificate for production.",
  );
}

const strapiUserAgent =
  process.env.STRAPI_USER_AGENT?.trim() ||
  "Sacred-Script-Hub/1.0 (server; Strapi REST client)";

/**
 * Failures worth retrying: a timeout, or the CMS dropping the connection.
 * Large cold loads fan out enough requests that the box intermittently resets
 * sockets ("other side closed" / ECONNRESET); treating those as fatal turned a
 * recoverable blip into an empty grantha.
 */
function isRetryableStrapiError(e: unknown): boolean {
  const err = e as Error & { cause?: Error & { code?: string } };
  const msg = `${err?.message || ""} ${err?.cause?.message || ""}`.toLowerCase();
  const code = err?.cause?.code || "";
  return (
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("other side closed") ||
    msg.includes("socket") ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "UND_ERR_SOCKET" ||
    code === "EPIPE"
  );
}

/**
 * Trips when the CMS is consistently failing. While open, calls fail fast and
 * the stale-while-revalidate caches answer instead, so a CMS outage degrades the
 * reader to "slightly out of date" rather than "every request hangs for 120s".
 */
const cmsBreaker = createCircuitBreaker("cms");

export function cmsCircuitState(): string {
  return cmsBreaker.state();
}

async function strapiHttpFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  if (cmsBreaker.shouldReject()) {
    incr("ssh_cms_rejected_total");
    throw new CircuitOpenError("cms");
  }
  const maxRetries = Math.max(0, Math.min(3, Number(process.env.STRAPI_FETCH_RETRIES ?? 2)));
  let lastError: unknown;
  const startedAt = Date.now();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Background warmers yield here while a reader has a request outstanding.
      const response = await withFetchSlot(() =>
        undiciFetch(url, {
          headers: { "User-Agent": strapiUserAgent, ...headers },
          signal: AbortSignal.timeout(timeoutMs),
          ...(strapiTlsAgent ? { dispatcher: strapiTlsAgent } : {}),
        } as RequestInit),
      );
      cmsBreaker.recordSuccess();
      observe("ssh_cms_fetch_ms", Date.now() - startedAt);
      incr("ssh_cms_fetch_total", { outcome: "ok" });
      return response;
    } catch (e: unknown) {
      lastError = e;
      if (attempt < maxRetries && isRetryableStrapiError(e)) {
        incr("ssh_cms_fetch_total", { outcome: "retry" });
        // Exponential backoff with jitter, so concurrent failures don't all
        // retry in lockstep and re-hammer a struggling CMS.
        const base = 750 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, base + Math.random() * base));
        continue;
      }
      cmsBreaker.recordFailure();
      observe("ssh_cms_fetch_ms", Date.now() - startedAt);
      incr("ssh_cms_fetch_total", { outcome: "error" });
      throw e;
    }
  }
  throw lastError;
}

let loggedStrapiReachabilityFailure = false;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Default 30 minutes; override with STRAPI_CACHE_TTL_MS (0 = always re-fetch
 * Strapi). Content is invalidated eagerly by the CMS webhook, so a long TTL is
 * safe and keeps heavy full-book / commentary fetches off the critical path.
 */
const DEFAULT_CACHE_TTL = 30 * 60 * 1000;
const CACHE_TTL = (() => {
  const raw = process.env.STRAPI_CACHE_TTL_MS;
  if (raw === undefined || raw === "") return DEFAULT_CACHE_TTL;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CACHE_TTL;
})();
const bookDetailCache = new Map<string, CacheEntry<BookWithDetails>>();
const bookVerseMetaCache = new Map<string, CacheEntry<BookWithVerseMeta>>();
let bookListCacheEntry: CacheEntry<(Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] })[]> | null = null;
const verseCache = new Map<string, CacheEntry<VerseWithTranslations>>();
const explanationCache = new Map<string, CacheEntry<Explanation[]>>();
const commentaryOptionsCache = new Map<string, CacheEntry<CommentaryOptions>>();
const inflight = new Map<string, Promise<any>>();

/**
 * Disk-backed mirrors of the four caches that gate the reader's first paint.
 *
 * The `Map`s above stay the hot tier (no I/O, no JSON parse). These add
 * restart-survival and stale-while-revalidate: after a payload has been built
 * once, an expired entry is served instantly from disk while it refreshes in
 * the background, so a reader stops paying for Strapi round-trips on every TTL
 * boundary and every deploy. Cleared by the same webhook invalidation hooks.
 */
const bookMetaStore = createContentStore<BookWithVerseMeta>("book-meta");
const bookDetailStore = createContentStore<BookWithDetails>("book-detail");
const verseStore = createContentStore<VerseWithTranslations>("verse");
const commentaryOptionsStore = createContentStore<CommentaryOptions>("commentary-options");
/**
 * Teaching videos change far more often than scripture (an editor adds a link
 * and expects to see it), and the collection is small, so this gets a short TTL
 * of its own rather than the 30-minute content default.
 */
type BookListEntry = Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] };
/** The catalogue — the home page's first request, and 248KB of it. */
const bookListStore = createContentStore<BookListEntry[]>("book-list");

const videoResourceStore = createContentStore<VideoResource[]>("video-resources", {
  ttlMs: Number(process.env.VIDEO_CACHE_TTL_MS || 5 * 60 * 1000),
});

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return undefined;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function invalidateVerseCache(verseId: string): void {
  verseCache.delete(verseId);
  explanationCache.delete(verseId);
  verseStore.delete(verseId);
}

export function invalidateBookCache(bookId: string): void {
  const verseIds = new Set<string>();

  const detailEntry = bookDetailCache.get(bookId);
  if (detailEntry) {
    for (const v of detailEntry.data.verses) {
      verseIds.add(v.id);
      verseCache.delete(v.id);
      explanationCache.delete(v.id);
    }
  }

  const metaEntry = bookVerseMetaCache.get(bookId);
  if (metaEntry) {
    for (const v of metaEntry.data.verses) {
      verseIds.add(v.id);
      verseCache.delete(v.id);
      explanationCache.delete(v.id);
    }
  }

  verseCache.delete(`${bookId}-intro`);
  explanationCache.delete(`${bookId}-intro`);

  bookDetailCache.delete(bookId);
  bookVerseMetaCache.delete(bookId);
  bookListCacheEntry = null;
  bookListStore.delete(BOOK_LIST_KEY);
  commentaryOptionsCache.delete(bookId);

  bookDetailStore.delete(bookId);
  bookMetaStore.delete(bookId);
  commentaryOptionsStore.delete(bookId);
  verseStore.delete(`${bookId}-intro`);
  verseIds.forEach((verseId) => verseStore.delete(verseId));

  console.log(`[Strapi] Cache invalidated for grantha ${bookId}`);
}

/** Called when the CMS reports a video-resource change. */
export function invalidateVideoResourceCache(): void {
  videoResourceStore.delete(VIDEO_RESOURCES_KEY);
  console.log("[Strapi] Video resource cache invalidated");
}

export function invalidateAllStrapiCaches(): void {
  bookDetailCache.clear();
  bookVerseMetaCache.clear();
  bookListCacheEntry = null;
  verseCache.clear();
  explanationCache.clear();
  commentaryOptionsCache.clear();

  bookDetailStore.clear();
  bookMetaStore.clear();
  bookListStore.clear();
  verseStore.clear();
  commentaryOptionsStore.clear();
  videoResourceStore.clear();

  console.log("[Strapi] All content caches cleared (memory + disk)");
}

interface StrapiResponse<T> {
  data: T;
  meta?: { pagination?: { page: number; pageSize: number; pageCount: number; total: number } };
}

interface RichTextBlock {
  type: string;
  children: { text: string; type: string; bold?: boolean }[];
}

function richTextToString(blocks: RichTextBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks
    .map((block) => block.children?.map((c) => c.text).join("") || "")
    .join("\n")
    .trim();
}

function resolveStrapiTimeoutMs(endpoint: string): number {
  const base = Number(process.env.STRAPI_TIMEOUT_MS || 60000);
  const heavy = Number(process.env.STRAPI_HEAVY_TIMEOUT_MS || 120000);
  // Full grantha loads and manthra pages are slow on large texts (e.g. Brahma Sutra, Chandogya).
  if (
    endpoint.includes("/manthras") ||
    endpoint.includes("/sections") ||
    /^\/granthas\/[^/]+$/.test(endpoint)
  ) {
    return Math.max(base, Number.isFinite(heavy) && heavy > 0 ? heavy : 120000);
  }
  return Number.isFinite(base) && base > 0 ? base : 60000;
}

async function strapiFetch<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (STRAPI_API_TOKEN) {
    headers["Authorization"] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  const timeoutMs = resolveStrapiTimeoutMs(endpoint);
  let response: Response;
  try {
    response = await strapiHttpFetch(url.toString(), headers, timeoutMs);
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error };
    const cause = err?.cause?.message || err?.cause || "";
    throw new Error(
      `Strapi fetch failed for ${endpoint}: ${err?.message || String(e)}${cause ? ` (${String(cause)})` : ""}. If you see certificate errors, try STRAPI_TLS_SKIP_VERIFY=1 in .env for local dev only.`,
    );
  }
  if (!response.ok) {
    const body = await response.text();
    const snippet = body.replace(/\s+/g, " ").slice(0, 400);
    throw new Error(
      `Strapi API error: ${response.status} ${response.statusText} for ${url.pathname}${url.search} — ${snippet}`,
    );
  }
  return response.json() as Promise<T>;
}

/**
 * How many pages of one paginated CMS collection to fetch concurrently. Walking
 * pages serially makes a large grantha cost the *sum* of 6+ round-trips of heavy
 * rich text; fetching page 1 and then the rest in parallel turns that into
 * roughly two waves.
 *
 * Kept deliberately low: the CMS box is the bottleneck, not the round-trip
 * count, and it starts resetting sockets when pushed (hence the retry on
 * connection errors above). Measured cold-load times on this box vary by 3-4x
 * run to run, so this is tuned for not overloading it rather than for a proven
 * speedup — the real win is that the caching layer keeps cold loads off a
 * reader's request entirely. Override with STRAPI_PAGE_CONCURRENCY.
 */
const PAGE_FETCH_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.STRAPI_PAGE_CONCURRENCY || 3)),
);

async function strapiFetchAll<T = any>(endpoint: string, params: Record<string, string> = {}, pageSize = 100): Promise<T[]> {
  const fetchPage = (page: number) =>
    strapiFetch<StrapiResponse<T[]>>(endpoint, {
      ...params,
      "pagination[page]": String(page),
      "pagination[pageSize]": String(pageSize),
    });

  const first = await fetchPage(1);
  if (!first.data || !Array.isArray(first.data)) return [];

  const pageCount = first.meta?.pagination?.pageCount ?? 1;
  if (pageCount <= 1) return [...first.data];

  // Keep results positional so the collection stays in the CMS sort order even
  // though the pages come back out of order.
  const pages: T[][] = new Array(pageCount).fill(null).map(() => []);
  pages[0] = first.data;

  let nextPage = 2;
  const worker = async () => {
    while (true) {
      const page = nextPage++;
      if (page > pageCount) return;
      const result = await fetchPage(page);
      pages[page - 1] = result.data && Array.isArray(result.data) ? result.data : [];
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PAGE_FETCH_CONCURRENCY, pageCount - 1) }, () => worker()),
  );

  return pages.flat();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

interface StrapiSection {
  id: number;
  documentId: string;
  title: string;
  type: string | null;
  order: number | null;
  parent?: { documentId: string } | null;
  sub_sections?: StrapiSection[];
  manthras?: any[];
  titleTranslations?: any[];
}

function buildSectionTree(sections: StrapiSection[]): StrapiSection[] {
  const byDocId = new Map<string, StrapiSection>();
  for (const s of sections) byDocId.set(s.documentId, s);

  const roots: StrapiSection[] = [];
  for (const s of sections) {
    if (!s.parent?.documentId) {
      roots.push(s);
    }
  }
  roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const resolveSubSections = (section: StrapiSection) => {
    if (section.sub_sections && section.sub_sections.length > 0) {
      section.sub_sections = section.sub_sections.map((ss: any) => {
        const fullSection = byDocId.get(ss.documentId);
        return fullSection || ss;
      }).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      for (const sub of section.sub_sections) {
        resolveSubSections(sub as StrapiSection);
      }
    }
  };

  for (const root of roots) {
    resolveSubSections(root);
  }

  return roots;
}

/** One section as a path entry (number/title/type), as shipped to the reader. */
function sectionPathEntry(section: StrapiSection | any): SectionPathEntry {
  return {
    number: section?.order ?? null,
    title: section?.title || null,
    type: section?.type || null,
  };
}

/** Sub-sections in CMS order (`order` asc), tolerating unset orders. */
function sortedSubSections(section: any): any[] {
  return [...(section?.sub_sections || [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * The legacy flat fields (adhyayNumber/khandaNumber and friends) mirror the
 * first two levels of the section path, so two-level granthas keep behaving
 * exactly as before while deeper ones (e.g. Adhyāya › Pāda › Sūtra) carry the
 * remaining levels in `sectionPath`.
 */
function legacyLevelFields(path: SectionPathEntry[]) {
  return {
    adhyayNumber: path[0]?.number ?? null,
    adhyayTitle: path[0]?.title ?? null,
    adhyayType: path[0]?.type ?? null,
    khandaNumber: path[1]?.number ?? null,
    khandaTitle: path[1]?.title ?? null,
    khandaType: path[1]?.type ?? null,
  };
}

/** Stable key for a section path, used to de-duplicate manthras per section. */
function sectionPathKey(path: SectionPathEntry[]): string {
  return path.map((p) => p.number ?? "").join(".");
}

function isTransliteration(text: string, sanskritText: string, lang: string): boolean {
  if (!sanskritText || !text) return false;
  const scheme = LANGUAGE_TO_SCHEME[lang];
  if (!scheme || scheme === "devanagari" || scheme === "iast") return false;
  const expected = transliterateSanskrit(sanskritText, lang);
  if (!expected) return false;
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  return normalize(text) === normalize(expected);
}

function extractTranslationsFromTextAndTranslation(
  tat: any,
  verseId: string,
  prefix: string,
): { translations: VerseTranslation[]; iastTransliteration?: string; transliterations: VerseTransliteration[] } {
  const translations: VerseTranslation[] = [];
  const transliterations: VerseTransliteration[] = [];
  let iastTransliteration: string | undefined;
  if (!tat) return { translations, transliterations };

  const sanskritText = richTextToString(tat.SanskritTextEntry);
  if (sanskritText) {
    translations.push({
      id: `${verseId}-${prefix}-sa`,
      verseId,
      languageCode: "devanagari",
      content: sanskritText,
      isAiTranslated: false,
    });
  }

  const iastText = richTextToString(tat.IASTTransliteration);
  if (iastText) {
    iastTransliteration = iastText;
  }

  const englishText = richTextToString(tat.EnglishTranslationText);
  if (englishText) {
    translations.push({
      id: `${verseId}-${prefix}-en`,
      verseId,
      languageCode: "english",
      content: englishText,
      isAiTranslated: false,
    });
  }

  if (Array.isArray(tat.OtherTranslations)) {
    for (let i = 0; i < tat.OtherTranslations.length; i++) {
      const ot = tat.OtherTranslations[i];
      const lang = ot.LanguageOfTranslation;
      const text = richTextToString(ot.TranslationText);
      if (lang && text) {
        if (isTransliteration(text, sanskritText, lang)) {
          transliterations.push({
            languageCode: lang.toLowerCase(),
            content: text,
          });
        } else {
          translations.push({
            id: `${verseId}-${prefix}-${lang.toLowerCase()}-${i}`,
            verseId,
            languageCode: lang.toLowerCase(),
            content: text,
            isAiTranslated: ot.isAiTranslated ?? false,
          });
        }
      }
    }
  }

  return { translations, iastTransliteration, transliterations };
}

function extractExplanationsFromTextAndTranslation(
  tat: any,
  verseId: string,
  authorName: string,
  authorTitle: string | null,
  prefix: string,
): Explanation[] {
  const explanations: Explanation[] = [];
  if (!tat) return explanations;

  const commentaryType = (prefix === "bhashya" || prefix === "intro") ? "bhashya" : "teeka";

  const sanskritText = richTextToString(tat.SanskritTextEntry);
  if (sanskritText) {
    explanations.push({
      id: `${verseId}-${prefix}-sa`,
      verseId,
      authorName,
      authorTitle,
      languageCode: "devanagari",
      content: sanskritText,
      isAiTranslated: false,
      commentaryType,
    } as any);
  }

  const englishText = richTextToString(tat.EnglishTranslationText);
  if (englishText) {
    explanations.push({
      id: `${verseId}-${prefix}-en`,
      verseId,
      authorName,
      authorTitle,
      languageCode: "english",
      content: englishText,
      isAiTranslated: false,
      commentaryType,
    } as any);
  }

  if (Array.isArray(tat.OtherTranslations)) {
    for (let i = 0; i < tat.OtherTranslations.length; i++) {
      const ot = tat.OtherTranslations[i];
      const lang = ot.LanguageOfTranslation;
      const text = richTextToString(ot.TranslationText);
      if (lang && text) {
        explanations.push({
          id: `${verseId}-${prefix}-${lang.toLowerCase()}-${i}`,
          verseId,
          authorName,
          authorTitle,
          languageCode: lang.toLowerCase(),
          content: text,
          isAiTranslated: ot.isAiTranslated ?? false,
          commentaryType,
        } as any);
      }
    }
  }

  return explanations;
}

function mapManthraToVerse(
  m: any,
  bookId: string,
  globalIndex: number,
  sectionPath: SectionPathEntry[],
  bhashyamAuthor: string,
  bhashyamName: string | null,
): VerseWithTranslations {
  const verseId = m.documentId || String(m.id);
  const verseNumber = globalIndex;

  const { translations, iastTransliteration, transliterations } = extractTranslationsFromTextAndTranslation(
    m.ShlokaManthraEntry,
    verseId,
    "shloka",
  );

  const explanations = extractExplanationsFromTextAndTranslation(
    m.BhashyamEntry,
    verseId,
    bhashyamAuthor,
    bhashyamName,
    "bhashya",
  );

  if (Array.isArray(m.Teekas)) {
    for (const teekaEntry of m.Teekas) {
      const teekaRef = teekaEntry.teeka;
      const teekaName = teekaRef?.TeekaName || "Teeka";
      const teekaAuthor = teekaRef?.TeekaAuthor || teekaName;
      const teekaExplanations = extractExplanationsFromTextAndTranslation(
        teekaEntry.TeekaEntry,
        verseId,
        teekaAuthor,
        teekaName,
        `teeka-${teekaRef?.documentId || teekaEntry.id || "unknown"}`,
      );
      explanations.push(...teekaExplanations);
    }
  }

  const sectionTitle = m.ShlokaManthraNumber
    ? `Mantra ${m.ShlokaManthraNumber}`
    : `Mantra ${globalIndex}`;

  return {
    id: verseId,
    bookId,
    verseNumber,
    sectionTitle,
    ...legacyLevelFields(sectionPath),
    sectionPath,
    translations,
    explanations,
    iastTransliteration,
    transliterations: transliterations.length > 0 ? transliterations : undefined,
  };
}

function mapGranthaToBook(g: any): Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] } {
  const docId = g.documentId || String(g.id);
  let totalVerses = 0;
  if (Array.isArray(g.sections)) {
    const subSectionIds = new Set<string>();
    for (const s of g.sections) {
      if (Array.isArray(s.sub_sections)) {
        for (const ss of s.sub_sections) {
          subSectionIds.add(ss.documentId || String(ss.id));
          if (Array.isArray(ss.sub_sections)) {
            for (const sss of ss.sub_sections) {
              subSectionIds.add(sss.documentId || String(sss.id));
            }
          }
        }
      }
    }
    const seenDocIds = new Set<string>();
    const seenNumberKeys = new Set<string>();
    const collectManthras = (section: any) => {
      const subs = section.sub_sections;
      if (Array.isArray(subs) && subs.length > 0) {
        for (const sub of subs) collectManthras(sub);
        return;
      }
      const ms = section.manthras || [];
      for (const m of ms) {
        const mDocId = m.documentId || String(m.id);
        if (seenDocIds.has(mDocId)) continue;
        const numKey = m.ShlokaManthraNumber ? `${section.documentId || section.id}|${m.ShlokaManthraNumber}` : "";
        if (numKey && seenNumberKeys.has(numKey)) continue;
        seenDocIds.add(mDocId);
        if (numKey) seenNumberKeys.add(numKey);
        totalVerses++;
      }
    };
    for (const s of g.sections) {
      const sId = s.documentId || String(s.id);
      if (subSectionIds.has(sId)) continue;
      collectManthras(s);
    }
  }

  const teekasList: { name: string; author: string }[] = [];
  if (Array.isArray(g.teekas)) {
    for (const t of g.teekas) {
      if (t.TeekaName) {
        teekasList.push({
          name: t.TeekaName,
          author: t.TeekaAuthor || "",
        });
      }
    }
  }

  return {
    id: docId,
    slug: g.slug || slugify(g.GranthaName || ""),
    title: g.GranthaName || "",
    author: g.BhashyamAuthor || null,
    description: richTextToString(g.IntroductionToTextEnglish) || null,
    category: g.GranthaType || "Uncategorized",
    coverImage: g.coverImage?.url ? `${STRAPI_URL}${g.coverImage.url}` : null,
    totalVerses,
    bhashyamName: g.BhashyamName || undefined,
    teekasList: teekasList.length > 0 ? teekasList : undefined,
  };
}

export function isStrapiConfigured(): boolean {
  return !!(STRAPI_URL && STRAPI_API_TOKEN);
}

export async function isStrapiReachable(): Promise<boolean> {
  if (!isStrapiConfigured()) return false;
  try {
    await strapiFetch("/granthas", { "pagination[pageSize]": "1" });
    return true;
  } catch (e: unknown) {
    if (!loggedStrapiReachabilityFailure) {
      loggedStrapiReachabilityFailure = true;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[Strapi] Reachability check failed — using DB-only until Strapi works:", msg);
    }
    return false;
  }
}

export async function testStrapiConnection(): Promise<{ connected: boolean; message: string }> {
  if (!STRAPI_API_TOKEN) {
    return { connected: false, message: "STRAPI_API_TOKEN not configured" };
  }
  if (!STRAPI_URL) {
    return { connected: false, message: "STRAPI_URL not configured" };
  }
  try {
    const data = await strapiFetch<{ meta?: { pagination?: { total?: number } }; data?: unknown[] }>(
      "/granthas",
      { "pagination[pageSize]": "1" },
    );
    const count = data?.meta?.pagination?.total ?? data?.data?.length ?? "unknown";
    return { connected: true, message: `Connected to Strapi. Granthas found: ${count}` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { connected: false, message: msg };
  }
}

const BOOK_LIST_KEY = "all";

/** Cache-only catalogue read, for when the CMS is unreachable. */
export function peekAllBooks(): Promise<BookListEntry[] | undefined> {
  if (bookListCacheEntry && Date.now() - bookListCacheEntry.timestamp < CACHE_TTL) {
    return Promise.resolve(bookListCacheEntry.data);
  }
  return bookListStore.peekAny(BOOK_LIST_KEY);
}

export async function strapiGetAllBooks(): Promise<BookListEntry[]> {
  if (bookListCacheEntry && Date.now() - bookListCacheEntry.timestamp < CACHE_TTL) return bookListCacheEntry.data;
  return dedup("allBooks", () => bookListStore.swr(BOOK_LIST_KEY, _strapiGetAllBooksUncached) as Promise<BookListEntry[]>);
}

async function _strapiGetAllBooksUncached(): Promise<BookListEntry[] | undefined> {
  try {
    const granthas = await strapiFetchAll("/granthas", {
      "populate[0]": "sections.manthras",
      "populate[1]": "sections.sub_sections.manthras",
      "populate[2]": "sections.sub_sections.sub_sections.manthras",
      "populate[3]": "coverImage",
      "populate[4]": "GranthaNameTranslations",
      "populate[5]": "teekas",
    });
    const result = granthas.map(mapGranthaToBook);
    bookListCacheEntry = { data: result, timestamp: Date.now() };
    return result;
  } catch (err: any) {
    console.warn("[Strapi] getAllBooks failed:", err.message);
    return undefined;
  }
}

export async function strapiGetBookBySlug(slug: string): Promise<Book | undefined> {
  const granthas = await strapiFetchAll("/granthas", {
    "populate[0]": "sections",
    "populate[1]": "coverImage",
  });
  const match = granthas.find((g: any) => {
    const gSlug = g.slug || slugify(g.GranthaName || "");
    return gSlug === slug;
  });
  return match ? mapGranthaToBook(match) : undefined;
}

async function fetchSectionsForGrantha(granthaDocId: string): Promise<StrapiSection[]> {
  return strapiFetchAll("/sections", {
    "filters[grantha][documentId]": granthaDocId,
    "populate[0]": "parent",
    "populate[1]": "sub_sections",
    "populate[2]": "manthras",
    "populate[3]": "titleTranslations",
    "sort[0]": "order:asc",
    "sort[1]": "id:asc",
  });
}

async function fetchManthrasForSection(sectionDocId: string): Promise<any[]> {
  // This fetch deep-populates bhashya + every teeka, each with ~45-language
  // OtherTranslations. At pageSize=100 the response for a large section (e.g.
  // Mandukya/Gaudapada with 100+ manthras) exceeds Strapi's limit and 500s,
  // which silently empties the book's commentary options. Keep the page small.
  const MANTHRA_PAGE_SIZE = Math.max(
    1,
    Math.min(100, Number(process.env.STRAPI_MANTHRA_PAGE_SIZE || 20)),
  );
  return strapiFetchAll("/manthras", {
    "filters[Section][documentId]": sectionDocId,
    "populate[0]": "Section",
    "populate[1]": "ShlokaManthraEntry",
    "populate[2]": "BhashyamEntry",
    "populate[3]": "Teekas.teeka",
    "populate[4]": "Teekas.TeekaEntry",
    "populate[5]": "ShlokaManthraEntry.OtherTranslations",
    "populate[6]": "BhashyamEntry.OtherTranslations",
    "populate[7]": "Teekas.TeekaEntry.OtherTranslations",
    "sort[0]": "order:asc",
    "sort[1]": "id:asc",
  }, MANTHRA_PAGE_SIZE);
}

// A manthra is considered "empty" (and therefore should not appear on the site)
// when none of its content components carry any data. This lets editors remove
// a manthra from the reader simply by clearing its inline components in the CMS,
// without having to delete the manthra row itself.
function isManthraNonEmpty(m: any): boolean {
  if (!m) return false;
  const sm = m.ShlokaManthraEntry;
  if (sm && (sm.SanskritTextEntry || sm.EnglishTranslationText || sm.IASTTransliteration ||
    (Array.isArray(sm.OtherTranslations) && sm.OtherTranslations.length > 0))) return true;
  const bm = m.BhashyamEntry;
  if (bm && (bm.SanskritTextEntry || bm.EnglishTranslationText || bm.IASTTransliteration ||
    (Array.isArray(bm.OtherTranslations) && bm.OtherTranslations.length > 0))) return true;
  if (Array.isArray(m.Teekas)) {
    for (const t of m.Teekas) {
      const te = t?.TeekaEntry;
      if (te && (te.SanskritTextEntry || te.EnglishTranslationText || te.IASTTransliteration ||
        (Array.isArray(te.OtherTranslations) && te.OtherTranslations.length > 0))) return true;
    }
  }
  return false;
}

/** Skip empty CMS rows only when section manthras include populated content (shallow refs are kept). */
function shouldSkipEmptyManthra(m: any): boolean {
  const hasInspectableContent =
    m.ShlokaManthraEntry != null ||
    m.BhashyamEntry != null ||
    (Array.isArray(m.Teekas) && m.Teekas.length > 0);
  if (!hasInspectableContent) return false;
  return !isManthraNonEmpty(m);
}

async function fetchSectionsForGranthaVerseMeta(granthaDocId: string): Promise<StrapiSection[]> {
  return strapiFetchAll("/sections", {
    "filters[grantha][documentId]": granthaDocId,
    "populate[0]": "parent",
    "populate[1]": "sub_sections",
    "populate[2]": "manthras.ShlokaManthraEntry",
    "populate[3]": "manthras.BhashyamEntry",
    "populate[4]": "manthras.Teekas.TeekaEntry",
    "sort[0]": "order:asc",
    "sort[1]": "id:asc",
  });
}

// Short Devanagari opening of each manthra, keyed by manthra documentId. The
// verse-meta sections fetch keeps manthras shallow (no text), so this pulls just
// the shloka Sanskrit in one grantha-wide query to power the sidebar previews.
async function fetchManthraPreviewsForGrantha(granthaDocId: string): Promise<Map<string, string>> {
  const previews = new Map<string, string>();
  try {
    const manthras = await strapiFetchAll<any>("/manthras", {
      "filters[Section][grantha][documentId]": granthaDocId,
      "populate[0]": "ShlokaManthraEntry",
    });
    for (const m of manthras) {
      const docId = m.documentId || String(m.id);
      const sanskrit = richTextToString(m.ShlokaManthraEntry?.SanskritTextEntry);
      if (sanskrit) {
        previews.set(docId, sanskrit.replace(/\s+/g, " ").trim().slice(0, 80));
      }
    }
  } catch (err: any) {
    console.warn("[Strapi] manthra preview fetch failed:", err.message);
  }
  return previews;
}

function hydrateBookDetailCaches(result: BookWithDetails | undefined, id: string): void {
  if (!result) return;
  setCache(bookDetailCache, id, result);
  for (const v of result.verses) {
    setCache(verseCache, v.id, v);
  }
}

export async function strapiGetBookById(id: string): Promise<BookWithDetails | undefined> {
  const cached = getCached(bookDetailCache, id);
  if (cached) return cached;
  return dedup(`bookDetail:${id}`, async () => {
    const result = await bookDetailStore.swr(id, async () => {
      const fresh = await _strapiGetBookByIdUncached(id);
      hydrateBookDetailCaches(fresh, id);
      return fresh;
    });
    hydrateBookDetailCaches(result, id);
    return result;
  });
}

async function _strapiGetBookByIdUncached(id: string): Promise<BookWithDetails | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/granthas/${id}`, {
      "populate[0]": "sections",
      "populate[1]": "teekas",
      "populate[2]": "BhashyakaraIntroduction",
      "populate[3]": "BhashyakaraIntroduction.OtherTranslations",
      "populate[4]": "GranthaNameTranslations",
      "populate[5]": "coverImage",
    });
    if (!result.data) return undefined;

    const grantha = result.data;
    const book = mapGranthaToBook(grantha);
    const bhashyamAuthor = grantha.BhashyamAuthor || "Sri Shankaracharya";
    const bhashyamName = grantha.BhashyamName || "Shankara Bhashyam";

    const allSections = await fetchSectionsForGrantha(grantha.documentId);
    const sectionTree = buildSectionTree(allSections);

    const verses: VerseWithTranslations[] = [];

    const introVerse = mapIntroductionVerse(grantha, book.id);
    if (introVerse) {
      verses.push(introVerse);
    }

    type LeafTask = {
      sectionDocId: string;
      /** Full ancestry of the leaf section, outermost first (any depth). */
      path: SectionPathEntry[];
    };
    const leafTasks: LeafTask[] = [];

    // Manthras only ever hang off leaf sections, so walk to the bottom of each
    // branch — however deep the grantha nests — and remember the way down.
    function collectLeafTasks(section: any, ancestors: SectionPathEntry[]) {
      const path = [...ancestors, sectionPathEntry(section)];
      const subs = sortedSubSections(section);
      if (subs.length > 0) {
        for (const sub of subs) collectLeafTasks(sub, path);
      } else {
        leafTasks.push({ sectionDocId: section.documentId, path });
      }
    }

    for (const root of sectionTree) {
      collectLeafTasks(root, []);
    }

    const sectionFetchConcurrency = Math.max(
      1,
      Math.min(8, Number(process.env.STRAPI_SECTION_FETCH_CONCURRENCY || 6)),
    );
    const taskResults: { task: LeafTask; manthras: any[] }[] = new Array(leafTasks.length);
    let nextIdx = 0;
    async function worker() {
      while (true) {
        const i = nextIdx++;
        if (i >= leafTasks.length) return;
        const task = leafTasks[i];
        const manthras = await fetchManthrasForSection(task.sectionDocId);
        taskResults[i] = { task, manthras };
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(sectionFetchConcurrency, leafTasks.length) }, () => worker()),
    );

    let globalIndex = 0;
    const seenManthraDocIds = new Set<string>();
    const seenManthraKeys = new Set<string>();
    let droppedDuplicates = 0;
    let droppedEmpty = 0;
    for (const { task, manthras } of taskResults) {
      for (const m of manthras) {
        const docId = m.documentId || String(m.id);
        if (seenManthraDocIds.has(docId)) {
          droppedDuplicates++;
          continue;
        }
        const numberKey = `${sectionPathKey(task.path)}|${m.ShlokaManthraNumber ?? ""}`;
        if (m.ShlokaManthraNumber && seenManthraKeys.has(numberKey)) {
          droppedDuplicates++;
          continue;
        }
        if (!isManthraNonEmpty(m)) {
          droppedEmpty++;
          // Intentionally NOT adding to seen* sets so a non-empty duplicate
          // appearing later (e.g., during a CMS cleanup transition) can still win.
          continue;
        }
        seenManthraDocIds.add(docId);
        if (m.ShlokaManthraNumber) seenManthraKeys.add(numberKey);
        globalIndex++;
        verses.push(
          mapManthraToVerse(m, book.id, globalIndex, task.path, bhashyamAuthor, bhashyamName)
        );
      }
    }
    if (droppedDuplicates > 0) {
      console.warn(`[Strapi] Grantha ${id}: dropped ${droppedDuplicates} duplicate manthra(s) (same docId or same section-path/ShlokaManthraNumber). Clean up duplicates in CMS.`);
    }
    if (droppedEmpty > 0) {
      console.warn(`[Strapi] Grantha ${id}: dropped ${droppedEmpty} empty manthra row(s) (no shloka, bhashya, or teeka content). Delete them in CMS to remove these warnings.`);
    }

    return { ...book, titles: [], verses, totalVerses: verses.length };
  } catch (err: any) {
    console.warn("[Strapi] getBookById failed:", err.message);
    return undefined;
  }
}

export async function strapiGetBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
  const cached = getCached(bookVerseMetaCache, id);
  if (cached) return cached;
  return dedup(`bookMeta:${id}`, async () => {
    const result = await bookMetaStore.swr(id, async () => {
      const fresh = await _strapiGetBookWithVerseMetaUncached(id);
      if (fresh) setCache(bookVerseMetaCache, id, fresh);
      return fresh;
    });
    if (result) setCache(bookVerseMetaCache, id, result);
    return result;
  });
}

async function _strapiGetBookWithVerseMetaUncached(id: string): Promise<BookWithVerseMeta | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/granthas/${id}`, {
      "populate[0]": "sections",
      "populate[1]": "BhashyakaraIntroduction",
      "populate[2]": "GranthaNameTranslations",
      "populate[3]": "coverImage",
    });
    if (!result.data) return undefined;

    const grantha = result.data;
    const book = mapGranthaToBook(grantha);

    const [allSections, previewMap] = await Promise.all([
      fetchSectionsForGrantha(grantha.documentId),
      fetchManthraPreviewsForGrantha(grantha.documentId),
    ]);
    const sectionTree = buildSectionTree(allSections);

    const verses: VerseMeta[] = [];
    let globalIndex = 0;
    const seenManthraDocIds = new Set<string>();
    const seenManthraKeys = new Set<string>();
    let droppedDuplicates = 0;
    let droppedEmpty = 0;

    if (grantha.BhashyakaraIntroduction) {
      verses.push({
        id: `${book.id}-intro`,
        bookId: book.id,
        verseNumber: 0,
        sectionTitle: "Sambandha Bhashyam",
        adhyayNumber: null,
        adhyayTitle: null,
        khandaNumber: null,
        khandaTitle: null,
        adhyayType: null,
        khandaType: null,
        sectionPath: [],
      });
    }

    function pushManthra(m: any, sectionPath: SectionPathEntry[]) {
      const docId = m.documentId || String(m.id);
      if (seenManthraDocIds.has(docId)) {
        droppedDuplicates++;
        return;
      }
      const numberKey = `${sectionPathKey(sectionPath)}|${m.ShlokaManthraNumber ?? ""}`;
      if (m.ShlokaManthraNumber && seenManthraKeys.has(numberKey)) {
        droppedDuplicates++;
        return;
      }
      if (shouldSkipEmptyManthra(m)) {
        droppedEmpty++;
        return;
      }
      seenManthraDocIds.add(docId);
      if (m.ShlokaManthraNumber) seenManthraKeys.add(numberKey);
      globalIndex++;
      // Short Devanagari opening so the sidebar can show a snippet under each
      // mantra number without a per-verse fetch (ShlokaManthraEntry is populated).
      verses.push({
        id: docId,
        bookId: book.id,
        verseNumber: globalIndex,
        sectionTitle: m.ShlokaManthraNumber ? `Mantra ${m.ShlokaManthraNumber}` : `Mantra ${globalIndex}`,
        ...legacyLevelFields(sectionPath),
        sectionPath,
        preview: previewMap.get(docId),
      });
    }

    // Descend the whole section tree, however deep it goes, and attach each
    // manthra to the full path of sections above it.
    function collectVersesFromLeafSections(section: any, ancestors: SectionPathEntry[]) {
      const path = [...ancestors, sectionPathEntry(section)];
      const subs = sortedSubSections(section);
      if (subs.length > 0) {
        for (const sub of subs) collectVersesFromLeafSections(sub, path);
        return;
      }
      const manthraDocs = section.manthras || [];
      const sortedManthras = [...manthraDocs].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      for (const m of sortedManthras) {
        pushManthra(m, path);
      }
    }

    for (const root of sectionTree) {
      collectVersesFromLeafSections(root, []);
    }

    if (droppedDuplicates > 0) {
      console.warn(`[Strapi] Grantha ${id} (verse-meta): dropped ${droppedDuplicates} duplicate manthra(s). Clean up duplicates in CMS.`);
    }
    if (droppedEmpty > 0) {
      console.warn(`[Strapi] Grantha ${id} (verse-meta): dropped ${droppedEmpty} empty manthra row(s).`);
    }

    return { ...book, titles: [], verses, totalVerses: verses.length };
  } catch (err: any) {
    console.warn("[Strapi] getBookWithVerseMeta failed:", err.message);
    return undefined;
  }
}

function mapIntroductionVerse(grantha: any, bookId: string): VerseWithTranslations | null {
  const intro = grantha.BhashyakaraIntroduction;
  if (!intro) return null;

  const introId = `${bookId}-intro`;
  const bhashyamAuthor = grantha.BhashyamAuthor || "Sri Shankaracharya";
  const bhashyamName = grantha.BhashyamName || "Shankara Bhashyam";

  const explanations = extractExplanationsFromTextAndTranslation(
    intro,
    introId,
    bhashyamAuthor,
    bhashyamName,
    "intro",
  );

  return {
    id: introId,
    bookId,
    verseNumber: 0,
    sectionTitle: "Sambandha Bhashyam",
    adhyayNumber: null,
    adhyayTitle: null,
    khandaNumber: null,
    khandaTitle: null,
    sectionPath: [],
    translations: [],
    explanations,
  };
}

/**
 * The Bhashyakara introduction, which the reader presents as verse 0.
 *
 * It used to be read out of a fully hydrated book, which meant that opening any
 * grantha that *has* an introduction paid for every manthra, every bhashya and
 * every teeka in the text before showing its first page — up to a 120s timeout
 * on the largest ones. Everything the intro needs lives on the grantha record
 * itself, so one small request does the job.
 */
async function fetchIntroVerse(verseId: string): Promise<VerseWithTranslations | undefined> {
  const bookId = verseId.replace(/-intro$/, "");
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/granthas/${bookId}`, {
      "populate[0]": "BhashyakaraIntroduction",
      "populate[1]": "BhashyakaraIntroduction.OtherTranslations",
    });
    if (!result.data) return undefined;
    return mapIntroductionVerse(result.data, bookId) ?? undefined;
  } catch (err: any) {
    console.warn(`[Strapi] intro verse fetch failed for ${bookId}:`, err.message);
    return undefined;
  }
}

export async function strapiGetVerseById(verseId: string): Promise<VerseWithTranslations | undefined> {
  const cached = getCached(verseCache, verseId);
  if (cached) return cached;

  if (verseId.endsWith("-intro")) {
    return dedup(`verse:${verseId}`, async () => {
      const value = await verseStore.swr(verseId, () => fetchIntroVerse(verseId));
      if (value) setCache(verseCache, verseId, value);
      return value;
    });
  }

  for (const [, entry] of bookDetailCache) {
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      const found = entry.data.verses.find((v) => v.id === verseId);
      if (found) { setCache(verseCache, verseId, found); return found; }
    }
  }

  return dedup(`verse:${verseId}`, async () => {
    const value = await verseStore.swr(verseId, () => _strapiGetVerseByIdRemote(verseId));
    if (value) setCache(verseCache, verseId, value);
    return value;
  });
}

/** One manthra straight from the CMS, with its full commentary set. */
async function _strapiGetVerseByIdRemote(verseId: string): Promise<VerseWithTranslations | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/manthras/${verseId}`, {
      "populate[0]": "Section",
      "populate[1]": "ShlokaManthraEntry",
      "populate[2]": "BhashyamEntry",
      "populate[3]": "Teekas.teeka",
      "populate[4]": "Teekas.TeekaEntry",
      "populate[5]": "ShlokaManthraEntry.OtherTranslations",
      "populate[6]": "BhashyamEntry.OtherTranslations",
      "populate[7]": "Teekas.TeekaEntry.OtherTranslations",
      "populate[8]": "Section.grantha",
      // Ancestors, deepest-first: enough levels for the deepest granthas in the
      // CMS today (e.g. Adhyāya › Pāda › Sūtra), so a verse opened directly
      // still knows its full section path.
      "populate[9]": "Section.parent",
      "populate[10]": "Section.parent.parent",
      "populate[11]": "Section.parent.parent.parent",
      "populate[12]": "Section.parent.parent.parent.parent",
    });
    if (!result.data) return undefined;

    const m = result.data;
    const section = m.Section;
    const grantha = section?.grantha;
    const bookId = grantha?.documentId || "";
    const bhashyamAuthor = grantha?.BhashyamAuthor || "Sri Shankaracharya";
    const bhashyamName = grantha?.BhashyamName || "Shankara Bhashyam";

    // Climb the populated parent chain so the path reads outermost-first, the
    // same shape the book-level loaders produce.
    const sectionPath: SectionPathEntry[] = [];
    for (let node = section; node; node = node.parent) {
      sectionPath.unshift(sectionPathEntry(node));
    }

    const verse = mapManthraToVerse(m, bookId, m.order ?? 0, sectionPath, bhashyamAuthor, bhashyamName);
    if (verse) setCache(verseCache, verseId, verse);
    return verse;
  } catch (err: any) {
    console.warn("[Strapi] getVerseById failed:", err.message);
    // Returning undefined (rather than throwing) keeps a transient CMS failure
    // out of the cache, so the next request retries instead of serving a hole.
    return undefined;
  }
}

export async function strapiGetTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]> {
  const verse = await strapiGetVerseById(verseId);
  return verse?.translations ?? [];
}

export async function strapiGetExplanationsByVerseId(verseId: string): Promise<Explanation[]> {
  const verse = await strapiGetVerseById(verseId);
  return verse?.explanations ?? [];
}

export async function strapiGetAllLanguages(): Promise<Language[]> {
  return [];
}

export async function strapiGetBookTitlesByBookId(_bookId: string): Promise<BookTitle[]> {
  return [];
}

export async function strapiGetWordMeaningsByVerseId(_verseId: string): Promise<VerseWordMeaning[]> {
  return [];
}

type CommentaryAuthorAcc = {
  authorTitle: string | null;
  languageCodes: Set<string>;
  commentaryType?: "bhashya" | "teeka";
};

function buildCommentaryOptions(
  authorMap: Map<string, CommentaryAuthorAcc>,
  languageSet: Set<string>,
): CommentaryOptions {
  const authors: CommentaryOption[] = Array.from(authorMap.entries()).map(([name, data]) => ({
    authorName: name,
    authorTitle: data.authorTitle,
    languageCodes: Array.from(data.languageCodes),
    commentaryType: data.commentaryType,
  }));
  const languages = Array.from(languageSet).map((code) => ({ code, name: code }));
  return { authors, languages };
}

function accumulateCommentaryAuthor(
  authorMap: Map<string, CommentaryAuthorAcc>,
  languageSet: Set<string>,
  authorName: string,
  authorTitle: string | null,
  commentaryType: "bhashya" | "teeka",
  langCodes: string[],
): void {
  const existing = authorMap.get(authorName);
  const target = existing ?? { authorTitle, languageCodes: new Set<string>(), commentaryType };
  if (!existing) authorMap.set(authorName, target);
  if (commentaryType === "bhashya") target.commentaryType = "bhashya";
  else if (!target.commentaryType) target.commentaryType = commentaryType;
  for (const code of langCodes) {
    languageSet.add(code);
    target.languageCodes.add(code);
  }
}

/** Language codes carried by one Text-and-Translation component, WITHOUT its heavy content. */
function langCodesFromLightTat(tat: any): string[] {
  if (!tat) return [];
  const codes: string[] = [];
  if (richTextToString(tat.SanskritTextEntry)) codes.push("devanagari");
  if (richTextToString(tat.EnglishTranslationText)) codes.push("english");
  if (Array.isArray(tat.OtherTranslations)) {
    for (const ot of tat.OtherTranslations) {
      if (ot?.LanguageOfTranslation) codes.push(String(ot.LanguageOfTranslation).toLowerCase());
    }
  }
  return codes;
}

/**
 * Commentary options (which authors/languages exist) without hydrating the whole
 * book. Scans manthras with a trimmed populate that keeps the native Sanskrit/
 * English bhashya text (needed to detect those languages) but drops the ~45
 * OtherTranslations rich-text bodies — the payload that makes the full-book load
 * slow — keeping only each translation's language code. Falls back to the
 * full-book derivation if the light scan fails.
 */
/**
 * Page size for the light commentary scan. Even trimmed to language codes, a
 * page of 100 manthras with every bhashya and teeka attached exceeds the CMS's
 * 120s budget on the largest texts (Brahma Sutra). The scan then fails and the
 * caller falls back to hydrating the entire book — measured at over five
 * minutes — so a page size that reliably returns is worth far more than a
 * smaller number of round-trips.
 */
const COMMENTARY_SCAN_PAGE_SIZE = Math.max(
  1,
  Math.min(100, Number(process.env.STRAPI_COMMENTARY_SCAN_PAGE_SIZE || 40)),
);

async function commentaryOptionsFromLightScan(bookId: string): Promise<CommentaryOptions | null> {
  const grantha = await strapiFetch<StrapiResponse<any>>(`/granthas/${bookId}`, {
    "fields[0]": "BhashyamAuthor",
    "fields[1]": "BhashyamName",
  });
  if (!grantha?.data) return null;
  const bhashyamAuthor = grantha.data.BhashyamAuthor || "Sri Shankaracharya";
  const bhashyamName = grantha.data.BhashyamName || "Shankara Bhashyam";

  const manthras = await strapiFetchAll<any>("/manthras", {
    "filters[Section][grantha][documentId]": bookId,
    "populate[BhashyamEntry][fields][0]": "SanskritTextEntry",
    "populate[BhashyamEntry][fields][1]": "EnglishTranslationText",
    "populate[BhashyamEntry][populate][OtherTranslations][fields][0]": "LanguageOfTranslation",
    "populate[Teekas][populate][teeka][fields][0]": "TeekaName",
    "populate[Teekas][populate][teeka][fields][1]": "TeekaAuthor",
    "populate[Teekas][populate][TeekaEntry][fields][0]": "SanskritTextEntry",
    "populate[Teekas][populate][TeekaEntry][fields][1]": "EnglishTranslationText",
    "populate[Teekas][populate][TeekaEntry][populate][OtherTranslations][fields][0]": "LanguageOfTranslation",
  }, COMMENTARY_SCAN_PAGE_SIZE);
  if (manthras.length === 0) return null;

  const authorMap = new Map<string, CommentaryAuthorAcc>();
  const languageSet = new Set<string>();

  for (const m of manthras) {
    const bhashyaCodes = langCodesFromLightTat(m.BhashyamEntry);
    if (bhashyaCodes.length > 0) {
      accumulateCommentaryAuthor(authorMap, languageSet, bhashyamAuthor, bhashyamName, "bhashya", bhashyaCodes);
    }
    if (Array.isArray(m.Teekas)) {
      for (const teekaEntry of m.Teekas) {
        const teekaRef = teekaEntry.teeka;
        const teekaName = teekaRef?.TeekaName || "Teeka";
        const teekaAuthor = teekaRef?.TeekaAuthor || teekaName;
        const teekaCodes = langCodesFromLightTat(teekaEntry.TeekaEntry);
        if (teekaCodes.length > 0) {
          accumulateCommentaryAuthor(authorMap, languageSet, teekaAuthor, teekaName, "teeka", teekaCodes);
        }
      }
    }
  }

  if (authorMap.size === 0) return null;
  return buildCommentaryOptions(authorMap, languageSet);
}

/** Derive commentary options from a fully hydrated book (fallback, heavier). */
async function commentaryOptionsFromFullBook(bookId: string): Promise<CommentaryOptions | null> {
  const book = await strapiGetBookById(bookId);
  if (!book || book.verses.length === 0) return null;

  const authorMap = new Map<string, CommentaryAuthorAcc>();
  const languageSet = new Set<string>();

  for (const verse of book.verses) {
    for (const exp of verse.explanations) {
      const expAny = exp as any;
      accumulateCommentaryAuthor(
        authorMap,
        languageSet,
        exp.authorName,
        exp.authorTitle,
        expAny.commentaryType === "bhashya" ? "bhashya" : "teeka",
        [exp.languageCode],
      );
    }
  }

  if (authorMap.size === 0) return null;
  return buildCommentaryOptions(authorMap, languageSet);
}

/**
 * "This grantha has no commentary" is a real, cacheable answer.
 *
 * Returning `undefined` for it meant the store treated it as a failed load and
 * re-derived it on every request — and the derivation's fallback path is a full
 * book hydration. Measured on Panchadasi (which genuinely has no commentary):
 * every bootstrap spent the entire 1,500ms options budget re-hydrating 1,557
 * verses, on every single request. Cached as an explicit empty result instead.
 */
const EMPTY_COMMENTARY_OPTIONS: CommentaryOptions = { authors: [], languages: [] };

function isEmptyCommentaryOptions(options: CommentaryOptions | null | undefined): boolean {
  return !options || (options.authors.length === 0 && options.languages.length === 0);
}

export async function strapiGetCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions | null> {
  const cached = getCached(commentaryOptionsCache, bookId);
  // Callers still receive null for "none", so a local-Postgres book can fall
  // through to the DB; only the cache knows the difference.
  if (cached) return isEmptyCommentaryOptions(cached) ? null : cached;

  return dedup(`commentaryOptions:${bookId}`, async () => {
    const result = await commentaryOptionsStore.swr(bookId, async () => {
      let options: CommentaryOptions | null = null;
      try {
        options = await commentaryOptionsFromLightScan(bookId);
      } catch (err: any) {
        console.warn(`[Strapi] Light commentary-options scan failed for ${bookId}, falling back to full book:`, err?.message);
      }
      if (!options) {
        try {
          options = await commentaryOptionsFromFullBook(bookId);
        } catch {
          options = null;
        }
      }
      const resolved = options ?? EMPTY_COMMENTARY_OPTIONS;
      setCache(commentaryOptionsCache, bookId, resolved);
      return resolved;
    });
    if (result) setCache(commentaryOptionsCache, bookId, result);
    return isEmptyCommentaryOptions(result) ? null : result!;
  });
}

export async function strapiGetChapterVerses(bookId: string, adhyayNumber: number): Promise<VerseWithTranslations[]> {
  const book = await strapiGetBookById(bookId);
  if (!book) return [];
  return book.verses.filter((v) => v.adhyayNumber === adhyayNumber);
}

export async function strapiGetAllAuthors(): Promise<string[]> {
  try {
    const granthas = await strapiFetchAll("/granthas", { "fields[0]": "BhashyamAuthor" });
    const authors = new Set<string>();
    for (const g of granthas as any[]) {
      if (g.BhashyamAuthor) authors.add(g.BhashyamAuthor);
    }
    return Array.from(authors).sort();
  } catch {
    return [];
  }
}

/**
 * Cache-only reads, for when the CMS is unreachable.
 *
 * `isStrapiAvailable()` in HybridStorage gates the whole Strapi path, which
 * meant a CMS outage made the reader skip its own warm caches and fall through
 * to a local Postgres that does not hold CMS content — returning 404 for
 * granthas it had cached on disk moments earlier. These let the storage layer
 * answer from cache before giving up.
 */
export function peekBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
  return bookMetaStore.peekAny(id);
}

export function peekVerse(verseId: string): Promise<VerseWithTranslations | undefined> {
  const mem = getCached(verseCache, verseId);
  if (mem) return Promise.resolve(mem);
  return verseStore.peekAny(verseId);
}

export function peekCommentaryOptions(bookId: string): Promise<CommentaryOptions | undefined> {
  return commentaryOptionsStore.peekAny(bookId);
}

export function peekBookDetail(id: string): Promise<BookWithDetails | undefined> {
  return bookDetailStore.peekAny(id);
}

const VIDEO_RESOURCES_KEY = "all";

function mapVideoResource(row: any): VideoResource | null {
  const parsed = parseYouTubeUrl(row?.youtube_url);
  if (!parsed) return null;
  const targetType = String(row.target_type || "").toLowerCase();
  if (targetType !== "manthra" && targetType !== "section" && targetType !== "grantha") return null;
  const targetDocId = row.target_doc_id ? String(row.target_doc_id) : "";
  if (!targetDocId) return null;

  // An explicit start_seconds on the row wins over a `t=` in the pasted URL.
  const explicitStart = Number(row.start_seconds);
  const startSeconds = Number.isFinite(explicitStart) && explicitStart > 0
    ? Math.floor(explicitStart)
    : parsed.startSeconds;

  const sortOrder = Number(row.sort_order);
  return {
    id: row.documentId || String(row.id),
    url: String(row.youtube_url),
    videoId: parsed.videoId,
    title: row.title ? String(row.title) : null,
    startSeconds,
    language: row.language ? String(row.language) : null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    targetType: targetType as VideoTargetType,
    targetDocId,
  };
}

/**
 * Every video row in the CMS, normalised. The collection is small (a handful of
 * rows today, a few hundred at most) and has no per-grantha filter that would
 * let us narrow it server-side without knowing the target ids first, so we fetch
 * it whole, cache it, and slice per book.
 */
async function fetchAllVideoResources(): Promise<VideoResource[] | undefined> {
  try {
    const rows = await strapiFetchAll<any>("/video-resources", { "sort[0]": "sort_order:asc" }, 200);
    const mapped: VideoResource[] = [];
    for (const row of rows) {
      const video = mapVideoResource(row);
      if (video) mapped.push(video);
    }
    return mapped;
  } catch (err: any) {
    // A missing content type or an API token without access to it should leave
    // the reader working, just without videos.
    console.warn("[Strapi] video-resources fetch failed:", err.message);
    return undefined;
  }
}

async function getAllVideoResources(): Promise<VideoResource[]> {
  if (!isStrapiConfigured()) return [];
  const cached = videoResourceStore.peekFresh(VIDEO_RESOURCES_KEY);
  if (cached) return cached;
  const value = await dedup(`videoResources`, () =>
    videoResourceStore.swr(VIDEO_RESOURCES_KEY, fetchAllVideoResources),
  );
  return value ?? [];
}

/** Videos for one grantha, grouped by the verse they belong to. */
export async function strapiGetBookVideos(bookId: string): Promise<BookVideos> {
  if (!isStrapiConfigured()) return EMPTY_BOOK_VIDEOS;

  const [all, meta] = await Promise.all([
    getAllVideoResources(),
    strapiGetBookWithVerseMeta(bookId).catch(() => undefined),
  ]);
  if (all.length === 0) return EMPTY_BOOK_VIDEOS;

  const verseIds = new Set<string>();
  for (const verse of meta?.verses ?? []) verseIds.add(verse.id);

  const byVerseId: Record<string, VideoResource[]> = {};
  const book: VideoResource[] = [];
  for (const video of all) {
    if (video.targetType === "grantha") {
      if (video.targetDocId === bookId) book.push(video);
      continue;
    }
    if (video.targetType !== "manthra") continue;
    // Without the verse index we can't tell which grantha a manthra belongs to,
    // so fall back to returning nothing rather than another grantha's videos.
    if (verseIds.size > 0 && !verseIds.has(video.targetDocId)) continue;
    (byVerseId[video.targetDocId] ??= []).push(video);
  }

  const bySortOrder = (a: VideoResource, b: VideoResource) => a.sortOrder - b.sortOrder;
  for (const list of Object.values(byVerseId)) list.sort(bySortOrder);
  book.sort(bySortOrder);

  return { byVerseId, book };
}

export { STRAPI_URL };
