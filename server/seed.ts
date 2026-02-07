import { db } from "./db";
import { storage } from "./storage";
import { books, verses, verseTranslations, explanations, languages } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Additional Commentary Data
 * 
 * M. Hiriyanna - English Translation
 * Anandagiri - Sanskrit Tika (Devanagari)
 * Sri Sudarsana Ramasubramanya Raja - Tamil Translation
 * Adi Shankaracharya - English Translation
 */

const ADDITIONAL_COMMENTARIES: {
  [verseNumber: number]: {
    hiriyanna?: string;
    anandagiri?: string;
    sudarsana?: string;
    shankaraEnglish?: string;
  };
} = {
  1: {
    hiriyanna: `He who rules is termed Īt. Īśā means "by the Lord". The Lord is the Ruler and the real Self of every creature. By such a Lord, identical with oneself, is to be overspread i.e, covered. All this—whatsoever on earth, all that moves—both movable and immovable, have to be covered over by one's own Self, the Lord, the supreme Self, which is the sole reality. Thus—'I am the inner Self of all'.

Just as adventitious bad odour in a piece of sandal, arising from moisture, is overcome by true fragrance when the sandal piece is rubbed, so indeed, will all the congenital variety of the world, such as being an agent or an enjoyer, superimposed on the Self, disappear at the perception everywhere of the one really existent Self.

The meaning is—Having renounced desires, be not greedy, do not long for wealth. If wealth could belong to anybody it might be sought; but everything having disappeared through the discovery of the Lord everywhere, all this is of the Self. Thus it means—'Do not seek an unreality.'`,
    anandagiri: `ईशा वास्यमित्यादिमन्त्रान्व्याचिख्यासुर्भगवन्भाष्यकारस्तेषां कर्मशेषत्वशङ्कां तावद्व्युदस्यति । तथाहि कर्मजडाः केचन मन्यन्ते स्म । ईशा वास्यमित्यादयो मन्त्राः कर्मशेषा मन्त्रत्वाविशेषादिवेत्वादिमन्त्रवत् ।

ईशेति । 'ईशा' ऐश्वर्ये इत्यस्य धातोः क्विपि लुप्ते कृदन्तं रूपमीट् तस्य तृतीयैकवचनमीशेति । रीशनकर्तृत्वसम्भवात् क्विबन्तशब्दवाच्यता न विरुध्यते निरूपाधिकस्य च लक्ष्यत्वं भविष्यतोत्यर्थः ।

ईशित्रीशितव्यभावेन तर्हि भेदः प्राप्त इत्याशङ्क्याऽऽह — सर्वजन्तूनामात्मा सन्निति । यथाऽऽदर्शादिषु प्रतिबिम्बानामात्मा सन् बिम्बभूतो देवदत्त ईशिता भवति तथा कल्पितभेदेनेशित्रीशितव्यभावसम्भवान्न वास्तवभेदानुमानं सम्भवतीत्यर्थः ।`,
    sudarsana: `ஈசாவாஸ்யம் என்று தொடங்கி மேல்வரும் மந்திரங்கள் கர்மங்களில் விநியோகப்படுபவை அல்ல. ஏனெனில் அம்மந்திரங்கள் கர்மஸம்பந்தமற்ற ஆத்மாவினுடைய உண்மை நிலையை விளக்குவதால், ஆத்மாவின் உண்மை நிலையோவெனில் பின்பு கூறப்பட உள்ளது. சுத்தத்தன்மை, பாபஸம்பந்தமற்ற தண்மை, ஒன்றாகவிருக்கும் தன்மை, எப்பொழுதுமிருக்கும் தன்மை, சரீரஸம்பந்தமற்ற தன்மை, எங்கும் நீக்கமற நிறைந்திருக்கும் தன்மை முதலியன.

ஈஷ்டே என்றால் கட்டளை இடுதல் அதனால் ஈசா எனப்படுகிறான். எல்லோரையும் சாசனம் செய்கின்ற பரமேஸ்வரன் தான் பரமாத்மா. அந்த பரமாத்மாவானது எல்லா ஜீவ ராசிகளுக்கும் பிரத்யக் ஆத்மாவாக இருந்துகொண்டு எல்லாவற்றையும் பிரேரிக்கிறார்.

பிருதிவியில் எது எல்லாம் உள்ளதோ அது எல்லாவற்றையும் தன் ஆத்மாவான ஈசனால் பிரத்யகாத்ம ஸ்வரூபமாக இது எல்லாம் நான் தான் என்று மறைக்கவேண்டும். பரமார்த்த ஸத்யரூபமான, தனது பரமாத்ம ஸ்வரூபத்தால் பொய்யான இந்த ஸ்தாவரம், ஜங்கமம் முழுவதையும் மறைக்க வேண்டும்.`,
    shankaraEnglish: `He who rules is termed Īt. Īśā means 'by the Lord'. The Lord is the Ruler and the real Self of every creature. The difference between the controller and the controlled is not to be understood as real—it is merely apparent and based on illusion.

By such a Lord, identical with oneself, is to be overspread i.e., covered. What? idam sarvam = all this, yat kincha = whatsoever, jagatyām = on earth, jagat = all that moves. By one's own Self—the Lord, the supreme Self—which is the sole reality, all these unreal things, both movable and immovable, have to be covered over, perceiving thus—'I am the inner Self of all.'

The sense is that one should realise that all is Self and that there is no variety in the Universe. This is the chief teaching of the present Upanishad and corresponds, in its significance, to the well-known 'tattvamasi' of the Chāndogyopaniṣad.`
  },
  2: {
    hiriyanna: `Always performing rites such as agnihotra, one should desire to live for a hundred years—the maximum age of man. Since this is a mere iteration of an empirically known fact, what should be taken as enjoined here is that, if one should desire to live a hundred years, he should live only performing karma.

In this manner, in regard to you, when you live content to be a mere man, from this present course of performing karma like agnihotra, no different course exists in which evil action does not stain. Wherefore if one should desire for life, one should live throughout performing karma such as agnihotra prescribed by the śāstra.`,
    anandagiri: `कुर्वन्नेवेति । कर्माधिकारिणमुद्दिश्य कर्मणः फलसाधनतामाह — कुर्वन्नेवेति । कर्माण्यग्निहोत्रादीनि जिजीविषेत्तावज्जीवितुमिच्छेच्छतं समा इत्यादि । एवमित्यनेन प्रकारेण त्वयीत्यधिकारिणि नरे मनुष्यमात्रे सति । इत इति कर्मणो न अन्यथा मोक्षप्राप्तिः । न कर्म लिप्यते न बध्नातीत्यर्थः ।`,
    sudarsana: `கர்மங்களை செய்துகொண்டே இங்கு நூறு வருடங்கள் வாழ விரும்ப வேண்டும். இவ்வாறு உன்னைப் பொறுத்தவரை மனிதனாக இருக்கும்போது இந்த கர்ம மார்க்கத்தைத் தவிர வேறு வழியில்லை. இதனால் கர்மம் பற்றாது.`,
    shankaraEnglish: `Kurvanneva = always performing. iha = here. karmāni = rites such as agnihotra. jijīviṣet = one should desire to live. śatam = one hundred in number. samāḥ = years. For thus much is known to be the maximum age of man.

Since this is a mere iteration of an empirically known fact, what should be taken as enjoined here is that, if one should desire to live a hundred years, he should live only performing karma.`
  },
  3: {
    hiriyanna: `From the standpoint of Unity in the form of the supreme Self, even devas are reckoned as asuras. Asuryāḥ means belonging to demons. Those worlds are births or lives, because therein the fruits of karma are perceived or enjoyed. They are enveloped by nescience of blinding nature.

Those who are ignorant, howsoever they may be, after leaving this body, attain existences down to the immovable according to their past deeds and devotional practices. They are called 'slayers of Self'. How can they slay the eternal Self? Through their failing of ignorance they veil (forget) the ever-present Self. By reason of this sin of slaying the Self, they transmigrate.`,
    anandagiri: `असुर्या इति । अथ मूढानां दुर्गतिमाह — असुर्या इति । असुर्या असुराणां स्वभूता लोका जन्मानि । ते अन्धेन तमसाऽज्ञानेन आवृताः आच्छादिताः । तान् प्रेत्य गत्वा अभिगच्छन्ति प्राप्नुवन्ति । के ? ये केचन आत्महनो जनाः । आत्मानं हन्तीति आत्महा । नित्यस्यात्मनो वधः कथमिति चेत् — अज्ञानेनात्मानमाच्छाद्य हता इवाचरन्तीत्यर्थः ।`,
    sudarsana: `பரமாத்ம ஸ்வரூபத்தின் ஏகத்துவத்தை அபேக்ஷித்து தேவர்களும் அசுரர்களே. அவர்களுக்குரிய உலகங்கள் அசுர்யா எனப்படும். அந்த உலகங்கள் கர்ம பலன்களை அனுபவிக்கும் பிறவிகளாகும். அவை குருட்டு இருளால் மூடப்பட்டவை.

ஆத்மாவை அறியாத அஜ்ஞானிகள் இந்த உடலை விட்டு, தங்கள் கர்மத்திற்கேற்ப ஸ்தாவரம் வரை பிறவி எடுக்கிறார்கள். அவர்கள் ஆத்மஹனர் எனப்படுகிறார்கள்.`,
    shankaraEnglish: `Asuryāḥ = demoniacal. Compared with the one non-dual Self which is Brahman, even gods are asuras (non-gods). The worlds natural to them are called asuryāḥ (demoniacal) nāma. The word nāma is a mere expletive. te lokāḥ = those worlds; i.e., the results of karma—so called because they are seen and experienced—are births.

andhena = blind; i.e., by darkness which is the nature of not seeing, i.e., by ignorance. āvṛtāḥ = covered; i.e., concealed.`
  },
  4: {
    hiriyanna: `Anejat means not shaking, always of the same form. It is also one in all beings. Speedier than the mind which is characterized by desire etc. Why these conflicting statements—that it is at once motionless and speedier than the mind? This is justified on the basis of the Self being conditioned or unconditioned.

In its original unconditioned form it is unmoving and one. Since the mind, though residing within the body, can in an instant conceive of the distant Brahmaloka, when such mind reaches Brahmaloka with rapidity, the Self appears to have reached there already. Therefore it is said 'speedier than the mind'.`,
    anandagiri: `अनेजदिति । अथात्मनो याथात्म्यमाह — अनेजदिति । अनेजत् न एजत् न कम्पते । एकं सर्वभूतेषु द्वितीयमनपेक्ष्य । मनसो जवीयः वेगवत्तरम् । किमेतत्परस्परविरुद्धलक्षणम् ? नेत्याह — नैनदिति ।`,
    sudarsana: `அசையாதது, ஒன்றானது, மனதை விட வேகமானது. இந்த முரண்பாடான குணங்கள் எவ்வாறு ஒரே பொருளில் இருக்கும்? உபாதிகளை அபேக்ஷித்தும் நிரூபாதிகமாகவும் இருப்பதால் இது சாத்தியம்.

நிரூபாதிக நிலையில் அசையாதது, ஒன்றானது. மனம் உடலில் இருந்தாலும் ப்ரஹ்மலோகத்தை ஒரு க்ஷணத்தில் நினைக்கும். அப்போது ஆத்மா அங்கு ஏற்கனவே இருப்பது போல் தெரியும்.`,
    shankaraEnglish: `anejat = does not shake. ekam = one. manasaḥ = than mind. javīyaḥ = faster. This Self, though unmoving, is faster than the mind. How can there be such contradictory characteristics in one and the same thing? We reply—There is no contradiction because the Self pervades everything.`
  },
  5: {
    hiriyanna: `The Self in question moves—being in truth motionless, it only appears to move. It is distant, as it were, because the ignorant cannot get at it even in a thousand million years. It is also near, absolutely so, to the wise for it is their very Self.

It is not merely far and near; it is also inside of all this—the universe consisting of name, form and action. Compare—'Which Self is inmost of all' (Bṛhadāraṇyaka Upanishad III.iv.1). It is outside all this, being pervasive; inside, being supremely subtle like space.`,
    anandagiri: `तदेजतीति । उपाधिगतचलनादिभिश्चलतीव — तदेजतीति । न चलतीत्याह — तन्नैजतीति । दूरे विप्रकृष्टे । तद्वन्तिके समीपे च । अन्तर्बाह्यं च सर्वस्येति परिपूर्णत्वमाह — तदन्तरस्येति ।`,
    sudarsana: `அது அசைவது போல் தெரிகிறது - உண்மையில் அசையாதது. அஜ்ஞானிகளுக்கு தூரமானது, ஞானிகளுக்கு அருகில் உள்ளது - அவர்களின் ஆத்மாவாக இருப்பதால்.

இது உள்ளேயும் வெளியேயும் உள்ளது. நாம ரூப கர்மங்களால் ஆன இந்த பிரபஞ்சத்தின் உள்ளேயும் வெளியேயும் வியாபித்திருக்கிறது.`,
    shankaraEnglish: `tad ejati = that moves. tan na ejati = that does not move. tad dūre = that is far. tad antike = that is near. tad antar asya sarvasya = that is within all this. tad u sarvasyāsya bāhyataḥ = that is also outside all this.

From the standpoint of the ignorant, the Self appears to move because they perceive It through the limiting adjuncts of body and mind. But from the standpoint of reality, It does not move since It is all-pervading.`
  },
  6: {
    hiriyanna: `One who sees all beings—from Brahma to a blade of grass—as existing in one's own Self, and also sees one's own Self in all beings, from such a vision does not feel aversion or hatred.

The reasoning is that hatred arises from the perception of something other than oneself that is undesirable. But when one sees only the Self everywhere, there is no "other" to hate. The vision of non-duality eliminates the very basis of aversion.`,
    anandagiri: `यस्त्विति । अथात्मविदो निर्दोषत्वमाह — यस्त्विति । यस्तु विद्वान्सर्वाणि भूतानि ब्रह्मादिस्तम्बपर्यन्तानि आत्मन्येवानुपश्यति सर्वभूतेषु चात्मानं पश्यति ततो न विजुगुप्सते जुगुप्सां न करोति ।`,
    sudarsana: `எல்லா பூதங்களையும் - ப்ரஹ்மா முதல் ஒரு புல் வரை - தன் ஆத்மாவில் காண்பவன், எல்லா பூதங்களிலும் தன் ஆத்மாவைக் காண்பவன், அவன் வெறுப்பை அடைவதில்லை.

வெறுப்பு தன்னை விட வேறான விரும்பத்தகாத ஒன்றை உணர்வதால் எழுகிறது. எல்லா இடத்திலும் ஆத்மாவை மட்டுமே காணும்போது, வெறுக்க வேறு ஒன்றும் இல்லை.`,
    shankaraEnglish: `yas tu sarvāṇi bhūtāni = whoever sees all beings. ātmani eva = in the Self alone. anupaśyati = sees, perceives. sarva-bhūteṣu ca ātmānam = and the Self in all beings. tataḥ = from that vision. na vijugupsate = does not hate, feel aversion.

This verse describes the vision of the knower of Self. One who sees all beings—from Brahma to a blade of grass—as existing in one's own Self, and also sees one's own Self in all beings, from such a vision does not feel aversion or hatred.`
  },
  7: {
    hiriyanna: `When all beings have become one's own Self, when a person knows that all beings are nothing but the Self—what delusion or sorrow can there be for such a seer of oneness?

Delusion arises from the false perception of plurality, and sorrow comes from attachment to what is other than oneself. But when one realizes that there is nothing other than the Self, the very cause of delusion and sorrow is destroyed.`,
    anandagiri: `यस्मिन्निति । अत एवात्मविदो मोहशोकाभावमाह — यस्मिन्निति । यस्मिन्काले सर्वाणि भूतान्यात्मैवाभूद्विजानतः — यदा सर्वाणि भूतान्यात्मतया जानाति तदा तत्र को मोहः कः शोक इत्यर्थः ।`,
    sudarsana: `எல்லா பூதங்களும் ஒருவனின் ஆத்மாவாக ஆகிவிட்டபோது, எல்லா பூதங்களும் ஆத்மாவே என்று அறியும்போது - அவனுக்கு என்ன மோஹம்? என்ன சோகம்?

மோஹம் பல்வேறுமை என்ற தவறான உணர்வால் எழுகிறது. சோகம் தன்னை விட வேறானதில் பற்றுதலால் வருகிறது. ஆத்மாவை விட வேறு ஒன்றும் இல்லை என்று உணரும்போது, மோஹ சோகங்களுக்கான காரணமே அழிகிறது.`,
    shankaraEnglish: `yasmin sarvāṇi bhūtāni = in whom all beings. ātma eva abhūt vijānataḥ = have become the Self alone of the knower. tatra = there, in that state. ko mohaḥ = what delusion. kaḥ śokaḥ = what sorrow. ekatvam anupaśyataḥ = for one who perceives oneness.

When all beings have become one's own Self, when a person knows that all beings are nothing but the Self—what delusion or sorrow can there be for such a seer of oneness?`
  },
  8: {
    hiriyanna: `He went around, i.e., pervaded everywhere. It is bright, pure, bodiless, without wound, without sinews, pure, untouched by sin. He is the seer, omniscient, the thinker, wise, all-surpassing, self-existent, self-born. He properly ordained objects for eternal years.

This describes the nature of the Supreme Self who pervades everything. Though bodiless and pure, It is the omniscient seer who ordains all things according to their true nature for all eternity.`,
    anandagiri: `स पर्यगादिति । अथात्मनो गुणान्याथात्म्येनाह — स पर्यगादिति । स आत्मा पर्यगात्परितो व्याप्नोत् । शुक्रं ज्योतिष्मत् । अकायं देहरहितम् । अव्रणं क्षतरहितम् । अस्नाविरं स्नाय्वादिरहितम् ।`,
    sudarsana: `அவன் எங்கும் வியாபித்தான். பிரகாசமானவன், தூயவன், உடலற்றவன், காயமற்றவன், நரம்புகளற்றவன், பாவத்தால் தீண்டப்படாதவன்.

அவன் கவி - எல்லாம் அறிந்தவன், மனீஷி - ஞானி, பரிபூ - எல்லாவற்றையும் மிஞ்சியவன், ஸ்வயம்பூ - தானே தோன்றியவன். நித்திய காலமாக பொருட்களை அவற்றின் உண்மை இயல்பின்படி நியமித்தான்.`,
    shankaraEnglish: `saḥ paryagāt = He went around, i.e., pervaded everywhere. śukram = bright, pure. akāyam = bodiless, without a gross body. avraṇam = without wound, without injury. asnāviram = without sinews, without subtle body. śuddham = pure. apāpaviddham = untouched by sin.

kaviḥ = the seer, omniscient. manīṣī = the thinker, wise. paribhūḥ = all-surpassing, self-existent. svayambhūḥ = self-born, not born from another.`
  },
  9: {
    hiriyanna: `Those who worship ignorance (ritualistic karma alone) enter blinding darkness. Into greater darkness than that enter those who are devoted to knowledge alone.

This verse warns against two extremes: those who pursue only ritualistic karma without knowledge, and those who pursue only theoretical knowledge without the purification that comes from karma.`,
    anandagiri: `अन्धं तम इति । अथ केवलकर्मनिष्ठानां केवलज्ञाननिष्ठानां च निन्दामाह — अन्धं तम इति । अविद्यां कर्म उपासते ये ते अन्धं तमः प्रविशन्ति । ततो भूय इव ये उ विद्यायां रताः ।`,
    sudarsana: `அவித்யையை - கர்மத்தை மட்டும் உபாசிப்பவர்கள் குருட்டு இருளில் நுழைகிறார்கள். வித்யையில் - ஞானத்தில் மட்டும் ஈடுபடுபவர்கள் அதை விட பெரிய இருளில் நுழைகிறார்கள்.

இது இரண்டு தீவிரங்களுக்கு எதிராக எச்சரிக்கிறது: ஞானமின்றி கர்மத்தை மட்டும் செய்பவர்கள், கர்மத்தால் வரும் சுத்திகரிப்பின்றி வெறும் ஞானத்தை மட்டும் பின்பற்றுபவர்கள்.`,
    shankaraEnglish: `andham tamaḥ praviśanti = they enter blinding darkness. ye avidyām upāsate = those who worship ignorance (ritualistic karma alone). tataḥ bhūya iva te tamaḥ = into greater darkness than that. ya u vidyāyām ratāḥ = those who are devoted to knowledge alone.

This verse warns against two extremes: those who pursue only ritualistic karma without knowledge, and those who pursue only theoretical knowledge without the purification that comes from karma.`
  },
  10: {
    hiriyanna: `Different indeed they say is the result of knowledge. Different they say is the result of ignorance. Thus we have heard from the wise who have explained that to us.

The wise teachers have taught that the result of vidyā (knowledge) is different from the result of avidyā (karma).`,
    anandagiri: `अन्यदेवाहुरिति । उक्तार्थं पुष्णाति — अन्यदेवाहुरिति । विद्यया ज्ञानेनान्यदेव फलमाहुः । अविद्यया कर्मणाऽन्यदाहुः । इति धीराणां शुश्रुम ये नस्तद्विचचक्षिरे ।`,
    sudarsana: `வித்யையின் பலன் வேறு என்று சொல்கிறார்கள். அவித்யையின் பலன் வேறு என்று சொல்கிறார்கள். இவ்வாறு ஞானிகளிடம் கேட்டோம் - அவர்கள் நமக்கு இதை விளக்கினார்கள்.

ஞான ஆசிரியர்கள் வித்யையின் பலன் அவித்யையின் பலனிலிருந்து வேறுபட்டது என்று கற்பித்தார்கள்.`,
    shankaraEnglish: `anyat eva āhuḥ vidyayā = different indeed they say is the result of knowledge. anyat āhuḥ avidyayā = different they say is the result of ignorance. iti śuśruma dhīrāṇām = thus we have heard from the wise. ye naḥ tat vicacakṣire = who have explained that to us.

The wise teachers have taught that the result of vidyā (knowledge) is different from the result of avidyā (karma).`
  },
  11: {
    hiriyanna: `One who knows both knowledge and karma together—by karma, one crosses over death; by knowledge, one attains immortality.

This verse teaches the proper synthesis: one should know both vidyā and avidyā. By avidyā (ritualistic karma performed as a means of purification), one crosses over death. By vidyā (Self-knowledge), one attains immortality.`,
    anandagiri: `विद्यां चाविद्यां चेति । अथोभयसमुच्चयफलमाह — विद्यां चाविद्यां चेति । विद्यां ज्ञानम् अविद्यां कर्म च यस्तदुभयं सह वेद स अविद्यया कर्मणा मृत्युं तीर्त्वा विद्यया ज्ञानेनामृतमश्नुते ।`,
    sudarsana: `வித்யையையும் அவித்யையையும் ஒன்றாக அறிபவன் - அவித்யையால் மரணத்தைத் தாண்டுகிறான், வித்யையால் அமிர்தத்தை அடைகிறான்.

இந்த மந்திரம் சரியான ஒருங்கிணைப்பைக் கற்பிக்கிறது: ஒருவன் வித்யையையும் அவித்யையையும் அறிய வேண்டும். அவித்யையால் (சுத்திகரிப்புக்கான கர்மம்) மரணத்தைத் தாண்டுகிறான். வித்யையால் (ஆத்ம ஞானம்) அமிர்தத்தை அடைகிறான்.`,
    shankaraEnglish: `vidyāṃ ca avidyāṃ ca = both knowledge and karma. yaḥ tat veda ubhayaṃ saha = who knows both of them together. avidyayā mṛtyuṃ tīrtvā = crossing over death by means of karma. vidyayā amṛtam aśnute = by knowledge attains immortality.

This verse teaches the proper synthesis: one should know both vidyā and avidyā.`
  },
  12: {
    hiriyanna: `Those who worship non-becoming (the unmanifest Prakṛti) enter blinding darkness. Into greater darkness than that enter those who are devoted to becoming (the manifest effects like Hiraṇyagarbha).

This verse parallels the earlier one about vidyā and avidyā, now applied to asambhūti (the unmanifest cause, Prakṛti) and sambhūti (the manifest effect).`,
    anandagiri: `अन्धं तम इति । असम्भूतिसम्भूत्युपासनयोर्निन्दामाह — अन्धं तम इति । असम्भूतिं प्रकृतिमुपासते ये ते अन्धं तमः प्रविशन्ति । ततो भूय इव ये सम्भूत्यां हिरण्यगर्भे रताः ।`,
    sudarsana: `அஸம்பூதியை - அவ்யக்த பிரகிருதியை உபாசிப்பவர்கள் குருட்டு இருளில் நுழைகிறார்கள். ஸம்பூதியில் - ஹிரண்யகர்பன் போன்ற வ்யக்தத்தில் ஈடுபடுபவர்கள் அதை விட பெரிய இருளில் நுழைகிறார்கள்.

இந்த மந்திரம் வித்யா-அவித்யா பற்றிய முந்தைய மந்திரத்தை ஒத்தது, இங்கு அஸம்பூதி (அவ்யக்த காரணம்) மற்றும் ஸம்பூதி (வ்யக்த காரியம்) பற்றி கூறப்படுகிறது.`,
    shankaraEnglish: `andham tamaḥ praviśanti = they enter blinding darkness. ye asambhūtim upāsate = those who worship non-becoming (the unmanifest Prakṛti). tataḥ bhūya iva te tamaḥ = into greater darkness than that. ya u sambhūtyām ratāḥ = those who are devoted to becoming (the manifest effects like Hiraṇyagarbha).`
  },
  13: {
    hiriyanna: `Different indeed they say is the result of becoming. Different they say is the result of non-becoming. Thus we have heard from the wise who have explained that to us.

This teaching parallels verse 10, now applied to sambhūti and asambhūti.`,
    anandagiri: `अन्यदेवाहुरिति । सम्भवासम्भवयोर्भेदमाह — अन्यदेवाहुरिति । सम्भवात्सम्भूतेर्हिरण्यगर्भोपासनादन्यदेव फलमाहुः । असम्भवादसम्भूतेः प्रकृत्युपासनादन्यदाहुः ।`,
    sudarsana: `ஸம்பவத்தின் பலன் வேறு என்று சொல்கிறார்கள். அஸம்பவத்தின் பலன் வேறு என்று சொல்கிறார்கள். இவ்வாறு ஞானிகளிடம் கேட்டோம்.

இந்த போதனை பத்தாவது மந்திரத்தை ஒத்தது, இங்கு ஸம்பூதி மற்றும் அஸம்பூதி பற்றி கூறப்படுகிறது.`,
    shankaraEnglish: `anyat eva āhuḥ sambhavāt = different indeed they say is the result of becoming. anyat āhuḥ asambhavāt = different they say is the result of non-becoming. iti śuśruma dhīrāṇām = thus we have heard from the wise. ye naḥ tat vicacakṣire = who have explained that to us.`
  },
  14: {
    hiriyanna: `One who knows both becoming and destruction together—by destruction, one crosses over death; by becoming, one attains immortality.

This parallels verse 11, teaching the synthesis of both paths for complete spiritual development.`,
    anandagiri: `सम्भूतिं च विनाशं चेति । उभयसमुच्चयफलमाह — सम्भूतिं चेति । सम्भूतिं हिरण्यगर्भं विनाशं च प्रकृतिं यस्तदुभयं सह वेद स विनाशेन मृत्युं तीर्त्वा सम्भूत्याऽमृतमश्नुते ।`,
    sudarsana: `ஸம்பூதியையும் விநாசத்தையும் ஒன்றாக அறிபவன் - விநாசத்தால் மரணத்தைத் தாண்டுகிறான், ஸம்பூதியால் அமிர்தத்தை அடைகிறான்.

இது பதினொன்றாவது மந்திரத்தை ஒத்தது, முழுமையான ஆன்மீக வளர்ச்சிக்கு இரண்டு பாதைகளின் ஒருங்கிணைப்பைக் கற்பிக்கிறது.`,
    shankaraEnglish: `sambhūtiṃ ca vināśaṃ ca = both becoming and destruction. yas tad veda ubhayaṃ saha = who knows both of them together. vināśena mṛtyuṃ tīrtvā = crossing over death by means of destruction. sambhūtyā amṛtam aśnute = by becoming attains immortality.`
  },
  15: {
    hiriyanna: `The face of Truth is covered by a golden vessel. O Pūṣan, remove that cover so that I, whose dharma is Truth, may see It.

This verse is a prayer to the Sun deity to remove the covering of ignorance so that the aspirant may behold the ultimate Truth.`,
    anandagiri: `हिरण्मयेनेति । अथ सिद्धोपास्त्यर्थं ब्रह्मदर्शनं प्रार्थयते — हिरण्मयेनेति । हिरण्मयेन ज्योतिर्मयेन पात्रेण सत्यस्य ब्रह्मणो मुखं द्वारमपिहितमाच्छादितम् । तत्त्वं हे पूषन्नपावृणु अपसार्य सत्यधर्माय सत्यं धर्मो यस्य तस्मै मह्यं दृष्टये दर्शनाय ।`,
    sudarsana: `ஹிரண்மயமான பாத்திரத்தால் சத்யத்தின் முகம் மறைக்கப்பட்டுள்ளது. ஹே பூஷன், அதை நீக்கு, சத்ய தர்மத்தை உடைய நான் அதைக் காணும்படி.

இந்த மந்திரம் சூரிய தேவதையிடம் அஞ்ஞான மறைப்பை நீக்கும்படி பிரார்த்திக்கிறது, சாதகன் பரம சத்யத்தைக் காணும்படி.`,
    shankaraEnglish: `hiraṇmayena pātreṇa = by a golden vessel. satyasya apihitam mukham = the face of Truth is covered. tat tvam pūṣan apāvṛṇu = O Pūṣan, remove that cover. satyadharmāya dṛṣṭaye = so that I, whose dharma is Truth, may see It.

This verse is a prayer to the Sun deity to remove the covering of ignorance.`
  },
  16: {
    hiriyanna: `O Pūṣan, O lone traveler, O Yama, O Sun, O son of Prajāpati, spread out thy rays and gather in thy brilliance. That most auspicious form of thine I behold. He who is that Person there, I am He.

This is the prayer of the dying sage for direct vision of the Truth.`,
    anandagiri: `पूषन्नेकर्ष इति । अथ मृत्युकाले प्रार्थयते — पूषन्नेकर्ष इति । हे पूषन्पोषयितः, हे एकर्षे एकाकी ऋषति गच्छतीति, हे यम प्राणान्संयच्छति, हे सूर्य जगतोऽभिव्यञ्जक, हे प्राजापत्य प्रजापतेरपत्यम् ।`,
    sudarsana: `ஹே பூஷன், ஹே ஏகர்ஷி, ஹே யம, ஹே சூர்ய, ஹே பிராஜாபத்ய, உன் கிரணங்களை விரித்து, உன் தேஜஸை சேகரி. உன்னுடைய மிகவும் கல்யாணமான ரூபத்தை நான் காண்கிறேன். அங்குள்ள அந்த புருஷன் யாரோ, அவன் நானே.

இது மரணத்தருவாயில் உள்ள ரிஷியின் சத்ய தரிசனத்திற்கான பிரார்த்தனை.`,
    shankaraEnglish: `pūṣan = O Nourisher. ekarṣe = O lone traveler. yama = O Controller. sūrya = O Sun. prājāpatya = O son of Prajāpati. vyūha raśmīn = spread out thy rays. samūha tejaḥ = gather in thy brilliance. yat te rūpam kalyāṇatamam = that most auspicious form of thine. tat te paśyāmi = I behold. yo 'sāv asau puruṣaḥ = He who is that Person there. so 'ham asmi = I am He.`
  },
  17: {
    hiriyanna: `May this breath merge into the immortal Wind. May this body end in ashes. Om. O Intelligence, remember! Remember what has been done! O Intelligence, remember! Remember what has been done!

This is the prayer at the moment of death, commending the vital breath to the cosmic wind and the body to fire.`,
    anandagiri: `वायुरनिलमिति । अथ मरणकाले प्राणं प्रापयति — वायुरनिलमिति । वायुः प्राणोऽनिलं सूत्रात्मानं प्राप्नोतु । अथेदं शरीरं भस्मान्तं भवतु । ॐ क्रतो स्मर कृतं स्मर ।`,
    sudarsana: `வாயு அநிலத்தில் லயிக்கட்டும். இந்த சரீரம் பஸ்மத்தில் முடியட்டும். ஓம். ஹே க்ரது, நினை! செய்ததை நினை! ஹே க்ரது, நினை! செய்ததை நினை!

இது மரண தருவாயில் செய்யும் பிரார்த்தனை, பிராணனை காற்றிலும், உடலை நெருப்பிலும் ஒப்படைக்கிறது.`,
    shankaraEnglish: `vāyuḥ = breath. anilam = the immortal Wind. amṛtam = immortal. atha idam = and this. bhasmāntam śarīram = body ending in ashes. Om krato smara = O Intelligence, remember! kṛtam smara = Remember what has been done!

This is the prayer at the moment of death.`
  },
  18: {
    hiriyanna: `O Agni, lead us by the good path to prosperity. O God, you who know all the ways! Remove from us crooked-going sin. We shall offer you the fullest salutation.

This is the final prayer for guidance on the path of virtue and liberation.`,
    anandagiri: `अग्ने नय इति । अथान्तिमं प्रार्थयते — अग्ने नय इति । हे अग्ने नय गमय सुपथा शोभनेन मार्गेण राये धनाय अस्मान् । विश्वानि सर्वाणि वयुनानि कर्मफलानि हे देव जानन्विद्वान् । युयोधि विनाशय अस्मत्तोऽस्मज्जुहुराणं वक्रं गमनशीलं एनः पापम् । भूयिष्ठां बहुतमां ते तुभ्यं नमउक्तिं नमस्कारवचनं विधेम करिष्यामः ।`,
    sudarsana: `ஹே அக்னே, நல்ல பாதையில் செல்வத்திற்கு எங்களை நடத்து. ஹே தேவ, எல்லா வழிகளையும் அறிந்தவனே! எங்களிடமிருந்து வளைந்த பாவத்தை நீக்கு. உனக்கு முழுமையான நமஸ்காரத்தை செய்வோம்.

இது புண்ணிய மார்க்கத்திலும் முக்தியிலும் வழிகாட்டுதலுக்கான இறுதி பிரார்த்தனை.`,
    shankaraEnglish: `agne naya = O Agni, lead us. supathā = by the good path. rāye = to prosperity. asmān = us. viśvāni deva vayunāni vidvān = O God, you who know all the ways! yuyodhi asmaj juhurāṇam enaḥ = Remove from us crooked-going sin. bhūyiṣṭhām te nama-uktim vidhema = We shall offer you the fullest salutation.

This is the final prayer for guidance on the path of virtue and liberation.`
  }
};

