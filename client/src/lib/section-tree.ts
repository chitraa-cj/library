/**
 * Section hierarchy helpers shared by the reader, its nav sidebar and the
 * landing-page navigators.
 *
 * Granthas nest their sections to different depths — Gītā is Adhyāya › Shloka,
 * Chāndogya is Adhyāya › Khaṇḍa › Mantra, Bhāṣyārtha Ratnamālā is Adhyāya ›
 * Pāda › Sūtra › Mantra — so everything here works on a recursive tree and a
 * path of section numbers (e.g. [1, 1, 31]) rather than a fixed chapter/khanda
 * pair. The CMS ships each verse's full ancestry in `sectionPath`; the older
 * flat adhyay/khanda fields are used as a fallback.
 */

export interface SectionPathEntry {
  number: number | null;
  title: string | null;
  type: string | null;
}

export interface SectionNode<V = any> {
  /** Identity within the parent level (CMS `order`, else the title). */
  key: string;
  number: number;
  title: string;
  type: string | null;
  /** Section numbers from the root down to this node. */
  path: number[];
  /** Every verse under this node, including those in deeper sub-sections. */
  verses: V[];
  /** Verses attached to this exact level (empty for nodes with sub-sections). */
  directVerses: V[];
  verseNumbers: number[];
  children: SectionNode<V>[];
  verseCount: number;
  /** Legacy aliases kept for existing call sites. */
  count: number;
  khandas: SectionNode<V>[];
}

/** A verse's section ancestry, falling back to the flat legacy fields. */
export function versePath(v: any): SectionPathEntry[] {
  if (Array.isArray(v?.sectionPath) && v.sectionPath.length > 0) return v.sectionPath;
  const legacy: SectionPathEntry[] = [];
  if (v?.adhyayNumber != null || v?.adhyayTitle) {
    legacy.push({ number: v.adhyayNumber ?? null, title: v.adhyayTitle ?? null, type: v.adhyayType ?? null });
  }
  if (v?.khandaNumber != null || v?.khandaTitle) {
    legacy.push({ number: v.khandaNumber ?? null, title: v.khandaTitle ?? null, type: v.khandaType ?? null });
  }
  return legacy;
}

/** Builds the section tree of a grantha: one level per CMS section level. */
export function buildSectionTree<V extends { verseNumber: number }>(verses: V[]): SectionNode<V>[] {
  const roots: SectionNode<V>[] = [];

  for (const v of verses) {
    const path = versePath(v);
    if (path.length === 0) continue;
    let level = roots;
    let node: SectionNode<V> | undefined;
    const numbers: number[] = [];
    for (const entry of path) {
      const key = entry.number != null ? `#${entry.number}` : `t:${entry.title ?? ""}`;
      node = level.find((n) => n.key === key);
      if (!node) {
        const number = entry.number ?? level.length + 1;
        node = {
          key,
          number,
          title: entry.title || "",
          type: entry.type ?? null,
          path: [...numbers, number],
          verses: [],
          directVerses: [],
          verseNumbers: [],
          children: [],
          verseCount: 0,
          count: 0,
          khandas: [],
        };
        level.push(node);
      }
      numbers.push(node.number);
      node.verses.push(v);
      node.verseNumbers.push(v.verseNumber);
      level = node.children;
    }
    node?.directVerses.push(v);
  }

  const finalise = (nodes: SectionNode<V>[]) => {
    nodes.sort((a, b) => a.number - b.number);
    for (const n of nodes) {
      n.verses.sort((a, b) => a.verseNumber - b.verseNumber);
      n.directVerses.sort((a, b) => a.verseNumber - b.verseNumber);
      n.verseNumbers = n.verses.map((v) => v.verseNumber);
      n.verseCount = n.verses.length;
      n.count = n.verses.length;
      n.khandas = n.children;
      finalise(n.children);
    }
  };
  finalise(roots);

  return roots;
}

/** Number of section levels in the deepest branch. */
export function sectionDepth(nodes: SectionNode<any>[]): number {
  let max = 0;
  for (const n of nodes) max = Math.max(max, 1 + sectionDepth(n.children));
  return max;
}

