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
} from "@shared/schema";
import { transliterateSanskrit, LANGUAGE_TO_SCHEME } from "./strapi-transliterate";
import type { CommentaryOptions, CommentaryOption } from "./storage";
import { Agent, fetch as undiciFetch } from "undici";

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

function isStrapiTimeoutError(e: unknown): boolean {
  const err = e as Error & { cause?: Error };
  const msg = `${err?.message || ""} ${err?.cause?.message || ""}`.toLowerCase();
  return msg.includes("timeout") || msg.includes("aborted");
}

async function strapiHttpFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  const maxRetries = Math.max(0, Math.min(3, Number(process.env.STRAPI_FETCH_RETRIES ?? 2)));
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await undiciFetch(url, {
        headers: { "User-Agent": strapiUserAgent, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        ...(strapiTlsAgent ? { dispatcher: strapiTlsAgent } : {}),
      } as RequestInit);
    } catch (e: unknown) {
      lastError = e;
      if (attempt < maxRetries && isStrapiTimeoutError(e)) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
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

/** Default 5 minutes; override with STRAPI_CACHE_TTL_MS (0 = always re-fetch Strapi). */
const CACHE_TTL = (() => {
  const raw = process.env.STRAPI_CACHE_TTL_MS;
  if (raw === undefined || raw === "") return 5 * 60 * 1000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5 * 60 * 1000;
})();
const bookDetailCache = new Map<string, CacheEntry<BookWithDetails>>();
const bookVerseMetaCache = new Map<string, CacheEntry<BookWithVerseMeta>>();
let bookListCacheEntry: CacheEntry<(Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] })[]> | null = null;
const verseCache = new Map<string, CacheEntry<VerseWithTranslations>>();
const explanationCache = new Map<string, CacheEntry<Explanation[]>>();
const commentaryOptionsCache = new Map<string, CacheEntry<CommentaryOptions>>();
const inflight = new Map<string, Promise<any>>();

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
}

export function invalidateBookCache(bookId: string): void {
  const detailEntry = bookDetailCache.get(bookId);
  if (detailEntry) {
    for (const v of detailEntry.data.verses) {
      verseCache.delete(v.id);
      explanationCache.delete(v.id);
    }
  }

  const metaEntry = bookVerseMetaCache.get(bookId);
  if (metaEntry) {
    for (const v of metaEntry.data.verses) {
      verseCache.delete(v.id);
      explanationCache.delete(v.id);
    }
  }

  verseCache.delete(`${bookId}-intro`);
  explanationCache.delete(`${bookId}-intro`);

  bookDetailCache.delete(bookId);
  bookVerseMetaCache.delete(bookId);
  bookListCacheEntry = null;
  commentaryOptionsCache.delete(bookId);

  console.log(`[Strapi] Cache invalidated for grantha ${bookId}`);
}

