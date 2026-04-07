import Sanscript from "@indic-transliteration/sanscript";

const STRAPI_URL = process.env.STRAPI_URL || "";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

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

function stringToRichText(text: string): RichTextBlock[] {
  return text.split("\n").map((line) => ({
    type: "paragraph",
    children: [{ text: line, type: "text" }],
  }));
}

const LANGUAGE_TO_SCHEME: Record<string, string> = {
  Hindi: "devanagari",
  Kannada: "kannada",
  Telugu: "telugu",
  Tamil: "tamil",
  Malayalam: "malayalam",
  Gujarati: "gujarati",
  Bengali: "bengali",
  Marathi: "devanagari",
  Odia: "oriya",
  Punjabi: "gurmukhi",
  Assamese: "assamese",
  Konkani: "devanagari",
  Sinhala: "sinhala",
  Burmese: "burmese",
  Thai: "thai",
  Tibetan: "tibetan",
  English: "iast",
  German: "iast",
  French: "iast",
  Spanish: "iast",
  Portuguese: "iast",
  Italian: "iast",
  Dutch: "iast",
  Russian: "cyrillic",
  Ukrainian: "cyrillic",
  Greek: "iast",
  Polish: "iast",
  Czech: "iast",
  Romanian: "iast",
  Hungarian: "iast",
  Turkish: "iast",
  Persian: "iast",
  Arabic: "iast",
  Hebrew: "iast",
  Japanese: "iast",
  Korean: "iast",
  Vietnamese: "iast",
  Indonesian: "iast",
  Malay: "iast",
  Mongolian: "cyrillic",
  Amharic: "iast",
  Swahili: "iast",
  Mandarin: "iast",
  Egyptian_Arabic: "iast",
};

const NATIVE_SCRIPT_LANGUAGES = new Set([
  "Kannada", "Telugu", "Tamil", "Malayalam", "Gujarati", "Bengali",
  "Odia", "Punjabi", "Assamese", "Sinhala", "Burmese", "Thai", "Tibetan",
]);

const SKIP_LANGUAGES = new Set(["Sanskrit"]);

const ALL_LANGUAGES = Object.keys(LANGUAGE_TO_SCHEME);

async function strapiFetchJSON<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${STRAPI_API_TOKEN}`,
  };
  const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Strapi GET error: ${response.status} for ${endpoint}`);
  }
  return response.json();
}

async function strapiPut(endpoint: string, body: any): Promise<any> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${STRAPI_API_TOKEN}`,
  };
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Strapi PUT error: ${response.status} for ${endpoint}: ${text.substring(0, 300)}`);
  }
  return response.json();
}

