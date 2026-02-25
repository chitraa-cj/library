import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const SOURCE_TEXT = process.argv[2] || "";

if (!SOURCE_TEXT) {
  console.log(`
Usage: npx tsx server/translate-bhashya.ts "YOUR ENGLISH BHASHYA TEXT HERE"

Example:
  npx tsx server/translate-bhashya.ts "Eşah, this-the Self about whom you ask me..."

Output will be saved to data/bhashya-translation-<timestamp>.md
`);
  process.exit(0);
}

const PROMPTS = [
  {
    name: "Prompt A: शुद्ध — Scholarly",
    build: (lang: string, script: string) => ({
      system: "You are an expert Sanskrit scholar specializing in Advaita Vedanta philosophy. You write in शुद्ध (pure) contemporary Hindi using modern grammatical constructs while preserving the philosophical precision of the original.",
      user: `Rewrite this Shankaracharya Bhashya on the Katha Upanishad using contemporary शुद्ध ${lang} constructs. 

CRITICAL RULES:
1. Write in शुद्ध (pure, refined) contemporary ${lang} — NOT colloquial, NOT literal word-by-word translation
2. For EVERY key Sanskrit term, include the original word with transliteration inline, like: बहूनां (Bahūnām) – अनेक पुत्रों या शिष्यों के बीच; एमि (emi) – मैं स्थान रखता हूँ
3. The ${lang} prose should flow naturally between these reference terms
4. Use ${script} script throughout
5. Maintain scholarly register and philosophical depth

SOURCE (English):
${SOURCE_TEXT}

Provide ONLY the ${lang} rewrite with inline Sanskrit references:`
    }),
  },
  {
    name: "Prompt B: शुद्ध — Contextual Narrative",
    build: (lang: string, script: string) => ({
      system: `You are a renowned Vedantic translator known for making Shankaracharya's commentaries accessible in शुद्ध (pure) contemporary ${lang}. You always include original Sanskrit terms with transliterations as inline references, and you name characters (नचिकेता, यमराज) explicitly for clarity.`,
      user: `Rewrite this Shankaracharya Bhashya on the Katha Upanishad in contemporary शुद्ध ${lang}.

CRITICAL RULES:
1. Use शुद्ध (pure, refined) modern ${lang} — the text should read naturally as contemporary scholarly ${lang}
2. Include original Sanskrit reference words inline with transliteration, e.g.: बहूनां (Bahūnām) – अनेक पुत्रों या शिष्यों के बीच; प्रथमः (prathamah) – प्रथम श्रेणी में
3. Name characters explicitly: use नचिकेता instead of "the son", यमराज instead of "Death"
4. Provide narrative context where needed so a ${lang} reader understands the story
5. Write in ${script} script, maintain philosophical precision

SOURCE (English):
${SOURCE_TEXT}

${lang} rewrite with inline Sanskrit references:`
    }),
  },
  {
    name: "Prompt C: शुद्ध — Accessible Scholarly",
    build: (lang: string, script: string) => ({
      system: `You are a ${lang} scholar who makes ancient Indian philosophical texts accessible to modern educated ${lang} readers. You write in शुद्ध (pure) contemporary ${lang} and always embed original Sanskrit terms with their transliterations as reference anchors within the text.`,
      user: `Rewrite Adi Shankaracharya's Bhashya on the Katha Upanishad in clear, contemporary शुद्ध ${lang}.

CRITICAL FORMAT:
- Every key Sanskrit word must appear inline with transliteration: e.g., बहूनां (Bahūnām) – अनेक पुत्रों में; एमि (emi) – मैं जाता हूँ; प्रथमः (prathamah) – प्रथम
- Between these reference anchors, write flowing, natural शुद्ध ${lang} prose
- Do NOT translate word-by-word from English — understand the meaning and express it in contemporary ${lang}
- Where the English is awkward, express what Shankaracharya meant in natural ${lang}
- Use ${script} script, scholarly but readable tone

SOURCE (English):
${SOURCE_TEXT}

${lang} rewrite:`
    }),
  },
  {
    name: "Prompt D: शुद्ध — Deep Understanding",
    build: (lang: string, script: string) => ({
      system: `You are a bilingual Sanskrit-${lang} scholar with deep expertise in Advaita Vedanta. You first understand texts deeply, then rewrite them in शुद्ध (pure) contemporary ${lang} with original Sanskrit reference terms embedded inline.`,
      user: `Rewrite this Shankaracharya Bhashya on the Katha Upanishad in contemporary शुद्ध ${lang}.

Step 1: Internally understand the passage — who is speaking (नचिकेता/यमराज), what is the narrative context, what philosophical point is being made.

Step 2: Rewrite in शुद्ध contemporary ${lang} following these rules:
- Include original Sanskrit terms with transliteration inline: बहूनां (Bahūnām) – अनेक; एमि (emi) – मैं जाता हूँ; कर्तव्यम् (kartavyam) – प्रयोजन
- Write flowing contemporary ${lang} prose between these reference terms  
- Do NOT produce word-by-word translation — the output should sound like a modern ${lang} Vedantic scholar wrote it
- Use ${script} script throughout

SOURCE (English):
${SOURCE_TEXT}

Provide ONLY the final ${lang} rewrite (not the understanding step):`
    }),
  },
  {
    name: "Prompt E: शुद्ध — Narrative-Aware",
    build: (lang: string, script: string) => ({
      system: `You are rewriting Adi Shankaracharya's commentary on the Katha Upanishad for a ${lang}-language scholarly publication. The Katha Upanishad narrates the dialogue between young नचिकेता (Nachiketa) and यमराज (Yama). You write in शुद्ध (pure) contemporary ${lang} and always anchor your text with original Sanskrit reference words.`,
      user: `Rewrite the following English rendering of Shankaracharya's Bhashya in contemporary शुद्ध ${lang}.

TRANSLATION PRINCIPLES:
1. शुद्ध contemporary ${lang}: Use refined modern ${lang} grammatical constructs, NOT literal English translation
2. Sanskrit reference anchors: Embed original terms inline — e.g., बहूनां (Bahūnām) – अनेक पुत्रों या शिष्यों में; एमि (emi) – मैं स्थान रखता हूँ; प्रथमः (prathamah) – प्रथम श्रेणी में
3. Character names: Use नचिकेता (not "the son"), यमराज (not "Death")
4. Self-contained: A ${lang} reader should understand the passage without referring to English
5. ${script} script, scholarly register, philosophical precision

SOURCE (English):
${SOURCE_TEXT}

${lang} rewrite:`
    }),
  },
];

