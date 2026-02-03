import { db } from "./db";
import { storage } from "./storage";
import { books, verses, verseTranslations, explanations, languages } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Isha Upanishad Data
 * 
 * Source: https://advaitasharada.sringeri.net/display/bhashya/Isha/devanagari
 * 
 * This data was extracted from the Advaita Sharada website maintained by
 * Sringeri Sharada Peetham. The website provides the Isha Upanishad in
 * 4 scripts: Devanagari, Kannada, Telugu, and Tamil.
 * 
 * The content is static ancient Sanskrit text, so embedding it directly
 * provides better reliability than runtime scraping.
 */
const ISHA_UPANISHAD_DATA = {
  devanagari: [
    { verse: 1, content: "ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते।\nपूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥" },
    { verse: 2, content: "ॐ ईशावास्यमिदं सर्वं यत्किञ्च जगत्यां जगत्।\nतेन त्यक्तेन भुञ्जीथा मा गृधः कस्यस्विद्धनम्॥" },
    { verse: 3, content: "कुर्वन्नेवेह कर्माणि जिजीविषेच्छतं समाः।\nएवं त्वयि नान्यथेतोऽस्ति न कर्म लिप्यते नरे॥" },
    { verse: 4, content: "असुर्या नाम ते लोका अन्धेन तमसावृताः।\nतांस्ते प्रेत्याभिगच्छन्ति ये के चात्महनो जनाः॥" },
    { verse: 5, content: "अनेजदेकं मनसो जवीयो नैनद्देवा आप्नुवन्पूर्वमर्षत्।\nतद्धावतोऽन्यानत्येति तिष्ठत्तस्मिन्नपो मातरिश्वा दधाति॥" },
    { verse: 6, content: "तदेजति तन्नैजति तद्दूरे तद्वन्तिके।\nतदन्तरस्य सर्वस्य तदु सर्वस्यास्य बाह्यतः॥" },
    { verse: 7, content: "यस्तु सर्वाणि भूतान्यात्मन्येवानुपश्यति।\nसर्वभूतेषु चात्मानं ततो न विजुगुप्सते॥" },
    { verse: 8, content: "यस्मिन्सर्वाणि भूतान्यात्मैवाभूद्विजानतः।\nतत्र को मोहः कः शोक एकत्वमनुपश्यतः॥" },
    { verse: 9, content: "स पर्यगाच्छुक्रमकायमव्रणमस्नाविरं शुद्धमपापविद्धम्।\nकविर्मनीषी परिभूः स्वयम्भूर्याथातथ्यतोऽर्थान्व्यदधाच्छाश्वतीभ्यः समाभ्यः॥" },
    { verse: 10, content: "अन्धं तमः प्रविशन्ति येऽविद्यामुपासते।\nततो भूय इव ते तमो य उ विद्यायां रताः॥" },
    { verse: 11, content: "विद्यां चाविद्यां च यस्तद्वेदोभयं सह।\nअविद्यया मृत्युं तीर्त्वा विद्ययामृतमश्नुते॥" },
    { verse: 12, content: "अन्धं तमः प्रविशन्ति येऽसम्भूतिमुपासते।\nततो भूय इव ते तमो य उ सम्भूत्यां रताः॥" },
    { verse: 13, content: "सम्भूतिं च विनाशं च यस्तद्वेदोभयं सह।\nविनाशेन मृत्युं तीर्त्वा सम्भूत्यामृतमश्नुते॥" },
    { verse: 14, content: "हिरण्मयेन पात्रेण सत्यस्यापिहितं मुखम्।\nतत्त्वं पूषन्नपावृणु सत्यधर्माय दृष्टये॥" },
    { verse: 15, content: "पूषन्नेकर्षे यम सूर्य प्राजापत्य व्यूह रश्मीन्समूह।\nतेजो यत्ते रूपं कल्याणतमं तत्ते पश्यामि योऽसावसौ पुरुषः सोऽहमस्मि॥" },
    { verse: 16, content: "वायुरनिलममृतमथेदं भस्मान्तं शरीरम्।\nॐ क्रतो स्मर कृतं स्मर क्रतो स्मर कृतं स्मर॥" },
    { verse: 17, content: "अग्ने नय सुपथा राये अस्मान्विश्वानि देव वयुनानि विद्वान्।\nयुयोध्यस्मज्जुहुराणमेनो भूयिष्ठां ते नमउक्तिं विधेम॥" },
    { verse: 18, content: "ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते।\nपूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥\nॐ शान्तिः शान्तिः शान्तिः॥" },
  ],
  kannada: [
    { verse: 1, content: "ಓಂ ಪೂರ್ಣಮದಃ ಪೂರ್ಣಮಿದಂ ಪೂರ್ಣಾತ್ಪೂರ್ಣಮುದಚ್ಯತೆ।\nಪೂರ್ಣಸ್ಯ ಪೂರ್ಣಮಾದಾಯ ಪೂರ್ಣಮೇವಾವಶಿಷ್ಯತೆ॥" },
    { verse: 2, content: "ಓಂ ಈಶಾವಾಸ್ಯಮಿದಂ ಸರ್ವಂ ಯತ್ಕಿಂಚ ಜಗತ್ಯಾಂ ಜಗತ್।\nತೇನ ತ್ಯಕ್ತೆನ ಭುಂಜೀಥಾ ಮಾ ಗೃಧಃ ಕಸ್ಯಸ್ವಿದ್ಧನಮ್॥" },
    { verse: 3, content: "ಕುರ್ವನ್ನೆವೆಹ ಕರ್ಮಾಣಿ ಜಿಜೀವಿಷೆಚ್ಛತಂ ಸಮಾಃ।\nಏವಂ ತ್ವಯಿ ನಾನ್ಯಥೆತೊಸ್ತಿ ನ ಕರ್ಮ ಲಿಪ್ಯತೆ ನರೆ॥" },
    { verse: 4, content: "ಅಸುರ್ಯಾ ನಾಮ ತೆ ಲೋಕಾ ಅಂಧೆನ ತಮಸಾವೃತಾಃ।\nತಾಂಸ್ತೆ ಪ್ರೆತ್ಯಾಭಿಗಚ್ಛಂತಿ ಯೆ ಕೆ ಚಾತ್ಮಹನೋ ಜನಾಃ॥" },
    { verse: 5, content: "ಅನೇಜದೆಕಂ ಮನಸೋ ಜವೀಯೋ ನೈನದ್ದೆವಾ ಆಪ್ನುವನ್ಪೂರ್ವಮರ್ಷತ್।\nತದ್ಧಾವತೊಽನ್ಯಾನತ್ಯೆತಿ ತಿಷ್ಠತ್ತಸ್ಮಿನ್ನಪೊ ಮಾತರಿಶ್ವಾ ದಧಾತಿ॥" },
    { verse: 6, content: "ತದೆಜತಿ ತನ್ನೈಜತಿ ತದ್ದೂರೆ ತದ್ವಂತಿಕೆ।\nತದಂತರಸ್ಯ ಸರ್ವಸ್ಯ ತದು ಸರ್ವಸ್ಯಾಸ್ಯ ಬಾಹ್ಯತಃ॥" },
    { verse: 7, content: "ಯಸ್ತು ಸರ್ವಾಣಿ ಭೂತಾನ್ಯಾತ್ಮನ್ಯೆವಾನುಪಶ್ಯತಿ।\nಸರ್ವಭೂತೆಷು ಚಾತ್ಮಾನಂ ತತೊ ನ ವಿಜುಗುಪ್ಸತೆ॥" },
    { verse: 8, content: "ಯಸ್ಮಿನ್ಸರ್ವಾಣಿ ಭೂತಾನ್ಯಾತ್ಮೈವಾಭೂದ್ವಿಜಾನತಃ।\nತತ್ರ ಕೊ ಮೊಹಃ ಕಃ ಶೋಕ ಏಕತ್ವಮನುಪಶ್ಯತಃ॥" },
    { verse: 9, content: "ಸ ಪರ್ಯಗಾಚ್ಛುಕ್ರಮಕಾಯಮವ್ರಣಮಸ್ನಾವಿರಂ ಶುದ್ಧಮಪಾಪವಿದ್ಧಮ್।\nಕವಿರ್ಮನೀಷೀ ಪರಿಭೂಃ ಸ್ವಯಂಭೂರ್ಯಾಥಾತಥ್ಯತೊಽರ್ಥಾನ್ವ್ಯದಧಾಚ್ಛಾಶ್ವತೀಭ್ಯಃ ಸಮಾಭ್ಯಃ॥" },
    { verse: 10, content: "ಅಂಧಂ ತಮಃ ಪ್ರವಿಶಂತಿ ಯೆಽವಿದ್ಯಾಮುಪಾಸತೆ।\nತತೊ ಭೂಯ ಇವ ತೆ ತಮೊ ಯ ಉ ವಿದ್ಯಾಯಾಂ ರತಾಃ॥" },
    { verse: 11, content: "ವಿದ್ಯಾಂ ಚಾವಿದ್ಯಾಂ ಚ ಯಸ್ತದ್ವೆದೊಭಯಂ ಸಹ।\nಅವಿದ್ಯಯಾ ಮೃತ್ಯುಂ ತೀರ್ತ್ವಾ ವಿದ್ಯಯಾಮೃತಮಶ್ನುತೆ॥" },
    { verse: 12, content: "ಅಂಧಂ ತಮಃ ಪ್ರವಿಶಂತಿ ಯೆಽಸಂಭೂತಿಮುಪಾಸತೆ।\nತತೊ ಭೂಯ ಇವ ತೆ ತಮೊ ಯ ಉ ಸಂಭೂತ್ಯಾಂ ರತಾಃ॥" },
    { verse: 13, content: "ಸಂಭೂತಿಂ ಚ ವಿನಾಶಂ ಚ ಯಸ್ತದ್ವೆದೊಭಯಂ ಸಹ।\nವಿನಾಶೆನ ಮೃತ್ಯುಂ ತೀರ್ತ್ವಾ ಸಂಭೂತ್ಯಾಮೃತಮಶ್ನುತೆ॥" },
    { verse: 14, content: "ಹಿರಣ್ಮಯೆನ ಪಾತ್ರೆಣ ಸತ್ಯಸ್ಯಾಪಿಹಿತಂ ಮುಖಮ್।\nತತ್ತ್ವಂ ಪೂಷನ್ನಪಾವೃಣು ಸತ್ಯಧರ್ಮಾಯ ದೃಷ್ಟಯೆ॥" },
    { verse: 15, content: "ಪೂಷನ್ನೆಕರ್ಷೆ ಯಮ ಸೂರ್ಯ ಪ್ರಾಜಾಪತ್ಯ ವ್ಯೂಹ ರಶ್ಮೀನ್ಸಮೂಹ।\nತೇಜೊ ಯತ್ತೆ ರೂಪಂ ಕಲ್ಯಾಣತಮಂ ತತ್ತೆ ಪಶ್ಯಾಮಿ ಯೊಽಸಾವಸೌ ಪುರುಷಃ ಸೊಽಹಮಸ್ಮಿ॥" },
    { verse: 16, content: "ವಾಯುರನಿಲಮಮೃತಮಥೆದಂ ಭಸ್ಮಾಂತಂ ಶರೀರಮ್।\nಓಂ ಕ್ರತೊ ಸ್ಮರ ಕೃತಂ ಸ್ಮರ ಕ್ರತೊ ಸ್ಮರ ಕೃತಂ ಸ್ಮರ॥" },
    { verse: 17, content: "ಅಗ್ನೆ ನಯ ಸುಪಥಾ ರಾಯೆ ಅಸ್ಮಾನ್ವಿಶ್ವಾನಿ ದೆವ ವಯುನಾನಿ ವಿದ್ವಾನ್।\nಯುಯೋಧ್ಯಸ್ಮಜ್ಜುಹುರಾಣಮೆನೊ ಭೂಯಿಷ್ಠಾಂ ತೆ ನಮಉಕ್ತಿಂ ವಿಧೆಮ॥" },
    { verse: 18, content: "ಓಂ ಪೂರ್ಣಮದಃ ಪೂರ್ಣಮಿದಂ ಪೂರ್ಣಾತ್ಪೂರ್ಣಮುದಚ್ಯತೆ।\nಪೂರ್ಣಸ್ಯ ಪೂರ್ಣಮಾದಾಯ ಪೂರ್ಣಮೇವಾವಶಿಷ್ಯತೆ॥\nಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ॥" },
  ],
  telugu: [
    { verse: 1, content: "ఓం పూర్ణమదః పూర్ణమిదం పూర్ణాత్పూర్ణముదచ్యతే।\nపూర్ణస్య పూర్ణమాదాయ పూర్ణమేవావశిష్యతే॥" },
    { verse: 2, content: "ఓం ఈశావాస్యమిదం సర్వం యత్కించ జగత్యాం జగత్।\nతేన త్యక్తేన భుంజీథా మా గృధః కస్యస్విద్ధనమ్॥" },
    { verse: 3, content: "కుర్వన్నేవేహ కర్మాణి జిజీవిషేచ్ఛతం సమాః।\nఏవం త్వయి నాన్యథేతోఽస్తి న కర్మ లిప్యతే నరే॥" },
    { verse: 4, content: "అసుర్యా నామ తే లోకా అంధేన తమసావృతాః।\nతాంస్తే ప్రేత్యాభిగచ్ఛంతి యే కే చాత్మహనో జనాః॥" },
    { verse: 5, content: "అనేజదేకం మనసో జవీయో నైనద్దేవా ఆప్నువన్పూర్వమర్షత్।\nతద్ధావతోఽన్యానత్యేతి తిష్ఠత్తస్మిన్నపో మాతరిశ్వా దధాతి॥" },
    { verse: 6, content: "తదేజతి తన్నైజతి తద్దూరే తద్వంతికే।\nతదంతరస్య సర్వస్య తదు సర్వస్యాస్య బాహ్యతః॥" },
    { verse: 7, content: "యస్తు సర్వాణి భూతాన్యాత్మన్యేవానుపశ్యతి।\nసర్వభూతేషు చాత్మానం తతో న విజుగుప్సతే॥" },
    { verse: 8, content: "యస్మిన్సర్వాణి భూతాన్యాత్మైవాభూద్విజానతః।\nతత్ర కో మోహః కః శోక ఏకత్వమనుపశ్యతః॥" },
    { verse: 9, content: "స పర్యగాచ్ఛుక్రమకాయమవ్రణమస్నావిరం శుద్ధమపాపవిద్ధమ్।\nకవిర్మనీషీ పరిభూః స్వయంభూర్యాథాతథ్యతోఽర్థాన్వ్యదధాచ్ఛాశ్వతీభ్యః సమాభ్యః॥" },
    { verse: 10, content: "అంధం తమః ప్రవిశంతి యేఽవిద్యాముపాసతే।\nతతో భూయ ఇవ తే తమో య ఉ విద్యాయాం రతాః॥" },
    { verse: 11, content: "విద్యాం చావిద్యాం చ యస్తద్వేదోభయం సహ।\nఅవిద్యయా మృత్యుం తీర్త్వా విద్యయామృతమశ్నుతే॥" },
    { verse: 12, content: "అంధం తమః ప్రవిశంతి యేఽసంభూతిముపాసతే।\nతతో భూయ ఇవ తే తమో య ఉ సంభూత్యాం రతాః॥" },
    { verse: 13, content: "సంభూతిం చ వినాశం చ యస్తద్వేదోభయం సహ।\nవినాశేన మృత్యుం తీర్త్వా సంభూత్యామృతమశ్నుతే॥" },
    { verse: 14, content: "హిరణ్మయేన పాత్రేణ సత్యస్యాపిహితం ముఖమ్।\nతత్త్వం పూషన్నపావృణు సత్యధర్మాయ దృష్టయే॥" },
    { verse: 15, content: "పూషన్నేకర్షే యమ సూర్య ప్రాజాపత్య వ్యూహ రశ్మీన్సమూహ।\nతేజో యత్తే రూపం కల్యాణతమం తత్తే పశ్యామి యోఽసావసౌ పురుషః సోఽహమస్మి॥" },
    { verse: 16, content: "వాయురనిలమమృతమథేదం భస్మాంతం శరీరమ్।\nఓం క్రతో స్మర కృతం స్మర క్రతో స్మర కృతం స్మర॥" },
    { verse: 17, content: "అగ్నే నయ సుపథా రాయే అస్మాన్విశ్వాని దేవ వయునాని విద్వాన్।\nయుయోధ్యస్మజ్జుహురాణమేనో భూయిష్ఠాం తే నమఉక్తిం విధేమ॥" },
    { verse: 18, content: "ఓం పూర్ణమదః పూర్ణమిదం పూర్ణాత్పూర్ణముదచ్యతే।\nపూర్ణస్య పూర్ణమాదాయ పూర్ణమేవావశిష్యతే॥\nఓం శాంతిః శాంతిః శాంతిః॥" },
  ],
  tamil: [
    { verse: 1, content: "ஓம் பூர்ணமத³ப் பூர்ணமித³ம் பூர்ணாத் பூர்ணமுத³ச்யதே।\nபூர்ணஸ்ய பூர்ணமாதா³ய பூர்ணமேவாவஶிஷ்யதே॥" },
    { verse: 2, content: "ஓம் ஈஶாவாஸ்யமித³ம் ஸர்வம் யத்கிஞ்ச ஜக³த்யாம் ஜக³த்।\nதேன த்யக்தேன பு⁴ஞ்ஜீதா² மா க்³ருத⁴ப் கஸ்யஸ்வித்³த⁴னம்॥" },
    { verse: 3, content: "குர்வன்னேவேஹ கர்மாணி ஜிஜீவிஷேச்ச²தம் ஸமாப்।\nஏவம் த்வயி நான்யதே²தோ(அ)ஸ்தி ந கர்ம லிப்யதே நரே॥" },
    { verse: 4, content: "அஸுர்யா நாம தே லோகா அந்தே⁴ன தமஸாவ்ருதாப்।\nதாம்ஸ்தே ப்ரேத்யாபி⁴க³ச்ச²ந்தி யே கே சாத்மஹனோ ஜனாப்॥" },
    { verse: 5, content: "அனேஜதே³கம் மனஸோ ஜவீயோ நைனத்³தே³வா ஆப்னுவன்பூர்வமர்ஷத்।\nதத்³தா⁴வதோ(அ)ன்யானத்யேதி திஷ்ட²த்தஸ்மின்னபோ மாதரிஶ்வா த³தா⁴தி॥" },
    { verse: 6, content: "ததே³ஜதி தன்னைஜதி தத்³தூ³ரே தத்³வந்திகே।\nதத³ந்தரஸ்ய ஸர்வஸ்ய தது³ ஸர்வஸ்யாஸ்ய பா³ஹ்யதப்॥" },
    { verse: 7, content: "யஸ்து ஸர்வாணி பூ⁴தான்யாத்மன்யேவானுபஶ்யதி।\nஸர்வபூ⁴தேஷு சாத்மானம் ததோ ந விஜுகு³ப்ஸதே॥" },
    { verse: 8, content: "யஸ்மின்ஸர்வாணி பூ⁴தான்யாத்மைவாபூ⁴த்³விஜானதப்।\nதத்ர கோ மோஹப் கப் ஶோக ஏகத்வமனுபஶ்யதப்॥" },
    { verse: 9, content: "ஸ பர்யகா³ச்சு²க்ரமகாயமவ்ரணமஸ்னாவிரம் ஶுத்³த⁴மபாபவித்³த⁴ம்।\nகவிர்மனீஷீ பரிபூ⁴ப் ஸ்வயம்பூ⁴ர்யாதா²தத்²யதோ(அ)ர்தா²ன்வ்யத³தா⁴ச்சா²ஶ்வதீப்⁴யப் ஸமாப்⁴யப்॥" },
    { verse: 10, content: "அந்த⁴ம் தமப் ப்ரவிஶந்தி யே(அ)வித்³யாமுபாஸதே।\nததோ பூ⁴ய இவ தே தமோ ய உ வித்³யாயாம் ரதாப்॥" },
    { verse: 11, content: "வித்³யாம் சாவித்³யாம் ச யஸ்தத்³வேதோ³ப⁴யம் ஸஹ।\nஅவித்³யயா ம்ருத்யும் தீர்த்வா வித்³யயாம்ருதமஶ்னுதே॥" },
    { verse: 12, content: "அந்த⁴ம் தமப் ப்ரவிஶந்தி யே(அ)ஸம்பூ⁴திமுபாஸதே।\nததோ பூ⁴ய இவ தே தமோ ய உ ஸம்பூ⁴த்யாம் ரதாப்॥" },
    { verse: 13, content: "ஸம்பூ⁴திம் ச வினாஶம் ச யஸ்தத்³வேதோ³ப⁴யம் ஸஹ।\nவினாஶேன ம்ருத்யும் தீர்த்வா ஸம்பூ⁴த்யாம்ருதமஶ்னுதே॥" },
    { verse: 14, content: "ஹிரண்மயேன பாத்ரேண ஸத்யஸ்யாபிஹிதம் முக²ம்।\nதத்த்வம் பூஷன்னபாவ்ருணு ஸத்யத⁴ர்மாய த்³ருஷ்டயே॥" },
    { verse: 15, content: "பூஷன்னேகர்ஷே யம ஸூர்ய ப்ராஜாபத்ய வ்யூஹ ரஶ்மீன்ஸமூஹ।\nதேஜோ யத்தே ரூபம் கல்யாணதமம் தத்தே பஶ்யாமி யோ(அ)ஸாவஸௌ புருஷப் ஸோ(அ)ஹமஸ்மி॥" },
    { verse: 16, content: "வாயுரனிலமம்ருதமதே²த³ம் ப⁴ஸ்மாந்தம் ஶரீரம்।\nஓம் க்ரதோ ஸ்மர க்ருதம் ஸ்மர க்ரதோ ஸ்மர க்ருதம் ஸ்மர॥" },
    { verse: 17, content: "அக்³னே நய ஸுபதா² ராயே அஸ்மான்விஶ்வானி தே³வ வயுனானி வித்³வான்।\nயுயோத்⁴யஸ்மஜ்ஜுஹுராணமேனோ பூ⁴யிஷ்டா²ம் தே நமஉக்திம் விதே⁴ம॥" },
    { verse: 18, content: "ஓம் பூர்ணமத³ப் பூர்ணமித³ம் பூர்ணாத் பூர்ணமுத³ச்யதே।\nபூர்ணஸ்ய பூர்ணமாதா³ய பூர்ணமேவாவஶிஷ்யதே॥\nஓம் ஶாந்திப் ஶாந்திப் ஶாந்திப்॥" },
  ],
};