export function invalidateAllStrapiCaches(): void {
  bookDetailCache.clear();
  bookVerseMetaCache.clear();
  bookListCacheEntry = null;
  verseCache.clear();
  explanationCache.clear();
  commentaryOptionsCache.clear();
  console.log("[Strapi] All in-memory caches cleared");
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

async function strapiFetchAll<T = any>(endpoint: string, params: Record<string, string> = {}, pageSize = 100): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;

  while (true) {
    const result = await strapiFetch<StrapiResponse<T[]>>(endpoint, {
      ...params,
      "pagination[page]": String(page),
      "pagination[pageSize]": String(pageSize),
    });
    if (!result.data || !Array.isArray(result.data)) break;
    allItems.push(...result.data);
    if (!result.meta?.pagination || page >= result.meta.pagination.pageCount) break;
    page++;
  }

  return allItems;
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
  adhyayNumber: number | null,
  adhyayTitle: string | null,
  khandaNumber: number | null,
  khandaTitle: string | null,
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
    adhyayNumber,
    adhyayTitle,
    khandaNumber,
    khandaTitle,
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

export async function strapiGetAllBooks(): Promise<(Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] })[]> {
  if (bookListCacheEntry && Date.now() - bookListCacheEntry.timestamp < CACHE_TTL) return bookListCacheEntry.data;
  return dedup("allBooks", async () => {
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
  });
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

export async function strapiGetBookById(id: string): Promise<BookWithDetails | undefined> {
  const cached = getCached(bookDetailCache, id);
  if (cached) return cached;
  return dedup(`bookDetail:${id}`, async () => {
    const result = await _strapiGetBookByIdUncached(id);
    if (result) {
      setCache(bookDetailCache, id, result);
      for (const v of result.verses) {
        setCache(verseCache, v.id, v);
      }
    }
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
      adhyayNum: number | null;
      adhyayTitle: string | null;
      khandaNum: number | null;
      khandaTitle: string | null;
      orderKey: [number, number];
    };
    const leafTasks: LeafTask[] = [];

    function collectLeafTasks(
      section: any,
      adhyayNum: number | null,
      adhyayTitle: string | null,
      khandaNum: number | null,
      khandaTitle: string | null,
      adhyayOrder: number,
    ) {
      const subs = (section.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      if (subs.length > 0) {
        for (const sub of subs) {
          collectLeafTasks(sub, adhyayNum, adhyayTitle, khandaNum || sub.order, khandaTitle || sub.title, adhyayOrder);
        }
      } else {
        leafTasks.push({
          sectionDocId: section.documentId,
          adhyayNum,
          adhyayTitle,
          khandaNum,
          khandaTitle,
          orderKey: [adhyayOrder, khandaNum ?? 0],
        });
      }
    }

    for (const adhyay of sectionTree) {
      const adhyayNum = adhyay.order ?? null;
      const adhyayTitle = adhyay.title || null;
      const adhyayOrder = adhyay.order ?? 0;

      const khandas = (adhyay.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      if (khandas.length > 0) {
        for (const khanda of khandas) {
          const khandaNum = khanda.order ?? null;
          const khandaTitle = khanda.title || null;
          collectLeafTasks(khanda, adhyayNum, adhyayTitle, khandaNum, khandaTitle, adhyayOrder);
        }
      } else {
        leafTasks.push({
          sectionDocId: adhyay.documentId,
          adhyayNum,
          adhyayTitle,
          khandaNum: null,
          khandaTitle: null,
          orderKey: [adhyayOrder, 0],
        });
      }
    }

    const sectionFetchConcurrency = Math.max(
      1,
      Math.min(8, Number(process.env.STRAPI_SECTION_FETCH_CONCURRENCY || 4)),
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
        const numberKey = `${task.adhyayNum ?? ""}|${task.khandaNum ?? ""}|${m.ShlokaManthraNumber ?? ""}`;
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
          mapManthraToVerse(m, book.id, globalIndex, task.adhyayNum, task.adhyayTitle, task.khandaNum, task.khandaTitle, bhashyamAuthor, bhashyamName)
        );
      }
    }
    if (droppedDuplicates > 0) {
      console.warn(`[Strapi] Grantha ${id}: dropped ${droppedDuplicates} duplicate manthra(s) (same docId or same adhyay/khanda/ShlokaManthraNumber). Clean up duplicates in CMS.`);
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
    const result = await _strapiGetBookWithVerseMetaUncached(id);
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
      });
    }

    function pushManthra(
      m: any,
      adhyayNum: number | null,
      adhyayTitle: string | null,
      khandaNum: number | null,
      khandaTitle: string | null,
      adhyayType: string | null,
      khandaType: string | null,
    ) {
      const docId = m.documentId || String(m.id);
      if (seenManthraDocIds.has(docId)) {
        droppedDuplicates++;
        return;
      }
      const numberKey = `${adhyayNum ?? ""}|${khandaNum ?? ""}|${m.ShlokaManthraNumber ?? ""}`;
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
        adhyayNumber: adhyayNum,
        adhyayTitle,
        khandaNumber: khandaNum,
        khandaTitle,
        adhyayType,
        khandaType,
        preview: previewMap.get(docId),
      });
    }

    function collectVersesFromLeafSections(
      section: any,
      adhyayNum: number | null,
      adhyayTitle: string | null,
      khandaNum: number | null,
      khandaTitle: string | null,
      adhyayType: string | null,
      khandaType: string | null,
    ) {
      const subs = (section.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      if (subs.length > 0) {
        for (const sub of subs) {
          collectVersesFromLeafSections(
            sub, adhyayNum, adhyayTitle,
            khandaNum || sub.order, khandaTitle || sub.title, adhyayType, khandaType || sub.type || null,
          );
        }
      } else {
        const manthraDocs = section.manthras || [];
        const sortedManthras = [...manthraDocs].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        for (const m of sortedManthras) {
          pushManthra(m, adhyayNum, adhyayTitle, khandaNum, khandaTitle, adhyayType, khandaType);
        }
      }
    }

    for (const adhyay of sectionTree) {
      const adhyayNum = adhyay.order ?? null;
      const adhyayTitle = adhyay.title || null;
      const adhyayType = adhyay.type || null;

      const khandas = (adhyay.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      if (khandas.length > 0) {
        for (const khanda of khandas) {
          const khandaNum = khanda.order ?? null;
          const khandaTitle = khanda.title || null;
          const khandaType = khanda.type || null;
          collectVersesFromLeafSections(khanda, adhyayNum, adhyayTitle, khandaNum, khandaTitle, adhyayType, khandaType);
        }
      } else {
        const manthraDocs = adhyay.manthras || [];
        const sortedManthras = [...manthraDocs].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        for (const m of sortedManthras) {
          pushManthra(m, adhyayNum, adhyayTitle, null, null, adhyayType, null);
        }
      }
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
    translations: [],
    explanations,
  };
}

export async function strapiGetVerseById(verseId: string): Promise<VerseWithTranslations | undefined> {
  const cached = getCached(verseCache, verseId);
  if (cached) return cached;

  if (verseId.endsWith("-intro")) {
    const bookId = verseId.replace("-intro", "");
    const book = await strapiGetBookById(bookId);
    const verse = book?.verses.find((v) => v.id === verseId);
    if (verse) setCache(verseCache, verseId, verse);
    return verse;
  }

  for (const [, entry] of bookDetailCache) {
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      const found = entry.data.verses.find((v) => v.id === verseId);
      if (found) { setCache(verseCache, verseId, found); return found; }
    }
  }

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
      "populate[9]": "Section.parent",
    });
    if (!result.data) return undefined;

    const m = result.data;
    const section = m.Section;
    const grantha = section?.grantha;
    const bookId = grantha?.documentId || "";
    const bhashyamAuthor = grantha?.BhashyamAuthor || "Sri Shankaracharya";
    const bhashyamName = grantha?.BhashyamName || "Shankara Bhashyam";

    let adhyayNumber: number | null = null;
    let adhyayTitle: string | null = null;
    let khandaNumber: number | null = null;
    let khandaTitle: string | null = null;

    if (section) {
      if (section.type === "adhyay") {
        adhyayNumber = section.order ?? null;
        adhyayTitle = section.title || null;
      } else if (section.type === "khanda" || section.type === "valli") {
        khandaNumber = section.order ?? null;
        khandaTitle = section.title || null;
        if (section.parent) {
          adhyayNumber = section.parent.order ?? null;
          adhyayTitle = section.parent.title || null;
        }
      }
    }

    const verse = mapManthraToVerse(
      m, bookId, m.order ?? 0,
      adhyayNumber, adhyayTitle,
      khandaNumber, khandaTitle,
      bhashyamAuthor, bhashyamName,
    );
    if (verse) setCache(verseCache, verseId, verse);
    return verse;
  } catch (err: any) {
    console.warn("[Strapi] getVerseById failed:", err.message);
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

export async function strapiGetCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions | null> {
  try {
    const book = await strapiGetBookById(bookId);
    if (!book || book.verses.length === 0) return null;

    const authorMap = new Map<string, { authorTitle: string | null; languageCodes: Set<string>; commentaryType?: "bhashya" | "teeka" }>();
    const languageSet = new Set<string>();

    for (const verse of book.verses) {
      for (const exp of verse.explanations) {
        const expAny = exp as any;
        languageSet.add(exp.languageCode);
        if (!authorMap.has(exp.authorName)) {
          authorMap.set(exp.authorName, {
            authorTitle: exp.authorTitle,
            languageCodes: new Set([exp.languageCode]),
            commentaryType: expAny.commentaryType || undefined,
          });
        } else {
          const existing = authorMap.get(exp.authorName)!;
          existing.languageCodes.add(exp.languageCode);
          if (expAny.commentaryType === "bhashya") {
            existing.commentaryType = "bhashya";
          } else if (!existing.commentaryType && expAny.commentaryType) {
            existing.commentaryType = expAny.commentaryType;
          }
        }
      }
    }

    const authors: CommentaryOption[] = Array.from(authorMap.entries()).map(([name, data]) => ({
      authorName: name,
      authorTitle: data.authorTitle,
      languageCodes: Array.from(data.languageCodes),
      commentaryType: data.commentaryType,
    }));

    const languagesResult = Array.from(languageSet).map((code) => ({ code, name: code }));

    return { authors, languages: languagesResult };
  } catch {
    return null;
  }
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

export { STRAPI_URL };
