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
  const jsonBody = JSON.stringify(body);
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body: jsonBody,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const err = new Error(`Strapi PUT error: ${response.status} ${response.statusText} for ${endpoint}: ${text.substring(0, 200)}`);
    (err as any).statusCode = response.status;
    (err as any).payloadSize = jsonBody.length;
    throw err;
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

async function refetchManthra(docId: string): Promise<any> {
  const result = await strapiFetchJSON<any>(`/manthras/${docId}`, {
    "populate[0]": "ShlokaManthraEntry.OtherTranslations",
    "populate[1]": "BhashyamEntry.OtherTranslations",
    "populate[2]": "Teekas.teeka",
    "populate[3]": "Teekas.TeekaEntry",
    "populate[4]": "Teekas.TeekaEntry.OtherTranslations",
  });
  return result.data;
}

function cleanEntry(entry: any): any {
  if (!entry) return null;
  const clean = { ...entry };
  delete clean.id;
  return clean;
}

function cleanOTs(ots: any[]): any[] {
  return (ots || []).map((ot: any) => ({
    LanguageOfTranslation: ot.LanguageOfTranslation,
    TranslationText: ot.TranslationText,
  }));
}

function cleanTeekas(teekas: any[]): any[] {
  return (teekas || []).map((t: any) => {
    const clean: any = {};
    if (t.teeka?.documentId) clean.teeka = t.teeka.documentId;
    if (t.TeekaEntry) {
      clean.TeekaEntry = cleanEntry(t.TeekaEntry);
      if (clean.TeekaEntry?.OtherTranslations) {
        clean.TeekaEntry.OtherTranslations = cleanOTs(clean.TeekaEntry.OtherTranslations);
      }
    }
    return clean;
  });
}

function buildFullManthraData(fresh: any, overrides: {
  shlokaEntry?: any;
  bhashyamEntry?: any;
  teekas?: any[];
}): any {
  const shloka = overrides.shlokaEntry ?? cleanEntry(fresh.ShlokaManthraEntry);
  const bhashyam = overrides.bhashyamEntry ?? cleanEntry(fresh.BhashyamEntry);
  const teekas = overrides.teekas ?? cleanTeekas(fresh.Teekas);

  if (shloka?.OtherTranslations) shloka.OtherTranslations = cleanOTs(shloka.OtherTranslations);
  if (bhashyam?.OtherTranslations) bhashyam.OtherTranslations = cleanOTs(bhashyam.OtherTranslations);

  const data: any = {};
  if (shloka) data.ShlokaManthraEntry = shloka;
  if (bhashyam) data.BhashyamEntry = bhashyam;
  if (teekas && teekas.length > 0) data.Teekas = teekas;
  return data;
}

async function chunkedSaveOtherTranslations(
  docId: string,
  component: "shloka" | "bhashyam",
  entry: any
): Promise<{ saved: number; total: number }> {
  const allOTs: OtherTranslation[] = entry.OtherTranslations || [];
  const CHUNK_SIZE = 10;
  const field = component === "shloka" ? "ShlokaManthraEntry" : "BhashyamEntry";
  let lastSaved = 0;
  for (let i = 0; i < allOTs.length; i += CHUNK_SIZE) {
    const chunkEnd = Math.min(i + CHUNK_SIZE, allOTs.length);
    const partialEntry = { ...entry, OtherTranslations: allOTs.slice(0, chunkEnd) };
    try {
      await strapiPut(`/manthras/${docId}`, { data: { [field]: partialEntry } });
      lastSaved = chunkEnd;
      console.log(`[Translation] Chunked save ${component} ${chunkEnd}/${allOTs.length} for ${docId}`);
    } catch (chunkErr: any) {
      if ((chunkErr as any).statusCode === 413) {
        for (let j = i; j < chunkEnd; j++) {
          const singleEntry = { ...entry, OtherTranslations: allOTs.slice(0, j + 1) };
          try {
            await strapiPut(`/manthras/${docId}`, { data: { [field]: singleEntry } });
            lastSaved = j + 1;
            console.log(`[Translation] Single save ${component} ${j + 1}/${allOTs.length} for ${docId}`);
          } catch (singleErr: any) {
            if ((singleErr as any).statusCode === 413) {
              console.log(`[Translation] Hit nginx size limit at ${j + 1}/${allOTs.length} for ${component} ${docId}, saved ${lastSaved} translations`);
              return { saved: lastSaved, total: allOTs.length };
            }
            throw singleErr;
          }
        }
      } else {
        throw chunkErr;
      }
    }
  }
  return { saved: lastSaved, total: allOTs.length };
}