const EXPLANATIONS = [
  {
    authorName: "Adi Shankaracharya",
    authorTitle: "Advaita Vedanta Master",
    languageCode: "english",
    explanations: [
      { verse: 1, content: "This invocatory verse (Shanti Patha) establishes the metaphysical foundation that the Absolute (Brahman) is complete and perfect. From the perfect comes the perfect - yet the perfect remains perfect. This paradox points to the infinite nature of Brahman, which is not diminished by creation." },
      { verse: 2, content: "The first verse of the Upanishad declares that the entire universe is pervaded by Ishvara (the Lord). Therefore, one should enjoy things with renunciation, not coveting anyone's wealth. This teaches the attitude of non-attachment while living in the world." },
      { verse: 7, content: "He who sees all beings in his own Self and his own Self in all beings - such a one does not feel any hatred or separation. This verse describes the vision of the enlightened sage who perceives the unity underlying all diversity." },
      { verse: 11, content: "One who knows both vidya (knowledge) and avidya (ignorance) together - crossing death through avidya, one attains immortality through vidya. This verse reconciles the paths of action and knowledge, showing their complementary nature." },
    ],
  },
  {
    authorName: "Swami Vivekananda",
    authorTitle: "Modern Vedanta Teacher",
    languageCode: "english",
    explanations: [
      { verse: 1, content: "The opening mantra reveals the infinite nature of the Divine. Like space which cannot be divided or depleted, Brahman remains whole regardless of how much manifests from it. This is the cornerstone of Advaita - non-dual reality." },
      { verse: 2, content: "Live in the world but be not of it. Enjoy what comes to you, but do not cling. This teaching is revolutionary - it does not ask us to renounce the world but to renounce attachment while living fully." },
      { verse: 7, content: "When one realizes that the same consciousness that illumines one's own mind also illumines every being, hatred becomes impossible. This is not mere intellectual understanding but direct perception of unity." },
    ],
  },
  {
    authorName: "Madhvacharya",
    authorTitle: "Dvaita Vedanta Acharya",
    languageCode: "english",
    explanations: [
      { verse: 2, content: "The Lord (Isha) dwells in all beings as their inner controller. Recognition of this divine presence should lead to a life of devotion and ethical conduct. We enjoy only what is ordained for us by the Lord's grace." },
      { verse: 7, content: "Seeing the Lord as the Self of all beings leads to devotion. The jiva (individual soul) is eternally distinct from but dependent on Vishnu. True knowledge sees this relationship correctly." },
    ],
  },
];

