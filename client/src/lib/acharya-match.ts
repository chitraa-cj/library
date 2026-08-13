/**
 * Best-effort matching of a commentator/author name (as stored on a book) to an
 * acharya profile slug, so the name can link to the in-app guru-parampara page.
 * Honorifics are stripped and names compared by normalized substring or shared
 * significant word, tolerating spelling/transliteration drift. Returns undefined
 * when nothing matches confidently — callers then render plain (non-linked) text.
 */
export interface AcharyaNameRef {
  slug: string;
  name_iast: string;
  name_devanagari: string;
  name_display: string | null;
}

export function matchAcharyaSlug(
  name: string,
  acharyas: AcharyaNameRef[] | undefined,
): string | undefined {
  if (!name || !acharyas?.length) return undefined;
  const strip = (s: string | null | undefined) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\b(sri|shri|sree|swami|swamin|bhagavan|bhagavatpada|adi|acharya|acarya|saraswati|sarasvati)\b/g, " ");
  const compact = (s: string | null | undefined) => strip(s).replace(/[^a-z0-9]/g, "");
  const words = (s: string | null | undefined) => strip(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 5);
  const target = compact(name);
  if (!target) return undefined;
  const targetWords = words(name);
  for (const a of acharyas) {
    for (const cand of [a.name_iast, a.name_display, a.slug, a.name_devanagari]) {
      const c = compact(cand);
      if (c.length >= 4 && (target === c || target.includes(c) || c.includes(target))) return a.slug;
      // Shared significant word, tolerating a suffix typo (e.g. "shankaray" vs "shankara").
      const cWords = words(cand);
      for (const tw of targetWords) {
        for (const cw of cWords) {
          if (tw === cw || tw.includes(cw) || cw.includes(tw)) return a.slug;
          if (tw.length >= 6 && cw.length >= 6 && tw.slice(0, 6) === cw.slice(0, 6)) return a.slug;
        }
      }
    }
  }
  return undefined;
}
