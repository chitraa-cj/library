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

async function translateKannada() {
  const prompt = `You are an expert translator for Hindu philosophical and spiritual texts. Translate the following strings from English to Kannada using ONLY the Kannada script (ಕನ್ನಡ).

CRITICAL: You MUST use Kannada script (ಅ ಆ ಇ ಈ ಉ ಊ etc.) for ALL translations. Do NOT use Gujarati, Devanagari or any other script. Every single character must be in Kannada script.

RULES:
1. Use ONLY Kannada script (ಕನ್ನಡ) for ALL translations
2. Transliterate proper nouns to Kannada script
3. Make translations natural in Kannada

Here are the strings to translate (JSON key -> English value):
${JSON.stringify(stringsToTranslate, null, 2)}

Respond ONLY with a JSON object mapping the same keys to Kannada translations. No explanations.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const translated = JSON.parse(response.choices[0].message.content!);
  console.log(JSON.stringify(translated, null, 2));
}

translateKannada().catch(console.error);