async function strapiFetchAllPages<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const result = await strapiFetchJSON<any>(endpoint, {
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

function transliterateText(devanagariText: string, targetScheme: string): string {
  if (targetScheme === "devanagari") return devanagariText;
  try {
    return Sanscript.t(devanagariText, "devanagari", targetScheme);
  } catch (e) {
    console.error(`[Translit] Failed to transliterate to ${targetScheme}:`, (e as Error).message);
    return "";
  }
}

interface TransliterationProgress {
  granthaId: string;
  granthaName: string;
  status: "queued" | "running" | "done" | "error";
  total: number;
  completed: number;
  currentVerse: string;
  errors: string[];
  startedAt: number;
  savedCount: number;
  skippedCount: number;
}

const progressMap = new Map<string, TransliterationProgress>();
const transliterationQueue: string[] = [];
let isProcessing = false;

async function fetchAllManthrasForGrantha(granthaDocId: string): Promise<any[]> {
  const sections = await strapiFetchAllPages("/sections", {
    "filters[grantha][documentId]": granthaDocId,
    "populate[0]": "manthras",
    "populate[1]": "parent",
    "populate[2]": "sub_sections",
  });

  const leafSectionIds = new Set<string>();
  for (const s of sections) {
    const hasSubSections = s.sub_sections && s.sub_sections.length > 0;
    if (!hasSubSections && s.manthras && s.manthras.length > 0) {
      leafSectionIds.add(s.documentId);
    }
  }

  const allManthras: any[] = [];
  for (const sectionDocId of leafSectionIds) {
    const manthras = await strapiFetchAllPages("/manthras", {
      "filters[Section][documentId]": sectionDocId,
      "populate[0]": "ShlokaManthraEntry",
      "sort": "order",
    });
    allManthras.push(...manthras);
  }

  allManthras.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return allManthras;
}

async function transliterateGrantha(granthaDocId: string): Promise<void> {
  const granthaResult = await strapiFetchJSON<any>(`/granthas/${granthaDocId}`, {
    "fields[0]": "GranthaName",
  });
  const granthaName = granthaResult.data?.GranthaName || granthaDocId;

  const progress: TransliterationProgress = {
    granthaId: granthaDocId,
    granthaName,
    status: "running",
    total: 0,
    completed: 0,
    currentVerse: "",
    errors: [],
    startedAt: Date.now(),
    savedCount: 0,
    skippedCount: 0,
  };
  progressMap.set(granthaDocId, progress);

  try {
    console.log(`[Translit] Fetching manthras for ${granthaName}...`);
    const manthras = await fetchAllManthrasForGrantha(granthaDocId);
    progress.total = manthras.length;
    console.log(`[Translit] Found ${manthras.length} manthras for ${granthaName}`);

    if (manthras.length === 0) {
      progress.status = "done";
      return;
    }

    for (let i = 0; i < manthras.length; i++) {
      const manthra = manthras[i];
      const sanskritText = richTextToString(manthra.ShlokaManthraEntry?.SanskritTextEntry);

      if (!sanskritText) {
        console.log(`[Translit] Skipping manthra ${manthra.ShlokaManthraNumber} - no Sanskrit text`);
        progress.completed++;
        progress.skippedCount++;
        continue;
      }

      progress.currentVerse = manthra.ShlokaManthraNumber || `verse ${i + 1}`;
      console.log(`[Translit] Processing ${progress.currentVerse} (${i + 1}/${manthras.length})`);

      try {
        let needsSave = false;
        const updateSME: any = { ...manthra.ShlokaManthraEntry };

        const existingIast = richTextToString(manthra.ShlokaManthraEntry?.IASTTransliteration);
        if (!existingIast) {
          const iast = transliterateText(sanskritText, "iast");
          if (iast) {
            updateSME.IASTTransliteration = stringToRichText(iast);
            needsSave = true;
          }
        }

        const refetchResult = await strapiFetchJSON<any>(`/manthras/${manthra.documentId}`, {
          "populate[0]": "ShlokaManthraEntry.OtherTranslations",
        });
        const currentOTs: any[] = refetchResult.data?.ShlokaManthraEntry?.OtherTranslations || [];

        const existingLangTexts = new Map<string, Set<string>>();
        for (const ot of currentOTs) {
          const lang = ot.LanguageOfTranslation;
          if (!existingLangTexts.has(lang)) existingLangTexts.set(lang, new Set());
          const text = richTextToString(ot.TranslationText);
          existingLangTexts.get(lang)!.add(text);
        }

        const cleanOTs = currentOTs.map((ot: any) => ({
          TranslationText: ot.TranslationText,
          LanguageOfTranslation: ot.LanguageOfTranslation,
          isAiTranslated: ot.isAiTranslated,
        }));

        let addedTranslits = 0;
        for (const lang of NATIVE_SCRIPT_LANGUAGES) {
          const scheme = LANGUAGE_TO_SCHEME[lang];
          if (!scheme || scheme === "devanagari") continue;

          const transliterated = transliterateText(sanskritText, scheme);
          if (!transliterated || transliterated === sanskritText) continue;

          const existingTexts = existingLangTexts.get(lang);
          if (existingTexts && existingTexts.has(transliterated)) continue;

          cleanOTs.push({
            TranslationText: stringToRichText(transliterated),
            LanguageOfTranslation: lang,
            isAiTranslated: false,
          });
          addedTranslits++;
        }

        if (addedTranslits > 0) {
          updateSME.OtherTranslations = cleanOTs;
          needsSave = true;
        } else {
          delete updateSME.OtherTranslations;
        }

        if (needsSave) {
          const freshResult = await strapiFetchJSON<any>(`/manthras/${manthra.documentId}`, {
            "populate[0]": "BhashyamEntry.OtherTranslations",
            "populate[1]": "Teekas.teeka",
            "populate[2]": "Teekas.TeekaEntry",
            "populate[3]": "Teekas.TeekaEntry.OtherTranslations",
          });
          const freshData = freshResult.data;
          const updateData: any = { ShlokaManthraEntry: updateSME };
          if (freshData?.BhashyamEntry) {
            const bEntry = { ...freshData.BhashyamEntry };
            delete bEntry.id;
            updateData.BhashyamEntry = bEntry;
          }
          if (freshData?.Teekas && freshData.Teekas.length > 0) {
            updateData.Teekas = freshData.Teekas.map((t: any) => {
              const clean: any = {};
              if (t.teeka?.documentId) clean.teeka = t.teeka.documentId;
              if (t.TeekaEntry) {
                const entry = { ...t.TeekaEntry };
                delete entry.id;
                if (entry.OtherTranslations) {
                  entry.OtherTranslations = entry.OtherTranslations.map((ot: any) => ({
                    LanguageOfTranslation: ot.LanguageOfTranslation,
                    TranslationText: ot.TranslationText,
                  }));
                }
                clean.TeekaEntry = entry;
              }
              return clean;
            });
          }
          await strapiPut(`/manthras/${manthra.documentId}`, { data: updateData });
          console.log(`[Translit] Saved ${progress.currentVerse}: IAST=${!existingIast ? 'new' : 'exists'}, scripts=${addedTranslits}`);
          progress.savedCount++;
        } else {
          console.log(`[Translit] ${progress.currentVerse}: all transliterations already exist`);
          progress.skippedCount++;
        }
      } catch (e) {
        const errMsg = `Failed to save ${progress.currentVerse}: ${(e as Error).message}`;
        console.error(`[Translit] ${errMsg}`);
        progress.errors.push(errMsg);
      }

      progress.completed++;

      if (i < manthras.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    progress.status = "done";
    console.log(`[Translit] Completed ${granthaName}: ${progress.savedCount} saved, ${progress.skippedCount} skipped, ${progress.errors.length} errors`);
  } catch (e) {
    progress.status = "error";
    progress.errors.push((e as Error).message);
    console.error(`[Translit] Fatal error for ${granthaName}:`, (e as Error).message);
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (transliterationQueue.length > 0) {
    const granthaId = transliterationQueue.shift()!;
    try {
      await transliterateGrantha(granthaId);
    } catch (e) {
      console.error(`[Translit] Queue error for ${granthaId}:`, (e as Error).message);
    }
  }

  isProcessing = false;
}

export function queueTransliteration(granthaIds: string[]): { queued: string[]; existing: string[] } {
  const queued: string[] = [];
  const existing: string[] = [];

  for (const id of granthaIds) {
    const progress = progressMap.get(id);
    if (progress && (progress.status === "running" || progress.status === "queued")) {
      existing.push(id);
      continue;
    }

    progressMap.set(id, {
      granthaId: id,
      granthaName: id,
      status: "queued",
      total: 0,
      completed: 0,
      currentVerse: "",
      errors: [],
      startedAt: Date.now(),
      savedCount: 0,
      skippedCount: 0,
    });
    transliterationQueue.push(id);
    queued.push(id);
  }

  if (queued.length > 0) {
    processQueue().catch(e => console.error("[Translit] Queue processing error:", e));
  }

  return { queued, existing };
}

export function getTransliterationProgress(): Record<string, TransliterationProgress> {
  const result: Record<string, TransliterationProgress> = {};
  for (const [key, value] of progressMap) {
    result[key] = { ...value };
  }
  return result;
}

export function transliterateSanskrit(devanagariText: string, targetLanguage: string): string | null {
  const scheme = LANGUAGE_TO_SCHEME[targetLanguage];
  if (!scheme || scheme === "devanagari") return null;
  const result = transliterateText(devanagariText, scheme);
  return result && result !== devanagariText ? result : null;
}

export { ALL_LANGUAGES, LANGUAGE_TO_SCHEME, SKIP_LANGUAGES };