const LANGUAGES = [
  { name: "Hindi", script: "Devanagari" },
  { name: "Tamil", script: "Tamil" },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("Error: GEMINI_API_KEY not set");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  let markdown = `# Bhashya Translation Output (Gemini)\n\n`;
  markdown += `Model: gemini-2.0-flash\n`;
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `## English Source\n\n${SOURCE_TEXT}\n\n---\n\n`;

  for (const lang of LANGUAGES) {
    markdown += `## ${lang.name} Translations\n\n`;
    for (const prompt of PROMPTS) {
      console.log(`${prompt.name} → ${lang.name}...`);
      const p = prompt.build(lang.name, lang.script);
      const fullPrompt = `${p.system}\n\n${p.user}`;
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        });
        const translation = result.response.text() || "";
        console.log(`  ✓ ${translation.length} chars`);
        markdown += `### ${prompt.name}\n\n${translation}\n\n`;
      } catch (err: any) {
        console.error(`  ✗ ${err.message}`);
        markdown += `### ${prompt.name}\n\nERROR: ${err.message}\n\n`;
      }
    }
    markdown += "---\n\n";
  }

  const outFile = `data/bhashya-translation-${timestamp}.md`;
  fs.writeFileSync(outFile, markdown);
  console.log(`\nDone! Output: ${outFile}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
