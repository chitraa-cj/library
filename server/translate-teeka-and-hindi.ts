import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books, languages } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateText(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  context: string,
  isTeeka: boolean
): Promise<string> {
  const commentaryType = isTeeka ? "Anandagiri's Tika (sub-commentary)" : "Shankaracharya's Bhashya (commentary)";
  const prompt = `You are an expert Sanskrit scholar and translator specializing in Advaita Vedanta philosophy. Translate the following ${commentaryType} on the Isha Upanishad from ${sourceLang} to ${targetLang}.

IMPORTANT GUIDELINES:
- This is a scholarly philosophical translation of ${commentaryType}
- Preserve all Sanskrit technical terms (like Brahman, Atman, Maya, Avidya, etc.)
- For ${targetLang === "Hindi" ? "Hindi" : "European languages"}: ${targetLang === "Hindi" ? "Keep Sanskrit terms in Devanagari script and provide Hindi explanations" : "Use IAST transliteration for Sanskrit terms (e.g., Ātman, Brahman, Māyā)"}
- Maintain the philosophical precision and scholarly register
- Preserve paragraph structure and logical flow
- ${isTeeka ? "This is Anandagiri's sub-commentary (tika/teeka) which explains Shankaracharya's bhashya in detail" : "This is Shankaracharya's direct commentary (bhashya) on the Upanishadic verse"}

${context ? `Context (the verse being commented upon): ${context.substring(0, 300)}` : ""}

SOURCE TEXT (${sourceLang}):
${sourceText}

Provide ONLY the translated text in ${targetLang}, without any preamble or explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
    temperature: 0.3,
  });

  return response.choices[0].message.content || "";
}

async function main() {
  console.log("Starting teeka + Hindi translation process...\n");

  const existingBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (existingBooks.length === 0) {
    console.error("Isha Upanishad book not found");
    return;
  }
  const book = existingBooks[0];

  const bookVerses = await db.select().from(verses).where(eq(verses.bookId, book.id));
  bookVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  const hiLang = await db.select().from(languages).where(eq(languages.code, "hi"));
  if (hiLang.length === 0) {
    console.log("Hindi language not found, adding it...");
    await db.insert(languages).values({ code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari" });
  }

  const allExplanations = await db
    .select()
    .from(explanations)
    .where(
      and(
        eq(explanations.verseId, bookVerses[0].id),
      )
    );

  const getExplanationsForVerse = async (verseId: string) => {
    return db.select().from(explanations).where(eq(explanations.verseId, verseId));
  };

  const existingKeys = new Set<string>();
  const allExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
  }).from(explanations);
  for (const e of allExp) {
    existingKeys.add(`${e.verseId}-${e.languageCode}-${e.authorName}`);
  }

  let totalCreated = 0;

  // PART 1: Translate Anandagiri teeka from Sanskrit to Spanish, French, German
  const teekaTargetLangs = [
    { code: "spanish", name: "Spanish" },
    { code: "french", name: "French" },
    { code: "german", name: "German" },
  ];

  console.log("=== PART 1: Translating Anandagiri teeka to Spanish, French, German ===\n");

  for (const verse of bookVerses) {
    const verseExps = await getExplanationsForVerse(verse.id);
    const devTeeka = verseExps.find(e => e.authorName === "Anandagiri" && e.languageCode === "devanagari");

    if (!devTeeka) {
      console.log(`  Verse ${verse.verseNumber}: No Sanskrit teeka found, skipping`);
      continue;
    }

    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");
    const context = engBhashyam?.content || "";

    for (const lang of teekaTargetLangs) {
      const key = `${verse.id}-${lang.code}-Anandagiri`;
      if (existingKeys.has(key)) {
        console.log(`  Verse ${verse.verseNumber} ${lang.name} teeka: already exists, skipping`);
        continue;
      }

      console.log(`  Translating verse ${verse.verseNumber} teeka to ${lang.name}...`);
      try {
        const translated = await translateText(
          devTeeka.content,
          "Sanskrit",
          lang.name,
          context,
          true
        );

        await db.insert(explanations).values({
          verseId: verse.id,
          languageCode: lang.code,
          authorName: "Anandagiri",
          content: translated,
          isAiTranslated: true,
        });

        existingKeys.add(key);
        totalCreated++;
        console.log(`    Done (${translated.length} chars)`);
        await delay(500);
      } catch (error: any) {
        console.error(`    ERROR: ${error.message}`);
        await delay(2000);
      }
    }
  }

  // PART 2: Translate Shankaracharya bhashyam from English to Hindi
  console.log("\n=== PART 2: Translating Shankaracharya bhashyam to Hindi ===\n");

  for (const verse of bookVerses) {
    const verseExps = await getExplanationsForVerse(verse.id);
    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");

    if (!engBhashyam) {
      console.log(`  Verse ${verse.verseNumber}: No English bhashyam found, skipping`);
      continue;
    }

    const key = `${verse.id}-hi-Adi Shankaracharya`;
    if (existingKeys.has(key)) {
      console.log(`  Verse ${verse.verseNumber} Hindi bhashyam: already exists, skipping`);
      continue;
    }

    console.log(`  Translating verse ${verse.verseNumber} bhashyam to Hindi...`);
    try {
      const translated = await translateText(
        engBhashyam.content,
        "English",
        "Hindi",
        "",
        false
      );

      await db.insert(explanations).values({
        verseId: verse.id,
        languageCode: "hi",
        authorName: "Adi Shankaracharya",
        content: translated,
        isAiTranslated: true,
      });

      existingKeys.add(key);
      totalCreated++;
      console.log(`    Done (${translated.length} chars)`);
      await delay(500);
    } catch (error: any) {
      console.error(`    ERROR: ${error.message}`);
      await delay(2000);
    }
  }

  // PART 3: Translate Anandagiri teeka from Sanskrit to Hindi
  console.log("\n=== PART 3: Translating Anandagiri teeka to Hindi ===\n");

  for (const verse of bookVerses) {
    const verseExps = await getExplanationsForVerse(verse.id);
    const devTeeka = verseExps.find(e => e.authorName === "Anandagiri" && e.languageCode === "devanagari");

    if (!devTeeka) {
      console.log(`  Verse ${verse.verseNumber}: No Sanskrit teeka found, skipping`);
      continue;
    }

    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");
    const context = engBhashyam?.content || "";

    const key = `${verse.id}-hi-Anandagiri`;
    if (existingKeys.has(key)) {
      console.log(`  Verse ${verse.verseNumber} Hindi teeka: already exists, skipping`);
      continue;
    }

    console.log(`  Translating verse ${verse.verseNumber} teeka to Hindi...`);
    try {
      const translated = await translateText(
        devTeeka.content,
        "Sanskrit",
        "Hindi",
        context,
        true
      );

      await db.insert(explanations).values({
        verseId: verse.id,
        languageCode: "hi",
        authorName: "Anandagiri",
        content: translated,
        isAiTranslated: true,
      });

      existingKeys.add(key);
      totalCreated++;
      console.log(`    Done (${translated.length} chars)`);
      await delay(500);
    } catch (error: any) {
      console.error(`    ERROR: ${error.message}`);
      await delay(2000);
    }
  }

  // PART 4: Also translate Hindi verse translations (bhashyam context)
  console.log("\n=== PART 4: Translating verse translations to Hindi ===\n");

  const { verseTranslations } = await import("@shared/schema");
  
  for (const verse of bookVerses) {
    const engTranslations = await db.select().from(verseTranslations).where(
      and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "english"))
    );

    if (engTranslations.length === 0) continue;

    const existingHindi = await db.select().from(verseTranslations).where(
      and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "hi"))
    );

    if (existingHindi.length > 0) {
      console.log(`  Verse ${verse.verseNumber} Hindi verse translation: already exists, skipping`);
      continue;
    }

    const engTrans = engTranslations[0];
    console.log(`  Translating verse ${verse.verseNumber} text to Hindi...`);
    try {
      const prompt = `You are an expert Sanskrit scholar. Translate this Isha Upanishad verse translation from English to Hindi. Keep Sanskrit terms in Devanagari. Maintain scholarly register.

SOURCE:
${engTrans.content}

Provide ONLY the Hindi translation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.3,
      });

      const translated = response.choices[0].message.content || "";

      await db.insert(verseTranslations).values({
        verseId: verse.id,
        languageCode: "hi",
        content: translated,
        isAiTranslated: true,
      });

      totalCreated++;
      console.log(`    Done (${translated.length} chars)`);
      await delay(500);
    } catch (error: any) {
      console.error(`    ERROR: ${error.message}`);
      await delay(2000);
    }
  }

  console.log(`\n=== COMPLETE: Created ${totalCreated} total translations ===`);
}

main().catch(console.error);
