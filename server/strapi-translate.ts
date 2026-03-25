import { translateTextChunked } from "./gemini";

const STRAPI_URL = process.env.STRAPI_URL || "";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

const STRAPI_LANGUAGES = [
  "Sanskrit", "Hindi", "English", "Kannada", "Telugu", "Tamil", "Malayalam",
  "Gujarati", "Bengali", "Marathi", "Odia", "Punjabi", "Assamese", "Konkani",
  "Sinhala", "German", "French", "Spanish", "Portuguese", "Italian", "Dutch",
  "Russian", "Ukrainian", "Greek", "Polish", "Czech", "Romanian", "Hungarian",
  "Turkish", "Persian", "Arabic", "Hebrew", "Japanese", "Korean", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Burmese", "Tibetan", "Mongolian",
  "Amharic", "Swahili", "Mandarin", "Egyptian_Arabic",
];

const SKIP_TRANSLATE = new Set(["Sanskrit", "English"]);

interface RichTextBlock {
  type: string;
  children: { text: string; type: string }[];
}

interface OtherTranslation {
  LanguageOfTranslation: string;
  TranslationText: RichTextBlock[];
}

interface TranslationProgress {
  granthaId: string;
  granthaName: string;
  status: "idle" | "running" | "completed" | "error";
  totalManthras: number;
  processedManthras: number;
  currentManthra: string;
  currentLanguage: string;
  errors: string[];
  startedAt: string | null;
  completedAt: string | null;
  skippedExisting: number;
}

const progressMap = new Map<string, TranslationProgress>();

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
    throw new Error(`Strapi GET error: ${response.status} ${response.statusText} for ${endpoint}`);
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
    throw new Error(`Strapi PUT error: ${response.status} ${response.statusText} for ${endpoint}: ${text.substring(0, 200)}`);
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
      "populate[0]": "ShlokaManthraEntry.OtherTranslations",
      "populate[1]": "BhashyamEntry.OtherTranslations",
      "populate[2]": "Teekas.teeka",
      "populate[3]": "Teekas.TeekaEntry",
      "populate[4]": "Teekas.TeekaEntry.OtherTranslations",
      "sort": "order",
    });
    allManthras.push(...manthras);
  }

  allManthras.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return allManthras;
}

function getExistingLanguages(otherTranslations: OtherTranslation[] | null | undefined): Set<string> {
  const existing = new Set<string>();
  if (!otherTranslations || !Array.isArray(otherTranslations)) return existing;
  for (const ot of otherTranslations) {
    if (ot.LanguageOfTranslation && richTextToString(ot.TranslationText).length > 0) {
      existing.add(ot.LanguageOfTranslation);
    }
  }
  return existing;
}

function getMissingLanguages(existingLangs: Set<string>): string[] {
  return STRAPI_LANGUAGES.filter(l => !SKIP_TRANSLATE.has(l) && !existingLangs.has(l));
}

async function translateComponent(
  source: string,
  sourceLang: string,
  existingOTs: OtherTranslation[],
  targetLanguages: string[],
  label: string,
  progress: TranslationProgress
): Promise<{ newOTs: OtherTranslation[]; added: number }> {
  const existingLangs = getExistingLanguages(existingOTs);
  const newOTs = [...existingOTs];
  let added = 0;

  for (const lang of targetLanguages) {
    progress.currentLanguage = lang;
    if (existingLangs.has(lang)) {
      progress.skippedExisting++;
      continue;
    }
    if (!source) continue;
    try {
      const translated = await retryWithBackoff(() => translateTextChunked(source, lang, sourceLang));
      newOTs.push({
        LanguageOfTranslation: lang,
        TranslationText: stringToRichText(translated),
      });
      added++;
    } catch (err: any) {
      progress.errors.push(`${label} → ${lang}: ${err.message}`);
    }
    await delay(1500);
  }
  return { newOTs, added };
}

