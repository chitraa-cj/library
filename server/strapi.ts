import type {
  Book,
  Verse,
  VerseTranslation,
  Explanation,
  BookTitle,
  Language,
  VerseWithTranslations,
  BookWithDetails,
  BookWithVerseMeta,
  VerseMeta,
  VerseWordMeaning,
} from "@shared/schema";
import type { CommentaryOptions, CommentaryOption } from "./storage";

const STRAPI_URL = process.env.STRAPI_URL || "";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

interface StrapiResponse<T> {
  data: T;
  meta?: { pagination?: { page: number; pageSize: number; pageCount: number; total: number } };
}

interface StrapiEntry {
  id: number;
  documentId?: string;
  attributes?: Record<string, any>;
  [key: string]: any;
}

function flattenEntry(entry: StrapiEntry): Record<string, any> {
  if (entry.attributes && typeof entry.attributes === "object") {
    return { id: entry.id, documentId: entry.documentId, ...entry.attributes };
  }
  return entry;
}

function resolveRelation(field: any): any[] {
  if (!field) return [];
  if (Array.isArray(field)) return field.map(flattenEntry);
  if (field.data && Array.isArray(field.data)) return field.data.map(flattenEntry);
  if (field.data && typeof field.data === "object") return [flattenEntry(field.data)];
  return [];
}

