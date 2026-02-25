import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";

function isActualTranslation(content: string, langCode: string): boolean {
  if (!content || content.length < 100) return false;
  const markers: Record<string, RegExp> = {
    telugu: /అనగా|అంటే|కాబట్టి|ఎందుకంటే|వివరిస్తా|అయితే|చేయబడ|ఉపయోగించ|మరియు|కారణం|అందువల్ల|ద్వారా|ఎందుకు|వారు|అది/,
    kannada: /ಅಂದರೆ|ಏಕೆಂದರೆ|ಆದ್ದರಿಂದ|ವಿವರಿಸ|ಆಗಿದೆ|ಮಾಡಲಾ|ಬಳಸಲಾ|ಮತ್ತು|ಕಾರಣ|ಅವರು|ಅದು|ಹೇಗೆ|ಇದು/,
    tamil: /என்று|ஏனெனில்|ஆகையால்|விளக்கு|ஆகும்|செய்யப்|பயன்படுத்|மற்றும்|காரணம்|அவர்கள்|அது|எப்படி|இது/,
  };
  return markers[langCode] ? markers[langCode].test(content) : false;
}

export async function syncSouthIndianBhashya() {
  const dataPath = path.join(process.cwd(), "data", "south-indian-bhashya-translations.json");
  if (!fs.existsSync(dataPath)) {
    return;
  }

  const data: Array<{ verseNumber: number; languageCode: string; authorName: string; content: string }> = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  if (!data.length) return;

  const ishaBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (!ishaBooks.length) return;
  const bookId = ishaBooks[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  const verseMap = new Map(allVerses.map(v => [v.verseNumber, v]));

  let updated = 0;
  let skipped = 0;

  for (const item of data) {
    const verse = verseMap.get(item.verseNumber);
    if (!verse) continue;

    const existing = await db.select().from(explanations).where(
      and(
        eq(explanations.verseId, verse.id),
        eq(explanations.languageCode, item.languageCode),
        eq(explanations.authorName, item.authorName)
      )
    );

    if (existing.length === 0) {
      await db.insert(explanations).values({
        verseId: verse.id,
        languageCode: item.languageCode,
        authorName: item.authorName,
        content: item.content,
        isAiTranslated: true,
      });
      updated++;
    } else {
      const current = existing[0];
      if (isActualTranslation(current.content || "", item.languageCode)) {
        skipped++;
        continue;
      }
      await db.update(explanations)
        .set({ content: item.content, isAiTranslated: true })
        .where(eq(explanations.id, current.id));
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[South Indian Bhashya Sync] Updated ${updated} translations, skipped ${skipped}`);
  } else {
    console.log(`[South Indian Bhashya Sync] All translations already correct`);
  }
}