async function translateAndStoreManthra(
  manthra: any,
  targetLanguages: string[],
  progress: TranslationProgress
): Promise<{ shlokaAdded: number; bhashyamAdded: number; teekaAdded: number }> {
  const shlokaEnglish = richTextToString(manthra.ShlokaManthraEntry?.EnglishTranslationText);
  const shlokaText = richTextToString(manthra.ShlokaManthraEntry?.SanskritTextEntry);
  const bhashyamEnglish = richTextToString(manthra.BhashyamEntry?.EnglishTranslationText);
  const bhashyamSanskrit = richTextToString(manthra.BhashyamEntry?.SanskritTextEntry);

  const sourceForShloka = shlokaEnglish || shlokaText;
  const sourceForBhashyam = bhashyamEnglish || bhashyamSanskrit;

  const shlokaResult = await translateComponent(
    sourceForShloka, shlokaEnglish ? "English" : "Sanskrit",
    manthra.ShlokaManthraEntry?.OtherTranslations || [],
    targetLanguages, `Shloka ${manthra.ShlokaManthraNumber}`, progress
  );

  const bhashyamResult = await translateComponent(
    sourceForBhashyam, bhashyamEnglish ? "English" : "Sanskrit",
    manthra.BhashyamEntry?.OtherTranslations || [],
    targetLanguages, `Bhashyam ${manthra.ShlokaManthraNumber}`, progress
  );

  let teekaAdded = 0;
  const teekas = manthra.Teekas || [];
  const updatedTeekas: any[] = [];

  for (let ti = 0; ti < teekas.length; ti++) {
    const teeka = teekas[ti];
    const teekaEntry = teeka.TeekaEntry;
    if (!teekaEntry) {
      updatedTeekas.push(teeka);
      continue;
    }

    const teekaName = teeka.teeka?.TeekaName || `Teeka ${ti + 1}`;
    const teekaEnglish = richTextToString(teekaEntry.EnglishTranslationText);
    const teekaSanskrit = richTextToString(teekaEntry.SanskritTextEntry);
    const sourceForTeeka = teekaEnglish || teekaSanskrit;

    const teekaResult = await translateComponent(
      sourceForTeeka, teekaEnglish ? "English" : "Sanskrit",
      teekaEntry.OtherTranslations || [],
      targetLanguages, `${teekaName} ${manthra.ShlokaManthraNumber}`, progress
    );

    teekaAdded += teekaResult.added;

    if (teekaResult.added > 0) {
      const updatedEntry = { ...teekaEntry };
      delete updatedEntry.id;
      updatedEntry.OtherTranslations = teekaResult.newOTs.map(ot => ({
        LanguageOfTranslation: ot.LanguageOfTranslation,
        TranslationText: ot.TranslationText,
      }));
      const updatedTeeka: any = { TeekaEntry: updatedEntry };
      if (teeka.teeka?.documentId) {
        updatedTeeka.teeka = teeka.teeka.documentId;
      }
      updatedTeekas.push(updatedTeeka);
    } else {
      updatedTeekas.push(teeka);
    }
  }

  const needsUpdate = shlokaResult.added > 0 || bhashyamResult.added > 0 || teekaAdded > 0;

  if (needsUpdate) {
    const updateBody: any = { data: {} };

    if (shlokaResult.added > 0 && manthra.ShlokaManthraEntry) {
      const entry = { ...manthra.ShlokaManthraEntry };
      delete entry.id;
      entry.OtherTranslations = shlokaResult.newOTs.map(ot => ({
        LanguageOfTranslation: ot.LanguageOfTranslation,
        TranslationText: ot.TranslationText,
      }));
      updateBody.data.ShlokaManthraEntry = entry;
    }

    if (bhashyamResult.added > 0 && manthra.BhashyamEntry) {
      const entry = { ...manthra.BhashyamEntry };
      delete entry.id;
      entry.OtherTranslations = bhashyamResult.newOTs.map(ot => ({
        LanguageOfTranslation: ot.LanguageOfTranslation,
        TranslationText: ot.TranslationText,
      }));
      updateBody.data.BhashyamEntry = entry;
    }

    if (teekaAdded > 0) {
      updateBody.data.Teekas = updatedTeekas.map(t => {
        if (t.TeekaEntry && t.teeka) {
          return { teeka: t.teeka, TeekaEntry: t.TeekaEntry };
        }
        const clean: any = {};
        if (t.teeka?.documentId) clean.teeka = t.teeka.documentId;
        if (t.TeekaEntry) {
          const entry = { ...t.TeekaEntry };
          delete entry.id;
          clean.TeekaEntry = entry;
        }
        return clean;
      });
    }

    await strapiPut(`/manthras/${manthra.documentId}`, updateBody);
  }

  return { shlokaAdded: shlokaResult.added, bhashyamAdded: bhashyamResult.added, teekaAdded };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err.message?.includes("429") || err.message?.includes("Resource exhausted");
      if (is429 && attempt < maxRetries) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[Translation] Rate limited, waiting ${waitMs / 1000}s before retry ${attempt + 1}/${maxRetries}`);
        await delay(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

async function translateIntroduction(
  granthaDocId: string,
  targetLanguages: string[],
  progress: TranslationProgress
): Promise<number> {
  const granthaRes = await strapiFetchJSON<any>(`/granthas/${granthaDocId}`, {
    "populate[0]": "BhashyakaraIntroduction",
    "populate[1]": "BhashyakaraIntroduction.OtherTranslations",
  });
  const intro = granthaRes.data?.BhashyakaraIntroduction;
  if (!intro) return 0;

  const english = richTextToString(intro.EnglishTranslationText);
  const sanskrit = richTextToString(intro.SanskritTextEntry);
  const source = english || sanskrit;
  if (!source) return 0;

  progress.currentManthra = "Introduction";
  console.log(`[Translation] Processing Introduction`);

  const result = await translateComponent(
    source, english ? "English" : "Sanskrit",
    intro.OtherTranslations || [],
    targetLanguages, "Introduction", progress
  );

  if (result.added > 0) {
    const entry: any = { ...intro };
    delete entry.id;
    entry.OtherTranslations = result.newOTs.map(ot => ({
      LanguageOfTranslation: ot.LanguageOfTranslation,
      TranslationText: ot.TranslationText,
    }));
    await strapiPut(`/granthas/${granthaDocId}`, { data: { BhashyakaraIntroduction: entry } });
    console.log(`[Translation]   Added ${result.added} introduction translations`);
  } else {
    console.log(`[Translation]   Introduction already translated (skipped)`);
  }

  return result.added;
}

export async function startTranslationJob(granthaDocId: string, targetLanguages?: string[]): Promise<TranslationProgress> {
  const existing = progressMap.get(granthaDocId);
  if (existing && existing.status === "running") {
    return existing;
  }

  const granthaRes = await strapiFetchJSON<any>(`/granthas/${granthaDocId}`, {});
  const granthaName = granthaRes.data?.GranthaName || granthaDocId;

  const progress: TranslationProgress = {
    granthaId: granthaDocId,
    granthaName,
    status: "running",
    totalManthras: 0,
    processedManthras: 0,
    currentManthra: "",
    currentLanguage: "",
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    skippedExisting: 0,
  };
  progressMap.set(granthaDocId, progress);

  const langs = targetLanguages || getMissingLanguages(new Set());

  (async () => {
    try {
      console.log(`[Translation] Starting translation of "${granthaName}" into ${langs.length} languages`);

      await translateIntroduction(granthaDocId, langs, progress);

      const manthras = await fetchAllManthrasForGrantha(granthaDocId);
      progress.totalManthras = manthras.length;
      console.log(`[Translation] Found ${manthras.length} manthras`);

      for (let i = 0; i < manthras.length; i++) {
        const manthra = manthras[i];
        progress.currentManthra = manthra.ShlokaManthraNumber || `#${i + 1}`;
        progress.processedManthras = i;

        console.log(`[Translation] Processing manthra ${i + 1}/${manthras.length}: ${progress.currentManthra}`);
        const result = await translateAndStoreManthra(manthra, langs, progress);
        console.log(`[Translation]   Added ${result.shlokaAdded} shloka + ${result.bhashyamAdded} bhashyam + ${result.teekaAdded} teeka translations`);
      }

      progress.processedManthras = manthras.length;
      progress.status = "completed";
      progress.completedAt = new Date().toISOString();
      console.log(`[Translation] Completed "${granthaName}". Errors: ${progress.errors.length}, Skipped existing: ${progress.skippedExisting}`);
    } catch (err: any) {
      progress.status = "error";
      progress.errors.push(`Fatal: ${err.message}`);
      progress.completedAt = new Date().toISOString();
      console.error(`[Translation] Fatal error for "${granthaName}":`, err.message);
    }
  })();

  return progress;
}

