import OpenAI from "openai";
import fs from "fs";

const SOURCE_TEXT = `Bahūnām, among many-of many sons or disciples; emi, I go (rank); prathamah, as first, that is to say, through the foremost conduct of a disciple etc. And bahūnām, among many-many middling ones; madhyamah emi, I move (count) as a middling one, I behave through the middling conduct. But never do I behave as the worst.1 Though I am a son possessed of such quality, still to me my father has said, "To Death I shall offer you," Kim svit, what; kartavyam, purpose; yamasya, of Death-can there be; which purpose he (my father) adya, today; karişyati, will achieve; mayā, through me, by sending me? "My father must have certainly spoken so out of anger without any consideration of purpose. Still the words of that father must not be falsified", thinking thus, he said sorrowfully to his father, remorseful as the latter was because of the thought, "What a thing I have uttered!"`;

const PROMPTS = [
  {
    name: "Prompt A: शुद्ध Hindi with Sanskrit References — Scholarly",
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
    name: "Prompt B: शुद्ध Hindi with Sanskrit References — Contextual Narrative",
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
    name: "Prompt C: शुद्ध Hindi with Sanskrit References — Accessible Scholarly",
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
    name: "Prompt D: शुद्ध Hindi with Sanskrit References — Deep Understanding",
    build: (lang: string, script: string) => ({
      system: `You are a bilingual Sanskrit-${lang} scholar with deep expertise in Advaita Vedanta. You first understand texts deeply, then rewrite them in शुद्ध (pure) contemporary ${lang} with original Sanskrit reference terms embedded inline.`,
      user: `Rewrite this Shankaracharya Bhashya on the Katha Upanishad in contemporary शुद्ध ${lang}.

Step 1: Internally understand the passage — who is speaking (नचिकेता), what is the narrative context, what philosophical point is being made.

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
    name: "Prompt E: शुद्ध Hindi with Sanskrit References — Narrative-Aware",
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
  if (!process.env.OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY");
    return;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let markdown = "# Prompt Comparison v3: शुद्ध Hindi & Tamil with Sanskrit References\n\n";
  markdown += "Generated: " + new Date().toISOString() + "\n\n";
  markdown += "## English Source\n\n";
  markdown += SOURCE_TEXT + "\n\n";
  markdown += "---\n\n";

  for (const lang of LANGUAGES) {
    markdown += `## ${lang.name} Translations (शुद्ध contemporary with Sanskrit references)\n\n`;

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

  fs.writeFileSync("data/prompt-comparison-katha-v3.md", markdown);
  console.log("\nResults written to data/prompt-comparison-katha-v3.md");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
