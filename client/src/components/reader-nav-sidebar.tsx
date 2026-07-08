import { useState, useMemo, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { BookOpen, Search, ChevronDown, Bookmark, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import shankaracharyaImg from "@assets/image_1770455528511.png";

export interface KhandaInfo {
  number: number;
  title: string;
  count: number;
  verseNumbers: number[];
  type?: string | null;
}

export interface ChapterInfo {
  number: number;
  title: string;
  verseCount: number;
  khandas?: KhandaInfo[];
  verseNumbers: number[];
  type?: string | null;
}

export function useBookChapters(bookId: string | undefined): ChapterInfo[] {
  const { data } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });

  return useMemo(() => {
    if (!data?.verses) return [];

    const chapterMap = new Map<number, ChapterInfo>();
    for (const v of data.verses) {
      const adhyay = v.adhyayNumber;
      if (adhyay == null) continue;

      if (!chapterMap.has(adhyay)) {
        chapterMap.set(adhyay, {
          number: adhyay,
          title: v.adhyayTitle || `Chapter ${adhyay}`,
          verseCount: 0,
          verseNumbers: [],
          type: v.adhyayType ?? null,
        });
      }
      const ch = chapterMap.get(adhyay)!;
      ch.verseCount++;
      ch.verseNumbers.push(v.verseNumber);

      if (v.khandaNumber != null) {
        if (!ch.khandas) ch.khandas = [];
        const existingKhanda = ch.khandas.find(k => k.number === v.khandaNumber);
        if (existingKhanda) {
          existingKhanda.count++;
          existingKhanda.verseNumbers.push(v.verseNumber);
        } else {
          ch.khandas.push({
            number: v.khandaNumber,
            title: v.khandaTitle || `Part ${v.khandaNumber}`,
            count: 1,
            verseNumbers: [v.verseNumber],
            type: v.khandaType ?? null,
          });
        }
      }
    }

    const result = Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
    result.forEach(ch => {
      ch.verseNumbers.sort((a, b) => a - b);
      ch.khandas?.forEach(k => k.verseNumbers.sort((a, b) => a - b));
    });
    return result;
  }, [data]);
}

function getChapterLabel(title: string) {
  let t = title;
  if (t.includes(' - ')) t = t.split(' - ').pop()?.trim() || t;
  const levelWord = /(adhy[aā]ya|vall[iī]|pra[sś]na|mu[nṇ][dḍ]aka|kha[nṇ][dḍ]a|anuv[aā]ka|p[aā]da|chapter|section)[ḥh]?/i;
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
  vakhya: "Vākya", vakhyaa: "Vākya", vakya: "Vākya",
  sarga: "Sarga",
  brahmana: "Brāhmaṇa",
  pariccheda: "Pariccheda", parichcheda: "Pariccheda",
  section: "Section",
  chapter: "Chapter",
};

// Turn a raw Strapi section `type` into a display label. Falls back to
// title-casing unknown CMS values so a new grantha type still renders sensibly.
function humanizeSectionType(type?: string | null): string | null {
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
  [/anuv[aā]ka/i, "Anuvāka"],
  [/vall[iī]/i, "Vallī"],
  [/mu[nṇ][dḍ]aka/i, "Muṇḍaka"],
  [/pra[sś]na/i, "Praśna"],
  [/br[aā]hma[nṇ]a/i, "Brāhmaṇa"],
  [/kha[nṇ][dḍ]a/i, "Khaṇḍa"],
  [/v[aā]kya/i, "Vākya"],
  [/sarga/i, "Sarga"],
  [/p[aā]da/i, "Pāda"],
  [/adhy[aā]ya?/i, "Adhyāya"],
  [/chapter/i, "Chapter"],
  [/section/i, "Section"],
];

function labelFromTitle(title?: string | null): string | null {
  if (!title) return null;
  for (const [re, label] of TITLE_LEVEL_PATTERNS) {
    if (re.test(title)) return label;
  }
  return null;
}

function detectLabels(chapters: ChapterInfo[]): { chapterLabel: string; khandaLabel: string; mantraLabel: string } {
  const firstKhanda = chapters.find(ch => ch.khandas?.length)?.khandas?.[0];

  // Prefer the level name straight from Strapi's section `type`; fall back to
  // guessing from the title when the CMS hasn't set one (e.g. legacy books or
  // sections imported without a type), and only then to a generic default.
  const chapterLabel =
    humanizeSectionType(chapters[0]?.type) || labelFromTitle(chapters[0]?.title) || "Adhyāya";
  const khandaFromCms = humanizeSectionType(firstKhanda?.type);
  let khandaLabel = khandaFromCms || labelFromTitle(firstKhanda?.title) || "Khaṇḍa";
  let mantraLabel = "Mantra";

  // Pariccheda-based prose works (e.g. Vedānta Paribhāṣā) aren't divided into
  // khaṇḍas/mantras: their sub-sections are subject-topics (viṣaya) and the leaf
  // prose passages are viṣayā. A CMS `type` on the sub-level still wins if set.
  if (chapterLabel === "Pariccheda") {
    if (!khandaFromCms) khandaLabel = "Viṣaya";
    mantraLabel = "Viṣayā";
  }

  return { chapterLabel, khandaLabel, mantraLabel };
}

