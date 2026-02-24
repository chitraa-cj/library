import { db } from "./db";
import { verses, verseTranslations, explanations, books } from "@shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface BookExport {
  vt: Record<number, Record<string, string>>;
  exp: Record<number, Record<string, string>>;
}

async function exportBookTranslations(bookSlug: string): Promise<BookExport> {
  const bookRows = await db.select().from(books).where(eq(books.slug, bookSlug));
  if (bookRows.length === 0) {
    console.log(`Book ${bookSlug} not found`);
    return { vt: {}, exp: {} };
  }
  const bookId = bookRows[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  const verseIdToNumber = new Map<string, number>();
  for (const v of allVerses) {
    verseIdToNumber.set(v.id, v.verseNumber);
  }

  const allVT = await db.select({
    verseId: verseTranslations.verseId,
    languageCode: verseTranslations.languageCode,
    content: verseTranslations.content,
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));

  const allExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
    content: explanations.content,
  }).from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));

  const vtData: Record<number, Record<string, string>> = {};
  for (const row of allVT) {
    const vn = verseIdToNumber.get(row.verseId);
    if (vn === undefined) continue;
    if (!vtData[vn]) vtData[vn] = {};
    vtData[vn][row.languageCode] = row.content;
  }

  const expData: Record<number, Record<string, string>> = {};
  for (const row of allExp) {
    const vn = verseIdToNumber.get(row.verseId);
    if (vn === undefined) continue;
    if (!expData[vn]) expData[vn] = {};
    const key = `${row.languageCode}|${row.authorName}`;
    expData[vn][key] = row.content;
  }

  return { vt: vtData, exp: expData };
}

async function main() {
  const outDir = path.join(process.cwd(), "data", "translation-exports");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const bookSlugs = [
    "isha-upanishad-bhashya",
    "katha-upanishad-bhashya",
    "bhagavad-gita",
  ];

  for (const slug of bookSlugs) {
    console.log(`Exporting ${slug}...`);
    const data = await exportBookTranslations(slug);

    const vtCount = Object.values(data.vt).reduce((s, v) => s + Object.keys(v).length, 0);
    const expCount = Object.values(data.exp).reduce((s, v) => s + Object.keys(v).length, 0);
    console.log(`  ${slug}: ${vtCount} VTs, ${expCount} explanations`);

    const filePath = path.join(outDir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data));
    const sizeKB = Math.round(fs.statSync(filePath).size / 1024);
    console.log(`  Written to ${filePath} (${sizeKB} KB)`);
  }

  console.log("Export complete!");
  process.exit(0);
}

main().catch(console.error);