function resolveRelationSingle(field: any): Record<string, any> | null {
  if (!field) return null;
  if (field.data && typeof field.data === "object" && !Array.isArray(field.data)) return flattenEntry(field.data);
  if (typeof field === "object" && !Array.isArray(field) && (field.id || field.documentId)) return flattenEntry(field as StrapiEntry);
  return null;
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

  const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Strapi API error: ${response.status} ${response.statusText} for ${endpoint}`);
  }
  return response.json();
}

async function strapiFetchAll<T = StrapiEntry>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const pageSize = 100;

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

function strapiId(flat: Record<string, any>): string {
  return flat.documentId || String(flat.id);
}

function getField(flat: Record<string, any>, camel: string, snake: string): any {
  return flat[camel] ?? flat[snake] ?? null;
}

function mapBook(raw: StrapiEntry): Book {
  const f = flattenEntry(raw);
  const coverImg = f.coverImage || f.cover_image;
  return {
    id: strapiId(f),
    slug: f.slug || "",
    title: f.title || "",
    author: f.author || null,
    description: f.description || null,
    category: f.category || "Uncategorized",
    coverImage: typeof coverImg === "object" ? coverImg?.url || null : coverImg || null,
    totalVerses: getField(f, "totalVerses", "total_verses") ?? 0,
  };
}

function mapVerse(raw: StrapiEntry | Record<string, any>, bookId: string): Verse {
  const f = typeof (raw as StrapiEntry).attributes === "object" ? flattenEntry(raw as StrapiEntry) : raw;
  return {
    id: strapiId(f),
    bookId,
    verseNumber: getField(f, "verseNumber", "verse_number") ?? 0,
    sectionTitle: getField(f, "sectionTitle", "section_title"),
    adhyayNumber: getField(f, "adhyayNumber", "adhyay_number"),
    adhyayTitle: getField(f, "adhyayTitle", "adhyay_title"),
    khandaNumber: getField(f, "khandaNumber", "khanda_number"),
    khandaTitle: getField(f, "khandaTitle", "khanda_title"),
  };
}

function mapTranslation(raw: StrapiEntry | Record<string, any>, verseId: string): VerseTranslation {
  const f = typeof (raw as StrapiEntry).attributes === "object" ? flattenEntry(raw as StrapiEntry) : raw;
  return {
    id: strapiId(f),
    verseId,
    languageCode: getField(f, "languageCode", "language_code") ?? "",
    content: f.content || "",
    isAiTranslated: getField(f, "isAiTranslated", "is_ai_translated") ?? false,
  };
}

function mapExplanation(raw: StrapiEntry | Record<string, any>, verseId: string): Explanation {
  const f = typeof (raw as StrapiEntry).attributes === "object" ? flattenEntry(raw as StrapiEntry) : raw;
  return {
    id: strapiId(f),
    verseId,
    authorName: getField(f, "authorName", "author_name") ?? getField(f, "scholarName", "scholar_name") ?? "",
    authorTitle: getField(f, "authorTitle", "author_title") ?? getField(f, "scholarTitle", "scholar_title") ?? null,
    languageCode: getField(f, "languageCode", "language_code") ?? "",
    content: f.content || "",
    isAiTranslated: getField(f, "isAiTranslated", "is_ai_translated") ?? false,
  };
}

function mapBookTitle(raw: StrapiEntry | Record<string, any>, bookId: string): BookTitle {
  const f = typeof (raw as StrapiEntry).attributes === "object" ? flattenEntry(raw as StrapiEntry) : raw;
  return {
    id: strapiId(f),
    bookId,
    languageCode: getField(f, "languageCode", "language_code") ?? "",
    title: f.title || "",
  };
}

function mapLanguage(raw: StrapiEntry): Language {
  const f = flattenEntry(raw);
  return {
    id: strapiId(f),
    code: f.code || "",
    name: f.name || "",
    nativeName: getField(f, "nativeName", "native_name") ?? "",
    script: f.script || "",
  };
}

function mapWordMeaning(raw: StrapiEntry | Record<string, any>, verseId: string): VerseWordMeaning {
  const f = typeof (raw as StrapiEntry).attributes === "object" ? flattenEntry(raw as StrapiEntry) : raw;
  return {
    id: strapiId(f),
    verseId,
    word: f.word || "",
    meaning: f.meaning || "",
    position: f.position ?? 0,
  };
}

export function isStrapiConfigured(): boolean {
  return !!(STRAPI_URL && STRAPI_API_TOKEN);
}

export async function isStrapiReachable(): Promise<boolean> {
  if (!isStrapiConfigured()) return false;
  try {
    await strapiFetch("/books", { "pagination[pageSize]": "1" });
    return true;
  } catch {
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
    const response = await fetch(`${STRAPI_URL}/api/books?pagination[pageSize]=1`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      const count = data?.meta?.pagination?.total ?? data?.data?.length ?? "unknown";
      return { connected: true, message: `Connected to Strapi. Books found: ${count}` };
    }
    return { connected: false, message: `Strapi returned status ${response.status}` };
  } catch (error: any) {
    return { connected: false, message: `Connection failed: ${error.message || error}` };
  }
}

export async function strapiGetAllBooks(): Promise<Book[]> {
  const entries = await strapiFetchAll("/books", { populate: "*" });
  return entries.map((e) => mapBook(e as StrapiEntry));
}

export async function strapiGetBookBySlug(slug: string): Promise<Book | undefined> {
  const result = await strapiFetch<StrapiResponse<StrapiEntry[]>>("/books", {
    "filters[slug][$eq]": slug,
    populate: "*",
  });
  if (!result.data?.[0]) return undefined;
  return mapBook(result.data[0]);
}

export async function strapiGetBookById(id: string): Promise<BookWithDetails | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<StrapiEntry>>(`/books/${id}`, {
      "populate[verses][populate]": "*",
      "populate[titles][populate]": "*",
      "populate[book_titles][populate]": "*",
    });
    if (!result.data) return undefined;

    const bookFlat = flattenEntry(result.data);
    const book = mapBook(result.data);

    const titlesRaw = resolveRelation(bookFlat.titles || bookFlat.book_titles);
    const titles = titlesRaw.map((t) => mapBookTitle(t, book.id));

    const versesRaw = resolveRelation(bookFlat.verses);
    const verses: VerseWithTranslations[] = versesRaw.map((v) => {
      const verse = mapVerse(v, book.id);
      const translationsRaw = resolveRelation(v.translations || v.verse_translations);
      const explanationsRaw = resolveRelation(v.explanations);
      return {
        ...verse,
        translations: translationsRaw.map((t) => mapTranslation(t, verse.id)),
        explanations: explanationsRaw.map((e) => mapExplanation(e, verse.id)),
      };
    });

    return { ...book, titles, verses };
  } catch {
    return undefined;
  }
}

export async function strapiGetBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<StrapiEntry>>(`/books/${id}`, {
      "populate[verses][fields]": "verseNumber,sectionTitle,adhyayNumber,adhyayTitle,khandaNumber,khandaTitle",
      "populate[titles]": "*",
      "populate[book_titles]": "*",
    });
    if (!result.data) return undefined;

    const bookFlat = flattenEntry(result.data);
    const book = mapBook(result.data);

    const titlesRaw = resolveRelation(bookFlat.titles || bookFlat.book_titles);
    const titles = titlesRaw.map((t) => mapBookTitle(t, book.id));

    const versesRaw = resolveRelation(bookFlat.verses);
    const verses: VerseMeta[] = versesRaw.map((v) => {
      const mapped = mapVerse(v, book.id);
      return {
        id: mapped.id,
        bookId: mapped.bookId,
        verseNumber: mapped.verseNumber,
        sectionTitle: mapped.sectionTitle,
        adhyayNumber: mapped.adhyayNumber,
        adhyayTitle: mapped.adhyayTitle,
        khandaNumber: mapped.khandaNumber,
        khandaTitle: mapped.khandaTitle,
      };
    });

    return { ...book, titles, verses };
  } catch {
    return undefined;
  }
}

export async function strapiGetVerseById(verseId: string): Promise<VerseWithTranslations | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<StrapiEntry>>(`/verses/${verseId}`, {
      populate: "*",
    });
    if (!result.data) return undefined;

    const flat = flattenEntry(result.data);
    const bookRef = resolveRelationSingle(flat.book);
    const bookId = bookRef ? strapiId(bookRef) : (flat.bookId || flat.book_id || "");
    const verse = mapVerse(flat, String(bookId));

    const translationsRaw = resolveRelation(flat.translations || flat.verse_translations);
    const explanationsRaw = resolveRelation(flat.explanations);

    return {
      ...verse,
      translations: translationsRaw.map((t) => mapTranslation(t, verse.id)),
      explanations: explanationsRaw.map((e) => mapExplanation(e, verse.id)),
    };
  } catch {
    return undefined;
  }
}

export async function strapiGetTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]> {
  try {
    const entries = await strapiFetchAll("/verse-translations", {
      "filters[verse][documentId][$eq]": verseId,
      populate: "*",
    });
    return entries.map((t) => mapTranslation(flattenEntry(t as StrapiEntry), verseId));
  } catch {
    try {
      const entries = await strapiFetchAll("/verse-translations", {
        "filters[verse][id][$eq]": verseId,
        populate: "*",
      });
      return entries.map((t) => mapTranslation(flattenEntry(t as StrapiEntry), verseId));
    } catch {
      return [];
    }
  }
}

export async function strapiGetExplanationsByVerseId(verseId: string): Promise<Explanation[]> {
  try {
    const entries = await strapiFetchAll("/explanations", {
      "filters[verse][documentId][$eq]": verseId,
      populate: "*",
    });
    return entries.map((e) => mapExplanation(flattenEntry(e as StrapiEntry), verseId));
  } catch {
    try {
      const entries = await strapiFetchAll("/explanations", {
        "filters[verse][id][$eq]": verseId,
        populate: "*",
      });
      return entries.map((e) => mapExplanation(flattenEntry(e as StrapiEntry), verseId));
    } catch {
      return [];
    }
  }
}

export async function strapiGetAllLanguages(): Promise<Language[]> {
  try {
    const entries = await strapiFetchAll("/languages");
    return entries.map((e) => mapLanguage(e as StrapiEntry));
  } catch {
    return [];
  }
}

export async function strapiGetBookTitlesByBookId(bookId: string): Promise<BookTitle[]> {
  try {
    const entries = await strapiFetchAll("/book-titles", {
      "filters[book][documentId][$eq]": bookId,
      populate: "*",
    });
    return entries.map((t) => mapBookTitle(flattenEntry(t as StrapiEntry), bookId));
  } catch {
    return [];
  }
}

export async function strapiGetWordMeaningsByVerseId(verseId: string): Promise<VerseWordMeaning[]> {
  try {
    const entries = await strapiFetchAll("/verse-word-meanings", {
      "filters[verse][documentId][$eq]": verseId,
      populate: "*",
    });
    return entries.map((e) => mapWordMeaning(flattenEntry(e as StrapiEntry), verseId));
  } catch {
    return [];
  }
}

export async function strapiGetCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions | null> {
  try {
    const entries = await strapiFetchAll("/explanations", {
      "filters[verse][book][documentId][$eq]": bookId,
      fields: "authorName,authorTitle,languageCode,author_name,author_title,language_code",
    });

    if (entries.length === 0) return null;

    const authorMap = new Map<string, { authorTitle: string | null; languageCodes: Set<string> }>();
    const languageSet = new Set<string>();

    for (const raw of entries) {
      const f = flattenEntry(raw as StrapiEntry);
      const authorName = getField(f, "authorName", "author_name") ?? getField(f, "scholarName", "scholar_name") ?? "";
      const authorTitle = getField(f, "authorTitle", "author_title") ?? getField(f, "scholarTitle", "scholar_title") ?? null;
      const langCode = getField(f, "languageCode", "language_code") ?? "";

      languageSet.add(langCode);
      if (!authorMap.has(authorName)) {
        authorMap.set(authorName, { authorTitle, languageCodes: new Set([langCode]) });
      } else {
        authorMap.get(authorName)!.languageCodes.add(langCode);
      }
    }

    const languages = await strapiGetAllLanguages();
    const langNameMap = new Map(languages.map((l) => [l.code, l.name]));

    const authors: CommentaryOption[] = Array.from(authorMap.entries()).map(([name, data]) => ({
      authorName: name,
      authorTitle: data.authorTitle,
      languageCodes: Array.from(data.languageCodes),
    }));

    const languagesResult = Array.from(languageSet).map((code) => ({
      code,
      name: langNameMap.get(code) || code,
    }));

    return { authors, languages: languagesResult };
  } catch {
    return null;
  }
}

export async function strapiGetChapterVerses(bookId: string, adhyayNumber: number): Promise<VerseWithTranslations[]> {
  try {
    const entries = await strapiFetchAll("/verses", {
      "filters[book][documentId][$eq]": bookId,
      "filters[adhyayNumber][$eq]": String(adhyayNumber),
      populate: "*",
      sort: "verseNumber:asc",
    });

    return entries.map((raw) => {
      const f = flattenEntry(raw as StrapiEntry);
      const verse = mapVerse(f, bookId);
      const translationsRaw = resolveRelation(f.translations || f.verse_translations);
      return {
        ...verse,
        translations: translationsRaw.map((t) => mapTranslation(t, verse.id)),
        explanations: [],
      };
    });
  } catch {
    return [];
  }
}

export async function strapiGetAllAuthors(): Promise<string[]> {
  try {
    const entries = await strapiFetchAll("/explanations", {
      fields: "authorName,author_name,scholarName,scholar_name",
    });
    const authors = new Set<string>();
    for (const raw of entries) {
      const f = flattenEntry(raw as StrapiEntry);
      const name = getField(f, "authorName", "author_name") ?? getField(f, "scholarName", "scholar_name");
      if (name) authors.add(name);
    }
    return Array.from(authors).sort();
  } catch {
    return [];
  }
}

export { STRAPI_URL };
