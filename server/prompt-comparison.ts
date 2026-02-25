import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";

const PROMPTS = [
  {
    name: "Prompt A: Direct Scholarly Translation",
    build: (engText: string) => ({
      system: "You are an expert Sanskrit scholar specializing in Advaita Vedanta philosophy.",
      user: `Translate this Shankaracharya's Bhashya on Katha Upanishad from English to Hindi. Write in Devanagari script. Keep Sanskrit technical terms in Devanagari. Maintain scholarly register.\n\nSOURCE:\n${engText}\n\nProvide ONLY the Hindi translation.`
    }),
  },
  {
    name: "Prompt B: Contextual + Meaning-Focused",
    build: (engText: string) => ({
      system: "You are a renowned Sanskrit-to-Hindi translator who has spent decades translating Vedantic commentaries for Indian universities. Your translations are known for capturing both the philosophical depth and natural Hindi readability.",
      user: `Translate the following Shankaracharya Bhashya (commentary) on the Katha Upanishad into Hindi.\n\nIMPORTANT INSTRUCTIONS:\n- Translate the MEANING, not word-by-word. The Hindi should read naturally as if originally written in Hindi.\n- Preserve Sanskrit philosophical terms (Brahman, Atman, etc.) in Devanagari script.\n- Provide context where the original assumes familiarity with the narrative (e.g., mention Nachiketa, Yama by name).\n- Maintain the philosophical precision and scholarly tone.\n\nEnglish Bhashya:\n${engText}\n\nHindi translation:`
    }),
  },
  {
    name: "Prompt C: Paraphrase + Explain Style",
    build: (engText: string) => ({
      system: "You are a Hindi scholar who specializes in making ancient Indian philosophical texts accessible to modern Hindi readers while maintaining their depth and accuracy.",
      user: `Below is Adi Shankaracharya's commentary (Bhashya) on a verse from the Katha Upanishad, in English. Translate it into clear, natural Hindi that a educated Hindi reader would find easy to understand.\n\nGuidelines:\n1. Do NOT translate word-by-word from English. Understand the meaning and express it naturally in Hindi.\n2. Keep Sanskrit terms like ब्रह्मन्, आत्मन्, मृत्यु, नचिकेता etc. in their original Devanagari form.\n3. Where the English is awkward or unclear, refer to what Shankaracharya likely meant in the original Sanskrit context and express that clearly.\n4. The tone should be scholarly but readable.\n\nEnglish source:\n${engText}\n\nHindi translation:`
    }),
  },
  {
    name: "Prompt D: Two-Step (Understand then Translate)",
    build: (engText: string) => ({
      system: "You are a bilingual Sanskrit-Hindi scholar with expertise in Advaita Vedanta. You first deeply understand texts before translating them.",
      user: `I need you to translate Shankaracharya's Bhashya on the Katha Upanishad from English to Hindi.\n\nStep 1: First, internally understand what this passage is saying - who is speaking, what philosophical point is being made, and what the narrative context is.\n\nStep 2: Then write a natural, fluent Hindi translation that captures the full meaning. Do not produce a word-by-word translation. The Hindi should sound like it was written by a Hindi-speaking Vedanta scholar.\n\nPreserve Sanskrit philosophical terms in Devanagari. Maintain scholarly precision.\n\nEnglish Bhashya:\n${engText}\n\nProvide ONLY the final Hindi translation (not the understanding step):`
    }),
  },
  {
    name: "Prompt E: Reference-Aware + Narrative Context",
    build: (engText: string) => ({
      system: "You are translating Adi Shankaracharya's commentary on the Katha Upanishad for a Hindi-language scholarly publication. The Katha Upanishad narrates the dialogue between young Nachiketa (नचिकेता) and Yama (यमराज), the lord of death. Shankaracharya's bhashya explains each verse's deeper Vedantic meaning.",
      user: `Translate the following English rendering of Shankaracharya's Bhashya into Hindi.\n\nTranslation principles:\n- Produce a meaning-faithful Hindi rendering, NOT a literal word-by-word translation\n- The Hindi must flow naturally and be self-contained (a Hindi reader should understand it without referring to the English)\n- Use proper Hindi grammatical structures and idiomatic expressions\n- Keep all Sanskrit technical terms and proper nouns in Devanagari (e.g., नचिकेता, यमराज, ब्रह्म, आत्मा, कर्म)\n- Where the English says things like "the son" or "Death", use the actual names नचिकेता and यमराज for clarity\n- Maintain the philosophical depth and scholarly register\n\nEnglish Bhashya:\n${engText}\n\nHindi translation:`
    }),
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const kathaBooks = await db.select().from(books).where(eq(books.slug, "katha-upanishad-bhashya"));
  if (!kathaBooks.length) { console.log("No Katha book"); return; }
  const bookId = kathaBooks[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => a.verseNumber - b.verseNumber);

  // Find the verse with "son alone in himself" text (V5)
  let targetVerse1: typeof allVerses[0] | null = null;
  let engText1 = "";
  for (const v of allVerses) {
    const exps = await db.select().from(explanations).where(
      and(eq(explanations.verseId, v.id), eq(explanations.languageCode, "en"))
    );
    if (exps.length && (exps[0].content || "").includes("son alone in himself")) {
      targetVerse1 = v;
      engText1 = exps[0].content || "";
      break;
    }
  }

  // First verse (verse 4)
  const v4 = allVerses[0];
  const exps4 = await db.select().from(explanations).where(
    and(eq(explanations.verseId, v4.id), eq(explanations.languageCode, "en"))
  );
  const engText2 = exps4.length ? (exps4[0].content || "") : "";

  const texts = [
    { label: targetVerse1 ? `Verse ${targetVerse1.verseNumber} (son alone in himself)` : "Text 1", text: engText1 },
    { label: `Verse ${v4.verseNumber} (first sloka)`, text: engText2 },
  ];

  const results: any[] = [];

  for (const textInfo of texts) {
    if (!textInfo.text) {
      console.log("Skipping " + textInfo.label + " - no text found");
      continue;
    }
    console.log("\n========================================");
    console.log("TEXT: " + textInfo.label);
    console.log("English source (" + textInfo.text.length + " chars):");
    console.log(textInfo.text.substring(0, 200) + "...");
    console.log("========================================\n");

    const textResults: any = { label: textInfo.label, source: textInfo.text, translations: [] };

    for (const prompt of PROMPTS) {
      console.log("Running: " + prompt.name + "...");
      const p = prompt.build(textInfo.text);
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: p.system },
            { role: "user", content: p.user },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        });
        const translation = response.choices[0].message.content || "";
        console.log("  -> " + translation.length + " chars");
        textResults.translations.push({
          promptName: prompt.name,
          translation: translation,
        });
      } catch (err: any) {
        console.error("  ERROR: " + err.message);
        textResults.translations.push({
          promptName: prompt.name,
          translation: "ERROR: " + err.message,
        });
      }
    }
    results.push(textResults);
  }

  // Write results to a file
  let markdown = "# Prompt Comparison: Katha Upanishad Hindi Translation\n\n";
  markdown += "Generated: " + new Date().toISOString() + "\n\n";

  for (const r of results) {
    markdown += "---\n\n";
    markdown += "## " + r.label + "\n\n";
    markdown += "### English Source\n\n";
    markdown += r.source + "\n\n";

    for (const t of r.translations) {
      markdown += "### " + t.promptName + "\n\n";
      markdown += t.translation + "\n\n";
    }
  }

  fs.writeFileSync("data/prompt-comparison-katha.md", markdown);
  console.log("\nResults written to data/prompt-comparison-katha.md");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