/** The sibling nodes sitting directly under the given path. */
export function nodesAtPath<V>(roots: SectionNode<V>[], path: number[]): SectionNode<V>[] {
  let level = roots;
  for (const num of path) {
    const node = level.find((n) => n.number === num);
    if (!node) return [];
    level = node.children;
  }
  return level;
}

/** The node a path of section numbers lands on. */
export function nodeAtPath<V>(roots: SectionNode<V>[], path: number[]): SectionNode<V> | undefined {
  let level = roots;
  let node: SectionNode<V> | undefined;
  for (const num of path) {
    node = level.find((n) => n.number === num);
    if (!node) return undefined;
    level = node.children;
  }
  return node;
}

/** Section path leading to a verse, e.g. [1, 1, 31]. Empty when unplaced. */
export function pathOfVerse(roots: SectionNode<any>[], verseNumber: number): number[] {
  const path: number[] = [];
  let level = roots;
  while (level.length > 0) {
    const node = level.find((n) => n.verseNumbers.includes(verseNumber));
    if (!node) break;
    path.push(node.number);
    level = node.children;
  }
  return path;
}

/** Fills a partial selection down to the deepest level, picking first entries. */
export function completePath(roots: SectionNode<any>[], path: number[]): number[] {
  const full = [...path];
  let level = nodesAtPath(roots, full);
  while (level.length > 0) {
    full.push(level[0].number);
    level = level[0].children;
  }
  return full;
}

/** True when `path` is `prefix` or sits underneath it. */
export function pathStartsWith(path: number[], prefix: number[]): boolean {
  return prefix.every((n, i) => path[i] === n);
}

