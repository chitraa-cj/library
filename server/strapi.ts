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

const STRAPI_URL = process.env.STRAPI_URL || "";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

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

async function strapiFetch<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (STRAPI_API_TOKEN) {
    headers["Authorization"] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
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
    });
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
    });
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
        });
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
    const countManthras = (section: any): number => {
      const subs = section.sub_sections;
      if (Array.isArray(subs) && subs.length > 0) {
        let sum = 0;
        for (const sub of subs) {
          sum += countManthras(sub);
        }
        return sum;
      }
      return section.manthras?.length || 0;
    };
    for (const s of g.sections) {
      const sId = s.documentId || String(s.id);
      if (subSectionIds.has(sId)) continue;
      totalVerses += countManthras(s);
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
      signal: AbortSignal.timeout(10000),
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

export async function strapiGetAllBooks(): Promise<(Book & { bhashyamName?: string; teekasList?: { name: string; author: string }[] })[]> {
  const granthas = await strapiFetchAll("/granthas", {
    "populate[0]": "sections.manthras",
    "populate[1]": "sections.sub_sections.manthras",
    "populate[2]": "sections.sub_sections.sub_sections.manthras",
    "populate[3]": "coverImage",
    "populate[4]": "GranthaNameTranslations",
    "populate[5]": "teekas",
  });
  return granthas.map(mapGranthaToBook);
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
    "sort": "order",
  });
}

async function fetchManthrasForSection(sectionDocId: string): Promise<any[]> {
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
    "sort": "order",
  });
}

export async function strapiGetBookById(id: string): Promise<BookWithDetails | undefined> {
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
    let globalIndex = 0;

    const introVerse = mapIntroductionVerse(grantha, book.id);
    if (introVerse) {
      verses.push(introVerse);
      globalIndex++;
    }

    async function fetchVersesFromLeafSections(
      section: any,
      adhyayNum: number | null,
      adhyayTitle: string | null,
      khandaNum: number | null,
      khandaTitle: string | null,
    ) {
      const subs = (section.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      if (subs.length > 0) {
        for (const sub of subs) {
          await fetchVersesFromLeafSections(sub, adhyayNum, adhyayTitle, khandaNum || sub.order, khandaTitle || sub.title);
        }
      } else {
        const manthras = await fetchManthrasForSection(section.documentId);
        for (const m of manthras) {
          globalIndex++;
          verses.push(
            mapManthraToVerse(m, book.id, globalIndex, adhyayNum, adhyayTitle, khandaNum, khandaTitle, bhashyamAuthor, bhashyamName)
          );
        }
      }
    }

    for (const adhyay of sectionTree) {
      const adhyayNum = adhyay.order ?? null;
      const adhyayTitle = adhyay.title || null;

      const khandas = (adhyay.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      if (khandas.length > 0) {
        for (const khanda of khandas) {
          const khandaNum = khanda.order ?? null;
          const khandaTitle = khanda.title || null;
          await fetchVersesFromLeafSections(khanda, adhyayNum, adhyayTitle, khandaNum, khandaTitle);
        }
      } else {
        const manthras = await fetchManthrasForSection(adhyay.documentId);
        for (const m of manthras) {
          globalIndex++;
          verses.push(
            mapManthraToVerse(m, book.id, globalIndex, adhyayNum, adhyayTitle, null, null, bhashyamAuthor, bhashyamName)
          );
        }
      }
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
      "populate[0]": "sections",
      "populate[1]": "BhashyakaraIntroduction",
      "populate[2]": "GranthaNameTranslations",
      "populate[3]": "coverImage",
    });
    if (!result.data) return undefined;

    const grantha = result.data;
    const book = mapGranthaToBook(grantha);

    const allSections = await fetchSectionsForGrantha(grantha.documentId);
    const sectionTree = buildSectionTree(allSections);

    const verses: VerseMeta[] = [];
    let globalIndex = 0;

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
      });
    }

    function collectVersesFromLeafSections(
      section: any,
      adhyayNum: number | null,
      adhyayTitle: string | null,
      khandaNum: number | null,
      khandaTitle: string | null,
    ) {
      const subs = (section.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      if (subs.length > 0) {
        for (const sub of subs) {
          collectVersesFromLeafSections(sub, adhyayNum, adhyayTitle, khandaNum || sub.order, khandaTitle || sub.title);
        }
      } else {
        const manthraDocs = section.manthras || [];
        const sortedManthras = [...manthraDocs].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        for (const m of sortedManthras) {
          globalIndex++;
          verses.push({
            id: m.documentId || String(m.id),
            bookId: book.id,
            verseNumber: globalIndex,
            sectionTitle: m.ShlokaManthraNumber ? `Mantra ${m.ShlokaManthraNumber}` : `Mantra ${globalIndex}`,
            adhyayNumber: adhyayNum,
            adhyayTitle,
            khandaNumber: khandaNum,
            khandaTitle,
          });
        }
      }
    }

    for (const adhyay of sectionTree) {
      const adhyayNum = adhyay.order ?? null;
      const adhyayTitle = adhyay.title || null;

      const khandas = (adhyay.sub_sections || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      if (khandas.length > 0) {
        for (const khanda of khandas) {
          const khandaNum = khanda.order ?? null;
          const khandaTitle = khanda.title || null;
          collectVersesFromLeafSections(khanda, adhyayNum, adhyayTitle, khandaNum, khandaTitle);
        }
      } else {
        const manthraDocs = adhyay.manthras || [];
        const sortedManthras = [...manthraDocs].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        for (const m of sortedManthras) {
          globalIndex++;
          verses.push({
            id: m.documentId || String(m.id),
            bookId: book.id,
            verseNumber: globalIndex,
            sectionTitle: m.ShlokaManthraNumber ? `Mantra ${m.ShlokaManthraNumber}` : `Mantra ${globalIndex}`,
            adhyayNumber: adhyayNum,
            adhyayTitle,
            khandaNumber: null,
            khandaTitle: null,
          });
        }
      }
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
  if (verseId.endsWith("-intro")) {
    const bookId = verseId.replace("-intro", "");
    const book = await strapiGetBookById(bookId);
    return book?.verses.find((v) => v.id === verseId);
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

    return mapManthraToVerse(
      m, bookId, m.order ?? 0,
      adhyayNumber, adhyayTitle,
      khandaNumber, khandaTitle,
      bhashyamAuthor, bhashyamName,
    );
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
