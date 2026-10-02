/**
 * Typo-tolerant matching for Sanskrit titles and names.
 *
 * Readers type these from memory and from half a dozen romanisation schemes, so
 * "baridhi" has to find "Vāridhi" and "kandogya" has to find "Chāndogya".
 * Matching widens in passes — plain substring, then a phonetic fold that treats
 * the usual transliteration swaps (v/b/w, s/sh/ṣ, aspirates, long vowels) as the
 * same sound, then bounded edit distance per word for ordinary typos. Every pass
 * returns a score so results can be ranked instead of merely filtered.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Lowercase, strip diacritics and punctuation; non-Latin scripts are preserved. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    // Whitespace plus ASCII/Latin-1/general punctuation and the Devanagari daṇḍa.
    .replace(/[\s!-\/:-@\[-`{-~\u00a1-\u00bf\u2000-\u206f\u2e00-\u2e7f\u0964\u0965]+/g, " ")
    .trim();
}

// Applied in order — digraphs before the single letters they contain.
const PHONETIC_RULES: [RegExp, string][] = [
  [/ksh|x/g, "ks"],
  [/chh|ch/g, "c"],
  [/sh/g, "s"],
  [/([kgcjtdpb])h/g, "$1"], // aspirates: kh gh jh th dh ph bh
  [/[wb]/g, "v"],           // v/b/w are freely swapped across regions
  [/z/g, "j"],
  [/[cq]/g, "k"],           // ch ~ c ~ k: "chandogya" ~ "kandogya"
  [/ee/g, "i"],
  [/oo|ou/g, "u"],
  [/au/g, "o"],
  [/ai|ei/g, "e"],
  [/(.)\1+/g, "$1"],        // aa→a, tt→t, siddhanta→sidanta
];

/** Collapse a normalized string to its rough sound, so spelling variants meet. */
export function phoneticFold(normalized: string): string {
  let out = normalized;
  for (const [re, to] of PHONETIC_RULES) out = out.replace(re, to);
  return out;
}

/** Typo budget — longer words tolerate more slips. */
function maxDistance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

/** Damerau-Levenshtein, abandoned as soon as it provably exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      curr[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = curr;
    curr = new Array(b.length + 1);
  }
  return prev[b.length];
}

/** Do all of `q`'s characters appear in `text`, in order? */
function isSubsequence(text: string, q: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

function wordStartsWith(words: string[], q: string): boolean {
  return words.some(w => w.startsWith(q));
}

/** Score one already-normalized haystack against one already-normalized token. */
function scoreToken(norm: string, token: string): number {
  if (!norm || !token) return 0;

  if (norm === token) return 1000;
  if (norm.startsWith(token)) return 920;
  const words = norm.split(" ");
  if (wordStartsWith(words, token)) return 870;
  if (norm.includes(token)) return 820;

  const pn = phoneticFold(norm);
  const pq = phoneticFold(token);
  if (!pq) return 0;
  if (pn === pq) return 780;
  if (pn.startsWith(pq)) return 740;
  const pWords = pn.split(" ");
  if (wordStartsWith(pWords, pq)) return 710;
  if (pn.includes(pq)) return 680;

  // Compound names are written both ways ("Atmabodha" / "Atma Bodha").
  const joined = pn.replace(/ /g, "");
  if (joined === pq) return 775;
  if (joined.startsWith(pq)) return 735;
  if (joined.includes(pq)) return 675;

  // Ordinary typos: compare the query against each word, whole and as a prefix,
  // so "baridhi" still reaches "Vāridhi Upanishad".
  const budget = maxDistance(Math.max(pq.length, 4));
  if (budget > 0) {
    let best = budget + 1;
    for (const w of pWords.length > 1 ? [...pWords, joined] : pWords) {
      if (!w) continue;
      best = Math.min(best, editDistance(w, pq, budget));
      if (w.length > pq.length) {
        best = Math.min(best, editDistance(w.slice(0, pq.length + budget), pq, budget));
      }
      if (best === 0) break;
    }
    if (best <= budget) return 620 - best * 60;
  }

  // Last resort: dropped letters. Only over a short haystack — almost any query
  // is a subsequence of a paragraph-length description.
  if (pq.length >= 4 && pn.length <= pq.length * 4 && isSubsequence(pn, pq)) return 300;
  return 0;
}

/**
 * How well `text` answers `query`; 0 means no match, higher is better.
 * A multi-word query must have every word land somewhere in the text.
 */
export function fuzzyScore(text: string | null | undefined, query: string): number {
  const norm = normalizeText(text);
  const q = normalizeText(query);
  if (!norm || !q) return 0;

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length <= 1) return scoreToken(norm, q);

  // Whole-phrase hits outrank a scatter of individual word hits.
  const whole = scoreToken(norm, q);
  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(norm, token);
    if (s === 0) return whole;
    total += s;
  }
  return Math.max(whole, Math.round(total / tokens.length));
}

/** Best score across several candidate fields (title, slug, author…). */
export function fuzzyScoreAny(texts: Array<string | null | undefined>, query: string): number {
  let best = 0;
  for (const text of texts) {
    const s = fuzzyScore(text, query);
    if (s > best) best = s;
  }
  return best;
}

export function fuzzyMatch(text: string | null | undefined, query: string): boolean {
  return fuzzyScore(text, query) > 0;
}

export function fuzzyMatchAny(texts: Array<string | null | undefined>, query: string): boolean {
  return texts.some(text => fuzzyScore(text, query) > 0);
}

/**
 * Filter and rank `items` by `query`. An empty query returns the list untouched,
 * so callers can use this directly as their display list.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  fields: (item: T) => Array<string | null | undefined>,
  limit?: number,
): T[] {
  if (!query.trim()) return limit ? items.slice(0, limit) : items;
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const score = fuzzyScoreAny(fields(item), query);
    if (score > 0) scored.push({ item, score, index });
  });
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  const out = scored.map(s => s.item);
  return limit ? out.slice(0, limit) : out;
}
