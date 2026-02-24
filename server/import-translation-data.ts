import { db } from "./db";
import { verses, verseTranslations, explanations, books, languages } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface BookExport {
  vt: Record<string, Record<string, string>>;
  exp: Record<string, Record<string, string>>;
}

const BATCH_INSERT_SIZE = 100;

async function ensureLanguageExists(code: string) {
  const existing = await db.select().from(languages).where(eq(languages.code, code));
  if (existing.length > 0) return;

  const LANG_META: Record<string, { name: string; nativeName: string; script: string }> = {
    hi: { name: "Hindi", nativeName: "हिन्दी", script: "Devanagari" },
    kn: { name: "Kannada", nativeName: "Kannada", script: "Kannada" },
    te: { name: "Telugu", nativeName: "Telugu", script: "Telugu" },
    ta: { name: "Tamil", nativeName: "Tamil", script: "Tamil" },
    de: { name: "German", nativeName: "Deutsch", script: "Latin" },
    fr: { name: "French", nativeName: "Français", script: "Latin" },
    es: { name: "Spanish", nativeName: "Español", script: "Latin" },
    zh: { name: "Mandarin Chinese", nativeName: "中文", script: "Simplified Chinese" },
    ar: { name: "Arabic", nativeName: "العربية", script: "Arabic" },
    pt: { name: "Portuguese", nativeName: "Português", script: "Latin" },
    ru: { name: "Russian", nativeName: "Русский", script: "Cyrillic" },
    id: { name: "Indonesian", nativeName: "Bahasa Indonesia", script: "Latin" },
    ja: { name: "Japanese", nativeName: "日本語", script: "Japanese" },
    pcm: { name: "Nigerian Pidgin", nativeName: "Naijá", script: "Latin" },
    arz: { name: "Egyptian Arabic", nativeName: "مصري", script: "Arabic" },
    vi: { name: "Vietnamese", nativeName: "Tiếng Việt", script: "Latin" },
    ha: { name: "Hausa", nativeName: "Hausa", script: "Latin" },
    tr: { name: "Turkish", nativeName: "Türkçe", script: "Latin" },
    ko: { name: "Korean", nativeName: "한국어", script: "Hangul" },
    th: { name: "Thai", nativeName: "ไทย", script: "Thai" },
    it: { name: "Italian", nativeName: "Italiano", script: "Latin" },
    si: { name: "Sinhalese", nativeName: "සිංහල", script: "Sinhala" },
    uk: { name: "Ukrainian", nativeName: "Українська", script: "Cyrillic" },
    fa: { name: "Persian", nativeName: "فارسی", script: "Persian" },
    ku: { name: "Kurdish", nativeName: "Kurdî", script: "Latin" },
    az: { name: "Azerbaijani", nativeName: "Azərbaycan", script: "Latin" },
    mn: { name: "Mongolian", nativeName: "Монгол", script: "Cyrillic" },
    bo: { name: "Tibetan", nativeName: "བོད་སྐད", script: "Tibetan" },
    my: { name: "Burmese", nativeName: "မြန်မာ", script: "Myanmar" },
    ms: { name: "Malay", nativeName: "Bahasa Melayu", script: "Latin" },
    gu: { name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati" },
    bho: { name: "Bhojpuri", nativeName: "भोजपुरी", script: "Devanagari" },
    as: { name: "Assamese", nativeName: "অসমীয়া", script: "Bengali" },
    ks: { name: "Kashmiri", nativeName: "कॉशुर", script: "Devanagari" },
    mr: { name: "Marathi", nativeName: "मराठी", script: "Devanagari" },
    kok: { name: "Konkani", nativeName: "कोंकणी", script: "Devanagari" },
    ml: { name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam" },
    pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi" },
    bn: { name: "Bengali", nativeName: "বাংলা", script: "Bengali" },
    mni: { name: "Manipuri", nativeName: "মণিপুরী", script: "Bengali" },
    ne: { name: "Nepali", nativeName: "नेपाली", script: "Devanagari" },
    ur: { name: "Urdu", nativeName: "اردو", script: "Nastaliq" },
    or: { name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia" },
    sd: { name: "Sindhi", nativeName: "سنڌي", script: "Arabic" },
    pl: { name: "Polish", nativeName: "Polish", script: "Latin" },
    nl: { name: "Dutch", nativeName: "Dutch", script: "Latin" },
    sv: { name: "Swedish", nativeName: "Swedish", script: "Latin" },
    el: { name: "Greek", nativeName: "Greek", script: "Greek" },
    sw: { name: "Swahili", nativeName: "Swahili", script: "Latin" },
    am: { name: "Amharic", nativeName: "Amharic", script: "Ge'ez" },
    he: { name: "Hebrew", nativeName: "Hebrew", script: "Hebrew" },
  };

  const meta = LANG_META[code];
  if (meta) {
    try {
      await db.insert(languages).values({
        code,
        name: meta.name,
        nativeName: meta.nativeName,
        script: meta.script,
      });
    } catch (err: any) {
      if (!err.message?.includes("duplicate")) {
        console.error(`[Import] Failed to create language ${code}: ${err.message}`);
      }
    }
  }
}

async function importBookData(bookSlug: string, data: BookExport) {
  const bookRows = await db.select().from(books).where(eq(books.slug, bookSlug));
  if (bookRows.length === 0) {
    console.log(`[Import] Book ${bookSlug} not found, skipping`);
    return { vtInserted: 0, expInserted: 0 };
  }
  const bookId = bookRows[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  const verseNumberToId = new Map<number, string>();
  for (const v of allVerses) {
    verseNumberToId.set(v.verseNumber, v.id);
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

  let vtInserted = 0;
  let expInserted = 0;

  const allLangCodes = new Set<string>();
  for (const verseNumStr of Object.keys(data.vt)) {
    for (const langCode of Object.keys(data.vt[verseNumStr])) {
      allLangCodes.add(langCode);
    }
  }
  for (const verseNumStr of Object.keys(data.exp)) {
    for (const key of Object.keys(data.exp[verseNumStr])) {
      const langCode = key.split("|")[0];
      allLangCodes.add(langCode);
    }
  }
  for (const code of Array.from(allLangCodes)) {
    await ensureLanguageExists(code);
  }

  const vtBatch: Array<{ verseId: string; languageCode: string; content: string; isAiTranslated: boolean }> = [];

  for (const [verseNumStr, langMap] of Object.entries(data.vt)) {
    const verseNum = parseInt(verseNumStr, 10);
    const verseId = verseNumberToId.get(verseNum);
    if (!verseId) continue;

    for (const [langCode, content] of Object.entries(langMap)) {
      if (vtKeys.has(`${verseId}-${langCode}`)) continue;
      vtBatch.push({
        verseId,
        languageCode: langCode,
        content,
        isAiTranslated: true,
      });
    }
  }

  for (let i = 0; i < vtBatch.length; i += BATCH_INSERT_SIZE) {
    const batch = vtBatch.slice(i, i + BATCH_INSERT_SIZE);
    try {
      await db.insert(verseTranslations).values(batch).onConflictDoNothing();
      vtInserted += batch.length;
    } catch (err: any) {
      for (const item of batch) {
        try {
          await db.insert(verseTranslations).values(item).onConflictDoNothing();
          vtInserted++;
        } catch (innerErr: any) {
          if (!innerErr.message?.includes("duplicate")) {
            console.error(`[Import] VT insert error: ${innerErr.message}`);
          }
        }
      }
    }
  }

  const expBatch: Array<{ verseId: string; languageCode: string; authorName: string; content: string; isAiTranslated: boolean }> = [];

  for (const [verseNumStr, keyMap] of Object.entries(data.exp)) {
    const verseNum = parseInt(verseNumStr, 10);
    const verseId = verseNumberToId.get(verseNum);
    if (!verseId) continue;

    for (const [key, content] of Object.entries(keyMap)) {
      const parts = key.split("|");
      const langCode = parts[0];
      const authorName = parts.slice(1).join("|");
      if (expKeys.has(`${verseId}-${langCode}-${authorName}`)) continue;
      expBatch.push({
        verseId,
        languageCode: langCode,
        authorName,
        content,
        isAiTranslated: true,
      });
    }
  }

  for (let i = 0; i < expBatch.length; i += BATCH_INSERT_SIZE) {
    const batch = expBatch.slice(i, i + BATCH_INSERT_SIZE);
    try {
      await db.insert(explanations).values(batch).onConflictDoNothing();
      expInserted += batch.length;
    } catch (err: any) {
      for (const item of batch) {
        try {
          await db.insert(explanations).values(item).onConflictDoNothing();
          expInserted++;
        } catch (innerErr: any) {
          if (!innerErr.message?.includes("duplicate")) {
            console.error(`[Import] Exp insert error: ${innerErr.message}`);
          }
        }
      }
    }
  }

  return { vtInserted, expInserted };
}

export async function importTranslationDataFromFiles() {
  const dataDir = path.join(process.cwd(), "data", "translation-exports");
  if (!fs.existsSync(dataDir)) {
    console.log("[Import] No translation export data directory found, skipping import");
    return;
  }

  const bookSlugs = [
    "isha-upanishad-bhashya",
    "katha-upanishad-bhashya",
    "bhagavad-gita",
  ];

  let totalVT = 0;
  let totalExp = 0;

  for (const slug of bookSlugs) {
    const filePath = path.join(dataDir, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`[Import] No export file for ${slug}, skipping`);
      continue;
    }

    console.log(`[Import] Loading ${slug}...`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: BookExport = JSON.parse(raw);

    const result = await importBookData(slug, data);
    totalVT += result.vtInserted;
    totalExp += result.expInserted;
    console.log(`[Import] ${slug}: inserted ${result.vtInserted} VTs, ${result.expInserted} explanations`);
  }

  if (totalVT === 0 && totalExp === 0) {
    console.log("[Import] All translation data already exists, nothing new to import");
  } else {
    console.log(`[Import] Complete: ${totalVT} VTs + ${totalExp} explanations imported`);
  }
}
