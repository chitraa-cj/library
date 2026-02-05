import OpenAI from "openai";

// Using gpt-4o for reliable access
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface WordTranslationResult {
  word: string;
  translation: string;
  grammaticalInfo: string;
  etymology: string;
  contextualMeaning: string;
}

export async function translateWord(
  word: string,
  sourceLanguage: string,
  targetLanguage: string,
  verseContext: string,
  commentaryContext: string
): Promise<WordTranslationResult> {
  const languageNames: Record<string, string> = {
    devanagari: "Sanskrit (Devanagari script)",
    english: "English",
    kannada: "Kannada",
    tamil: "Tamil",
    telugu: "Telugu",
  };

  const sourceLang = languageNames[sourceLanguage] || sourceLanguage;
  const targetLang = languageNames[targetLanguage] || targetLanguage;

  const prompt = `You are an expert Sanskrit scholar specializing in Vedantic texts, particularly the Isha Upanishad with Shankaracharya's Bhashya (commentary) and Anandagiri's Tika (sub-commentary).

Analyze the following word from a sacred text and provide a detailed translation and explanation.

Word to analyze: "${word}"
Source language: ${sourceLang}
Target language: ${targetLang}

Verse context:
${verseContext}

Commentary context (Shankaracharya Bhashya):
${commentaryContext}

Please provide your response in JSON format with these fields:
{
  "translation": "The direct translation of the word in ${targetLang}",
  "grammaticalInfo": "Grammatical analysis including: root word (dhatu), word formation, case/gender/number for nouns, tense/mood/voice for verbs, compound analysis if applicable",
  "etymology": "The etymology and derivation of the word, including Sanskrit roots and their meanings",
  "contextualMeaning": "The deeper philosophical meaning of this word in the context of Advaita Vedanta and how Shankaracharya interprets it in his commentary"
}

Be precise, scholarly, and respect the traditional interpretations while making the content accessible.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content);
    
    return {
      word,
      translation: result.translation || "Translation not available",
      grammaticalInfo: result.grammaticalInfo || "",
      etymology: result.etymology || "",
      contextualMeaning: result.contextualMeaning || "",
    };
  } catch (error) {
    console.error("OpenAI translation error:", error);
    throw new Error("Failed to translate word");
  }
}
