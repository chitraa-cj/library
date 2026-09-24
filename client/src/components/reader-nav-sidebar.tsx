import { useState, useMemo, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { BookOpen, Search, ChevronDown, Bookmark, Play, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isBookmarked, toggleBookmark, subscribeBookmarks, type BookmarkEntry } from "@/lib/bookmarks";
import { matchAcharyaSlug, type AcharyaNameRef } from "@/lib/acharya-match";
import shankaracharyaImg from "@assets/image_1770455528511.png";

import {
  buildSectionTree,
  completePath,
  detectLevelLabels,
  nodeAtPath,
  nodeLabel,
  nodesAtPath,
  pathOfVerse,
  verseLabels,
  type SectionNode,
} from "@/lib/section-tree";

export type { SectionNode } from "@/lib/section-tree";
/** Legacy aliases — a "chapter" is just the outermost section level. */
export type ChapterInfo = SectionNode;
export type KhandaInfo = SectionNode;

export function useBookChapters(bookId: string | undefined): ChapterInfo[] {
  const { data } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });

  return useMemo(() => (data?.verses ? buildSectionTree(data.verses) : []), [data]);
}

/** Bookmark toggle (localStorage) — shares the store with the reader so state stays in sync. */
function SidebarBookmark({ verseId, entry }: { verseId: string; entry?: Omit<BookmarkEntry, "verseId"> }) {
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    setMarked(isBookmarked(verseId));
    return subscribeBookmarks(() => setMarked(isBookmarked(verseId)));
  }, [verseId]);
  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setMarked(toggleBookmark({ verseId, ...entry }));
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

/** Shown for every book unless a slug below overrides it. */
const DEFAULT_SIDEBAR_VIDEO = { videoId: "8ELHatzdtAk", minutes: 32 };

/** Per-slug intro video overrides (falls back to DEFAULT_SIDEBAR_VIDEO). */
const SIDEBAR_VIDEO_BY_SLUG: Record<string, { videoId: string; minutes: number }> = {
  "isha-upanishad-bhashya": { videoId: "8ELHatzdtAk", minutes: 32 },
};