const BOOKMARKS_KEY = "ssh:bookmarks";

/** Bookmark toggle (localStorage) — shares the key with the reader so state stays in sync. */
function SidebarBookmark({ verseId }: { verseId: string }) {
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    try { setMarked((JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]") as string[]).includes(verseId)); }
    catch { setMarked(false); }
  }, [verseId]);
  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]"));
      if (set.has(verseId)) set.delete(verseId); else set.add(verseId);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(set)));
      setMarked(set.has(verseId));
    } catch { /* ignore */ }
  };
  return (
    <button type="button" onClick={toggle} aria-label="Bookmark" className="shrink-0 p-1 text-muted-foreground/50 hover:text-primary transition-colors" data-testid={`nav-bookmark-${verseId}`}>
      <Bookmark className={`h-3.5 w-3.5 ${marked ? "fill-primary text-primary" : ""}`} />
    </button>
  );
}

/** Labeled dropdown used for the Adhyāya / Khaṇḍa selectors. */
function SidebarSelect({ label, value, options, onChange, testId }: {
  label: string;
  value: number | null;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div className="min-w-0">
      <span className="block text-[11px] text-muted-foreground mb-1">{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border border-border/70 bg-background text-xs hover:border-primary/40 transition-colors"
          data-testid={testId}
        >
          <span className="truncate text-foreground/90">{current?.label || "Select"}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 z-30 w-max min-w-full max-w-[220px] max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl py-1">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full text-left px-2.5 py-1.5 text-xs transition-colors ${o.value === value ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-accent"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Optional intro video keyed by book slug. */
const SIDEBAR_VIDEO_BY_SLUG: Record<string, { videoId: string; minutes: number }> = {
  "isha-upanishad-bhashya": { videoId: "8ELHatzdtAk", minutes: 32 },
};

export function ReaderNavSidebar({ bookId, bookTitle, chapters, currentVerseNumber, onSelectVerse, onSelectBook }: {
  bookId: string;
  bookTitle: string;
  chapters: ChapterInfo[];
  currentVerseNumber: number;
  onSelectVerse: (bookId: string, verseNumber: number) => void;
  onSelectBook: (bookId: string) => void;
}) {
  const { data: bookData } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });
  const introInfo = useMemo(() => {
    if (!bookData?.verses) return { hasIntro: false, label: "Sambandha Bhāṣyam" };
    const introVerse = bookData.verses.find((v: any) =>
      v.verseNumber === 0 &&
      typeof v.sectionTitle === "string" &&
      ["introduction", "sambandha bhashyam"].includes(v.sectionTitle.toLowerCase().trim())
    );
    if (!introVerse) return { hasIntro: false, label: "Sambandha Bhāṣyam" };
    return { hasIntro: true, label: "Sambandha Bhāṣyam" };
  }, [bookData]);
  const hasIntro = introInfo.hasIntro;
  const isIntroActive = currentVerseNumber === 0;
  const hasKhandas = useMemo(() => chapters.some((ch) => ch.khandas && ch.khandas.length > 0), [chapters]);
  const labels = useMemo(() => detectLabels(chapters), [chapters]);
  const author = (bookData?.author && String(bookData.author).trim()) || "Śrī Śaṅkarācārya";

  const [selectedChapterNum, setSelectedChapterNum] = useState<number | null>(null);
  const [selectedKhandaNum, setSelectedKhandaNum] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const activeVerseRef = useRef<HTMLButtonElement>(null);

  const activeChapter = useMemo(() => {
    for (const ch of chapters) {
      if (ch.verseNumbers.includes(currentVerseNumber)) return ch.number;
    }
    return null;
  }, [chapters, currentVerseNumber]);

  const activeKhandaObj = useMemo(() => {
    for (const ch of chapters) {
      if (ch.khandas) {
        for (const kh of ch.khandas) {
          if (kh.verseNumbers.includes(currentVerseNumber)) {
            return { chapterNum: ch.number, khandaNum: kh.number };
          }
        }
      }
    }
    return null;
  }, [chapters, currentVerseNumber]);

  // Keep selectors in sync with the verse open in the reader (e.g. after Next/Prev).
  useEffect(() => {
    if (activeChapter != null) setSelectedChapterNum(activeChapter);
    if (activeKhandaObj) setSelectedKhandaNum(activeKhandaObj.khandaNum);
  }, [activeChapter, activeKhandaObj]);

  // Default the selectors on first load — prefer the chapter of the open verse so a
  // direct open (e.g. Mantra 2.5) doesn't get clobbered back to the first chapter.
  useEffect(() => {
    if (selectedChapterNum == null && chapters.length) {
      setSelectedChapterNum(activeChapter ?? chapters[0].number);
    }
  }, [chapters, selectedChapterNum, activeChapter]);

  useEffect(() => {
    setTimeout(() => {
      activeVerseRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
  }, [currentVerseNumber]);

  const selectedChapter = useMemo(() => chapters.find((ch) => ch.number === selectedChapterNum), [chapters, selectedChapterNum]);

  useEffect(() => {
    if (hasKhandas && selectedChapter && selectedKhandaNum == null) {
      const activeInSelected =
        activeKhandaObj && activeKhandaObj.chapterNum === selectedChapter.number
          ? activeKhandaObj.khandaNum
          : null;
      setSelectedKhandaNum(activeInSelected ?? selectedChapter.khandas?.[0]?.number ?? null);
    }
  }, [hasKhandas, selectedChapter, selectedKhandaNum, activeKhandaObj]);

  // Per-verse Devanagari preview + id lookups from the raw CMS verses.
  const { previewMap, verseIdMap } = useMemo(() => {
    const preview = new Map<number, string>();
    const ids = new Map<number, string>();
    const verses = bookData?.verses;
    if (Array.isArray(verses)) {
      for (const v of verses) {
        if (v?.id != null) ids.set(v.verseNumber, v.id);
        const raw = v?.devanagari ?? v?.text ?? v?.originalText ?? v?.sanskrit ?? v?.verseText ?? v?.content ?? "";
        const plain = String(raw).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        if (plain) preview.set(v.verseNumber, plain);
      }
    }
    return { previewMap: preview, verseIdMap: ids };
  }, [bookData]);

  const verseLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ch of chapters) {
      if (ch.khandas && ch.khandas.length > 0) {
        for (const kh of ch.khandas) {
          kh.verseNumbers.forEach((vn, idx) => { map.set(vn, `${ch.number}.${kh.number}.${idx + 1}`); });
        }
        ch.verseNumbers.forEach((vn) => {
          if (!map.has(vn)) { const idx = ch.verseNumbers.indexOf(vn); map.set(vn, `${ch.number}.${idx + 1}`); }
        });
      } else {
        ch.verseNumbers.forEach((vn, idx) => { map.set(vn, `${ch.number}.${idx + 1}`); });
      }
    }
    return map;
  }, [chapters]);

  const labelFor = (vn: number) => verseLabelMap.get(vn) || String(vn);

  const mantraNumbers = useMemo(() => {
    let nums: number[] = [];
    if (hasKhandas && selectedKhandaNum != null && selectedChapter?.khandas) {
      nums = selectedChapter.khandas.find((k) => k.number === selectedKhandaNum)?.verseNumbers || [];
    } else {
      nums = selectedChapter?.verseNumbers || [];
    }
    nums = nums.filter((vn) => vn !== 0);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      nums = nums.filter((vn) => labelFor(vn).toLowerCase().includes(q) || (previewMap.get(vn) || "").toLowerCase().includes(q));
    }
    return nums;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKhandas, selectedChapter, selectedKhandaNum, searchQuery, previewMap, verseLabelMap]);

  const chapterOptions = useMemo(
    () => chapters.map((ch) => ({ value: ch.number, label: `${ch.number} ${getChapterLabel(ch.title)}` })),
    [chapters],
  );
  const khandaOptions = useMemo(
    () => (selectedChapter?.khandas || []).map((kh) => ({ value: kh.number, label: `${kh.number} ${getChapterLabel(kh.title)}` })),
    [selectedChapter],
  );

  const video = bookData?.slug ? SIDEBAR_VIDEO_BY_SLUG[bookData.slug] : undefined;

  return (
    <div className="h-full flex flex-col border-r border-border bg-card" data-testid="reader-nav-sidebar">
      {/* Header (fixed) */}
      <div className="p-3 space-y-3 shrink-0 border-b border-border/60">
        {/* Book selector */}
        <button
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => onSelectBook(bookId)}
          data-testid="reader-nav-book-title"
        >
          <span className="font-serif font-semibold text-sm truncate">{bookTitle}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
        </button>

        {/* Author card */}
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5" data-testid="reader-nav-author">
          <img src={shankaracharyaImg} alt="" className="h-11 w-11 object-contain shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-center">
            <button
              type="button"
              onClick={() => window.open("https://en.wikipedia.org/wiki/Adi_Shankara", "_blank", "noopener,noreferrer")}
              className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition-colors"
              data-testid="button-read-biography"
            >
              Read Biography
            </button>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-primary/40 text-[10px]">&#10086;</span>
              <span className="text-sm font-serif font-semibold text-primary truncate">{author}</span>
              <span className="text-primary/40 text-[10px]">&#10086;</span>
            </div>
          </div>
        </div>

        {/* Sambandha Bhāṣyam */}
        {hasIntro && (
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              isIntroActive ? "bg-primary/10 border-primary/40 text-primary" : "border-border/70 text-foreground/80 hover:bg-accent/50"
            }`}
            onClick={() => onSelectVerse(bookId, 0)}
            data-testid="reader-nav-read-introduction"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">{introInfo.label}</span>
          </button>
        )}

        {/* Adhyāya / Khaṇḍa selectors */}
        {chapters.length > 0 && (
          <div className={hasKhandas ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
            <SidebarSelect
              label={labels.chapterLabel}
              value={selectedChapterNum}
              options={chapterOptions}
              onChange={(v) => {
                setSelectedChapterNum(v);
                const c = chapters.find((ch) => ch.number === v);
                setSelectedKhandaNum(c?.khandas?.[0]?.number ?? null);
              }}
              testId="dropdown-adhyaya"
            />
            {hasKhandas && (
              <SidebarSelect
                label={labels.khandaLabel}
                value={selectedKhandaNum}
                options={khandaOptions}
                onChange={(v) => setSelectedKhandaNum(v)}
                testId="dropdown-khanda"
              />
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            className="h-9 pl-8 text-xs bg-background rounded-lg"
            placeholder={`Search ${labels.mantraLabel.toLowerCase()}s...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-nav-search"
          />
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">
            {labels.mantraLabel}s ({mantraNumbers.length})
          </span>
        </div>
      </div>

      {/* Mantra list (scrolls) */}
      <div className="flex-1 overflow-y-auto" data-testid="reader-mantra-list">
        {mantraNumbers.length > 0 ? (
          mantraNumbers.map((vn) => {
            const isActive = currentVerseNumber === vn;
            const preview = previewMap.get(vn);
            const vid = verseIdMap.get(vn);
            return (
              <button
                key={vn}
                ref={isActive ? activeVerseRef : undefined}
                onClick={() => onSelectVerse(bookId, vn)}
                className={`group flex items-center gap-2.5 w-full text-left pl-2.5 pr-2 py-2 border-l-[3px] transition-colors ${
                  isActive ? "bg-primary/10 border-l-primary" : "border-l-transparent hover:bg-accent/50"
                }`}
                data-testid={`nav-mantra-${vn}`}
              >
                <span className={`shrink-0 h-3.5 w-3.5 rounded-full border flex items-center justify-center ${isActive ? "border-primary" : "border-muted-foreground/40"}`}>
                  {isActive && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-mono font-semibold ${isActive ? "text-primary" : "text-foreground/80"}`}>
                    {labelFor(vn)}
                  </span>
                  {preview && (
                    <span className="block text-[11px] text-muted-foreground truncate leading-tight">{preview}</span>
                  )}
                </span>
                {vid && <SidebarBookmark verseId={vid} />}
              </button>
            );
          })
        ) : (
          <div className="text-[11px] text-muted-foreground text-center py-8 px-3">
            {searchQuery.trim() ? "No results found" : `Select a ${labels.chapterLabel.toLowerCase()}`}
          </div>
        )}
      </div>

      {/* Intro video (fixed) */}
      {video && (
        <div className="shrink-0 border-t border-border/60 p-2.5">
          <button
            type="button"
            onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank", "noopener,noreferrer")}
            className="w-full flex items-center gap-2.5 rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-colors p-2 text-left"
            data-testid="reader-nav-video"
          >
            <div className="relative h-11 w-16 rounded-md overflow-hidden shrink-0 bg-muted">
              <img src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-4 w-4 text-white fill-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground leading-tight">Introduction to</p>
              <p className="text-xs font-semibold text-foreground truncate">{bookTitle}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {video.minutes} min &middot; <span className="text-primary font-semibold">WATCH NOW</span>
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
