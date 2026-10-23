/**
 * The Advaita mutt (matha / madam) system, as listed in the supplied source
 * text. Static content — names and notes are kept as they appear in the source.
 */

export interface Mutt {
  name: string;
  /** Alternate names, shown in parentheses under the name. */
  aliases?: string;
  /** Short historical note from the source. */
  note?: string;
  /** Where the mutt is; also used for the "open in maps" link. */
  location?: string;
  /** Card image under /images/mutts (principal peethas only). */
  image?: string;
}

export type MuttSectionIcon = "peetha" | "additional" | "parampara" | "puri" | "kasi" | "kerala";

export interface MuttSection {
  id: string;
  title: string;
  description: string;
  icon: MuttSectionIcon;
  mutts: Mutt[];
}

export const MUTT_SECTIONS: MuttSection[] = [
  {
    id: "principal",
    title: "Principal Mutts (The Cardinal Peethas)",
    description:
      "The principal peethas established by Adi Shankaracharya, forming the spiritual and geographical foundation of the Advaita tradition.",
    icon: "peetha",
    mutts: [
      { name: "Sringeri Matha", aliases: "Sarada Peeth / Pitha", location: "Sringeri, Karnataka (Mysore)", image: "/images/mutts/sringeri.webp" },
      { name: "Kamakoti Pitha", aliases: "Sarvagna Peeta", location: "Kanchi / Kanchipuram, Tamil Nadu", image: "/images/mutts/kamakoti.webp" },
      { name: "Badari Matha", aliases: "Badrikasrama / Joshi Mutt / Jyotir-pitha", location: "North (Himalayas)", image: "/images/mutts/badari.webp" },
      { name: "Puri Matha", aliases: "Jagannath / Govardhana-pitha", location: "Puri, Odisha (East)", image: "/images/mutts/puri.webp" },
      { name: "Dwaraka Matha", aliases: "Sarada Matha / Pitha", location: "Dwaraka, Gujarat (West)", image: "/images/mutts/dwaraka.webp" },
      { name: "Kasi / Benares", note: "Five mutts were established here — four for disciples and one for himself.", location: "Kasi (Varanasi), Uttar Pradesh", image: "/images/mutts/kasi.webp" },
      { name: "Srinagar", note: "Mentioned as a “far-flung spiritual capital” by Dr. C.P. Ramaswami Iyer.", location: "Srinagar", image: "/images/mutts/srinagar.webp" },
    ],
  },
  {
    id: "additional",
    title: "Additional Mathas",
    description:
      "Listed under “Jagadguru Sankaracharya ka pitha aur upapitha”.",
    icon: "additional",
    mutts: [
      { name: "Kudali Matha", location: "Shimoga district, Mysore" },
      { name: "Sivaganga Matha" },
      { name: "Avani Matha", location: "Kolar District, Mysore" },
      { name: "Virupaksha Matha", location: "Hospet Taluk, Bellary District" },
      { name: "Pushpagiri Matha", location: "Cuddapah Taluk, Cuddapah District" },
      { name: "Sankesvara Karavira Matha", note: "Four branches mentioned: Poona, Sankesvara, Kolhapur and Satara." },
      { name: "Ramachandrapura Matha", location: "Hosanagara Taluk, Mysore State" },
      { name: "Hariharapura Matha", location: "Near Sringeri" },
      { name: "Bandigadi Matha" },
      { name: "Yadaniru Matha", location: "Kasargode Taluk, South Canara District" },
      { name: "Kodandarama Matha", location: "Hebbairu Village, Tumkur Taluk, Mysore State" },
      { name: "Svarnavalli Matha", location: "Sirsi Taluk, North Canara District" },
      { name: "Nelamavu Matha", location: "North Canara" },
      { name: "Yoga Narasimhasvami Matha", location: "Hole-Narasipur, Mysore State" },
      { name: "Balakuduru Matha", location: "Udipi Taluk, South Canara District" },
    ],
  },
  {
    id: "parampara",
    title: "Parampara Mathas",
    description:
      "Mathas from the lineage (parampara) of Shankaracharya’s disciples, listed in the Bhumika by Mahavidvan Venkatachala Sarma.",
    icon: "parampara",
    mutts: [
      { name: "Sumeru Matha" },
      { name: "Paramatma Matha" },
      { name: "Sumeru Matha at Kasi" },
      { name: "Havyaka Matha" },
      { name: "Koppala Matha" },
      { name: "Sri Sailam Matha" },
      { name: "Ramesvaram Matha" },
      { name: "Ghanagiri Matha" },
      { name: "Honnahalli Matha" },
      { name: "Kaivalyapura Matha" },
      { name: "Mulabagalu Matha" },
      { name: "Sirali Matha" },
      { name: "Gridhrapura Matha" },
      { name: "Nrisimhavadi Matha" },
      { name: "Molavana Matha" },
      { name: "Paitana Matha" },
      { name: "Kasi Matha" },
      { name: "Tirtharajapura Matha" },
      { name: "Gangotri Matha", note: "Also mentioned separately as founded on the slopes of the Himalayas." },
      { name: "Tirthahalli Matha" },
    ],
  },
  {
    id: "puri",
    title: "Mutts Specifically in Puri (Jagannath)",
    description:
      "Besides the main Govardhana Matha, other Sankaracharya-affiliated mathas in Puri whose members have special rights in the temple.",
    icon: "puri",
    mutts: [
      { name: "Sankarananda Matha", note: "Vice-President of the Mukti-mantapa-Sabha." },
      { name: "Sivatirtha Matha" },
      { name: "Gopalatirtha Matha" },
      { name: "Mahiprakasa Matha", note: "A Brahmachari Matha." },
    ],
  },
  {
    id: "kasi",
    title: "Mutts Specifically in Benares / Kasi",
    description: "Mathas in Benares / Kasi associated with the Advaita tradition.",
    icon: "kasi",
    mutts: [
      { name: "Brahmendra Mutt", aliases: "Indramatha", location: "Sivalaya Ghat, Kasi" },
      { name: "Sumeru Matha", aliases: "Paduka matha", note: "Under royal patronage of the Maharaja of Benares." },
      { name: "Omkar Math", note: "Mentioned in the signatories list." },
      { name: "Guru Dattatreya Math", note: "Mentioned in the signatories list." },
      { name: "Sukadeva Matha", note: "Mentioned as possibly connected to the Urdhvamnaya." },
    ],
  },
  {
    id: "kerala",
    title: "Mutts in Kerala (Trichur)",
    description:
      "Traditional Vedic centres said to be converted by Shankaracharya into his mathas, with his direct disciples as the first presidents.",
    icon: "kerala",
    mutts: [
      { name: "Tirukkekkat Madam", note: "A Nambudiri Sannyasi Madam." },
      { name: "Naduvile (Central) Madam" },
      { name: "Brahmasva Madam", note: "A Vedic Centre for Nambudiri Brahmins." },
    ],
  },
];

/** URL-safe id for a mutt name, e.g. "Kasi / Benares" → "kasi-benares". */
export const muttSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The page lives at /mutts; /mutts/<section> and /mutts/<section>/<mutt> deep-link
 * to a section or a single mutt (names repeat across sections, so both are kept).
 */
export const muttsPath = (sectionId?: string, muttName?: string) =>
  "/mutts" + (sectionId ? `/${sectionId}` : "") + (sectionId && muttName ? `/${muttSlug(muttName)}` : "");

export const PRINCIPAL_MUTTS = MUTT_SECTIONS[0];
