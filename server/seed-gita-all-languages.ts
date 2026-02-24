import OpenAI from "openai";
import { db } from "./db";
import { explanations, verses, books, verseTranslations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const BATCH_SIZE = 5;
const DELAY_MS = 300;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ALL_NEW_LANGS = [
  { code: "hi", name: "Hindi", script: "Devanagari" },
  { code: "kn", name: "Kannada", script: "Kannada" },
  { code: "te", name: "Telugu", script: "Telugu" },
  { code: "ta", name: "Tamil", script: "Tamil" },
  { code: "de", name: "German", script: "Latin" },
  { code: "fr", name: "French", script: "Latin" },
  { code: "es", name: "Spanish", script: "Latin" },
  { code: "zh", name: "Mandarin Chinese", script: "Simplified Chinese" },
  { code: "ar", name: "Arabic", script: "Arabic" },
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
  { code: "pl", name: "Polish", script: "Latin" },
  { code: "nl", name: "Dutch", script: "Latin" },
  { code: "sv", name: "Swedish", script: "Latin" },
  { code: "el", name: "Greek", script: "Greek" },
  { code: "sw", name: "Swahili", script: "Latin" },
  { code: "am", name: "Amharic", script: "Ge'ez" },
  { code: "he", name: "Hebrew", script: "Hebrew" },
];

const NON_LATIN_SCRIPTS = new Set([
  "Devanagari", "Bengali", "Gujarati", "Malayalam", "Gurmukhi", "Odia",
  "Sinhala", "Thai", "Japanese", "Hangul", "Cyrillic", "Arabic", "Persian",
  "Nastaliq", "Tibetan", "Myanmar", "Simplified Chinese", "Kannada", "Telugu", "Tamil",
  "Greek", "Ge'ez", "Hebrew",
]);

function getScriptNote(lang: { name: string; script: string }): string {
  if (NON_LATIN_SCRIPTS.has(lang.script)) {
    return `Write in ${lang.script} script. Keep Sanskrit proper nouns (names like Krishna, Arjuna) in ${lang.script} script.`;
  }
  return "Keep Sanskrit proper nouns in IAST transliteration.";
}

function isRefusalResponse(text: string): boolean {
  const refusalPatterns = [
    /I'm sorry.*can't assist/i,
    /I'm sorry.*cannot assist/i,
    /I cannot.*translate/i,
    /I'm unable to.*translate/i,
    /I apologize.*cannot/i,
    /I can't help with/i,
    /cannot comply/i,
    /against.*policy/i,
    /safety.*guidelines/i,
    /not able to.*provide/i,
    /I'm not able to/i,
    /I cannot help/i,
    /I'm sorry.*can't help/i,
  ];
  return refusalPatterns.some(p => p.test(text));
}

function isValidTranslation(text: string, sourceLength: number): boolean {
  if (!text || text.trim().length === 0) return false;
  if (isRefusalResponse(text)) return false;
  if (text.trim().length < Math.min(20, sourceLength * 0.1)) return false;
  return true;
}

async function translateText(openai: OpenAI, prompt: string, maxTokens: number = 4096): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  const content = response.choices[0].message.content || "";
  if (isRefusalResponse(content)) {
    console.warn(`[Gita All] AI refusal detected, retrying with simplified prompt...`);
    const retryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a scholarly translator. Translate the given text accurately." },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    });
    const retryContent = retryResponse.choices[0].message.content || "";
    if (isRefusalResponse(retryContent)) {
      console.warn(`[Gita All] AI refusal persisted on retry, returning empty`);
      return "";
    }
    return retryContent;
  }
  return content;
}

async function translateSingleVerse(
  openai: OpenAI,
  verse: { id: string; verseNumber: number; adhyayNumber: number | null; content: string },
  lang: { code: string; name: string; script: string },
  type: "sloka" | "commentary"
): Promise<{ verseId: string; translated: string }> {
  const scriptNote = getScriptNote(lang);
  const typeLabel = type === "sloka" ? "verse translation" : "Sri Shankaracharya commentary";
  const prompt = `You are an expert Sanskrit scholar. Translate this Bhagavad Gita ${typeLabel} from English to ${lang.name}. ${scriptNote} Maintain scholarly register.\n\nSOURCE:\n${verse.content}\n\nProvide ONLY the ${lang.name} translation.`;
  try {
    const result = await translateText(openai, prompt, 2048);
    if (!isValidTranslation(result, verse.content.length)) {
      return { verseId: verse.id, translated: "" };
    }
    return { verseId: verse.id, translated: result.trim() };
  } catch {
    return { verseId: verse.id, translated: "" };
  }
}