async function safeSaveShlokaOnly(
  docId: string,
  newTranslations: OtherTranslation[]
): Promise<boolean> {
  const fresh = await refetchManthra(docId);
  if (!fresh) throw new Error(`Could not refetch manthra ${docId}`);
  const entry = cleanEntry(fresh.ShlokaManthraEntry);
  if (!entry) return true;
  const existingLangs = new Set((entry.OtherTranslations || []).map((ot: any) => ot.LanguageOfTranslation));
  const toAdd = newTranslations.filter(ot => !existingLangs.has(ot.LanguageOfTranslation));
  entry.OtherTranslations = [
    ...cleanOTs(entry.OtherTranslations || []),
    ...toAdd.map(ot => ({ LanguageOfTranslation: ot.LanguageOfTranslation, TranslationText: ot.TranslationText })),
  ];
  try {
    const fullData = buildFullManthraData(fresh, { shlokaEntry: entry });
    await strapiPut(`/manthras/${docId}`, { data: fullData });
    return true;
  } catch (err: any) {
    if ((err as any).statusCode === 413) {
      console.log(`[Translation] 413 payload too large for full save, trying component-only save for shloka ${docId}`);
      try {
        await strapiPut(`/manthras/${docId}`, { data: { ShlokaManthraEntry: entry } });
        return true;
      } catch (err2: any) {
        if ((err2 as any).statusCode === 413) {
          console.log(`[Translation] 413 even for component-only shloka, trying chunked save for ${docId}`);
          const result = await chunkedSaveOtherTranslations(docId, "shloka", entry);
          if (result.saved < result.total) {
            console.log(`[Translation] Shloka ${docId} at nginx capacity (${result.saved}/${result.total}), skipping remaining languages`);
            return false;
          }
          return true;
        } else {
          throw err2;
        }
      }
    } else {
      throw err;
    }
  }
}

async function safeSaveBhashyamOnly(
  docId: string,
  newTranslations: OtherTranslation[]
): Promise<boolean> {
  const fresh = await refetchManthra(docId);
  if (!fresh) throw new Error(`Could not refetch manthra ${docId}`);
  const entry = cleanEntry(fresh.BhashyamEntry);
  if (!entry) return true;
  const existingLangs = new Set((entry.OtherTranslations || []).map((ot: any) => ot.LanguageOfTranslation));
  const toAdd = newTranslations.filter(ot => !existingLangs.has(ot.LanguageOfTranslation));
  entry.OtherTranslations = [
    ...cleanOTs(entry.OtherTranslations || []),
    ...toAdd.map(ot => ({ LanguageOfTranslation: ot.LanguageOfTranslation, TranslationText: ot.TranslationText })),
  ];
  try {
    const fullData = buildFullManthraData(fresh, { bhashyamEntry: entry });
    await strapiPut(`/manthras/${docId}`, { data: fullData });
    return true;
  } catch (err: any) {
    if ((err as any).statusCode === 413) {
      console.log(`[Translation] 413 payload too large for full save, trying component-only save for bhashyam ${docId}`);
      try {
        await strapiPut(`/manthras/${docId}`, { data: { BhashyamEntry: entry } });
        return true;
      } catch (err2: any) {
        if ((err2 as any).statusCode === 413) {
          console.log(`[Translation] 413 even for component-only bhashyam, trying chunked save for ${docId}`);
          const result = await chunkedSaveOtherTranslations(docId, "bhashyam", entry);
          if (result.saved < result.total) {
            console.log(`[Translation] Bhashyam ${docId} at nginx capacity (${result.saved}/${result.total}), skipping remaining languages`);
            return false;
          }
          return true;
        } else {
          throw err2;
        }
      }
    } else {
      throw err;
    }
  }
}

