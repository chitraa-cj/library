import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DELAY_MS = 400;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SOUTH_INDIAN_LANGS = [
  { code: "kannada", name: "Kannada", script: "Kannada" },
  { code: "telugu", name: "Telugu", script: "Telugu" },
  { code: "tamil", name: "Tamil", script: "Tamil" },
];

function isRefusalResponse(text: string): boolean {
  const refusalPatterns = [
    /I'm sorry/i, /I cannot/i, /I'm unable/i, /I apologize/i,
    /cannot comply/i, /against.*policy/i, /safety.*guidelines/i,
    /not able to/i, /I can't help/i,
    /Przepraszam/i, /Samahani/i,
  ];
  return refusalPatterns.some(p => p.test(text));
}

function isActualTranslation(content: string, langCode: string): boolean {
  if (!content || content.length < 100) return false;
  const teluguNativeWords = /అనగా|అంటే|కాబట్టి|ఎందుకంటే|వివరిస్తా|అయితే|చేయబడ|ఉపయోగించ|మరియు|కారణం|అందువల్ల|ద్వారా|ఎందుకు|వారు|అది/;
  const kannadaNativeWords = /ಅಂದರೆ|ಏಕೆಂದರೆ|ಆದ್ದರಿಂದ|ವಿವರಿಸ|ಆಗಿದೆ|ಮಾಡಲಾ|ಬಳಸಲಾ|ಮತ್ತು|ಕಾರಣ|ಅವರು|ಅದು|ಹೇಗೆ|ಇದು/;
  const tamilNativeWords = /என்று|ஏனெனில்|ஆகையால்|விளக்கு|ஆகும்|செய்யப்|பயன்படுத்|மற்றும்|காரணம்|அவர்கள்|அது|எப்படி|இது/;

  if (langCode === "telugu") return teluguNativeWords.test(content);
  if (langCode === "kannada") return kannadaNativeWords.test(content);
  if (langCode === "tamil") return tamilNativeWords.test(content);
  return false;
}

async function translateText(openai: OpenAI, prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a scholarly translator specializing in Advaita Vedanta philosophy. Translate the given text accurately and completely into the requested language." },
      { role: "user", content: prompt }
    ],
    max_tokens: 4096,
    temperature: 0.3,
  });
  const content = response.choices[0].message.content || "";
  if (isRefusalResponse(content)) {
    console.warn(`Refusal detected, retrying...`);
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a scholarly translator. Translate the given text accurately." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4096,
      temperature: 0.5,
    });
    const retryContent = retryResponse.choices[0].message.content || "";
    if (isRefusalResponse(retryContent)) return "";
    return retryContent;
  }
  return content;
}

export async function fixSouthIndianTranslations() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[Fix South Indian] No OPENAI_API_KEY set, skipping");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ishaBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (ishaBooks.length === 0) {
    console.log("[Fix South Indian] No Isha Upanishad book found");
    return;
  }
  const bookId = ishaBooks[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  console.log(`[Fix South Indian] Found ${allVerses.length} Isha verses`);

  let updated = 0;

  for (const verse of allVerses) {
    const verseExps = await db.select().from(explanations).where(eq(explanations.verseId, verse.id));
    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");

    if (!engBhashyam) {
      console.log(`[Fix South Indian] V${verse.verseNumber}: No English bhashya found, skipping`);
      continue;
    }

    for (const lang of SOUTH_INDIAN_LANGS) {
      const existing = verseExps.find(
        e => e.authorName === "Adi Shankaracharya" && e.languageCode === lang.code
      );

      if (existing && isActualTranslation(existing.content || "", lang.code)) {
        console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: Already has actual translation, skipping`);
        continue;
      }

      const action = existing ? "UPDATING" : "INSERTING";
      console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: ${action}...`);

      try {
        const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Shankaracharya's Bhashya on Isha Upanishad from English into ${lang.name} language. 

IMPORTANT: Write the translation as actual ${lang.name} LANGUAGE text that a ${lang.name}-speaking person can read and understand. Do NOT simply transliterate the Sanskrit into ${lang.script} script. The output must be natural ${lang.name} prose.

Write in ${lang.script} script. Keep Sanskrit technical terms (like Brahman, Atman, Parameshwara, etc.) in ${lang.script} script. Maintain scholarly register and philosophical precision.

SOURCE (English):
${engBhashyam.content}

Provide ONLY the ${lang.name} language translation:`;
        const translated = await translateText(openai, prompt);

        if (translated && !isRefusalResponse(translated) && translated.length > 150) {
          if (existing) {
            await db.update(explanations)
              .set({ content: translated, isAiTranslated: true })
              .where(eq(explanations.id, existing.id));
          } else {
            await db.insert(explanations).values({
              verseId: verse.id,
              languageCode: lang.code,
              authorName: "Adi Shankaracharya",
              content: translated,
              isAiTranslated: true,
            });
          }
          updated++;
          console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: DONE (${translated.length} chars)`);
        } else {
          console.warn(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: Translation too short or refused`);
        }

        await delay(DELAY_MS);
      } catch (error: any) {
        console.error(`[Fix South Indian] V${verse.verseNumber} ${lang.name} error: ${error.message}`);
        await delay(3000);
      }
    }
  }

  console.log(`[Fix South Indian] Done! Updated ${updated} translations`);
}

fixSouthIndianTranslations().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
