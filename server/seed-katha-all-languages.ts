import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books, verseTranslations, languages } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const BATCH_SIZE = 10;
const DELAY_MS = 100;
const PARALLEL_LANGS = 3;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ALL_LANGS = [
  { code: "hi", name: "Hindi", script: "Devanagari" },
  { code: "kn", name: "Kannada", script: "Kannada" },
  { code: "te", name: "Telugu", script: "Telugu" },
  { code: "ta", name: "Tamil", script: "Tamil" },
  { code: "de", name: "German", script: "Latin" },
  { code: "fr", name: "French", script: "Latin" },
  { code: "es", name: "Spanish", script: "Latin" },
  { code: "zh", name: "Mandarin Chinese", script: "Simplified Chinese" },
  { code: "ar", name: "Arabic", script: "Arabic" },
  { code: "pt", name: "Portuguese", script: "Latin" },
  { code: "ru", name: "Russian", script: "Cyrillic" },
  { code: "id", name: "Indonesian", script: "Latin" },
  { code: "ja", name: "Japanese", script: "Japanese" },
  { code: "pcm", name: "Nigerian Pidgin", script: "Latin" },
  { code: "arz", name: "Egyptian Arabic", script: "Arabic" },
  { code: "vi", name: "Vietnamese", script: "Latin" },
  { code: "ha", name: "Hausa", script: "Latin" },
  { code: "tr", name: "Turkish", script: "Latin" },
  { code: "ko", name: "Korean", script: "Hangul" },
  { code: "th", name: "Thai", script: "Thai" },
  { code: "it", name: "Italian", script: "Latin" },
  { code: "si", name: "Sinhalese", script: "Sinhala" },
  { code: "uk", name: "Ukrainian", script: "Cyrillic" },
  { code: "fa", name: "Persian", script: "Persian" },
  { code: "ku", name: "Kurdish", script: "Latin" },
  { code: "az", name: "Azerbaijani", script: "Latin" },
  { code: "mn", name: "Mongolian", script: "Cyrillic" },
  { code: "bo", name: "Tibetan", script: "Tibetan" },
  { code: "my", name: "Burmese", script: "Myanmar" },
  { code: "ms", name: "Malay", script: "Latin" },
  { code: "gu", name: "Gujarati", script: "Gujarati" },
  { code: "bho", name: "Bhojpuri", script: "Devanagari" },
  { code: "as", name: "Assamese", script: "Bengali" },
  { code: "ks", name: "Kashmiri", script: "Devanagari" },
  { code: "mr", name: "Marathi", script: "Devanagari" },
  { code: "kok", name: "Konkani", script: "Devanagari" },
  { code: "ml", name: "Malayalam", script: "Malayalam" },
  { code: "pa", name: "Punjabi", script: "Gurmukhi" },
  { code: "bn", name: "Bengali", script: "Bengali" },
  { code: "mni", name: "Manipuri", script: "Bengali" },
  { code: "ne", name: "Nepali", script: "Devanagari" },
  { code: "ur", name: "Urdu", script: "Nastaliq" },
  { code: "or", name: "Odia", script: "Odia" },
  { code: "sd", name: "Sindhi", script: "Arabic" },
  { code: "pl", name: "Polish", script: "Latin" },
  { code: "nl", name: "Dutch", script: "Latin" },
  { code: "sv", name: "Swedish", script: "Latin" },
  { code: "el", name: "Greek", script: "Greek" },
  { code: "sw", name: "Swahili", script: "Latin" },
  { code: "am", name: "Amharic", script: "Ge'ez" },
  { code: "he", name: "Hebrew", script: "Hebrew" },
];

const NON_LATIN_SCRIPTS = new Set([
  "Devanagari", "Bengali", "Gujarati", "Malayalam", "Gurmukhi", "Odia",
  "Sinhala", "Thai", "Japanese", "Hangul", "Cyrillic", "Arabic", "Persian",
  "Nastaliq", "Tibetan", "Myanmar", "Simplified Chinese", "Kannada", "Telugu", "Tamil",
  "Greek", "Ge'ez", "Hebrew",
]);

