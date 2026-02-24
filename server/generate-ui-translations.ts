import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DELAY_MS = 500;
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const EN_TRANSLATIONS: Record<string, string> = {
  startReading: "Start Reading",
  tableOfContents: "Table of Contents",
  chapter: "Ch.",
  chapterFull: "Chapter",
  part: "Part",
  verse: "Verse",
  verses: "verses",
  sloka: "Sl.",
  singleVerse: "Single Verse",
  commentator: "Commentator",
  allCommentators: "All Commentators",
  selectCommentator: "Select Commentator",
  selectedVerse: "Selected Verse",
  noContentAvailable: "No content available",
  explanatoryVideos: "Explanatory Videos",
  myNotes: "My Notes",
  loginToAddNotes: "Log in to add notes",
  add: "Add",
  save: "Save",
  cancel: "Cancel",
  saving: "Saving...",
  writeYourNote: "Write your note...",
  noNotesYet: "No notes yet for this verse",
  searchChapters: "Search chapters...",
  searchBooks: "Search books...",
  searchSubcategories: "Search subcategories...",
  searchCategories: "Search categories...",
  configurePreferences: "Configure preferences",
  preferences: "Preferences",
  preferencesDescription: "Set your default reading preferences. These will be applied each time you open the app.",
  translationLanguage: "Translation Language",
  selectLanguage: "Select language",
  preferredCommentator: "Preferred Commentator",
  selectCommentatorPref: "Select commentator",
  noPreference: "No preference",
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  logIn: "Log In",
  logOut: "Log Out",
  signUp: "Sign Up",
  email: "Email",
  password: "Password",
  firstName: "First Name",
  lastName: "Last Name",
  firstNamePlaceholder: "First name",
  lastNamePlaceholder: "Last name (optional)",
  emailPlaceholder: "you@example.com",
  passwordPlaceholderRegister: "At least 6 characters",
  passwordPlaceholderLogin: "Your password",
  dontHaveAccount: "Don't have an account?",
  alreadyHaveAccount: "Already have an account?",
  signUpLink: "Sign up",
  logInLink: "Log in",
  networkError: "Network error. Please try again.",
  somethingWentWrong: "Something went wrong",
  advaitaVaaridhi: "Advaita Vaaridhi",
  encyclopaediaOfAdvaitaVedanta: "ENCYCLOPAEDIA OF ADVAITA VEDANTA",
  word: "Word",
  translation: "Translation",
  grammar: "Grammar",
  etymology: "Etymology",
  contextualMeaning: "Contextual Meaning",
  analyzing: "Analyzing...",
  analyzeWithAI: "Analyze with AI",
  fromCache: "(from cache)",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  commentary: "Commentary",
  bhashyam: "Bhāṣyam",
  teeka: "Ṭīkā",
  mantra: "Mantra",
  noCommentaryAvailable: "No commentary available for this verse",
  bhashyamNotAvailable: "Bhāṣyam not available in this language",
  teekaNotAvailable: "Ṭīkā not available in this language",
  wordByWordMeanings: "Word-by-Word Meanings",
  clickWordForMeaning: "Click on any word above for its meaning",
  allCategories: "All Categories",
  backToHome: "Back to Home",
  prasthanaThrayaShankaracharyaBhashya: "Prasthana Thraya - Shankaracharya Bhashya",
  otherIndependentWorksShankaracharya: "Other Independent Works of Shankaracharya",
  prasthanaThrayaOtherAdvaitaAcharyas: "Prasthana Thraya - Other Advaita Acharyas",
  bhakthiStotrasShankaracharya: "Bhakthi Stotras of Shankaracharya",
  prakaranaGranthas: "Prakarana Granthas",
  shlokasStothrasAdvaita: "Shlokas, Sthuthis and Stotras based on Advaita",
  upanishad: "Upanishad",
  bhagavadGita: "Bhagavad Gita",
  brahmaSutra: "Brahma Sutra",
  independentAdvaitaWorks: "Independent Advaita Works",
  otherGitas: "Other Gitas",
  bhakthiGranthas: "Bhakthi Granthas",
  advaitaInOtherLanguages: "Advaita in Other Languages",
  modernAdvaitaWorks: "Modern Advaita Works",
  browseTheLibrary: "Browse the Library",
  comingSoon: "Coming Soon",
  soon: "Soon",
  textSingular: "text",
  textPlural: "texts",
  noVersesInChapter: "No verses found in this chapter",
  noVersesAvailable: "No verses available",
  introductionVideo: "Introduction Video",
  hideOtherCommentaries: "Hide Other Commentaries",
  showMore: "Show More",
  more: "more",
  section: "Section",
  khanda: "Khanda",
  previous: "Previous",
  next: "Next",
  watchVideo: "Watch Video",
  watchIntroduction: "Watch Introduction",
  commentaryAndInsight: "Commentary & Insight",
  ekatmaDham: "Ekatma Dham",
  abodeOfOneness: "Abode of Oneness",
  advaitaVedantaDigitalLibrary: "Advaita Vedanta Digital Library",
  eternalEchoOfNonDuality: "The Eternal Echo of Non-Duality",
  welcomeDescription: "A sacred digital portal by the Acharya Shankar Sanskritik Ekta Nyas, dedicated to the preservation, digitalization, and global dissemination of Advaita Vedanta. Inspired by the legacy of Adi Shankaracharya, exploring the profound truth of Jiva-Brahma-Aikya: the essential oneness of the individual soul and the Supreme Reality.",
  treasuryOfWisdom: "The Treasury of Wisdom",
  treasuryIntro: "The Nyas has meticulously curated a vast collection of texts, spanning from the foundational \"Triple Canon\" (Prasthanatrayi) to the sophisticated dialectical works of the later Advaita masters. Our archives include:",
  prasthanatriyaBhashyasLabel: "Prasthanatrayi Bhashyas:",
  prasthanatriyaBhashyasDesc: "The foundational commentaries on the Upanishads, Bhagavad Gita, and Brahma Sutras.",
  prakaranaGranthasLabel: "Prakarana Granthas:",
  prakaranaGranthasDesc: "Essential introductory monographs such as Vivekachudamani, Upadesha Sahasri, and Atma Bodha.",
  scholasticTraditionLabel: "The Scholastic Tradition:",
  scholasticTraditionDesc: "Deep dives into the Bhamati and Vivarana schools, including the works of masters like Padmapada, Vachaspati Misra, and Vidyaranya Swami.",
  regionalLuminariesLabel: "Regional Luminaries:",
  regionalLuminariesDesc: "Rare and significant works from across India, such as the masterpieces of Sri Bellamkonda Rama Raya and Shrimad Bodhendra Saraswati.",
  ourVisionSanskritikEkta: "Our Vision: Sanskritik Ekta",
  visionDescription: "In alignment with the mission of Acharya Shankar Sanskritik Ekta Nyas, this library is more than a repository of books; it is a tool for universal harmony. By making the Advaita philosophy accessible to all, we aim to dissolve the boundaries of \"otherness\" and reveal the underlying unity of all existence.",
  brahmanQuote: "\"Brahman is the Only Truth, the World is an appearance, and the Individual Self is none other than Brahman.\"",
  featuresOfDigitalLibrary: "Features of the Digital Library",
  authenticTranscriptionsLabel: "Authentic Transcriptions:",
  authenticTranscriptionsDesc: "Accurately digitized Sanskrit texts with corrected formatting for modern readers.",
  manuscriptPreservationLabel: "Manuscript Preservation:",
  manuscriptPreservationDesc: "High-resolution scans of rare editions to ensure the longevity of our heritage.",
  scholarlySearchLabel: "Scholarly Search:",
  scholarlySearchDesc: "Navigate by author, period, or specific philosophical sub-topic.",
  saVidyaQuote: "\"Knowledge is that which liberates.\" — Sa Vidya Ya Vimuktaye",
  invitationText: "We invite you to explore this ocean of knowledge. May the grace of Acharya Shankar guide your inquiry from the transient to the Eternal.",
  managedByNyas: "Managed by the Acharya Shankar Sanskritik Ekta Nyas, Madhya Pradesh.",
  backToHomeWelcome: "Back to Home",
};

