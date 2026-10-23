/**
 * Per-mutt reference content compiled from public web sources (official mutt
 * sites, Wikipedia, gazetteers, news). Every entry lists the sources it was
 * drawn from; facts that could not be sourced are left out rather than guessed.
 *
 * Keyed by `${sectionId}/${muttSlug(name)}` — names repeat across sections.
 * Only imported by the (lazy) mutts page, so it stays out of the main bundle.
 */

export interface MuttFacts {
  founded?: string;
  firstAcharya?: string;
  amnaya?: string;
  veda?: string;
  mahavakya?: string;
  lineage?: string;
  deity?: string;
  currentHead?: string;
  currentHeadAsOf?: string;
  address?: string;
}

export interface MuttDetail {
  overview?: string;
  history?: string;
  facts: MuttFacts;
  highlights: string[];
  website?: string;
  sources: { title: string; url: string }[];
}

export const MUTT_DETAILS: Record<string, MuttDetail> = {
  "principal/sringeri-matha": {
    "overview": "The Sringeri Sharada Peetham, formally the Dakshinamnaya Sri Sharada Peetham, is a monastery on the banks of the Tunga River at Sringeri in Chikkamagaluru district, Karnataka. Tradition counts it as the southern seat among the four cardinal (Chaturamnaya) peethas attributed to Adi Shankara. It is a major centre of Advaita Vedanta teaching and Sanskrit learning, and it runs branches in several Indian states.",
    "history": "Tradition holds that Adi Shankara founded the peetham and installed his disciple Sureshvaracharya as its first head. Historians such as Paul Hacker question how early the institution is. They note that its record before about the 14th century is thin, and some suggest the four-matha system dates from the time of Vidyaranya. From the 14th century the matha received major patronage from the Vijayanagara Empire, and later from the Keladi Nayakas and the Marathas. The Vidyashankara Temple was completed in 1338.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara (8th century CE in modern scholarship). Historians date its documented prominence to the 14th century.",
      "firstAcharya": "Sureshvaracharya (traditionally identified with Mandana Mishra)",
      "amnaya": "Dakshinamnaya (South)",
      "veda": "Yajur Veda",
      "mahavakya": "Aham Brahmasmi (I am Brahman)",
      "deity": "Sharadamba (Goddess Sharada / Saraswati)",
      "currentHead": "Jagadguru Sri Bharati Tirtha Mahaswami, the 36th Jagadguru, in office since 1989. Sri Vidhushekhara Bharati was named successor-designate on 23 January 2015.",
      "currentHeadAsOf": "October 2026",
      "address": "Sringeri Math and its Properties, Sringeri, Chikkamagaluru District, Karnataka 577139, India"
    },
    "highlights": [
      "Sharadamba Temple and the Vidyashankara Temple (completed 1338), which blends Hoysala and Vijayanagara styles",
      "Sharada Sharannavaratri, Shankara Jayanti, Guru Purnima and an annual chariot festival",
      "Sadvidya Sanjivini Sanskrit Mahapathashala and a manuscript library of about 500 palm-leaf manuscripts",
      "Network of branches across India"
    ],
    "website": "https://www.sringeri.net/",
    "sources": [
      {
        "title": "Sringeri Sharada Peetham - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Sringeri_Sharada_Peetham"
      },
      {
        "title": "Sri Sringeri Sharada Peetham (official website)",
        "url": "https://www.sringeri.net/"
      },
      {
        "title": "The Amnaya Peethams - Sringeri Sharada Peetham",
        "url": "https://www.sringeri.net/history/amnaya-peethams"
      },
      {
        "title": "Dashanami Sampradaya - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Dashanami_Sampradaya"
      }
    ]
  },
  "principal/kamakoti-pitha": {
    "overview": "The Kanchi Kamakoti Peetham is a Hindu monastic institution in Kanchipuram, Tamil Nadu, near the Kamakshi Amman Temple. Its followers regard it as a seat founded by Adi Shankara, and its heads hold the title Shankaracharya. Whether Shankara founded it is disputed. The Sringeri matha does not count it among the peethas Shankara established, and the four-peetha (Chaturamnaya) tradition does not include it.",
    "history": "The matha's own account says Adi Shankara established it in 482 BCE and that Shankara was its first Jagadguru. Modern scholarship places Shankara in the 8th century CE. Critics and some historical accounts, summarised on Wikipedia, say the institution began as the Kumbakonam Mutt, possibly as a branch of the Sringeri matha, and later moved to Kanchipuram. The founding claim and the matha's succession list remain contested.",
    "facts": {
      "founded": "482 BCE according to the matha's own tradition (disputed). Some historical accounts describe an origin at Kumbakonam before a move to Kanchipuram.",
      "firstAcharya": "Adi Shankara, according to the matha's tradition (disputed)",
      "currentHead": "Sri Shankara Vijayendra Saraswathi, 70th in the matha's lineage, since 28 February 2018. Sri Satya Chandrashekharendra Saraswati was anointed successor in 2025.",
      "currentHeadAsOf": "October 2026",
      "address": "Shrimatam Samsthanam, Kanchipuram, Tamil Nadu, India"
    },
    "highlights": [
      "Located near the Kamakshi Amman Temple in Kanchipuram",
      "Runs Veda pathashalas and works to preserve historic palm-leaf manuscripts",
      "Publishes the 'Hindu Dharma' discourses of Sri Chandrasekharendra Saraswathi and other literature",
      "Branch math in Varanasi at Hanuman Ghat (Sri Kamakoteeswar Mandir)"
    ],
    "website": "https://www.kamakoti.org/",
    "sources": [
      {
        "title": "Kanchi Kamakoti Peetham - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Kanchi_Kamakoti_Peetham"
      },
      {
        "title": "Sri Kanchi Kamakoti Peetham (official website)",
        "url": "https://www.kamakoti.org/"
      }
    ]
  },
  "principal/badari-matha": {
    "overview": "Jyotir Math (also Jyotish Peeth, Joshi Math or Badarikashrama Peetham) is the northern (Uttaramnaya) seat among the four cardinal peethas traditionally attributed to Adi Shankara. It is located in Jyotirmath (Joshimath), Chamoli district, Uttarakhand, near Badrinath. It is the headquarters of the Giri, Parvata and Sagara orders of the Dashanami Sampradaya.",
    "history": "Tradition holds that Adi Shankara founded the matha and appointed Totakacharya as its first head. The seat was held by Swami Ramakrishna Tirtha in the 18th century and then stood vacant for about 165 years. It was revived when Brahmananda Saraswati was installed on 11 May 1941. Its succession has been disputed since his death in 1953. After Swaroopanand Saraswati died in 2022, the Supreme Court in October 2022 stayed the coronation of his named successor, Avimukteshwaranand Saraswati. A rival claim by Vasudevanand Saraswati is still before the court.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara. The seat was revived in 1941 after a long vacancy.",
      "firstAcharya": "Totakacharya",
      "amnaya": "Uttaramnaya (North)",
      "veda": "Atharva Veda",
      "mahavakya": "Ayam Atma Brahma (This Self is Brahman)",
      "deity": "Lord Narayana and Shakti Purnagiri. A nearby Narasimha temple is traditionally linked to Adi Shankara.",
      "currentHead": "Disputed. Swami Avimukteshwaranand Saraswati claims the seat as Swaroopanand Saraswati's named successor (2022). Swami Vasudevanand Saraswati has a rival claim. The Supreme Court stayed Avimukteshwaranand's coronation in October 2022, and the case was still pending.",
      "currentHeadAsOf": "July 2026",
      "address": "Jyotirmath (Joshimath), Chamoli district, Uttarakhand, India"
    },
    "highlights": [
      "Northern seat of the four Chaturamnaya peethas, associated with the Atharva Veda",
      "Narasimha temple at Jyotirmath, traditionally associated with Adi Shankara, and the Purnagiri Devi shrine",
      "Gateway town for Badrinath and the Valley of Flowers",
      "Long-running succession dispute before the Supreme Court of India"
    ],
    "sources": [
      {
        "title": "Jyotir Math - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Jyotir_Math"
      },
      {
        "title": "Jyotirmath - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Jyotirmath"
      },
      {
        "title": "Supreme Court Stops Coronation Of Swami Avimukteshwaranand Saraswati As Shankaracharya Of Jyotish Peeth - Verdictum (Oct 2022)",
        "url": "https://www.verdictum.in/court-updates/supreme-court/swami-avimukteshwaranand-saraswati-shankaracharya-jyotish-peeth-1443670"
      },
      {
        "title": "Jyotish Peeth Shankaracharya dispute - Aaj Tak (24 July 2026)",
        "url": "https://www.aajtak.in/india/news/story/jyotish-peeth-shankaracharya-dispute-ayodhya-ram-mandir-trust-vasudevanand-avimukteshwaranand-ntcpvp-dskc-2608588-2026-07-24"
      },
      {
        "title": "Swaroopanand Saraswati - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Swaroopanand_Saraswati"
      }
    ]
  },
  "principal/puri-matha": {
    "overview": "The Govardhan Math (Purvamnaya Sri Govardhana Peetham) in Puri, Odisha, is the eastern seat among the four cardinal peethas traditionally attributed to Adi Shankara. It has a long historical association with the Jagannath Temple. It is traditionally linked with the Rig Veda.",
    "history": "The matha's own account says Adi Shankara established it at Jagannath Puri, in a year it gives as 486 BCE, while modern scholars place Shankara in the 8th century CE. Sources differ on the first head: the Govardhan Math and Wikipedia name Padmapadacharya, while the Sringeri matha's list names Hastamalakacharya. In the 20th century the seat was held by Bharati Krishna Tirtha, from 1925 to 1960. Niranjana Deva Tirtha later nominated Nishchalananda Saraswati as his successor in 1992.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara. The matha gives 486 BCE; modern scholarship dates Shankara to the 8th century CE.",
      "firstAcharya": "Padmapadacharya (per the Govardhan Math and Wikipedia). The Sringeri matha lists Hastamalakacharya.",
      "amnaya": "Purvamnaya (East)",
      "veda": "Rig Veda",
      "mahavakya": "Prajnanam Brahma (Consciousness is Brahman)",
      "deity": "Jagannath, with the goddess Vimala",
      "currentHead": "Swami Nishchalananda Saraswati (nominated 1992)",
      "currentHeadAsOf": "October 2026",
      "address": "Govardhan Peeth, Shankaracharya Marg, Puri, Odisha 752001, India"
    },
    "highlights": [
      "Historic association with the Jagannath Temple, Puri",
      "Images of Govardhananatha Krishna and Ardhanarishvara Shiva, said to have been installed by Adi Shankara",
      "Daily Samudra Arati at Svargadvara beach",
      "Runs a Ved Gurukulam and a gaushala (cow shelter)"
    ],
    "website": "https://govardhanpeeth.org/",
    "sources": [
      {
        "title": "Govardhan Math - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Govardhan_Math"
      },
      {
        "title": "Govardhan Peeth, Puri (official website)",
        "url": "https://govardhanpeeth.org/"
      },
      {
        "title": "The Amnaya Peethams - Sringeri Sharada Peetham",
        "url": "https://www.sringeri.net/history/amnaya-peethams"
      }
    ]
  },
  "principal/dwaraka-matha": {
    "overview": "The Dwarka Sharada Peetham (also called the Kalika Matha) in Dwarka, Gujarat, is the western seat among the four cardinal peethas traditionally attributed to Adi Shankara. It is traditionally linked with the Sama Veda. Its building is a four-storeyed structure with walls painted with scenes from Shankara's life.",
    "history": "Tradition credits Adi Shankara with founding the peetham. Sources differ on the first head: Wikipedia names Hastamalakacharya, while the Sringeri matha's list names Padmapadacharya. The 17th-century Mulabagal Math in Karnataka, a branch of Dwarka, merged with it when Sachchidananda Tirtha took office in 1945. Swaroopanand Saraswati led the peetham from 1982 until his death in September 2022, and Sadananda Saraswati succeeded him.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara.",
      "firstAcharya": "Hastamalakacharya (per Wikipedia). The Sringeri matha lists Padmapadacharya.",
      "amnaya": "Paschimamnaya (West)",
      "veda": "Sama Veda",
      "mahavakya": "Tat Tvam Asi (That thou art)",
      "currentHead": "Swami Sadananda Saraswati (since 2022, succeeding Swaroopanand Saraswati)",
      "currentHeadAsOf": "October 2026",
      "address": "Dwarka, Gujarat, India"
    },
    "highlights": [
      "Western seat of the Chaturamnaya peethas, associated with the Sama Veda",
      "Four-storeyed math building with murals of Adi Shankara's life and Shiva carvings on the dome",
      "Absorbed the Mulabagal branch math (Karnataka) in 1945",
      "Swaroopanand Saraswati (1982-2022) headed two peethas, Dwarka and Jyotirmath, at the same time"
    ],
    "website": "https://shreesharadapithmathdwarka.org/",
    "sources": [
      {
        "title": "Dwarka Sharada Peetham - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Dvaraka_Pitha"
      },
      {
        "title": "Swaroopanand Saraswati - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Swaroopanand_Saraswati"
      },
      {
        "title": "Advaita-L archive: report on successors of Swami Swaroopanand Saraswati (Sept 2022)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2022-September/058960.html"
      },
      {
        "title": "The Amnaya Peethams - Sringeri Sharada Peetham",
        "url": "https://www.sringeri.net/history/amnaya-peethams"
      }
    ]
  },
  "principal/kasi-benares": {
    "overview": "Varanasi (Kashi or Benares) is central to the traditional life of Adi Shankara. Hagiographies place a long stay there in his youth, and tradition holds that he wrote his major commentaries on the Brahma Sutras, Upanishads and Bhagavad Gita there. The claim that Shankara founded five mathas in Kashi, four for his disciples and one for himself, could not be confirmed in other reliable sources.",
    "history": "Tradition sets Shankara's encounter with a chandala (outcaste) near the Ganga at Kashi in Varanasi, and the Manisha Panchakam is said to have been composed in response to it. The hymn Kashi Panchakam is also attributed to him. A 'Sumeru Math' at Kashi is sometimes listed among seven 'principal' mathas, and its head has claimed the Shankaracharya title. Advaita scholars dispute this list, and the other peethas do not recognise the claim. Today the Sringeri and Kanchi institutions both run branch maths in Varanasi.",
    "facts": {
      "deity": "Kashi Vishwanath (Shiva) is the principal deity of the city.",
      "address": "Varanasi, Uttar Pradesh. Branch maths include the Kanchi Kamakoti Sri Sankara Matam at Hanuman Ghat and the Sringeri branch at Kedar Ghat."
    },
    "highlights": [
      "Traditional setting of the Manisha Panchakam (Shankara and the chandala) and the Kashi Panchakam",
      "Tradition holds that Shankara wrote his Brahma Sutra, Upanishad and Gita commentaries during his stay in Kashi",
      "Sumeru (Kashi) Peeth claims a Shankaracharya lineage that the four amnaya peethas and Advaita scholars dispute",
      "Sringeri (Kedar Ghat) and Kanchi (Hanuman Ghat) branch maths operate in the city"
    ],
    "sources": [
      {
        "title": "Varanasi - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Varanasi"
      },
      {
        "title": "Manisha Panchakam - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Manisha_Panchakam"
      },
      {
        "title": "Adi Shankara - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Adi_Shankara"
      },
      {
        "title": "Sri Kanchi Kamakoti Peetam - Kasi (Varanasi) branch",
        "url": "https://kamakoti.org/kamakoti/details/Sri%20Kanchi%20Kamakoti%20Peetam%20Kasi.html"
      },
      {
        "title": "Advaita-L archive: Debate between Dwarka and Sumeru Shankaracharyas (Jan 2013)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2013-January/033818.html"
      }
    ]
  },
  "principal/srinagar": {
    "overview": "Shankara's link to Kashmir rests on two sites. The first is the Shankaracharya (Jyeshteshwara) Temple, a Shiva temple on a hill about 300 m above Srinagar; Kashmiri Hindus hold that Shankara visited it, which is why the temple and hill bear his name. The second is the ancient Sharada Peeth in the Neelum Valley, now a ruin in Pakistan-administered Kashmir, where hagiographies say Shankara ascended the Sarvajna Peetha (Throne of Omniscience). No surviving Shankara-founded matha in Srinagar is documented.",
    "history": "Kalhana attributes the hilltop temple to King Gopaditya, while other accounts credit Jaluka or the Hun king Mihirakula; its construction date is disputed. Tradition holds that Shankara composed the Saundarya Lahari there. In 1961 the Dwarka Shankaracharya installed a statue of Adi Shankara in the temple. The 14th-century Madhaviya Shankara Vijayam says Shankara defeated scholars at the southern door of Sharada Peeth and ascended its throne. In 2023 a Sharada temple was opened at Teetwal near the Line of Control with Sringeri's involvement.",
    "facts": {
      "deity": "Shiva as Jyeshteshwara (Shankaracharya Temple); the goddess Sharada is associated with Sharada Peeth.",
      "address": "Shankaracharya Temple, Zabarwan Range (Shankaracharya Hill), Srinagar, Jammu and Kashmir, India"
    },
    "highlights": [
      "Shankaracharya Temple: an ASI Monument of National Importance reached by about 240 steps, with views of Dal Lake",
      "Tradition holds that the Saundarya Lahari was composed on the hill",
      "Sharada Peeth (Neelum Valley), where hagiographies say Shankara ascended the Sarvajna Peetha",
      "Temple is lit up for Maha Shivaratri and Herath, and is visited during the Amarnath Yatra"
    ],
    "sources": [
      {
        "title": "Shankaracharya Temple - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Shankaracharya_Temple"
      },
      {
        "title": "Sharada Peeth - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Sharada_Peeth"
      }
    ]
  },
  "additional/kudali-matha": {
    "overview": "The Kudali (Koodli) Matha is an Advaita monastery at Koodli in Shimoga district, Karnataka, where the Tunga and Bhadra rivers meet. Tradition says Adi Shankara founded it, and Wikipedia lists it as a branch of the Sringeri Sharada Peetham. Its historical relationship with Sringeri is disputed.",
    "history": "In one account, a Sringeri pontiff stayed away on a long pilgrimage in the 15th or 16th century. His deputy would not give up the seat, so the returning pontiff settled at Kudali, and the guru lineage continued from there. Some people argue that Kudali was Shankara's original matha, but this claim has not been settled by scholars.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara (no verified date)",
      "lineage": "Described by Wikipedia as a branch of Sringeri Sharada Peetham; independent status and precedence claims are disputed",
      "deity": "Shrines of Sharadamba and Shankaracharya within the matha premises",
      "address": "Koodli, Shimoga district, Karnataka"
    },
    "highlights": [
      "Located at the Tunga–Bhadra confluence, where the Tungabhadra river begins",
      "Wikipedia says the site has Hoysala-period and later inscriptions",
      "In the early 1900s a pontiff of the matha taught Krishnaraja Wodeyar IV of Mysore"
    ],
    "sources": [
      {
        "title": "Koodli - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Koodli"
      },
      {
        "title": "Advaita-l: Request for Scholarly Sources Regarding the Kudali–Sringeri Historical Debate (2026)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2026-July/065065.html"
      }
    ]
  },
  "additional/sivaganga-matha": {
    "overview": "The Shivaganga Sringeri Math is at Shivagange in Karnataka. The Sringeri Sharada Peetham describes it as a Shakha (branch) Math of the Dakshinamnaya Sri Sharada Peetham, and its presiding deity is Goddess Sharadamba.",
    "history": "Sringeri's 24th Acharya, Abhinava Nrisimha Bharati, founded the Math and made his sannyasi disciple Shankara Bharati its first Mathadhipati. In June 2022 the Sringeri Jagadguru Vidhushekhara Bharati performed the Kumbhabhisheka of Sri Sharadamba and consecrated a new temple to Adi Shankaracharya here.",
    "facts": {
      "founded": "By the 24th Sringeri Acharya, Abhinava Nrisimha Bharati (date not stated)",
      "lineage": "Shakha Math of Sringeri Sharada Peetham",
      "deity": "Sharadamba",
      "currentHead": "Sri Purushottama Bharati Swamiji",
      "currentHeadAsOf": "June 2022",
      "address": "Shivagange, Karnataka"
    },
    "highlights": [
      "Kumbhabhisheka and new Shankaracharya temple consecrated on 23 June 2022",
      "A granite temple for Sharadamba was proposed in 2022"
    ],
    "sources": [
      {
        "title": "Kumbhabhisheka at Shivaganga Sringeri Math - Sringeri Sharada Peetham",
        "url": "https://www.sringeri.net/events/kumbhabhisheka-shivaganga-sringeri-math"
      }
    ]
  },
  "additional/avani-matha": {
    "overview": "The Avani Sringeri Math, also called the Avani Sringeri Jagadguru Shankaracharya Sharada Peetham, is in Avani village, Mulbagal taluk, Kolar district, Karnataka. Sri Sharadamba and Sri Shankaracharya are worshipped in its temple. Sringeri describes it as administratively separate but guided only by the Sringeri Jagadgurus.",
    "history": "Tradition says Narasimha Bharati IV of Sringeri camped at Avani, found a standing image of Goddess Sharada flanked by Adi Shankara and a Sri Chakra, consecrated it, and set up a matha with one of his disciples as head. In June 2022 Sri Shantananda Bharati was installed as Mathadhipati in the presence of the Sringeri Jagadguru.",
    "facts": {
      "founded": "Traditionally by Narasimha Bharati IV of Sringeri (date not stated)",
      "lineage": "Administratively separate; guided by the Sringeri Jagadgurus",
      "deity": "Sharadamba",
      "currentHead": "Sri Shantananda Bharati",
      "currentHeadAsOf": "June 2022",
      "address": "Avani village, Mulbagal taluk, Kolar district, Karnataka"
    },
    "highlights": [
      "Has a branch in Basaveshwaranagar, Bangalore",
      "Avani is linked in local tradition with Valmiki and with Sita"
    ],
    "sources": [
      {
        "title": "Avani, Kolar - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Avani,_Kolar"
      },
      {
        "title": "Sri Sannidhanam graces the Pattabhisheka of new Mathadhipati of Avani Sringeri Math",
        "url": "https://www.sringeri.net/events/sri-sannidhanam-graces-pattabhisheka-new-mathadhipati-avani-sringeri-math"
      }
    ]
  },
  "additional/virupaksha-matha": {
    "overview": "The matha at Hampi, in Hospet taluk, Bellary district, is known as the Sri Virupaksha Vidyaranya Mahasamsthanam. It is associated by tradition with Vidyaranya, the 14th-century Sringeri pontiff linked to the founding of Vijayanagara. Little reliable published information is available on how it is governed today or how it relates to Sringeri.",
    "history": "An Indologist writing in 2000 states that Vidyaranya established a matha at the new capital at Hampi, citing the Virupaksha Matha. The founding has not been independently verified.",
    "facts": {
      "founded": "Traditionally attributed to Vidyaranya (14th century)",
      "currentHead": "Jagadguru Vidyaranya Bharati Swamiji",
      "currentHeadAsOf": "2014",
      "address": "Hampi, Hospet taluk, Bellary (Ballari) district, Karnataka"
    },
    "highlights": [
      "Associated with Vidyaranya and the early Vijayanagara capital"
    ],
    "sources": [
      {
        "title": "Hampi Mutt Seer Sri Jagadguru Vidyaranya Bharati Swamiji offers prayers in Tirumala (Hindupad, 2014)",
        "url": "https://hindupad.com/hampi-mutt-seer-sri-jagadguru-vidyaranya-bharati-swamiji-offers-prayers-tirumala-tirupati-temple/"
      },
      {
        "title": "INDOLOGY list: Madhava, Vidyaranya, Sringeri, and Kulke (V. Sundaresan, 2000)",
        "url": "https://list.indology.info/pipermail/indology/2000-May/021358.html"
      }
    ]
  },
  "additional/pushpagiri-matha": {
    "overview": "The Sri Pushpagiri Shankara Peetham (Pushpagiri Mahasamsthanam) is at Pushpagiri in Kadapa (Cuddapah) district, Andhra Pradesh, on the Penna river about 16 km north of Kadapa. Its seat is inside a temple complex whose Chennakesava temple is dated to about 1298 AD. Tradition holds that Adi Shankara established a mutt on these premises.",
    "history": "In 2003 the Peetham built a mutt at Tirumala on land from the Tirumala Tirupati Devasthanams, and planned branches at Srikalahasti, Basar, Tiruchanur and Tenali.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara (no verified date)",
      "currentHead": "Vidya Nrusimha Bharathi Swami",
      "currentHeadAsOf": "2003 (more recent leadership not verified)",
      "address": "Pushpagiri, Kadapa district, Andhra Pradesh"
    },
    "highlights": [
      "Located in the Pushpagiri temple complex on the Penna river",
      "Runs a branch mutt at Tirumala"
    ],
    "sources": [
      {
        "title": "Pushpagiri Temple Complex - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Pushpagiri_Temple_Complex"
      },
      {
        "title": "Hinduism Today / HPI (May 2003) on Pushpagiri Peetham",
        "url": "https://www.hinduismtoday.com/hpi/?p=3121"
      }
    ]
  },
  "additional/sankesvara-karavira-matha": {
    "overview": "The Shri Jagadguru Shankaracharya Samsthana Matha, Sankeshwar (Karavir), in Belagavi district, Karnataka, is a Shankaracharya institution linked by tradition to both Sankeshwar and Karvir (Kolhapur). Accounts differ on whether it began as a branch of Sringeri or is an independent peetha.",
    "history": "A local history source says that around 1553 CE Vidyashankar Bharati (Devgosavi), described as a Sringeri pontiff, went on pilgrimage and was not allowed back. He settled first at Kudalagi and then at Vallabhagad near Sankeshwar, where the Shankarling Math was set up, and a king of Kolhapur later invited him to Karvir. This account comes from a single non-academic source.",
    "facts": {
      "founded": "c. 1553 CE according to one local-history source (unverified)",
      "lineage": "Origin traced by tradition to a Sringeri pontiff; independent status asserted by others (disputed)",
      "address": "Sankeshwar, Belagavi district, Karnataka; associated seat at Karvir (Kolhapur), Maharashtra"
    },
    "highlights": [
      "Its heads use the title Shankaracharya",
      "Connected by tradition to both Sankeshwar and Kolhapur (Karvir)"
    ],
    "sources": [
      {
        "title": "Sankeshwar - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Sankeshwar"
      },
      {
        "title": "Sankeshwar - Shankaracharya Math (Durg Bharari)",
        "url": "https://durgbharari.in/sankeshwar/"
      },
      {
        "title": "Advaita-l: Sreemath Hariharapura (V. Sundaresan, 2011)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2011-April/027056.html"
      }
    ]
  },
  "additional/ramachandrapura-matha": {
    "overview": "The Ramachandrapura Math is an Advaita monastery in Hosanagara taluk, Shimoga district, Karnataka, on the left bank of the Sharavati river. Its followers are mainly Havyaka Brahmins in Uttara Kannada, Dakshina Kannada, Udupi and Shimoga districts and in Kasaragod district of Kerala. Its pontiffs take the title Bharati.",
    "history": "Tradition says Adi Shankara founded it near Gokarna, where it was first known as the Raghuthama Matha. Raghaveshwara Bharati, the 36th pontiff, succeeded Raghavendra Bharati in 1999.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankara (originally near Gokarna)",
      "lineage": "Independent Shankaracharya matha",
      "currentHead": "Sri Raghaveshwara Bharati (36th pontiff)",
      "currentHeadAsOf": "Since 1999",
      "address": "Ramachandrapura, Hosanagara taluk, Shimoga district, Karnataka"
    },
    "highlights": [
      "Guru-peetha of the Havyaka Brahmin community",
      "Originally known as the Raghuthama Matha near Gokarna",
      "Runs cow-protection and rural-welfare programmes"
    ],
    "website": "https://srisamsthana.org",
    "sources": [
      {
        "title": "Ramachandrapura Mutt - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Ramachandrapura_Mutt"
      },
      {
        "title": "Raghaveshwara Bharati - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Raghaveshwara_Bharati"
      }
    ]
  },
  "additional/hariharapura-matha": {
    "overview": "The Sreemath Hariharapura, also called the Sharada Lakshmi Narasimha Peetham, is on the Tunga river at Hariharapura in Koppa taluk, Chikmagalur district, near Sringeri. Its presiding deity is Goddess Sharadamba. A 2011 scholarly comment calls it perhaps one of the oldest branches of the Sringeri Peetham.",
    "history": "Tradition says Adi Shankara installed a Sri Chakra and consecrated Sharadamba here. It also says Sureshwaracharya initiated the first head, Swayamprakasha Krishna Yogeendra Saraswathi, and many later heads have carried the name Swayamprakasha.",
    "facts": {
      "founded": "Traditionally attributed to the time of Adi Shankara (no verified date)",
      "lineage": "Described as an old branch of Sringeri Peetham",
      "deity": "Sharadamba (with Sri Chakra); Lakshmi Narasimha",
      "currentHead": "Swayamprakasha Sachidananda Saraswathi",
      "currentHeadAsOf": "2011",
      "address": "Hariharapura, Koppa taluk, Chikmagalur district, Karnataka"
    },
    "highlights": [
      "Located on the Tunga river near Sringeri",
      "Its heads traditionally carry the name Swayamprakasha"
    ],
    "website": "http://www.hariharapura.in",
    "sources": [
      {
        "title": "Hariharapura - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Hariharapura"
      },
      {
        "title": "Advaita-l: Sreemath Hariharapura (invitation, 2011)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2011-April/027043.html"
      },
      {
        "title": "Advaita-l: Sreemath Hariharapura (V. Sundaresan, 2011)",
        "url": "https://advaita-vedanta.org/archives/advaita-l/2011-April/027056.html"
      }
    ]
  },
  "additional/bandigadi-matha": {
    "overview": "Bandigadi (Bhandigadi), in Koppa taluk, Chikmagalur district, near Sringeri, is the seat of the Shakatapuram Sri Vidya Peetham, an Advaita matha on the Tunga river; Wikipedia treats Shakatapuram and Bhandigadi as the same place. The matha traces its lineage to Totakacharya and the Jyotish Peetha of Badrinath.",
    "history": "The peetham's own history says Satyatheertha, then pontiff of the Jyotish Peetha, left Badrinath during a period of unrest and founded it around 1338 AD. The current pontiff, the 33rd, took the seat on 22 February 1981 at the age of thirteen.",
    "facts": {
      "founded": "c. 1338 AD (per the peetham's own history)",
      "lineage": "Traces descent from Totakacharya / Jyotish Peetha (Badrinath)",
      "deity": "Srividya Rajarajeswari, Santhana Venugopala Krishna and Lakshmi Narasimha",
      "currentHead": "Sri Vidyabhinava Krishnananda Theertha Mahaswamigal (33rd pontiff)",
      "currentHeadAsOf": "Since 22 February 1981",
      "address": "Shakatapuram (Bhandigadi), Koppa taluk, Chikmagalur district, Karnataka 577126"
    },
    "highlights": [
      "Located on the Tunga river near Sringeri",
      "Known for Srividya worship"
    ],
    "website": "https://shrividyapeetam.in",
    "sources": [
      {
        "title": "Shakatapuram - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Shakatapuram"
      },
      {
        "title": "Bhandigadi - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Bhandigadi"
      },
      {
        "title": "History - Shakatapuram Sri Vidya Peetam",
        "url": "https://shrividyapeetam.in/history/"
      }
    ]
  },
  "additional/yadaniru-matha": {
    "overview": "Edneer Mutt (Edaneer) is an Advaita monastery about 10 km northeast of Kasaragod town, Kerala, on the Madhuvahini river. It follows the Smartha Bhagavata tradition and traces its lineage to Totakacharya, a disciple of Adi Shankara. It is widely known for the 1973 Supreme Court case Kesavananda Bharati v. State of Kerala, which set out the basic structure doctrine.",
    "history": "Kesavananda Bharati headed the mutt from 1961 until he died on 6 September 2020. His 1970 challenge to Kerala's land reform laws led to the 1973 ruling by a 13-judge bench. Sachidananda Bharati succeeded him in 2020.",
    "facts": {
      "lineage": "Totakacharya parampara (Smartha Bhagavata Advaita)",
      "deity": "Dakshinamurthi and Gopalakrishna",
      "currentHead": "Sri Sachidananda Bharati Swamiji",
      "currentHeadAsOf": "May 2026",
      "address": "Edneer, Kasaragod district, Kerala"
    },
    "highlights": [
      "Petitioner institution in the Kesavananda Bharati case (1973)",
      "Centre for Yakshagana, Kannada culture and education in Kasaragod",
      "Visited by the Sringeri Jagadguru in May 2026"
    ],
    "sources": [
      {
        "title": "Edneer Mutt - Kerala Tourism",
        "url": "https://www.keralatourism.org/bekal/edneer-mutt-kasargod.php"
      },
      {
        "title": "Tryst with the Constitution: A visit to the mutt that gave us the Basic Structure doctrine (Bar and Bench)",
        "url": "https://www.barandbench.com/columns/tryst-with-the-constitution-a-visit-to-the-mutt-that-gave-us-the-basic-structure-doctrine"
      },
      {
        "title": "Kesavananda Bharati - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Kesavananda_Bharati"
      },
      {
        "title": "Jagadguru Sri Sannidhanam graces Edneer Math, Kasargod (Sringeri, 2026)",
        "url": "https://www.sringeri.net/vijaya-yatra/jagadguru-sri-sannidhanam-graces-edneer-math-kasargod-2026"
      }
    ]
  },
  "additional/kodandarama-matha": {
    "overview": "The Kodandarama Matha at Hebbairu (Hebbur) in Tumkur district appears to be the Shri Kodandashrama Mutt of Hebbur, which manages the Shri Kamakshi Sharada temple; its main deity is Goddess Kamakshi Sharadamba. The identification is likely but not confirmed, and little has been published about the mutt's lineage.",
    "history": "By tradition, a devotee found a pancha-loha Sri Chakra, said to be over 300 years old, in a well and gave it to Sri Kodandaramashrama Swamiji, who built a temple for it.",
    "facts": {
      "deity": "Kamakshi Sharadamba",
      "address": "Hebbur, Tumkur district, Karnataka"
    },
    "highlights": [
      "Manages the Shri Kamakshi Sharada temple with its pancha-loha Sri Chakra"
    ],
    "sources": [
      {
        "title": "Shri Kamakshi Sharada Temple - Indianetzone",
        "url": "https://www.indianetzone.com/shri_kamakshi_sharada_temple"
      }
    ]
  },
  "additional/svarnavalli-matha": {
    "overview": "The Sonda Swarnavalli Maha Samsthana is an Advaita matha in the forests near the Shalmala river at Sonda, Sirsi taluk, Uttara Kannada district, Karnataka. Its disciples include Havyaka Brahmins and several other communities across the region. It is separate from the Madhva Sode Vadiraja Matha in the same village.",
    "history": "Its history is traditionally traced to the time of Adi Shankara, but no founding date is documented. Gangadharendra Saraswati, the 54th pontiff, took the seat on 2 February 1991 at the age of 23.",
    "facts": {
      "founded": "Traditionally traced to the time of Adi Shankara (no verified date)",
      "lineage": "Independent Advaita matha",
      "currentHead": "Sri Gangadharendra Saraswati (54th pontiff)",
      "currentHeadAsOf": "Since 1991",
      "address": "Sonda, Sirsi taluk, Uttara Kannada district, Karnataka"
    },
    "highlights": [
      "Leads the Bhagavad Gita Abhiyaan campaign",
      "Guru-peetha for Havyaka and several other communities of Uttara Kannada"
    ],
    "website": "https://swarnavallimatha.org",
    "sources": [
      {
        "title": "Gangadharendra Saraswati - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Gangadharendra_Saraswati"
      },
      {
        "title": "Sonda, Karnataka - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Sonda,_Karnataka"
      }
    ]
  },
  "additional/nelamavu-matha": {
    "overview": "Nelemavu (Nelemav) Matha is an Advaita matha in Siddapur taluk, Uttara Kannada, on the bank of the Aghanashini river, about 25 km from Sirsi; a 'Nelemavu Matha Cross' bus stop lies on the Sirsi–Siddapur road. It has close ties with the Sringeri Sharada Peetham, whose Jagadguru has visited and blessed devotees there.",
    "history": "In April–May 2019 Sringeri's Jagadguru Sri Vidhushekhara Bharati visited the matha, consecrated a Shiva Linga on its premises and opened a new building called 'Shankara Kripa'.",
    "facts": {
      "lineage": "Advaita (Shankara tradition); close ties with Sringeri Sharada Peetham",
      "deity": "Narasimha Swamy",
      "address": "Nelemavu, Siddapur taluk (near Sirsi), Uttara Kannada district, Karnataka"
    },
    "highlights": [
      "On the bank of the Aghanashini river",
      "Narasimha Swamy is the matha's presiding deity",
      "Sringeri Jagadguru's 2019 visit: Shiva Linga consecrated, 'Shankara Kripa' building opened"
    ],
    "sources": [
      {
        "title": "A week long Vijaya Yatra of Sri Sannidhanam – Sringeri Sharada Peetham (2019)",
        "url": "https://www.srisharadapeetham.com/2019/05/02/news/a-week-long-vijaya-yatra-of-sri-sannidhanam.htm"
      },
      {
        "title": "Preceptors of Advaita 57 – Sri Sankara and Sankarite Mathas (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      }
    ]
  },
  "additional/yoga-narasimhasvami-matha": {
    "overview": "No present-day institution under this name could be found at Holenarasipura. Two Advaita institutions there are possible matches: the Holenarasipura branch of the Yadathore Sri Yoganandeshwara Saraswati Math, with shrines to Chaturbhuja Pattabhirama and Nilakantheshwara, and Sri Satchidanandendra Saraswati's Adhyatma Prakasha Karyalaya. Neither is documented as a Yoga Narasimha matha, so the identification is unconfirmed.",
    "facts": {
      "address": "Holenarasipura, Hassan district, Karnataka"
    },
    "highlights": [],
    "sources": [
      {
        "title": "Sri Math – Vedanta Bharati (Yadathore Sri Yoganandeshwara Saraswati Math)",
        "url": "https://vedantabharati.org/sri-math/"
      },
      {
        "title": "KR Nagar, March 10-11, 2017 – Sringeri Vijaya Yatra (Yadathore Math history)",
        "url": "https://vijayayatra.sringeri.net/archiveyatra/kr-nagar-march-10-11-2017-2/"
      }
    ]
  },
  "additional/balakuduru-matha": {
    "overview": "The Balekudru Shreematha is an Advaita matha at the meeting of the Sita and Swarna rivers, near Hangarakatte village in Udupi district, Karnataka. Wikipedia describes it as the guru-peetha for Advaita-following Brahmins of South Canara and the only Advaita peetha in the Dakshina Kannada and Udupi districts. Its main deity is Lord Lakshminarasimha.",
    "history": "Tradition says Kaivalyashrama Swamy founded it and brought the main idol from Badari. The founding date is unknown. On 22 November 2024 the current head named Vasudeva Sadashiva Ashrama Swamiji as successor-designate.",
    "facts": {
      "founded": "Traditionally by Kaivalyashrama Swamy (date unknown)",
      "lineage": "Advaita, Bhagavata Sampradaya",
      "deity": "Lakshminarasimha (also Sharadamba, Sangameshwara, Heramba Ganapathi, Varadaanjaneya)",
      "currentHead": "Sri Narasimha Ashrama Swamiji (successor-designate: Vasudeva Sadashiva Ashrama Swamiji)",
      "currentHeadAsOf": "November 2024",
      "address": "Near Hangarakatte, Udupi district, Karnataka"
    },
    "highlights": [
      "Located at the meeting of the Sita and Swarna rivers",
      "Successor-designate chosen in Bengaluru in November 2024"
    ],
    "website": "http://balekudrushrimatha.org",
    "sources": [
      {
        "title": "Balekudru Shreematha - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Balekudru_Shreematha"
      }
    ]
  },
  "parampara/sumeru-matha": {
    "overview": "This is probably not a second physical institution but the 'Sumeru Matha' of the Urdhvamnaya, the fifth, 'upward' amnaya described in the Mathamnaya texts. There its kshetra is Kailasa, its acharya Ishvara, its deity Niranjana, its devi Maya and its sampradaya 'Kashi'. The next entry in the list, 'Paramatma Matha', is the sixth matha of the same texts, which supports this reading, though it is unconfirmed. The physical institution that claims the Sumeru seat is the Sumeru (Paduka) Matha at Kashi, listed separately.",
    "history": "The Mathamnaya-Mahanushasana verses published by the Dwarka Sharada Peetham give the Urdhvamnaya matha as Sumeru, with Kailasa as its kshetra and 'Manasa' as its tirtha. Scholars on the Advaita-l list caution that several differing texts go by the name 'Mathamnaya', and that the higher amnayas correspond to no earthly matha in the Advaita tradition.",
    "facts": {
      "lineage": "Urdhvamnaya (fifth amnaya) in the Mathamnaya texts; sampradaya 'Kashi'; acharya Ishvara",
      "deity": "Niranjana (deva), Maya (devi)",
      "address": "Kailasa (scriptural kshetra, not a physical place)"
    },
    "highlights": [
      "The fifth, 'upward' (Urdhvamnaya) matha of the Mathamnaya",
      "Kshetra given as Kailasa; tirtha 'Manasa'",
      "Its earthly counterpart is the Sumeru (Paduka) Matha at Kashi"
    ],
    "sources": [
      {
        "title": "Mathamnaya Mahanushasanam (Dwarka Sharada Peetham)",
        "url": "https://dwarakasharadapeetham.org/mathamnaya-mahanushasanam-%E0%A4%AE%E0%A4%A0%E0%A4%BE%E0%A4%AE%E0%A5%8D%E0%A4%A8%E0%A4%BE%E0%A4%AF-%E0%A4%AE%E0%A4%B9%E0%A4%BE%E0%A4%A8%E0%A5%81%E0%A4%B6%E0%A4%BE%E0%A4%B8%E0%A4%A8%E0%A4%AE/"
      },
      {
        "title": "[Advaita-l] Debate between Dwarka & Sumeru Shankaracharyas",
        "url": "https://www.advaita-vedanta.org/archives/advaita-l/2013-January/033896.html"
      },
      {
        "title": "Urdhvamnaya Kashi Sumeru or Paduka Matha (Shankara Sampradaya Kosha)",
        "url": "https://shankarasampradayakosh.org/2022/10/27/urdhvamnaya-kashi-sumeru-or-paduka-matha-1/"
      }
    ]
  },
  "parampara/paramatma-matha": {
    "overview": "In the Mathamnaya texts, 'Paramatma Matha' is the matha of the Atmamnaya, the sixth amnaya beyond the four cardinal and the Urdhvamnaya mathas. It is a scriptural or symbolic seat, and no physical institution by this name was found. The listed entry very likely refers to this textual matha, though that is not confirmed.",
    "history": "The Mathamnaya verses published by the Dwarka Sharada Peetham give its sampradaya as Sattvatosha, its pada as Yoga, its kshetra as Nabhah-sarovara, its deity as Paramahamsa, its devi as Manasi Maya, its acharya as Chetana and its tirtha as Triputi.",
    "facts": {
      "lineage": "Atmamnaya (sixth amnaya) in the Mathamnaya texts; sampradaya 'Sattvatosha'; acharya Chetana",
      "deity": "Paramahamsa (deva), Manasi Maya (devi)",
      "address": "Nabhah-sarovara (scriptural kshetra, not a physical place)"
    },
    "highlights": [
      "The sixth (Atmamnaya) matha of the Mathamnaya scheme",
      "A scriptural seat; no present-day institution found"
    ],
    "sources": [
      {
        "title": "Mathamnaya Mahanushasanam (Dwarka Sharada Peetham)",
        "url": "https://dwarakasharadapeetham.org/mathamnaya-mahanushasanam-%E0%A4%AE%E0%A4%A0%E0%A4%BE%E0%A4%AE%E0%A5%8D%E0%A4%A8%E0%A4%BE%E0%A4%AF-%E0%A4%AE%E0%A4%B9%E0%A4%BE%E0%A4%A8%E0%A5%81%E0%A4%B6%E0%A4%BE%E0%A4%B8%E0%A4%A8%E0%A4%AE/"
      },
      {
        "title": "[Advaita-l] Debate between Dwarka & Sumeru Shankaracharyas",
        "url": "https://www.advaita-vedanta.org/archives/advaita-l/2013-January/033896.html"
      }
    ]
  },
  "parampara/sumeru-matha-at-kasi": {
    "overview": "The Sumeru Matha in Benares (Kasi) is also known as the Paduka Matha. The reference text says it was under the royal patronage of the Maharaja of Benares and was headed by a Bengali danda-sannyasin. An appeal for funds to repair it stated that Adi Shankaracharya founded it during his stay in Kasi.",
    "history": "The tradition that Adi Shankaracharya founded the matha during his stay in Kasi comes from an appeal for its repair, which the reference text reports but does not confirm.",
    "facts": {
      "founded": "Traditionally attributed to Adi Shankaracharya (claim from a repair appeal)",
      "lineage": "Advaita; listed as being in the parampara of Adi Shankaracharya's disciples",
      "address": "Varanasi (Kasi/Benares), Uttar Pradesh",
      "deity": "Niranjaneshvara Mahadeva and Bhadrakali",
      "currentHead": "Swami Narendranand Saraswati, styled Kashi Sumeru Peethadheeshwar",
      "currentHeadAsOf": "2021"
    },
    "highlights": [
      "Also known as the Paduka Matha",
      "Under the patronage of the Maharaja of Benares",
      "Claims the Urdhvamnaya (fifth) seat of the Mathamnaya texts, a claim the four cardinal peethas do not accept"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      },
      {
        "title": "Urdhvamnaya Kashi Sumeru or Paduka Matha (Shankara Sampradaya Kosha)",
        "url": "https://shankarasampradayakosh.org/2022/10/27/urdhvamnaya-kashi-sumeru-or-paduka-matha-1/"
      },
      {
        "title": "Conversation with Kashi Sumeru Peethadheeshwar (Hindusthan Samachar, 2021)",
        "url": "https://www.hindusthansamachar.in/Encyc/2021/9/4/Conversation-with-Kashi-Sumeru-Peethadheeshwar-.php"
      }
    ]
  },
  "parampara/havyaka-matha": {
    "overview": "The source lists a \"Havyaka Matha\" without saying which institution it means. The Havyaka Brahmin community follows Adi Shankaracharya's Advaita and has two gurupithas: Shri Ramachandrapura Math at Hosanagara and Shri Sonda Swarnavalli Math near Sirsi, both in Karnataka. The source does not say which of these, if either, is meant.",
    "history": "Community accounts trace both gurupithas to Adi Shankaracharya in the 9th century. Ramachandrapura Math is said to have started near Gokarna and moved to Hosanagara in 1464. Swarnavalli is said to have begun at Dashashwamedha Ghat in Kashi and moved to its present site in 1556.",
    "facts": {
      "lineage": "Advaita (Havyaka community gurupithas in the Shankara tradition)"
    },
    "highlights": [
      "The Havyaka community has two Shankara-tradition gurupithas: Ramachandrapura (Hosanagara) and Swarnavalli (Sonda, Sirsi)",
      "The source does not say which institution it means"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57 (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      },
      {
        "title": "Havyaka Matha (havyak.org)",
        "url": "https://www.havyak.org/havyaka-matha"
      }
    ]
  },
  "parampara/koppala-matha": {
    "overview": "Two places fit the name. The more plausible for a Shankara-parampara matha is Koppa in Chikkamagaluru district, in the Malnad near Sringeri, close to Hariharapura, whose Sharada Lakshminarasimha Peetham on the Tunga is described as one of the oldest branches of Sringeri. That identification is likely but unconfirmed. The other candidate, Koppal in north Karnataka, is ancient Kopana, a Jain and Ashokan site with no documented Advaita matha.",
    "history": "Tradition holds that the Hariharapura math arose from Adi Shankaracharya's visit, when he installed a Sri Chakra and consecrated Sharadamba there. Koppal (Kopana Nagara) was known as 'Jaina Kashi' and has Ashokan minor rock edicts at Palkigundu and Gavimath.",
    "facts": {
      "lineage": "If Koppa/Hariharapura is meant, the Sringeri (Dakshinamnaya) line (unconfirmed)",
      "deity": "At Hariharapura: Sri Lakshminarasimha and Sri Sharada",
      "address": "Koppa, Chikkamagaluru district, Karnataka (likely; unconfirmed)"
    },
    "highlights": [
      "Koppa town takes its name from the Kopada Veerabhadra Swamy temple",
      "Koppal, ancient Kopana, is known for its many Jain basadis and its Ashokan edicts"
    ],
    "sources": [
      {
        "title": "Koppa, Chikmagalur – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Koppa,_Chikmagalur"
      },
      {
        "title": "Hariharapura – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Hariharapura"
      },
      {
        "title": "[Advaita-l] Sreemath Hariharapura (2011)",
        "url": "https://www.advaita-vedanta.org/archives/advaita-l/2011-April/027060.html"
      },
      {
        "title": "Koppal – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Koppal"
      },
      {
        "title": "Palkigundu and Gavimath, Koppal – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Palkigundu_and_Gavimath,_Koppal"
      }
    ]
  },
  "parampara/sri-sailam-matha": {
    "overview": "Srisailam today has a Shankara Math that is a branch of the Sringeri Sharada Peetham, next to the main (eastern) entrance of the Mallikarjuna temple. It may correspond to the Sri Sailam Matha in the list, but the source does not confirm the link, and the list may refer to an older, separate institution.",
    "history": "Abhinava Vidyatirtha, the 35th Sringeri Acharya, consecrated the branch's shrines to Sharadamba and Adi Shankaracharya in December 1967. After renovation, Bharati Tirtha, the 36th Acharya, consecrated the new complex on 16 November 2012.",
    "facts": {
      "lineage": "Present Shankara Math is a branch of Sringeri Sharada Peetham",
      "deity": "Sri Sharadamba and Sri Adi Shankaracharya",
      "address": "Sringeri Shankara Math, opp. Nandiniketan Guest House, Srisailam, Kurnool District, Andhra Pradesh 518101"
    },
    "highlights": [
      "Stands next to the Mallikarjuna temple entrance",
      "Shrines consecrated in 1967; new complex in 2012",
      "Guest house, function hall and yagashala"
    ],
    "sources": [
      {
        "title": "Srisailam – Sri Sringeri Sharada Peetham",
        "url": "https://www.srisharadapeetham.com/branches/andhra-pradesh/srisailam"
      }
    ]
  },
  "parampara/ramesvaram-matha": {
    "overview": "Rameswaram is the southern kshetra in the Amnaya texts, and Preceptors of Advaita singles out a 'Ramesvara Matha' in this list. Sringeri describes Rameswaram as the kshetra of its Dakshinamnaya peetham and runs a Sringeri Shankara Math there; the Kanchi Kamakoti Peetham also runs a Sankara Matam at Agni Teertham. Which, if either, matches the listed matha is not confirmed.",
    "history": "In February 2021 a Sphatika linga worshipped at Sringeri was handed over at the Sringeri Shankara Math in Rameswaram and installed for daily worship in the Ramanathaswamy temple. Kanchi pontiffs have also repeatedly visited the town and performed abhisheka to Ramanatha.",
    "facts": {
      "address": "Rameswaram, Ramanathapuram district, Tamil Nadu"
    },
    "highlights": [
      "Named as the southern kshetra in the Amnaya texts",
      "Sringeri calls Rameswaram the kshetra of its Dakshinamnaya peetham",
      "Both Sringeri and Kanchi maintain Shankara maths in the town"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita ch. 57 (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      },
      {
        "title": "Sphatika Linga offered to Rameswaram temple – Sringeri",
        "url": "https://www.sringeri.net/events/sphatika-linga-offered-rameswaram-temple"
      },
      {
        "title": "Sri Kanchi Kamakoti Peetam Rameswaram",
        "url": "https://kamakoti.org/kamakoti/details/Sri%20Kanchi%20Kamakoti%20Peetam%20Rameswaram.html"
      }
    ]
  },
  "parampara/ghanagiri-matha": {
    "overview": "Ghanagiri (also Ghanadri) is an old name of Penukonda in Anantapur district, Andhra Pradesh, which became the Vijayanagara capital after the fall of Hampi, so this matha may have stood at Penukonda. No source found confirms a Shankara or Advaita matha there.",
    "facts": {
      "address": "Penukonda, Anantapur district, Andhra Pradesh (likely; unconfirmed)"
    },
    "highlights": [],
    "sources": [
      {
        "title": "Penukonda Fort, Anantapur (Trawell)",
        "url": "https://www.trawell.in/andhra/anantapur/penukonda-fort"
      }
    ]
  },
  "parampara/honnahalli-matha": {
    "overview": "The place has not been identified with confidence. The closest candidates are Honnali on the Tungabhadra in Davanagere district, Honnavalli in Tiptur taluk, and Honnavar on the Sharavati in Uttara Kannada, the Havyaka region whose gurupithas (Ramachandrapura and Swarnavalli) belong to the Shankara tradition. None of these places has a documented Shankara or Sringeri matha.",
    "history": "Honnali's name is said to come from 'honnarali', 'blossom of gold'. Honnavalli dates to the 11th century and was later under Vijayanagara and then Mysore rule.",
    "facts": {},
    "highlights": [
      "Honnali's well-known Raghavendra Swami Mutt is a Madhva, not an Advaita, institution",
      "Honnavalli has about 19 temples and the village goddess Honnavalli Amma"
    ],
    "sources": [
      {
        "title": "Honnali – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Honnali"
      },
      {
        "title": "Honnavalli – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Honnavalli"
      },
      {
        "title": "Honnavar – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Honnavar"
      }
    ]
  },
  "parampara/kaivalyapura-matha": {
    "overview": "This is likely the Shree Saunsthan Gaudapadacharya Math (Kavale Math) at Kavale, Ponda, Goa, the Advaita matha of the Gaud Saraswat Brahmins. The math's own history calls its original seat the 'Kaivalya Math', and a published history of it is titled 'Shree Gowdapadacharya samsthan kaivalyapur mahamuth'. The source list does not itself confirm the link.",
    "history": "Tradition says the math was founded by Gaudapada, or by his disciple Vivaranananda Saraswati, at Kushasthali near Keloshi (Quelossim) on the Gomati river. The Keloshi math was destroyed by the Portuguese in 1564; after its heads stayed for a time in Maharashtra and Varanasi, a new building was raised at Kavale in 1630 on land granted by the Sonde ruler.",
    "facts": {
      "founded": "Traditionally at Kushasthali/Keloshi, Goa (the math claims 499 BCE; unverified); rebuilt at Kavale in 1630",
      "lineage": "Gaudapada → Govinda Bhagavatpada → Adi Shankara line; 77 pontiffs claimed",
      "deity": "Bhavanishankar (Smarta panchayatana worship)",
      "currentHead": "Shivananda Saraswati Swami Gaudapadacharya (77th pontiff; ascended 2004)",
      "currentHeadAsOf": "October 2026",
      "address": "Shri Sansthan Gaudapadacharya Math, Kavale, Ponda, Goa 403401"
    },
    "highlights": [
      "Main matha of the Gaud Saraswat Brahmin Smartas",
      "Original Keloshi seat destroyed by the Portuguese in 1564",
      "Claims an unbroken line of 77 pontiffs"
    ],
    "website": "https://kavalemath.org/",
    "sources": [
      {
        "title": "Gaudapadacharya Math (Wikipedia)",
        "url": "https://en.wikipedia.org/wiki/Gaudapadacharya_Math"
      },
      {
        "title": "History – Kavale Math",
        "url": "https://kavalemath.org/about-us/history/"
      }
    ]
  },
  "parampara/mulabagalu-matha": {
    "overview": "This is likely the Mulabagal (Mulbagal) Math in Kolar district, Karnataka. According to Wikipedia's Dwarka Sharada Peetham article, it was a 17th-century branch of the Dwaraka (western, Paschimamnaya) matha. The source list does not itself confirm the identification, and no independent history of the Mulbagal institution was found.",
    "history": "Abhinava Sachchidananda Tirtha headed the Mulabagal Math before he was nominated to the Dwarka Sharada Peetham in 1945. When he took office at Dwarka, the Mulabagal lineage was merged into Dwarka's.",
    "facts": {
      "founded": "17th century (per Wikipedia; unverified)",
      "lineage": "Branch of Dwarka Sharada Peetham; merged into Dwarka in 1945",
      "address": "Mulbagal, Kolar district, Karnataka"
    },
    "highlights": [
      "Its last independent head, Abhinava Sachchidananda Tirtha, became Shankaracharya of Dwarka in 1945",
      "Lineage merged into the Dwarka Sharada Peetham"
    ],
    "sources": [
      {
        "title": "Dwarka Sharada Peetham (Wikipedia)",
        "url": "https://en.wikipedia.org/wiki/Dwarka_Sharada_Peetham"
      },
      {
        "title": "Preceptors of Advaita ch. 57 (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      }
    ]
  },
  "parampara/sirali-matha": {
    "overview": "Sirali (Shirali) in Bhatkal taluk, Uttara Kannada, is home to Shri Chitrapur Math, the guru-seat of the Chitrapur Saraswat Brahmin community. That community follows the Smarta tradition and Adi Shankara's Advaita Vedanta. This entry identifies the listed Sirali Matha with Chitrapur Math only because of the place name; the source text does not confirm the link.",
    "history": "The guru lineage began in 1708, when a Kashmiri ascetic was initiated at Gokarna as the first guru, Parijnanashram I. The headquarters moved to Shirali in 1757, after the mahasamadhi of the second guru, Shankarashram I.",
    "facts": {
      "founded": "1708 (lineage); seat at Shirali from 1757",
      "lineage": "Chitrapur Guru Parampara; Smarta, Advaita Vedanta",
      "deity": "Shri Bhavanishankar (a form of Shiva)",
      "currentHead": "Shri Sadyojat Shankarashram Swamiji (11th Mathadhipati, since 1997)",
      "currentHeadAsOf": "2023 (per Wikipedia)",
      "address": "Shirali, Bhatkal Taluk, Uttara Kannada district, Karnataka"
    },
    "highlights": [
      "Hodi Samadhi shrine of Shankarashram I at Shirali",
      "Received patronage and land grants from the Keladi Nayakas",
      "Revived Rathotsava and a museum of idols and manuscripts"
    ],
    "website": "http://www.chitrapurmath.net",
    "sources": [
      {
        "title": "Chitrapur Math (Wikipedia)",
        "url": "https://en.wikipedia.org/wiki/Chitrapur_Math"
      },
      {
        "title": "Preceptors of Advaita, ch. 57 (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      }
    ]
  },
  "parampara/gridhrapura-matha": {
    "overview": "'Gridhra' means vulture, so 'Gridhrapura' would be 'vulture town'. The strongest candidate, though unconfirmed, is Tirukalukundram in Chengalpattu district, Tamil Nadu, whose Tamil name means 'hill of the sacred kites' and which is famous for a pair of birds that were fed daily at the hill temple. No Shankara-tradition matha there has been documented.",
    "history": "The hilltop Vedagiriswarar (Shiva) temple is one of the 275 Paadal Petra Sthalams sung by the Nayanmar saints. Tradition holds that two sacred birds came at noon for centuries to be fed by the priest; those visits have stopped in recent decades.",
    "facts": {
      "deity": "Vedagiriswarar (Shiva) on the hill; Tripurasundari at the foothill",
      "address": "Tirukalukundram, Chengalpattu district, Tamil Nadu (likely; unconfirmed)"
    },
    "highlights": [
      "Also called Pakshi-theertham, 'the birds' holy tank'",
      "About 15 km from Mahabalipuram"
    ],
    "sources": [
      {
        "title": "Tirukalukundram – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Tirukalukundram"
      },
      {
        "title": "Vedagiriswarar Temple – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Vedagiriswarar_Temple"
      }
    ]
  },
  "parampara/nrisimhavadi-matha": {
    "overview": "The name most likely refers to Narsobawadi (Nrusinhawadi), a Datta pilgrimage town in Shirol taluka, Kolhapur district, Maharashtra, where the Panchganga joins the Krishna. The town is named after Sri Narasimha Saraswati (1378–1458), who took sannyasa in the Saraswati line that the Guru Charitra traces back to Adi Shankaracharya. The listed matha has not been confirmed as any present-day institution there.",
    "history": "Narasimha Saraswati, born Narahari at Karanja, took sannyasa at Kashi from Krishna Saraswati. Chapter 12 of the Guru Charitra gives Krishna Saraswati's guru line as Shankaracharya, Vishwarupa, Bharati Tirtha, Vidyaranya and others down to Yadavendra Saraswati. Tradition says Narasimha Saraswati lived at Narsobawadi for about 12 years (c. 1422–1434 CE) before moving to Ganagapur; in modern times Vasudevananda Saraswati (Tembe Swami) also stayed there for 12 years.",
    "facts": {
      "lineage": "Saraswati-order (Dashanami) sannyasa; the Guru Charitra traces it from Shankaracharya through Vidyaranya",
      "deity": "Sri Narasimha Saraswati as an avatara of Dattatreya, worshipped through his padukas",
      "address": "Narsobawadi (Nrusinhawadi), Shirol taluka, Kolhapur district, Maharashtra"
    },
    "highlights": [
      "The Datta mandir has no idol; worship centres on padukas commemorating Narasimha Saraswati's stay",
      "In the Dakshin Dwar ceremony, Krishna river water flows through the temple",
      "Datta Jayanti and Narasimha Jayanti are its major festivals"
    ],
    "sources": [
      {
        "title": "Narsobawadi – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Narsobawadi"
      },
      {
        "title": "Narasimha Saraswati – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Narasimha_Saraswati"
      },
      {
        "title": "Shri Guru Charitra, Chapter 12 (English tr.)",
        "url": "https://saibaba.us/texts/gurucharitra/chpt12.html"
      },
      {
        "title": "Shri Guru Charitra – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Shri_Guru_Charitra"
      }
    ]
  },
  "parampara/molavana-matha": {
    "overview": "Molavana Matha is known only by name. It is item 15 of 20 mathas that Mahavidvan Venkatachala Sarma listed in his Sanskrit introduction (bhumika) to the 1931 Venkatesvara Press, Bombay, edition of Shankara's Brahma Sutra commentary (Sariraka-mimamsa-bhashya). The name reads like a Sanskrit place name ending in '-vana' (forest or grove), but the place has not been identified, and no record says whether the matha still exists.",
    "history": "Venkatachala Sarma gave the list under the heading 'Sri Sankaracharyadividya-dharma-pithadhipa-paramparagatamathah', meaning mathas that came down in the line of the pontiffs of Shankara's seats. Preceptors of Advaita (ch. 57) reproduces the list but adds no details for this entry.",
    "facts": {
      "lineage": "Listed among the mathas in the line of the pontiffs of Shankara's seats (1931 bhumika); parent peetha not stated"
    },
    "highlights": [
      "Listed between Nrisimhavadi Matha and Paitana Matha; the source gives the name only",
      "The list's compiler, Venkatachala Sarma, came from a family of Mysore court scholars (Dharmadhikaris)"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      },
      {
        "title": "Preceptors of Advaita 57: Sri Sankara and Sankarite Institutions (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      }
    ]
  },
  "parampara/paitana-matha": {
    "overview": "The name most likely points to Paithan, ancient Pratishthana, on the Godavari in Chhatrapati Sambhajinagar (Aurangabad) district, Maharashtra. For centuries it was one of India's major centres of Sanskrit and shastric learning. Its link to a matha in Shankara's parampara is unconfirmed.",
    "history": "Pratishthana was the capital of the first Satavahana king, Simuka. Scholarship counts Paithan with Varanasi, Pune and Kanchipuram as centres of Sanskrit learning and debate until the colonial era, and the Marathi Brahmin families prominent in Benares scholarship kept close ties to it. In hagiography, the young Jnaneshwar and his siblings went to the Brahmins of Paithan to seek acceptance.",
    "facts": {
      "address": "Paithan, Chhatrapati Sambhajinagar district, Maharashtra (likely; unconfirmed)"
    },
    "highlights": [
      "Home town and samadhi place of Sant Eknath (c. 1533–1600), author of the Eknathi Bhagavata, whose teaching combined Advaita Vedanta and bhakti",
      "A moksha-tirtha that draws large crowds at the annual Nath Shashti yatra"
    ],
    "sources": [
      {
        "title": "Paithan – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Paithan"
      },
      {
        "title": "Sanskrit – Wikipedia (centres of learning)",
        "url": "https://en.wikipedia.org/wiki/Sanskrit"
      },
      {
        "title": "Eknath – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Eknath"
      },
      {
        "title": "Dnyaneshwar – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Dnyaneshwar"
      }
    ]
  },
  "parampara/kasi-matha": {
    "overview": "This most likely refers to a matha in Kashi (Varanasi), the city where tradition says Adi Shankara composed the Manisha Panchakam. The same list separately names the 'Sumeru Matha at Kasi', so this is a different foundation, and which institution it means is unconfirmed. Today Kashi has branches of both the Sringeri and Kanchi peethams and is the headquarters of the Juna Akhara of Dashanami sannyasis.",
    "history": "Advaita tradition holds that Shankara wrote the Manisha Panchakam at Varanasi after meeting a chandala on his way to the Vishwanath temple. An appeal quoted in Preceptors of Advaita says that during his stay at Kasi the Acharya founded the Sumeru (Paduka) Matha, which is listed separately.",
    "facts": {
      "deity": "Kashi Vishwanath (Shiva), the city's presiding deity",
      "address": "Varanasi (Kashi), Uttar Pradesh"
    },
    "highlights": [
      "Advaita tradition says Shankara composed the Manisha Panchakam at Kashi",
      "The Sringeri Sharada Peetham has Varanasi branches at Kedar Ghat and Mahamoor Ganj; the Kanchi Kamakoti Sankara Matam is at Hanuman Ghat",
      "The Juna Akhara, a Dashanami akhara whose tradition credits Adi Shankaracharya with organising it, has its head office at Hanuman Ghat"
    ],
    "sources": [
      {
        "title": "Manisha Panchakam – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Manisha_Panchakam"
      },
      {
        "title": "Sringeri – Varanasi branches",
        "url": "https://www.sringeri.net/branches/uttar-pradesh/varanasi"
      },
      {
        "title": "Sri Kanchi Kamakoti Peetam – Varanasi branch",
        "url": "https://www.kamakoti.org/kamakoti/details/Sri%20Kanchi%20Kamakoti%20Peetam%20Kasi.html"
      },
      {
        "title": "Juna Akhara – Incredible India",
        "url": "https://www.incredibleindia.gov.in/en/uttar-pradesh/varanasi/juna-akhara"
      },
      {
        "title": "Preceptors of Advaita 57 – Sri Sankara and Sankarite institutions (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      }
    ]
  },
  "parampara/tirtharajapura-matha": {
    "overview": "'Tirtharaja' (king of tirthas) is the classical epithet of Prayag, now Prayagraj, at the Triveni Sangam; the Puranas, including the Agni Purana, call it 'Tirtha Raj'. 'Tirtharajapura' therefore most likely means a matha at Prayag, though no institution by that name is documented. Prayag has a key place in Shankara's life story, and the Kanchi peetham now runs a large shrine at the Sangam.",
    "history": "The Madhaviya Shankara Digvijaya says Shankara went to Prayag to meet Kumarila Bhatta, whom he found already standing in a husk fire as penance; Kumarila sent him on to Mandana Mishra. The Adi Shankara Vimana Mandapam at the Sangam was consecrated in 1986 under Chandrasekharendra Saraswati of Kanchi, and the Kanchi peetham has managed it since.",
    "facts": {
      "deity": "At the Vimana Mandapam: Kamakshi, Venkateswara (Balaji) and a Sahasralingam on its three levels",
      "address": "Prayagraj (Prayag), Uttar Pradesh"
    },
    "highlights": [
      "The Puranas call Prayag 'Tirtha Raj', the king of pilgrimage sites",
      "In the Shankara Digvijaya, Shankara meets Kumarila Bhatta at Prayag",
      "The Kanchi-run Adi Shankara Vimana Mandapam (consecrated 1986) stands over the Ganga at the Sangam"
    ],
    "sources": [
      {
        "title": "Prayagraj – Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Prayagraj"
      },
      {
        "title": "Abridged Madhaviya Shankara Digvijayam, Part 3 (sringeri.net)",
        "url": "https://www.sringeri.net/history/sri-adi-shankaracharya/biography/abridged-madhaviya-shankara-digvijayam/part-3"
      },
      {
        "title": "Adi Shankara Vimana Mandapam, Prayagraj (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/details/AdiShankaraVimanaMandapam-Prayagraj.html"
      }
    ]
  },
  "parampara/gangotri-matha": {
    "overview": "Listed in Venkatachala Sarma's bhumika among the mathas in the lineage of Shankara. The reference text quotes the 1894 publication Light of the East, which says Shankara \"founded a Mutt at Gangotri on the slopes of the Himalayas besides the Joshi Mutt.\" No present-day institution by this name could be identified from reliable sources.",
    "history": "An 1894 account in Light of the East attributes the matha's founding to Adi Shankaracharya, in addition to the Jyotir (Joshi) Math.",
    "facts": {
      "founded": "Attributed to Adi Shankaracharya (per Light of the East, 1894)",
      "lineage": "Listed as being in the parampara of Adi Shankaracharya's disciples",
      "address": "Gangotri, on the slopes of the Himalayas (Uttarakhand)"
    },
    "highlights": [
      "Said to have been founded on the slopes of the Himalayas",
      "Named alongside the Joshi (Jyotir) Math in an 1894 account"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57 (Wisdom Library)",
        "url": "https://www.wisdomlib.org/hinduism/book/preceptors-of-advaita/d/doc62919.html"
      }
    ]
  },
  "parampara/tirthahalli-matha": {
    "overview": "Tirthahalli is a taluk town on the Tunga river in Shivamogga district, Karnataka. The Ramachandrapura Matha, the Havyaka Advaita matha that traces itself to Shankara, lists a branch matha at Tirthahalli, which may be the matha meant here, though that is unconfirmed.",
    "facts": {
      "lineage": "Possibly a branch of Sri Ramachandrapura Matha (unconfirmed)",
      "address": "Tirthahalli, Shivamogga district, Karnataka"
    },
    "highlights": [],
    "sources": [
      {
        "title": "ಶ್ರೀ ರಾಮಚಂದ್ರಾಪುರ ಮಠ (Kannada Wikipedia)",
        "url": "https://kn.wikipedia.org/wiki/%E0%B2%B6%E0%B3%8D%E0%B2%B0%E0%B3%80_%E0%B2%B0%E0%B2%BE%E0%B2%AE%E0%B2%9A%E0%B2%82%E0%B2%A6%E0%B3%8D%E0%B2%B0%E0%B2%BE%E0%B2%AA%E0%B3%81%E0%B2%B0_%E0%B2%AE%E0%B2%A0"
      }
    ]
  },
  "puri/sankarananda-matha": {
    "overview": "Sankarananda Matha is a Shaiva monastery of the Dandi sannyasi tradition at Puri, Odisha, near Swargadwar. It is one of the Sankaracharya-affiliated mathas that hold recorded rights in the Jagannath temple. Its swami is described as vice-president of the Mukti-mantapa-Sabha, the temple's council of learned Brahmins, over which the Shankaracharya of Govardhana Matha presides.",
    "history": "According to the Shri Jagannath Temple Record of Rights, the matha was allotted ovens in the temple kitchen and a storehouse (saraghara) in the temple. A branch of the matha in Old Town, Bhubaneswar, names Sankara Sivananda Saraswati as its founder.",
    "facts": {
      "lineage": "Shaiva / Dandi sannyasi (Sankaracharya-affiliated)",
      "address": "Near Swargadwar, Puri, Odisha"
    },
    "highlights": [
      "Its swami is vice-president of the Mukti-mantapa-Sabha of the Jagannath temple",
      "Holds ovens in the Jagannath temple kitchen and a temple storehouse under the Record of Rights",
      "Has a branch matha on the southern embankment of Bindusagar, Old Town, Bhubaneswar"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "The Mathas of Puri, Orissa Review, July 2005 (Prafulla Pattnaik)",
        "url": "https://magazines.odisha.gov.in/orissareview/jul2005/engpdf/mathas_of_puri.pdf"
      },
      {
        "title": "Role of the Mathas in the Daily Rituals of Lord Jagannath, Orissa Review, June 2004 (Bhaskar Mishra)",
        "url": "https://magazines.odisha.gov.in/orissareview/jun2004/englishpdf/role%20of%20mathas.pdf"
      },
      {
        "title": "Sankarananda Matha (Bhubaneswar branch), Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Sankarananda_Matha"
      }
    ]
  },
  "puri/sivatirtha-matha": {
    "overview": "Sivatirtha Matha is an Advaita monastery at Puri, Odisha, and one of the sannyasin-headed mathas connected with the Sankaracharya tradition that have recorded roles in the Jagannath temple. Odisha government publications list it as an Advaita matha and say it supplies the tooth-stick (datuna) used in the deity's rituals.",
    "history": "Palm-leaf records cited in the Kamakoti account say Puri's rulers granted royal honours to this matha and three others. Under the temple Record of Rights, a temple storehouse (saraghara) is recorded in its name.",
    "facts": {
      "lineage": "Advaita (Sankaracharya-affiliated, headed by sannyasins)",
      "address": "Puri, Odisha"
    },
    "highlights": [
      "Supplies the tooth-stick (datuna) for Lord Jagannath",
      "Holds a temple storehouse under the Jagannath Temple Record of Rights"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "The Role of Mathas at Puri in the Culture of Lord Jagannath, Orissa Review, July 2008 (Bhagaban Mahapatra)",
        "url": "https://magazines.odisha.gov.in/Orissareview/2008/July-2008/engpdf/75_The_Role_of_Mathas.pdf"
      },
      {
        "title": "The Mathas of Puri, Orissa Review, July 2005 (Prafulla Pattnaik)",
        "url": "https://magazines.odisha.gov.in/orissareview/jul2005/engpdf/mathas_of_puri.pdf"
      },
      {
        "title": "Role of the Mathas in the Daily Rituals of Lord Jagannath, Orissa Review, June 2004 (Bhaskar Mishra)",
        "url": "https://magazines.odisha.gov.in/orissareview/jun2004/englishpdf/role%20of%20mathas.pdf"
      }
    ]
  },
  "puri/gopalatirtha-matha": {
    "overview": "Gopalatirtha (Gopal Tirtha) Matha is an Advaita monastery at Puri, Odisha, headed by sannyasins and connected with the Sankaracharya tradition. It is best known for its festival services in the Jagannath temple, above all the Hati Vesha (elephant attire) of the deities at Snana Purnima.",
    "history": "Palm-leaf records cited in the Kamakoti account say Puri's rulers granted royal honours to this matha and three others. Odisha government and press accounts say it supplies items for the deities' Hati Vesha together with Rathavadas Matha, and that it offers bhogas during the Ratha Yatra season.",
    "facts": {
      "lineage": "Advaita (Sankaracharya-affiliated, headed by sannyasins)",
      "address": "Puri, Odisha"
    },
    "highlights": [
      "Provides the Hati Vesha (elephant attire) for Lord Balabhadra",
      "Its khichdi bhog is offered to the deities on the day of Shri Gundicha",
      "Supplies Puri, Sola and Mahana bhoga for the Suna Vesha"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "The Role of Mathas at Puri in the Culture of Lord Jagannath, Orissa Review, July 2008 (Bhagaban Mahapatra)",
        "url": "https://magazines.odisha.gov.in/Orissareview/2008/July-2008/engpdf/75_The_Role_of_Mathas.pdf"
      },
      {
        "title": "The Mathas of Puri, Orissa Review, July 2005 (Prafulla Pattnaik)",
        "url": "https://magazines.odisha.gov.in/orissareview/jul2005/engpdf/mathas_of_puri.pdf"
      },
      {
        "title": "Mathas Play A Crucial Role In Rath Yatra, OdishaBytes (11 July 2018)",
        "url": "https://odishabytes.com/mathas-play-crucial-role-ratha-yatra/"
      }
    ]
  },
  "puri/mahiprakasa-matha": {
    "overview": "Mahiprakasa (Mahiprakash) Matha is a Brahmachari matha at Puri, Odisha, and one of four Sankaracharya-affiliated mathas there, alongside Sankarananda, Sivatirtha and Gopalatirtha. Unlike the other three, which are headed by sannyasins, it is a brahmachari institution. Under the temple Record of Rights it has recorded service rights in the Jagannath temple.",
    "history": "Palm-leaf records cited in the Kamakoti account say Raja Bir Kishore Dev allowed the pandits and brahmacharis of these mathas to approach the Ratna-simhasana on certain occasions. The temple Record of Rights allots this matha ovens in the temple kitchen and a storehouse.",
    "facts": {
      "lineage": "Brahmachari (Sankaracharya-affiliated)",
      "address": "Puri, Odisha"
    },
    "highlights": [
      "A brahmachari matha rather than a sannyasi matha",
      "Supplies the tooth-stick (datuna) for Lord Jagannath",
      "Holds kitchen ovens and a storehouse under the Jagannath Temple Record of Rights"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "The Role of Mathas at Puri in the Culture of Lord Jagannath, Orissa Review, July 2008 (Bhagaban Mahapatra)",
        "url": "https://magazines.odisha.gov.in/Orissareview/2008/July-2008/engpdf/75_The_Role_of_Mathas.pdf"
      },
      {
        "title": "Role of the Mathas in the Daily Rituals of Lord Jagannath, Orissa Review, June 2004 (Bhaskar Mishra)",
        "url": "https://magazines.odisha.gov.in/orissareview/jun2004/englishpdf/role%20of%20mathas.pdf"
      },
      {
        "title": "The Mathas of Puri, Orissa Review, July 2005 (Prafulla Pattnaik)",
        "url": "https://magazines.odisha.gov.in/orissareview/jul2005/engpdf/mathas_of_puri.pdf"
      }
    ]
  },
  "kasi/brahmendra-mutt": {
    "overview": "Brahmendra Mutt (Brahmendra Math) is a monastery at Shivala Ghat on the Ganga in Varanasi. A local account of the ghats says the Kashiraj, the ruler of Benares, established a Shiva temple and the Brahmendra Math at the ghat. An 1884 inscription in the mutt sets out a line of teachers running from Shankara.",
    "history": "According to the Kamakoti account, the 1884 inscription traces a line of teachers from Shankara to a Chandrasekhara. It also refers to a mutt called the Indramatha ('divyam indramathabhidham').",
    "facts": {
      "lineage": "Advaita; inscription traces a lineage from Shankara",
      "address": "Shivala Ghat, Varanasi, Uttar Pradesh"
    },
    "highlights": [
      "1884 inscription in the mutt records a guru lineage from Shankara",
      "Associated with the name Indramatha",
      "Said to have been established, with a Shiva temple, by the Kashiraj"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "Ghats of Varanasi, IndiaNetzone",
        "url": "https://www.indianetzone.com/44/ghats_varanasi.htm"
      }
    ]
  },
  "kasi/sumeru-matha": {
    "overview": "Sumeru Matha, also called Paduka Matha, is an Advaita monastery in Kashi (Varanasi) that has had the royal patronage of the Maharaja of Benares. An appeal for repair funds issued by the matha states that Shankara established it during his stay in Kashi. Its head uses the title Sumeru Peethadhishwar, a claim to Shankaracharya status that others in the tradition dispute.",
    "history": "In the mid-20th century, according to the Kamakoti account, it was presided over by a Bengali dandi-sannyasin. In 2008 its head was reported as Sumerupeethadhishwar Swami Narendranand Saraswati.",
    "facts": {
      "lineage": "Dandi sannyasi (Advaita)",
      "currentHead": "Swami Narendranand Saraswati, styled Kashi Sumeru Peethadheeshwar",
      "currentHeadAsOf": "2021",
      "address": "Varanasi (Kashi), Uttar Pradesh",
      "deity": "Niranjaneshvara Mahadeva and Bhadrakali"
    },
    "highlights": [
      "Also known as Paduka Matha",
      "Royal patronage of the Maharaja of Benares",
      "Claims the Urdhvamnaya (fifth) seat of the Mathamnaya texts, a claim the four cardinal peethas do not accept"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "Swami Narendranand Saraswati on indefinite fast on Amarnath issue, Organiser (31 Aug 2008)",
        "url": "https://organiser.org/2008/08/31/38310/general/r05dfcf90/"
      },
      {
        "title": "Urdhvamnaya Kashi Sumeru or Paduka Matha (Shankara Sampradaya Kosha)",
        "url": "https://shankarasampradayakosh.org/2022/10/27/urdhvamnaya-kashi-sumeru-or-paduka-matha-1/"
      },
      {
        "title": "Conversation with Kashi Sumeru Peethadheeshwar (Hindusthan Samachar, 2021)",
        "url": "https://www.hindusthansamachar.in/Encyc/2021/9/4/Conversation-with-Kashi-Sumeru-Peethadheeshwar-.php"
      }
    ]
  },
  "kasi/omkar-math": {
    "overview": "Omkar Math is a Dandi sannyasi matha in Benares (Varanasi). It is known mainly because its head was the first signatory of a public appeal for funds to repair Kashi's Sumeru (Paduka) Matha, which tradition says Adi Shankaracharya founded. No present-day address or head could be found.",
    "history": "The appeal's first signatory was 'Srimat Ramesvarananda Tirth Dandi, Omkar Math, Benares'. The appeal is quoted in mid-20th-century sources, but its exact date is not given.",
    "facts": {
      "lineage": "Dandi sannyasa, Tirtha order (Shankara tradition)",
      "currentHead": "Srimat Ramesvarananda Tirtha (head at the time of the appeal; historical)",
      "currentHeadAsOf": "mid-20th century",
      "address": "Varanasi (Benares), Uttar Pradesh"
    },
    "highlights": [
      "Its head was the first signatory of the appeal to repair Kashi's Sumeru Matha"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita 57 – Sri Sankara and Sankarite Mathas (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "Sri Sankaracharya's connection with Varanasi – 2 (Śāṅkara Sampradaya Kośaḥ)",
        "url": "https://shankarasampradayakosh.org/2022/10/31/sri-sankaracharyas-connection-with-varanasi-2/"
      }
    ]
  },
  "kasi/guru-dattatreya-math": {
    "overview": "Guru Dattatreya Math is a sannyasi matha in Benares whose head signed the appeal to repair Kashi's Sumeru Matha. It is probably, but not certainly, the Dattatreya Math at Narada Ghat, which the Varanasi Heritage Dossier says was built around 1888, together with a Dattatreyeshvara temple, by a South Indian monastery head, Svami Sativedananda Dattatreya.",
    "history": "Around 1888 Svami Sativedananda Dattatreya built works at Narada Ghat, including the Dattatreyeshvara temple and a Dattatreya Math.",
    "facts": {
      "founded": "c. 1888 (if it is the Narada Ghat Dattatreya Math; unconfirmed)",
      "lineage": "Saraswati order sannyasa (Shankara tradition)",
      "deity": "Dattatreyeshvara (Shiva), Narada Ghat",
      "currentHead": "Srimat Dattatreyananda Sarasvati (head at the time of the appeal; historical)",
      "currentHeadAsOf": "mid-20th century",
      "address": "Narada Ghat, Varanasi, Uttar Pradesh (probable)"
    },
    "highlights": [
      "Its head was the second signatory of the appeal to repair Kashi's Sumeru Matha",
      "Probably the Dattatreya Math at Narada Ghat, built around 1888"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita 57 – Sri Sankara and Sankarite Mathas (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "The Varanasi Heritage Dossier/Narada Ghat – Wikiversity",
        "url": "https://en.wikiversity.org/wiki/The_Varanasi_Heritage_Dossier/Narada_Ghat"
      }
    ]
  },
  "kasi/sukadeva-matha": {
    "overview": "According to Kanchi-tradition sources, Sukadeva Matha is the Kanchi Kamakoti Peetham's branch at Hanuman Ghat in Kashi (Varanasi); old title records of Kanchi Matha estates describe it as run by a mahant who was a sannyasi disciple. The Urdhvamnaya texts name Sukadeva as one of the brahmacharis of the Sumeru peetha, but any connection between that Amnaya and this matha is unclear.",
    "history": "Old title records of the Vanjiyur Sri Viswanatha Swamy Devasthanam estates refer to the Kanchi Matha's Kashi branch at Hanuman Ghat as Sukadeva Matha. The present Kanchi matam there houses the Sri Kamakoteeswar temple.",
    "facts": {
      "lineage": "Kanchi Kamakoti Peetham (branch matha)",
      "deity": "Sri Kamakoteeswar",
      "address": "B 4/7, Hanuman Ghat, Varanasi 221001"
    },
    "highlights": [
      "Recorded as the Kanchi Kamakoti Peetham's branch at Hanuman Ghat",
      "Houses the Sri Kamakoteeswar temple"
    ],
    "sources": [
      {
        "title": "Sri Sankaracharya's connection with Varanasi – 2 (Śāṅkara Sampradaya Kośaḥ)",
        "url": "https://shankarasampradayakosh.org/2022/10/31/sri-sankaracharyas-connection-with-varanasi-2/"
      },
      {
        "title": "Sri Kanchi Kamakoti Peetam Varanasi (kamakoti.org)",
        "url": "https://www.kamakoti.org/kamakoti/details/Sri%20Kanchi%20Kamakoti%20Peetam%20Kasi.html"
      }
    ]
  },
  "kerala/tirukkekkat-madam": {
    "overview": "Tirukkekkat (Thrikkaikkattu) Madam is a Nambudiri sannyasi madam that, by tradition, originally stood in Thrissur as one of the four madhoms traced to Shankara's direct disciples. Community history says it is the former Edayil (Idayil) Madhom, which moved out of Thrissur and was afterwards known as Thrikkaikkattu Madhom. A Thrikkaikkattu Madhom at Thirunakkara, Kottayam, now hosts a Vedic school (Vaidika Vidyapeedham).",
    "history": "A head (Mooppil Swamiyar) of Edayil Madhom was persuaded to move the madhom to Thrikkaikkattu, in territory under the Samoothiri (Zamorin) of Kozhikode, and its Thrissur premises passed to Thekke Madhom. A junior swamiyar of Thrikkaikkattu Madhom was later involved in founding the Munchira Madhom in present-day Kanyakumari district.",
    "facts": {
      "lineage": "Nambudiri sannyasi (Advaita); one of the four Thrissur madhoms traced to Shankara's disciples",
      "address": "Thirunakkara, Kottayam, Kerala (Thrikkaikkattu Madhom)"
    },
    "highlights": [
      "Originally the Edayil Madhom of Thrissur, according to Namboothiri community history",
      "A junior swamiyar helped establish the Munchira Madhom",
      "Hosts a Vaidika Vidyapeedham at Thirunakkara, Kottayam"
    ],
    "sources": [
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "Brahmaswom and Swaamiyaar Madhoms, Namboothiri Websites",
        "url": "https://namboothiri.com/articles/madhoms.htm"
      },
      {
        "title": "Yathi Sevaa Sangham, Namboothiri Websites",
        "url": "https://namboothiri.com/articles/yathisevaasangham.htm"
      }
    ]
  },
  "kerala/naduvile-central-madam": {
    "overview": "Naduvil Madhom (the 'Middle' or Central Madhom) is one of the four ancient Advaita madhoms in Thrissur, Kerala, headed by Nambudiri sannyasins. Tradition traces its origin to Sureshvara, a direct disciple of Shankara, who is said to have appointed Vilvamangalathu Swamiyar as its first head (Mooppil Swamiyar). Although its swamiyars are Advaitins, the madhom's guardian deity is Krishna as Parthasarathy.",
    "history": "Tradition places its origin in the 9th century CE. Seniority among its swamiyars depends on the number of Chaturmasya vratas observed, not on age. With Munchira Madhom, it traditionally held the right to perform Pushpanjali to Sri Padmanabha at Thiruvananthapuram.",
    "facts": {
      "founded": "Traditionally 9th century CE, attributed to Sureshvara",
      "lineage": "Nambudiri sannyasi (Advaita); first head Vilvamangalathu Swamiyar",
      "deity": "Parthasarathy (Krishna)",
      "currentHead": "Maravanchery Thekkedathu Nilakanta Bharatikal",
      "currentHeadAsOf": "Head since June 2002",
      "address": "Thrissur, Kerala"
    },
    "highlights": [
      "Traditional Pushpanjali rights at the Sree Padmanabhaswamy Temple",
      "Owns and manages about forty temples in the Malabar region",
      "The Vilwamangalam Swamiyar of legend belonged to this madhom"
    ],
    "sources": [
      {
        "title": "Naduvil Madhom, Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Naduvil_Madhom"
      },
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      },
      {
        "title": "Brahmaswom and Swaamiyaar Madhoms, Namboothiri Websites",
        "url": "https://namboothiri.com/articles/madhoms.htm"
      },
      {
        "title": "Yathi Sevaa Sangham, Namboothiri Websites",
        "url": "https://namboothiri.com/articles/yathisevaasangham.htm"
      }
    ]
  },
  "kerala/brahmasva-madam": {
    "overview": "Brahmaswam Madhom, originally the Vadakke Madhom (Northern Monastery), stands in central Thrissur, Kerala. It was one of four monasteries in the city traditionally believed to have been established by Shankara's disciples. At least two centuries ago it became a vedapathashala (traditional Vedic school) run by Nambudiri Brahmins and focused on the Rigveda, and it is described as one of the oldest Vedic schools still running in India.",
    "history": "The last swamiyar of Vadakke Madhom dedicated its assets to a Vedic teacher to support the study of the Rigveda, which gave rise to the Brahmaswam Madhom at Thrissur. The Government managed it from 1915 to 1949. Since 2008 it has housed the Vedic Research Centre, which keeps a library and palm-leaf manuscripts.",
    "facts": {
      "founded": "Traditionally attributed to Shankara's disciples; a Vedic school for at least two centuries",
      "lineage": "Vadakke Madhom; Nambudiri Vedic (Rigveda) school",
      "address": "Vadakke Madhom compound, Thrissur, Kerala"
    },
    "highlights": [
      "Converted from the Vadakke Madhom into a Rigveda school",
      "Houses the Vadakke Madham Brahmaswam Vedic Research Centre (since 2008)",
      "Under government management from 1915 to 1949"
    ],
    "sources": [
      {
        "title": "Vatakke Matham Brahmasvam, Mittna Mana Collection (HMML)",
        "url": "https://hmml.org/collections/repositories/India/va%E1%B9%ADakke-ma%E1%B9%ADham-brahmasvam--m%C4%AB%E1%B9%AFtna-mana-collection/"
      },
      {
        "title": "Brahmaswom and Swaamiyaar Madhoms, Namboothiri Websites",
        "url": "https://namboothiri.com/articles/madhoms.htm"
      },
      {
        "title": "Vadakke Madham Brahmaswam Vedic Research Centre, Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Vadakke_Madham_Brahmaswam_Vedic_Research_Centre"
      },
      {
        "title": "Vadakke Madhom, Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Vadakke_Madhom"
      },
      {
        "title": "Preceptors of Advaita, ch. 57: Sri Sankara and Sankarite Institutions (Kamakoti)",
        "url": "https://www.kamakoti.org/kamakoti/articles/Preceptors%20of%20Advaita%20-%2057.html"
      }
    ]
  },
};
