import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books, languages, verseTranslations } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

const BATCH_SIZE = 5;
const DELAY_MS = 300;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const EUROPEAN_LANGS = [
  { code: "german", dbCode: "de", name: "German", nativeName: "Deutsch", script: "Latin" },
  { code: "french", dbCode: "fr", name: "French", nativeName: "Français", script: "Latin" },
  { code: "spanish", dbCode: "es", name: "Spanish", nativeName: "Español", script: "Latin" },
  { code: "mandarin", dbCode: "zh", name: "Mandarin Chinese", nativeName: "中文", script: "Simplified Chinese" },
  { code: "arabic", dbCode: "ar", name: "Arabic", nativeName: "العربية", script: "Arabic" },
];

const SOUTH_INDIAN_LANGS = [
  { code: "kannada", dbCode: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada" },
  { code: "telugu", dbCode: "te", name: "Telugu", nativeName: "తెలుగు", script: "Telugu" },
  { code: "tamil", dbCode: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Tamil" },
];

const NEW_LANGS = [
  { code: "pt", dbCode: "pt", name: "Portuguese", nativeName: "Português", script: "Latin" },
  { code: "ru", dbCode: "ru", name: "Russian", nativeName: "Русский", script: "Cyrillic" },
  { code: "id", dbCode: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", script: "Latin" },
  { code: "ja", dbCode: "ja", name: "Japanese", nativeName: "日本語", script: "Japanese" },
  { code: "pcm", dbCode: "pcm", name: "Nigerian Pidgin", nativeName: "Naijá", script: "Latin" },
  { code: "arz", dbCode: "arz", name: "Egyptian Arabic", nativeName: "مصري", script: "Arabic" },
  { code: "vi", dbCode: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", script: "Latin" },
  { code: "ha", dbCode: "ha", name: "Hausa", nativeName: "Hausa", script: "Latin" },
  { code: "tr", dbCode: "tr", name: "Turkish", nativeName: "Türkçe", script: "Latin" },
  { code: "ko", dbCode: "ko", name: "Korean", nativeName: "한국어", script: "Hangul" },
  { code: "th", dbCode: "th", name: "Thai", nativeName: "ไทย", script: "Thai" },
  { code: "it", dbCode: "it", name: "Italian", nativeName: "Italiano", script: "Latin" },
  { code: "si", dbCode: "si", name: "Sinhalese", nativeName: "සිංහල", script: "Sinhala" },
  { code: "uk", dbCode: "uk", name: "Ukrainian", nativeName: "Українська", script: "Cyrillic" },
  { code: "fa", dbCode: "fa", name: "Persian", nativeName: "فارسی", script: "Persian" },
  { code: "ku", dbCode: "ku", name: "Kurdish", nativeName: "Kurdî", script: "Latin" },
  { code: "az", dbCode: "az", name: "Azerbaijani", nativeName: "Azərbaycan", script: "Latin" },
  { code: "mn", dbCode: "mn", name: "Mongolian", nativeName: "Монгол", script: "Cyrillic" },
  { code: "bo", dbCode: "bo", name: "Tibetan", nativeName: "བོད་སྐད", script: "Tibetan" },
  { code: "my", dbCode: "my", name: "Burmese", nativeName: "မြန်မာ", script: "Myanmar" },
  { code: "ms", dbCode: "ms", name: "Malay", nativeName: "Bahasa Melayu", script: "Latin" },
  { code: "gu", dbCode: "gu", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati" },
  { code: "bho", dbCode: "bho", name: "Bhojpuri", nativeName: "भोजपुरी", script: "Devanagari" },
  { code: "as", dbCode: "as", name: "Assamese", nativeName: "অসমীয়া", script: "Bengali" },
  { code: "ks", dbCode: "ks", name: "Kashmiri", nativeName: "कॉशुर", script: "Devanagari" },
  { code: "mr", dbCode: "mr", name: "Marathi", nativeName: "मराठी", script: "Devanagari" },
  { code: "kok", dbCode: "kok", name: "Konkani", nativeName: "कोंकणी", script: "Devanagari" },
  { code: "ml", dbCode: "ml", name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam" },
  { code: "pa", dbCode: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi" },
  { code: "bn", dbCode: "bn", name: "Bengali", nativeName: "বাংলা", script: "Bengali" },
  { code: "mni", dbCode: "mni", name: "Manipuri", nativeName: "মণিপুরী", script: "Bengali" },
  { code: "ne", dbCode: "ne", name: "Nepali", nativeName: "नेपाली", script: "Devanagari" },
  { code: "ur", dbCode: "ur", name: "Urdu", nativeName: "اردو", script: "Nastaliq" },
  { code: "or", dbCode: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia" },
  { code: "sd", dbCode: "sd", name: "Sindhi", nativeName: "سنڌي", script: "Arabic" },
];

const SCRIPTS_NEEDING_TRANSLITERATION = new Set([
  "Kannada", "Telugu", "Tamil", "Bengali", "Gujarati", "Malayalam", "Gurmukhi", "Odia",
  "Sinhala", "Thai", "Japanese", "Hangul", "Cyrillic", "Arabic", "Persian", "Nastaliq",
  "Tibetan", "Myanmar", "Simplified Chinese",
]);

function needsTransliteration(script: string): boolean {
  return SCRIPTS_NEEDING_TRANSLITERATION.has(script);
}

async function getOpenAI(): Promise<OpenAI | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[European translations] No OPENAI_API_KEY set, skipping");
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function ensureLanguages() {
  for (const lang of EUROPEAN_LANGS) {
    const existing = await db.select().from(languages).where(eq(languages.code, lang.dbCode));
    if (existing.length === 0) {
      await db.insert(languages).values({
        code: lang.dbCode,
        name: lang.name,
        nativeName: lang.nativeName,
        script: lang.script,
      });
      console.log(`[European translations] Added language: ${lang.name} (${lang.dbCode})`);
    }
  }
  const hiLang = await db.select().from(languages).where(eq(languages.code, "hi"));
  if (hiLang.length === 0) {
    await db.insert(languages).values({ code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari" });
    console.log("[European translations] Added language: Hindi (hi)");
  }
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

async function translateText(openai: OpenAI, prompt: string, maxTokens: number = 4096): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  const content = response.choices[0].message.content || "";
  if (isRefusalResponse(content)) {
    console.warn(`[Isha All] AI refusal detected, retrying...`);
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a scholarly translator. Translate the given text accurately." },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    });
    const retryContent = retryResponse.choices[0].message.content || "";
    if (isRefusalResponse(retryContent)) {
      console.warn(`[Isha All] AI refusal persisted on retry, returning empty`);
      return "";
    }
    return retryContent;
  }
  return content;
}

export async function seedEuropeanTranslations() {
  const openai = await getOpenAI();
  if (!openai) return;

  await ensureLanguages();

  const gitaBooks = await db.select().from(books).where(eq(books.slug, "bhagavad-gita"));
  const ishaBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));

  let totalCreated = 0;

  if (ishaBooks.length > 0) {
    const ishaId = ishaBooks[0].id;
    const ishaCreated = await seedIshaEuropeanTranslations(openai, ishaId);
    totalCreated += ishaCreated;
  }

  if (gitaBooks.length > 0) {
    const gitaId = gitaBooks[0].id;
    const gitaCreated = await seedGitaEuropeanTranslations(openai, gitaId);
    totalCreated += gitaCreated;
  }

  if (totalCreated > 0) {
    console.log(`[European translations] Total new translations created: ${totalCreated}`);
  } else {
    console.log("[European translations] All translations already exist, nothing to do");
  }
}

async function seedGitaEuropeanTranslations(openai: OpenAI, bookId: string): Promise<number> {
  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  if (allVerses.length === 0) return 0;

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

  const gitaAllLangs = [...EUROPEAN_LANGS, ...SOUTH_INDIAN_LANGS];

  let vtNeeded = 0;
  let expNeeded = 0;
  for (const verse of allVerses) {
    for (const lang of gitaAllLangs) {
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) vtNeeded++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Sri Shankaracharya`)) expNeeded++;
    }
  }

  if (vtNeeded === 0 && expNeeded === 0) {
    console.log("[Gita European] All translations exist already");
    return 0;
  }

  console.log(`[Gita European] Need: ${vtNeeded} verse translations, ${expNeeded} commentaries`);

  let totalCreated = 0;

  for (let i = 0; i < allVerses.length; i += BATCH_SIZE) {
    const batch = allVerses.slice(i, i + BATCH_SIZE);
    const promises: Promise<void>[] = [];

    for (const verse of batch) {
      for (const lang of gitaAllLangs) {
        const vtKey = `${verse.id}-${lang.code}`;
        if (!vtKeys.has(vtKey)) {
          const p = (async () => {
            try {
              const engTrans = await db.select().from(verseTranslations).where(
                and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "en"))
              );
              if (engTrans.length === 0) return;

              const isSouthIndian = SOUTH_INDIAN_LANGS.some(si => si.code === lang.code);
              const scriptNote = isSouthIndian ? `Write in ${lang.script} script. Keep Sanskrit terms in ${lang.script} script.` : "Keep Sanskrit terms in IAST transliteration.";
              const prompt = `You are an expert Sanskrit scholar. Translate this Bhagavad Gita verse translation from English to ${lang.name}. ${scriptNote} Maintain scholarly register.\n\nSOURCE:\n${engTrans[0].content}\n\nProvide ONLY the ${lang.name} meaning translation (not transliteration).`;
              const translated = await translateText(openai, prompt, 2048);
              if (!translated || translated.trim().length < 10 || isRefusalResponse(translated)) {
                console.warn(`[Gita European] Skipping invalid VT for V${verse.verseNumber} → ${lang.name}`);
                return;
              }
              await db.insert(verseTranslations).values({
                verseId: verse.id,
                languageCode: lang.code,
                content: translated,
                isAiTranslated: true,
              });
              vtKeys.add(vtKey);
              totalCreated++;
            } catch (error: any) {
              console.error(`[Gita] VT V${verse.verseNumber} → ${lang.name}: ${error.message}`);
              await delay(3000);
            }
          })();
          promises.push(p);
        }

        const expKey = `${verse.id}-${lang.code}-Sri Shankaracharya`;
        if (!expKeys.has(expKey)) {
          const p = (async () => {
            try {
              const engExp = await db.select().from(explanations).where(
                and(
                  eq(explanations.verseId, verse.id),
                  eq(explanations.languageCode, "en"),
                  eq(explanations.authorName, "Sri Shankaracharya")
                )
              );
              if (engExp.length === 0) return;

              const src = engExp[0].content;
              const verseRef = `${verse.adhyayNumber || 1}.${verse.verseNumber}`;

              let translated: string;
              if (src.length < 100 && src.includes("did not comment")) {
                const notes: Record<string, string> = {
                  "German": `${verseRef} Sri Sankaracharya hat diesen Shloka nicht kommentiert. Der Kommentar beginnt ab 2.10.`,
                  "French": `${verseRef} Sri Sankaracharya n'a pas commenté ce shloka. Le commentaire commence à partir de 2.10.`,
                  "Spanish": `${verseRef} Sri Sankaracharya no comentó este shloka. El comentario comienza desde 2.10.`,
                  "Kannada": `${verseRef} ಶ್ರೀ ಶಂಕರಾಚಾರ್ಯರು ಈ ಶ್ಲೋಕಕ್ಕೆ ಭಾಷ್ಯ ಬರೆದಿಲ್ಲ. ಭಾಷ್ಯವು 2.10 ರಿಂದ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.`,
                  "Telugu": `${verseRef} శ్రీ శంకరాచార్యులు ఈ శ్లోకానికి భాష్యం రాయలేదు. భాష్యం 2.10 నుండి ప్రారంభమవుతుంది.`,
                  "Tamil": `${verseRef} ஸ்ரீ சங்கராச்சாரியார் இந்த ஸ்லோகத்திற்கு பாஷ்யம் எழுதவில்லை. பாஷ்யம் 2.10 முதல் தொடங்குகிறது.`,
                };
                translated = notes[lang.name] || src;
              } else {
                const isSouthIndian = SOUTH_INDIAN_LANGS.some(si => si.code === lang.code);
                const scriptNote = isSouthIndian ? `Write in ${lang.script} script. Keep Sanskrit terms in ${lang.script} script.` : "Keep Sanskrit terms in IAST transliteration.";
                const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Sri Shankaracharya commentary on Bhagavad Gita from English to ${lang.name}. ${scriptNote} Maintain philosophical precision.\n\nSOURCE:\n${src}\n\nProvide ONLY the ${lang.name} translation.`;
                translated = await translateText(openai, prompt);
              }

              if (!translated || translated.trim().length < 10 || isRefusalResponse(translated)) {
                console.warn(`[Gita European] Skipping invalid Exp for V${verse.verseNumber} → ${lang.name}`);
                return;
              }
              await db.insert(explanations).values({
                verseId: verse.id,
                languageCode: lang.code,
                authorName: "Sri Shankaracharya",
                content: translated,
                isAiTranslated: true,
              });
              expKeys.add(expKey);
              totalCreated++;
            } catch (error: any) {
              console.error(`[Gita] Exp V${verse.verseNumber} → ${lang.name}: ${error.message}`);
              await delay(3000);
            }
          })();
          promises.push(p);
        }
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      if ((i / BATCH_SIZE) % 20 === 0) {
        console.log(`[Gita European] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allVerses.length / BATCH_SIZE)}, created: ${totalCreated}`);
      }
      await delay(DELAY_MS);
    }
  }

  console.log(`[Gita European] Done: ${totalCreated} new translations`);
  return totalCreated;
}

async function seedIshaEuropeanTranslations(openai: OpenAI, bookId: string): Promise<number> {
  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  if (allVerses.length === 0) return 0;

  const existingExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
  }).from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const expKeys = new Set(existingExp.map(e => `${e.verseId}-${e.languageCode}-${e.authorName}`));

  const existingVT = await db.select({
    verseId: verseTranslations.verseId,
    languageCode: verseTranslations.languageCode,
    isAiTranslated: verseTranslations.isAiTranslated,
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const vtKeys = new Set(existingVT.map(e => `${e.verseId}-${e.languageCode}`));
  const vtAiKeys = new Set(existingVT.filter(e => e.isAiTranslated).map(e => `${e.verseId}-${e.languageCode}`));

  const allLangs = [
    ...EUROPEAN_LANGS,
    ...SOUTH_INDIAN_LANGS,
    ...NEW_LANGS,
    { code: "hi", dbCode: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari" },
  ];

  let needed = 0;
  for (const verse of allVerses) {
    for (const lang of allLangs) {
      if (!expKeys.has(`${verse.id}-${lang.code}-Adi Shankaracharya`)) needed++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Anandagiri`)) needed++;
      if (!vtAiKeys.has(`${verse.id}-${lang.code}`)) needed++;
      if (needsTransliteration(lang.script) && !vtKeys.has(`${verse.id}-${lang.code}`)) needed++;
    }
  }

  if (needed === 0) {
    console.log("[Isha All] All translations exist already");
    return 0;
  }

  console.log(`[Isha All] Need approximately ${needed} translations/transliterations`);

  let totalCreated = 0;

  for (const verse of allVerses) {
    const verseExps = await db.select().from(explanations).where(eq(explanations.verseId, verse.id));
    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");
    const devTeeka = verseExps.find(e => e.authorName === "Anandagiri" && e.languageCode === "devanagari");

    const devTrans = await db.select().from(verseTranslations).where(
      and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "devanagari"))
    );
    const devanagariContent = devTrans.length > 0 ? devTrans[0].content : "";

    for (const lang of allLangs) {
      const usesNativeScript = needsTransliteration(lang.script);
      const isDevanagariScript = lang.script === "Devanagari";
      const targetLangName = lang.name;

      const getScriptNote = (): string => {
        if (isDevanagariScript) return "Keep Sanskrit terms in Devanagari.";
        if (usesNativeScript) return `Write in ${lang.script} script. Keep Sanskrit terms in ${lang.script} script.`;
        return "Use IAST for Sanskrit terms.";
      };

      if (engBhashyam) {
        const bhashyamKey = `${verse.id}-${lang.code}-Adi Shankaracharya`;
        if (!expKeys.has(bhashyamKey)) {
          try {
            const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Shankaracharya's Bhashya on Isha Upanishad from English to ${targetLangName}. ${getScriptNote()} Maintain scholarly register.\n\nSOURCE:\n${engBhashyam.content}\n\nProvide ONLY the ${targetLangName} translation.`;
            const translated = await translateText(openai, prompt);
            await db.insert(explanations).values({
              verseId: verse.id,
              languageCode: lang.code,
              authorName: "Adi Shankaracharya",
              content: translated,
              isAiTranslated: true,
            });
            expKeys.add(bhashyamKey);
            totalCreated++;
          } catch (error: any) {
            console.error(`[Isha] Bhashyam V${verse.verseNumber} → ${targetLangName}: ${error.message}`);
            await delay(3000);
          }
        }
      }

      if (devTeeka) {
        const teekaKey = `${verse.id}-${lang.code}-Anandagiri`;
        if (!expKeys.has(teekaKey)) {
          try {
            const context = engBhashyam?.content?.substring(0, 300) || "";
            const prompt = `You are an expert Sanskrit scholar. Translate this Anandagiri's Tika (sub-commentary) on Isha Upanishad from Sanskrit to ${targetLangName}. ${getScriptNote()} Maintain scholarly register.\n\n${context ? `Context: ${context}\n\n` : ""}SOURCE:\n${devTeeka.content}\n\nProvide ONLY the ${targetLangName} translation.`;
            const translated = await translateText(openai, prompt);
            await db.insert(explanations).values({
              verseId: verse.id,
              languageCode: lang.code,
              authorName: "Anandagiri",
              content: translated,
              isAiTranslated: true,
            });
            expKeys.add(teekaKey);
            totalCreated++;
          } catch (error: any) {
            console.error(`[Isha] Teeka V${verse.verseNumber} → ${targetLangName}: ${error.message}`);
            await delay(3000);
          }
        }
      }

      const vtKey = `${verse.id}-${lang.code}`;
      if (!vtAiKeys.has(vtKey)) {
        try {
          const engTrans = await db.select().from(verseTranslations).where(
            and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "english"))
          );
          if (engTrans.length > 0) {
            const prompt = `You are an expert Sanskrit scholar. Translate this Isha Upanishad verse from English to ${targetLangName}. ${getScriptNote()} Maintain scholarly register.\n\nSOURCE:\n${engTrans[0].content}\n\nProvide ONLY the ${targetLangName} meaning translation (not transliteration).`;
            const translated = await translateText(openai, prompt, 2048);
            await db.insert(verseTranslations).values({
              verseId: verse.id,
              languageCode: lang.code,
              content: translated,
              isAiTranslated: true,
            });
            vtAiKeys.add(vtKey);
            totalCreated++;
          }
        } catch (error: any) {
          console.error(`[Isha] VT V${verse.verseNumber} → ${targetLangName}: ${error.message}`);
          await delay(3000);
        }
      }

      if (usesNativeScript && !isDevanagariScript && devanagariContent && !vtKeys.has(vtKey)) {
        try {
          const prompt = `You are an expert in Indian scripts and Sanskrit transliteration. Transliterate the following Sanskrit verse from Devanagari script to ${lang.script} script. Preserve the exact Sanskrit sounds, only change the script. Do NOT translate meaning — only change the script.\n\nDEVANAGARI:\n${devanagariContent}\n\nProvide ONLY the ${lang.script} script transliteration.`;
          const transliterated = await translateText(openai, prompt, 1024);
          await db.insert(verseTranslations).values({
            verseId: verse.id,
            languageCode: lang.code,
            content: transliterated,
            isAiTranslated: false,
          });
          vtKeys.add(vtKey);
          totalCreated++;
        } catch (error: any) {
          console.error(`[Isha] Translit V${verse.verseNumber} → ${lang.script}: ${error.message}`);
          await delay(3000);
        }
      }

      await delay(DELAY_MS);
    }
    console.log(`[Isha All] V${verse.verseNumber} done, total: ${totalCreated}`);
  }

  console.log(`[Isha All] Done: ${totalCreated} new translations`);
  return totalCreated;
}