const NEW_LANGS = [
  { code: "pt", name: "Portuguese", script: "Latin" },
  { code: "ru", name: "Russian", script: "Cyrillic" },
  { code: "id", name: "Indonesian", script: "Latin" },
  { code: "ja", name: "Japanese", script: "Japanese" },
  { code: "pcm", name: "Nigerian Pidgin", script: "Latin" },
  { code: "arz", name: "Egyptian Arabic", script: "Arabic" },
  { code: "vi", name: "Vietnamese", script: "Latin" },
  { code: "ha", name: "Hausa", script: "Latin" },
  { code: "tr", name: "Turkish", script: "Latin" },
  { code: "ko", name: "Korean", script: "Hangul" },
  { code: "th", name: "Thai", script: "Thai" },
  { code: "it", name: "Italian", script: "Latin" },
  { code: "si", name: "Sinhalese", script: "Sinhala" },
  { code: "uk", name: "Ukrainian", script: "Cyrillic" },
  { code: "fa", name: "Persian", script: "Persian" },
  { code: "ku", name: "Kurdish", script: "Latin" },
  { code: "az", name: "Azerbaijani", script: "Latin" },
  { code: "mn", name: "Mongolian", script: "Cyrillic" },
  { code: "bo", name: "Tibetan", script: "Tibetan" },
  { code: "my", name: "Burmese", script: "Myanmar" },
  { code: "ms", name: "Malay", script: "Latin" },
  { code: "gu", name: "Gujarati", script: "Gujarati" },
  { code: "bho", name: "Bhojpuri", script: "Devanagari" },
  { code: "as", name: "Assamese", script: "Bengali" },
  { code: "ks", name: "Kashmiri", script: "Devanagari" },
  { code: "mr", name: "Marathi", script: "Devanagari" },
  { code: "kok", name: "Konkani", script: "Devanagari" },
  { code: "ml", name: "Malayalam", script: "Malayalam" },
  { code: "pa", name: "Punjabi", script: "Gurmukhi" },
  { code: "bn", name: "Bengali", script: "Bengali" },
  { code: "mni", name: "Manipuri", script: "Bengali" },
  { code: "ne", name: "Nepali", script: "Devanagari" },
  { code: "ur", name: "Urdu", script: "Nastaliq" },
  { code: "or", name: "Odia", script: "Odia" },
  { code: "sd", name: "Sindhi", script: "Arabic" },
];

