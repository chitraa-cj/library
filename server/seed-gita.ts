import { db } from "./db";
import { books, verses, verseTranslations, explanations, languages } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const API_BASE = "https://vedicscriptures.github.io";

const CHAPTERS = [
  { num: 1, name: "अर्जुनविषादयोग", transliteration: "Arjun Viṣhād Yog", meaning: "Arjuna's Dilemma", verses: 47 },
  { num: 2, name: "सांख्ययोग", transliteration: "Sānkhya Yog", meaning: "The Yoga of Knowledge", verses: 72 },
  { num: 3, name: "कर्मयोग", transliteration: "Karm Yog", meaning: "The Yoga of Action", verses: 43 },
  { num: 4, name: "ज्ञानकर्मसंन्यासयोग", transliteration: "Jñāna Karm Sanyās Yog", meaning: "The Yoga of Knowledge and Action", verses: 42 },
  { num: 5, name: "कर्मसंन्यासयोग", transliteration: "Karm Sanyās Yog", meaning: "The Yoga of Renunciation", verses: 29 },
  { num: 6, name: "ध्यानयोग", transliteration: "Dhyān Yog", meaning: "The Yoga of Meditation", verses: 47 },
  { num: 7, name: "ज्ञानविज्ञानयोग", transliteration: "Jñāna Vijñāna Yog", meaning: "The Yoga of Knowledge and Wisdom", verses: 30 },
  { num: 8, name: "अक्षरब्रह्मयोग", transliteration: "Akṣhar Brahma Yog", meaning: "The Yoga of the Imperishable Brahman", verses: 28 },
  { num: 9, name: "राजविद्याराजगुह्ययोग", transliteration: "Rāja Vidyā Yog", meaning: "The Yoga of Royal Knowledge", verses: 34 },
  { num: 10, name: "विभूतियोग", transliteration: "Vibhūti Yog", meaning: "The Yoga of Divine Glories", verses: 42 },
  { num: 11, name: "विश्वरूपदर्शनयोग", transliteration: "Viśhwarūp Darśhan Yog", meaning: "The Yoga of the Universal Form", verses: 55 },
  { num: 12, name: "भक्तियोग", transliteration: "Bhakti Yog", meaning: "The Yoga of Devotion", verses: 20 },
  { num: 13, name: "क्षेत्र-क्षेत्रज्ञविभागयोग", transliteration: "Kṣhetra Kṣhetrajña Vibhāg Yog", meaning: "The Yoga of the Field and the Knower", verses: 35 },
  { num: 14, name: "गुणत्रयविभागयोग", transliteration: "Guṇa Traya Vibhāg Yog", meaning: "The Yoga of the Three Gunas", verses: 27 },
  { num: 15, name: "पुरुषोत्तमयोग", transliteration: "Puruṣhottam Yog", meaning: "The Yoga of the Supreme Person", verses: 20 },
  { num: 16, name: "दैवासुरसम्पद्विभागयोग", transliteration: "Daivāsura Sampad Vibhāg Yog", meaning: "The Yoga of Divine and Demoniac Natures", verses: 24 },
  { num: 17, name: "श्रद्धात्रयविभागयोग", transliteration: "Śhraddhā Traya Vibhāg Yog", meaning: "The Yoga of the Three Divisions of Faith", verses: 28 },
  { num: 18, name: "मोक्षसंन्यासयोग", transliteration: "Mokṣha Sanyās Yog", meaning: "The Yoga of Liberation through Renunciation", verses: 78 },
];

