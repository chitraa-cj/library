/**
 * Compact wire format for a grantha's verse index.
 *
 * The verse index is what gates a grantha's first paint, and it is almost
 * entirely redundant. Measured on Panchadasi (1,557 verses, 882KB raw / 134KB
 * gzipped):
 *
 *   198KB  adhyayNumber/adhyayTitle/khandaNumber/khandaTitle/*Type
 *          — pure duplicates of sectionPath[0] and [1]
 *    87KB  sectionPath — the same handful of ancestor titles repeated per verse
 *    40KB  bookId — the same string 1,557 times
 *   124KB  preview — only used for sidebar snippets, not for rendering a page
 *
 * So the index is encoded with the ancestor paths deduplicated into a table,
 * the legacy mirror fields dropped (they are recomputed on decode), bookId
 * hoisted, and previews made an optional parallel array that the critical
 * request omits.
 *
 * `decodeBookIndex(encodeBookIndex(x))` is value-identical to `x` for every
 * field the reader consumes, so nothing downstream of the fetch has to change.
 */
import type { BookWithVerseMeta, SectionPathEntry, VerseMeta } from "./schema";

/** `[number, title, type]` — one level of the section hierarchy. */
type PackedSection = [number | null, string | null, string | null];

/** `[id, verseNumber, pathIndex, sectionTitle]` */
type PackedVerse = [string, number, number, string | null];

export interface CompactBookIndex {
  /** Format version, so a cached old payload can be recognised and refetched. */
  v: 1;
  /** The book's own fields (everything except `verses`). */
  book: Record<string, unknown>;
  /** Deduplicated section levels, referenced by `paths`. */
  sections: PackedSection[];
  /** Deduplicated ancestor chains, as indexes into `sections`. */
  paths: number[][];
  verses: PackedVerse[];
  /** Parallel to `verses`; omitted from the first-paint payload. */
  previews?: (string | null)[];
  totalVerses: number;
}

/**
 * The legacy flat fields mirror the first two levels of `sectionPath`. Kept so
 * existing reader code (TOC grouping, chapter view) is untouched by the codec.
 */
function legacyLevelFields(path: SectionPathEntry[]) {
  const [first, second] = path;
  return {
    adhyayNumber: first?.number ?? null,
    adhyayTitle: first?.title ?? null,
    adhyayType: first?.type ?? null,
    khandaNumber: second?.number ?? null,
    khandaTitle: second?.title ?? null,
    khandaType: second?.type ?? null,
  };
}

export function encodeBookIndex(
  book: BookWithVerseMeta,
  options: { includePreviews?: boolean } = {},
): CompactBookIndex {
  const { verses, ...bookFields } = book;

  const sectionIds = new Map<string, number>();
  const sections: PackedSection[] = [];
  const sectionIndex = (entry: SectionPathEntry): number => {
    const packed: PackedSection = [entry.number ?? null, entry.title ?? null, entry.type ?? null];
    const key = JSON.stringify(packed);
    let idx = sectionIds.get(key);
    if (idx === undefined) {
      idx = sections.length;
      sections.push(packed);
      sectionIds.set(key, idx);
    }
    return idx;
  };

  const pathIds = new Map<string, number>();
  const paths: number[][] = [];
  const pathIndex = (path: SectionPathEntry[] | undefined): number => {
    const indexes = (path ?? []).map(sectionIndex);
    const key = indexes.join(",");
    let idx = pathIds.get(key);
    if (idx === undefined) {
      idx = paths.length;
      paths.push(indexes);
      pathIds.set(key, idx);
    }
    return idx;
  };

  const packedVerses: PackedVerse[] = [];
  const previews: (string | null)[] = [];
  for (const verse of verses) {
    packedVerses.push([verse.id, verse.verseNumber, pathIndex(verse.sectionPath), verse.sectionTitle ?? null]);
    previews.push(verse.preview ?? null);
  }

  const compact: CompactBookIndex = {
    v: 1,
    book: bookFields as Record<string, unknown>,
    sections,
    paths,
    verses: packedVerses,
    totalVerses: (book as { totalVerses?: number }).totalVerses ?? verses.length,
  };
  if (options.includePreviews && previews.some((p) => p !== null)) {
    compact.previews = previews;
  }
  return compact;
}

export function decodeBookIndex(compact: CompactBookIndex): BookWithVerseMeta {
  const bookId = String((compact.book as { id?: unknown }).id ?? "");
  const sections: SectionPathEntry[] = compact.sections.map(([number, title, type]) => ({
    number,
    title,
    type,
  }));
  const paths: SectionPathEntry[][] = compact.paths.map((indexes) =>
    indexes.map((i) => sections[i]).filter(Boolean),
  );

  const verses: VerseMeta[] = compact.verses.map(([id, verseNumber, pathIdx, sectionTitle], i) => {
    const sectionPath = paths[pathIdx] ?? [];
    const preview = compact.previews?.[i] ?? undefined;
    const verse: VerseMeta = {
      id,
      bookId,
      verseNumber,
      sectionTitle,
      ...legacyLevelFields(sectionPath),
      sectionPath,
    };
    if (preview) verse.preview = preview;
    return verse;
  });

  return {
    ...(compact.book as object),
    verses,
    totalVerses: compact.totalVerses,
  } as BookWithVerseMeta;
}

/** True for a payload that is already the compact form. */
export function isCompactBookIndex(value: unknown): value is CompactBookIndex {
  return (
    !!value &&
    typeof value === "object" &&
    (value as CompactBookIndex).v === 1 &&
    Array.isArray((value as CompactBookIndex).verses)
  );
}

/**
 * Merges a separately-fetched preview map into a decoded index, so the sidebar's
 * snippets can arrive after the page is already readable.
 */
export function withPreviews(
  book: BookWithVerseMeta,
  previews: Record<string, string> | undefined,
): BookWithVerseMeta {
  if (!previews || Object.keys(previews).length === 0) return book;
  return {
    ...book,
    verses: book.verses.map((v) => {
      const preview = previews[v.id];
      return preview && !v.preview ? { ...v, preview } : v;
    }),
  };
}
