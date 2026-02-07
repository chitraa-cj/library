import { db } from "./db";
import { verses, books, verseWordMeanings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === 2) throw err;
      console.log(`  Retry ${attempt + 1} for ${url}...`);
      await delay(2000 * (attempt + 1));
    }
  }
  throw new Error("Failed after retries");
}

function parseWordMeanings(html: string): Array<{ word: string; meaning: string }> {
  const meanings: Array<{ word: string; meaning: string }> = [];

  const match = html.match(/word_meanings\\?":\\?"(.*?)\\n\\?",/);
  if (!match) return meanings;

  const raw = match[1].replace(/\\n/g, "").trim();
  const pairs = raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const pair of pairs) {
    const dashIdx = pair.indexOf("\u2014");
    if (dashIdx > 0) {
      const word = pair.substring(0, dashIdx).trim();
      let meaning = pair.substring(dashIdx + 1).trim();
      meaning = meaning.replace(/\\+$/, "").trim();
      if (word && meaning) {
        meanings.push({ word, meaning });
      }
    }
  }

  return meanings;
}

export async function seedWordMeanings() {
  console.log("Seeding word-by-word meanings from bhagavadgita.com...");

  const book = await db
    .select()
    .from(books)
    .where(eq(books.slug, "bhagavad-gita"));
  if (book.length === 0) {
    console.error("Bhagavad Gita book not found. Run Gita seed first.");
    return;
  }
  const bookId = book[0].id;

  const allVerses = await db
    .select({
      id: verses.id,
      adhyayNumber: verses.adhyayNumber,
      verseNumber: verses.verseNumber,
      sectionTitle: verses.sectionTitle,
    })
    .from(verses)
    .where(eq(verses.bookId, bookId))
    .orderBy(verses.verseNumber);

  const versesWithMeaningsSet = new Set<string>();
  const existing = await db
    .selectDistinct({ verseId: verseWordMeanings.verseId })
    .from(verseWordMeanings)
    .innerJoin(verses, eq(verseWordMeanings.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  for (const e of existing) {
    versesWithMeaningsSet.add(e.verseId);
  }

  if (versesWithMeaningsSet.size >= allVerses.length) {
    console.log("Word meanings already seeded for all verses. Skipping...");
    return;
  }

  if (versesWithMeaningsSet.size > 0) {
    console.log(
      `Resuming... ${versesWithMeaningsSet.size}/${allVerses.length} verses already done.`
    );
  }

  let seeded = versesWithMeaningsSet.size;
  let failed = 0;
  const BASE_URL = "https://bhagavadgita.com/chapter";

  for (const verse of allVerses) {
    if (versesWithMeaningsSet.has(verse.id)) continue;

    const chapterNum = verse.adhyayNumber || 1;
    const parts = (verse.sectionTitle || "").split(".");
    const verseNum = parts.length > 1 ? parts[1] : String(verse.verseNumber);

    const url = `${BASE_URL}/${chapterNum}/verse/${verseNum}`;

    try {
      const html = await fetchPage(url);
      const meanings = parseWordMeanings(html);

      if (meanings.length > 0) {
        const rows = meanings.map((m, idx) => ({
          verseId: verse.id,
          word: m.word,
          meaning: m.meaning,
          position: idx,
        }));

        await db.insert(verseWordMeanings).values(rows);
        seeded++;

        if (seeded % 50 === 0) {
          console.log(`  Progress: ${seeded}/${allVerses.length} verses with word meanings`);
        }
      } else {
        console.log(`  No word meanings found for ${verse.sectionTitle} (${url})`);
        failed++;
      }

      await delay(300);
    } catch (err: any) {
      console.error(`  Failed to fetch ${url}: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `Word meanings seeding complete! ${seeded} verses with meanings, ${failed} failed.`
  );
}