async function safeSaveTeekaOnly(
  docId: string,
  teekaIndex: number,
  newTranslations: OtherTranslation[]
): Promise<boolean> {
  const fresh = await refetchManthra(docId);
  if (!fresh) throw new Error(`Could not refetch manthra ${docId}`);
  const freshTeekas = cleanTeekas(fresh.Teekas);
  if (!freshTeekas[teekaIndex]?.TeekaEntry) return true;
  const entry = freshTeekas[teekaIndex].TeekaEntry;
  const existingLangs = new Set((entry.OtherTranslations || []).map((ot: any) => ot.LanguageOfTranslation));
  const toAdd = newTranslations.filter(ot => !existingLangs.has(ot.LanguageOfTranslation));
  entry.OtherTranslations = [
    ...cleanOTs(entry.OtherTranslations || []),
    ...toAdd.map(ot => ({ LanguageOfTranslation: ot.LanguageOfTranslation, TranslationText: ot.TranslationText })),
  ];
  freshTeekas[teekaIndex].TeekaEntry = entry;
  try {
    const fullData = buildFullManthraData(fresh, { teekas: freshTeekas });
    await strapiPut(`/manthras/${docId}`, { data: fullData });
    return true;
  } catch (err: any) {
    if ((err as any).statusCode === 413) {
      console.log(`[Translation] 413 payload too large for full save, trying component-only save for teeka ${docId}`);
      try {
        await strapiPut(`/manthras/${docId}`, { data: { Teekas: freshTeekas } });
        return true;
      } catch (err2: any) {
        if ((err2 as any).statusCode === 413) {
          console.log(`[Translation] 413 even for component-only teeka, trying chunked save for ${docId}`);
          const allOTs: OtherTranslation[] = entry.OtherTranslations || [];
          const CHUNK_SIZE = 10;
          let lastSaved = 0;
          for (let i = 0; i < allOTs.length; i += CHUNK_SIZE) {
            const chunkEnd = Math.min(i + CHUNK_SIZE, allOTs.length);
            const partialEntry = { ...entry, OtherTranslations: allOTs.slice(0, chunkEnd) };
            freshTeekas[teekaIndex].TeekaEntry = partialEntry;
            try {
              await strapiPut(`/manthras/${docId}`, { data: { Teekas: freshTeekas } });
              lastSaved = chunkEnd;
              console.log(`[Translation] Chunked save teeka ${chunkEnd}/${allOTs.length} for ${docId}`);
            } catch (chunkErr: any) {
              if ((chunkErr as any).statusCode === 413) {
                for (let j = i; j < chunkEnd; j++) {
                  const singleEntry = { ...entry, OtherTranslations: allOTs.slice(0, j + 1) };
                  freshTeekas[teekaIndex].TeekaEntry = singleEntry;
                  try {
                    await strapiPut(`/manthras/${docId}`, { data: { Teekas: freshTeekas } });
                    lastSaved = j + 1;
                    console.log(`[Translation] Single save teeka ${j + 1}/${allOTs.length} for ${docId}`);
                  } catch (singleErr: any) {
                    if ((singleErr as any).statusCode === 413) {
                      console.log(`[Translation] Hit nginx size limit at ${j + 1}/${allOTs.length} for teeka ${docId}, saved ${lastSaved} translations`);
                      return false;
                    }
                    throw singleErr;
                  }
                }
              } else {
                throw chunkErr;
              }
            }
          }
          return lastSaved >= allOTs.length;
        }
        throw err2;
      }
    }
    throw err;
  }
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

  const BATCH_SIZE = 1;

  let shlokaAdded = 0;
  let shlokaAtCapacity = false;
  {
    const existingShlokaLangs = getExistingLanguages(manthra.ShlokaManthraEntry?.OtherTranslations || []);
    let pendingBatch: OtherTranslation[] = [];
    for (const lang of targetLanguages) {
      if (shlokaAtCapacity) break;
      progress.currentLanguage = lang;
      if (existingShlokaLangs.has(lang)) { progress.skippedExisting++; continue; }
      if (!sourceForShloka) continue;
      try {
        const translated = await retryWithBackoff(() => translateTextChunked(sourceForShloka, lang, shlokaEnglish ? "English" : "Sanskrit"));
        pendingBatch.push({ LanguageOfTranslation: lang, TranslationText: stringToRichText(translated) });
        existingShlokaLangs.add(lang);
        shlokaAdded++;
        if (pendingBatch.length >= BATCH_SIZE) {
          const ok = await safeSaveShlokaOnly(manthra.documentId, pendingBatch);
          console.log(`[Translation]   Shloka batch save (${shlokaAdded}) for ${manthra.ShlokaManthraNumber}`);
          pendingBatch = [];
          if (!ok) { shlokaAtCapacity = true; progress.errors.push(`Shloka ${manthra.ShlokaManthraNumber}: nginx size limit reached, some languages skipped`); }
        }
      } catch (err: any) { progress.errors.push(`Shloka ${manthra.ShlokaManthraNumber} → ${lang}: ${err.message}`); }
      await delay(1500);
    }
    if (pendingBatch.length > 0 && !shlokaAtCapacity) {
      const ok = await safeSaveShlokaOnly(manthra.documentId, pendingBatch);
      console.log(`[Translation]   Shloka final save (${shlokaAdded}) for ${manthra.ShlokaManthraNumber}`);
      if (!ok) { progress.errors.push(`Shloka ${manthra.ShlokaManthraNumber}: nginx size limit reached, some languages skipped`); }
    }
  }

  let bhashyamAdded = 0;
  let bhashyamAtCapacity = false;
  {
    const existingBhashyamLangs = getExistingLanguages(manthra.BhashyamEntry?.OtherTranslations || []);
    let pendingBatch: OtherTranslation[] = [];
    for (const lang of targetLanguages) {
      if (bhashyamAtCapacity) break;
      progress.currentLanguage = lang;
      if (existingBhashyamLangs.has(lang)) { progress.skippedExisting++; continue; }
      if (!sourceForBhashyam) continue;
      try {
        const translated = await retryWithBackoff(() => translateTextChunked(sourceForBhashyam, lang, bhashyamEnglish ? "English" : "Sanskrit"));
        pendingBatch.push({ LanguageOfTranslation: lang, TranslationText: stringToRichText(translated) });
        existingBhashyamLangs.add(lang);
        bhashyamAdded++;
        if (pendingBatch.length >= BATCH_SIZE) {
          const ok = await safeSaveBhashyamOnly(manthra.documentId, pendingBatch);
          console.log(`[Translation]   Bhashyam batch save (${bhashyamAdded}) for ${manthra.ShlokaManthraNumber}`);
          pendingBatch = [];
          if (!ok) { bhashyamAtCapacity = true; progress.errors.push(`Bhashyam ${manthra.ShlokaManthraNumber}: nginx size limit reached, some languages skipped`); }
        }
      } catch (err: any) { progress.errors.push(`Bhashyam ${manthra.ShlokaManthraNumber} → ${lang}: ${err.message}`); }
      await delay(1500);
    }
    if (pendingBatch.length > 0 && !bhashyamAtCapacity) {
      const ok = await safeSaveBhashyamOnly(manthra.documentId, pendingBatch);
      console.log(`[Translation]   Bhashyam final save (${bhashyamAdded}) for ${manthra.ShlokaManthraNumber}`);
      if (!ok) { progress.errors.push(`Bhashyam ${manthra.ShlokaManthraNumber}: nginx size limit reached, some languages skipped`); }
    }
  }

  let teekaAdded = 0;
  const teekas = manthra.Teekas || [];
  for (let ti = 0; ti < teekas.length; ti++) {
    const teeka = teekas[ti];
    const teekaEntry = teeka.TeekaEntry;
    if (!teekaEntry) continue;
    const teekaName = teeka.teeka?.TeekaName || `Teeka ${ti + 1}`;
    const teekaEnglish = richTextToString(teekaEntry.EnglishTranslationText);
    const teekaSanskrit = richTextToString(teekaEntry.SanskritTextEntry);
    const sourceForTeeka = teekaEnglish || teekaSanskrit;
    const existingLangs = getExistingLanguages(teekaEntry.OtherTranslations || []);
    let pendingBatch: OtherTranslation[] = [];
    let batchAdded = 0;
    let teekaAtCapacity = false;
    for (const lang of targetLanguages) {
      if (teekaAtCapacity) break;
      progress.currentLanguage = lang;
      if (existingLangs.has(lang)) { progress.skippedExisting++; continue; }
      if (!sourceForTeeka) continue;
      try {
        const translated = await retryWithBackoff(() => translateTextChunked(sourceForTeeka, lang, teekaEnglish ? "English" : "Sanskrit"));
        pendingBatch.push({ LanguageOfTranslation: lang, TranslationText: stringToRichText(translated) });
        existingLangs.add(lang);
        batchAdded++;
        teekaAdded++;
        if (pendingBatch.length >= BATCH_SIZE) {
          const ok = await safeSaveTeekaOnly(manthra.documentId, ti, pendingBatch);
          console.log(`[Translation]   Teeka batch save (${batchAdded}) for ${manthra.ShlokaManthraNumber}`);
          pendingBatch = [];
          if (!ok) { teekaAtCapacity = true; progress.errors.push(`${teekaName} ${manthra.ShlokaManthraNumber}: nginx size limit reached, remaining languages skipped`); }
        }
      } catch (err: any) { progress.errors.push(`${teekaName} ${manthra.ShlokaManthraNumber} → ${lang}: ${err.message}`); }
      await delay(1500);
    }
    if (pendingBatch.length > 0 && !teekaAtCapacity) {
      const ok = await safeSaveTeekaOnly(manthra.documentId, ti, pendingBatch);
      console.log(`[Translation]   Teeka final save (${batchAdded}) for ${manthra.ShlokaManthraNumber}`);
      if (!ok) { progress.errors.push(`${teekaName} ${manthra.ShlokaManthraNumber}: nginx size limit reached on final save`); }
    }
  }

  return { shlokaAdded, bhashyamAdded, teekaAdded };
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

async function safeRefetchIntro(granthaDocId: string): Promise<any> {
  const res = await strapiFetchJSON<any>(`/granthas/${granthaDocId}`, {
    "populate[0]": "BhashyakaraIntroduction",
    "populate[1]": "BhashyakaraIntroduction.OtherTranslations",
  });
  return res.data?.BhashyakaraIntroduction;
}

async function safeSaveIntro(
  granthaDocId: string,
  newTranslations: OtherTranslation[]
): Promise<void> {
  const freshIntro = await safeRefetchIntro(granthaDocId);
  if (!freshIntro) return;
  const entry: any = { ...freshIntro };
  delete entry.id;
  const existingLangs = new Set((entry.OtherTranslations || []).map((ot: any) => ot.LanguageOfTranslation));
  const toAdd = newTranslations.filter(ot => !existingLangs.has(ot.LanguageOfTranslation));
  entry.OtherTranslations = [
    ...cleanOTs(entry.OtherTranslations || []),
    ...toAdd.map(ot => ({ LanguageOfTranslation: ot.LanguageOfTranslation, TranslationText: ot.TranslationText })),
  ];
  await strapiPut(`/granthas/${granthaDocId}`, { data: { BhashyakaraIntroduction: entry } });
}

async function translateIntroduction(
  granthaDocId: string,
  targetLanguages: string[],
  progress: TranslationProgress
): Promise<number> {
  const intro = await safeRefetchIntro(granthaDocId);
  if (!intro) return 0;

  const english = richTextToString(intro.EnglishTranslationText);
  const sanskrit = richTextToString(intro.SanskritTextEntry);
  const source = english || sanskrit;
  if (!source) return 0;

  progress.currentManthra = "Introduction";
  console.log(`[Translation] Processing Introduction`);

  const existingLangs = getExistingLanguages(intro.OtherTranslations || []);
  let added = 0;
  const BATCH_SIZE = 1;
  let pendingBatch: OtherTranslation[] = [];

  for (const lang of targetLanguages) {
    progress.currentLanguage = lang;
    if (existingLangs.has(lang)) {
      progress.skippedExisting++;
      continue;
    }
    if (!source) continue;
    try {
      const translated = await retryWithBackoff(() => translateTextChunked(source, lang, english ? "English" : "Sanskrit"));
      pendingBatch.push({ LanguageOfTranslation: lang, TranslationText: stringToRichText(translated) });
      existingLangs.add(lang);
      added++;

      if (pendingBatch.length >= BATCH_SIZE) {
        await safeSaveIntro(granthaDocId, pendingBatch);
        console.log(`[Translation]   Intro batch save (${added} total)`);
        pendingBatch = [];
      }
    } catch (err: any) {
      progress.errors.push(`Introduction → ${lang}: ${err.message}`);
    }
    await delay(1500);
  }

  if (pendingBatch.length > 0) {
    await safeSaveIntro(granthaDocId, pendingBatch);
    console.log(`[Translation]   Intro final save (${added} total)`);
  } else if (added === 0) {
    console.log(`[Translation]   Introduction already translated (skipped)`);
  }

  return added;
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
        if (cancelledJobs.has(granthaDocId)) {
          console.log(`[Translation] Job cancelled for "${granthaName}" at manthra ${i + 1}/${manthras.length}`);
          progress.status = "cancelled" as any;
          progress.completedAt = new Date().toISOString();
          cancelledJobs.delete(granthaDocId);
          return;
        }
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

const cancelledJobs = new Set<string>();
const translationQueue: { granthaDocId: string; targetLanguages?: string[] }[] = [];
let queueRunning = false;
let currentlyRunningId: string | null = null;

const QUEUE_FILE = ".local/translation-queue.json";

function saveQueueToFile() {
  try {
    const state = {
      queue: translationQueue.map(j => ({ granthaDocId: j.granthaDocId, targetLanguages: j.targetLanguages })),
      running: currentlyRunningId ? { granthaDocId: currentlyRunningId } : null,
      savedAt: new Date().toISOString(),
    };
    import("fs").then(fs => {
      import("path").then(path => {
        const dir = path.dirname(QUEUE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(state, null, 2));
      });
    });
  } catch (e: any) {
    console.error("[Translation] Failed to save queue file:", e.message);
  }
}

function clearQueueFile() {
  try {
    import("fs").then(fs => {
      if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE);
    });
  } catch {}
}

export async function restoreQueueFromFile() {
  try {
    const fs = await import("fs");
    if (!fs.existsSync(QUEUE_FILE)) return;
    const state = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
    const jobs: { granthaDocId: string; targetLanguages?: string[] }[] = [];
    if (state.running?.granthaDocId) {
      jobs.push({ granthaDocId: state.running.granthaDocId });
    }
    for (const j of (state.queue || [])) {
      if (!jobs.some(x => x.granthaDocId === j.granthaDocId)) {
        jobs.push({ granthaDocId: j.granthaDocId, targetLanguages: j.targetLanguages });
      }
    }
    if (jobs.length > 0) {
      console.log(`[Translation] Restoring ${jobs.length} job(s) from saved queue: ${jobs.map(j => j.granthaDocId).join(", ")}`);
      for (const j of jobs) {
        translationQueue.push(j);
      }
      processQueue();
    } else {
      clearQueueFile();
    }
  } catch (e: any) {
    console.error("[Translation] Failed to restore queue:", e.message);
  }
}

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (translationQueue.length > 0) {
    const job = translationQueue.shift()!;
    currentlyRunningId = job.granthaDocId;
    saveQueueToFile();
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
    currentlyRunningId = null;
  }
  queueRunning = false;
  currentlyRunningId = null;
  clearQueueFile();
}

