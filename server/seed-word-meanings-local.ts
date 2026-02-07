import { db } from "./db";
import { verseWordMeanings, verses, books } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import wordMeaningsData from "./data/gita-word-meanings.json";

interface WordMeaningEntry {
  chapter: number;
  verse: number;
  word: string;
  meaning: string;
  position: number;
}

export async function seedWordMeaningsFromFile() {
  console.log("Seeding word-by-word meanings from local data file...");

  const existing = await db.select({ count: sql<number>`count(*)` }).from(verseWordMeanings);
  const existingCount = Number(existing[0].count);

  if (existingCount >= 11000) {
    console.log(`Word meanings already seeded (${existingCount} entries), skipping...`);
    return;
  }

  const [gitaBook] = await db
    .select()
    .from(books)
    .where(eq(books.slug, "bhagavad-gita"));

  if (!gitaBook) {
    console.log("Bhagavad Gita book not found, skipping word meanings seed");
    return;
  }

  const allVerses = await db
    .select({ id: verses.id, verseNumber: verses.verseNumber, adhyayNumber: verses.adhyayNumber })
    .from(verses)
    .where(eq(verses.bookId, gitaBook.id));

  const verseMap = new Map<string, string>();
  for (const v of allVerses) {
    const key = `${v.adhyayNumber}-${v.verseNumber}`;
    verseMap.set(key, v.id);
  }

  const entries = wordMeaningsData as WordMeaningEntry[];
  console.log(`Loaded ${entries.length} word meaning entries from bundled data`);

  if (existingCount > 0) {
    console.log(`Clearing ${existingCount} partial entries before re-seeding...`);
    await db.delete(verseWordMeanings);
  }

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const values = batch
      .map((e) => {
        const verseId = verseMap.get(`${e.chapter}-${e.verse}`);
        if (!verseId) return null;
        return {
          verseId,
          word: e.word,
          meaning: e.meaning,
          position: e.position,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (values.length > 0) {
      await db.insert(verseWordMeanings).values(values);
      inserted += values.length;
    }

    if ((i + batchSize) % 2000 === 0 || i + batchSize >= entries.length) {
      console.log(`  Progress: ${inserted}/${entries.length} word meanings inserted`);
    }
  }

  console.log(`Word meanings seeding complete! ${inserted} entries inserted from local data.`);
}
