/**
 * Best-effort matching of a commentator/author name (as stored on a book) to an
 * acharya profile slug, so the name can link to its in-app bio page.
 *
 * Book metadata and the acharya profiles transliterate differently ("Sri
 * Shankarayacharya" vs "Śaṅkarācāryabhagavatpādaḥ", "Shankarananda" vs
 * "Śaṅkarānandaḥ"), and teeka entries often read "Work - Author"
 * ("Subodhini - Shreedharaswami"). Both sides are therefore reduced to a
 * transliteration-insensitive skeleton and scored; the best candidate wins only
 * if it clears THRESHOLD, so a near-miss ("Shankarananda" against Śaṅkara)
 * stays unlinked rather than pointing at the wrong bio. Returns undefined when
 * nothing matches confidently — callers then render plain (non-linked) text.
 */
export interface AcharyaNameRef {
  slug: string;
  name_iast: string;
  name_devanagari: string;
  name_display: string | null;
  /** Spellings the CMS links texts by — often the exact name a book carries. */
  aliases?: string[] | null;
}

/** Titles that appear on one side of a name only, so they must not decide a match. */
const HONORIFICS =
  /\b(sri|shri|sree|srimad|swami|swamin|bhagavan|bhagavatpada|bhagavatpadah|adi|yogindra|yogindrah|muni|saraswati|sarasvati|shastri|sastri|pandita|panditha|teeka|tika|bhashya|bhasya)\b/g;
/** The same titles glued onto the name, as IAST profile names write them
 *  ("Śaṅkarācāryabhagavatpādaḥ"). Spelled post-folding, hence "bagavatpada". */
const GLUED_TITLES = /(acaryah?|bagavatpadah?|vyakyah?)/g;

/**
 * Collapse a name to a comparable skeleton: diacritics dropped, then the common
 * transliteration variants folded together (ś/ṣ/sh → s, c/ch → c, v/w, ee → i).
 */
function skeleton(raw: string | null | undefined, stripTitles: boolean): string {
  let s = (raw || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (stripTitles) s = s.replace(HONORIFICS, " ");
  s = s
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/w/g, "v")
    // Aspirates are transcribed inconsistently ("Sadanandha" vs "Sadānandaḥ",
    // "Anubhutiswarupa" vs "Anubhūtisvarūpaḥ"), so fold them into the plain stop.
    .replace(/([kgjtdpb])h/g, "$1");
  s = s.replace(/[^a-z\s]/g, " ");
  if (stripTitles) s = s.replace(GLUED_TITLES, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** One word, no doubled letters, no trailing visarga — "dharmaraja adhvarin" → "dharmarajadhvarin". */
function compact(s: string): string {
  return s.replace(/\s+/g, "").replace(/([a-z])\1+/g, "$1").replace(/h$/, "");
}

/** Words long enough to identify a person on their own. */
function words(s: string): string[] {
  return s
    .split(" ")
    .map((w) => w.replace(/([a-z])\1+/g, "$1").replace(/h$/, ""))
    .filter((w) => w.length >= 6);
}

/** Devanagari names compare directly, minus the visarga/avagraha/danda punctuation. */
function devanagariKey(raw: string | null | undefined): string {
  return (raw || "").replace(/[ःऽ।॥]/g, "").replace(/\s+/g, "");
}

const THRESHOLD = 50;

function pairScore(a: string, b: string): number {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 100;
  if (ca.length >= 5 && cb.length >= 5 && (ca.includes(cb) || cb.includes(ca))) {
    const ratio = Math.min(ca.length, cb.length) / Math.max(ca.length, cb.length);
    // Only a near-complete overlap counts: "Sri Shankarayacharya" ⊃ "Śaṅkara" (0.75)
    // is the same person, "Brahmanandagiri" ⊃ "Ānandagiri" (0.71) is not.
    if (ratio >= 0.75) return 70 * ratio;
  }
  // Fall back to a shared identifying word ("Bhava Deepa - Nilakantha").
  let best = 0;
  for (const wa of words(a)) {
    for (const wb of words(b)) {
      if (wa === wb) {
        best = Math.max(best, 90);
      } else if (wa.startsWith(wb) || wb.startsWith(wa)) {
        const ratio = Math.min(wa.length, wb.length) / Math.max(wa.length, wb.length);
        if (ratio >= 0.75) best = Math.max(best, 70 * ratio);
      }
    }
  }
  return best;
}

/** Skeletons to try for one name: with and without titles, plus "Work - Author" segments. */
function nameVariants(name: string): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    for (const stripTitles of [true, false]) {
      const s = skeleton(raw, stripTitles);
      if (s) out.add(s);
    }
  };
  add(name);
  const segments = name.split(/[-–—]/).map((p) => p.trim()).filter(Boolean);
  if (segments.length > 1) segments.forEach(add);
  return Array.from(out);
}

export function matchAcharyaSlug(
  name: string,
  acharyas: AcharyaNameRef[] | undefined,
): string | undefined {
  if (!name || !acharyas?.length) return undefined;
  const variants = nameVariants(name);
  const nameDevanagari = devanagariKey(/[ऀ-ॿ]/.test(name) ? name : "");
  let bestSlug: string | undefined;
  let bestScore = 0;

  for (const a of acharyas) {
    let score = 0;
    if (nameDevanagari) {
      const cand = devanagariKey(a.name_devanagari);
      if (cand.length >= 2) {
        if (cand === nameDevanagari) score = 100;
        // Partial overlap needs more letters to be trustworthy than equality does.
        else if (cand.length >= 4 && nameDevanagari.length >= 4 && (cand.includes(nameDevanagari) || nameDevanagari.includes(cand))) {
          score = 70 * (Math.min(cand.length, nameDevanagari.length) / Math.max(cand.length, nameDevanagari.length));
        }
      }
    }
    for (const cand of [a.name_iast, a.name_display, ...(a.aliases ?? [])]) {
      if (!cand) continue;
      if (/[\u0900-\u097F]/.test(cand)) {
        // A Devanagari alias only compares against a Devanagari name.
        if (nameDevanagari && devanagariKey(cand) === nameDevanagari) score = 100;
        continue;
      }
      for (const stripTitles of [true, false]) {
        const cs = skeleton(cand, stripTitles);
        if (!cs) continue;
        for (const v of variants) score = Math.max(score, pairScore(v, cs));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = a.slug;
    }
  }

  return bestScore >= THRESHOLD ? bestSlug : undefined;
}