const COMMENTATOR_MAP: Record<string, { author: string; etKey?: string; htKey?: string; ecKey?: string; hcKey?: string }> = {
  sankar: { author: "Sri Shankaracharya", etKey: "et", htKey: "ht" },
  raman: { author: "Sri Ramanuja", etKey: "et" },
  madhav: { author: "Sri Madhavacharya" },
  siva: { author: "Swami Sivananda", etKey: "et", ecKey: "ec" },
  prabhu: { author: "A.C. Bhaktivedanta Swami Prabhupada", etKey: "et", ecKey: "ec" },
  gambir: { author: "Swami Gambirananda", etKey: "et" },
  purohit: { author: "Shri Purohit Swami", etKey: "et" },
  chinmay: { author: "Swami Chinmayananda", hcKey: "hc" },
  tej: { author: "Swami Tejomayananda", htKey: "ht" },
  rams: { author: "Swami Ramsukhdas", htKey: "ht", hcKey: "hc" },
  abhinav: { author: "Sri Abhinav Gupta", etKey: "et" },
  san: { author: "Dr.S.Sankaranarayan", etKey: "et" },
  adi: { author: "Swami Adidevananda", etKey: "et" },
  vallabh: { author: "Sri Vallabhacharya" },
  ms: { author: "Sri Madhusudan Saraswati" },
  srid: { author: "Sri Sridhara Swami" },
  dhan: { author: "Sri Dhanpati" },
  neel: { author: "Sri Neelkanth" },
  puru: { author: "Sri Purushottamji" },
  venkat: { author: "Vedantadeshikacharya Venkatanatha" },
  jaya: { author: "Sri Jayatritha" },
  anand: { author: "Sri Anandgiri" },
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 5): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      console.log(`  Retry ${i+1}/${retries} for ${url}: ${e.message}`);
      if (i < retries - 1) {
        await delay(2000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

export async function seedBhagavadGita() {
  const totalVerses = CHAPTERS.reduce((s, c) => s + c.verses, 0);

  const existingBook = await db.select().from(books).where(eq(books.slug, "bhagavad-gita"));
  let bookId: string;

  let startFromGlobalVerse = 0;

  if (existingBook.length > 0) {
    const existingVerseCount = await db.select({ count: sql<number>`count(*)` }).from(verses).where(eq(verses.bookId, existingBook[0].id));
    const count = Number(existingVerseCount[0].count);
    if (count >= totalVerses) {
      console.log("Bhagavad Gita already seeded, skipping...");
      return;
    }
    console.log(`Bhagavad Gita partially seeded (${count}/${totalVerses}). Resuming from verse ${count + 1}...`);
    bookId = existingBook[0].id;
    startFromGlobalVerse = count;
  } else {
    bookId = "";
  }

  console.log("Seeding Bhagavad Gita - 18 chapters, ~700 verses...");

  const existingLangs = await db.select().from(languages);
  const langCodes = new Set(existingLangs.map(l => l.code));

  if (!langCodes.has("hi")) {
    await db.insert(languages).values({
      code: "hi",
      name: "Hindi",
      nativeName: "हिन्दी",
      script: "Devanagari",
    });
  }
  if (!langCodes.has("sa")) {
    await db.insert(languages).values({
      code: "sa",
      name: "Sanskrit",
      nativeName: "संस्कृतम्",
      script: "Devanagari",
    });
  }
  if (!langCodes.has("en")) {
    await db.insert(languages).values({
      code: "en",
      name: "English",
      nativeName: "English",
      script: "Latin",
    });
  }

  if (!bookId) {
    const [newBook] = await db.insert(books).values({
      slug: "bhagavad-gita",
      title: "श्रीमद्भगवद्गीता",
      author: "Veda Vyasa",
      description: "The Bhagavad Gita (भगवद्गीता), often referred to as the Gita, is a 700-verse Hindu scripture that is part of the epic Mahabharata. It contains a conversation between Pandava prince Arjuna and his guide Lord Krishna on a variety of theological and philosophical issues. Facing a fratricidal war, a despondent Arjuna turns to his charioteer Krishna for counsel on the battlefield. Krishna, through the course of the Gita, imparts to Arjuna wisdom, the path of devotion, and the doctrine of selfless action.",
      category: "Gita",
      totalVerses,
    }).returning();
    bookId = newBook.id;
    console.log(`Created book: ${newBook.title} (ID: ${bookId})`);
  } else {
    console.log(`Using existing book ID: ${bookId}`);
  }

  let globalVerseNumber = 0;

  for (const chapter of CHAPTERS) {
    const chapterStartVerse = globalVerseNumber;
    if (chapterStartVerse + chapter.verses <= startFromGlobalVerse) {
      globalVerseNumber += chapter.verses;
      continue;
    }

    console.log(`Fetching Chapter ${chapter.num}: ${chapter.transliteration} (${chapter.verses} verses)...`);

    for (let v = 1; v <= chapter.verses; v++) {
      globalVerseNumber++;
      if (globalVerseNumber <= startFromGlobalVerse) continue;
      try {
        const data = await fetchWithRetry(`${API_BASE}/slok/${chapter.num}/${v}`);
        await delay(200);

        const sectionTitle = `${chapter.num}.${v}`;

        const [newVerse] = await db.insert(verses).values({
          bookId,
          verseNumber: globalVerseNumber,
          sectionTitle,
          adhyayNumber: chapter.num,
          adhyayTitle: `${chapter.name} - ${chapter.transliteration}`,
          khandaNumber: null,
          khandaTitle: null,
        }).returning();

        if (data.slok) {
          await db.insert(verseTranslations).values({
            verseId: newVerse.id,
            languageCode: "sa",
            content: data.slok,
          });
        }

        if (data.transliteration) {
          await db.insert(verseTranslations).values({
            verseId: newVerse.id,
            languageCode: "en",
            content: data.transliteration,
          });
        }

        for (const [key, config] of Object.entries(COMMENTATOR_MAP)) {
          const commentatorData = data[key];
          if (!commentatorData) continue;

          if (config.etKey && commentatorData[config.etKey]) {
            await db.insert(explanations).values({
              verseId: newVerse.id,
              authorName: config.author,
              authorTitle: "Commentary",
              languageCode: "en",
              content: commentatorData[config.etKey],
            });
          }

          if (config.htKey && commentatorData[config.htKey]) {
            await db.insert(explanations).values({
              verseId: newVerse.id,
              authorName: config.author,
              authorTitle: "Commentary",
              languageCode: "hi",
              content: commentatorData[config.htKey],
            });
          }

          if (config.ecKey && commentatorData[config.ecKey]) {
            await db.insert(explanations).values({
              verseId: newVerse.id,
              authorName: config.author,
              authorTitle: "Detailed Commentary",
              languageCode: "en",
              content: commentatorData[config.ecKey],
            });
          }

          if (config.hcKey && commentatorData[config.hcKey]) {
            await db.insert(explanations).values({
              verseId: newVerse.id,
              authorName: config.author,
              authorTitle: "Detailed Commentary",
              languageCode: "hi",
              content: commentatorData[config.hcKey],
            });
          }

          if (!config.etKey && !config.htKey && !config.ecKey && !config.hcKey) {
            if (commentatorData.sc) {
              await db.insert(explanations).values({
                verseId: newVerse.id,
                authorName: config.author,
                authorTitle: "Commentary",
                languageCode: "sa",
                content: commentatorData.sc,
              });
            }
            if (commentatorData.hd) {
              await db.insert(explanations).values({
                verseId: newVerse.id,
                authorName: config.author,
                authorTitle: "Commentary",
                languageCode: "hi",
                content: commentatorData.hd,
              });
            }
          }
        }

        if (globalVerseNumber % 50 === 0) {
          console.log(`  Progress: ${globalVerseNumber}/${totalVerses} verses seeded`);
        }
      } catch (err) {
        console.error(`  Error fetching verse ${chapter.num}.${v}:`, err);
      }
    }
    console.log(`  Chapter ${chapter.num} complete.`);
  }

  console.log(`Bhagavad Gita seeding complete! ${globalVerseNumber} verses seeded.`);
}
