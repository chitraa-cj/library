import { db } from "./db";
import { explanations, verses } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";

async function exportTeekaData() {
  const allVerses = await db.select().from(verses).orderBy(verses.verseNumber);
  const languages = ["devanagari", "kannada", "tamil", "telugu"];
  
  const result: Record<number, Record<string, { bhashyam: string; teeka: string }>> = {};
  
  for (const verse of allVerses) {
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
  console.log("Exported commentary data to server/authoritative-commentary-data.ts");
  process.exit(0);
}

exportTeekaData().catch(err => { console.error(err); process.exit(1); });