function getScriptNote(lang: { name: string; script: string }): string {
  if (NON_LATIN_SCRIPTS.has(lang.script)) {
    return `Write in ${lang.script} script. Keep Sanskrit proper nouns in ${lang.script} script.`;
  }
  return "Keep Sanskrit proper nouns in IAST transliteration.";
}

function isRefusalResponse(text: string): boolean {
  const refusalPatterns = [
    /I'm sorry.*can't assist/i,
    /I'm sorry.*cannot assist/i,
    /I cannot.*translate/i,
    /I'm unable to.*translate/i,
    /I apologize.*cannot/i,
    /I can't help with/i,
    /cannot comply/i,
    /against.*policy/i,
    /safety.*guidelines/i,
    /not able to.*provide/i,
    /I'm not able to/i,
    /I cannot help/i,
    /I'm sorry.*can't help/i,
  ];
  return refusalPatterns.some(p => p.test(text));
}

function isValidTranslation(text: string, sourceLength: number): boolean {
  if (!text || text.trim().length === 0) return false;
  if (isRefusalResponse(text)) return false;
  if (text.trim().length < Math.min(20, sourceLength * 0.1)) return false;
  return true;
}

async function translateText(openai: OpenAI, prompt: string, maxTokens: number = 4096): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  const content = response.choices[0].message.content || "";
  if (isRefusalResponse(content)) {
    console.warn(`[Katha All] AI refusal detected, retrying...`);
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a scholarly translator specializing in Sanskrit philosophical texts. Translate the given text accurately." },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    });
    const retryContent = retryResponse.choices[0].message.content || "";
    if (isRefusalResponse(retryContent)) {
      console.warn(`[Katha All] AI refusal persisted on retry, returning empty`);
      return "";
    }
    return retryContent;
  }
  return content;
}

async function ensureLanguagesExist() {
  for (const lang of ALL_LANGS) {
    const existing = await db.select().from(languages).where(eq(languages.code, lang.code));
    if (existing.length === 0) {
      await db.insert(languages).values({
        code: lang.code,
        name: lang.name,
        nativeName: lang.name,
        script: lang.script,
      });
    }
  }
}

