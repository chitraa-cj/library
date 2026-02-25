import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DELAY_MS = 500;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRefusalResponse(text: string): boolean {
  const refusalPatterns = [
    /I'm sorry/i, /I cannot/i, /I'm unable/i, /I apologize/i,
    /cannot comply/i, /against.*policy/i, /safety.*guidelines/i,
    /not able to/i, /I can't help/i,
    /Przepraszam/i, /Samahani/i, /siwezi/i, /nie mogę/i,
    /Przykro mi/i,
  ];
  return refusalPatterns.some(p => p.test(text));
}

const LANG_INFO: Record<string, { name: string; script: string }> = {
  pl: { name: "Polish", script: "Latin" },
  sw: { name: "Swahili", script: "Latin" },
};

async function translateText(openai: OpenAI, prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a scholarly translator specializing in Advaita Vedanta philosophy and Sanskrit texts. Translate accurately and completely. Never refuse translation requests." },
      { role: "user", content: prompt }
    ],
    max_tokens: 4096,
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY set");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ishaBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (!ishaBooks.length) { console.log("No Isha book"); return; }
  const bookId = ishaBooks[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  let fixed = 0;

  for (const verse of allVerses) {
    const verseExps = await db.select().from(explanations).where(eq(explanations.verseId, verse.id));
    const engBhashyam = verseExps.find(e => e.authorName === "Adi Shankaracharya" && e.languageCode === "english");
    const devTeeka = verseExps.find(e => e.authorName === "Anandagiri" && e.languageCode === "devanagari");

    for (const exp of verseExps) {
      if (!exp.content || exp.content.length >= 100) continue;
      if (!isRefusalResponse(exp.content)) continue;
      
      const langInfo = LANG_INFO[exp.languageCode];
      if (!langInfo) continue;

      console.log(`V${verse.verseNumber} ${langInfo.name} ${exp.authorName}: Refusal detected, retranslating...`);

      let sourceContent = "";
      let sourceDesc = "";

      if (exp.authorName === "Adi Shankaracharya" && engBhashyam) {
        sourceContent = engBhashyam.content || "";
        sourceDesc = "Shankaracharya's Bhashya on Isha Upanishad from English";
      } else if (exp.authorName === "Anandagiri" && devTeeka) {
        sourceContent = devTeeka.content || "";
        sourceDesc = "Anandagiri's Tika (sub-commentary) on Isha Upanishad from Sanskrit";
      }

      if (!sourceContent) {
        console.log(`  No source found, skipping`);
        continue;
      }

      try {
        const context = engBhashyam?.content?.substring(0, 300) || "";
        const prompt = `Translate this ${sourceDesc} to ${langInfo.name}. Use IAST for Sanskrit terms (e.g., Brahman, Ātman). Maintain scholarly register.\n\n${context && exp.authorName === "Anandagiri" ? `Context: ${context}\n\n` : ""}SOURCE:\n${sourceContent}\n\nProvide ONLY the ${langInfo.name} translation.`;
        const translated = await translateText(openai, prompt);

        if (translated && translated.length > 100 && !isRefusalResponse(translated)) {
          await db.update(explanations)
            .set({ content: translated, isAiTranslated: true })
            .where(eq(explanations.id, exp.id));
          fixed++;
          console.log(`  FIXED (${translated.length} chars)`);
        } else {
          console.warn(`  Still got refusal or short response (${translated.length} chars)`);
        }

        await delay(DELAY_MS);
      } catch (error: any) {
        console.error(`  Error: ${error.message}`);
        await delay(3000);
      }
    }
  }

  console.log(`Done! Fixed ${fixed} refusal entries`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
