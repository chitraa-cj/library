import { db } from "./db";
import { verses, books, verseWordMeanings } from "@shared/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

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
      await delay(2000 * (attempt + 1));
    }
  }
  throw new Error("Failed after retries");
}

function parseWordMeanings(html: string): Array<{ word: string; meaning: string }> {
  const meanings: Array<{ word: string; meaning: string }> = [];

  const idx = html.indexOf("word_meanings");
  if (idx < 0) return meanings;

  const chunk = html.substring(idx, idx + 5000);
  const match = chunk.match(/word_meanings\\?":\\?"(.*?)(?:\\n\\?"|",\\?")/);
  if (!match) {
    const match2 = chunk.match(/word_meanings\\?":\\?"([^"]*)/);
    if (!match2) return meanings;
    const raw = match2[1].replace(/\\n/g, "").replace(/\\"/g, '"').trim();
    return extractPairs(raw);
  }

  const raw = match[1].replace(/\\n/g, "").trim();
  return extractPairs(raw);
}

function extractPairs(raw: string): Array<{ word: string; meaning: string }> {
  const meanings: Array<{ word: string; meaning: string }> = [];
  const pairs = raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const pair of pairs) {
    const dashIdx = pair.indexOf("\u2014");
    if (dashIdx > 0) {
      const word = pair.substring(0, dashIdx).trim();
      let meaning = pair.substring(dashIdx + 1).trim();
      meaning = meaning.replace(/\\+$/, "").replace(/\\"/g, '"').trim();
      if (meaning.includes('","')) meaning = meaning.split('","')[0].trim();
      if (word && meaning) {
        meanings.push({ word, meaning });
      }
    }
  }
  return meanings;
}

export async function seedGroupedWordMeanings() {
  console.log("Seeding word meanings for grouped verses...");

  const book = await db.select().from(books).where(eq(books.slug, "bhagavad-gita"));
  if (book.length === 0) {
    console.error("Bhagavad Gita book not found.");
    return;
  }
  const bookId = book[0].id;

  const missingVerses = await db
    .select({
      id: verses.id,
      adhyayNumber: verses.adhyayNumber,
      sectionTitle: verses.sectionTitle,
      verseNumber: verses.verseNumber,
    })
    .from(verses)
    .where(
      and(
        eq(verses.bookId, bookId),
        sql`${verses.id} NOT IN (SELECT DISTINCT verse_id FROM verse_word_meanings)`
      )
    )
    .orderBy(verses.verseNumber);

  console.log(`${missingVerses.length} verses missing word meanings.`);

  const grouped = new Map<string, typeof missingVerses>();
  for (const v of missingVerses) {
    const key = String(v.adhyayNumber);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(v);
  }

  let fixed = 0;
  let failed = 0;
  const BASE_URL = "https://bhagavadgita.com/chapter";

  for (const [chapter, chapterVerses] of grouped) {
    const verseNums = chapterVerses.map((v) => {
      const parts = (v.sectionTitle || "").split(".");
      return parseInt(parts.length > 1 ? parts[1] : String(v.verseNumber));
    });

    const ranges = findConsecutiveRanges(verseNums);

    for (const range of ranges) {
      const rangeStr = range.length > 1 ? `${range[0]}-${range[range.length - 1]}` : `${range[0]}`;
      const url = `${BASE_URL}/${chapter}/verse/${rangeStr}`;

      try {
        const html = await fetchPage(url);
        const meanings = parseWordMeanings(html);

        if (meanings.length > 0) {
          for (const verseNum of range) {
            const matching = chapterVerses.filter((v) => {
              const parts = (v.sectionTitle || "").split(".");
              const vn = parseInt(parts.length > 1 ? parts[1] : String(v.verseNumber));
              return vn === verseNum;
            });

            for (const verse of matching) {
              const rows = meanings.map((m, idx) => ({
                verseId: verse.id,
                word: m.word,
                meaning: m.meaning,
                position: idx,
              }));
              await db.insert(verseWordMeanings).values(rows);
              fixed++;
            }
          }
          console.log(`  Fixed ${chapter}.${rangeStr}: ${meanings.length} word meanings`);
        } else {
          failed += range.length;
          console.log(`  Still no meanings for ${chapter}.${rangeStr}`);
        }

        await delay(300);
      } catch (err: any) {
        console.error(`  Failed ${url}: ${err.message}`);
        failed += range.length;
      }
    }
  }

  console.log(`Grouped seeding done! Fixed ${fixed} verses, ${failed} still missing.`);
}

function findConsecutiveRanges(nums: number[]): number[][] {
  if (nums.length === 0) return [];
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const ranges: number[][] = [];
  let current: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current.push(sorted[i]);
    } else {
      ranges.push(current);
      current = [sorted[i]];
    }
  }
  ranges.push(current);
  return ranges;
}