export async function seedKathaAllLanguages() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[Katha All] No OPENAI_API_KEY set, skipping");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const kathaBooks = await db.select().from(books).where(eq(books.slug, "katha-upanishad-bhashya"));
  if (kathaBooks.length === 0) {
    console.log("[Katha All] Book not found, skipping");
    return;
  }
  const bookId = kathaBooks[0].id;

  await ensureLanguagesExist();

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  if (allVerses.length === 0) {
    console.log("[Katha All] No verses found, skipping");
    return;
  }

  const existingVT = await db.select({
    verseId: verseTranslations.verseId,
    languageCode: verseTranslations.languageCode,
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const vtKeys = new Set(existingVT.map(e => `${e.verseId}-${e.languageCode}`));

  const existingExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
  }).from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const expKeys = new Set(existingExp.map(e => `${e.verseId}-${e.languageCode}-${e.authorName}`));

  const engTransMap = new Map<string, string>();
  const engExpMap = new Map<string, string>();

  const allEngTrans = await db.select().from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(and(eq(verses.bookId, bookId), eq(verseTranslations.languageCode, "en")));
  for (const row of allEngTrans) {
    engTransMap.set(row.verse_translations.verseId, row.verse_translations.content);
  }

  const allEngExp = await db.select().from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(and(eq(verses.bookId, bookId), eq(explanations.languageCode, "en"), eq(explanations.authorName, "Sri Shankaracharya")));
  for (const row of allEngExp) {
    engExpMap.set(row.explanations.verseId, row.explanations.content);
  }

  let vtNeeded = 0;
  let expNeeded = 0;

  for (const verse of allVerses) {
    for (const lang of ALL_LANGS) {
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) vtNeeded++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Sri Shankaracharya`)) expNeeded++;
    }
  }

  if (vtNeeded === 0 && expNeeded === 0) {
    console.log("[Katha All] All translations already exist, nothing to do");
    return;
  }

  console.log(`[Katha All] Found ${allVerses.length} verses, ${ALL_LANGS.length} languages to process`);
  console.log(`[Katha All] Need: ${vtNeeded} verse translations, ${expNeeded} bhashyam translations`);

  let totalCreated = 0;

  async function processKathaLang(lang: { code: string; name: string; script: string }) {
    const scriptNote = getScriptNote(lang);
    let langCreated = 0;

    let langVtNeeded = 0;
    let langExpNeeded = 0;
    for (const verse of allVerses) {
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) langVtNeeded++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Sri Shankaracharya`)) langExpNeeded++;
    }

    if (langVtNeeded === 0 && langExpNeeded === 0) {
      return 0;
    }

    console.log(`[Katha All] Starting ${lang.name} (${lang.code}): ${langVtNeeded} VT + ${langExpNeeded} bhashyam needed`);

    for (let i = 0; i < allVerses.length; i += BATCH_SIZE) {
      const batch = allVerses.slice(i, i + BATCH_SIZE);
      const promises: Promise<void>[] = [];

      for (const verse of batch) {
        const vtKey = `${verse.id}-${lang.code}`;
        if (!vtKeys.has(vtKey) && engTransMap.has(verse.id)) {
          const engContent = engTransMap.get(verse.id)!;
          const p = (async () => {
            try {
              const prompt = `You are an expert Sanskrit scholar. Translate this Katha Upanishad (Kaṭhopaniṣad) verse from English to ${lang.name}. ${scriptNote} Maintain scholarly register and philosophical precision.\n\nSOURCE:\n${engContent}\n\nProvide ONLY the ${lang.name} meaning translation (not transliteration).`;
              const translated = await translateText(openai, prompt, 2048);
              if (!isValidTranslation(translated, engContent.length)) {
                return;
              }
              await db.insert(verseTranslations).values({
                verseId: verse.id,
                languageCode: lang.code,
                content: translated.trim(),
                isAiTranslated: true,
              });
              vtKeys.add(vtKey);
              langCreated++;
            } catch (error: any) {
              if (!error.message?.includes("duplicate")) {
                console.error(`[Katha All] VT V${verse.verseNumber} → ${lang.name}: ${error.message}`);
              }
            }
          })();
          promises.push(p);
        }

        const expKey = `${verse.id}-${lang.code}-Sri Shankaracharya`;
        if (!expKeys.has(expKey) && engExpMap.has(verse.id)) {
          const engContent = engExpMap.get(verse.id)!;
          const p = (async () => {
            try {
              const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Sri Shankaracharya's Bhashya (commentary) on Katha Upanishad (Kaṭhopaniṣad) from English to ${lang.name}. ${scriptNote} Maintain philosophical precision and scholarly register.\n\nSOURCE:\n${engContent}\n\nProvide ONLY the ${lang.name} translation.`;
              const translated = await translateText(openai, prompt);
              if (!isValidTranslation(translated, engContent.length)) {
                return;
              }
              await db.insert(explanations).values({
                verseId: verse.id,
                languageCode: lang.code,
                authorName: "Sri Shankaracharya",
                content: translated.trim(),
                isAiTranslated: true,
              });
              expKeys.add(expKey);
              langCreated++;
            } catch (error: any) {
              if (!error.message?.includes("duplicate")) {
                console.error(`[Katha All] Exp V${verse.verseNumber} → ${lang.name}: ${error.message}`);
              }
            }
          })();
          promises.push(p);
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        await delay(DELAY_MS);
      }
    }

    console.log(`[Katha All] ${lang.name} done: ${langCreated} created`);
    return langCreated;
  }

  const langsToProcess = ALL_LANGS.filter(lang => {
    let needed = 0;
    for (const verse of allVerses) {
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) needed++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Sri Shankaracharya`)) needed++;
    }
    return needed > 0;
  });

  console.log(`[Katha All] ${langsToProcess.length} languages need processing, running ${PARALLEL_LANGS} in parallel`);

  for (let li = 0; li < langsToProcess.length; li += PARALLEL_LANGS) {
    const langBatch = langsToProcess.slice(li, li + PARALLEL_LANGS);
    const results = await Promise.all(langBatch.map(lang => processKathaLang(lang)));
    for (const r of results) totalCreated += r;
  }

  console.log(`[Katha All] Seeding complete: ${totalCreated} new translations/transliterations created`);
}