const translationQueue: { granthaDocId: string; targetLanguages?: string[] }[] = [];
let queueRunning = false;

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (translationQueue.length > 0) {
    const job = translationQueue.shift()!;
    const existing = progressMap.get(job.granthaDocId);
    if (existing && existing.status === "running") {
      while (progressMap.get(job.granthaDocId)?.status === "running") {
        await new Promise(r => setTimeout(r, 5000));
      }
      continue;
    }
    const progress = await startTranslationJob(job.granthaDocId, job.targetLanguages);
    while (progress.status === "running") {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  queueRunning = false;
}

export function queueTranslationJob(granthaDocId: string, targetLanguages?: string[]) {
  translationQueue.push({ granthaDocId, targetLanguages });
  console.log(`[Translation] Queued "${granthaDocId}" (queue size: ${translationQueue.length})`);
  processQueue();
}

export function getTranslationProgress(granthaDocId: string): TranslationProgress | null {
  return progressMap.get(granthaDocId) || null;
}

export function getAllTranslationJobs(): TranslationProgress[] {
  return Array.from(progressMap.values());
}

export function getQueueStatus(): { queue: string[]; running: string | null } {
  const running = Array.from(progressMap.entries()).find(([_, p]) => p.status === "running");
  return {
    queue: translationQueue.map(j => j.granthaDocId),
    running: running ? running[0] : null,
  };
}

export { STRAPI_LANGUAGES, SKIP_TRANSLATE };
