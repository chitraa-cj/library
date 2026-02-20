import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books, languages, verseTranslations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 5;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TARGET_LANGS = [
  { code: "german", name: "German", dbCode: "de", nativeName: "Deutsch", script: "Latin" },
  { code: "french", name: "French", dbCode: "fr", nativeName: "Français", script: "Latin" },
  { code: "spanish", name: "Spanish", dbCode: "es", nativeName: "Español", script: "Latin" },
];

async function translateVerseText(
  sourceText: string,
  targetLang: string,
): Promise<string> {
  const prompt = `You are an expert Sanskrit scholar and translator. Translate this Bhagavad Gita verse translation from English to ${targetLang}.

GUIDELINES:
- Keep Sanskrit terms in IAST transliteration (e.g., Ātman, Brahman, Dharma, Karma)
- Maintain the scholarly and devotional register
- Preserve verse structure
- Be accurate and precise

SOURCE (English):
${sourceText}

Provide ONLY the ${targetLang} translation, no preamble.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
}

async function translateCommentary(
  sourceText: string,
  targetLang: string,
  authorName: string,
  verseRef: string,
): Promise<string> {
  if (sourceText.length < 100 && (sourceText.includes("did not comment") || sourceText.includes("commentary starts from"))) {
    const noteTranslations: Record<string, Record<string, string>> = {
      "German": {
        "did not comment": `${verseRef} Sri Sankaracharya hat diesen Shloka nicht kommentiert. Der Kommentar beginnt ab 2.10.`,
        "default": sourceText,
      },
      "French": {
        "did not comment": `${verseRef} Sri Sankaracharya n'a pas commenté ce shloka. Le commentaire commence à partir de 2.10.`,
        "default": sourceText,
      },
      "Spanish": {
        "did not comment": `${verseRef} Sri Sankaracharya no comentó este shloka. El comentario comienza desde 2.10.`,
        "default": sourceText,
      },
    };
    const langNotes = noteTranslations[targetLang];
    if (langNotes) {
      return sourceText.includes("did not comment") ? langNotes["did not comment"] : langNotes["default"];
    }
    return sourceText;
  }

  const prompt = `You are an expert Sanskrit scholar and translator specializing in Advaita Vedanta philosophy. Translate this ${authorName}'s commentary on Bhagavad Gita from English to ${targetLang}.

GUIDELINES:
- Preserve Sanskrit technical terms in IAST transliteration (Ātman, Brahman, Māyā, Dharma, Karma, etc.)
- Maintain philosophical precision and scholarly register
- Preserve paragraph structure and logical flow
- This is a scholarly commentary on a sacred text, maintain reverence

SOURCE (English):
${sourceText}

Provide ONLY the ${targetLang} translation, no preamble.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
}

async function ensureLanguages() {
  for (const lang of TARGET_LANGS) {
    const existing = await db.select().from(languages).where(eq(languages.code, lang.dbCode));
    if (existing.length === 0) {
      await db.insert(languages).values({
        code: lang.dbCode,
        name: lang.name,
        nativeName: lang.nativeName,
        script: lang.script,
      });
      console.log(`Added language: ${lang.name} (${lang.dbCode})`);
    }
  }
}

async function main() {
  console.log("=== Bhagavad Gita European Language Translation ===\n");

  await ensureLanguages();

  const gitaBooks = await db.select().from(books).where(eq(books.slug, "bhagavad-gita"));
  if (gitaBooks.length === 0) {
    console.error("Bhagavad Gita book not found!");
    return;
  }
  const book = gitaBooks[0];
  console.log(`Found: ${book.title} (${book.id})\n`);

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, book.id));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);
  console.log(`Total verses: ${allVerses.length}\n`);

  const existingVT = await db.select({
    verseId: verseTranslations.verseId,
    languageCode: verseTranslations.languageCode,
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, book.id));
  const vtKeys = new Set(existingVT.map(e => `${e.verseId}-${e.languageCode}`));

  const existingExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
  }).from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, book.id));
  const expKeys = new Set(existingExp.map(e => `${e.verseId}-${e.languageCode}-${e.authorName}`));

  let totalCreated = 0;

  console.log("=== PART 1: Translating verse texts to German, French, Spanish ===\n");

  for (let i = 0; i < allVerses.length; i += BATCH_SIZE) {
    const batch = allVerses.slice(i, i + BATCH_SIZE);
    const promises: Promise<void>[] = [];

    for (const verse of batch) {
      for (const lang of TARGET_LANGS) {
        const key = `${verse.id}-${lang.code}`;
        if (vtKeys.has(key)) continue;

        const p = (async () => {
          const engTrans = await db.select().from(verseTranslations).where(
            and(eq(verseTranslations.verseId, verse.id), eq(verseTranslations.languageCode, "en"))
          );
          if (engTrans.length === 0) return;

          try {
            const translated = await translateVerseText(engTrans[0].content, lang.name);
            await db.insert(verseTranslations).values({
              verseId: verse.id,
              languageCode: lang.code,
              content: translated,
              isAiTranslated: true,
            });
            vtKeys.add(key);
            totalCreated++;
            console.log(`  V${verse.verseNumber} → ${lang.name} (${translated.length} chars)`);
          } catch (error: any) {
            console.error(`  ERROR V${verse.verseNumber} → ${lang.name}: ${error.message}`);
            await delay(3000);
          }
        })();
        promises.push(p);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`  [Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allVerses.length / BATCH_SIZE)} done, total: ${totalCreated}]`);
      await delay(300);
    }
  }

  console.log(`\nPart 1 complete. Total verse translations: ${totalCreated}\n`);

  console.log("=== PART 2: Translating Sri Shankaracharya commentary ===\n");

  const authorName = "Sri Shankaracharya";
  let commentaryCount = 0;

  for (let i = 0; i < allVerses.length; i += BATCH_SIZE) {
    const batch = allVerses.slice(i, i + BATCH_SIZE);
    const promises: Promise<void>[] = [];

    for (const verse of batch) {
      for (const lang of TARGET_LANGS) {
        const key = `${verse.id}-${lang.code}-${authorName}`;
        if (expKeys.has(key)) continue;

        const p = (async () => {
          const engExp = await db.select().from(explanations).where(
            and(
              eq(explanations.verseId, verse.id),
              eq(explanations.languageCode, "en"),
              eq(explanations.authorName, authorName)
            )
          );
          if (engExp.length === 0) return;

          try {
            const verseRef = `${verse.adhyayNumber || 1}.${verse.verseNumber}`;
            const translated = await translateCommentary(
              engExp[0].content,
              lang.name,
              authorName,
              verseRef
            );
            await db.insert(explanations).values({
              verseId: verse.id,
              languageCode: lang.code,
              authorName: authorName,
              content: translated,
              isAiTranslated: true,
            });
            expKeys.add(key);
            commentaryCount++;
            totalCreated++;
            console.log(`  C${verse.verseNumber} → ${lang.name} (${translated.length} chars)`);
          } catch (error: any) {
            console.error(`  ERROR C${verse.verseNumber} → ${lang.name}: ${error.message}`);
            await delay(3000);
          }
        })();
        promises.push(p);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`  [Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allVerses.length / BATCH_SIZE)} done, commentaries: ${commentaryCount}]`);
      await delay(300);
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Total translations created: ${totalCreated}`);
  console.log(`  Verse translations: ${totalCreated - commentaryCount}`);
  console.log(`  Commentaries: ${commentaryCount}`);
}

main().catch(console.error);