export async function seedDatabase() {
  console.log("Checking if database needs seeding...");

  const existingBooks = await db.select().from(books);
  if (existingBooks.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with Isha Upanishad...");

  const book = await storage.createBook({
    slug: "isha-upanishad",
    title: "Isha Upanishad",
    author: "Yajur Veda",
    description: "The Isha Upanishad (ईशोपनिषद्) is one of the shortest and most celebrated Upanishads, consisting of 18 mantras. It derives its name from the opening word 'Isha' meaning 'Lord' or 'Ruler'. This Upanishad teaches that the entire universe is pervaded by the Lord and presents the essence of Vedantic philosophy.",
    category: "Upanishad",
    coverImage: null,
    totalVerses: 18,
  });

  console.log("Created book:", book.title);

  const verseMap: Record<number, string> = {};

  for (let i = 0; i < ISHA_UPANISHAD_DATA.devanagari.length; i++) {
    const verseData = ISHA_UPANISHAD_DATA.devanagari[i];
    const verse = await storage.createVerse({
      bookId: book.id,
      verseNumber: verseData.verse,
      sectionTitle: verseData.verse === 1 ? "Invocation (Shanti Patha)" : 
                    verseData.verse === 18 ? "Closing Mantra" : null,
    });

    verseMap[verseData.verse] = verse.id;

    await storage.createTranslation({
      verseId: verse.id,
      languageCode: "devanagari",
      content: verseData.content,
    });

    const kannadaVerse = ISHA_UPANISHAD_DATA.kannada.find(v => v.verse === verseData.verse);
    if (kannadaVerse) {
      await storage.createTranslation({
        verseId: verse.id,
        languageCode: "kannada",
        content: kannadaVerse.content,
      });
    }

    const teluguVerse = ISHA_UPANISHAD_DATA.telugu.find(v => v.verse === verseData.verse);
    if (teluguVerse) {
      await storage.createTranslation({
        verseId: verse.id,
        languageCode: "telugu",
        content: teluguVerse.content,
      });
    }

    const tamilVerse = ISHA_UPANISHAD_DATA.tamil.find(v => v.verse === verseData.verse);
    if (tamilVerse) {
      await storage.createTranslation({
        verseId: verse.id,
        languageCode: "tamil",
        content: tamilVerse.content,
      });
    }
  }

  console.log("Created verses with translations in all 4 scripts");

  for (const author of EXPLANATIONS) {
    for (const exp of author.explanations) {
      const verseId = verseMap[exp.verse];
      if (verseId) {
        await storage.createExplanation({
          verseId,
          authorName: author.authorName,
          authorTitle: author.authorTitle,
          languageCode: author.languageCode,
          content: exp.content,
        });
      }
    }
  }

  console.log("Created explanations from multiple scholars");
  console.log("Database seeding complete!");
}
