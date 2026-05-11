import { db } from "./db";
import { books, verses, verseTranslations, explanations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface KathaEntry {
  hierarchyValues: string[];
  sourceText: string;
  verseTranslations: {
    english: string;
    others: Array<{
      id: number;
      language: string;
      author: string;
      text: string;
    }>;
  };
  bhashyaContent: {
    sanskrit: string;
    english: string;
    others: Array<{
      id: number;
      language: string;
      author: string;
      text: string;
    }>;
  };
  teekas: Array<{
    teeka_name?: string;
    author_name?: string;
    original_text?: string;
    english_translation?: string;
  }>;
}

interface KathaData {
  bookContext: {
    book: string;
    introduction: string;
    bhashya: string;
    commentators: string[];
  };
  hierarchyConfig: {
    levels: number;
    identifiers: string[];
  };
  entries: KathaEntry[];
}

const LANG_MAP: Record<string, string> = {
  "Tamil": "ta",
  "Hindi": "hi",
  "Kannada": "kn",
  "Telugu": "te",
  "English": "en",
  "Sanskrit": "sa",
};

function resolveKathaJsonPath(): string | null {
  const candidates = [
    path.resolve("attached_assets/Upanishads_Complete_Export_(1)_1771923200056.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const dir = path.resolve("attached_assets");
  if (!fs.existsSync(dir)) return null;
  const fallback = fs
    .readdirSync(dir)
    .find((f) => /\.json$/i.test(f) && /Upanishads|Katha|upanishad/i.test(f));
  return fallback ? path.join(dir, fallback) : null;
}

export async function seedKathaUpanishad() {
  const existingBooks = await db.select().from(books).where(eq(books.slug, "katha-upanishad-bhashya"));
  if (existingBooks.length > 0) {
    console.log("[Katha] Katha Upanishad already seeded, skipping...");
    return existingBooks[0];
  }

  console.log("[Katha] Seeding Katha Upanishad...");

  const jsonPath = resolveKathaJsonPath();
  if (!jsonPath) {
    console.error(
      "[Katha] No Katha JSON in attached_assets/. Add Upanishads_Complete_Export_(1)_1771923200056.json (or any *Upanishads*.json) under attached_assets/, or load Katha from Strapi.",
    );
    return null;
  }
  if (!jsonPath.includes("1771923200056")) {
    console.log("[Katha] Using JSON file:", jsonPath);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const data: KathaData = JSON.parse(rawData);

  const book = await db.insert(books).values({
    slug: "katha-upanishad-bhashya",
    title: "Kaṭhopaniṣad",
    author: "Sri Shankaracharya",
    description: "The Kaṭhopaniṣad (कठोपनिषद्) is one of the most important Upanishads, belonging to the Taittirīya school of the Kṛṣṇa Yajurveda. It narrates the dialogue between young Nachiketas and Yama (Death), revealing the highest truths of Brahman and Ātman. This text presents Shankaracharya's Bhashya (commentary) with complete Sanskrit and English translations.",
    category: "Upanishad",
    coverImage: null,
    totalVerses: data.entries.length,
  }).returning();

  const bookId = book[0].id;
  console.log(`[Katha] Created book: ${book[0].title} (${bookId}), ${data.entries.length} entries`);

  const valliTitles: Record<string, string> = {
    "1-1": "Nachiketas & the Sacrifice",
    "1-2": "The Three Boons",
    "1-3": "The Soul's Journey",
    "2-1": "The Razor's Edge",
    "2-2": "The Inner Self",
    "2-3": "The Supreme Brahman",
  };

  let created = 0;

  for (const entry of data.entries) {
    const adhyayNum = parseInt(entry.hierarchyValues[0]) || 1;
    const valliNum = parseInt(entry.hierarchyValues[1]) || 1;
    const shlokaNum = parseInt(entry.hierarchyValues[2]) || 1;

    const valliKey = `${adhyayNum}-${valliNum}`;
    const valliTitle = valliTitles[valliKey] || `Vallī ${valliNum}`;

    const [verse] = await db.insert(verses).values({
      bookId,
      verseNumber: shlokaNum,
      sectionTitle: `${adhyayNum}.${valliNum}.${shlokaNum}`,
      adhyayNumber: adhyayNum,
      adhyayTitle: `अध्याय ${adhyayNum}`,
      khandaNumber: valliNum,
      khandaTitle: valliTitle,
    }).returning();

    const translationInserts: Array<{ verseId: string; languageCode: string; content: string; isAiTranslated: boolean }> = [];

    if (entry.sourceText && entry.sourceText.trim()) {
      translationInserts.push({
        verseId: verse.id,
        languageCode: "sa",
        content: entry.sourceText.trim(),
        isAiTranslated: false,
      });
    }

    if (entry.verseTranslations.english && entry.verseTranslations.english.trim()) {
      translationInserts.push({
        verseId: verse.id,
        languageCode: "en",
        content: entry.verseTranslations.english.trim(),
        isAiTranslated: false,
      });
    }

    if (translationInserts.length > 0) {
      await db.insert(verseTranslations).values(translationInserts);
    }

    const explanationInserts: Array<{ verseId: string; authorName: string; languageCode: string; content: string; isAiTranslated: boolean }> = [];

    if (entry.bhashyaContent.sanskrit && entry.bhashyaContent.sanskrit.trim()) {
      explanationInserts.push({
        verseId: verse.id,
        authorName: "Sri Shankaracharya",
        languageCode: "sa",
        content: entry.bhashyaContent.sanskrit.trim(),
        isAiTranslated: false,
      });
    }

    if (entry.bhashyaContent.english && entry.bhashyaContent.english.trim()) {
      explanationInserts.push({
        verseId: verse.id,
        authorName: "Sri Shankaracharya",
        languageCode: "en",
        content: entry.bhashyaContent.english.trim(),
        isAiTranslated: false,
      });
    }

    if (entry.bhashyaContent.others) {
      for (const other of entry.bhashyaContent.others) {
        const langCode = LANG_MAP[other.language];
        if (langCode && other.text && other.text.trim()) {
          explanationInserts.push({
            verseId: verse.id,
            authorName: other.author || "Sri Shankaracharya",
            languageCode: langCode,
            content: other.text.trim(),
            isAiTranslated: false,
          });
        }
      }
    }

    if (entry.verseTranslations.others) {
      for (const other of entry.verseTranslations.others) {
        const langCode = LANG_MAP[other.language];
        if (langCode && other.author && other.text && other.text.trim()) {
          explanationInserts.push({
            verseId: verse.id,
            authorName: other.author,
            languageCode: langCode,
            content: other.text.trim(),
            isAiTranslated: false,
          });
        }
      }
    }

    if (explanationInserts.length > 0) {
      await db.insert(explanations).values(explanationInserts);
    }

    created++;
  }

  console.log(`[Katha] Seeding complete: ${created} verses created with translations and commentary`);
  return book[0];
}
