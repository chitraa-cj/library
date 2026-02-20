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
];

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

async function translateText(openai: OpenAI, prompt: string, maxTokens: number = 4096): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
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

  let vtNeeded = 0;
  let expNeeded = 0;
  for (const verse of allVerses) {
    for (const lang of EUROPEAN_LANGS) {
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
      for (const lang of EUROPEAN_LANGS) {
        const vtKey = `${verse.id}-${lang.code}`;
        if (!vtKeys.has(vtKey)) {
          const p = (async () => {
            try {
              const engTrans = await db.select().from(verseTranslations).where(
                and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "en"))
              );
              if (engTrans.length === 0) return;

              const prompt = `You are an expert Sanskrit scholar. Translate this Bhagavad Gita verse translation from English to ${lang.name}. Keep Sanskrit terms in IAST transliteration. Maintain scholarly register.\n\nSOURCE:\n${engTrans[0].content}\n\nProvide ONLY the ${lang.name} translation.`;
              const translated = await translateText(openai, prompt, 2048);
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
                };
                translated = notes[lang.name] || src;
              } else {
                const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Sri Shankaracharya commentary on Bhagavad Gita from English to ${lang.name}. Keep Sanskrit terms in IAST transliteration. Maintain philosophical precision.\n\nSOURCE:\n${src}\n\nProvide ONLY the ${lang.name} translation.`;
                translated = await translateText(openai, prompt);
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
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const vtKeys = new Set(existingVT.map(e => `${e.verseId}-${e.languageCode}`));

  const allLangs = [
    ...EUROPEAN_LANGS,
    { code: "hi", dbCode: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari" },
  ];

  let needed = 0;
  for (const verse of allVerses) {
    for (const lang of allLangs) {
      if (!expKeys.has(`${verse.id}-${lang.code}-Adi Shankaracharya`)) needed++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Anandagiri`)) needed++;
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) needed++;
    }
  }

  if (needed === 0) {
    console.log("[Isha European] All translations exist already");
    return 0;
  }

  console.log(`[Isha European] Need approximately ${needed} translations`);

  let totalCreated = 0;

  for (const verse of allVerses) {
    const verseExps = await db.select().from(explanations).where(eq(explanations.verseId, verse.id));
    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");
    const devTeeka = verseExps.find(e => e.authorName === "Anandagiri" && e.languageCode === "devanagari");

    for (const lang of allLangs) {
      const isHindi = lang.code === "hi";
      const targetLangName = lang.name;

      if (engBhashyam) {
        const bhashyamKey = `${verse.id}-${lang.code}-Adi Shankaracharya`;
        if (!expKeys.has(bhashyamKey)) {
          try {
            const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Shankaracharya's Bhashya on Isha Upanishad from English to ${targetLangName}. ${isHindi ? "Keep Sanskrit terms in Devanagari." : "Use IAST for Sanskrit terms."} Maintain scholarly register.\n\nSOURCE:\n${engBhashyam.content}\n\nProvide ONLY the ${targetLangName} translation.`;
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
            const prompt = `You are an expert Sanskrit scholar. Translate this Anandagiri's Tika (sub-commentary) on Isha Upanishad from Sanskrit to ${targetLangName}. ${isHindi ? "Keep Sanskrit terms in Devanagari." : "Use IAST for Sanskrit terms."} Maintain scholarly register.\n\n${context ? `Context: ${context}\n\n` : ""}SOURCE:\n${devTeeka.content}\n\nProvide ONLY the ${targetLangName} translation.`;
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
      if (!vtKeys.has(vtKey)) {
        try {
          const engTrans = await db.select().from(verseTranslations).where(
            and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "english"))
          );
          if (engTrans.length > 0) {
            const prompt = `You are an expert Sanskrit scholar. Translate this Isha Upanishad verse from English to ${targetLangName}. ${isHindi ? "Keep Sanskrit terms in Devanagari." : "Use IAST for Sanskrit terms."} Maintain scholarly register.\n\nSOURCE:\n${engTrans[0].content}\n\nProvide ONLY the ${targetLangName} translation.`;
            const translated = await translateText(openai, prompt, 2048);
            await db.insert(verseTranslations).values({
              verseId: verse.id,
              languageCode: lang.code,
              content: translated,
              isAiTranslated: true,
            });
            vtKeys.add(vtKey);
            totalCreated++;
          }
        } catch (error: any) {
          console.error(`[Isha] VT V${verse.verseNumber} → ${targetLangName}: ${error.message}`);
          await delay(3000);
        }
      }

      await delay(DELAY_MS);
    }
  }

  console.log(`[Isha European] Done: ${totalCreated} new translations`);
  return totalCreated;
}