export function queueTranslationJob(granthaDocId: string, targetLanguages?: string[]) {
  translationQueue.push({ granthaDocId, targetLanguages });
  console.log(`[Translation] Queued "${granthaDocId}" (queue size: ${translationQueue.length})`);
  saveQueueToFile();
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

export function cancelTranslationJob(granthaDocId: string): boolean {
  const progress = progressMap.get(granthaDocId);
  if (progress && progress.status === "running") {
    cancelledJobs.add(granthaDocId);
    const idx = translationQueue.findIndex(j => j.granthaDocId === granthaDocId);
    if (idx >= 0) translationQueue.splice(idx, 1);
    console.log(`[Translation] Cancel requested for "${progress.granthaName}"`);
    return true;
  }
  const idx = translationQueue.findIndex(j => j.granthaDocId === granthaDocId);
  if (idx >= 0) {
    translationQueue.splice(idx, 1);
    console.log(`[Translation] Removed "${granthaDocId}" from queue`);
    return true;
  }
  return false;
}

export async function fetchAllGranthaIds(): Promise<{ documentId: string; name: string }[]> {
  const results: { documentId: string; name: string }[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const url = `${STRAPI_URL}/api/granthas?pagination[page]=${page}&pagination[pageSize]=${pageSize}&fields[0]=GranthaName`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch granthas: ${res.status}`);
    const json = await res.json();
    const data = json.data || [];
    for (const g of data) {
      results.push({ documentId: g.documentId, name: g.GranthaName || g.documentId });
    }
    const pagination = json.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) break;
    page++;
  }
  return results;
}

export async function queueAllGranthas(): Promise<{ queued: string[]; total: number }> {
  const granthas = await fetchAllGranthaIds();
  const queued: string[] = [];
  for (const g of granthas) {
    queueTranslationJob(g.documentId);
    queued.push(g.documentId);
  }
  console.log(`[Translation] Queued ALL ${queued.length} granthas for translation`);
  return { queued, total: queued.length };
}

export { STRAPI_LANGUAGES, SKIP_TRANSLATE };
