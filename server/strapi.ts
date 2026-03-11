import type {
  Book,
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

interface RichTextBlock {
  type: string;
  children: { text: string; type: string }[];
}

function richTextToString(blocks: RichTextBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks
    .map((block) => block.children?.map((c) => c.text).join("") || "")
    .join("\n")
    .trim();
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

async function strapiFetchAll<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function mapGranthaToBook(g: any): Book {
  const docId = g.documentId || String(g.id);
  return {
    id: docId,
    slug: slugify(g.GranthaName || ""),
    title: g.GranthaName || "",
    author: g.BhashyamAuthor || null,
    description: richTextToString(g.IntroductionToTextEnglish) || null,
    category: g.GranthaType || "Uncategorized",
    coverImage: null,
    totalVerses: Array.isArray(g.chapters) ? g.chapters.length : 0,
  };
}

function mapChapterToVerse(ch: any, bookId: string, index: number): VerseWithTranslations {
  const docId = ch.documentId || String(ch.id);
  const verseNumber = ch.order ?? index;

  const chapterTitle = ch.ChapterTitle || null;
  let adhyayNumber: number | null = null;
  let adhyayTitle: string | null = null;
  const chapterMatch = chapterTitle?.match(/(?:Adhyaya|Chapter|अध्याय)\s*(\d+)/i);
  if (chapterMatch) {
    adhyayNumber = parseInt(chapterMatch[1], 10);
    adhyayTitle = chapterTitle;
  }

  const translations: VerseTranslation[] = [];
  const explanations: Explanation[] = [];

  const shloka = ch.ShlokaManthraEntry;
  if (shloka) {
    const sanskritText = richTextToString(shloka.SanskritTextEntry);
    if (sanskritText) {
      translations.push({
        id: `${docId}-sa`,
        verseId: docId,
        languageCode: "devanagari",
        content: sanskritText,
        isAiTranslated: false,
      });
    }

    const englishText = richTextToString(shloka.EnglishTranslationText);
    if (englishText) {
      translations.push({
        id: `${docId}-en`,
        verseId: docId,
        languageCode: "english",
        content: englishText,
        isAiTranslated: false,
      });
    }

    const otherText = richTextToString(shloka.OtherLanguagesTranslation);
    if (otherText && shloka.LanguageOfTranslation) {
      translations.push({
        id: `${docId}-other`,
        verseId: docId,
        languageCode: shloka.LanguageOfTranslation.toLowerCase(),
        content: otherText,
        isAiTranslated: false,
      });
    }
  }

  const bhashya = ch.BhashyamForShlokaManthra;
  if (bhashya) {
    const bhashyaSanskrit = richTextToString(bhashya.SanskritTextEntry);
    if (bhashyaSanskrit) {
      const bhashyamAuthor = ch.grantha?.BhashyamAuthor || "Sri Shankaracharya";
      const bhashyamName = ch.grantha?.BhashyamName || "Shankara Bhashyam";
      explanations.push({
        id: `${docId}-bhashya-sa`,
        verseId: docId,
        authorName: bhashyamAuthor,
        authorTitle: bhashyamName,
        languageCode: "devanagari",
        content: bhashyaSanskrit,
        isAiTranslated: false,
      });
    }

    const bhashyaEnglish = richTextToString(bhashya.EnglishTranslationText);
    if (bhashyaEnglish) {
      const bhashyamAuthor = ch.grantha?.BhashyamAuthor || "Sri Shankaracharya";
      const bhashyamName = ch.grantha?.BhashyamName || "Shankara Bhashyam";
      explanations.push({
        id: `${docId}-bhashya-en`,
        verseId: docId,
        authorName: bhashyamAuthor,
        authorTitle: bhashyamName,
        languageCode: "english",
        content: bhashyaEnglish,
        isAiTranslated: false,
      });
    }

    const bhashyaOther = richTextToString(bhashya.OtherLanguagesTranslation);
    if (bhashyaOther && bhashya.LanguageOfTranslation) {
      const bhashyamAuthor = ch.grantha?.BhashyamAuthor || "Sri Shankaracharya";
      const bhashyamName = ch.grantha?.BhashyamName || "Shankara Bhashyam";
      explanations.push({
        id: `${docId}-bhashya-other`,
        verseId: docId,
        authorName: bhashyamAuthor,
        authorTitle: bhashyamName,
        languageCode: bhashya.LanguageOfTranslation.toLowerCase(),
        content: bhashyaOther,
        isAiTranslated: false,
      });
    }
  }

  if (Array.isArray(ch.Teekas)) {
    for (const teeka of ch.Teekas) {
      if (teeka.TeekaName) {
        explanations.push({
          id: `${docId}-teeka-${teeka.id || teeka.TeekaName}`,
          verseId: docId,
          authorName: teeka.TeekaAuthor || teeka.TeekaName,
          authorTitle: teeka.TeekaName,
          languageCode: "devanagari",
          content: teeka.TeekaContent ? richTextToString(teeka.TeekaContent) : "",
          isAiTranslated: false,
        });
      }
    }
  }

  return {
    id: docId,
    bookId,
    verseNumber,
    sectionTitle: chapterTitle,
    adhyayNumber,
    adhyayTitle,
    khandaNumber: null,
    khandaTitle: null,
    translations,
    explanations,
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
    const response = await fetch(`${STRAPI_URL}/api/granthas?pagination[pageSize]=1`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      const count = data?.meta?.pagination?.total ?? data?.data?.length ?? "unknown";
      return { connected: true, message: `Connected to Strapi. Granthas found: ${count}` };
    }
    return { connected: false, message: `Strapi returned status ${response.status}` };
  } catch (error: any) {
    return { connected: false, message: `Connection failed: ${error.message || error}` };
  }
}

export async function strapiGetAllBooks(): Promise<Book[]> {
  const granthas = await strapiFetchAll("/granthas", { "populate": "*" });
  return granthas.map(mapGranthaToBook);
}

export async function strapiGetBookBySlug(slug: string): Promise<Book | undefined> {
  const granthas = await strapiFetchAll("/granthas", { "populate": "*" });
  const match = granthas.find((g: any) => slugify(g.GranthaName || "") === slug);
  return match ? mapGranthaToBook(match) : undefined;
}

export async function strapiGetBookById(id: string): Promise<BookWithDetails | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/granthas/${id}`, {
      "populate[chapters][populate]": "*",
      "populate[BhashyakaraIntroduction][populate]": "*",
    });
    if (!result.data) return undefined;

    const grantha = result.data;
    const book = mapGranthaToBook(grantha);

    const chaptersData = Array.isArray(grantha.chapters) ? grantha.chapters : [];
    const sortedChapters = [...chaptersData].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const verses: VerseWithTranslations[] = sortedChapters.map((ch: any, idx: number) => {
      ch.grantha = grantha;
      return mapChapterToVerse(ch, book.id, idx);
    });

    const introVerse = mapIntroductionVerse(grantha, book.id);
    if (introVerse) {
      verses.unshift(introVerse);
    }

    return { ...book, titles: [], verses, totalVerses: verses.length };
  } catch (err: any) {
    console.warn("[Strapi] getBookById failed:", err.message);
    return undefined;
  }
}

export async function strapiGetBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/granthas/${id}`, {
      "populate[chapters][fields]": "ChapterTitle,order,documentId",
      "populate[BhashyakaraIntroduction]": "*",
    });
    if (!result.data) return undefined;

    const grantha = result.data;
    const book = mapGranthaToBook(grantha);

    const chaptersData = Array.isArray(grantha.chapters) ? grantha.chapters : [];
    const sortedChapters = [...chaptersData].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    const verses: VerseMeta[] = [];

    if (grantha.BhashyakaraIntroduction) {
      const introId = `${book.id}-intro`;
      verses.push({
        id: introId,
        bookId: book.id,
        verseNumber: 0,
        sectionTitle: "Introduction",
        adhyayNumber: null,
        adhyayTitle: null,
        khandaNumber: null,
        khandaTitle: null,
      });
    }

    for (let i = 0; i < sortedChapters.length; i++) {
      const ch = sortedChapters[i];
      const docId = ch.documentId || String(ch.id);
      const chapterTitle = ch.ChapterTitle || null;
      let adhyayNumber: number | null = null;
      const chapterMatch = chapterTitle?.match(/(?:Adhyaya|Chapter|अध्याय)\s*(\d+)/i);
      if (chapterMatch) adhyayNumber = parseInt(chapterMatch[1], 10);

      verses.push({
        id: docId,
        bookId: book.id,
        verseNumber: ch.order ?? (i + 1),
        sectionTitle: chapterTitle,
        adhyayNumber,
        adhyayTitle: chapterTitle,
        khandaNumber: null,
        khandaTitle: null,
      });
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
  const translations: VerseTranslation[] = [];
  const explanations: Explanation[] = [];

  const sanskritText = richTextToString(intro.SanskritTextEntry);
  if (sanskritText) {
    explanations.push({
      id: `${introId}-sa`,
      verseId: introId,
      authorName: grantha.BhashyamAuthor || "Sri Shankaracharya",
      authorTitle: grantha.BhashyamName || "Shankara Bhashyam",
      languageCode: "devanagari",
      content: sanskritText,
      isAiTranslated: false,
    });
  }

  const englishText = richTextToString(intro.EnglishTranslationText);
  if (englishText) {
    explanations.push({
      id: `${introId}-en`,
      verseId: introId,
      authorName: grantha.BhashyamAuthor || "Sri Shankaracharya",
      authorTitle: grantha.BhashyamName || "Shankara Bhashyam",
      languageCode: "english",
      content: englishText,
      isAiTranslated: false,
    });
  }

  const otherText = richTextToString(intro.OtherLanguagesTranslation);
  if (otherText && intro.LanguageOfTranslation) {
    explanations.push({
      id: `${introId}-other`,
      verseId: introId,
      authorName: grantha.BhashyamAuthor || "Sri Shankaracharya",
      authorTitle: grantha.BhashyamName || "Shankara Bhashyam",
      languageCode: intro.LanguageOfTranslation.toLowerCase(),
      content: otherText,
      isAiTranslated: false,
    });
  }

  return {
    id: introId,
    bookId,
    verseNumber: 0,
    sectionTitle: "Introduction",
    adhyayNumber: null,
    adhyayTitle: null,
    khandaNumber: null,
    khandaTitle: null,
    translations,
    explanations,
  };
}

export async function strapiGetVerseById(verseId: string): Promise<VerseWithTranslations | undefined> {
  if (verseId.endsWith("-intro")) {
    const bookId = verseId.replace("-intro", "");
    const book = await strapiGetBookById(bookId);
    return book?.verses.find((v) => v.id === verseId);
  }

  try {
    const result = await strapiFetch<StrapiResponse<any>>(`/chapters/${verseId}`, {
      "populate": "*",
    });
    if (!result.data) return undefined;

    const ch = result.data;
    const granthaRef = ch.grantha;
    const bookId = granthaRef?.documentId || granthaRef?.id || "";
    ch.grantha = granthaRef;
    return mapChapterToVerse(ch, String(bookId), ch.order ?? 0);
  } catch {
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

    const authorMap = new Map<string, { authorTitle: string | null; languageCodes: Set<string> }>();
    const languageSet = new Set<string>();

    for (const verse of book.verses) {
      for (const exp of verse.explanations) {
        languageSet.add(exp.languageCode);
        if (!authorMap.has(exp.authorName)) {
          authorMap.set(exp.authorName, { authorTitle: exp.authorTitle, languageCodes: new Set([exp.languageCode]) });
        } else {
          authorMap.get(exp.authorName)!.languageCodes.add(exp.languageCode);
        }
      }
    }

    const authors: CommentaryOption[] = Array.from(authorMap.entries()).map(([name, data]) => ({
      authorName: name,
      authorTitle: data.authorTitle,
      languageCodes: Array.from(data.languageCodes),
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
    const granthas = await strapiFetchAll("/granthas", { "fields": "BhashyamAuthor" });
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
