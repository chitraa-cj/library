import OpenAI from "openai";
import fs from "fs";

const SOURCE_TEXT = `Bahūnām, among many-of many sons or disciples; emi, I go (rank); prathamah, as first, that is to say, through the foremost conduct of a disciple etc. And bahūnām, among many-many middling ones; madhyamah emi, I move (count) as a middling one, I behave through the middling conduct. But never do I behave as the worst.1 Though I am a son possessed of such quality, still to me my father has said, "To Death I shall offer you," Kim svit, what; kartavyam, purpose; yamasya, of Death-can there be; which purpose he (my father) adya, today; karişyati, will achieve; mayā, through me, by sending me? "My father must have certainly spoken so out of anger without any consideration of purpose. Still the words of that father must not be falsified", thinking thus, he said sorrowfully to his father, remorseful as the latter was because of the thought, "What a thing I have uttered!"`;

const PROMPTS = [
  {
    name: "Prompt A: Direct Scholarly Translation",
    build: (lang: string, script: string) => ({
      system: "You are an expert Sanskrit scholar specializing in Advaita Vedanta philosophy.",
      user: `Translate this Shankaracharya's Bhashya on Katha Upanishad from English to ${lang}. Write in ${script} script. Keep Sanskrit technical terms in ${script} script. Maintain scholarly register.\n\nSOURCE:\n${SOURCE_TEXT}\n\nProvide ONLY the ${lang} translation.`
    }),
  },
  {
    name: "Prompt B: Contextual + Meaning-Focused",
    build: (lang: string, script: string) => ({
      system: `You are a renowned Sanskrit-to-${lang} translator who has spent decades translating Vedantic commentaries. Your translations are known for capturing both the philosophical depth and natural ${lang} readability.`,
      user: `Translate the following Shankaracharya Bhashya (commentary) on the Katha Upanishad into ${lang}.\n\nIMPORTANT INSTRUCTIONS:\n- Translate the MEANING, not word-by-word. The ${lang} should read naturally as if originally written in ${lang}.\n- Preserve Sanskrit philosophical terms (Brahman, Atman, etc.) in ${script} script.\n- Provide context where the original assumes familiarity with the narrative (e.g., mention Nachiketa, Yama by name).\n- Maintain the philosophical precision and scholarly tone.\n\nEnglish Bhashya:\n${SOURCE_TEXT}\n\n${lang} translation:`
    }),
  },
  {
    name: "Prompt C: Paraphrase + Explain Style",
    build: (lang: string, script: string) => ({
      system: `You are a ${lang} scholar who specializes in making ancient Indian philosophical texts accessible to modern ${lang} readers while maintaining their depth and accuracy.`,
      user: `Below is Adi Shankaracharya's commentary (Bhashya) on a verse from the Katha Upanishad, in English. Translate it into clear, natural ${lang} that an educated ${lang} reader would find easy to understand.\n\nGuidelines:\n1. Do NOT translate word-by-word from English. Understand the meaning and express it naturally in ${lang}.\n2. Keep Sanskrit terms like Brahman, Atman, Nachiketa, Yama etc. in their original ${script} form.\n3. Where the English is awkward or unclear, refer to what Shankaracharya likely meant in the original Sanskrit context and express that clearly.\n4. The tone should be scholarly but readable.\n\nEnglish source:\n${SOURCE_TEXT}\n\n${lang} translation:`
    }),
  },
  {
    name: "Prompt D: Two-Step (Understand then Translate)",
    build: (lang: string, script: string) => ({
      system: `You are a bilingual Sanskrit-${lang} scholar with expertise in Advaita Vedanta. You first deeply understand texts before translating them.`,
      user: `I need you to translate Shankaracharya's Bhashya on the Katha Upanishad from English to ${lang}.\n\nStep 1: First, internally understand what this passage is saying - who is speaking, what philosophical point is being made, and what the narrative context is.\n\nStep 2: Then write a natural, fluent ${lang} translation that captures the full meaning. Do not produce a word-by-word translation. The ${lang} should sound like it was written by a ${lang}-speaking Vedanta scholar.\n\nPreserve Sanskrit philosophical terms in ${script}. Maintain scholarly precision.\n\nEnglish Bhashya:\n${SOURCE_TEXT}\n\nProvide ONLY the final ${lang} translation (not the understanding step):`
    }),
  },
  {
    name: "Prompt E: Reference-Aware + Narrative Context",
    build: (lang: string, script: string) => ({
      system: `You are translating Adi Shankaracharya's commentary on the Katha Upanishad for a ${lang}-language scholarly publication. The Katha Upanishad narrates the dialogue between young Nachiketa and Yama (the lord of death). Shankaracharya's bhashya explains each verse's deeper Vedantic meaning.`,
      user: `Translate the following English rendering of Shankaracharya's Bhashya into ${lang}.\n\nTranslation principles:\n- Produce a meaning-faithful ${lang} rendering, NOT a literal word-by-word translation\n- The ${lang} must flow naturally and be self-contained (a ${lang} reader should understand it without referring to the English)\n- Use proper ${lang} grammatical structures and idiomatic expressions\n- Keep all Sanskrit technical terms and proper nouns in ${script} (e.g., Nachiketa, Yama, Brahman, Atman, Karma)\n- Where the English says things like "the son" or "Death", use the actual names for clarity\n- Maintain the philosophical depth and scholarly register\n\nEnglish Bhashya:\n${SOURCE_TEXT}\n\n${lang} translation:`
    }),
  },
];

const LANGUAGES = [
  { name: "Hindi", script: "Devanagari" },
  { name: "Tamil", script: "Tamil" },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let markdown = "# Prompt Comparison: Katha Upanishad Bhashya — Hindi & Tamil\n\n";
  markdown += "Generated: " + new Date().toISOString() + "\n\n";
  markdown += "## English Source\n\n";
  markdown += SOURCE_TEXT + "\n\n";
  markdown += "---\n\n";

  for (const lang of LANGUAGES) {
    markdown += `## ${lang.name} Translations\n\n`;

    for (const prompt of PROMPTS) {
      console.log(`Running: ${prompt.name} → ${lang.name}...`);
      const p = prompt.build(lang.name, lang.script);
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
        console.log(`  -> ${translation.length} chars`);
        markdown += `### ${prompt.name}\n\n`;
        markdown += translation + "\n\n";
      } catch (err: any) {
        console.error(`  ERROR: ${err.message}`);
        markdown += `### ${prompt.name}\n\nERROR: ${err.message}\n\n`;
      }
    }
    markdown += "---\n\n";
  }

  fs.writeFileSync("data/prompt-comparison-katha-v2.md", markdown);
  console.log("\nResults written to data/prompt-comparison-katha-v2.md");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
