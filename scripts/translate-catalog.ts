import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const stringsToTranslate = {
  "prasthanaThrayaShankaracharyaBhashya": "Prasthana Thraya - Shankaracharya Bhashya",
  "otherIndependentWorksShankaracharya": "Other Independent Works of Shankaracharya",
  "prasthanaThrayaOtherAdvaitaAcharyas": "Prasthana Thraya - Other Advaita Acharyas",
  "bhakthiStotrasShankaracharya": "Bhakthi Stotras of Shankaracharya",
  "prakaranaGranthas": "Prakarana Granthas",
  "shlokasStothrasAdvaita": "Shlokas, Sthuthis and Stotras based on Advaita",
  "upanishad": "Upanishad",
  "bhagavadGita": "Bhagavad Gita",
  "brahmaSutra": "Brahma Sutra",
  "independentAdvaitaWorks": "Independent Advaita Works",
  "otherGitas": "Other Gitas",
  "bhakthiGranthas": "Bhakthi Granthas",
  "advaitaInOtherLanguages": "Advaita in Other Languages",
  "modernAdvaitaWorks": "Modern Advaita Works",
  "browseTheLibrary": "Browse the Library",
  "comingSoon": "Coming Soon",
  "soon": "Soon",
  "textSingular": "text",
  "textPlural": "texts",
  "ekatmaDham": "Ekatma Dham",
  "abodeOfOneness": "Abode of Oneness",
};

const languages = [
  { code: "hi", name: "Hindi", script: "Devanagari" },
  { code: "sa", name: "Sanskrit", script: "Devanagari" },
  { code: "kn", name: "Kannada", script: "Kannada" },
  { code: "te", name: "Telugu", script: "Telugu" },
  { code: "ta", name: "Tamil", script: "Tamil" },
];

async function translateAll() {
  const results: Record<string, Record<string, string>> = {};
  
  const promises = languages.map(async (lang) => {
    console.error(`Translating to ${lang.name}...`);
    const prompt = `You are an expert translator for Hindu philosophical and spiritual texts. Translate the following strings from English to ${lang.name} (${lang.script} script). These are category names and UI labels for a sacred text reading application focused on Advaita Vedanta and Shankaracharya's works.

IMPORTANT RULES:
1. Use the ${lang.script} script for ALL translations
2. Keep proper nouns like "Shankaracharya", "Advaita", "Vedanta", "Prasthana Thraya", "Bhagavad Gita", "Brahma Sutra", "Upanishad" in their ${lang.script} transliteration
3. For "Ekatma Dham" transliterate to ${lang.script} as "एकात्म धाम" style
4. Make translations natural and culturally appropriate
5. For terms like "Bhashya" (commentary), "Granthas" (texts), "Stotras" (hymns), use standard ${lang.name} equivalents or transliterations

Here are the strings to translate (JSON key -> English value):
${JSON.stringify(stringsToTranslate, null, 2)}

Respond ONLY with a JSON object mapping the same keys to ${lang.name} translations. No explanations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const translated = JSON.parse(response.choices[0].message.content!);
    results[lang.code] = translated;
    console.error(`Done: ${lang.name}`);
  });

  await Promise.all(promises);
  console.log(JSON.stringify(results, null, 2));
}

translateAll().catch(console.error);
