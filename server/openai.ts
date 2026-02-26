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
    english: "English", en: "English",
    kannada: "Kannada", kn: "Kannada",
    tamil: "Tamil", ta: "Tamil",
    telugu: "Telugu", te: "Telugu",
    hindi: "Hindi", hi: "Hindi",
    german: "German", de: "German",
    french: "French", fr: "French",
    spanish: "Spanish", es: "Spanish",
    mandarin: "Mandarin Chinese", zh: "Mandarin Chinese", chinese: "Mandarin Chinese",
    arabic: "Arabic", ar: "Arabic",
    pt: "Portuguese", portuguese: "Portuguese",
    ru: "Russian", russian: "Russian",
    id: "Indonesian", indonesian: "Indonesian",
    ja: "Japanese", japanese: "Japanese",
    pcm: "Nigerian Pidgin",
    arz: "Egyptian Arabic",
    vi: "Vietnamese", vietnamese: "Vietnamese",
    ha: "Hausa", hausa: "Hausa",
    tr: "Turkish", turkish: "Turkish",
    ko: "Korean", korean: "Korean",
    th: "Thai", thai: "Thai",
    it: "Italian", italian: "Italian",
    si: "Sinhalese", sinhalese: "Sinhalese",
    uk: "Ukrainian", ukrainian: "Ukrainian",
    fa: "Persian", persian: "Persian",
    ku: "Kurdish", kurdish: "Kurdish",
    az: "Azerbaijani", azerbaijani: "Azerbaijani",
    mn: "Mongolian", mongolian: "Mongolian",
    bo: "Tibetan", tibetan: "Tibetan",
    my: "Burmese", burmese: "Burmese",
    ms: "Malay", malay: "Malay",
    gu: "Gujarati", gujarati: "Gujarati",
    bho: "Bhojpuri", bhojpuri: "Bhojpuri",
    as: "Assamese", assamese: "Assamese",
    ks: "Kashmiri", kashmiri: "Kashmiri",
    mr: "Marathi", marathi: "Marathi",
    kok: "Konkani", konkani: "Konkani",
    ml: "Malayalam", malayalam: "Malayalam",
    pa: "Punjabi", punjabi: "Punjabi",
    bn: "Bengali", bengali: "Bengali",
    mni: "Manipuri", manipuri: "Manipuri",
    ne: "Nepali", nepali: "Nepali",
    ur: "Urdu", urdu: "Urdu",
    or: "Odia", odia: "Odia",
    sd: "Sindhi", sindhi: "Sindhi",
  };

  const sourceLang = languageNames[sourceLanguage] || sourceLanguage;
  const targetLang = languageNames[targetLanguage] || targetLanguage;

  // Truncate context to reduce token count for faster processing
  const truncatedVerse = verseContext.slice(0, 300);
  const truncatedCommentary = commentaryContext.slice(0, 500);

  const prompt = `Sanskrit scholar: Analyze "${word}" from a sacred text.
Source: ${sourceLang} → Target: ${targetLang}

Context: ${truncatedVerse}
Commentary: ${truncatedCommentary}

IMPORTANT: ALL fields in the response MUST be written in ${targetLang}. Do NOT use English for any field unless the target language is English.

JSON response:
{"translation":"meaning in ${targetLang}","grammaticalInfo":"root, formation, case/gender/tense in ${targetLang}","etymology":"word origin in ${targetLang}","contextualMeaning":"Advaita interpretation in ${targetLang}"}`;

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
