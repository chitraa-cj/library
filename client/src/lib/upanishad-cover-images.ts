import { UPANISHAD_COVER_STEMS } from "@/lib/upanishad-cover-manifest";

const COVER_BASE = "/images/upanishads";

/** Slug/title → filename stem(s) under public/images/upanishads/{stem}.png */
const SLUG_COVER_STEMS: Record<string, string[]> = {
  // Principal (classical ten)
  "ishavasya-upanishad": ["isha", "ishavasya"],
  "isha-upanishad-bhashya": ["isha", "ishavasya"],
  "kena-upanishad-": ["kena"],
  "kenopanishad-padabhashyam": ["kenopanishad-padabhashyam", "kena"],
  kathopanishad: ["katha"],
  "katha-upanishad-bhashya": ["katha"],
  "prashna-upanishad-": ["prashna"],
  "mundaka-upanishad-": ["mundaka"],
  "mandukya-upanishad": ["mandukya"],
  "aitareya-upanishad": ["aitareya"],
  "taittariya-upanishad-": ["taittiriya", "taittariya"],
  "chandogya-upanishad": ["chandogya"],
  "brihadaranyaka-upanishad": ["brihadaranyaka"],

  // Other Upanishads in catalog
  "atharvashira-upanishad": ["atharvashira"],
  "atharvashika-upanishad": ["atharvashika"],
  "amritha-nadopanishad": ["amritha-nadu", "amritha-nadopanishad"],
  "amritha-bindu-upanishad": ["amritha-bindu", "amritha-bindu-upanishad"],
  "kaivalya-upanishad": ["kaivalya"],
  aatmopanishad: ["aatmopanishad", "atma"],
  "shvetashvatara-upanishad": ["shvetashvatara"],
  "kaushithaki-upanishad": ["kaushithaki"],
  "aarunya-upanishad": ["aarunya"],
};

const TITLE_STEM_HINTS: { pattern: RegExp; stems: string[] }[] = [
  { pattern: /\bishavasya\b|\bīśa\b|\bisha\b/i, stems: ["isha", "ishavasya"] },
  { pattern: /\bkena\b|\bkenopanishad\b/i, stems: ["kena", "kenopanishad-padabhashyam"] },
  { pattern: /\bkatha\b|\bkathopanishad\b/i, stems: ["katha"] },
  { pattern: /\bprashna\b|\bpraśna\b/i, stems: ["prashna"] },
  { pattern: /\bmundaka\b|\bmuṇḍaka\b/i, stems: ["mundaka"] },
  { pattern: /\bmandukya\b|\bmāṇḍūkya\b/i, stems: ["mandukya"] },
  { pattern: /\baitareya\b/i, stems: ["aitareya"] },
  { pattern: /\btaittiriya\b|\btaittarīya\b/i, stems: ["taittiriya", "taittariya"] },
  { pattern: /\bchandogya\b|\bchāndogya\b/i, stems: ["chandogya"] },
  { pattern: /\bbrihadaranyaka\b|\bṛhadāraṇyaka\b/i, stems: ["brihadaranyaka"] },
  { pattern: /\batharvashira\b/i, stems: ["atharvashira"] },
  { pattern: /\batharvashika\b/i, stems: ["atharvashika"] },
  { pattern: /\bamritha\s*nadu\b|\bamritanada\b/i, stems: ["amritha-nadu"] },
  { pattern: /\bamritha\s*bindu\b|\bamritabindu\b/i, stems: ["amritha-bindu"] },
  { pattern: /\bkaivalya\b/i, stems: ["kaivalya"] },
  { pattern: /\baatmo|ātma\b/i, stems: ["aatmopanishad", "atma"] },
  { pattern: /\bshvetashvatara\b|\bśvetāśvatara\b/i, stems: ["shvetashvatara"] },
  { pattern: /\bkaushitaki\b|\bkauṣītaki\b/i, stems: ["kaushithaki"] },
  { pattern: /\baarunya\b|\bāruṇya\b/i, stems: ["aarunya"] },
];

function isUpanishadCategory(category: string | null | undefined): boolean {
  const c = (category || "").toLowerCase();
  return c === "upanishad" || c === "upanishad bhashya";
}

function slugStemCandidates(slug: string): string[] {
  const s = slug.toLowerCase().trim();
  const keys: string[] = [];

  if (SLUG_COVER_STEMS[s]) keys.push(...SLUG_COVER_STEMS[s]);

  const withoutSuffix = s
    .replace(/-?upanishad-*$/i, "")
    .replace(/-bhashya.*$/i, "")
    .replace(/-+$/, "");
  if (withoutSuffix) keys.push(withoutSuffix);

  const first = s.split("-").find((part) => part && part !== "upanishad" && part !== "bhashya");
  if (first) keys.push(first);

  return keys;
}

function titleStemCandidates(title: string): string[] {
  const keys: string[] = [];
  for (const { pattern, stems } of TITLE_STEM_HINTS) {
    if (pattern.test(title)) keys.push(...stems);
  }
  return keys;
}

export function getUpanishadCoverStemCandidates(
  slug: string,
  title: string,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (stem: string) => {
    const k = stem.toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    ordered.push(k);
  };

  for (const stem of slugStemCandidates(slug)) add(stem);
  for (const stem of titleStemCandidates(title)) add(stem);

  return ordered;
}

export function resolveLocalUpanishadCover(
  slug: string,
  title: string,
): string | null {
  for (const stem of getUpanishadCoverStemCandidates(slug, title)) {
    if (UPANISHAD_COVER_STEMS.has(stem)) {
      return `${COVER_BASE}/${stem}.png`;
    }
  }
  return null;
}

/** Local bundled art takes precedence; then CMS coverImage from Strapi. */
export function resolveBookCoverImage(book: {
  slug?: string | null;
  title?: string | null;
  coverImage?: string | null;
  category?: string | null;
}): string | null {
  const slug = (book.slug || "").toLowerCase();
  const title = book.title || "";

  if (isUpanishadCategory(book.category) || slug.includes("upanishad")) {
    const local = resolveLocalUpanishadCover(slug, title);
    if (local) return local;
  }

  if (book.coverImage) return book.coverImage;
  return null;
}
