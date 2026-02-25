import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DELAY_MS = 500;

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

function isSanskritTransliteration(content: string, langCode: string): boolean {
  const sanskritPatterns = [
    /इत्यादयो मन्त्राः/,
    /ইত্যাদয়ো মন্ত্রাঃ/,
    /ఇత్యాదయో మన్త్రాః/,
    /ಇತ್ಯಾದಯೋ ಮಂತ್ರಾಃ/,
    /இத்யாதயோ மந்த்ரா/,
    /कर्मस्वविनियुक्ताः/,
    /కర్మస్వవినియుక్తాః/,
    /ಕರ್ಮಸ್ವವಿನಿಯುಕ್ತಾಃ/,
    /கர்மஸ்வவிநியுக்தா/,
    /तेषामकर्मशेषस्य/,
    /తేషామకర్మశేషస్య/,
    /ತೇಷಾಮಕರ್ಮಶೇಷಸ್ಯ/,
    /तद्विरोधात्कर्मसु/,
    /తద్విరోధాత్కర్మసు/,
    /ತದ್ವಿರೋಧಾತ್ಕರ್ಮಸು/,
  ];
  return sanskritPatterns.some(p => p.test(content));
}

async function translateText(openai: OpenAI, prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
    temperature: 0.3,
  });
  const content = response.choices[0].message.content || "";
  if (isRefusalResponse(content)) {
    console.warn(`Refusal detected, retrying with system message...`);
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a scholarly translator specializing in Advaita Vedanta philosophy. Translate the given text accurately and completely." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4096,
      temperature: 0.5,
    });
    const retryContent = retryResponse.choices[0].message.content || "";
    if (isRefusalResponse(retryContent)) {
      console.warn(`Refusal persisted on retry`);
      return "";
    }
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

      if (!existing) {
        console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: No entry found, will insert`);
        try {
          const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Shankaracharya's Bhashya on Isha Upanishad from English to ${lang.name}. Write in ${lang.script} script. Keep Sanskrit technical terms (Brahman, Atman, etc.) in ${lang.script} script. Maintain scholarly register and philosophical precision.\n\nSOURCE:\n${engBhashyam.content}\n\nProvide ONLY the ${lang.name} translation.`;
          const translated = await translateText(openai, prompt);
          if (translated && !isRefusalResponse(translated)) {
            await db.insert(explanations).values({
              verseId: verse.id,
              languageCode: lang.code,
              authorName: "Adi Shankaracharya",
              content: translated,
              isAiTranslated: true,
            });
            updated++;
            console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: INSERTED (${translated.length} chars)`);
          }
          await delay(DELAY_MS);
        } catch (error: any) {
          console.error(`[Fix South Indian] V${verse.verseNumber} ${lang.name} insert error: ${error.message}`);
          await delay(3000);
        }
        continue;
      }

      const needsUpdate = isSanskritTransliteration(existing.content || "", lang.code) ||
                           (existing.content || "").length < 200;

      if (!needsUpdate) {
        console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: Already has proper translation (${(existing.content || "").length} chars), skipping`);
        continue;
      }

      console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: Transliterated Sanskrit detected (${(existing.content || "").length} chars), replacing...`);

      try {
        const prompt = `You are an expert Sanskrit scholar specializing in Advaita Vedanta. Translate this Shankaracharya's Bhashya on Isha Upanishad from English to ${lang.name}. Write in ${lang.script} script. Keep Sanskrit technical terms (Brahman, Atman, etc.) in ${lang.script} script. Maintain scholarly register and philosophical precision.\n\nSOURCE:\n${engBhashyam.content}\n\nProvide ONLY the ${lang.name} translation.`;
        const translated = await translateText(openai, prompt);

        if (translated && !isRefusalResponse(translated) && translated.length > 200) {
          await db.update(explanations)
            .set({ content: translated, isAiTranslated: true })
            .where(eq(explanations.id, existing.id));
          updated++;
          console.log(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: UPDATED (${(existing.content || "").length} → ${translated.length} chars)`);
        } else {
          console.warn(`[Fix South Indian] V${verse.verseNumber} ${lang.name}: Translation too short or refused, skipping`);
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
