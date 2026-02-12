import * as cheerio from "cheerio";
import { db } from "./db";
import { verses, verseTranslations, explanations, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const BASE_URL = "https://advaitasharada.sringeri.net";

const LANG_CONFIGS = [
  { urlCode: "devanagari", dbCode: "devanagari" },
  { urlCode: "kn", dbCode: "kannada" },
  { urlCode: "ta", dbCode: "tamil" },
  { urlCode: "te", dbCode: "telugu" },
];

interface VerseData {
  verseNumber: number;
  sloka: string;
  bhashyam: string;
  teeka: string;
}

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n +/g, "\n")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(url: string): Promise<string> {
  console.log(`  Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchTeekaForSection(sectionId: string, langCode: string): Promise<string> {
  const url = `${BASE_URL}/display/getVyakhya/AIS/${sectionId}/${langCode}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const html = await response.text();
    if (!html.trim()) return "";

    const ch = cheerio.load(html);
    const parts: string[] = [];
    ch(".VyakhyaDescriptor").each((_, el) => {
      const avataranika = ch(el).find(".Avataranika").text().trim();
      const prateeka = ch(el).find(".prateeka").text().trim();
      const vyakhya = ch(el).find(".Vyakhya").text().trim();

      let block = "";
      if (avataranika) block += avataranika;
      if (prateeka) block += (block ? "\n" : "") + prateeka;
      if (vyakhya) block += (block ? "\n" : "") + vyakhya;
      if (block) parts.push(block);
    });
    return parts.join("\n\n");
  } catch (e) {
    console.warn(`  Warning: Failed to fetch teeka for ${sectionId}/${langCode}`);
    return "";
  }
}

async function scrapeLanguage(urlCode: string): Promise<VerseData[]> {
  const pageUrl = `${BASE_URL}/display/bhashyaVyakhya/Isha/${urlCode}?vyakhya=AIS`;
  const html = await fetchPage(pageUrl);
  const ch = cheerio.load(html);

  const vyakhyaParaText = ch(".vyakhyaPara").text().trim();
  const vyakhyaSectionIds = vyakhyaParaText ? vyakhyaParaText.split(";").map(s => s.trim()).filter(Boolean) : [];
  console.log(`  Found ${vyakhyaSectionIds.length} vyakhya sections: ${vyakhyaSectionIds.join(", ")}`);

  const results: VerseData[] = [];

  const introEl = ch(".intro_bhashya").first();
  if (introEl.length) {
    const introText = cleanText(introEl.text());
    const introSectionId = introEl.attr("id") || "";

    let introTeeka = "";
    if (vyakhyaSectionIds.includes(introSectionId)) {
      introTeeka = await fetchTeekaForSection(introSectionId, urlCode);
    }

    results.push({
      verseNumber: 0,
      sloka: "",
      bhashyam: introText,
      teeka: cleanText(introTeeka),
    });
    console.log(`  Verse 0 (intro): bhashyam=${introText.length}ch, teeka=${introTeeka.length}ch`);
  }

  ch(".verse").each((_, verseEl) => {
    const verseId = ch(verseEl).attr("id") || "";
    const verseNumMatch = verseId.match(/V(\d+)/);
    if (!verseNumMatch) return;
    const verseNum = parseInt(verseNumMatch[1]);

    const slokaText = cleanText(ch(verseEl).find(".versetext").text());

    const bhashyaParts: string[] = [];

    ch(verseEl).find(".bhashya").each((_, bhEl) => {
      const text = cleanText(ch(bhEl).text());
      if (text) bhashyaParts.push(text);
    });

    const bhashyam = bhashyaParts.join("\n\n");

    results.push({
      verseNumber: verseNum,
      sloka: slokaText,
      bhashyam,
      teeka: "",
    });
  });

  const auxBhashya = ch(".aux_bhashya");
  if (auxBhashya.length) {
    const auxText = cleanText(auxBhashya.text());
    const lastVerse = results[results.length - 1];
    if (lastVerse && auxText) {
      lastVerse.bhashyam += "\n\n" + auxText;
    }
  }

  console.log(`  Fetching teeka for each section...`);
  for (const sectionId of vyakhyaSectionIds) {
    if (sectionId === (introEl.attr("id") || "")) continue;
    if (sectionId === "IS_C01_I02") {
      const teeka = await fetchTeekaForSection(sectionId, urlCode);
      if (teeka) {
        const lastVerse = results[results.length - 1];
        if (lastVerse) {
          lastVerse.teeka += (lastVerse.teeka ? "\n\n" : "") + cleanText(teeka);
        }
      }
      continue;
    }

    if (/_I\d+$/.test(sectionId)) {
      console.log(`  Skipping I-section teeka: ${sectionId} (leading_bhashya commentary)`);
      continue;
    }

    const verseNumMatch = sectionId.match(/V(\d+)/);
    if (!verseNumMatch) continue;
    const verseNum = parseInt(verseNumMatch[1]);

    const teeka = await fetchTeekaForSection(sectionId, urlCode);
    if (teeka) {
      const verseData = results.find(v => v.verseNumber === verseNum);
      if (verseData) {
        verseData.teeka += (verseData.teeka ? "\n\n" : "") + cleanText(teeka);
      }
    }
  }

  for (const v of results) {
    console.log(`  Verse ${v.verseNumber}: sloka=${v.sloka.length}ch, bhashyam=${v.bhashyam.length}ch, teeka=${v.teeka.length}ch`);
  }

  return results;
}

