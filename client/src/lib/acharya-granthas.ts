/**
 * The reverse of `matchAcharyaSlug`: which granthas in this library belong to a
 * given acharya, so their profile page can link back to the texts. The CMS models
 * the same relation (granthas picked by hand, plus everything whose
 * BhashyamAuthor / TeekaAuthor matches an acharya alias); here it is derived from
 * the books the reader already has, through the very same name matcher the
 * grantha pages use — so a grantha lists an acharya exactly when that acharya
 * lists the grantha.
 */
import { matchAcharyaSlug, type AcharyaNameRef } from "@/lib/acharya-match";

export interface GranthaBookRef {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  coverImage: string | null;
  bhashyamName?: string;
  teekasList?: { name: string; author: string }[];
}

export interface AcharyaGrantha {
  book: GranthaBookRef;
  /**
   * "bhashya" — the acharya wrote the book's commentary; "teeka" — a sub-commentary
   * on it; "linked" — picked by hand under this acharya in the CMS, with no
   * commentator name on the book to say which.
   */
  role: "bhashya" | "teeka" | "linked";
  /** The work(s) this acharya contributed to the grantha, when the CMS names them. */
  works: string[];
}

/**
 * Granthas under `slug`: the ones picked by hand in the CMS first, in the order
 * they were picked, then bhāṣya and ṭīkā matches alphabetically by title.
 */
export function granthasForAcharya(
  slug: string | null | undefined,
  books: GranthaBookRef[] | undefined,
  acharyas: AcharyaNameRef[] | undefined,
  /** `linked_grantha_doc_ids` from the acharya's CMS profile — Strapi documentIds. */
  manualDocIds: string[] | null | undefined = null,
): AcharyaGrantha[] {
  // Hand-picked links still resolve when the acharya list is unavailable, so only
  // the name-derived half depends on it.
  if (!slug || !books?.length) return [];
  // The same author name repeats across books, so resolve each one once.
  const slugCache = new Map<string, string | undefined>();
  const slugOf = (name: string): string | undefined => {
    if (!slugCache.has(name)) slugCache.set(name, matchAcharyaSlug(name, acharyas));
    return slugCache.get(name);
  };

  const out: AcharyaGrantha[] = [];
  for (const book of books) {
    if (book.author && slugOf(book.author) === slug) {
      out.push({ book, role: "bhashya", works: book.bhashyamName ? [book.bhashyamName] : [] });
      continue; // A bhāṣyakāra is listed once, under their bhāṣya.
    }
    let isTikakara = false;
    const works: string[] = [];
    for (const teeka of book.teekasList ?? []) {
      const person = teeka.author || teeka.name;
      if (!person || slugOf(person) !== slug) continue;
      isTikakara = true;
      // "Anandagiri tika" is the work, "Anandagiri" the person; an entry with no
      // author field names the teeka and its author in one string, which still
      // reads better as the work than showing nothing.
      const work = teeka.name || null;
      if (work && !works.includes(work)) works.push(work);
    }
    if (isTikakara) out.push({ book, role: "teeka", works });
  }

  const byTitle = (a: AcharyaGrantha, b: AcharyaGrantha) => a.book.title.localeCompare(b.book.title);
  const derived = [
    ...out.filter((g) => g.role === "bhashya").sort(byTitle),
    ...out.filter((g) => g.role === "teeka").sort(byTitle),
  ];
  if (!manualDocIds?.length) return derived;

  // A hand-picked grantha leads the list, keeping whatever role its own author
  // names imply. One deleted from the library since it was picked just drops out.
  const byId = new Map(books.map((b) => [b.id, b]));
  const manual: AcharyaGrantha[] = [];
  const claimed = new Set<string>();
  for (const docId of manualDocIds) {
    const book = byId.get(docId);
    if (!book || claimed.has(docId)) continue;
    claimed.add(docId);
    manual.push(derived.find((g) => g.book.id === docId) ?? { book, role: "linked", works: [] });
  }
  return [...manual, ...derived.filter((g) => !claimed.has(g.book.id))];
}