async function translateBatch(langName: string, script: string, keys: Record<string, string>): Promise<Record<string, string>> {
  const jsonStr = JSON.stringify(keys, null, 2);
  const scriptNote = script === "Latin" 
    ? "Use standard Latin script." 
    : `Write in ${script} script.`;
  
  const prompt = `You are a professional translator. Translate ALL the following UI strings from English to ${langName}. ${scriptNote}

IMPORTANT RULES:
- Keep Sanskrit/Indian philosophical terms like "Advaita", "Vedanta", "Bhashyam", "Teeka", "Mantra", "Upanishad", "Bhagavad Gita", "Brahma Sutra", "Shankaracharya", "Prasthana Thraya", "Prakarana Granthas" etc. in their original form (transliterated if needed for the target script).
- Keep "AI", "Email", technical terms as-is or naturally adapted.
- Keep placeholder text like "you@example.com" unchanged.
- Keep "..." in placeholders.
- Translate naturally for a spiritual/scholarly app context.
- Return ONLY valid JSON with exact same keys.

SOURCE JSON:
${jsonStr}

Return ONLY the translated JSON object with the same keys. No markdown, no explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8192,
    temperature: 0.2,
  });

  const content = response.choices[0].message.content || "{}";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`Failed to parse JSON for ${langName}:`, e);
    console.error("Raw content:", content.substring(0, 200));
    return {};
  }
}

async function main() {
  const fs = await import("fs");
  const outputPath = "/home/runner/workspace/server/ui-translations-output.json";
  
  let allTranslations: Record<string, Record<string, string>> = {};
  if (fs.existsSync(outputPath)) {
    allTranslations = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    console.log(`Loaded existing translations for: ${Object.keys(allTranslations).join(", ")}`);
  }

  const startIdx = parseInt(process.argv[2] || "0", 10);
  const count = parseInt(process.argv[3] || "10", 10);
  const langsToProcess = NEW_LANGS.slice(startIdx, startIdx + count);
  
  console.log(`Processing languages ${startIdx} to ${startIdx + count - 1} (${langsToProcess.length} langs)`);
  console.log(`Total keys per language: ${Object.keys(EN_TRANSLATIONS).length}`);

  const keys = Object.keys(EN_TRANSLATIONS);
  const half = Math.ceil(keys.length / 2);
  const batch1: Record<string, string> = {};
  const batch2: Record<string, string> = {};
  keys.forEach((k, i) => {
    if (i < half) batch1[k] = EN_TRANSLATIONS[k];
    else batch2[k] = EN_TRANSLATIONS[k];
  });

  for (const lang of langsToProcess) {
    if (allTranslations[lang.code] && Object.keys(allTranslations[lang.code]).length >= 130) {
      console.log(`\nSkipping ${lang.name} (${lang.code}) - already done`);
      continue;
    }
    
    console.log(`\nTranslating to ${lang.name} (${lang.code})...`);
    
    try {
      const result1 = await translateBatch(lang.name, lang.script, batch1);
      await delay(DELAY_MS);
      const result2 = await translateBatch(lang.name, lang.script, batch2);
      await delay(DELAY_MS);
      
      const merged = { ...result1, ...result2 };
      const missingKeys = keys.filter(k => !merged[k]);
      if (missingKeys.length > 0) {
        console.log(`  Missing ${missingKeys.length} keys, retrying...`);
        const missingBatch: Record<string, string> = {};
        missingKeys.forEach(k => missingBatch[k] = EN_TRANSLATIONS[k]);
        const retryResult = await translateBatch(lang.name, lang.script, missingBatch);
        Object.assign(merged, retryResult);
        await delay(DELAY_MS);
      }
      
      allTranslations[lang.code] = merged;
      console.log(`  Done: ${Object.keys(merged).length}/${keys.length} keys`);
      
      fs.writeFileSync(outputPath, JSON.stringify(allTranslations, null, 2));
      console.log(`  Saved progress.`);
    } catch (error: any) {
      console.error(`  Error translating ${lang.name}: ${error.message}`);
      if (error.message?.includes("429") || error.message?.includes("rate")) {
        console.log("  Rate limited, waiting 30s...");
        await delay(30000);
      }
    }
  }

  console.log(`\nBatch complete. Languages done: ${Object.keys(allTranslations).length}/${NEW_LANGS.length}`);
}

main().catch(console.error);
