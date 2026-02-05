import OpenAI from "openai";

// Using gpt-4o-mini for faster responses while maintaining quality
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
    devanagari: "Sanskrit",
    english: "English",
    kannada: "Kannada",
    tamil: "Tamil",
    telugu: "Telugu",
  };

  const sourceLang = languageNames[sourceLanguage] || sourceLanguage;
  const targetLang = languageNames[targetLanguage] || targetLanguage;

  // Truncate context to reduce token count for faster processing
  const truncatedVerse = verseContext.slice(0, 300);
  const truncatedCommentary = commentaryContext.slice(0, 500);

  const prompt = `Sanskrit scholar: Analyze "${word}" from Īśāvāsyopaniṣad.
Source: ${sourceLang} → Target: ${targetLang}

Context: ${truncatedVerse}
Commentary: ${truncatedCommentary}

JSON response:
{"translation":"${targetLang} meaning","grammaticalInfo":"root, formation, case/gender/tense","etymology":"word origin","contextualMeaning":"Advaita interpretation"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
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