async function updateDatabase(allData: Map<string, VerseData[]>) {
  console.log("\n=== Updating database ===");

  const book = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya")).limit(1);
  if (book.length === 0) {
    console.error("Isha Upanishad book not found!");
    return;
  }
  const bookId = book[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  const verseMap = new Map(allVerses.map(v => [v.verseNumber, v]));
  console.log(`Found ${allVerses.length} verses in database`);

  for (const [dbLang, verseDataList] of allData) {
    console.log(`\n--- Updating ${dbLang} (${verseDataList.length} verses) ---`);

    for (const vd of verseDataList) {
      const verse = verseMap.get(vd.verseNumber);
      if (!verse) {
        console.warn(`  Verse ${vd.verseNumber} not found in DB, skipping`);
        continue;
      }

      if (vd.sloka) {
        const existing = await db
          .select()
          .from(verseTranslations)
          .where(and(
            eq(verseTranslations.verseId, verse.id),
            eq(verseTranslations.languageCode, dbLang)
          ));

        if (existing.length > 0) {
          await db.update(verseTranslations)
            .set({ content: vd.sloka })
            .where(eq(verseTranslations.id, existing[0].id));
        } else {
          await db.insert(verseTranslations).values({
            verseId: verse.id,
            languageCode: dbLang,
            content: vd.sloka,
          });
        }
        console.log(`  v${vd.verseNumber} sloka: ${existing.length > 0 ? "updated" : "inserted"} (${vd.sloka.length}ch)`);
      }

      if (vd.bhashyam) {
        const existing = await db
          .select()
          .from(explanations)
          .where(and(
            eq(explanations.verseId, verse.id),
            eq(explanations.languageCode, dbLang),
            eq(explanations.authorName, "Adi Shankaracharya")
          ));

        if (existing.length > 0) {
          await db.update(explanations)
            .set({ content: vd.bhashyam })
            .where(eq(explanations.id, existing[0].id));
        } else {
          await db.insert(explanations).values({
            verseId: verse.id,
            authorName: "Adi Shankaracharya",
            authorTitle: "Śaṅkarācārya Bhāṣya",
            languageCode: dbLang,
            content: vd.bhashyam,
          });
        }
        console.log(`  v${vd.verseNumber} bhashyam: ${existing.length > 0 ? "updated" : "inserted"} (${vd.bhashyam.length}ch)`);
      }

      if (vd.teeka) {
        const existing = await db
          .select()
          .from(explanations)
          .where(and(
            eq(explanations.verseId, verse.id),
            eq(explanations.languageCode, dbLang),
            eq(explanations.authorName, "Anandagiri")
          ));

        if (existing.length > 0) {
          await db.update(explanations)
            .set({ content: vd.teeka })
            .where(eq(explanations.id, existing[0].id));
        } else {
          await db.insert(explanations).values({
            verseId: verse.id,
            authorName: "Anandagiri",
            authorTitle: "Ānandagiri Ṭīkā",
            languageCode: dbLang,
            content: vd.teeka,
          });
        }
        console.log(`  v${vd.verseNumber} teeka: ${existing.length > 0 ? "updated" : "inserted"} (${vd.teeka.length}ch)`);
      }
    }
  }
}

async function main() {
  console.log("=== Advaita Sharada Data Scraper ===\n");

  const allData = new Map<string, VerseData[]>();

  for (const { urlCode, dbCode } of LANG_CONFIGS) {
    console.log(`\n======= Scraping ${dbCode} (${urlCode}) =======`);
    try {
      const data = await scrapeLanguage(urlCode);
      allData.set(dbCode, data);
    } catch (err) {
      console.error(`Failed to scrape ${dbCode}:`, err);
    }
  }

  let totalSlokas = 0, totalBhashya = 0, totalTeeka = 0;
  for (const [, verseList] of allData) {
    for (const v of verseList) {
      if (v.sloka) totalSlokas++;
      if (v.bhashyam) totalBhashya++;
      if (v.teeka) totalTeeka++;
    }
  }
  console.log(`\n=== Summary: ${totalSlokas} slokas, ${totalBhashya} bhashyam, ${totalTeeka} teeka entries ===`);

  await updateDatabase(allData);

  console.log("\n=== All done! ===");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