/** Section path of every verse, keyed by verse number. */
export function versePaths(roots: SectionNode<any>[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const walk = (nodes: SectionNode<any>[]) => {
    for (const node of nodes) {
      for (const v of node.directVerses as any[]) map.set(v.verseNumber, node.path);
      walk(node.children);
    }
  };
  walk(roots);
  return map;
}

/** Reference label per verse: section numbers + position, e.g. "1.1.31.4". */
export function verseLabels(roots: SectionNode<any>[]): Map<number, string> {
  const map = new Map<number, string>();
  const walk = (nodes: SectionNode<any>[]) => {
    for (const node of nodes) {
      node.directVerses.forEach((v: any, idx: number) => {
        map.set(v.verseNumber, [...node.path, idx + 1].join("."));
      });
      walk(node.children);
    }
  };
  walk(roots);
  return map;
}

/** Strips the level word from a CMS title, e.g. "Prathama Adhyaya" -> "Prathama". */
export function getChapterLabel(title: string): string {
  let t = title;
  if (t.includes(' - ')) t = t.split(' - ').pop()?.trim() || t;
  const levelWord = /(adhy[aā]ya|vall[iī]|pra[sś]na|mu[nṇ][dḍ]aka|kha[nṇ][dḍ]a|anuv[aā]ka|p[aā]da|s[uū]tra|chapter|section)[ḥh]?/i;
  t = t.replace(new RegExp(`\\s+${levelWord.source}\\.?\\s*$`, 'i'), '').trim();
  t = t.replace(new RegExp(`^${levelWord.source}\\s+[\\d०-९ivxIVX]*\\.?\\s*`, 'i'), '').trim();
  t = t.replace(new RegExp(`^${levelWord.source}\\s+`, 'i'), '').trim();
  return t || title;
}

// Known Strapi section `type` slugs -> properly diacriticised display labels.
// Keys are normalised (lower-case, no spaces/underscores/hyphens).
const SECTION_TYPE_LABELS: Record<string, string> = {
  adhyay: "Adhyāya", adhyaya: "Adhyāya",
  khanda: "Khaṇḍa", kanda: "Kāṇḍa",
  valli: "Vallī",
  anuvaka: "Anuvāka",
  prashna: "Praśna", prasna: "Praśna",
  mundaka: "Muṇḍaka",
  pada: "Pāda",
  sutra: "Sūtra",
  adhikarana: "Adhikaraṇa",
  vakhya: "Vākya", vakhyaa: "Vākya", vakya: "Vākya",
  sarga: "Sarga",
  brahmana: "Brāhmaṇa",
  pariccheda: "Pariccheda", parichcheda: "Pariccheda",
  section: "Section",
  chapter: "Chapter",
};

// Turn a raw Strapi section `type` into a display label. Falls back to
// title-casing unknown CMS values so a new grantha type still renders sensibly.
export function humanizeSectionType(type?: string | null): string | null {
  if (!type) return null;
  const key = type.toLowerCase().trim().replace(/[\s_-]+/g, "");
  if (!key) return null;
  if (SECTION_TYPE_LABELS[key]) return SECTION_TYPE_LABELS[key];
  return type.trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

// Loose stem patterns for guessing a level name from a section *title* when the
// CMS hasn't set a `type`. Ordered most-specific first; stems are written to
// tolerate diacritics and spelling variants (e.g. "parichchedha" ~ "pariccheda").
const TITLE_LEVEL_PATTERNS: [RegExp, string][] = [
  [/parichched|pariccheda/i, "Pariccheda"],
  [/adhikara[nṇ]a/i, "Adhikaraṇa"],
  [/anuv[aā]ka/i, "Anuvāka"],
  [/vall[iī]/i, "Vallī"],
  [/mu[nṇ][dḍ]aka/i, "Muṇḍaka"],
  [/pra[sś]na/i, "Praśna"],
  [/br[aā]hma[nṇ]a/i, "Brāhmaṇa"],
  [/kha[nṇ][dḍ]a/i, "Khaṇḍa"],
  [/v[aā]kya/i, "Vākya"],
  [/sarga/i, "Sarga"],
  [/s[uū]tra/i, "Sūtra"],
  [/p[aā]da/i, "Pāda"],
  [/adhy[aā]ya?/i, "Adhyāya"],
  [/chapter/i, "Chapter"],
  [/section/i, "Section"],
];

export function labelFromTitle(title?: string | null): string | null {
  if (!title) return null;
  for (const [re, label] of TITLE_LEVEL_PATTERNS) {
    if (re.test(title)) return label;
  }
  return null;
}

/**
 * A display label for every section level, outermost first, plus the name of
 * the verse unit. The CMS `type` wins; when it is missing — or repeats the
 * level above it, which happens when an editor copies a type down a branch —
 * the section title decides (e.g. type "pada" on "Prathama Sutra" -> Sūtra).
 */
export function detectLevelLabels(roots: SectionNode<any>[]): { levelLabels: string[]; mantraLabel: string } {
  const levelLabels: string[] = [];
  const DEFAULTS = ["Adhyāya", "Khaṇḍa", "Section"];

  // Walk level by level across the whole tree (not just the first branch), so a
  // grantha whose first adhyāya is flat but whose second nests still gets a
  // label for every level that exists somewhere in it.
  let level = roots;
  for (let depth = 0; level.length > 0; depth++) {
    const sample = level.find((n) => n.type || n.title) || level[0];
    const fromCms = humanizeSectionType(sample.type);
    const fromTitle = labelFromTitle(sample.title);
    let label = fromCms || fromTitle || DEFAULTS[depth] || `Level ${depth + 1}`;
    if (levelLabels.includes(label)) {
      label = (fromTitle && !levelLabels.includes(fromTitle) ? fromTitle : null)
        || DEFAULTS.find((d) => !levelLabels.includes(d))
        || `${label} ${depth + 1}`;
    }
    levelLabels.push(label);
    level = level.flatMap((n) => n.children);
  }

  let mantraLabel = "Mantra";

  // Pariccheda-based prose works (e.g. Vedānta Paribhāṣā) aren't divided into
  // khaṇḍas/mantras: their sub-sections are subject-topics (viṣaya) and the leaf
  // prose passages are viṣayā. A CMS `type` on the sub-level still wins if set.
  if (levelLabels[0] === "Pariccheda") {
    if (!humanizeSectionType(roots[0]?.children?.[0]?.type)) levelLabels[1] = "Viṣaya";
    mantraLabel = "Viṣayā";
  }

  return { levelLabels, mantraLabel };
}

/** Label for one node in a dropdown / breadcrumb, e.g. "1 Prathama". */
export function nodeLabel(node: SectionNode<any>, levelLabel: string): string {
  return node.title ? `${node.number} ${getChapterLabel(node.title)}` : `${levelLabel} ${node.number}`;
}