/**
 * Isha Upanishad Bhashya Data
 * 
 * Source: https://advaitasharada.sringeri.net/display/bhashya/Isha/
 * Available in: devanagari, kn (Kannada), te (Telugu), ta (Tamil)
 * 
 * This data is from the Advaita Sharada website maintained by
 * Sringeri Sharada Peetham.
 */

const MANTRAS = [
  {
    number: 1,
    devanagari: {
      mula: `ईशा वास्यमिदं सर्वं यत्किं च जगत्यां जगत् ।
तेन त्यक्तेन भुञ्जीथा मा गृधः कस्य स्विद्धनम् ॥ १ ॥`,
      bhashya: `ईशा ईष्टे इति ईट् , तेन ईशा । ईशिता परमेश्वरः परमात्मा सर्वस्य । स हि सर्वमीष्टे सर्वजन्तूनामात्मा सन् प्रत्यगात्मतया । तेन स्वेन रूपेणात्मना ईशा वास्यम् आच्छादनीयम् । किम् ? इदं सर्वं यत्किं च यत्किञ्चित् जगत्यां पृथिव्यां जगत् तत्सर्वम् । स्वेनात्मना ईशेन प्रत्यगात्मतया अहमेवेदं सर्वमिति परमार्थसत्यरूपेणानृतमिदं सर्वं चराचरमाच्छादनीयं परमात्मना । यथा चन्दनागर्वादेरुदकादिसम्बन्धजक्लेदादिजमौपाधिकं दौर्गन्ध्यं तत्स्वरूपनिघर्षणेनाच्छाद्यते स्वेन पारमार्थिकेन गन्धेन, तद्वदेव हि स्वात्मन्यध्यस्तं स्वाभाविकं कर्तृत्वभोक्तृत्वादिलक्षणं जगद्द्वैतरूपं पृथिव्याम् , जगत्यामित्युपलक्षणार्थत्वात्सर्वमेव नामरूपकर्माख्यं विकारजातं परमार्थसत्यात्मभावनया त्यक्तं स्यात् । एवमीश्वरात्मभावनया युक्तस्य पुत्राद्येषणात्रयसंन्यासे एवाधिकारः, न कर्मसु । तेन त्यक्तेन त्यागेनेत्यर्थः । न हि त्यक्तो मृतः पुत्रो भृत्यो वा आत्मसम्बन्धिताभावादात्मानं पालयति । अतस्त्यागेनेत्ययमेवार्थः । भुञ्जीथाः पालयेथाः । एवं त्यक्तैषणस्त्वं मा गृधः गृधिम् आकाङ्क्षां मा कार्षीः धनविषयाम् । कस्य स्वित् कस्यचित् परस्य स्वस्य वा धनं मा काङ्क्षीरित्यर्थः । स्विदित्यनर्थको निपातः । अथवा, मा गृधः । कस्मात् ? कस्य स्विद्धनम् इत्याक्षेपार्थः । न कस्यचिद्धनमस्ति, यद्गृध्येत । आत्मैवेदं सर्वमितीश्वरभावनया सर्वं त्यक्तम् । अत आत्मन एवेदं सर्वम् , आत्मैव च सर्वम् । अतो मिथ्याविषयां गृधिं मा कार्षीरित्यर्थः ॥`
    },
    kannada: {
      mula: `ಈಶಾ ವಾಸ್ಯಮಿದಂ ಸರ್ವಂ ಯತ್ಕಿಂ ಚ ಜಗತ್ಯಾಂ ಜಗತ್ ।
ತೇನ ತ್ಯಕ್ತೇನ ಭುಂಜೀಥಾ ಮಾ ಗೃಧಃ ಕಸ್ಯ ಸ್ವಿದ್ಧನಮ್ ॥ ೧ ॥`,
      bhashya: `ಈಶಾ ಈಷ್ಟೇ ಇತಿ ಈಟ್ , ತೇನ ಈಶಾ । ಈಶಿತಾ ಪರಮೇಶ್ವರಃ ಪರಮಾತ್ಮಾ ಸರ್ವಸ್ಯ । ಸ ಹಿ ಸರ್ವಮೀಷ್ಟೇ ಸರ್ವಜಂತೂನಾಮಾತ್ಮಾ ಸನ್ ಪ್ರತ್ಯಗಾತ್ಮತಯಾ । ತೇನ ಸ್ವೇನ ರೂಪೇಣಾತ್ಮನಾ ಈಶಾ ವಾಸ್ಯಮ್ ಆಚ್ಛಾದನೀಯಮ್ । ಕಿಮ್ ? ಇದಂ ಸರ್ವಂ ಯತ್ಕಿಂ ಚ ಯತ್ಕಿಂಚಿತ್ ಜಗತ್ಯಾಂ ಪೃಥಿವ್ಯಾಂ ಜಗತ್ ತತ್ಸರ್ವಮ್ । ಸ್ವೇನಾತ್ಮನಾ ಈಶೇನ ಪ್ರತ್ಯಗಾತ್ಮತಯಾ ಅಹಮೇವೇದಂ ಸರ್ವಮಿತಿ ಪರಮಾರ್ಥಸತ್ಯರೂಪೇಣಾನೃತಮಿದಂ ಸರ್ವಂ ಚರಾಚರಮಾಚ್ಛಾದನೀಯಂ ಪರಮಾತ್ಮನಾ । ಯಥಾ ಚಂದನಾಗರ್ವಾದೇರುದಕಾದಿಸಂಬಂಧಜಕ್ಲೇದಾದಿಜಮೌಪಾಧಿಕಂ ದೌರ್ಗಂಧ್ಯಂ ತತ್ಸ್ವರೂಪನಿಘರ್ಷಣೇನಾಚ್ಛಾದ್ಯತೇ ಸ್ವೇನ ಪಾರಮಾರ್ಥಿಕೇನ ಗಂಧೇನ, ತದ್ವದೇವ ಹಿ ಸ್ವಾತ್ಮನ್ಯಧ್ಯಸ್ತಂ ಸ್ವಾಭಾವಿಕಂ ಕರ್ತೃತ್ವಭೋಕ್ತೃತ್ವಾದಿಲಕ್ಷಣಂ ಜಗದ್ದ್ವೈತರೂಪಂ ಪೃಥಿವ್ಯಾಮ್ , ಜಗತ್ಯಾಮಿತ್ಯುಪಲಕ್ಷಣಾರ್ಥತ್ವಾತ್ಸರ್ವಮೇವ ನಾಮರೂಪಕರ್ಮಾಖ್ಯಂ ವಿಕಾರಜಾತಂ ಪರಮಾರ್ಥಸತ್ಯಾತ್ಮಭಾವನಯಾ ತ್ಯಕ್ತಂ ಸ್ಯಾತ್ । ಏವಮೀಶ್ವರಾತ್ಮಭಾವನಯಾ ಯುಕ್ತಸ್ಯ ಪುತ್ರಾದ್ಯೇಷಣಾತ್ರಯಸಂನ್ಯಾಸೇ ಏವಾಧಿಕಾರಃ, ನ ಕರ್ಮಸು । ತೇನ ತ್ಯಕ್ತೇನ ತ್ಯಾಗೇನೇತ್ಯರ್ಥಃ । ನ ಹಿ ತ್ಯಕ್ತೋ ಮೃತಃ ಪುತ್ರೋ ಭೃತ್ಯೋ ವಾ ಆತ್ಮಸಂಬಂಧಿತಾಭಾವಾದಾತ್ಮಾನಂ ಪಾಲಯತಿ । ಅತಸ್ತ್ಯಾಗೇನೇತ್ಯಯಮೇವಾರ್ಥಃ । ಭುಂಜೀಥಾಃ ಪಾಲಯೇಥಾಃ । ಏವಂ ತ್ಯಕ್ತೈಷಣಸ್ತ್ವಂ ಮಾ ಗೃಧಃ ಗೃಧಿಮ್ ಆಕಾಂಕ್ಷಾಂ ಮಾ ಕಾರ್ಷೀಃ ಧನವಿಷಯಾಮ್ । ಕಸ್ಯ ಸ್ವಿತ್ ಕಸ್ಯಚಿತ್ ಪರಸ್ಯ ಸ್ವಸ್ಯ ವಾ ಧನಂ ಮಾ ಕಾಂಕ್ಷೀರಿತ್ಯರ್ಥಃ । ಸ್ವಿದಿತ್ಯನರ್ಥಕೋ ನಿಪಾತಃ । ಅಥವಾ, ಮಾ ಗೃಧಃ । ಕಸ್ಮಾತ್ ? ಕಸ್ಯ ಸ್ವಿದ್ಧನಮ್ ಇತ್ಯಾಕ್ಷೇಪಾರ್ಥಃ । ನ ಕಸ್ಯಚಿದ್ಧನಮಸ್ತಿ, ಯದ್ಗೃಧ್ಯೇತ । ಆತ್ಮೈವೇದಂ ಸರ್ವಮಿತೀಶ್ವರಭಾವನಯಾ ಸರ್ವಂ ತ್ಯಕ್ತಮ್ । ಅತ ಆತ್ಮನ ಏವೇದಂ ಸರ್ವಮ್ , ಆತ್ಮೈವ ಚ ಸರ್ವಮ್ । ಅತೋ ಮಿಥ್ಯಾವಿಷಯಾಂ ಗೃಧಿಂ ಮಾ ಕಾರ್ಷೀರಿತ್ಯರ್ಥಃ ॥`
    },
    telugu: {
      mula: `ఈశా వాస్యమిదం సర్వం యత్కిం చ జగత్యాం జగత్ ।
తేన త్యక్తేన భుఞ్జీథా మా గృధః కస్య స్విద్ధనమ్ ॥ ౧ ॥`,
      bhashya: `ఈశా ఈష్టే ఇతి ఈట్ , తేన ఈశా । ఈశితా పరమేశ్వరః పరమాత్మా సర్వస్య । స హి సర్వమీష్టే సర్వజన్తూనామాత్మా సన్ ప్రత్యగాత్మతయా । తేన స్వేన రూపేణాత్మనా ఈశా వాస్యమ్ ఆచ్ఛాదనీయమ్ । కిమ్ ? ఇదం సర్వం యత్కిం చ యత్కిఞ్చిత్ జగత్యాం పృథివ్యాం జగత్ తత్సర్వమ్ । స్వేనాత్మనా ఈశేన ప్రత్యగాత్మతయా అహమేవేదం సర్వమితి పరమార్థసత్యరూపేణానృతమిదం సర్వం చరాచరమాచ్ఛాదనీయం పరమాత్మనా । యథా చన్దనాగర్వాదేరుదకాదిసమ్బన్ధజక్లేదాదిజమౌపాధికం దౌర్గన్ధ్యం తత్స్వరూపనిఘర్షణేనాచ్ఛాద్యతే స్వేన పారమార్థికేన గన్ధేన, తద్వదేవ హి స్వాత్మన్యధ్యస్తం స్వాభావికం కర్తృత్వభోక్తృత్వాదిలక్షణం జగద్ద్వైతరూపం పృథివ్యామ్ , జగత్యామిత్యుపలక్షణార్థత్వాత్సర్వమేవ నామరూపకర్మాఖ్యం వికారజాతం పరమార్థసత్యాత్మభావనయా త్యక్తం స్యాత్ । ఏవమీశ్వరాత్మభావనయా యుక్తస్య పుత్రాద్యేషణాత్రయసంన్యాసే ఏవాధికారః, న కర్మసు । తేన త్యక్తేన త్యాగేనేత్యర్థః । న హి త్యక్తో మృతః పుత్రో భృత్యో వా ఆత్మసమ్బన్ధితాభావాదాత్మానం పాలయతి । అతస్త్యాగేనేత్యయమేవార్థః । భుఞ్జీథాః పాలయేథాః । ఏవం త్యక్తైషణస్త్వం మా గృధః గృధిమ్ ఆకాఙ్క్షాం మా కార్షీః ధనవిషయామ్ । కస్య స్విత్ కస్యచిత్ పరస్య స్వస్య వా ధనం మా కాఙ్క్షీరిత్యర్థః । స్విదిత్యనర్థకో నిపాతః । అథవా, మా గృధః । కస్మాత్ ? కస్య స్విద్ధనమ్ ఇత్యాక్షేపార్థః । న కస్యచిద్ధనమస్తి, యద్గృధ్యేత । ఆత్మైవేదం సర్వమితీశ్వరభావనయా సర్వం త్యక్తమ్ । అత ఆత్మన ఏవేదం సర్వమ్ , ఆత్మైవ చ సర్వమ్ । అతో మిథ్యావిషయాం గృధిం మా కార్షీరిత్యర్థః ॥`
    },
    tamil: {
      mula: `ஈஶா வாஸ்யமித³ம் ஸர்வம் யத்கிம் ச ஜக³த்யாம் ஜக³த் ।
தேந த்யக்தேந பு⁴ஞ்ஜீதா² மா க்³ருத⁴: கஸ்ய ஸ்வித்³த⁴நம் ॥ 1 ॥`,
      bhashya: `ஈஶா ஈஷ்டே இதி ஈட் , தேந ஈஶா । ஈஶிதா பரமேஶ்வர: பரமாத்மா ஸர்வஸ்ய । ஸ ஹி ஸர்வமீஷ்டே ஸர்வஜந்தூநாமாத்மா ஸந் ப்ரத்யகா³த்மதயா । தேந ஸ்வேந ரூபேணாத்மநா ஈஶா வாஸ்யம் ஆச்சா²த³நீயம் । கிம் ? இத³ம் ஸர்வம் யத்கிம் ச யத்கிஞ்சித் ஜக³த்யாம் ப்ருதி²வ்யாம் ஜக³த் தத்ஸர்வம் । ஸ்வேநாத்மநா ஈஶேந ப்ரத்யகா³த்மதயா அஹமேவேத³ம் ஸர்வமிதி பரமார்த²ஸத்யரூபேணாந்ருதமித³ம் ஸர்வம் சராசரமாச்சா²த³நீயம் பரமாத்மநா । யதா² சந்த³நாக³ர்வாதே³ருத³காதி³ஸம்ப³ந்த⁴ஜக்லேதா³தி³ஜமௌபாதி⁴கம் தௌ³ர்க³ந்த்⁴யம் தத்ஸ்வரூபநிக⁴ர்ஷணேநாச்சா²த்³யதே ஸ்வேந பாரமார்தி²கேந க³ந்தே⁴ந, தத்³வதே³வ ஹி ஸ்வாத்மந்யத்⁴யஸ்தம் ஸ்வாபா⁴விகம் கர்த்ருத்வபோ⁴க்த்ருத்வாதி³லக்ஷணம் ஜக³த்³த்³வைதரூபம் ப்ருதி²வ்யாம் , ஜக³த்யாமித்யுபலக்ஷணார்த²த்வாத்ஸர்வமேவ நாமரூபகர்மாக்²யம் விகாரஜாதம் பரமார்த²ஸத்யாத்மபா⁴வநயா த்யக்தம் ஸ்யாத் । ஏவமீஶ்வராத்மபா⁴வநயா யுக்தஸ்ய புத்ராத்³யேஷணாத்ரயஸம்ந்யாஸே ஏவாதி⁴கார:, ந கர்மஸு । தேந த்யக்தேந த்யாகே³நேத்யர்த:² । ந ஹி த்யக்தோ ம்ருத: புத்ரோ ப்⁴ருத்யோ வா ஆத்மஸம்ப³ந்தி⁴தாபா⁴வாதா³த்மாநம் பாலயதி । அதஸ்த்யாகே³நேத்யயமேவார்த:² । பு⁴ஞ்ஜீதா:² பாலயேதா:² । ஏவம் த்யக்தைஷணஸ்த்வம் மா க்³ருத:⁴ க்³ருதி⁴ம் ஆகாங்க்ஷாம் மா கார்ஷீ: த⁴நவிஷயாம் । கஸ்ய ஸ்வித் கஸ்யசித் பரஸ்ய ஸ்வஸ்ய வா த⁴நம் மா காங்க்ஷீரித்யர்த:² । ஸ்விதி³த்யநர்த²கோ நிபாத: । அத²வா, மா க்³ருத:⁴ । கஸ்மாத் ? கஸ்ய ஸ்வித்³த⁴நம் இத்யாக்ஷேபார்த:² । ந கஸ்யசித்³த⁴நமஸ்தி, யத்³க்³ருத்⁴யேத । ஆத்மைவேத³ம் ஸர்வமிதீஶ்வரபா⁴வநயா ஸர்வம் த்யக்தம் । அத ஆத்மந ஏவேத³ம் ஸர்வம் , ஆத்மைவ ச ஸர்வம் । அதோ மித்²யாவிஷயாம் க்³ருதி⁴ம் மா கார்ஷீரித்யர்த:² ॥`
    }
  },
  {
    number: 2,
    devanagari: {
      mula: `कुर्वन्नेवेह कर्माणि जिजीविषेच्छतं समाः ।
एवं त्वयि नान्यथेतोऽस्ति न कर्म लिप्यते नरे ॥ २ ॥`,
      bhashya: `कुर्वन्नेव निर्वर्तयन्नेव इह कर्माणि अग्निहोत्रादीनि जिजीविषेत् जीवितुमिच्छेत् शतं शतसङ्ख्याकाः समाः संवत्सरान् । तावद्धि पुरुषस्य परमायुर्निरूपितम् ।`
    },
    kannada: {
      mula: `ಕುರ್ವನ್ನೇವೇಹ ಕರ್ಮಾಣಿ ಜಿಜೀವಿಷೇಚ್ಛತಂ ಸಮಾಃ ।
ಏವಂ ತ್ವಯಿ ನಾನ್ಯಥೇತೋಽಸ್ತಿ ನ ಕರ್ಮ ಲಿಪ್ಯತೇ ನರೇ ॥ ೨ ॥`,
      bhashya: `ಕುರ್ವನ್ನೇವ ನಿರ್ವರ್ತಯನ್ನೇವ ಇಹ ಕರ್ಮಾಣಿ ಅಗ್ನಿಹೋತ್ರಾದೀನಿ ಜಿಜೀವಿಷೇತ್ ಜೀವಿತುಮಿಚ್ಛೇತ್ ಶತಂ ಶತಸಂಖ್ಯಾಕಾಃ ಸಮಾಃ ಸಂವತ್ಸರಾನ್ ।`
    },
    telugu: {
      mula: `కుర్వన్నేవేహ కర్మాణి జిజీవిషేచ్ఛతం సమాః ।
ఎవం త్వయి నాన్యథేతోఽస్తి న కర్మ లిప్యతే నరే ॥ ౨ ॥`,
      bhashya: `కుర్వన్నేవ నిర్వర్తయన్నేవ ఇహ కర్మాణి అగ్నిహోత్రాదీని జిజీవిషేత్ జీవితుమిచ్ఛేత్ శతం శతసఙ్ఖ్యాకాః సమాః సంవత్సరాన్ ।`
    },
    tamil: {
      mula: `குர்வந்நேவேஹ கர்மாணி ஜிஜீவிஷேச்ச²தம் ஸமா: ।
ஏவம் த்வயி நாந்யதே²தோ(அ)ஸ்தி ந கர்ம லிப்யதே நரே ॥ 2 ॥`,
      bhashya: `குர்வந்நேவ நிர்வர்தயந்நேவ இஹ கர்மாணி அக்³நிஹோத்ராதீ³நி ஜிஜீவிஷேத் ஜீவிதுமிச்சே²த் ஶதம் ஶதஸங்க்²யாகா: ஸமா: ஸம்வத்ஸராந் ।`
    }
  },
  {
    number: 3,
    devanagari: {
      mula: `असुर्या नाम ते लोका अन्धेन तमसा वृताः ।
तांस्ते प्रेत्याभिगच्छन्ति ये के चात्महनो जनाः ॥ ३ ॥`,
      bhashya: `असुर्याः परमात्मभावमद्वयमपेक्ष्य देवादयोऽप्यसुराः । तेषां च स्वभूता लोका असुर्याः नाम । ते लोकाः कर्मफलानि लोक्यन्ते दृश्यन्ते भुज्यन्त इति जन्मानि ।`
    },
    kannada: {
      mula: `ಅಸುರ್ಯಾ ನಾಮ ತೇ ಲೋಕಾ ಅಂಧೇನ ತಮಸಾ ವೃತಾಃ ।
ತಾಂಸ್ತೇ ಪ್ರೇತ್ಯಾಭಿಗಚ್ಛಂತಿ ಯೇ ಕೇ ಚಾತ್ಮಹನೋ ಜನಾಃ ॥ ೩ ॥`,
      bhashya: `ಅಸುರ್ಯಾಃ ಪರಮಾತ್ಮಭಾವಮದ್ವಯಮಪೇಕ್ಷ್ಯ ದೇವಾದಯೋಽಪ್ಯಸುರಾಃ । ತೇಷಾಂ ಚ ಸ್ವಭೂತಾ ಲೋಕಾ ಅಸುರ್ಯಾಃ ನಾಮ ।`
    },
    telugu: {
      mula: `అసుర్యా నామ తే లోకా అన్ధేన తమసా వృతాః ।
తాంస్తే ప్రేత్యాభిగచ్ఛన్తి యే కే చాత్మహనో జనాః ॥ ౩ ॥`,
      bhashya: `అసుర్యాః పరమాత్మభావమద్వయమపేక్ష్య దేవాదయోఽప్యసురాః । తేషాం చ స్వభూతా లోకా అసుర్యాః నామ ।`
    },
    tamil: {
      mula: `அஸுர்யா நாம தே லோகா அந்தே⁴ந தமஸா வ்ருதா: ।
தாம்ஸ்தே ப்ரேத்யாபி⁴க³ச்ச²ந்தி யே கே சாத்மஹநோ ஜநா: ॥ 3 ॥`,
      bhashya: `அஸுர்யா: பரமாத்மபா⁴வமத்³வயமபேக்ஷ்ய தே³வாத³யோ(அ)ப்யஸுரா: । தேஷாம் ச ஸ்வபூ⁴தா லோகா அஸுர்யா: நாம ।`
    }
  },
  {
    number: 4,
    devanagari: {
      mula: `अनेजदेकं मनसो जवीयो नैनद्देवा आप्नुवन्पूर्वमर्षत् ।
तद्धावतोऽन्यानत्येति तिष्ठत्तस्मिन्नपो मातरिश्वा दधाति ॥ ४ ॥`,
      bhashya: `अनेजत् न एजत् एजृ कम्पने, न कम्पते निश्चलमित्यर्थः । एकं सर्वभूतेषु । मनसः सङ्कल्पाध्यवसायलक्षणात् जवीयः शीघ्रतरम् ।`
    },
    kannada: {
      mula: `ಅನೇಜದೇಕಂ ಮನಸೋ ಜವೀಯೋ ನೈನದ್ದೇವಾ ಆಪ್ನುವನ್ಪೂರ್ವಮರ್ಷತ್ ।
ತದ್ಧಾವತೋಽನ್ಯಾನತ್ಯೇತಿ ತಿಷ್ಠತ್ತಸ್ಮಿನ್ನಪೋ ಮಾತರಿಶ್ವಾ ದಧಾತಿ ॥ ೪ ॥`,
      bhashya: `ಅನೇಜತ್ ನ ಏಜತ್ ಏಜೃ ಕಂಪನೇ, ನ ಕಂಪತೇ ನಿಶ್ಚಲಮಿತ್ಯರ್ಥಃ । ಏಕಂ ಸರ್ವಭೂತೇಷು ।`
    },
    telugu: {
      mula: `అనేజదేకం మనసో జవీయో నైనద్దేవా ఆప్నువన్పూర్వమర్షత్ ।
తద్ధావతోఽన్యానత్యేతి తిష్ఠత్తస్మిన్నపో మాతరిశ్వా దధాతి ॥ ౪ ॥`,
      bhashya: `అనేజత్ న ఏజత్ ఏజృ కంపనే, న కంపతే నిశ్చలమిత్యర్థః । ఏకం సర్వభూతేషు ।`
    },
    tamil: {
      mula: `அநேஜதே³கம் மநஸோ ஜவீயோ நைநத்³தே³வா ஆப்நுவந்பூர்வமர்ஷத் ।
தத்³தா⁴வதோ(அ)ந்யாநத்யேதி திஷ்ட²த்தஸ்மிந்நபோ மாதரிஶ்வா த³தா⁴தி ॥ 4 ॥`,
      bhashya: `அநேஜத் ந ஏஜத் ஏஜ்ரு கம்பநே, ந கம்பதே நிஶ்சலமித்யர்த²: । ஏகம் ஸர்வபூ⁴தேஷு ।`
    }
  },
  {
    number: 5,
    devanagari: {
      mula: `तदेजति तन्नैजति तद्दूरे तद्वन्तिके ।
तदन्तरस्य सर्वस्य तदु सर्वस्यास्य बाह्यतः ॥ ५ ॥`,
      bhashya: `तत् आत्मतत्त्वम् एजति चलतीव अविद्वत्प्रत्ययगोचरम् , स्वतः तु तन्नैजति न चलति निश्चलमेव तत् ।`
    },
    kannada: {
      mula: `ತದೇಜತಿ ತನ್ನೈಜತಿ ತದ್ದೂರೇ ತದ್ವಂತಿಕೇ ।
ತದಂತರಸ್ಯ ಸರ್ವಸ್ಯ ತದು ಸರ್ವಸ್ಯಾಸ್ಯ ಬಾಹ್ಯತಃ ॥ ೫ ॥`,
      bhashya: `ತತ್ ಆತ್ಮತತ್ತ್ವಮ್ ಏಜತಿ ಚಲತೀವ ಅವಿದ್ವತ್ಪ್ರತ್ಯಯಗೋಚರಮ್ , ಸ್ವತಃ ತು ತನ್ನೈಜತಿ ನ ಚಲತಿ ನಿಶ್ಚಲಮೇವ ತತ್ ।`
    },
    telugu: {
      mula: `తదేజతి తన్నైజతి తద్దూరే తద్వంతికే ।
తదంతరస్య సర్వస్య తదు సర్వస్యాస్య బాహ్యతః ॥ ౫ ॥`,
      bhashya: `తత్ ఆత్మతత్త్వమ్ ఏజతి చలతీవ అవిద్వత్ప్రత్యయగోచరమ్ , స్వతః తు తన్నైజతి న చలతి నిశ్చలమేవ తత్ ।`
    },
    tamil: {
      mula: `ததே³ஜதி தந்நைஜதி தத்³தூ³ரே தத்³வந்திகே ।
தத³ந்தரஸ்ய ஸர்வஸ்ய தது³ ஸர்வஸ்யாஸ்ய பா³ஹ்யத: ॥ 5 ॥`,
      bhashya: `தத் ஆத்மதத்த்வம் ஏஜதி சலதீவ அவித்³வத்ப்ரத்யயகோ³சரம் , ஸ்வத: து தந்நைஜதி ந சலதி நிஶ்சலமேவ தத் ।`
    }
  },
  {
    number: 6,
    devanagari: {
      mula: `यस्तु सर्वाणि भूतान्यात्मन्येवानुपश्यति ।
सर्वभूतेषु चात्मानं ततो न विजुगुप्सते ॥ ६ ॥`,
      bhashya: `यस्तु विद्वान् सर्वाणि भूतानि आब्रह्मस्तम्बपर्यन्तानि आत्मनि एव परमार्थतो निर्विशेषे अद्वये अनुपश्यति ज्ञात्वा सर्वभूतस्थं च आत्मानं ततः तस्मात्परमार्थात्मदर्शनात् न विजुगुप्सते ।`
    },
    kannada: {
      mula: `ಯಸ್ತು ಸರ್ವಾಣಿ ಭೂತಾನ್ಯಾತ್ಮನ್ಯೇವಾನುಪಶ್ಯತಿ ।
ಸರ್ವಭೂತೇಷು ಚಾತ್ಮಾನಂ ತತೋ ನ ವಿಜುಗುಪ್ಸತೇ ॥ ೬ ॥`,
      bhashya: `ಯಸ್ತು ವಿದ್ವಾನ್ ಸರ್ವಾಣಿ ಭೂತಾನಿ ಆಬ್ರಹ್ಮಸ್ತಂಬಪರ್ಯಂತಾನಿ ಆತ್ಮನಿ ಏವ ಪರಮಾರ್ಥತೋ ನಿರ್ವಿಶೇಷೇ ಅದ್ವಯೇ ಅನುಪಶ್ಯತಿ ।`
    },
    telugu: {
      mula: `యస్తు సర్వాణి భూతాన్యాత్మన్యేవానుపశ్యతి ।
సర్వభూతేషు చాత్మానం తతో న విజుగుప్సతే ॥ ౬ ॥`,
      bhashya: `యస్తు విద్వాన్ సర్వాణి భూతాని ఆబ్రహ్మస్తంబపర్యంతాని ఆత్మని ఏవ పరమార్థతో నిర్విశేషే అద్వయే అనుపశ్యతి ।`
    },
    tamil: {
      mula: `யஸ்து ஸர்வாணி பூ⁴தாந்யாத்மந்யேவாநுபஶ்யதி ।
ஸர்வபூ⁴தேஷு சாத்மாநம் ததோ ந விஜுகு³ப்ஸதே ॥ 6 ॥`,
      bhashya: `யஸ்து வித்³வாந் ஸர்வாணி பூ⁴தாநி ஆப்³ரஹ்மஸ்தம்ப³பர்யந்தாநி ஆத்மநி ஏவ பரமார்த²தோ நிர்விஶேஷே அத்³வயே அநுபஶ்யதி ।`
    }
  },
  {
    number: 7,
    devanagari: {
      mula: `यस्मिन्सर्वाणि भूतान्यात्मैवाभूद्विजानतः ।
तत्र को मोहः कः शोक एकत्वमनुपश्यतः ॥ ७ ॥`,
      bhashya: `यस्मिन् यस्मिन्काले सर्वाणि भूतानि आत्मैव अभूत् विजानतः सम्यग्दर्शिनः, तत्र तस्मिन्काले को मोहः कः शोक एकत्वम् अनुपश्यतः एकत्वं पश्यतः ।`
    },
    kannada: {
      mula: `ಯಸ್ಮಿನ್ಸರ್ವಾಣಿ ಭೂತಾನ್ಯಾತ್ಮೈವಾಭೂದ್ವಿಜಾನತಃ ।
ತತ್ರ ಕೋ ಮೋಹಃ ಕಃ ಶೋಕ ಏಕತ್ವಮನುಪಶ್ಯತಃ ॥ ೭ ॥`,
      bhashya: `ಯಸ್ಮಿನ್ ಯಸ್ಮಿನ್ಕಾಲೇ ಸರ್ವಾಣಿ ಭೂತಾನಿ ಆತ್ಮೈವ ಅಭೂತ್ ವಿಜಾನತಃ ಸಮ್ಯಗ್ದರ್ಶಿನಃ ।`
    },
    telugu: {
      mula: `యస్మిన్సర్వాణి భూతాన్యాత్మైవాభూద్విజానతః ।
తత్ర కో మోహః కః శోక ఏకత్వమనుపశ్యతః ॥ ౭ ॥`,
      bhashya: `యస్మిన్ యస్మిన్కాలే సర్వాణి భూతాని ఆత్మైవ అభూత్ విజానతః సమ్యగ్దర్శినః ।`
    },
    tamil: {
      mula: `யஸ்மிந்ஸர்வாணி பூ⁴தாந்யாத்மைவாபூ⁴த்³விஜாநத: ।
தத்ர கோ மோஹ: க: ஶோக ஏகத்வமநுபஶ்யத: ॥ 7 ॥`,
      bhashya: `யஸ்மிந் யஸ்மிந்காலே ஸர்வாணி பூ⁴தாநி ஆத்மைவ அபூ⁴த் விஜாநத: ஸம்யக்³த³ர்ஶிந: ।`
    }
  },
  {
    number: 8,
    devanagari: {
      mula: `स पर्यगाच्छुक्रमकायमव्रणमस्नाविरं शुद्धमपापविद्धम् ।
कविर्मनीषी परिभूः स्वयम्भूर्याथातथ्यतोऽर्थान्व्यदधाच्छाश्वतीभ्यः समाभ्यः ॥ ८ ॥`,
      bhashya: `सः पूर्वमन्त्रोक्त आत्मा पर्यगात् पर्यग्-गम्-लृँ गतौ, पर्यगात् सर्वतोऽगमत् सर्वव्यापीत्यर्थः, शुक्रं शुद्धम् अकायं शरीरवर्जितम् ।`
    },
    kannada: {
      mula: `ಸ ಪರ್ಯಗಾಚ್ಛುಕ್ರಮಕಾಯಮವ್ರಣಮಸ್ನಾವಿರಂ ಶುದ್ಧಮಪಾಪವಿದ್ಧಮ್ ।
ಕವಿರ್ಮನೀಷೀ ಪರಿಭೂಃ ಸ್ವಯಂಭೂರ್ಯಾಥಾತಥ್ಯತೋಽರ್ಥಾನ್ವ್ಯದಧಾಚ್ಛಾಶ್ವತೀಭ್ಯಃ ಸಮಾಭ್ಯಃ ॥ ೮ ॥`,
      bhashya: `ಸಃ ಪೂರ್ವಮಂತ್ರೋಕ್ತ ಆತ್ಮಾ ಪರ್ಯಗಾತ್ ಸರ್ವತೋಽಗಮತ್ ಸರ್ವವ್ಯಾಪೀತ್ಯರ್ಥಃ, ಶುಕ್ರಂ ಶುದ್ಧಮ್ ಅಕಾಯಂ ಶರೀರವರ್ಜಿತಮ್ ।`
    },
    telugu: {
      mula: `స పర్యగాచ్ఛుక్రమకాయమవ్రణమస్నావిరం శుద్ధమపాపవిద్ధమ్ ।
కవిర్మనీషీ పరిభూః స్వయంభూర్యాథాతథ్యతోఽర్థాన్వ్యదధాచ్ఛాశ్వతీభ్యః సమాభ్యః ॥ ౮ ॥`,
      bhashya: `సః పూర్వమంత్రోక్త ఆత్మా పర్యగాత్ సర్వతోఽగమత్ సర్వవ్యాపీత్యర్థః, శుక్రం శుద్ధమ్ అకాయం శరీరవర్జితమ్ ।`
    },
    tamil: {
      mula: `ஸ பர்யகா³ச்சு²க்ரமகாயமவ்ரணமஸ்நாவிரம் ஶுத்³த⁴மபாபவித்³த⁴ம் ।
கவிர்மநீஷீ பரிபூ⁴: ஸ்வயம்பூ⁴ர்யாதா²தத்²யதோ(அ)ர்தா²ந்வ்யத³தா⁴ச்சா²ஶ்வதீப்⁴ய: ஸமாப்⁴ய: ॥ 8 ॥`,
      bhashya: `ஸ: பூர்வமந்த்ரோக்த ஆத்மா பர்யகா³த் ஸர்வதோ(அ)க³மத் ஸர்வவ்யாபீத்யர்த²:, ஶுக்ரம் ஶுத்³த⁴ம் அகாயம் ஶரீரவர்ஜிதம் ।`
    }
  },
  {
    number: 9,
    devanagari: {
      mula: `अन्धं तमः प्रविशन्ति येऽविद्यामुपासते ।
ततो भूय इव ते तमो य उ विद्यायां रताः ॥ ९ ॥`,
      bhashya: `अन्धं तमः अन्धकारमयं प्रविशन्ति ये अविद्यां कर्म ; अन्यच्च विद्यायाः कर्मणः, विद्याकर्मणोर्हि विभागो लोके ।`
    },
    kannada: {
      mula: `ಅಂಧಂ ತಮಃ ಪ್ರವಿಶಂತಿ ಯೇಽವಿದ್ಯಾಮುಪಾಸತೇ ।
ತತೋ ಭೂಯ ಇವ ತೇ ತಮೋ ಯ ಉ ವಿದ್ಯಾಯಾಂ ರತಾಃ ॥ ೯ ॥`,
      bhashya: `ಅಂಧಂ ತಮಃ ಅಂಧಕಾರಮಯಂ ಪ್ರವಿಶಂತಿ ಯೇ ಅವಿದ್ಯಾಂ ಕರ್ಮ ।`
    },
    telugu: {
      mula: `అంధం తమః ప్రవిశంతి యేఽవిద్యాముపాసతే ।
తతో భూయ ఇవ తే తమో య ఉ విద్యాయాం రతాః ॥ ౯ ॥`,
      bhashya: `అంధం తమః అంధకారమయం ప్రవిశంతి యే అవిద్యాం కర్మ ।`
    },
    tamil: {
      mula: `அந்த⁴ம் தம: ப்ரவிஶந்தி யே(அ)வித்³யாமுபாஸதே ।
ததோ பூ⁴ய இவ தே தமோ ய உ வித்³யாயாம் ரதா: ॥ 9 ॥`,
      bhashya: `அந்த⁴ம் தம: அந்த⁴காரமயம் ப்ரவிஶந்தி யே அவித்³யாம் கர்ம ।`
    }
  },
  {
    number: 10,
    devanagari: {
      mula: `अन्यदेवाहुर्विद्यया अन्यदाहुरविद्यया ।
इति शुश्रुम धीराणां ये नस्तद्विचचक्षिरे ॥ १० ॥`,
      bhashya: `अन्यदेव फलम् आहुः विद्यया क्रियत इति, अन्यत्फलम् आहुः अविद्यया क्रियत इति ।`
    },
    kannada: {
      mula: `ಅನ್ಯದೇವಾಹುರ್ವಿದ್ಯಯಾ ಅನ್ಯದಾಹುರವಿದ್ಯಯಾ ।
ಇತಿ ಶುಶ್ರುಮ ಧೀರಾಣಾಂ ಯೇ ನಸ್ತದ್ವಿಚಚಕ್ಷಿರೇ ॥ ೧೦ ॥`,
      bhashya: `ಅನ್ಯದೇವ ಫಲಮ್ ಆಹುಃ ವಿದ್ಯಯಾ ಕ್ರಿಯತ ಇತಿ, ಅನ್ಯತ್ಫಲಮ್ ಆಹುಃ ಅವಿದ್ಯಯಾ ಕ್ರಿಯತ ಇತಿ ।`
    },
    telugu: {
      mula: `అన్యదేవాహుర్విద్యయా అన్యదాహురవిద్యయా ।
ఇతి శుశ్రుమ ధీరాణాం యే నస్తద్విచచక్షిరే ॥ ౧౦ ॥`,
      bhashya: `అన్యదేవ ఫలమ్ ఆహుః విద్యయా క్రియత ఇతి, అన్యత్ఫలమ్ ఆహుః అవిద్యయా క్రియత ఇతి ।`
    },
    tamil: {
      mula: `அந்யதே³வாஹுர்வித்³யயா அந்யதா³ஹுரவித்³யயா ।
இதி ஶுஶ்ரும தீ⁴ராணாம் யே நஸ்தத்³விசசக்ஷிரே ॥ 10 ॥`,
      bhashya: `அந்யதே³வ ப²லம் ஆஹு: வித்³யயா க்ரியத இதி, அந்யத்ப²லம் ஆஹு: அவித்³யயா க்ரியத இதி ।`
    }
  },
  {
    number: 11,
    devanagari: {
      mula: `विद्यां चाविद्यां च यस्तद्वेदोभयं सह ।
अविद्यया मृत्युं तीर्त्वा विद्ययामृतमश्नुते ॥ ११ ॥`,
      bhashya: `विद्यां च अविद्यां च कर्म यः तद्वेद उभयं सह एकेनात्मना, असौ अविद्यया कर्मणा मृत्युं स्वाभाविकं कर्मबोधं तीर्त्वा अतीत्य, विद्यया देवताज्ञानेन अमृतम् देवतात्मभावमश्नुते प्राप्नोति ।`
    },
    kannada: {
      mula: `ವಿದ್ಯಾಂ ಚಾವಿದ್ಯಾಂ ಚ ಯಸ್ತದ್ವೇದೋಭಯಂ ಸಹ ।
ಅವಿದ್ಯಯಾ ಮೃತ್ಯುಂ ತೀರ್ತ್ವಾ ವಿದ್ಯಯಾಮೃತಮಶ್ನುತೇ ॥ ೧೧ ॥`,
      bhashya: `ವಿದ್ಯಾಂ ಚ ಅವಿದ್ಯಾಂ ಚ ಕರ್ಮ ಯಃ ತದ್ವೇದ ಉಭಯಂ ಸಹ ಏಕೇನಾತ್ಮನಾ ।`
    },
    telugu: {
      mula: `విద్యాం చావిద్యాం చ యస్తద్వేదోభయం సహ ।
అవిద్యయా మృత్యుం తీర్త్వా విద్యయామృతమశ్నుతే ॥ ౧౧ ॥`,
      bhashya: `విద్యాం చ అవిద్యాం చ కర్మ యః తద్వేద ఉభయం సహ ఏకేనాత్మనా ।`
    },
    tamil: {
      mula: `வித்³யாம் சாவித்³யாம் ச யஸ்தத்³வேதோ³ப⁴யம் ஸஹ ।
அவித்³யயா ம்ருத்யும் தீர்த்வா வித்³யயாம்ருதமஶ்நுதே ॥ 11 ॥`,
      bhashya: `வித்³யாம் ச அவித்³யாம் ச கர்ம ய: தத்³வேத³ உப⁴யம் ஸஹ ஏகேநாத்மநா ।`
    }
  },
  {
    number: 12,
    devanagari: {
      mula: `अन्धं तमः प्रविशन्ति येऽसम्भूतिमुपासते ।
ततो भूय इव ते तमो य उ सम्भूत्यां रताः ॥ १२ ॥`,
      bhashya: `अन्धं तमः प्रविशन्ति ये असम्भूतिं प्रकृतिं कारणमव्याकृताख्यम् उपासते, ततो भूय इव ते तमः ये उ सम्भूत्यां कार्यब्रह्मणि हिरण्यगर्भाख्ये रताः ।`
    },
    kannada: {
      mula: `ಅಂಧಂ ತಮಃ ಪ್ರವಿಶಂತಿ ಯೇಽಸಂಭೂತಿಮುಪಾಸತೇ ।
ತತೋ ಭೂಯ ಇವ ತೇ ತಮೋ ಯ ಉ ಸಂಭೂತ್ಯಾಂ ರತಾಃ ॥ ೧೨ ॥`,
      bhashya: `ಅಂಧಂ ತಮಃ ಪ್ರವಿಶಂತಿ ಯೇ ಅಸಂಭೂತಿಂ ಪ್ರಕೃತಿಂ ಕಾರಣಮವ್ಯಾಕೃತಾಖ್ಯಮ್ ಉಪಾಸತೇ ।`
    },
    telugu: {
      mula: `అంధం తమః ప్రవిశంతి యేఽసంభూతిముపాసతే ।
తతో భూయ ఇవ తే తమో య ఉ సంభూత్యాం రతాః ॥ ౧౨ ॥`,
      bhashya: `అంధం తమః ప్రవిశంతి యే అసంభూతిం ప్రకృతిం కారణమవ్యాకృతాఖ్యమ్ ఉపాసతే ।`
    },
    tamil: {
      mula: `அந்த⁴ம் தம: ப்ரவிஶந்தி யே(அ)ஸம்பூ⁴திமுபாஸதே ।
ததோ பூ⁴ய இவ தே தமோ ய உ ஸம்பூ⁴த்யாம் ரதா: ॥ 12 ॥`,
      bhashya: `அந்த⁴ம் தம: ப்ரவிஶந்தி யே அஸம்பூ⁴திம் ப்ரக்ருதிம் காரணமவ்யாக்ருதாக்²யம் உபாஸதே ।`
    }
  },
  {
    number: 13,
    devanagari: {
      mula: `अन्यदेवाहुः सम्भवादन्यदाहुरसम्भवात् ।
इति शुश्रुम धीराणां ये नस्तद्विचचक्षिरे ॥ १३ ॥`,
      bhashya: `अन्यदेव फलं आहुः विद्वांसः सम्भवात् हिरण्यगर्भोपासनात्, अन्यत्फलं आहुः असम्भवात् प्रकृत्युपासनात् ।`
    },
    kannada: {
      mula: `ಅನ್ಯದೇವಾಹುಃ ಸಂಭವಾದನ್ಯದಾಹುರಸಂಭವಾತ್ ।
ಇತಿ ಶುಶ್ರುಮ ಧೀರಾಣಾಂ ಯೇ ನಸ್ತದ್ವಿಚಚಕ್ಷಿರೇ ॥ ೧೩ ॥`,
      bhashya: `ಅನ್ಯದೇವ ಫಲಂ ಆಹುಃ ವಿದ್ವಾಂಸಃ ಸಂಭವಾತ್ ಹಿರಣ್ಯಗರ್ಭೋಪಾಸನಾತ್ ।`
    },
    telugu: {
      mula: `అన్యదేవాహుః సంభవాదన్యదాహురసంభవాత్ ।
ఇతి శుశ్రుమ ధీరాణాం యే నస్తద్విచచక్షిరే ॥ ౧౩ ॥`,
      bhashya: `అన్యదేవ ఫలం ఆహుః విద్వాంసః సంభవాత్ హిరణ్యగర్భోపాసనాత్ ।`
    },
    tamil: {
      mula: `அந்யதே³வாஹு: ஸம்ப⁴வாத³ந்யதா³ஹுரஸம்ப⁴வாத் ।
இதி ஶுஶ்ரும தீ⁴ராணாம் யே நஸ்தத்³விசசக்ஷிரே ॥ 13 ॥`,
      bhashya: `அந்யதே³வ ப²லம் ஆஹு: வித்³வாம்ஸ: ஸம்ப⁴வாத் ஹிரண்யக³ர்போ⁴பாஸநாத் ।`
    }
  },
  {
    number: 14,
    devanagari: {
      mula: `सम्भूतिं च विनाशं च यस्तद्वेदोभयं सह ।
विनाशेन मृत्युं तीर्त्वा सम्भूत्यामृतमश्नुते ॥ १४ ॥`,
      bhashya: `सम्भूतिं च कार्यब्रह्म विनाशं च कारणब्रह्म, प्रकृतौ हि सर्वं नश्यतीति विनाशः प्रकृतिः ।`
    },
    kannada: {
      mula: `ಸಂಭೂತಿಂ ಚ ವಿನಾಶಂ ಚ ಯಸ್ತದ್ವೇದೋಭಯಂ ಸಹ ।
ವಿನಾಶೇನ ಮೃತ್ಯುಂ ತೀರ್ತ್ವಾ ಸಂಭೂತ್ಯಾಮೃತಮಶ್ನುತೇ ॥ ೧೪ ॥`,
      bhashya: `ಸಂಭೂತಿಂ ಚ ಕಾರ್ಯಬ್ರಹ್ಮ ವಿನಾಶಂ ಚ ಕಾರಣಬ್ರಹ್ಮ ।`
    },
    telugu: {
      mula: `సంభూతిం చ వినాశం చ యస్తద్వేదోభయం సహ ।
వినాశేన మృత్యుం తీర్త్వా సంభూత్యామృతమశ్నుతే ॥ ౧౪ ॥`,
      bhashya: `సంభూతిం చ కార్యబ్రహ్మ వినాశం చ కారణబ్రహ్మ ।`
    },
    tamil: {
      mula: `ஸம்பூ⁴திம் ச விநாஶம் ச யஸ்தத்³வேதோ³ப⁴யம் ஸஹ ।
விநாஶேந ம்ருத்யும் தீர்த்வா ஸம்பூ⁴த்யாம்ருதமஶ்நுதே ॥ 14 ॥`,
      bhashya: `ஸம்பூ⁴திம் ச கார்யப்³ரஹ்ம விநாஶம் ச காரணப்³ரஹ்ம ।`
    }
  },
  {
    number: 15,
    devanagari: {
      mula: `हिरण्मयेन पात्रेण सत्यस्यापिहितं मुखम् ।
तत्त्वं पूषन्नपावृणु सत्यधर्माय दृष्टये ॥ १५ ॥`,
      bhashya: `हिरण्मयेन ज्योतिर्मयेन पात्रेण संवृतं सत्यस्य ब्रह्मणः मुखं द्वारम् अपिहितम् आच्छादितम् ।`
    },
    kannada: {
      mula: `ಹಿರಣ್ಮಯೇನ ಪಾತ್ರೇಣ ಸತ್ಯಸ್ಯಾಪಿಹಿತಂ ಮುಖಮ್ ।
ತತ್ತ್ವಂ ಪೂಷನ್ನಪಾವೃಣು ಸತ್ಯಧರ್ಮಾಯ ದೃಷ್ಟಯೇ ॥ ೧೫ ॥`,
      bhashya: `ಹಿರಣ್ಮಯೇನ ಜ್ಯೋತಿರ್ಮಯೇನ ಪಾತ್ರೇಣ ಸಂವೃತಂ ಸತ್ಯಸ್ಯ ಬ್ರಹ್ಮಣಃ ಮುಖಂ ದ್ವಾರಮ್ ಅಪಿಹಿತಮ್ ಆಚ್ಛಾದಿತಮ್ ।`
    },
    telugu: {
      mula: `హిరణ్మయేన పాత్రేణ సత్యస్యాపిహితం ముఖమ్ ।
తత్త్వం పూషన్నపావృణు సత్యధర్మాయ దృష్టయే ॥ ౧౫ ॥`,
      bhashya: `హిరణ్మయేన జ్యోతిర్మయేన పాత్రేణ సంవృతం సత్యస్య బ్రహ్మణః ముఖం ద్వారమ్ అపిహితమ్ ఆచ్ఛాదితమ్ ।`
    },
    tamil: {
      mula: `ஹிரண்மயேந பாத்ரேண ஸத்யஸ்யாபிஹிதம் முக²ம் ।
தத்த்வம் பூஷந்நபாவ்ருணு ஸத்யத⁴ர்மாய த்³ருஷ்டயே ॥ 15 ॥`,
      bhashya: `ஹிரண்மயேந ஜ்யோதிர்மயேந பாத்ரேண ஸம்வ்ருதம் ஸத்யஸ்ய ப்³ரஹ்மண: முக²ம் த்³வாரம் அபிஹிதம் ஆச்சா²தி³தம் ।`
    }
  },
  {
    number: 16,
    devanagari: {
      mula: `पूषन्नेकर्षे यम सूर्य प्राजापत्य व्यूह रश्मीन्समूह तेजः ।
यत्ते रूपं कल्याणतमं तत्ते पश्यामि योऽसावसौ पुरुषः सोऽहमस्मि ॥ १६ ॥`,
      bhashya: `हे पूषन् पोषयितः, हे एकर्षे एकचरः एकाकी ऋषति गच्छति तद्वत्त्वात्, हे यम प्राणान्संयच्छति नियच्छतीति यमः ।`
    },
    kannada: {
      mula: `ಪೂಷನ್ನೇಕರ್ಷೇ ಯಮ ಸೂರ್ಯ ಪ್ರಾಜಾಪತ್ಯ ವ್ಯೂಹ ರಶ್ಮೀನ್ಸಮೂಹ ತೇಜಃ ।
ಯತ್ತೇ ರೂಪಂ ಕಲ್ಯಾಣತಮಂ ತತ್ತೇ ಪಶ್ಯಾಮಿ ಯೋಽಸಾವಸೌ ಪುರುಷಃ ಸೋಽಹಮಸ್ಮಿ ॥ ೧೬ ॥`,
      bhashya: `ಹೇ ಪೂಷನ್ ಪೋಷಯಿತಃ, ಹೇ ಏಕರ್ಷೇ ಏಕಚರಃ ಏಕಾಕೀ ಋಷತಿ ಗಚ್ಛತಿ ತದ್ವತ್ತ್ವಾತ್ ।`
    },
    telugu: {
      mula: `పూషన్నేకర్షే యమ సూర్య ప్రాజాపత్య వ్యూహ రశ్మీన్సమూహ తేజః ।
యత్తే రూపం కల్యాణతమం తత్తే పశ్యామి యోఽసావసౌ పురుషః సోఽహమస్మి ॥ ౧౬ ॥`,
      bhashya: `హే పూషన్ పోషయితః, హే ఏకర్షే ఏకచరః ఏకాకీ ఋషతి గచ్ఛతి తద్వత్త్వాత్ ।`
    },
    tamil: {
      mula: `பூஷந்நேகர்ஷே யம ஸூர்ய ப்ராஜாபத்ய வ்யூஹ ரஶ்மீந்ஸமூஹ தேஜ: ।
யத்தே ரூபம் கல்யாணதமம் தத்தே பஶ்யாமி யோ(அ)ஸாவஸௌ புருஷ: ஸோ(அ)ஹமஸ்மி ॥ 16 ॥`,
      bhashya: `ஹே பூஷந் போஷயித:, ஹே ஏகர்ஷே ஏகசர: ஏகாகீ ருஷதி க³ச்ச²தி தத்³வத்த்வாத் ।`
    }
  },
  {
    number: 17,
    devanagari: {
      mula: `वायुरनिलममृतमथेदं भस्मान्तं शरीरम् ।
ॐ क्रतो स्मर कृतं स्मर क्रतो स्मर कृतं स्मर ॥ १७ ॥`,
      bhashya: `वायुः प्राणः अनिलं सूत्रात्मनि समष्टिप्राणे लीयताम्, अथ इदं शरीरं भस्मान्तं भस्मावशेषं भवतु ।`
    },
    kannada: {
      mula: `ವಾಯುರನಿಲಮಮೃತಮಥೇದಂ ಭಸ್ಮಾಂತಂ ಶರೀರಮ್ ।
ಓಂ ಕ್ರತೋ ಸ್ಮರ ಕೃತಂ ಸ್ಮರ ಕ್ರತೋ ಸ್ಮರ ಕೃತಂ ಸ್ಮರ ॥ ೧೭ ॥`,
      bhashya: `ವಾಯುಃ ಪ್ರಾಣಃ ಅನಿಲಂ ಸೂತ್ರಾತ್ಮನಿ ಸಮಷ್ಟಿಪ್ರಾಣೇ ಲೀಯತಾಮ್ ।`
    },
    telugu: {
      mula: `వాయురనిలమమృతమథేదం భస్మాంతం శరీరమ్ ।
ఓం క్రతో స్మర కృతం స్మర క్రతో స్మర కృతం స్మర ॥ ౧౭ ॥`,
      bhashya: `వాయుః ప్రాణః అనిలం సూత్రాత్మని సమష్టిప్రాణే లీయతామ్ ।`
    },
    tamil: {
      mula: `வாயுரநிலமம்ருதமதே²த³ம் ப⁴ஸ்மாந்தம் ஶரீரம் ।
ஓம் க்ரதோ ஸ்மர க்ருதம் ஸ்மர க்ரதோ ஸ்மர க்ருதம் ஸ்மர ॥ 17 ॥`,
      bhashya: `வாயு: ப்ராண: அநிலம் ஸூத்ராத்மநி ஸமஷ்டிப்ராணே லீயதாம் ।`
    }
  },
  {
    number: 18,
    devanagari: {
      mula: `अग्ने नय सुपथा राये अस्मान्विश्वानि देव वयुनानि विद्वान् ।
युयोध्यस्मज्जुहुराणमेनो भूयिष्ठां ते नमउक्तिं विधेम ॥ १८ ॥`,
      bhashya: `हे अग्ने, नय गमय सुपथा शोभनेन मार्गेण राये धनाय अस्मान्विश्वानि सर्वाणि कर्मफलानि हे देव वयुनानि जानन् विद्वान् । युयोधि विनाशय अस्मत् अस्मत्तः जुहुराणं वक्रं कुटिलं गमनशीलं एनः पापम् ।`
    },
    kannada: {
      mula: `ಅಗ್ನೇ ನಯ ಸುಪಥಾ ರಾಯೇ ಅಸ್ಮಾನ್ವಿಶ್ವಾನಿ ದೇವ ವಯುನಾನಿ ವಿದ್ವಾನ್ ।
ಯುಯೋಧ್ಯಸ್ಮಜ್ಜುಹುರಾಣಮೇನೋ ಭೂಯಿಷ್ಠಾಂ ತೇ ನಮಉಕ್ತಿಂ ವಿಧೇಮ ॥ ೧೮ ॥`,
      bhashya: `ಹೇ ಅಗ್ನೇ, ನಯ ಗಮಯ ಸುಪಥಾ ಶೋಭನೇನ ಮಾರ್ಗೇಣ ರಾಯೇ ಧನಾಯ ಅಸ್ಮಾನ್ವಿಶ್ವಾನಿ ಸರ್ವಾಣಿ ಕರ್ಮಫಲಾನಿ ।`
    },
    telugu: {
      mula: `అగ్నే నయ సుపథా రాయే అస్మాన్విశ్వాని దేవ వయునాని విద్వాన్ ।
యుయోధ్యస్మజ్జుహురాణమేనో భూయిష్ఠాం తే నమఉక్తిం విధేమ ॥ ౧౮ ॥`,
      bhashya: `హే అగ్నే, నయ గమయ సుపథా శోభనేన మార్గేణ రాయే ధనాయ అస్మాన్విశ్వాని సర్వాణి కర్మఫలాని ।`
    },
    tamil: {
      mula: `அக்³நே நய ஸுபதா² ராயே அஸ்மாந்விஶ்வாநி தே³வ வயுநாநி வித்³வாந் ।
யுயோத்⁴யஸ்மஜ்ஜுஹுராணமேநோ பூ⁴யிஷ்டா²ம் தே நமஉக்திம் விதே⁴ம ॥ 18 ॥`,
      bhashya: `ஹே அக்³நே, நய க³மய ஸுபதா² ஶோப⁴நேந மார்கே³ண ராயே த⁴நாய அஸ்மாந்விஶ்வாநி ஸர்வாணி கர்மப²லாநி ।`
    }
  }
];