async function translateBatchedVerses(
  openai: OpenAI,
  verseBatch: Array<{ id: string; verseNumber: number; adhyayNumber: number | null; content: string }>,
  lang: { code: string; name: string; script: string },
  type: "sloka" | "commentary"
): Promise<Array<{ verseId: string; translated: string }>> {
  const scriptNote = getScriptNote(lang);
  const typeLabel = type === "sloka" ? "verse translation" : "Sri Shankaracharya commentary";

  const combined = verseBatch.map((v, i) => 
    `===VERSE_${i}===\n[${v.adhyayNumber || 1}.${v.verseNumber}]\n${v.content}`
  ).join("\n\n");

  const prompt = `You are an expert Sanskrit scholar. Translate these Bhagavad Gita ${typeLabel}s from English to ${lang.name}. ${scriptNote} Maintain scholarly register and philosophical precision.

Separate each translation with the same ===VERSE_N=== markers.

${combined}

Provide ONLY the ${lang.name} translations, separated by ===VERSE_N=== markers. No explanations.`;

  try {
    const result = await translateText(openai, prompt, 4096);
    if (!result || isRefusalResponse(result)) {
      console.warn(`[Gita All] Batch refused for ${lang.name}, falling back to single-verse calls`);
      const singleResults: Array<{ verseId: string; translated: string }> = [];
      for (const v of verseBatch) {
        const r = await translateSingleVerse(openai, v, lang, type);
        singleResults.push(r);
        await new Promise(res => setTimeout(res, 200));
      }
      return singleResults;
    }
    const parts = result.split(/===VERSE_\d+===/).filter(p => p.trim());
    
    if (parts.length !== verseBatch.length) {
      console.warn(`[Gita All] Batch misaligned for ${lang.name}: expected ${verseBatch.length}, got ${parts.length}. Falling back to single-verse calls.`);
      const singleResults: Array<{ verseId: string; translated: string }> = [];
      for (const v of verseBatch) {
        const r = await translateSingleVerse(openai, v, lang, type);
        singleResults.push(r);
        await new Promise(res => setTimeout(res, 200));
      }
      return singleResults;
    }

    return verseBatch.map((v, i) => {
      const translated = (parts[i] || "").trim().replace(/^\[[\d.]+\]\s*/, "");
      if (!isValidTranslation(translated, v.content.length)) {
        return { verseId: v.id, translated: "" };
      }
      return { verseId: v.id, translated };
    });
  } catch (error: any) {
    console.error(`[Gita All] Batch translate failed for ${lang.name}: ${error.message}`);
    return [];
  }
}

