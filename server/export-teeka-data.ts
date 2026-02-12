import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";

async function exportTeekaData() {
  const ishaBook = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya")).limit(1);
  if (ishaBook.length === 0) {
    console.error("Isha Upanishad not found!");
    process.exit(1);
  }
  const bookId = ishaBook[0].id;
  console.log(`Found Isha Upanishad with ID: ${bookId}`);

  const ishaVerses = await db.select().from(verses).where(eq(verses.bookId, bookId)).orderBy(verses.verseNumber);
  console.log(`Found ${ishaVerses.length} Isha Upanishad verses`);

  const languages = ["devanagari", "kannada", "tamil", "telugu"];
  
  const result: Record<number, Record<string, { bhashyam: string; teeka: string }>> = {};
  
  for (const verse of ishaVerses) {
    result[verse.verseNumber] = {};
    for (const lang of languages) {
      const bhashyamEntries = await db.select().from(explanations).where(
        and(eq(explanations.verseId, verse.id), eq(explanations.languageCode, lang), eq(explanations.authorName, "Adi Shankaracharya"))
      );
      const teekaEntries = await db.select().from(explanations).where(
        and(eq(explanations.verseId, verse.id), eq(explanations.languageCode, lang), eq(explanations.authorName, "Anandagiri"))
      );
      
      if (bhashyamEntries.length > 0 || teekaEntries.length > 0) {
        result[verse.verseNumber][lang] = {
          bhashyam: bhashyamEntries[0]?.content || "",
          teeka: teekaEntries[0]?.content || "",
        };
      }
    }
  }
  
  let output = `export const authoritativeCommentaryData: Record<number, Record<string, { bhashyam: string; teeka: string }>> = {\n`;
  
  for (const [verseNum, langs] of Object.entries(result)) {
    output += `  ${verseNum}: {\n`;
    for (const [lang, data] of Object.entries(langs)) {
      const bhashyam = JSON.stringify(data.bhashyam);
      const teeka = JSON.stringify(data.teeka);
      output += `    "${lang}": {\n      bhashyam: ${bhashyam},\n      teeka: ${teeka},\n    },\n`;
    }
    output += `  },\n`;
  }
  output += `};\n`;
  
  fs.writeFileSync("server/authoritative-commentary-data.ts", output);
  console.log(`Exported ${Object.keys(result).length} verses to server/authoritative-commentary-data.ts`);
  process.exit(0);
}

exportTeekaData().catch(err => { console.error(err); process.exit(1); });