export function ReaderNavSidebar({ bookId, bookTitle, chapters, currentVerseNumber, chapterViewPath, onSelectVerse, onSelectBook, onShowCover, onOpenAcharya }: {
  bookId: string;
  bookTitle: string;
  chapters: ChapterInfo[];
  currentVerseNumber: number;
  /** Section path the reader is showing in chapter view, e.g. [1, 2]. */
  chapterViewPath?: number[] | null;
  onSelectVerse: (bookId: string, verseNumber: number) => void;
  onSelectBook: (bookId: string) => void;
  onShowCover?: () => void;
  onOpenAcharya?: (slug?: string) => void;
}) {
  const { data: bookData } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });
  // Acharya (guru-parampara) profiles — used to link the author name to its in-app page.
  const { data: acharyas } = useQuery<AcharyaNameRef[]>({
    queryKey: ["/api/acharyas"],
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
  const labels = useMemo(() => detectLevelLabels(chapters), [chapters]);
  const depth = labels.levelLabels.length;
  const author = (bookData?.author && String(bookData.author).trim()) || "Śrī Śaṅkarācārya";
  const authorAcharyaSlug = useMemo(() => matchAcharyaSlug(author, acharyas), [author, acharyas]);
  const authorLinkable = Boolean(authorAcharyaSlug && onOpenAcharya);
  const openAuthorAcharya = () => { if (authorAcharyaSlug && onOpenAcharya) onOpenAcharya(authorAcharyaSlug); };

  // One selected section number per level, outermost first — so a grantha with
  // four levels (Adhyāya › Pāda › Sūtra › Mantra) navigates just like a two-level one.
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const activeVerseRef = useRef<HTMLButtonElement>(null);

  // In chapter-view mode the whole section is open (no single "current verse"),
  // so drive the selectors from that path instead of from the verse.
  const activePath = useMemo(() => {
    if (chapterViewPath && chapterViewPath.length > 0) return chapterViewPath;
    return pathOfVerse(chapters, currentVerseNumber);
  }, [chapters, currentVerseNumber, chapterViewPath]);

  // Keep selectors in sync with what the reader is showing (e.g. after Next/Prev),
  // completing any levels the active path leaves open.
  useEffect(() => {
    if (activePath.length === 0) return;
    setSelectedPath((prev) => {
      const next = completePath(chapters, activePath);
      return next.length === prev.length && next.every((n, i) => n === prev[i]) ? prev : next;
    });
  }, [activePath, chapters]);

  // Default the selectors on first load — the active path above wins when the
  // reader opened straight onto a verse (e.g. Mantra 2.5).
  useEffect(() => {
    if (chapters.length === 0) return;
    // Functional update: the sync effect above may have set a path in the same
    // commit (e.g. opening straight into a chapter view), and that must win.
    setSelectedPath((prev) => (prev.length === 0 ? completePath(chapters, []) : prev));
  }, [chapters, selectedPath]);

  useEffect(() => {
    setTimeout(() => {
      activeVerseRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
  }, [currentVerseNumber]);

  // Options and selection for every level, outermost first.
  const levels = useMemo(() => {
    const out: { label: string; value: number | null; options: { value: number; label: string }[] }[] = [];
    for (let i = 0; i < depth; i++) {
      const options = nodesAtPath(chapters, selectedPath.slice(0, i));
      if (options.length === 0) break;
      out.push({
        label: labels.levelLabels[i],
        value: selectedPath[i] ?? null,
        options: options.map((n) => ({
          value: n.number,
          label: nodeLabel(n, labels.levelLabels[i]),
        })),
      });
    }
    return out;
  }, [chapters, selectedPath, depth, labels]);

  // Picking a section at one level resets the levels below it to their first entry.
  const selectLevel = (levelIndex: number, value: number) => {
    setSelectedPath((prev) => completePath(chapters, [...prev.slice(0, levelIndex), value]));
  };

  const selectedNode = useMemo(() => nodeAtPath(chapters, selectedPath), [chapters, selectedPath]);

  // Per-verse Devanagari preview + id lookups from the raw CMS verses.
  const { previewMap, verseIdMap } = useMemo(() => {
    const preview = new Map<number, string>();
    const ids = new Map<number, string>();
    const verses = bookData?.verses;
    // The book-meta endpoint ships a short Devanagari `preview` per verse. Fall
    // back to a translations[] array or flat text fields for other data sources.
    const pickPreview = (v: any): string => {
      if (v?.preview) return v.preview;
      const trs = Array.isArray(v?.translations) ? v.translations : [];
      const byCode = (code: string) => trs.find((t: any) => t?.languageCode === code)?.content;
      return (
        byCode("devanagari") ?? byCode("sa") ?? byCode("sanskrit") ??
        v?.devanagari ?? v?.text ?? v?.originalText ?? v?.sanskrit ?? v?.verseText ?? v?.content ??
        trs[0]?.content ?? ""
      );
    };
    if (Array.isArray(verses)) {
      for (const v of verses) {
        if (v?.id != null) ids.set(v.verseNumber, v.id);
        const raw = pickPreview(v);
        const plain = String(raw).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        if (plain) preview.set(v.verseNumber, plain);
      }
    }
    return { previewMap: preview, verseIdMap: ids };
  }, [bookData]);

  // Reference label per verse — its section numbers plus its position in the
  // deepest section, e.g. "2.5" (Gītā), "1.2.3" (Chāndogya), "1.1.31.4" (four levels).
  const verseLabelMap = useMemo(() => verseLabels(chapters), [chapters]);

  const labelFor = (vn: number) => verseLabelMap.get(vn) || String(vn);

  const mantraNumbers = useMemo(() => {
    let nums = (selectedNode?.verseNumbers || []).filter((vn) => vn !== 0);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      nums = nums.filter((vn) => labelFor(vn).toLowerCase().includes(q) || (previewMap.get(vn) || "").toLowerCase().includes(q));
    }
    return nums;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, searchQuery, previewMap, verseLabelMap]);

  const video = (bookData?.slug && SIDEBAR_VIDEO_BY_SLUG[bookData.slug]) || DEFAULT_SIDEBAR_VIDEO;

  // Stop playback when navigating to a different book.
  useEffect(() => { setIsVideoPlaying(false); }, [bookId]);

  return (
    <div className="h-full flex flex-col border-r border-border bg-card" data-testid="reader-nav-sidebar">
      {/* Header (fixed) */}
      <div className="p-3 space-y-3 shrink-0 border-b border-border/60">
        {/* Book selector */}
        <button
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => (onShowCover ? onShowCover() : onSelectBook(bookId))}
          data-testid="reader-nav-book-title"
        >
          <span className="font-serif font-semibold text-sm truncate">{bookTitle}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
        </button>

        {/* Author card — the acharya name links to its in-app guru-parampara page. */}
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5" data-testid="reader-nav-author">
          <img src={shankaracharyaImg} alt="" className="h-11 w-11 object-contain shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-center">
            {authorLinkable ? (
              <button
                type="button"
                onClick={openAuthorAcharya}
                className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition-colors"
                data-testid="button-read-biography"
              >
                View Profile
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">Acharya</span>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-primary/40 text-[10px]">&#10086;</span>
              {authorLinkable ? (
                <button
                  type="button"
                  onClick={openAuthorAcharya}
                  className="text-sm font-serif font-semibold text-primary truncate hover:underline underline-offset-2 cursor-pointer bg-transparent border-none p-0"
                  title="View acharya profile"
                  data-testid="link-author-acharya"
                >
                  {author}
                </button>
              ) : (
                <span className="text-sm font-serif font-semibold text-primary truncate">{author}</span>
              )}
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

        {/* One selector per section level the grantha defines */}
        {levels.length > 0 && (
          <div className={levels.length === 1 ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
            {levels.map((level, i) => (
              <SidebarSelect
                key={i}
                label={level.label}
                value={level.value}
                options={level.options}
                onChange={(v) => selectLevel(i, v)}
                testId={i === 0 ? "dropdown-adhyaya" : i === 1 ? "dropdown-khanda" : `dropdown-level-${i + 1}`}
              />
            ))}
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
                {vid && <SidebarBookmark verseId={vid} entry={{ bookId, bookTitle, verseNumber: vn, verseLabel: labelFor(vn) }} />}
              </button>
            );
          })
        ) : (
          <div className="text-[11px] text-muted-foreground text-center py-8 px-3">
            {searchQuery.trim() ? "No results found" : `Select a ${(labels.levelLabels[0] || "section").toLowerCase()}`}
          </div>
        )}
      </div>

      {/* Intro video (fixed) */}
      {video && (
        <div className="shrink-0 border-t border-border/60 p-2.5 space-y-2">
          {isVideoPlaying ? (
            <>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
                  title={`Introduction to ${bookTitle}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  data-testid="reader-nav-video-player"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">Introduction to</p>
                  <p className="text-xs font-semibold text-foreground truncate">{bookTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVideoPlaying(false)}
                  className="shrink-0 flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid="reader-nav-video-close"
                >
                  <X className="h-3 w-3" />
                  Close
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsVideoPlaying(true)}
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
          )}
        </div>
      )}
    </div>
  );
}