export async function seedGitaAllLanguages() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[Gita All] No OPENAI_API_KEY set, skipping");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const gitaBooks = await db.select().from(books).where(eq(books.slug, "bhagavad-gita"));
  if (gitaBooks.length === 0) {
    console.log("[Gita All] No Bhagavad Gita book found");
    return;
  }
  const bookId = gitaBooks[0].id;

  const allVerses = await db.select().from(verses).where(eq(verses.bookId, bookId));
  allVerses.sort((a, b) => {
    const chA = a.adhyayNumber || 1;
    const chB = b.adhyayNumber || 1;
    if (chA !== chB) return chA - chB;
    return a.verseNumber - b.verseNumber;
  });

  if (allVerses.length === 0) {
    console.log("[Gita All] No verses found");
    return;
  }

  console.log(`[Gita All] Found ${allVerses.length} verses, ${ALL_NEW_LANGS.length} languages to process`);

  const LEGACY_CODE_MAP: Record<string, string> = {
    "kn": "kannada", "te": "telugu", "ta": "tamil",
    "de": "german", "fr": "french", "es": "spanish",
    "zh": "mandarin", "ar": "arabic",
  };

  const existingVT = await db.select({
    verseId: verseTranslations.verseId,
    languageCode: verseTranslations.languageCode,
  }).from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const vtKeys = new Set(existingVT.map(e => `${e.verseId}-${e.languageCode}`));

  const existingExp = await db.select({
    verseId: explanations.verseId,
    languageCode: explanations.languageCode,
    authorName: explanations.authorName,
  }).from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, bookId));
  const expKeys = new Set(existingExp.map(e => `${e.verseId}-${e.languageCode}-${e.authorName}`));

  const legacyVtCoverage = new Map<string, Set<string>>();
  for (const e of existingVT) {
    if (!legacyVtCoverage.has(e.languageCode)) legacyVtCoverage.set(e.languageCode, new Set());
    legacyVtCoverage.get(e.languageCode)!.add(e.verseId);
  }
  const legacyExpCoverage = new Map<string, Set<string>>();
  for (const e of existingExp) {
    if (e.authorName !== "Sri Shankaracharya") continue;
    if (!legacyExpCoverage.has(e.languageCode)) legacyExpCoverage.set(e.languageCode, new Set());
    legacyExpCoverage.get(e.languageCode)!.add(e.verseId);
  }

  const engTransMap = new Map<string, string>();
  const engExpMap = new Map<string, string>();
  
  const allEngTrans = await db.select().from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(and(eq(verses.bookId, bookId), eq(verseTranslations.languageCode, "en")));
  for (const row of allEngTrans) {
    engTransMap.set(row.verse_translations.verseId, row.verse_translations.content);
  }

  const allEngExp = await db.select().from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(and(
      eq(verses.bookId, bookId),
      eq(explanations.languageCode, "en"),
      eq(explanations.authorName, "Sri Shankaracharya")
    ));
  for (const row of allEngExp) {
    engExpMap.set(row.explanations.verseId, row.explanations.content);
  }

  let totalCreated = 0;
  
  const noCommentNotes: Record<string, string> = {
    "Kannada": "ಶ್ರೀ ಶಂಕರಾಚಾರ್ಯರು ಈ ಶ್ಲೋಕಕ್ಕೆ ಭಾಷ್ಯ ಬರೆದಿಲ್ಲ. ಭಾಷ್ಯ 2.10 ರಿಂದ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ.",
    "Telugu": "శ్రీ శంకరాచార్యులు ఈ శ్లోకంపై భాష్యం రాయలేదు. భాష్యం 2.10 నుండి ప్రారంభమవుతుంది.",
    "Tamil": "ஸ்ரீ சங்கராச்சார்யர் இந்த ஸ்லோகத்திற்கு பாஷ்யம் எழுதவில்லை. பாஷ்யம் 2.10 இலிருந்து தொடங்குகிறது.",
    "German": "Sri Sankaracharya hat diesen Shloka nicht kommentiert. Der Kommentar beginnt ab 2.10.",
    "French": "Sri Sankaracharya n'a pas commenté ce shloka. Le commentaire commence à partir de 2.10.",
    "Spanish": "Sri Sankaracharya no comentó este shloka. El comentario comienza desde 2.10.",
    "Mandarin Chinese": "斯里·商羯罗阿阇梨未对此颂文作注。注释从2.10开始。",
    "Arabic": "لم يعلق سري شانكاراتشاريا على هذا الشلوكة. يبدأ التعليق من 2.10.",
    "Hindi": "Sri Sankaracharya ने इस श्लोक पर टिप्पणी नहीं की। भाष्य 2.10 से शुरू होता है।",
    "Portuguese": "Sri Sankaracharya não comentou este shloka. O comentário começa a partir de 2.10.",
    "Russian": "Шри Шанкарачарья не комментировал этот шлоку. Комментарий начинается с 2.10.",
    "Indonesian": "Sri Sankaracharya tidak mengomentari shloka ini. Komentar dimulai dari 2.10.",
    "Japanese": "シュリ・シャンカラーチャーリヤはこのシュローカに注釈していません。注釈は2.10から始まります。",
    "Nigerian Pidgin": "Sri Sankaracharya no comment on this shloka. The commentary start from 2.10.",
    "Egyptian Arabic": "سري شانكاراشاريا ما علقش على الشلوكة دي. التعليق بيبدأ من 2.10.",
    "Vietnamese": "Sri Sankaracharya không bình luận về shloka này. Bình luận bắt đầu từ 2.10.",
    "Hausa": "Sri Sankaracharya bai yi sharhi a kan wannan shloka ba. Sharhin ya fara daga 2.10.",
    "Turkish": "Sri Sankaracharya bu shloka hakkında yorum yapmamıştır. Yorum 2.10'dan başlar.",
    "Korean": "스리 샹카라차리야는 이 슬로카에 대해 주석하지 않았습니다. 주석은 2.10부터 시작됩니다.",
    "Thai": "ศรีศังกราจารย์ไม่ได้แสดงความเห็นเกี่ยวกับโศลกนี้ คำอธิบายเริ่มจาก 2.10",
    "Italian": "Sri Sankaracharya non ha commentato questo shloka. Il commento inizia da 2.10.",
    "Sinhalese": "ශ්‍රී ශංකරාචාර්ය මෙම ශ්ලෝකය පිළිබඳ අදහස් දක්වා නැත. විවරණය 2.10 සිට ආරම්භ වේ.",
    "Ukrainian": "Шрі Шанкарачар'я не коментував цю шлоку. Коментар починається з 2.10.",
    "Persian": "سری شانکاراچاریا درباره این شلوکه اظهار نظر نکرد. شرح از 2.10 آغاز می‌شود.",
    "Kurdish": "Sri Sankaracharya li ser vê shlokayê şîrove nekir. Şîrove ji 2.10 dest pê dike.",
    "Azerbaijani": "Sri Sankaracharya bu shlokaya şərh verməmişdir. Şərh 2.10-dan başlayır.",
    "Mongolian": "Шри Шанкарачарья энэ шлокод тайлбар өгөөгүй. Тайлбар 2.10-аас эхэлнэ.",
    "Tibetan": "Sri Sankaracharya did not comment on this shloka. The commentary starts from 2.10.",
    "Burmese": "ဆရီရှန်ကရာချာရယာ ဤရှလောကအပေါ် မှတ်ချက်မပေးခဲ့ပါ။ ဘာသြာ 2.10 မှ စတင်ပါသည်။",
    "Malay": "Sri Sankaracharya tidak mengulas shloka ini. Ulasan bermula dari 2.10.",
    "Gujarati": "શ્રી શંકરાચાર્યે આ શ્લોક પર ટીકા કરી નથી. ભાષ્ય 2.10 થી શરૂ થાય છે.",
    "Bhojpuri": "श्री शंकराचार्य इ श्लोक पर टिप्पणी ना कइलन। भाष्य 2.10 से शुरू होला।",
    "Assamese": "শ্ৰী শংকৰাচাৰ্যই এই শ্লোকত মন্তব্য কৰা নাই। ভাষ্য 2.10 ৰ পৰা আৰম্ভ হয়।",
    "Kashmiri": "श्री शंकराचार्यन यस श्लोकस पेठ टिप्पणी नय कोर। भाष्यम 2.10 पेठ शुरू छु।",
    "Marathi": "श्री शंकराचार्यांनी या श्लोकावर भाष्य केले नाही. भाष्य 2.10 पासून सुरू होते.",
    "Konkani": "श्री शंकराचार्यान ह्या श्लोकाचेर भाष्य केले ना. भाष्य 2.10 थावन सुरू जाता.",
    "Malayalam": "ശ്രീ ശങ്കരാചാര്യർ ഈ ശ്ലോകത്തിന് ഭാഷ്യം രചിച്ചിട്ടില്ല. ഭാഷ്യം 2.10 മുതൽ ആരംഭിക്കുന്നു.",
    "Punjabi": "ਸ਼੍ਰੀ ਸ਼ੰਕਰਾਚਾਰੀਆ ਨੇ ਇਸ ਸ਼ਲੋਕ 'ਤੇ ਟਿੱਪਣੀ ਨਹੀਂ ਕੀਤੀ। ਭਾਸ਼ਿਆ 2.10 ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ।",
    "Bengali": "শ্রী শংকরাচার্য এই শ্লোকের উপর মন্তব্য করেননি। ভাষ্য 2.10 থেকে শুরু হয়।",
    "Manipuri": "শ্রী শংকরাচার্য মসি শ্লোক অসিদা মন্তব্য তৌখিদে। ভাষ্য 2.10 দগী হৌই।",
    "Nepali": "श्री शंकराचार्यले यस श्लोकमा टिप्पणी गर्नुभएन। भाष्य 2.10 बाट सुरु हुन्छ।",
    "Urdu": "سری شنکراچاریا نے اس شلوک پر تبصرہ نہیں کیا۔ بھاشیم 2.10 سے شروع ہوتا ہے۔",
    "Odia": "ଶ୍ରୀ ଶଙ୍କରାଚାର୍ଯ୍ୟ ଏହି ଶ୍ଲୋକ ଉପରେ ଭାଷ୍ୟ ଲେଖିନାହାନ୍ତି। ଭାଷ୍ୟ 2.10 ଠାରୁ ଆରମ୍ଭ ହୁଏ।",
    "Sindhi": "سري شنڪراچاريا هن شلوڪ تي تبصرو نه ڪيو. ڀاشيم 2.10 کان شروع ٿئي ٿو.",
    "Polish": "Sri Sankaracharya nie skomentował tego shloki. Komentarz zaczyna się od 2.10.",
    "Dutch": "Sri Sankaracharya heeft deze shloka niet becommentarieerd. Het commentaar begint vanaf 2.10.",
    "Swedish": "Sri Sankaracharya kommenterade inte denna shloka. Kommentaren börjar från 2.10.",
    "Greek": "Ο Σρι Σανκαραχάρυα δεν σχολίασε αυτή τη σλόκα. Το σχόλιο ξεκινά από 2.10.",
    "Swahili": "Sri Sankaracharya hakutoa maoni kuhusu shloka hii. Maoni yanaanza kutoka 2.10.",
    "Amharic": "ስሪ ሳንካራቻርያ ይህን ሽሎካ አልተንተኑም። ትርጓሜው ከ2.10 ይጀምራል።",
    "Hebrew": "סרי שנקראצ'ריה לא פירש שלוקה זו. הפירוש מתחיל מ-2.10.",
  };

  for (const lang of ALL_NEW_LANGS) {
    let langVtCreated = 0;
    let langExpCreated = 0;

    const legacyCode = LEGACY_CODE_MAP[lang.code];
    if (legacyCode) {
      const legacyVtCount = legacyVtCoverage.get(legacyCode)?.size || 0;
      const legacyExpCount = legacyExpCoverage.get(legacyCode)?.size || 0;
      if (legacyVtCount >= allVerses.length && legacyExpCount >= allVerses.length) {
        console.log(`[Gita All] ${lang.name} (${lang.code}): already covered by legacy code '${legacyCode}' (VT:${legacyVtCount}, Exp:${legacyExpCount}), skipping`);
        continue;
      }
    }

    let vtNeeded = 0;
    let expNeeded = 0;
    for (const verse of allVerses) {
      if (!vtKeys.has(`${verse.id}-${lang.code}`)) vtNeeded++;
      if (!expKeys.has(`${verse.id}-${lang.code}-Sri Shankaracharya`)) expNeeded++;
    }

    if (vtNeeded === 0 && expNeeded === 0) {
      console.log(`[Gita All] ${lang.name} (${lang.code}): already complete, skipping`);
      continue;
    }

    console.log(`[Gita All] Starting ${lang.name} (${lang.code}): ${vtNeeded} VT + ${expNeeded} commentary needed`);

    for (let i = 0; i < allVerses.length; i += BATCH_SIZE) {
      const batch = allVerses.slice(i, i + BATCH_SIZE);

      const vtBatch: Array<{ id: string; verseNumber: number; adhyayNumber: number | null; content: string }> = [];
      for (const v of batch) {
        if (!vtKeys.has(`${v.id}-${lang.code}`) && engTransMap.has(v.id)) {
          vtBatch.push({ id: v.id, verseNumber: v.verseNumber, adhyayNumber: v.adhyayNumber, content: engTransMap.get(v.id)! });
        }
      }

      const expBatch: Array<{ id: string; verseNumber: number; adhyayNumber: number | null; content: string }> = [];
      for (const v of batch) {
        if (!expKeys.has(`${v.id}-${lang.code}-Sri Shankaracharya`) && engExpMap.has(v.id)) {
          expBatch.push({ id: v.id, verseNumber: v.verseNumber, adhyayNumber: v.adhyayNumber, content: engExpMap.get(v.id)! });
        }
      }

      const promises: Promise<void>[] = [];

      if (vtBatch.length > 0) {
        promises.push((async () => {
          const results = await translateBatchedVerses(openai, vtBatch, lang, "sloka");
          for (const r of results) {
            if (r.translated) {
              try {
                await db.insert(verseTranslations).values({
                  verseId: r.verseId,
                  languageCode: lang.code,
                  content: r.translated,
                  isAiTranslated: true,
                });
                vtKeys.add(`${r.verseId}-${lang.code}`);
                langVtCreated++;
                totalCreated++;
              } catch (err: any) {
                if (!err.message?.includes("duplicate")) {
                  console.error(`[Gita All] VT insert error: ${err.message}`);
                }
              }
            }
          }
        })());
      }

      if (expBatch.length > 0) {
        for (const v of expBatch) {
          const verseRef = `${v.adhyayNumber || 1}.${v.verseNumber}`;
          const isNoComment = v.content.length < 100 && v.content.includes("did not comment");

          if (isNoComment) {
            const translated = noCommentNotes[lang.name] 
              ? `${verseRef} ${noCommentNotes[lang.name]}`
              : `${verseRef} ${v.content}`;
            promises.push((async () => {
              try {
                await db.insert(explanations).values({
                  verseId: v.id,
                  languageCode: lang.code,
                  authorName: "Sri Shankaracharya",
                  content: translated,
                  isAiTranslated: true,
                });
                expKeys.add(`${v.id}-${lang.code}-Sri Shankaracharya`);
                langExpCreated++;
                totalCreated++;
              } catch (err: any) {
                if (!err.message?.includes("duplicate")) {
                  console.error(`[Gita All] Exp insert error: ${err.message}`);
                }
              }
            })());
          }
        }

        const realExpBatch = expBatch.filter(v => !(v.content.length < 100 && v.content.includes("did not comment")));
        if (realExpBatch.length > 0) {
          promises.push((async () => {
            const results = await translateBatchedVerses(openai, realExpBatch, lang, "commentary");
            for (const r of results) {
              if (r.translated) {
                try {
                  await db.insert(explanations).values({
                    verseId: r.verseId,
                    languageCode: lang.code,
                    authorName: "Sri Shankaracharya",
                    content: r.translated,
                    isAiTranslated: true,
                  });
                  expKeys.add(`${r.verseId}-${lang.code}-Sri Shankaracharya`);
                  langExpCreated++;
                  totalCreated++;
                } catch (err: any) {
                  if (!err.message?.includes("duplicate")) {
                    console.error(`[Gita All] Exp insert error: ${err.message}`);
                  }
                }
              }
            }
          })());
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        await delay(DELAY_MS);
      }

      if ((i / BATCH_SIZE) % 50 === 0 && i > 0) {
        console.log(`[Gita All] ${lang.name}: ${Math.floor(i / BATCH_SIZE)}/${Math.ceil(allVerses.length / BATCH_SIZE)} batches, VT: ${langVtCreated}, Exp: ${langExpCreated}`);
      }
    }

    console.log(`[Gita All] ${lang.name} done: VT=${langVtCreated}, Exp=${langExpCreated}`);
  }

  console.log(`[Gita All] All languages complete. Total created: ${totalCreated}`);
}

if (process.argv[1]?.includes("seed-gita-all-languages")) {
  seedGitaAllLanguages().then(() => {
    console.log("[Gita All] Script finished");
    process.exit(0);
  }).catch(err => {
    console.error("[Gita All] Script error:", err);
    process.exit(1);
  });
}