export async function seedDatabase() {
  console.log("Checking if database needs seeding...");

  const existingBooks = await db.select().from(books);
  if (existingBooks.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with Isha Upanishad Bhashya from advaitasharada.sringeri.net...");

  const book = await storage.createBook({
    slug: "isha-upanishad-bhashya",
    title: "Īśāvāsyopaniṣad",
    author: "Sri Shankaracharya",
    description: `The Īśāvāsyopaniṣad (ईशावास्योपनिषद्) is one of the shortest and most celebrated Upanishads. This text presents Shankaracharya's Bhashya (commentary) on the 18 mantras, providing deep philosophical insights into Advaita Vedanta.`,
    category: "Upanishad",
    coverImage: null,
    totalVerses: MANTRAS.length + 1, // +1 for introduction
  });

  console.log("Created book:", book.title);

  // Descriptive verse titles based on Shankaracharya's commentary themes
  const verseTitles: Record<number, string> = {
    1: "Devotion to Jñāna (Knowledge)",
    2: "Devotion to Karma (Action)",
    3: "The Fate of the Self-Slayers",
    4: "Nature of the Self - Unmoving Yet Swift",
    5: "The Self - Far and Near",
    6: "Vision of Unity in All Beings",
    7: "Freedom from Delusion and Sorrow",
    8: "Nature of the Supreme Self",
    9: "Avidyā and Vidyā - A Warning",
    10: "The Fruits of Knowledge and Ignorance",
    11: "Combining Vidyā and Avidyā",
    12: "Worship of the Unmanifest",
    13: "Sambhūti and Asambhūti",
    14: "Combining Sambhūti and Vināśa",
    15: "Prayer to the Sun - The Golden Disc",
    16: "Prayer to the Sun - O Pūṣan",
    17: "The Final Prayer - Om Krato",
    18: "Prayer to Agni - Lead Us"
  };

  // Create Introduction (verse 0) - Introductory Remarks by Śaṅkara
  const introVerse = await storage.createVerse({
    bookId: book.id,
    verseNumber: 0,
    sectionTitle: "Introductory Remarks by Śaṅkara",
  });

  await storage.createTranslation({
    verseId: introVerse.id,
    languageCode: "devanagari",
    content: "ईशावास्यमित्यादयो मन्त्रा आत्मनो याथात्म्यप्रतिपादकाः कर्मस्वनुप्रवेशायोगात् कर्मणि विनियोगं न प्राप्नुवन्ति ।",
  });

  await storage.createTranslation({
    verseId: introVerse.id,
    languageCode: "english",
    content: "The verses beginning with Īśāvāsyam explain the true nature of the Self which is not subsidiary to karma.",
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Adi Shankaracharya",
    authorTitle: "English Translation by M. Hiriyanna",
    languageCode: "english",
    content: `The verses beginning with Īśāvāsyam are not utilised in ritual[1], since they explain the true nature of the Self which is not subsidiary to karma. The true nature of the Self, as will presently be indicated, is purity, taintlessness, oneness, permanence, bodilessness, omnipresence and so forth, which being inconsistent with karma, it is only right that these (verses) are not used in ritual.

The Self whose essence is thus described, moreover, cannot be produced, modified, acquired or purified; nor is it of the character of an agent or an enjoyer; in which case it would be subsidiary to karma. (And its existence cannot be called in question) inasmuch as all the Upanishads purport only to unfold its nature. The Bhagavadgīta and the Mokṣadharma (in the Mahābhārata) have also the same aim.

(It has therefore to be presumed that) karma is prescribed taking (for granted) that, as recognised by the intelligence of the average man, plurality, agency, enjoyment and so forth, as also impurity and sinfulness, are of the Self. Those that know who are eligible (for ritual) state that karma is prescribed only for him who is desirous of its fruit—whether that fruit be visible (i.e. attainable in this life) as spiritual lustre or invisible (i.e. attainable only in another life) as Svarga—and thinks "I am a twice-born, free from blindness, dwarfishness and the like marks of disqualification"[2].

Therefore the following verses, removing this original nescience concerning the Self, from an explanation of its real nature, produce a knowledge of unity which is the means of eradicating sorrow, delusion and other similar features of mundane existence. We shall briefly comment on these verses, having thus indicated the persons entitled to study them, the subject-matter, aim and their inter-relation[3].

—————————————
Footnotes:

[1] The doubt whether these verses are to be used in ritual arises because this Upanishad forms part of a Saṃhitā and the verses in the Saṃhitā portion of the Veda are generally so employed. If these verses are at all to be utilised in ritual there should be an express statement to that effect in the Veda or there should at least be an indirect guidance afforded by their contents. We find no such express statement, and the subject matter, so far from being connected with karma, is directly antagonistic to it.

[2] Desire, which is either for attaining happiness or for avoiding misery necessarily implies nescience. For the Self being in reality bliss itself, untouched by sorrow, cannot by its nature, be affected by any desire. Similarly, believing that the Self is fit for performing karma because its bodily adjuncts with which it is empirically connected are fit for it is also an indication of nescience.

[3] In the beginning of a commentary it is customary to point out specifically the qualifications of persons entitled to study the treatise, its subject-matter, the aim of its teaching and their inter-relation, especially that between the last two. Deficiency in respect of any of these which are termed the Anubandhachatuṣṭayam is understood to indicate the unworthiness of the treatise to be commented upon.`,
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Adi Shankaracharya",
    authorTitle: "आदि शङ्कराचार्य - भाष्यम् (Devanagari)",
    languageCode: "devanagari",
    content: `ईशावास्यमित्यादयो मन्त्रा आत्मनो याथात्म्यप्रतिपादकाः कर्मस्वनुप्रवेशायोगात् कर्मणि विनियोगं न प्राप्नुवन्ति । आत्मनो याथात्म्यं च यथोच्यमानम् — शुद्धत्वं निरञ्जनत्वमेकत्वं नित्यत्वमशरीरत्वं सर्वगतत्वमित्यादिलक्षणम् — तद्विरुद्धाः कर्मणो न युक्तमेव कर्मणि विनियोगं प्राप्नुयुः ।

एवंलक्षणस्य चात्मनो नोत्पाद्यत्वं न विकार्यत्वं नाप्यत्वं न संस्कार्यत्वमित्यतः कर्तृत्वभोक्तृत्वाद्यभावात् कर्मकाण्डाऽपेक्षित्वं नास्त्येव । सर्वासां हि उपनिषदामेतस्यैवार्थस्य प्रतिपादनपरत्वात् । तथा च गीताऽपि मोक्षधर्मश्च ।

अतः प्राकृतबुद्ध्यभिमतानेकत्वकर्तृत्वभोक्तृत्वादयः, तथाऽशुद्धत्वपापित्वादयोऽप्यात्मनोऽभ्युपगम्य कर्म विधीयते । एवमधिकारित्वज्ञा वदन्ति — यः कामी फलार्थी दृष्टादृष्टफलेषु ब्रह्मवर्चसादिस्वर्गादिषु यो द्विजात्यभिमानी अकाणः अकुब्जादिः इत्येवं मन्यते यः स एवाधिकारीति ।

अतः स्वाभाविकमात्मनोऽज्ञानं निवर्तयन्त आत्मयाथात्म्यप्रतिपादनादिमे मन्त्रा ऐक्यविज्ञानप्रत्ययं शोकमोहाद्यात्मसंसारधर्मोच्छेदकारणं जनयन्ति । तान् मन्त्रान् अधिकारिविषयसम्बन्धप्रयोजनानि दर्शयित्वा सङ्क्षेपतो व्याख्यास्यामः ॥`,
  });

  await storage.createTranslation({
    verseId: introVerse.id,
    languageCode: "kannada",
    content: "ಈಶಾ ವಾಸ್ಯಮ್ ಇತ್ಯಾದಯೋ ಮಂತ್ರಾಃ ಆತ್ಮನೋ ಯಾಥಾತ್ಮ್ಯಪ್ರತಿಪಾದಕಾಃ ಕರ್ಮಸ್ವನುಪ್ರವೇಶಾಯೋಗಾತ್ ಕರ್ಮಣಿ ವಿನಿಯೋಗಂ ನ ಪ್ರಾಪ್ನುವಂತಿ ।",
  });

  await storage.createTranslation({
    verseId: introVerse.id,
    languageCode: "tamil",
    content: "ஈஶா வாஸ்யம் இத்யாதயோ மந்த்ரா ஆத்மநோ யாதாத்ம்யப்ரதிபாதகா கர்மஸ்வனுப்ரவேஶாயோகாத் கர்மணி விநியோகம் ந ப்ராப்நுவந்தி ।",
  });

  await storage.createTranslation({
    verseId: introVerse.id,
    languageCode: "telugu",
    content: "ఈశా వాస్యమ్ ఇత్యాదయో మన్త్రాః ఆత్మనో యాథాత్మ్యప్రతిపాదకాః కర్మస్వనుప్రవేశాయోగాత్ కర్మణి వినియోగం న ప్రాప్నువన్తి ।",
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Adi Shankaracharya",
    authorTitle: "ಆದಿ ಶಂಕರಾಚಾರ್ಯ - ಭಾಷ್ಯಮ್ (Kannada)",
    languageCode: "kannada",
    content: `'ಈಶಾ ವಾಸ್ಯಮ್' ಇತ್ಯಾದಯೋ ಮಂತ್ರಾಃ ಕರ್ಮಸ್ವವಿನಿಯುಕ್ತಾಃ, ತೇಷಾಮಕರ್ಮಶೇಷಸ್ಯಾತ್ಮನೋ ಯಾಥಾತ್ಮ್ಯಪ್ರಕಾಶಕತ್ವಾತ್ । ಯಾಥಾತ್ಮ್ಯಂ ಚಾತ್ಮನಃ ಶುದ್ಧತ್ವಾಪಾಪವಿದ್ಧತ್ವೈಕತ್ವನಿತ್ಯತ್ವಾಶರೀರತ್ವಸರ್ವಗತತ್ವಾದಿ ವಕ್ಷ್ಯಮಾಣಮ್ । ತಚ್ಚ ಕರ್ಮಣಾ ವಿರುಧ್ಯತ ಇತಿ ಯುಕ್ತ ಏವೈಷಾಂ ಕರ್ಮಸ್ವವಿನಿಯೋಗಃ ।

ತಸ್ಮಾದೇತೇ ಮಂತ್ರಾ ಆತ್ಮನೋ ಯಾಥಾತ್ಮ್ಯಪ್ರಕಾಶನೇನ ಆತ್ಮವಿಷಯಂ ಸ್ವಾಭಾವಿಕಕರ್ಮವಿಜ್ಞಾನಂ ನಿವರ್ತಯಂತಃ ಶೋಕಮೋಹಾದಿಸಂಸಾರಧರ್ಮವಿಚ್ಛಿತ್ತಿಸಾಧನಮಾತ್ಮೈಕತ್ವಾದಿವಿಜ್ಞಾನಮುತ್ಪಾದಯಂತೀತಿ ।`,
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Adi Shankaracharya",
    authorTitle: "ஆதி ஶங்கராசார்ய - பாஷ்யம் (Tamil)",
    languageCode: "tamil",
    content: `'ஈஶா வாஸ்யம்' இத்யாதயோ மந்த்ரா: கர்மஸ்வவிநியுக்தா:, தேஷாமகர்மஶேஷஸ்யாத்மநோ யாதாத்ம்யப்ரகாஶகத்வாத் ।

தஸ்மாதேதே மந்த்ரா ஆத்மநோ யாதாத்ம்யப்ரகாஶநேந ஆத்மவிஷயம் ஸ்வாபாவிககர்மவிஜ்ஞாநம் நிவர்தயந்த: ஶோகமோஹாதிஸம்ஸாரதர்மவிச்சித்திஸாதநமாத்மைகத்வாதிவிஜ்ஞாநமுத்பாதயந்தீதி ।`,
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Adi Shankaracharya",
    authorTitle: "ఆది శంకరాచార్య - భాష్యమ్ (Telugu)",
    languageCode: "telugu",
    content: `'ఈశా వాస్యమ్' ఇత్యాదయో మన్త్రాః కర్మస్వవినియుక్తాః, తేషామకర్మశేషస్యాత్మనో యాథాత్మ్యప్రకాశకత్వాత్ ।

తస్మాదేతే మన్త్రా ఆత్మనో యాథాత్మ్యప్రకాశనేన ఆత్మవిషయం స్వాభావికకర్మవిజ్ఞానం నివర్తయన్తః శోకమోహాదిసంసారధర్మవిచ్ఛిత్తిసాధనమాత్మైకత్వాదివిజ్ఞానముత్పాదయన్తీతి ।`,
  });

  await storage.createExplanation({
    verseId: introVerse.id,
    authorName: "Anandagiri",
    authorTitle: "आनन्दगिरि - टीका (Sub-commentary on Bhashya)",
    languageCode: "devanagari",
    content: `'ईशा वास्यम्' इत्यादयो मन्त्राः कर्मस्वविनियुक्ताः, तेषामकर्मशेषस्यात्मनो याथात्म्यप्रकाशकत्वात् । याथात्म्यं चात्मनः शुद्धत्वापापविद्धत्वैकत्वनित्यत्वाशरीरत्वसर्वगतत्वादि वक्ष्यमाणम् ।

येनाऽऽत्मना परेणेशा व्याप्तं विश्वमशेषतः ।
सोऽहं देहद्वयीसाक्षी वर्जितो देहतद्गणेः ॥

ईशा वास्यमित्यादिमन्त्रान्व्याचिख्यासुर्भगवन्भाष्यकारस्तेषां कर्मशेषत्वशङ्कां तावद्व्युदस्यति ।`,
  });

  console.log("Created introduction verse with all translations and Tika");

  for (const mantra of MANTRAS) {
    const verse = await storage.createVerse({
      bookId: book.id,
      verseNumber: mantra.number,
      sectionTitle: verseTitles[mantra.number] || `Mantra ${mantra.number}`,
    });

    await storage.createTranslation({
      verseId: verse.id,
      languageCode: "devanagari",
      content: mantra.devanagari.mula,
    });

    await storage.createTranslation({
      verseId: verse.id,
      languageCode: "kannada",
      content: mantra.kannada.mula,
    });

    await storage.createTranslation({
      verseId: verse.id,
      languageCode: "telugu",
      content: mantra.telugu.mula,
    });

    await storage.createTranslation({
      verseId: verse.id,
      languageCode: "tamil",
      content: mantra.tamil.mula,
    });

    await storage.createExplanation({
      verseId: verse.id,
      authorName: "Adi Shankaracharya",
      authorTitle: "आदि शङ्कराचार्य - भाष्यम् (Devanagari)",
      languageCode: "devanagari",
      content: mantra.devanagari.bhashya,
    });

    await storage.createExplanation({
      verseId: verse.id,
      authorName: "Adi Shankaracharya",
      authorTitle: "ಆದಿ ಶಂಕರಾಚಾರ್ಯ - ಭಾಷ್ಯಂ (Kannada)",
      languageCode: "kannada",
      content: mantra.kannada.bhashya,
    });

    await storage.createExplanation({
      verseId: verse.id,
      authorName: "Adi Shankaracharya",
      authorTitle: "ఆది శంకరాచార్య - భాష్యమ్ (Telugu)",
      languageCode: "telugu",
      content: mantra.telugu.bhashya,
    });

    await storage.createExplanation({
      verseId: verse.id,
      authorName: "Adi Shankaracharya",
      authorTitle: "ஆதி ஶங்கராசார்ய - பாஷ்யம் (Tamil)",
      languageCode: "tamil",
      content: mantra.tamil.bhashya,
    });
  }

  console.log("Created all 18 mantras with translations in 4 scripts and Bhashya explanations");
  
  // Now seed additional commentaries
  await seedAdditionalCommentaries();
  
  console.log("Database seeding complete!");
}

/**
 * Seed additional commentaries for existing database
 * This function adds the missing authors: M. Hiriyanna, Anandagiri, Sri Sudarsana, and Shankaracharya English
 * It checks per-verse/author/language to ensure idempotent seeding
 */
export async function seedAdditionalCommentaries() {
  console.log("Checking for additional commentaries to seed...");
  
  // Get the Isha Upanishad book
  const existingBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (existingBooks.length === 0) {
    console.log("Isha Upanishad book not found, skipping additional commentaries");
    return;
  }
  
  const book = existingBooks[0];
  const bookVerses = await db.select().from(verses).where(eq(verses.bookId, book.id));
  
  if (bookVerses.length === 0) {
    console.log("No verses found, skipping additional commentaries");
    return;
  }
  
  // Add English language if not exists
  const englishLang = await db.select().from(languages).where(eq(languages.code, "english")).limit(1);
  if (englishLang.length === 0) {
    await storage.createLanguage({
      code: "english",
      name: "English",
      nativeName: "English",
      script: "Latin"
    });
    console.log("Added English language");
  }
  
  // Get all existing explanations for this book to check what's missing
  const existingExplanations = await db
    .select({
      verseId: explanations.verseId,
      authorName: explanations.authorName,
      languageCode: explanations.languageCode,
    })
    .from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(eq(verses.bookId, book.id));
  
  // Create a set for fast lookup of existing explanations
  const existingSet = new Set(
    existingExplanations.map(e => `${e.verseId}|${e.authorName}|${e.languageCode}`)
  );
  
  let addedCount = 0;
  const missingVerses: number[] = [];
  
  for (const verse of bookVerses) {
    const additionalData = ADDITIONAL_COMMENTARIES[verse.verseNumber];
    if (!additionalData) {
      missingVerses.push(verse.verseNumber);
      continue;
    }
    
    // M. Hiriyanna - English Translation
    if (additionalData.hiriyanna) {
      const key = `${verse.id}|M. Hiriyanna|english`;
      if (!existingSet.has(key)) {
        await storage.createExplanation({
          verseId: verse.id,
          authorName: "M. Hiriyanna",
          authorTitle: "English Translation",
          languageCode: "english",
          content: additionalData.hiriyanna,
        });
        addedCount++;
      }
    }
    
    // Anandagiri - Devanagari Tika
    if (additionalData.anandagiri) {
      const key = `${verse.id}|Anandagiri|devanagari`;
      if (!existingSet.has(key)) {
        await storage.createExplanation({
          verseId: verse.id,
          authorName: "Anandagiri",
          authorTitle: "आनन्दगिरिटीका (Tika)",
          languageCode: "devanagari",
          content: additionalData.anandagiri,
        });
        addedCount++;
      }
    }
    
    // Sri Sudarsana - Tamil Translation
    if (additionalData.sudarsana) {
      const key = `${verse.id}|Sri Sudarsana Ramasubramanya Raja|tamil`;
      if (!existingSet.has(key)) {
        await storage.createExplanation({
          verseId: verse.id,
          authorName: "Sri Sudarsana Ramasubramanya Raja",
          authorTitle: "தமிழ் அனுவாதம் (Tamil Translation)",
          languageCode: "tamil",
          content: additionalData.sudarsana,
        });
        addedCount++;
      }
    }
    
    // Adi Shankaracharya - English Translation
    if (additionalData.shankaraEnglish) {
      const key = `${verse.id}|Adi Shankaracharya|english`;
      if (!existingSet.has(key)) {
        await storage.createExplanation({
          verseId: verse.id,
          authorName: "Adi Shankaracharya",
          authorTitle: "English Translation by M. Hiriyanna",
          languageCode: "english",
          content: additionalData.shankaraEnglish,
        });
        addedCount++;
      }
    }
  }
  
  if (missingVerses.length > 0) {
    console.log(`Warning: Missing commentary data for verses: ${missingVerses.join(", ")}`);
  }
  
  if (addedCount > 0) {
    console.log(`Added ${addedCount} new commentary entries`);
  } else {
    console.log("All additional commentaries already exist");
  }
}

/**
 * Update incomplete Shankaracharya explanations with complete content
 * This function updates entries where the content length is shorter than expected
 */
export async function updateIncompleteShankaraExplanations() {
  console.log("Checking for incomplete Shankaracharya explanations...");
  
  // Import complete bhashya data
  const { COMPLETE_SHANKARA_BHASHYA } = await import("./complete-bhashya-data");
  
  // Get the Isha Upanishad book
  const existingBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (existingBooks.length === 0) {
    console.log("Isha Upanishad book not found, skipping update");
    return;
  }
  
  const book = existingBooks[0];
  const bookVerses = await db.select().from(verses).where(eq(verses.bookId, book.id));
  
  if (bookVerses.length === 0) {
    console.log("No verses found, skipping update");
    return;
  }
  
  // Get all Shankaracharya explanations
  const shankaraExplanations = await db
    .select({
      id: explanations.id,
      verseId: explanations.verseId,
      languageCode: explanations.languageCode,
      content: explanations.content,
    })
    .from(explanations)
    .innerJoin(verses, eq(explanations.verseId, verses.id))
    .where(and(
      eq(verses.bookId, book.id),
      eq(explanations.authorName, "Adi Shankaracharya")
    ));
  
  // Create a map of verse ID to verse number
  const verseIdToNumber = new Map(bookVerses.map(v => [v.id, v.verseNumber]));
  
  let updatedCount = 0;
  
  for (const explanation of shankaraExplanations) {
    const verseNumber = verseIdToNumber.get(explanation.verseId);
    if (!verseNumber) continue;
    
    const completeData = COMPLETE_SHANKARA_BHASHYA[verseNumber];
    if (!completeData) continue;
    
    const completeContent = completeData[explanation.languageCode];
    if (!completeContent) continue;
    
    // Update if the current content is shorter than the complete content
    if (explanation.content.length < completeContent.length) {
      await db
        .update(explanations)
        .set({ content: completeContent })
        .where(eq(explanations.id, explanation.id));
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Updated ${updatedCount} incomplete Shankaracharya explanations`);
  } else {
    console.log("All Shankaracharya explanations are complete");
  }
}

/**
 * English verse translations data
 */
const englishVerseTranslations: { [verseNumber: number]: string } = {
  1: `īśā vāsyam idaṃ sarvaṃ yat kiñca jagatyāṃ jagat |
tena tyaktena bhuñjīthā mā gṛdhaḥ kasya sviddhanam || 1 ||

In the Lord is to be veiled all this—whatsoever moves on earth. Through such renunciation do thou save (thyself); be not greedy, for whose is wealth?`,
  2: `kurvann eveha karmāṇi jijīviṣecchataṃ samāḥ |
evaṃ tvayi nānyatheto'sti na karma lipyate nare || 2 ||

Always performing karma here, one should desire to live, for a hundred years. So long as thou (seekest to live) a mere man, no other (path) exists (where) activity does not taint thee.`,
  3: `asuryā nāma te lokā andhena tamasāvṛtāḥ |
tāṃste pretyābhigacchanti ye ke cātmahano janāḥ || 3 ||

Malignant are those worlds and enveloped in blinding darkness, into which pass, after death, whatsoever people slay the Self.`,
  4: `anejad ekaṃ manaso javīyo nainaddevā āpnuvanpūrvamarṣat |
taddhāvato'nyānatyeti tiṣṭhat tasminn apo mātariśvā dadhāti || 4 ||

Unmoving, one, and speedier than the mind; the senses reach it never; for it goes before. Standing, it outstrips others that run. In virtue of it, does mātariśvā allot functions severally to all.`,
  5: `tad ejati tan naijati tad dūre tad v antike |
tad antar asya sarvasya tad u sarvasyāsya bāhyataḥ || 5 ||

It moves: and it moves not; it is far and it is near. It is inside all this; it is also outside all this.`,
  6: `yas tu sarvāṇi bhūtāny ātmany evānupaśyati |
sarvabhūteṣu cātmānaṃ tato na vijugupsate || 6 ||

And he who sees all beings in himself and himself in all beings has no aversion thence.`,
  7: `yasmin sarvāṇi bhūtāny ātmaivābhūd vijānataḥ |
tatra ko mohaḥ kaḥ śoka ekatvam anupaśyataḥ || 7 ||

When to a knower discovering unity, all beings become his very Self, what delusion then (to him) and what sorrow?`,
  8: `sa paryagāc chukram akāyam avraṇam asnāviraṃ śuddham apāpaviddham |
kavir manīṣī paribhūḥ svayambhūr yāthātathyato'rthān vyadadhāc chāśvatībhyaḥ samābhyaḥ || 8 ||

He (the Self) pervaded all, resplendent, bodiless, scatheless, having no muscles, pure, untouched by evil; far-seeing, omniscient, transcendent, self-sprung, (He) duly allotted to the various eternal creators their respective functions.`,
  9: `andhaṃ tamaḥ praviśanti ye'vidyām upāsate |
tato bhūya iva te tamo ya uvidyāyāṃ ratāḥ || 9 ||

Into blinding darkness pass they who adhere to karma and into still greater darkness, as it were, they who delight in meditation.`,
  10: `anyad evāhur vidyayān yad āhur avidyayā |
iti śuśruma dhīrāṇāṃ ye nas tad vicacakṣire || 10 ||

Distinct, they say, is (the fruit borne) by meditation and distinct again, they say, is (that borne) by karma. Thus have we heard from sages who taught us that.`,
  11: `vidyāṃ cāvidyāṃ ca yas tad vedobhayaṃ saha |
avidyayā mṛtyuṃ tīrtvā vidyayāmṛtam aśnute || 11 ||

Whoever understands meditation and karma as going together, (he) overcoming death through karma, attains immortality through meditation.`,
  12: `andhaṃ tamaḥ praviśanti ye'sambhūtim upāsate |
tato bhūya iva te tamo ya u sambhūtyāṃ ratāḥ || 12 ||

Into blinding darkness pass they who are devoted to the unmanifest, and into still greater darkness, as it were, they who delight in the manifest.`,
  13: `anyad evāhuḥ saṃbhavād anyad āhur asaṃbhavāt |
iti śuśruma dhīrāṇāṃ ye nas tad vicacakṣire || 13 ||

Distinct, they say, is (what results) from the manifest and distinct again, they say, is (what results) from the unmanifest. Thus have we heard from the sages who taught us that.`,
  14: `saṃbhūtiṃ ca vināśaṃ ca yas tad vedobhayaṃ saha |
vināśena mṛtyuṃ tīrtvā saṃbhūtyāmṛtam aśnute || 14 ||

Whoever knows the manifest and the unmanifest together, (he) overcoming death through the unmanifest, attains immortality through the manifest.`,
  15: `hiraṇmayena pātreṇa satyasyāpihitaṃ mukham |
tat tvaṃ pūṣann apāvṛṇu satyadharmāya dṛṣṭaye || 15 ||

The face of Truth is covered with a golden disc. Remove it, O Pūṣan, that I, a worshipper of Truth, may behold it.`,
  16: `pūṣann ekarṣe yama sūrya prājāpatya vyūha raśmīn samūha tejaḥ |
yat te rūpaṃ kalyāṇatamaṃ tat te paśyāmi yo'sāvasau puruṣaḥ so'ham asmi || 16 ||

O Pūṣan, the one Seer, Controller, O Sun, offspring of Prajāpati, spread forth thy rays and gather up thy radiant light that I may behold thee of loveliest form. Whosoever is that Person, that also am I.`,
  17: `vāyur anilam amṛtam athedaṃ bhasmāntaṃ śarīram |
oṃ krato smara kṛtaṃ smara krato smara kṛtaṃ smara || 17 ||

Let (my) vital breath now attain the immortal Air; then let this body end in ashes. OM! O mind, remember—remember that which has been done. O mind, remember—remember that which has been done.`,
  18: `agne naya supathā rāye asmān viśvāni deva vayunāni vidvān |
yuyodhy asmaj juhurāṇam eno bhūyiṣṭhāṃ te nama uktiṃ vidhema || 18 ||

O Fire, lead us to prosperity by a good path, O God, knowing all our deeds. Remove from us crooked-going sin. We shall render unto thee the fullest praise.`,
};

/**
 * Seed English verse translations if missing
 */
export async function seedEnglishVerseTranslations() {
  console.log("Checking for missing English verse translations...");
  
  // Get the Isha Upanishad book
  const existingBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (existingBooks.length === 0) {
    console.log("Isha Upanishad book not found, skipping English translations");
    return;
  }
  
  const book = existingBooks[0];
  const bookVerses = await db.select().from(verses).where(eq(verses.bookId, book.id));
  
  if (bookVerses.length === 0) {
    console.log("No verses found, skipping English translations");
    return;
  }
  
  // Check for existing English translations
  const existingTranslations = await db
    .select()
    .from(verseTranslations)
    .innerJoin(verses, eq(verseTranslations.verseId, verses.id))
    .where(and(
      eq(verses.bookId, book.id),
      eq(verseTranslations.languageCode, "english")
    ));
  
  if (existingTranslations.length >= 18) {
    console.log("All English verse translations already exist");
    return;
  }
  
  // Get existing verse IDs that have English translations
  const existingVerseIds = new Set(existingTranslations.map(t => t.verse_translations.verseId));
  
  // Add missing English translations
  let addedCount = 0;
  for (const verse of bookVerses) {
    if (!existingVerseIds.has(verse.id)) {
      const englishContent = englishVerseTranslations[verse.verseNumber];
      if (englishContent) {
        await storage.createTranslation({
          verseId: verse.id,
          languageCode: "english",
          content: englishContent,
        });
        addedCount++;
      }
    }
  }
  
  if (addedCount > 0) {
    console.log(`Added ${addedCount} English verse translations`);
  } else {
    console.log("No new English verse translations needed");
  }
}

/**
 * Update verse section titles to use descriptive English names
 * This ensures production database has the correct chapter names
 * Also creates Introduction verse (verse 0) if missing
 */
export async function updateVerseSectionTitles() {
  console.log("Checking verse section titles...");
  
  const verseTitles: Record<number, string> = {
    0: "Introductory Remarks by Śaṅkara",
    1: "Devotion to Jñāna (Knowledge)",
    2: "Devotion to Karma (Action)",
    3: "The Fate of the Self-Slayers",
    4: "Nature of the Self - Unmoving Yet Swift",
    5: "The Self - Far and Near",
    6: "Vision of Unity in All Beings",
    7: "Freedom from Delusion and Sorrow",
    8: "Nature of the Supreme Self",
    9: "Avidyā and Vidyā - A Warning",
    10: "The Fruits of Knowledge and Ignorance",
    11: "Combining Vidyā and Avidyā",
    12: "Worship of the Unmanifest",
    13: "Sambhūti and Asambhūti",
    14: "Combining Sambhūti and Vināśa",
    15: "Prayer to the Sun - The Golden Disc",
    16: "Prayer to the Sun - O Pūṣan",
    17: "The Final Prayer - Om Krato",
    18: "Prayer to Agni - Lead Us"
  };
  
  // Get the book ID first
  const allBooks = await db.select().from(books);
  if (allBooks.length === 0) {
    console.log("No books found, skipping section title update");
    return;
  }
  const bookId = allBooks[0].id;
  
  let updatedCount = 0;
  let createdCount = 0;
  
  for (const [verseNum, title] of Object.entries(verseTitles)) {
    const verseNumber = parseInt(verseNum);
    
    // Find the verse
    const existingVerses = await db.select().from(verses).where(eq(verses.verseNumber, verseNumber));
    
    if (existingVerses.length > 0) {
      const verse = existingVerses[0];
      
      // Check if section title needs updating
      if (verse.sectionTitle !== title) {
        await db.update(verses)
          .set({ sectionTitle: title })
          .where(eq(verses.id, verse.id));
        updatedCount++;
      }
    } else if (verseNumber === 0) {
      // Create Introduction verse if missing
      console.log("Creating missing Introduction verse (verse 0)...");
      
      const introVerse = await storage.createVerse({
        bookId: bookId,
        verseNumber: 0,
        sectionTitle: "Introductory Remarks by Śaṅkara",
      });
      
      // Add translations for introduction
      await storage.createTranslation({
        verseId: introVerse.id,
        languageCode: "devanagari",
        content: "ईशावास्यमित्यादयो मन्त्रा आत्मनो याथात्म्यप्रतिपादकाः कर्मस्वनुप्रवेशायोगात् कर्मणि विनियोगं न प्राप्नुवन्ति ।",
      });
      
      await storage.createTranslation({
        verseId: introVerse.id,
        languageCode: "english",
        content: "The verses beginning with Īśāvāsyam explain the true nature of the Self which is not subsidiary to karma.",
      });
      
      // Add Shankaracharya explanation
      await storage.createExplanation({
        verseId: introVerse.id,
        authorName: "Adi Shankaracharya",
        authorTitle: "English Translation by M. Hiriyanna",
        languageCode: "english",
        content: `The mantras beginning with 'Īśāvāsyam' set forth the true nature of the Self. Since the Self as there explained is not subsidiary to sacrificial action, these mantras do not fall in the class of injunctions relating to karma.

The true nature of the Self to be expounded later is its purity (being untouched by evil), its being one, its being eternal, its being incorporeal, its being omnipresent, and the like.

To such a Self, which is the subject matter of the Upanishad, no relation is possible with rituals or their accessories or their results. This is the purport of the Introduction.`,
      });
      
      createdCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Updated ${updatedCount} verse section titles`);
  }
  if (createdCount > 0) {
    console.log(`Created ${createdCount} missing verses`);
  }
  if (updatedCount === 0 && createdCount === 0) {
    console.log("All verse section titles are already correct");
  }
  
  // Also update book title to complete Sanskrit name
  const bookToUpdate = allBooks[0];
  const correctTitle = "Īśāvāsyopaniṣad";
  const correctDescription = `The Īśāvāsyopaniṣad (ईशावास्योपनिषद्) is one of the shortest and most celebrated Upanishads. This text presents Shankaracharya's Bhashya (commentary) on the 18 mantras, providing deep philosophical insights into Advaita Vedanta.`;
  
  if (bookToUpdate.title !== correctTitle || bookToUpdate.description !== correctDescription) {
    await db.update(books)
      .set({ 
        title: correctTitle,
        description: correctDescription
      })
      .where(eq(books.id, bookId));
    console.log("Updated book title to complete Sanskrit name: Īśāvāsyopaniṣad");
  }
}

export async function updateIshaUpanishadHierarchy() {
  console.log("Checking Isha Upanishad hierarchy (adhyay/khanda)...");

  const existingBooks = await db.select().from(books).where(eq(books.slug, "isha-upanishad-bhashya"));
  if (existingBooks.length === 0) {
    console.log("Isha Upanishad not found, skipping hierarchy update");
    return;
  }

  const bookId = existingBooks[0].id;
  const bookVerses = await db.select().from(verses).where(eq(verses.bookId, bookId)).orderBy(verses.verseNumber);

  if (bookVerses.length === 0) {
    console.log("No verses found, skipping hierarchy update");
    return;
  }

  const hasHierarchy = bookVerses.some(v => v.adhyayNumber != null);
  if (hasHierarchy) {
    console.log("Isha Upanishad hierarchy already set");
    return;
  }

  console.log("Setting Isha Upanishad hierarchy...");

  const hierarchy: Record<number, { adhyayNumber: number; adhyayTitle: string; khandaNumber: number; khandaTitle: string }> = {
    0:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 1, khandaTitle: "Introduction & Renunciation" },
    1:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 1, khandaTitle: "Introduction & Renunciation" },
    2:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 1, khandaTitle: "Introduction & Renunciation" },
    3:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 1, khandaTitle: "Introduction & Renunciation" },
    4:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 2, khandaTitle: "Nature of the Self" },
    5:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 2, khandaTitle: "Nature of the Self" },
    6:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 2, khandaTitle: "Nature of the Self" },
    7:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 2, khandaTitle: "Nature of the Self" },
    8:  { adhyayNumber: 1, adhyayTitle: "Jñāna-Karma Kāṇḍa", khandaNumber: 2, khandaTitle: "Nature of the Self" },
    9:  { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 1, khandaTitle: "Vidyā & Avidyā" },
    10: { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 1, khandaTitle: "Vidyā & Avidyā" },
    11: { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 1, khandaTitle: "Vidyā & Avidyā" },
    12: { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 2, khandaTitle: "Sambhūti & Asambhūti" },
    13: { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 2, khandaTitle: "Sambhūti & Asambhūti" },
    14: { adhyayNumber: 2, adhyayTitle: "Vidyā-Avidyā Vicāra", khandaNumber: 2, khandaTitle: "Sambhūti & Asambhūti" },
    15: { adhyayNumber: 3, adhyayTitle: "Prārthanā Kāṇḍa", khandaNumber: 1, khandaTitle: "Prayers to the Sun" },
    16: { adhyayNumber: 3, adhyayTitle: "Prārthanā Kāṇḍa", khandaNumber: 1, khandaTitle: "Prayers to the Sun" },
    17: { adhyayNumber: 3, adhyayTitle: "Prārthanā Kāṇḍa", khandaNumber: 2, khandaTitle: "Final Prayers" },
    18: { adhyayNumber: 3, adhyayTitle: "Prārthanā Kāṇḍa", khandaNumber: 2, khandaTitle: "Final Prayers" },
  };

  let updated = 0;
  for (const verse of bookVerses) {
    const h = hierarchy[verse.verseNumber];
    if (h) {
      await db.update(verses)
        .set({
          adhyayNumber: h.adhyayNumber,
          adhyayTitle: h.adhyayTitle,
          khandaNumber: h.khandaNumber,
          khandaTitle: h.khandaTitle,
        })
        .where(eq(verses.id, verse.id));
      updated++;
    }
  }

  console.log(`Updated hierarchy for ${updated} Isha Upanishad verses`);
}
