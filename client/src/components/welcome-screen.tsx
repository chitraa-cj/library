import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { BookOpen, Library, FolderOpen, Lock, ArrowLeft, ArrowRight, ChevronRight, ChevronUp, ChevronDown, ScrollText, Feather, Users, Heart, BookMarked, Music, Layers, Search, X, FileText, Archive, Sparkles, Bookmark, Share2, Cloud, LayoutGrid, List, Globe, Languages, ShieldCheck, PenLine, Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import { CATALOG_TREE, type CatalogCategory } from "@/components/app-sidebar";
import { useTranslation } from "@/lib/translations";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations } from "@/lib/content-translations";
import { useProgressSummary } from "@/hooks/use-progress";
import { resolveBookCoverImage } from "@/components/book-landing-cover-hero";
import { useTheme } from "@/components/theme-provider";

import catImgPrasthana from "@assets/cat-prasthana-thraya.png";
import catImgPrakarana from "@assets/cat-prakarana-granthas.png";
import catImgShlokas from "@assets/cat-advaita-traditions.png";
import upanishadPrincipalImg from "@assets/upanishad-principal.png";
import upanishadAdditionalImg from "@assets/upanishad-additional.png";
import shankaracharyaPortrait from "@assets/image_1770455528511.png";
import homeAdvaiticTree from "@assets/home-advaitic-tree.png";
import homeCollectionsShankara from "@assets/home-collections-shankara.jpg";
import homeMandala from "@assets/mantra-mandala.png";
import homeAdiShankara from "@assets/home-adi-shankara-figure.png";

// Dark-mode variants (used on the home, browse, and Upanishad pages)
import catImgPrasthanaDark from "@assets/cat-prasthana-thraya-dark.png";
import catImgPrakaranaDark from "@assets/cat-prakarana-granthas-dark.png";
import catImgShlokasDark from "@assets/cat-advaita-traditions-dark.png";
import upanishadPrincipalDark from "@assets/upanishad-principal-dark.png";
import upanishadAdditionalDark from "@assets/upanishad-additional-dark.png";
import homeAdvaiticTreeDark from "@assets/home-advaitic-tree-dark.png";
import homeMandalaDark from "@assets/mantra-mandala-dark.png";
import quickAccessMandala from "@assets/quick-access-mandala.png";
import quickAccessScene from "@assets/quick-access-scene.png";
import visionMandala from "@assets/vision-mandala.png";
import traditionMandala from "@assets/tradition-mandala.png";
import heroBgLight from "@assets/hero-bg-light.png";
import heroBgDark from "@assets/hero-bg-dark.png";

function BookProgressBar({ bookId, totalVerses, compact = false, alwaysShow = false, unitLabel }: { bookId: string; totalVerses: number | null | undefined; compact?: boolean; alwaysShow?: boolean; unitLabel?: string }) {
  const { data: summary } = useProgressSummary();
  const total = totalVerses ?? 0;
  if (total <= 0) return null;
  const completed = summary ? Math.min(summary[bookId] || 0, total) : 0;
  if (!alwaysShow && completed <= 0) return null;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-1.5 ${compact ? "mt-1" : "mt-2"}`} data-testid={`progress-bar-${bookId}`}>
      <div className={`flex-1 ${compact ? "h-1" : "h-1.5"} rounded-full bg-muted overflow-hidden`}>
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0" data-testid={`progress-pct-${bookId}`}>
        {completed} / {total}{unitLabel ? ` ${unitLabel}` : ""}
      </span>
    </div>
  );
}

/** Appends "Veda" only when the source string doesn't already end with it (avoids "Sama Veda Veda"). */
function formatVeda(veda?: string | null): string {
  if (!veda) return "";
  const trimmed = veda.trim();
  return /veda$/i.test(trimmed) ? trimmed : `${trimmed} Veda`;
}

const categoryImages: Record<string, string> = {
  "prasthana-thraya": catImgPrasthana,
  "prakarana-granthas": catImgPrakarana,
  "other-texts": catImgShlokas,
};

const categoryImagesDark: Record<string, string> = {
  "prasthana-thraya": catImgPrasthanaDark,
  "prakarana-granthas": catImgPrakaranaDark,
  "other-texts": catImgShlokasDark,
};

const categoryIcons: Record<string, typeof ScrollText> = {
  "prasthana-thraya": ScrollText,
  "prakarana-granthas": BookMarked,
  "other-texts": Library,
};

interface Book {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  coverImage: string | null;
  totalVerses: number | null;
  bhashyamName?: string;
  teekasList?: { name: string; author: string }[];
}

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onBrowseLibrary: () => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onOpenAcharya?: (slug?: string) => void;
  languageCode?: string | null;
}

const bookVideoConfig: Record<string, { videoId: string; videoTitle: string }> = {
  "isha-upanishad-bhashya": {
    videoId: "8ELHatzdtAk",
    videoTitle: "Introduction to Isha Upanishad",
  },
};

function getBooksForSubCategory(books: Book[], categoryMatch?: string, categoryAltMatch?: string): Book[] {
  if (!categoryMatch && !categoryAltMatch) return [];
  return books.filter(b => matchesCategory(categoryMatch, categoryAltMatch, b.category));
}

function getBooksForCategory(books: Book[], cat: CatalogCategory): Book[] {
  if (cat.categoryMatch) {
    return books.filter(b => b.category === cat.categoryMatch);
  }
  if (cat.children) {
    const matched: Book[] = [];
    for (const sub of cat.children) {
      matched.push(...getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch));
    }
    return matched;
  }
  return [];
}

function HomeSearchBar({ books, onSelectBook, languageCode }: { books: Book[]; onSelectBook: (bookId: string) => void; languageCode: string | null }) {
  const { t } = useTranslation(languageCode);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, languageCode || "en");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return books.filter(b => {
      const title = (b.title || "").toLowerCase();
      const slug = (b.slug || "").toLowerCase();
      const author = (b.author || "").toLowerCase();
      const desc = (b.description || "").toLowerCase();
      const category = (b.category || "").toLowerCase();
      return title.includes(q) || slug.includes(q) || author.includes(q) || desc.includes(q) || category.includes(q);
    }).slice(0, 8);
  }, [query, books]);

  const showResults = focused && query.trim().length > 0;

  return (
    <div className="relative max-w-lg mx-auto w-full" ref={containerRef} data-testid="home-search-container">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm transition-all ${focused ? "border-primary/40 ring-2 ring-primary/10" : "border-border/60"}`}>
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={t("searchTexts") || "Search Upanishads, Gita, Brahma Sutra..."}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
          data-testid="input-home-search"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="p-0.5 rounded-full hover:bg-muted/50 transition-colors"
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden" data-testid="search-results-dropdown">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="search-no-results">
              {t("noResultsFound") || "No texts found"}
            </div>
          ) : (
            <div className="py-1 max-h-80 overflow-y-auto">
              {results.map((book) => (
                <button
                  key={book.id}
                  onClick={() => {
                    onSelectBook(book.id);
                    setQuery("");
                    setFocused(false);
                  }}
                  className="flex items-start gap-3 w-full px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  data-testid={`search-result-${book.slug}`}
                >
                  <BookOpen className="h-4 w-4 text-primary/70 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{tc(book.title, bookTitleTranslations)}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {book.author && <span>{tc(book.author, bookAuthorTranslations)}</span>}
                      {book.author && book.category && <span> · </span>}
                      {book.category && <span>{tc(book.category, bookCategoryTranslations)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-1 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "Jump to a Specific Text" — miller-column navigator (Book → Adhyaya → Khanda → Mantra). */
function HomeTextNavigator({ books, onSelectBook, onSelectVerse, languageCode }: { books: Book[]; onSelectBook: (bookId: string) => void; onSelectVerse?: (bookId: string, verseNumber: number) => void; languageCode?: string | null }) {
  const welcomeLang = languageCode || "en";
  const tc = (text: string | null | undefined) => translateContent(text, bookTitleTranslations, welcomeLang);

  const CATS = [
    { id: "principal", label: "Principal Upanishads", icon: BookOpen },
    { id: "other", label: "Other Upanishads", icon: BookMarked },
    { id: "gita", label: "Bhagavad Gita", icon: Layers },
    { id: "brahma", label: "Brahma Sutras", icon: FileText },
    { id: "others", label: "Others", icon: FolderOpen },
  ] as const;

  const [cat, setCat] = useState<string>("principal");
  const [bookId, setBookId] = useState<string | null>(null);
  const [adhyay, setAdhyay] = useState<number | null>(null);
  const [khanda, setKhanda] = useState<number | null>(null);
  const [verse, setVerse] = useState<number | null>(null);
  const [qBook, setQBook] = useState("");
  const [qAdh, setQAdh] = useState("");
  const [qKh, setQKh] = useState("");
  const [qMan, setQMan] = useState("");

  const chapters = useBookChapters(bookId || undefined);

  const catBooks = useMemo(() => {
    const ups = books.filter(b => b.category === "Upanishad" || b.category === "Upanishad Bhashya");
    const principalIds = new Set<string>();
    for (const up of PRINCIPAL_UPANISHADS) {
      const b = findBookForPrincipal(up, books);
      if (b) principalIds.add(b.id);
    }
    switch (cat) {
      case "principal": return ups.filter(b => principalIds.has(b.id));
      case "other": return ups.filter(b => !principalIds.has(b.id));
      case "gita": return books.filter(b => b.category === "Gita" || b.category === "Bhagavad Gita");
      case "brahma": return books.filter(b => b.category === "Brahma Sutra");
      default: return books.filter(b => !["Upanishad", "Upanishad Bhashya", "Gita", "Bhagavad Gita", "Brahma Sutra"].includes(b.category || ""));
    }
  }, [books, cat]);

  const selectedChapter = chapters.find(c => c.number === adhyay);
  const khandaList = selectedChapter?.khandas || [];

  // Show only the levels the selected grantha actually has:
  //  - Adhyāya column only when there is more than one adhyāya (a single wrapping
  //    adhyāya, e.g. Isha, collapses to Text › Mantra).
  //  - Khaṇḍa/Pāda column only when some adhyāya is genuinely subdivided.
  const showAdhyaya = chapters.length > 1;
  const showKhanda = showAdhyaya && chapters.some(c => (c.khandas?.length ?? 0) > 1);
  const allVerseNums = chapters.flatMap(c => c.verseNumbers);
  const mantraNums = !showAdhyaya
    ? allVerseNums
    : showKhanda
      ? (khanda != null ? (khandaList.find(k => k.number === khanda)?.verseNumbers ?? []) : [])
      : (selectedChapter?.verseNumbers ?? []);
  const visibleCols = 2 + (showAdhyaya ? 1 : 0) + (showKhanda ? 1 : 0);
  const gridColsClass = visibleCols === 4 ? "lg:grid-cols-4" : visibleCols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  const selectedBook = books.find(b => b.id === bookId);
  // Hierarchy terminology adapts to the selected text (or the active category):
  // Upanishad = Adhyāya › Khaṇḍa › Mantra, Gita = Adhyāya › (—) › Shloka,
  // Brahma Sutra = Adhyāya › Pāda › Sūtra, others = Chapter › Section › Verse.
  const hier = (() => {
    const c = (selectedBook?.category || "").toLowerCase();
    const isGita = /gita/.test(c) || (!c && cat === "gita");
    const isBrahma = /brahma/.test(c) || (!c && cat === "brahma");
    const isUpanishad = /upani/.test(c) || (!c && (cat === "principal" || cat === "other"));
    if (isGita) return { l1: "Adhyāya", l2: "Section", unit: "Shloka" };
    if (isBrahma) return { l1: "Adhyāya", l2: "Pāda", unit: "Sūtra" };
    if (isUpanishad) return { l1: "Adhyāya", l2: "Khaṇḍa", unit: "Mantra" };
    return { l1: "Chapter", l2: "Section", unit: "Verse" };
  })();
  // Show the grantha's real chapter name (e.g. Gita's "Karma Yoga") when present,
  // otherwise fall back to "<Adhyāya> N".
  const adhyayaLabel = (c: { number: number; title?: string | null }) =>
    c.title && !/^chapter\s*\d+$/i.test(c.title.trim()) ? c.title : `${hier.l1} ${c.number}`;
  const num = { adhyaya: 2, khanda: showAdhyaya ? 3 : 2, mantra: visibleCols };
  const reset = (level: "cat" | "book" | "adhyay" | "khanda") => {
    if (level === "cat" || level === "book") { setAdhyay(null); setKhanda(null); setVerse(null); }
    if (level === "adhyay") { setKhanda(null); setVerse(null); }
    if (level === "khanda") { setVerse(null); }
  };

  const colBox = "flex flex-col min-w-0 border-r border-border/50 last:border-r-0 px-3 sm:px-4 first:pl-0 last:pr-0";
  const colHead = "flex items-center gap-2 mb-3";
  const searchBox = "relative mb-2";
  const searchInput = "w-full h-8 rounded-md border border-border/60 bg-background pl-8 pr-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50";
  const rowBase = "w-full flex items-center justify-between gap-1.5 text-left rounded-md px-2.5 py-2 text-sm transition-colors";
  const rowActive = "bg-primary/10 text-primary font-semibold";
  const rowIdle = "text-foreground/80 hover:bg-muted/60";

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 sm:p-7" data-testid="home-text-navigator">
      <div className="flex items-center gap-2.5 mb-1.5">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground">Jump to a Specific Text</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Search and navigate directly to any scripture, chapter, or mantra</p>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <input
          className="w-full h-11 rounded-xl border border-border/60 bg-muted/40 pl-11 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background"
          placeholder="Search any scripture, chapter, mantra..."
          value={qBook}
          onChange={(e) => setQBook(e.target.value)}
          data-testid="input-navigator-search"
        />
      </div>

      <p className="text-xs font-semibold text-foreground mb-2.5">Browse by Category</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {CATS.map(c => {
          const Icon = c.icon;
          const active = cat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCat(c.id); setBookId(null); reset("cat"); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
              data-testid={`navigator-cat-${c.id}`}
            >
              <Icon className="h-4 w-4" /> {c.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          );
        })}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-y-4 border-t border-border/50 pt-4`}>
        {/* Column 1: Books */}
        <div className={colBox}>
          <div className={colHead}><BookOpen className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">1. Text</span></div>
          <div className={searchBox}><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" /><input className={searchInput} placeholder="Search texts..." value={qBook} onChange={e => setQBook(e.target.value)} /></div>
          <div key={cat} className="flex-1 overflow-y-auto max-h-72 pr-1 space-y-0.5 animate-in fade-in-0 duration-300">
            {catBooks.filter(b => tc(b.title).toLowerCase().includes(qBook.toLowerCase())).map(b => (
              <button key={b.id} type="button" onClick={() => { setBookId(b.id); reset("book"); }} className={`${rowBase} ${bookId === b.id ? rowActive : rowIdle}`}>
                <span className="truncate">{tc(b.title)}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </button>
            ))}
            {catBooks.length === 0 && <p className="text-xs text-muted-foreground/60 px-2.5 py-2">No texts here yet.</p>}
          </div>
        </div>

        {/* Column: Adhyaya — only when the grantha has more than one adhyāya */}
        {showAdhyaya && (
          <div className={colBox}>
            <div className={colHead}><Layers className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{num.adhyaya}. {hier.l1}</span></div>
            <div className={searchBox}><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" /><input className={searchInput} placeholder={`Search ${hier.l1.toLowerCase()}s...`} value={qAdh} onChange={e => setQAdh(e.target.value)} /></div>
            <div key={bookId || "none"} className="flex-1 overflow-y-auto max-h-72 pr-1 space-y-0.5 animate-in fade-in-0 duration-300">
              {chapters.filter(c => `${adhyayaLabel(c)} ${c.number} adhyaya`.toLowerCase().includes(qAdh.toLowerCase())).map(c => (
                <button key={c.number} type="button" onClick={() => { setAdhyay(c.number); reset("adhyay"); }} className={`${rowBase} ${adhyay === c.number ? rowActive : rowIdle}`}>
                  <span className="truncate">{adhyayaLabel(c)}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </button>
              ))}
              {bookId && chapters.length === 0 && <p className="text-xs text-muted-foreground/60 px-2.5 py-2">Loading…</p>}
              {!bookId && <p className="text-xs text-muted-foreground/50 px-2.5 py-2">Select a text first.</p>}
            </div>
          </div>
        )}

        {/* Column: Khanda — only when an adhyāya is genuinely subdivided */}
        {showKhanda && (
          <div className={colBox}>
            <div className={colHead}><Bookmark className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{num.khanda}. {hier.l2}</span></div>
            <div className={searchBox}><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" /><input className={searchInput} placeholder={`Search ${hier.l2.toLowerCase()}s...`} value={qKh} onChange={e => setQKh(e.target.value)} /></div>
            <div className="flex-1 overflow-y-auto max-h-72 pr-1 space-y-0.5">
              {khandaList.filter(k => `${hier.l2} ${k.number} khanda`.toLowerCase().includes(qKh.toLowerCase())).map(k => (
                <button key={k.number} type="button" onClick={() => { setKhanda(k.number); reset("khanda"); }} className={`${rowBase} ${khanda === k.number ? rowActive : rowIdle}`}>
                  <span className="truncate">{hier.l2} {k.number}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </button>
              ))}
              {adhyay != null && khandaList.length === 0 && <p className="text-xs text-muted-foreground/50 px-2.5 py-2">No {hier.l2.toLowerCase()} divisions — pick a {hier.unit.toLowerCase()}.</p>}
              {adhyay == null && <p className="text-xs text-muted-foreground/50 px-2.5 py-2">Select an {hier.l1.toLowerCase()}.</p>}
            </div>
          </div>
        )}

        {/* Column: Mantra / Shloka / Sūtra */}
        <div className={colBox}>
          <div className={colHead}><List className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{num.mantra}. {hier.unit}</span></div>
          <div className={searchBox}><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" /><input className={searchInput} placeholder={`Search ${hier.unit.toLowerCase()}s...`} value={qMan} onChange={e => setQMan(e.target.value)} /></div>
          <div className="flex-1 overflow-y-auto max-h-72 pr-1 space-y-0.5">
            {mantraNums.filter((_, i) => `${hier.unit} ${i + 1} mantra`.toLowerCase().includes(qMan.toLowerCase())).map((vn, i) => (
              <button key={vn} type="button" onClick={() => setVerse(vn)} className={`${rowBase} ${verse === vn ? rowActive : rowIdle}`}>
                <span className="truncate">{hier.unit} {i + 1}</span>
              </button>
            ))}
            {mantraNums.length === 0 && (
              <p className="text-xs text-muted-foreground/50 px-2.5 py-2">
                {!bookId ? "Select a text first." : showKhanda ? `Select a ${hier.l2.toLowerCase()}.` : showAdhyaya ? `Select an ${hier.l1.toLowerCase()}.` : "No entries."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Selection breadcrumb + open */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Library className="h-3.5 w-3.5" /> Your Selection</span>
        {selectedBook && <span className="inline-flex items-center gap-1 rounded-md bg-background border border-border/60 px-2 py-1 text-xs text-foreground/80">{tc(selectedBook.title)}</span>}
        {adhyay != null && selectedChapter && <><ChevronRight className="h-3 w-3 text-muted-foreground/50" /><span className="rounded-md bg-background border border-border/60 px-2 py-1 text-xs text-foreground/80">{adhyayaLabel(selectedChapter)}</span></>}
        {khanda != null && <><ChevronRight className="h-3 w-3 text-muted-foreground/50" /><span className="rounded-md bg-background border border-border/60 px-2 py-1 text-xs text-foreground/80">{hier.l2} {khanda}</span></>}
        {verse != null && <><ChevronRight className="h-3 w-3 text-muted-foreground/50" /><span className="rounded-md bg-background border border-border/60 px-2 py-1 text-xs text-foreground/80">{hier.unit} {mantraNums.indexOf(verse) + 1}</span></>}
        <Button
          className="ml-auto gap-2"
          disabled={!bookId}
          onClick={() => {
            if (!bookId) return;
            if (verse != null && onSelectVerse) onSelectVerse(bookId, verse);
            else onSelectBook(bookId);
          }}
          data-testid="button-navigator-open"
        >
          Open Text <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** "Wisdom Without Language Barriers" — sample verse + language-meaning widget. */
function LanguageMeaningWidget() {
  const MEANINGS: Record<string, string> = {
    English: "All this, whatever moves in this world — is pervaded by the Lord. Enjoy through renunciation. Do not covet what belongs to others.",
    "हिन्दी": "इस संसार में जो कुछ भी है, वह सब ईश्वर से व्याप्त है। त्याग के साथ भोग करो, किसी के धन का लोभ मत करो।",
  };
  const [lang, setLang] = useState("English");
  const chips = ["हिन्दी", "Malayalam", "Deutsch", "Français", "日本語", "Español"];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-primary/30 shadow-sm" data-testid="language-widget">
      {/* Left: original Sanskrit */}
      <div className="relative bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-6 sm:p-10 flex flex-col justify-center overflow-hidden">
        <img src={homeMandala} alt="" aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 opacity-20" />
        <img src={homeMandala} alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 opacity-20" />
        <p className="relative text-[11px] uppercase tracking-[0.25em] text-primary-foreground/70 mb-5 text-center">Original Sanskrit</p>
        <p className="relative font-body text-xl sm:text-2xl leading-relaxed text-center">
          ईशावास्यमिदं सर्वं यत्किञ्च जगत्यां जगत् ।<br />तेन त्यक्तेन भुञ्जीथा मा गृधः कस्यस्विद्धनम् ॥
        </p>
        <p className="relative text-sm text-primary-foreground/70 text-center mt-4 font-body">— ईशावास्य उपनिषद् १</p>
      </div>
      {/* Right: translation widget */}
      <div className="bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-foreground/70">See the meaning in your language</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground"><Languages className="h-3 w-3" /> 60+ Languages</span>
        </div>
        <div className="relative mb-4">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full h-11 rounded-lg border border-border/60 bg-background pl-10 pr-3 text-sm appearance-none focus:outline-none focus:border-primary/50"
            data-testid="select-widget-language"
          >
            {Object.keys(MEANINGS).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
          <Quote className="h-5 w-5 text-primary/60 mb-1.5" />
          <p className="text-sm sm:text-base leading-relaxed text-foreground/90">{MEANINGS[lang]}</p>
          <p className="text-xs text-primary/80 italic mt-3">— Isha Vasyopanishad 1</p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mt-5 mb-2.5">Some of the languages we support</p>
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <span key={c} className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground/80">{c}</span>)}
          <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">+54 More</span>
        </div>
      </div>
    </div>
  );
}

/** "Quick Access to Library Collections" — tabbed collections with per-category content. */
function HomeCollections({ books, onSelectBook, onSelectChapter, onBrowseLibrary, onSelectSubCategory, onOpenAcharya, languageCode }: {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onBrowseLibrary: () => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onOpenAcharya?: (slug?: string) => void;
  languageCode?: string | null;
}) {
  const [tab, setTab] = useState("Upanishads");
  const [q, setQ] = useState("");

  // Acharyas come from the read-only /api/acharyas endpoint (guru-parampara).
  const { data: acharyas } = useQuery<{ slug: string; name_iast: string; name_devanagari: string; name_display: string | null }[]>({
    queryKey: ["/api/acharyas"],
  });

  const findBySlug = (slugs: string[]) => {
    for (const s of slugs) { const b = books.find(x => x.slug?.toLowerCase() === s); if (b) return b; }
    for (const s of slugs) { const b = books.find(x => x.slug?.toLowerCase().startsWith(s)); if (b) return b; }
    return null;
  };
  const gitaBook = books.find(b => b.category === "Gita" || b.category === "Bhagavad Gita");
  const brahmaBook = books.find(b => b.category === "Brahma Sutra");
  const openGita = () => (gitaBook ? onSelectBook(gitaBook.id) : onBrowseLibrary());
  const openBrahma = () => (brahmaBook ? onSelectBook(brahmaBook.id) : onBrowseLibrary());
  const openUps = () => onSelectSubCategory?.("prasthana-thraya", "pt-upanishad");
  const openPrakarana = () => onSelectSubCategory?.("prakarana-granthas", "pg-independent");
  const openBook = (slugs: string[], fallback: () => void) => () => { const b = findBySlug(slugs); b ? onSelectBook(b.id) : fallback(); };
  const openGitaCh = (num: number) => () => (gitaBook && onSelectChapter ? onSelectChapter(gitaBook.id, num) : openGita());
  const openBrahmaCh = (num: number) => () => (brahmaBook && onSelectChapter ? onSelectChapter(brahmaBook.id, num) : openBrahma());
  // Open a specific Upanishad by its principal entry (reliable slug match), else the collection.
  const openPrincipal = (up: PrincipalUpanishad) => { const b = findBookForPrincipal(up, books); return b ? () => onSelectBook(b.id) : openUps; };
  // Open a Upanishad/text by fuzzy name match, else fall back.
  const norm = (s?: string | null) => (s || "").toLowerCase().replace(/upani[sṣ]ad|upanishad|upanishat|opanishad|opanisad|opaniṣad/g, "").replace(/[^a-z0-9]/g, "");
  const findBookByName = (name: string) => {
    const key = norm(name);
    return key ? books.find(x => { const tt = norm(x.title); const sl = norm(x.slug); return (tt && (tt.includes(key) || key.includes(tt))) || (sl && (sl.includes(key) || key.includes(sl))); }) : undefined;
  };
  const openNamed = (name: string, fallback: () => void) => () => {
    const b = findBookByName(name);
    b ? onSelectBook(b.id) : fallback();
  };
  type Item = { label: string; onClick: () => void };
  // Only surface texts that actually exist in the library ("show only existing texts").
  const curated = (name: string, slugs?: string[]): Item | null => {
    const b = (slugs && findBySlug(slugs)) || findBookByName(name);
    return b ? { label: b.title, onClick: () => onSelectBook(b.id) } : null;
  };
  const catItems = (cats: string[]): Item[] =>
    books
      .filter(b => cats.includes(b.category || ""))
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
      .map(b => ({ label: b.title, onClick: () => onSelectBook(b.id) }));
  const acharyaItems: Item[] = (acharyas || []).map(a => ({
    label: a.name_display || a.name_iast || a.name_devanagari || a.slug,
    onClick: () => (onOpenAcharya ? onOpenAcharya(a.slug) : onBrowseLibrary()),
  }));

  type Card = { kicker: string; title: string; desc: string; items: Item[] };
  const upItems = catItems(["Upanishad", "Upanishad Bhashya"]);
  const upHalf = Math.ceil(upItems.length / 2);
  const prakaranaItems = catItems(["Prakarana Grantha"]);
  const bhaktiItems = catItems(["Bhakthi Grantha", "Bhakti Grantha", "Bhakthi Stotra"]);
  const TABS: Record<string, Card[]> = {
    Popular: [
      { kicker: "Most Read", title: "Popular Texts", desc: "Frequently studied scriptures across the library.", items: [
        gitaBook ? { label: gitaBook.title, onClick: openGita } : null,
        curated("ishavasya isha"),
        curated("kena"),
        brahmaBook ? { label: brahmaBook.title, onClick: openBrahma } : null,
        curated("vivekachudamani", ["vivekachudamani", "viveka-chudamani"]),
      ].filter(Boolean) as Item[] },
      { kicker: "Begin Here", title: "For Beginners", desc: "Gentle entry points into Advaita Vedanta.", items: [
        curated("tattva bodha", ["tattva-bodha", "tattvabodha"]),
        curated("atma bodha", ["atma-bodha", "atmabodha"]),
        curated("ishavasya isha"),
        curated("drig drishya vivek", ["drig-drishya-vivek", "drig-drishya-viveka"]),
      ].filter(Boolean) as Item[] },
    ],
    Upanishads: upItems.length > 12
      ? [
          { kicker: "Śruti Prasthāna", title: "Upanishads", desc: "Upanishads with Advaita bhāṣyas & commentaries.", items: upItems.slice(0, upHalf) },
          { kicker: "Continued", title: "Upanishads", desc: "More Upanishadic texts in the library.", items: upItems.slice(upHalf) },
        ]
      : [{ kicker: "Śruti Prasthāna", title: "Upanishads", desc: "Upanishads with Advaita bhāṣyas & commentaries.", items: upItems }],
    "Bhagavad Gita": [
      { kicker: "Chapters 1–9", title: "Bhagavad Gita", desc: "The eternal dialogue of Krishna and Arjuna — first half.", items: GITA_CHAPTERS.slice(0, 9).map(c => ({ label: `${c.num}. ${c.transliteration}`, onClick: openGitaCh(c.num) })) },
      { kicker: "Chapters 10–18", title: "Bhagavad Gita", desc: "From the Divine Glories to Liberation — second half.", items: GITA_CHAPTERS.slice(9).map(c => ({ label: `${c.num}. ${c.transliteration}`, onClick: openGitaCh(c.num) })) },
    ],
    "Brahma Sutras": [
      { kicker: "Nyāya Prasthāna", title: "Brahma Sutras", desc: "The logical systematization of Vedanta across four adhyāyas.", items: [
        { label: "1. Samanvaya Adhyāya", onClick: openBrahmaCh(1) },
        { label: "2. Avirodha Adhyāya", onClick: openBrahmaCh(2) },
        { label: "3. Sādhana Adhyāya", onClick: openBrahmaCh(3) },
        { label: "4. Phala Adhyāya", onClick: openBrahmaCh(4) },
      ] },
    ],
    "Prakarana Granthas": prakaranaItems.length > 12
      ? [
          { kicker: "Introductory Treatises", title: "Prakarana Granthas", desc: "Foundational texts by Acharyas explaining the core tenets of Advaita.", items: prakaranaItems.slice(0, Math.ceil(prakaranaItems.length / 2)) },
          { kicker: "Continued", title: "Prakarana Granthas", desc: "More independent Advaita works.", items: prakaranaItems.slice(Math.ceil(prakaranaItems.length / 2)) },
        ]
      : [{ kicker: "Introductory Treatises", title: "Prakarana Granthas", desc: "Foundational texts by Acharyas explaining the core tenets of Advaita.", items: prakaranaItems }],
    Bhakti: [
      { kicker: "Devotional Hymns", title: "Bhakti Stotras", desc: "Hymns of Shankaracharya and the devotional tradition of Advaita.", items: bhaktiItems },
    ],
    Acharyas: [
      { kicker: "The Lineage", title: "Acharyas", desc: "The guru-parampara — tap a master to read their profile and works.", items: acharyaItems },
    ],
  };
  const TAB_KEYS = ["Popular", "Upanishads", "Bhagavad Gita", "Brahma Sutras", "Prakarana Granthas", "Bhakti", "Acharyas"];
  const cards = TABS[tab] || TABS.Upanishads;
  const single = cards.length === 1;
  const ql = q.trim().toLowerCase();

  const renderCard = (card: Card) => {
    const items = ql ? card.items.filter(i => i.label.toLowerCase().includes(ql)) : card.items;
    return (
      <div key={card.title + card.kicker} className="rounded-2xl bg-[#fdf6ee] dark:bg-[#17100a] dark:border dark:border-primary/20 shadow-sm p-5 flex flex-col min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center font-semibold">{card.kicker}</p>
        <h3 className="font-serif text-2xl font-bold text-primary text-center mt-1">{card.title}</h3>
        <p className="text-center text-primary/40 text-sm">— ◇ —</p>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-4">{card.desc}</p>
        <div className="space-y-1.5 overflow-y-auto max-h-72 pr-1">
          {items.map((it, i) => (
            <button key={it.label + i} type="button" onClick={it.onClick} className="w-full flex items-center gap-2 rounded-lg bg-card border border-border/50 px-3 py-2.5 text-left text-sm font-body text-foreground hover:border-primary/40 hover:text-primary transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-primary/40 shrink-0" /><span className="truncate">{it.label}</span>
            </button>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground/60 px-2 py-3 text-center">No matches.</p>}
        </div>
      </div>
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <div className="flex items-center gap-2.5 mb-5">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Quick Access to <span className="text-primary">Library Collections</span></h2>
      </div>
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <input value={q} onChange={e => setQ(e.target.value)} className="w-full h-11 rounded-xl border border-border/60 bg-muted/40 pl-11 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:bg-background" placeholder="Search books, scriptures, acharyas, or traditions..." />
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TAB_KEYS.map((k) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); setQ(""); }}
              className={`rounded-lg border px-3.5 py-2 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
              data-testid={`collection-tab-${k.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {k}
            </button>
          );
        })}
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-primary dark:bg-[#dd5401] dark:border dark:border-primary/25" data-testid="collections-panel">
        {/* Adi Shankaracharya scene — shown complete, figure kept clear on the right (desktop) */}
        <img
          src={quickAccessScene}
          alt="Adi Shankaracharya"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center lg:object-contain lg:object-right"
        />
        <div key={tab} className={`relative grid gap-4 sm:gap-5 p-4 sm:p-6 lg:pr-[42%] animate-in fade-in-0 duration-300 ${single ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
          {cards.map(renderCard)}
        </div>
      </div>
    </section>
  );
}

export function WelcomeScreen({ books, onSelectBook, onSelectVerse, onSelectChapter, onBrowseLibrary, onSelectSubCategory, onOpenAcharya, languageCode }: WelcomeScreenProps) {
  const { t } = useTranslation(languageCode ?? null);
  const { theme } = useTheme();
  const mandalaImg = theme === "dark" ? homeMandalaDark : homeMandala;
  const advaiticTreeImg = theme === "dark" ? homeAdvaiticTreeDark : homeAdvaiticTree;

  const upanishadBooks = useMemo(
    () => books.filter(b => b.category === "Upanishad" || b.category === "Upanishad Bhashya"),
    [books],
  );
  const gitaBooks = useMemo(
    () => books.filter(b => b.category === "Gita" || b.category === "Bhagavad Gita"),
    [books],
  );
  const brahmaSutraBooks = useMemo(
    () => books.filter(b => b.category === "Brahma Sutra"),
    [books],
  );

  const findBookBySlug = (slugs: string[]) => {
    for (const s of slugs) {
      const b = books.find(x => x.slug?.toLowerCase() === s);
      if (b) return b;
    }
    for (const s of slugs) {
      const b = books.find(x => x.slug?.toLowerCase().startsWith(s));
      if (b) return b;
    }
    return null;
  };

  const prakaranaBookList: { title: string; author: string; slugs: string[] }[] = [
    { title: "Vivekachudamani", author: "Adi Shankaracharya", slugs: ["vivekachudamani", "viveka-chudamani"] },
    {
      title: "Sarva Vedanta Siddhanta Saar Sangraha",
      author: "Sri Shankaracharya",
      slugs: ["sarva-vedanta-siddhanta-saar-sangraha", "sarva-vedanta"],
    },
    { title: "Upadesha Sahasri", author: "Adi Shankaracharya", slugs: ["upadesha-sahasri", "upadesa-sahasri"] },
    { title: "Atma Bodha", author: "Adi Shankaracharya", slugs: ["atma-bodha", "atmabodha"] },
    { title: "Tattva Bodha", author: "Adi Shankaracharya", slugs: ["tattva-bodha", "tattvabodha"] },
    { title: "Panchikaranam", author: "Adi Shankaracharya", slugs: ["panchikaranam", "panchikarana"] },
    { title: "Drig Drishya Viveka", author: "Attributed to Shankaracharya", slugs: ["drig-drishya-viveka", "drk-drsya-viveka"] },
  ];

  const tripleCanon = [
    {
      key: "upanishads",
      title: "Upanishads",
      subtitle: "SHRUTI PRASTHANA",
      symbol: "ॐ",
      count: upanishadBooks.length,
      countLabel: "texts",
      subId: "pt-upanishad",
    },
    {
      key: "gita",
      title: "Bhagavad Gita",
      subtitle: "SMRITI PRASTHANA",
      symbol: "卐",
      count: gitaBooks[0]?.totalVerses ? 18 : gitaBooks.length,
      countLabel: "chapters",
      subId: "pt-gita",
    },
    {
      key: "brahmasutra",
      title: "Brahma Sutras",
      subtitle: "NYAYA PRASTHANA",
      symbol: "≈",
      count: 4,
      countLabel: "adhyayas",
      subId: "pt-brahmasutra",
    },
  ];

  const twoSchools = [
    { name: "Bhamati School", members: ["Vachaspati Misra", "Amalananda", "Appayya Dikshita"], colorClass: "border-l-orange-500" },
    { name: "Vivarana School", members: ["Padmapada", "Prakashatman", "Vidyaranya Swami"], colorClass: "border-l-orange-500" },
  ];

  const regionalLuminaries = [
    "Sri Bellamkonda Rama Raya",
    "Shrimad Bodhendra Saraswati",
    "Sringeri Peetham",
    "Kanchi Peetham",
    "Uttaradi Math",
    "Nirmohi Akhada",
  ];

  const manifestations = [
    {
      title: "Varkari Saints",
      tags: ["MARATHI", "VARKARI"],
      description: "Abhangas and ovis exploring the non-dual nature of Vithoba and the self.",
      borderClass: "border-t-amber-500",
      tagClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    },
    {
      title: "Bhakti Saints",
      tags: ["HINDI", "RAJASTHANI", "BHAKTI"],
      description: "Devotional poetry dissolving the veil between the lover and the beloved.",
      borderClass: "border-t-teal-500",
      tagClass: "bg-teal-100 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200",
    },
    {
      title: "Sikh Akhada Granthas",
      tags: ["PUNJABI", "GURMUKHI"],
      description: "Gurbani and Akhada literature on Ik Onkar — the one undivided reality.",
      borderClass: "border-t-purple-500",
      tagClass: "bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200",
    },
  ];

  const guidanceQuestions = [
    "Who am I?",
    "What is the truth of life & experience?",
    "Can I become free from my sense of limitations?",
  ];

  const featureStrip = [
    { icon: PenLine, title: "Rare & Hidden Tikas", desc: "Bringing unknown commentaries into the digital age." },
    { icon: BookOpen, title: "From Scripture to Interpretation", desc: "Connecting every layer of Advaita knowledge." },
    { icon: ShieldCheck, title: "Built on Authentic Sources", desc: "Carefully curated from trusted traditional references." },
    { icon: Languages, title: "Advaita Across Languages", desc: "Translated into 50+ world languages, making the wisdom of Advaita available to all humanity in its purest form." },
  ];

  const langStats = [
    { icon: Globe, title: "60+ Languages", sub: "INDIAN & GLOBAL" },
    { icon: FileText, title: "Complete Structure", sub: "MANTRA, MEANING, BHASHYA" },
    { icon: Users, title: "For Every Seeker", sub: "ACROSS CULTURES & GENERATIONS" },
  ];


  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-y-auto">
      {/* ===== HERO ===== */}
      <section className="relative shrink-0 overflow-hidden bg-background px-4 pt-14 pb-12 sm:pt-16 sm:pb-14 text-center">
        {/* Home hero background art (theme-specific) — kept as a faint watermark */}
        <div
          className="absolute inset-0 pointer-events-none select-none opacity-[0.10] dark:opacity-[0.16]"
          style={{
            backgroundImage: `url(${theme === "dark" ? heroBgDark : heroBgLight})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* warm radial glow behind the title — kept prominent in dark mode so the hero background stays */}
        <div
          className="absolute inset-x-0 top-0 h-[80%] pointer-events-none select-none"
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(ellipse 62% 65% at 50% 34%, rgba(230,81,0,0.32) 0%, rgba(230,81,0,0.10) 42%, transparent 74%)"
                : "radial-gradient(ellipse 55% 60% at 50% 38%, rgba(230,81,0,0.15) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto space-y-6">
          <img src="/favicon.png" alt="Advaita Vaaridhi" className="h-20 sm:h-24 w-auto object-contain mx-auto" />
          <h1 className="font-page-heading text-4xl sm:text-6xl lg:text-[4.25rem] font-bold text-primary tracking-tight leading-[1.05]">
            Advaita Vedanta Digital Library
          </h1>
          <p className="font-body text-lg sm:text-2xl text-primary/70 tracking-wide">
            ब्रह्म सत्यं जगन्मिथ्या जीवो ब्रह्मैव नापरः
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Button onClick={onBrowseLibrary} className="gap-2 h-12 px-7 text-base font-body shadow-md" data-testid="button-hero-browse">
              <BookOpen className="h-5 w-5" /> Browse the Library
            </Button>
            <Button variant="outline" onClick={onBrowseLibrary} className="gap-2 h-12 px-7 text-base font-body border-primary/40 text-primary hover:bg-primary/5 bg-background" data-testid="button-hero-resume">
              Resume Study <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 relative z-10">
        <HomeTextNavigator books={books} onSelectBook={onSelectBook} onSelectVerse={onSelectVerse} languageCode={languageCode} />
      </div>

      {/* ===== EXPRESSIONS OF ADVAITIC VISION ===== */}
      <section className="bg-[#fdf1ec] dark:bg-[#170c07] mt-14 sm:mt-20 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="flex justify-center">
            <img key={advaiticTreeImg} src={advaiticTreeImg} alt="The literary dimensions of Advaita — from Shruti to Bhakti" className="w-full max-w-sm object-contain animate-in fade-in-0 duration-500" draggable={false} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary/70 font-semibold mb-3">Immerse in Non-Dual Nectar</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Expressions of <span className="text-primary">Advaitic Vision</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
              {guidanceQuestions.map((q) => (
                <div key={q} className="relative overflow-hidden rounded-xl border border-primary/20 bg-card px-3 py-4 text-center shadow-sm">
                  <p className="text-sm font-semibold text-primary leading-snug">{q}</p>
                </div>
              ))}
            </div>
            <p className="font-body text-lg sm:text-xl text-foreground text-center border-y border-primary/15 py-3 mb-6">
              <span className="text-primary font-bold">Shastras</span> are the direct means to know the truth of existence.
            </p>
            <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>The vision of oneness finds expression through scriptures, commentaries, philosophical works, devotional literature, and generations of teaching traditions.</p>
              <p>Over centuries, great Acharyas expanded and enriched this wisdom through diverse literary dimensions, each illuminating the same truth from a unique perspective.</p>
              <p>Together, they form a vast compendium of Advaita wisdom.</p>
            </div>
            <div className="mt-6 border-l-2 border-primary/50 pl-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <span className="text-primary font-semibold">Advaita Vaaridhi</span> brings together this rich compendium of Advaita wisdom in one place, making it easier to explore, understand, and preserve for future generations. As a living tradition, the library also embraces modern thought and contemporary contributions that continue to carry the Advaitic vision forward.
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE STRIP ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="rounded-2xl border border-primary/20 bg-[#fdf6ee] dark:bg-primary/[0.04] px-6 sm:px-10 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {featureStrip.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full border border-primary/25 bg-primary/[0.06] flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-bold text-primary leading-snug mb-2">{title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== QUICK ACCESS TO LIBRARY COLLECTIONS ===== */}
      <HomeCollections books={books} onSelectBook={onSelectBook} onSelectChapter={onSelectChapter} onBrowseLibrary={onBrowseLibrary} onSelectSubCategory={onSelectSubCategory} onOpenAcharya={onOpenAcharya} languageCode={languageCode} />

      {/* ===== WISDOM WITHOUT LANGUAGE BARRIERS ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber-700/70 font-semibold mb-3">— Ancient Truths, Modern Access —</p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
            <span className="text-primary">Wisdom</span> Without Language Barriers
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-4 leading-relaxed">
            We make Advaita accessible in <span className="text-primary font-semibold">60+ Indian</span> and global languages so that every seeker, regardless of where they are or what language they speak, can study, understand and live this wisdom.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-border/50 py-6 mb-10">
          {langStats.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3 justify-center sm:justify-start">
              <div className="h-11 w-11 rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-serif text-base font-bold text-foreground leading-tight">{title}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <LanguageMeaningWidget />
      </section>

      {/* ===== MANIFESTATIONS ACROSS TRADITIONS ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Manifestations Across <span className="text-primary">Traditions</span></h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-7 max-w-4xl">
          Non-dual wisdom does not belong to Sanskrit alone. It pours through the abhangas of Maharashtra, the padas of Rajasthan, the Gurbani of the Sikhs, and the Tiruvachakam of Tamil Nadu — each a different shore of the same boundless ocean.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {manifestations.map((m) => (
            <div key={m.title} className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              {/* Orange mandala corner (primary color masked by the mandala art) */}
              <div
                className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 bg-primary opacity-[0.16] select-none"
                style={{
                  WebkitMaskImage: `url(${traditionMandala})`,
                  maskImage: `url(${traditionMandala})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                }}
              />
              <div className="relative flex flex-wrap gap-1.5 mb-3">
                {m.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-semibold tracking-wider">{tag}</span>
                ))}
              </div>
              <h3 className="relative font-serif text-lg font-bold text-foreground mb-1.5">{m.title}</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold mb-3">The Scholastic Tradition — Two Schools</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl border border-border/60 bg-card overflow-hidden mb-10">
          {twoSchools.map((s, i) => (
            <div key={s.name} className={`p-6 ${i === 0 ? "sm:border-r border-border/60 sm:text-left" : "sm:text-right"} text-center`}>
              <h3 className="font-serif text-xl font-bold text-foreground mb-1">{s.name}</h3>
              <p className="text-sm text-muted-foreground">{s.members.join(" · ")}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold mb-3">Regional Luminaries</p>
        <div className="flex flex-wrap gap-2.5">
          {regionalLuminaries.map((name) => (
            <span key={name} className="rounded-full border border-border/60 bg-card px-4 py-2 text-sm text-foreground/80">{name}</span>
          ))}
        </div>
        <button type="button" onClick={onBrowseLibrary} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:gap-1.5 transition-all">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      {/* ===== OUR VISION: SANSKRITIK EKTA ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#b8460e] text-primary-foreground px-6 py-12 sm:px-12 sm:py-16">
          {/* Mandala corner decorations (white line-art watermark) */}
          <img src={visionMandala} alt="" aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] opacity-[0.12] select-none" />
          <img src={visionMandala} alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-52 left-1/4 h-96 w-96 opacity-[0.07] select-none" />
          <img src={visionMandala} alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-44 -left-40 h-80 w-80 opacity-[0.06] select-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            {/* Left: heading + mission */}
            <div>
              <h2 className="font-page-heading text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-tight mb-6">
                Our Vision: Sanskritik Ekta
              </h2>
              <p className="font-body text-base sm:text-lg leading-relaxed italic text-primary-foreground/90">
                In alignment with the mission of Acharya Shankar Sanskritik Ekta Nyas, this library is more than a repository of books; it is a tool for universal harmony. By making the Advaita philosophy accessible to all, we aim to dissolve the boundaries of "otherness" and reveal the underlying unity of all existence.
              </p>
            </div>
            {/* Right: quote box */}
            <div className="rounded-2xl border border-primary-foreground/25 bg-primary-foreground/[0.06] px-8 py-12 sm:px-10 text-center">
              <p className="font-body text-lg sm:text-xl leading-relaxed text-primary-foreground">
                "Brahman is the Only Truth, the World is an appearance, and the Individual Self is none other than Brahman."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES OF THE DIGITAL LIBRARY ===== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex items-center gap-2.5 mb-6">
          <LayoutGrid className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Features of the <span className="text-primary">Digital Library</span></h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Authentic Transcriptions", desc: "Accurately digitized Sanskrit texts with corrected formatting for modern readers." },
            { title: "Manuscript Preservation", desc: "High-resolution scans of rare editions to ensure the longevity of our heritage." },
            { title: "Scholarly Search", desc: "Navigate by author, period, or specific philosophical sub-topic." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border/60 bg-card p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
              <h3 className="font-serif text-lg font-bold text-primary mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== INVITATION ===== */}
      <section className="relative overflow-hidden bg-[#fdf4ec] dark:bg-[#1a110b] px-4 py-16 sm:py-24 text-center">
        <div
          className="absolute inset-0 pointer-events-none select-none opacity-[0.05] dark:opacity-[0.08]"
          style={{ backgroundImage: `url(${mandalaImg})`, backgroundSize: "150px", backgroundRepeat: "repeat" }}
        />
        <div className="relative max-w-2xl mx-auto">
          <blockquote className="font-page-heading text-2xl sm:text-3xl lg:text-4xl text-primary leading-snug mb-5">
            “Knowledge is that which liberates.” <span className="font-hindi-heading text-foreground/80">— सा विद्या या विमुक्तये</span>
          </blockquote>
          <p className="font-body text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-8">
            We invite you to explore this ocean of knowledge. May the grace of Acharya Shankar guide your inquiry from the transient to the Eternal.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={onBrowseLibrary} className="h-12 px-8 text-base font-body shadow-md" data-testid="button-start-reading">Start Reading</Button>
            <Button variant="outline" onClick={onBrowseLibrary} className="h-12 px-8 text-base font-body border-primary/40 text-primary hover:bg-primary/5 bg-transparent" data-testid="button-donate">Donate to Library</Button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-background px-4 py-12 sm:py-14 text-center border-t border-border/40">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img src="/favicon.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
          <span className="font-page-heading text-xl sm:text-2xl text-primary">Advaita Vaaridhi</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-8 text-sm">
          <button type="button" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</button>
          <button type="button" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</button>
          <button type="button" className="text-muted-foreground hover:text-primary transition-colors">Contact Us</button>
          <button type="button" onClick={onBrowseLibrary} className="text-muted-foreground hover:text-primary transition-colors">Library</button>
        </nav>
        <p className="text-sm text-muted-foreground/70 mb-8">Managed by the Acharya Shankar Sanskritik Ekta Nyas, Madhya Pradesh.</p>
        <div className="font-hindi-reading text-primary/35 text-base tracking-[0.3em]">॥ सर्वं खल्विदं ब्रह्म ॥</div>
      </footer>
    </div>
  );
}

function matchesCategory(matcher: string | undefined, altMatcher: string | undefined, bookCategory: string): boolean {
  if (matcher && bookCategory === matcher) return true;
  if (altMatcher && bookCategory === altMatcher) return true;
  return false;
}

function getTranslatedLabel(item: { label: string; labelKey?: string }, t: (key: any) => string): string {
  if (item.labelKey) {
    const translated = t(item.labelKey);
    if (translated !== item.labelKey) return translated;
  }
  return item.label;
}

function getTranslatedSubtitle(item: { subtitle?: string; subtitleKey?: string }, t: (key: any) => string): string {
  if (item.subtitleKey) {
    const translated = t(item.subtitleKey);
    if (translated !== item.subtitleKey) return translated;
  }
  return item.subtitle || "";
}

function getTranslatedDescription(item: { description?: string; descriptionKey?: string }, t: (key: any) => string): string {
  if (item.descriptionKey) {
    const translated = t(item.descriptionKey);
    if (translated !== item.descriptionKey) return translated;
  }
  return item.description || "";
}

interface LibraryCatalogProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onGoBack: () => void;
  languageCode?: string | null;
}

export function LibraryCatalogView({ books, onSelectBook, onSelectCategory, onSelectSubCategory, onGoBack, languageCode }: LibraryCatalogProps) {
  const { t } = useTranslation(languageCode ?? null);
  const { theme } = useTheme();
  const welcomeLang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, welcomeLang);
  const [showGuidance, setShowGuidance] = useState(true);

  const guidanceColumns = [
    {
      categoryId: "prasthana-thraya",
      heading: "New to Vedanta?",
      body: "Begin with Prasthanatrayi, the foundational scriptures.",
      cta: "Go to Prasthanatrayi",
    },
    {
      categoryId: "prakarana-granthas",
      heading: "Looking to understand Vedantic concepts?",
      body: "Explore Prakarana Granthas, teaching texts by Acharyas.",
      cta: "Go to Prakarana Granthas",
    },
    {
      categoryId: "other-texts",
      heading: "Seeking devotional & contemplative literature?",
      body: "Browse Advaita Traditions, devotional works and more.",
      cta: "Go to Advaita Traditions",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.015] dark:text-primary/[0.02] font-body">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.015] dark:text-primary/[0.02] font-body rotate-12">ॐ</div>
      </div>

      <div className="max-w-6xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1.5 text-xs text-muted-foreground"
            data-testid="button-library-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("backToHomeWelcome")}
          </Button>
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6 text-primary shrink-0" />
            <h1 className="font-page-heading text-lg sm:text-2xl font-semibold text-primary" data-testid="heading-browse-library">
              {t("browseTheLibrary")}
            </h1>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/50 via-primary/25 to-transparent"></div>
          </div>
        </div>

        {/* Guidance banner */}
        {showGuidance ? (
          <div className="relative flex flex-col sm:flex-row items-start gap-4 sm:gap-6 rounded-2xl border border-primary/15 bg-[#fdf4ea] dark:bg-primary/[0.06] px-4 sm:px-6 py-4 sm:py-5" data-testid="library-guidance">
            <img
              src={shankaracharyaPortrait}
              alt=""
              aria-hidden="true"
              className="h-16 sm:h-20 w-auto object-contain shrink-0"
              draggable={false}
            />
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-serif text-lg sm:text-2xl font-semibold text-primary leading-tight">
                  Need help choosing?
                </h2>
                <button
                  type="button"
                  onClick={() => setShowGuidance(false)}
                  className="flex items-center gap-1 text-xs sm:text-sm text-primary/70 hover:text-primary transition-colors shrink-0"
                  data-testid="button-hide-guidance-library"
                >
                  Hide Guidance <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {guidanceColumns.map((col) => (
                  <div key={col.categoryId}>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{col.heading}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">{col.body}</p>
                    <button
                      type="button"
                      onClick={() => onSelectCategory?.(col.categoryId)}
                      className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:gap-1.5 transition-all"
                      data-testid={`link-guidance-${col.categoryId}`}
                    >
                      {col.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGuidance(true)}
            className="flex items-center gap-1 text-sm text-primary/80 hover:text-primary transition-colors"
            data-testid="button-show-guidance-library"
          >
            Show Guidance <ChevronDown className="h-4 w-4" />
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5" data-testid="catalog-tree">
          {CATALOG_TREE.map(cat => {
            const catBooks = getBooksForCategory(books, cat);
            const catImage = (theme === "dark" ? categoryImagesDark : categoryImages)[cat.id];

            return (
              <Card
                key={cat.id}
                className="group p-0 overflow-hidden border-primary/20 bg-card/90 backdrop-blur-sm flex flex-col hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all rounded-xl"
                data-testid={`card-category-${cat.id}`}
              >
                <div
                  className="relative cursor-pointer"
                  onClick={() => onSelectCategory?.(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  {/* Product-image header on a warm parchment gradient */}
                  <div className="relative h-40 sm:h-44 overflow-hidden bg-gradient-to-br from-[#f6ead7] via-[#f3e2ca] to-[#efd9b8] dark:from-[#1c130d] dark:via-[#160f0a] dark:to-[#120b07] flex items-center justify-center">
                    {catImage ? (
                      <img
                        key={catImage}
                        src={catImage}
                        alt={getTranslatedLabel(cat, t)}
                        className="h-full w-full object-contain p-3 mix-blend-multiply transition-transform duration-500 group-hover:scale-105 animate-in fade-in-0"
                        draggable={false}
                      />
                    ) : null}
                    {catBooks.length > 0 && (
                      <span
                        className="absolute top-3 left-3 rounded-md border border-primary/40 bg-background/85 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm"
                        data-testid={`badge-count-${cat.id}`}
                      >
                        {catBooks.length} {catBooks.length === 1 ? t("textSingular") : t("textPlural")}
                      </span>
                    )}
                  </div>

                  <div className="px-5 sm:px-6 pt-4 pb-3">
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-tight">
                      {getTranslatedLabel(cat, t)}
                    </h3>

                    {cat.subtitle && (
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary/70 font-medium mt-1.5">
                        {getTranslatedSubtitle(cat, t)}
                      </p>
                    )}

                    {cat.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-3">
                        {getTranslatedDescription(cat, t)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-primary/10 flex-1 px-4 sm:px-5 py-3 sm:py-4 space-y-1">
                  {cat.children ? (
                    cat.children.map(sub => {
                      const subBooks = getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch);
                      const hasSubBooks = subBooks.length > 0;
                      return (
                        <button
                          key={sub.id}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${hasSubBooks ? "hover:bg-primary/10 text-primary font-medium" : "text-muted-foreground/50 cursor-default"}`}
                          onClick={() => {
                            if (hasSubBooks) {
                              if (onSelectSubCategory) {
                                onSelectSubCategory(cat.id, sub.id);
                              } else {
                                onSelectCategory?.(cat.id);
                              }
                            }
                          }}
                          data-testid={`button-subcat-${sub.id}`}
                        >
                          {hasSubBooks ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                          )}
                          <span className="truncate">{getTranslatedLabel(sub, t)}</span>
                          {!hasSubBooks && (
                            <span className="text-[10px] text-muted-foreground/30 ml-auto italic shrink-0">{t("soon")}</span>
                          )}
                        </button>
                      );
                    })
                  ) : catBooks.length > 0 ? (
                    catBooks.map(book => (
                      <button
                        key={book.id}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-primary/10 transition-colors group"
                        onClick={() => onSelectBook(book.id)}
                        data-testid={`button-book-${book.slug}`}
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                        <span className="text-sm font-body text-foreground group-hover:text-primary transition-colors truncate">
                          {tc(book.title, bookTitleTranslations)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-3 text-center">
                      <span className="text-xs text-muted-foreground/40 italic">{t("comingSoon")}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center pb-4">
          <div className="text-primary/25 text-xs tracking-widest font-body">
            ॥ सर्वं खल्विदं ब्रह्म ॥
          </div>
        </div>
      </div>
    </div>
  );
}

interface PrasthanaCard {
  subCategoryId: string;
  prasthanaLabel: string;
  title: string;
  devanagari: string;
  description: string;
  countLabel: string;
  icon: typeof BookOpen;
}

const PRASTHANA_CARDS: PrasthanaCard[] = [
  {
    subCategoryId: "pt-upanishad",
    prasthanaLabel: "Shruti Prasthana",
    title: "Upanishads",
    devanagari: "उपनिषद्",
    description: "The revealed wisdom of the Vedas. Containing the core philosophical teachings regarding the nature of Brahman and Atman.",
    countLabel: "12 Major Texts",
    icon: BookOpen,
  },
  {
    subCategoryId: "pt-gita",
    prasthanaLabel: "Smriti Prasthana",
    title: "Bhagavad Gita",
    devanagari: "भगवद्गीता",
    description: "The practical application of Vedantic truth delivered by Sri Krishna on the battlefield of Kurukshetra.",
    countLabel: "18 Chapters",
    icon: ScrollText,
  },
  {
    subCategoryId: "pt-brahmasutra",
    prasthanaLabel: "Nyaya Prasthana",
    title: "Brahma Sutras",
    devanagari: "ब्रह्मसूत्र",
    description: "The logical systematization of Vedantic thought, reconciling apparent contradictions in the Upanishads.",
    countLabel: "555 Sutras",
    icon: Layers,
  },
];

function PrasthanaThriyaLandingPage({ categoryId, books, onSelectSubCategory }: {
  categoryId: string;
  books: Book[];
  onSelectSubCategory: (categoryId: string, subCategoryId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 sm:p-8 lg:p-10" data-testid="prasthana-thraya-landing">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-page-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            Prasthana Thraya
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Explore the three points of departure for the study of Vedanta. These pillars form the basis of Adi Shankaracharya's non-dual philosophy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5" data-testid="prasthana-cards">
          {PRASTHANA_CARDS.map((card) => {
            const IconComp = card.icon;
            return (
              <Card
                key={card.subCategoryId}
                className="group flex flex-col border-border/60 bg-card hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer rounded-xl overflow-hidden"
                onClick={() => onSelectSubCategory(categoryId, card.subCategoryId)}
                data-testid={`prasthana-card-${card.subCategoryId}`}
              >
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  <div className="p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/15 w-fit mb-5">
                    <IconComp className="h-6 w-6 text-primary" />
                  </div>

                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">
                    {card.prasthanaLabel}
                  </p>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
                    {card.title}
                  </h2>
                  <p className="font-body text-sm text-foreground/50 mt-0.5">
                    {card.devanagari}
                  </p>

                  <p className="text-sm text-muted-foreground mt-4 leading-relaxed flex-1">
                    {card.description}
                  </p>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
                    <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">
                      {card.countLabel}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center group-hover:bg-primary transition-colors">
                      <ArrowRight className="h-4 w-4 text-background" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <div className="text-primary/25 text-xs tracking-widest font-body">
            ॥ सर्वं खल्विदं ब्रह्म ॥
          </div>
        </div>
      </div>
    </div>
  );
}

interface CategoryDetailViewProps {
  categoryId: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onGoBack: () => void;
  languageCode?: string | null;
}

export function CategoryDetailView({ categoryId, books, onSelectBook, onSelectSubCategory, onGoBack, languageCode }: CategoryDetailViewProps) {
  const category = CATALOG_TREE.find(c => c.id === categoryId);
  if (!category) return null;
  const { t } = useTranslation(languageCode ?? null);
  const catLang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, catLang);

  const booksBySubCategory: Record<string, Book[]> = {};
  const allCatBooks: Book[] = [];
  for (const book of books) {
    if (category.children) {
      for (const sub of category.children) {
        if (matchesCategory(sub.categoryMatch, sub.categoryAltMatch, book.category)) {
          if (!booksBySubCategory[sub.id]) booksBySubCategory[sub.id] = [];
          booksBySubCategory[sub.id].push(book);
          allCatBooks.push(book);
        }
      }
    }
    if (category.categoryMatch && book.category === category.categoryMatch) {
      if (!booksBySubCategory[category.id]) booksBySubCategory[category.id] = [];
      booksBySubCategory[category.id].push(book);
      allCatBooks.push(book);
    }
  }

  if (categoryId === "prasthana-thraya" && onSelectSubCategory) {
    return (
      <PrasthanaThriyaLandingPage
        categoryId={categoryId}
        books={books}
        onSelectSubCategory={onSelectSubCategory}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background" data-testid="category-detail-view">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

          <div className="lg:w-72 shrink-0 lg:sticky lg:top-4 lg:self-start">
            <Card className="p-5 border-border/60 bg-card flex flex-col max-h-[calc(100dvh-5.5rem)] min-h-0" data-testid="category-overview-panel">
              <div className="shrink-0">
              <h2 className="font-serif text-lg font-semibold text-foreground" data-testid="text-category-title">
                {getTranslatedLabel(category, t)}
              </h2>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-3" data-testid="label-category-overview">
                {t("categoryOverview")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {getTranslatedDescription(category, t)}
              </p>

              <div className="h-px bg-border my-4"></div>

              <p className="text-xs font-semibold text-foreground uppercase tracking-wider" data-testid="label-texts-chapters">
                {t("textsAndChapters")}
              </p>
              </div>
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-1 pr-0.5" data-testid="scripture-tree">
                {category.children ? (
                  category.children.map(sub => {
                    const subBooks = booksBySubCategory[sub.id] ?? [];
                    const hasBooks = subBooks.length > 0;
                    return (
                      <button
                        key={sub.id}
                        className={`flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm transition-colors ${
                          hasBooks ? "hover:bg-accent cursor-pointer" : "opacity-40 cursor-default"
                        }`}
                        onClick={() => {
                          if (hasBooks && onSelectSubCategory) {
                            onSelectSubCategory(categoryId, sub.id);
                          }
                        }}
                        data-testid={`tree-subcat-${sub.id}`}
                      >
                        <div>
                          <span className="font-medium text-foreground">{getTranslatedLabel(sub, t)}</span>
                          {hasBooks && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <BookOpen className="h-3 w-3" />
                              <span>{subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}</span>
                            </div>
                          )}
                        </div>
                        {hasBooks && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  booksBySubCategory[category.id]?.map(book => (
                    <button
                      key={book.id}
                      className="flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => onSelectBook(book.id)}
                      data-testid={`tree-book-${book.slug}`}
                    >
                      <div>
                        <span className="font-medium text-foreground">{tc(book.title, bookTitleTranslations)}</span>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span>{book.totalVerses ?? 0} {t("verses")}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            {category.children ? (
              <div className="space-y-6" data-testid="subcategory-grid">
                {category.children.map(sub => {
                  const subBooks = booksBySubCategory[sub.id] ?? [];
                  if (subBooks.length === 0) return null;
                  return (
                    <div key={sub.id}>
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
                        <div className="w-1 h-5 rounded-full bg-primary/60"></div>
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-testid={`subcat-heading-${sub.id}`}>
                          {getTranslatedLabel(sub, t)}
                        </h3>
                        <span className="text-[10px] text-muted-foreground ml-auto">{subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {subBooks.map(book => (
                          <Card
                            key={book.id}
                            className="group relative border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden border-l-[3px] border-l-primary/50 hover:border-l-primary"
                            onClick={() => onSelectBook(book.id)}
                            data-testid={`card-book-${book.slug || book.id}`}
                          >
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-serif text-base font-semibold text-foreground leading-snug">
                                    {tc(book.title, bookTitleTranslations)}
                                  </h3>
                                  {book.author && (
                                    <p className="text-xs text-primary/80 mt-1 font-medium">
                                      {tc(book.author, bookAuthorTranslations)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
                                  <BookOpen className="h-3 w-3" />
                                  <span>{t("openText")}</span>
                                </div>
                              </div>
                              {book.description && (
                                <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                                  {tc(book.description, bookDescriptionTranslations)}
                                </p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {booksBySubCategory[category.id]?.map(book => (
                  <Card
                    key={book.id}
                    className="group relative border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden border-l-[3px] border-l-primary/50 hover:border-l-primary"
                    onClick={() => onSelectBook(book.id)}
                    data-testid={`card-book-${book.slug || book.id}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif text-base font-semibold text-foreground leading-snug">
                            {tc(book.title, bookTitleTranslations)}
                          </h3>
                          {book.author && (
                            <p className="text-xs text-primary/80 mt-1 font-medium">
                              {tc(book.author, bookAuthorTranslations)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
                          <BookOpen className="h-3 w-3" />
                          <span>{t("openText")}</span>
                        </div>
                      </div>
                      {book.description && (
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                          {tc(book.description, bookDescriptionTranslations)}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}

interface BookLandingData {
  iastTitle: string;
  devanagariTitle: string;
  authorIast: string;
  verseCount: string;
  verseLabel: string;
  veda?: string;
  quote: string;
  introTitle: string;
  introText: string;
  structureTitle: string;
  structureItems: { title: string; description: string }[];
  extraSection?: { title: string; text: string };
  ctaLabel: string;
  sidebarLabel: string;
  sidebarDescription: string;
  sidebarTreeLabel: string;
}

const BOOK_LANDING_DATA: Record<string, BookLandingData> = {
  "pt-gita": {
    iastTitle: "Śrīmad Bhagavad Gītā",
    devanagariTitle: "श्रीमद्भगवद्गीता",
    authorIast: "Veda Vyāsa",
    verseCount: "701",
    verseLabel: "Verses",
    quote: '"The Bhagavad Gita is the essence of the Upanishads. It is a universal scripture applicable to people of all temperaments and for all times."',
    introTitle: "Introduction",
    introText: 'The "Song of the Lord" is a 700-verse dialogue set on the battlefield of Kurukshetra. It represents the spiritual struggle of the human soul, where Arjuna faces a crisis of conscience and Krishna provides the wisdom to transcend duality.',
    structureTitle: "Structural Hexads",
    structureItems: [
      { title: "Karma Shatka (1–6)", description: "Nature of the individual soul (Tvam) and the path of action." },
      { title: "Bhakti Shatka (7–12)", description: "Nature of the Supreme Lord (Tat) and the path of devotion." },
      { title: "Jñāna Shatka (13–18)", description: "Unity of Jīva and Brahman (Asi) and the path of knowledge." },
    ],
    ctaLabel: "Open Text",
    sidebarLabel: "Bhagavad Gita",
    sidebarDescription: "The Smriti Prasthana: The dialogue between Krishna and Arjuna, synthesizing the wisdom of the Upanishads.",
    sidebarTreeLabel: "Texts & Chapters",
  },
  "pt-brahmasutra": {
    iastTitle: "Brahmasūtra",
    devanagariTitle: "ब्रह्मसूत्र",
    authorIast: "Sage Bādarāyaṇa",
    verseCount: "555",
    verseLabel: "Sūtras",
    quote: '"Atha-ato brahma-jijñāsā — Now, therefore, the inquiry into Brahman."',
    introTitle: "Introduction",
    introText: 'The Brahma Sutras, also known as the Vedanta Sutras, are one of the most important texts of Hindu philosophy. They reconcile the seemingly contradictory statements found in the various Upanishads by presenting a logical, unified framework of Vedantic thought.',
    structureTitle: "The Four Adhyāyas",
    structureItems: [
      { title: "Samanvaya (Harmony)", description: "Systematically correlates all Upanishadic passages to point to Brahman." },
      { title: "Avirodha (Non-Conflict)", description: "Refutes the objections and alternative theories of other schools." },
      { title: "Sādhana (The Means)", description: "Discusses the process of spiritual practice and the acquisition of knowledge." },
      { title: "Phala (The Fruit)", description: "Describes the result of Self-knowledge — liberation (Moksha)." },
    ],
    extraSection: {
      title: "Adi Shankara's Role",
      text: "Adi Shankaracharya's commentary (Bhashya) on the Brahma Sutras is the cornerstone of Advaita Vedanta. His interpretation demonstrates that the Sutras teach the absolute identity of Atman and Brahman, and that liberation is attained through knowledge (Jñāna) alone.",
    },
    ctaLabel: "Open Bhashya",
    sidebarLabel: "Brahma Sutra",
    sidebarDescription: "The Nyāya Prasthāna: Logical systematization of Vedantic thought authored by Sage Badarayana.",
    sidebarTreeLabel: "Adhyāyas & Pādas",
  },
};

interface KhandaInfo {
  number: number;
  title: string;
  count: number;
  verseNumbers: number[];
}

interface ChapterInfo {
  number: number;
  title: string;
  verseCount: number;
  khandas?: KhandaInfo[];
  verseNumbers: number[];
}

function useBookChapters(bookId: string | undefined) {
  const { data } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });

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
}

function IntroSection({ title, cmsDescription, introText, compact = false }: {
  title: string;
  cmsDescription: string | null;
  introText: string;
  bookId?: string;
  languageCode?: string | null;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const primaryIntro = cmsDescription;
  const fullText = [primaryIntro, introText && (!primaryIntro || introText !== primaryIntro) ? introText : null].filter(Boolean).join("\n\n");
  const previewLength = compact ? 100 : 200;
  const needsTruncation = fullText.length > previewLength;
  const displayText = !expanded && needsTruncation
    ? fullText.substring(0, previewLength).replace(/\s+\S*$/, "") + "..."
    : fullText;

  return (
    <div className={compact ? "min-h-0" : undefined}>
      <h3 className={`font-serif font-bold text-foreground uppercase tracking-wider ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
        {title}
      </h3>
      {displayText.split("\n\n").map((paragraph, idx) => (
        <p key={idx} className={`text-muted-foreground leading-relaxed ${compact ? `text-xs mt-1 ${expanded ? "" : "line-clamp-2"}` : "text-sm mt-3"}`}>
          {paragraph}
        </p>
      ))}
      {needsTruncation && (
        <Button
          variant="link"
          size="sm"
          className="px-0 h-auto mt-2 text-primary text-xs font-semibold uppercase tracking-wider gap-1"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-read-introduction"
        >
          {expanded ? "Show Less" : "Read Introduction"}
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </Button>
      )}
    </div>
  );
}

function LandingNavSidebar({ book, chapters, landingData, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, tc }: {
  book: Book;
  chapters: ChapterInfo[];
  landingData: BookLandingData;
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onSelectPart?: (bookId: string, adhyayNumber: number, khandaNumber: number) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
}) {
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [expandedKhanda, setExpandedKhanda] = useState<string | null>(null);

  const handleChapterClick = (ch: ChapterInfo) => {
    if (ch.khandas && ch.khandas.length > 0) {
      setExpandedChapter(expandedChapter === ch.number ? null : ch.number);
      setExpandedKhanda(null);
    } else {
      if (expandedChapter === ch.number) {
        setExpandedChapter(null);
      } else {
        setExpandedChapter(ch.number);
      }
    }
  };

  const handleKhandaClick = (chNum: number, khNum: number) => {
    const key = `${chNum}-${khNum}`;
    setExpandedKhanda(expandedKhanda === key ? null : key);
  };

  const renderVerseGrid = (verseNumbers: number[], bookId: string, chapterNum?: number, khandaNum?: number) => (
    <div className="flex flex-wrap gap-1 mt-1.5 mb-1" data-testid="verse-number-grid">
      {verseNumbers.map((vn, idx) => {
        const label =
          chapterNum != null && khandaNum != null
            ? `${chapterNum}.${khandaNum}.${idx + 1}`
            : chapterNum != null
              ? `${chapterNum}.${idx + 1}`
              : String(vn);
        return (
          <button
            key={vn}
            onClick={() => onSelectVerse ? onSelectVerse(bookId, vn) : onSelectBook(bookId)}
            className="min-w-[2.5rem] h-8 px-2 rounded-md text-[11px] font-medium border border-border/40 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center"
            data-testid={`nav-verse-${vn}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-1" data-testid="landing-chapter-tree">
      <button
        className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
        onClick={() => onSelectBook(book.id)}
        data-testid="tree-book-main"
      >
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium text-primary truncate">{tc(book.title, bookTitleTranslations)}</span>
      </button>

      {chapters.map((ch, idx) => {
        const isExpanded = expandedChapter === ch.number;
        const hasKhandas = ch.khandas && ch.khandas.length > 0;
        const chapterLabel = ch.title.includes(' - ') ? ch.title.split(' - ').pop()?.trim() : ch.title;

        return (
          <div key={ch.number} data-testid={`nav-chapter-${ch.number}`}>
            <button
              className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isExpanded ? "bg-accent text-foreground font-medium" : "hover:bg-accent/60 text-foreground/80"
              }`}
              onClick={() => handleChapterClick(ch)}
              data-testid={`tree-chapter-${ch.number}`}
            >
              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 font-mono">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="truncate flex-1">{chapterLabel}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{ch.verseCount}</span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>

            {isExpanded && (
              <div className="ml-5 pl-2 border-l-2 border-primary/15 mt-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                {hasKhandas ? (
                  ch.khandas!.map((kh) => {
                    const khandaKey = `${ch.number}-${kh.number}`;
                    const isKhandaExpanded = expandedKhanda === khandaKey;
                    return (
                      <div key={kh.number} data-testid={`nav-khanda-${ch.number}-${kh.number}`}>
                        <button
                          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                            isKhandaExpanded ? "bg-primary/5 text-primary font-medium" : "hover:bg-accent/50 text-foreground/70"
                          }`}
                          onClick={() => handleKhandaClick(ch.number, kh.number)}
                          data-testid={`tree-khanda-${ch.number}-${kh.number}`}
                        >
                          <span className="truncate flex-1">{kh.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{kh.count}</span>
                          <ChevronRight className={`h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform ${isKhandaExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {isKhandaExpanded && (
                          <div className="pl-2 animate-in slide-in-from-top-1 duration-150">
                            {renderVerseGrid(kh.verseNumbers, book.id, ch.number, kh.number)}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  renderVerseGrid(ch.verseNumbers, book.id, ch.number)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookLandingPage({ book, landingData, chapters, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, t, tc, languageCode, onBack, backLabel, hierarchyLegend, onCoverBookChange }: {
  book: Book;
  landingData: BookLandingData;
  chapters: ChapterInfo[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onSelectPart?: (bookId: string, adhyayNumber: number, khandaNumber: number) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  t: (key: any) => string;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
  languageCode?: string | null;
  onBack?: () => void;
  backLabel?: string;
  hierarchyLegend?: { label: string; dotClass: string }[];
  onCoverBookChange?: (info: { bookId: string; title: string } | null) => void;
}) {
  const coverImage = resolveBookCoverImage(book);

  const coverTitle = landingData.iastTitle || book.title || "";
  useEffect(() => {
    onCoverBookChange?.({ bookId: book.id, title: coverTitle });
    return () => onCoverBookChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, coverTitle]);

  const chapterCount = chapters.length;
  const commentators = [
    ...(book.author
      ? [{
          name: book.author,
          role: "Bhāṣyakāra (Commentator)",
          sub: book.bhashyamName,
          icon: Users,
          primary: true,
        }]
      : []),
    ...((book.teekasList ?? []).map((teeka) => ({
      name: teeka.author || teeka.name,
      role: "Ṭīkākāras (Sub-commentators)",
      sub: teeka.author && teeka.name ? teeka.name : undefined,
      icon: Feather,
      primary: false,
    }))),
  ];

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-background"
      data-testid="book-landing-view"
    >
      <div className="w-full mx-auto max-w-[min(98vw,88rem)] px-3 sm:px-5 lg:px-7 py-4 sm:py-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-7 lg:items-start">

          {/* Sidebar */}
          <aside className="lg:w-[clamp(13rem,19vw,17.5rem)] shrink-0 lg:sticky lg:top-4 lg:self-start">
            <Card
              className="p-3 sm:p-4 border-border/70 bg-card/90 backdrop-blur-sm shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.45)] flex flex-col max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-y-contain"
              data-testid="book-landing-sidebar"
            >
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors mb-3 -ml-0.5"
                  data-testid="button-back-to-upanishads"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel ?? "Back"}
                </button>
              )}

              <h2 className="font-serif text-lg font-semibold text-foreground leading-tight" data-testid="text-landing-title">
                {landingData.sidebarLabel}
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {landingData.sidebarDescription}
              </p>

              <div className="h-px bg-border my-3.5"></div>

              <p className="text-[10px] font-semibold text-foreground uppercase tracking-[0.15em] mb-2">
                {landingData.sidebarTreeLabel}
              </p>
              <div className="pr-0.5">
                <LandingNavSidebar
                  book={book}
                  chapters={chapters}
                  landingData={landingData}
                  onSelectBook={onSelectBook}
                  onSelectChapter={onSelectChapter}
                  onSelectPart={onSelectPart}
                  onSelectVerse={onSelectVerse}
                  tc={tc}
                />
              </div>

              {hierarchyLegend && hierarchyLegend.length > 0 && (
                <>
                  <div className="h-px bg-border my-3.5"></div>
                  <div className="space-y-2" data-testid="landing-hierarchy-legend">
                    {hierarchyLegend.map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotClass}`} />
                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0" data-testid="book-landing-content">

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="font-page-heading font-bold text-foreground leading-tight tracking-tight text-3xl sm:text-4xl lg:text-[2.75rem]">
                  {landingData.iastTitle}
                </h1>
                {landingData.devanagariTitle && (
                  <p className="font-body text-foreground/60 mt-1 text-lg sm:text-xl">
                    {landingData.devanagariTitle}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="shrink-0 gap-2 border-primary/40 bg-background/85 text-primary hover:bg-primary/10 hover:border-primary/60 font-semibold uppercase text-xs tracking-wider shadow-sm"
                onClick={() => onSelectBook(book.id)}
                data-testid="button-open-text-landing"
              >
                <BookOpen className="h-4 w-4" />
                {landingData.ctaLabel}
              </Button>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs sm:text-sm text-muted-foreground" data-testid="landing-meta-row">
              {landingData.veda && (
                <span className="inline-flex items-center gap-1.5">
                  <BookMarked className="h-3.5 w-3.5 text-primary/70" />
                  {formatVeda(landingData.veda)}
                </span>
              )}
              {chapterCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary/70" />
                  {chapterCount} {chapterCount === 1 ? "Chapter" : "Chapters"}
                </span>
              )}
              {landingData.verseCount && landingData.verseCount !== "0" && (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary/70" />
                  {landingData.verseCount} {landingData.verseLabel}
                </span>
              )}
            </div>

            {/* Commentarial tradition */}
            {commentators.length > 0 && (
              <div className="mt-5" data-testid="landing-commentarial-tradition">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-3">
                  Commentarial Tradition
                </p>
                <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                  {commentators.map((c, idx) => {
                    const Icon = c.icon;
                    return (
                      <div key={idx} className="relative flex items-center gap-2.5">
                        {idx > 0 && (
                          <span className="hidden sm:block absolute -left-[1.125rem] top-1/2 -translate-y-1/2 h-1 w-1 rounded-full bg-border" />
                        )}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${c.primary ? "bg-primary/10" : "bg-accent/70"}`}>
                          <Icon className={`h-4 w-4 ${c.primary ? "text-primary/80" : "text-muted-foreground"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold leading-tight ${c.primary ? "text-primary" : "text-foreground"}`}>
                            {c.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {c.role}
                          </p>
                          {c.sub && <p className="text-[11px] text-muted-foreground italic leading-tight">{c.sub}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cover image + Introduction */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7 items-start">
              <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent aspect-[16/10]">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={landingData.iastTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-body text-5xl text-primary/25">ॐ</span>
                  </div>
                )}
              </div>
              <div>
                <IntroSection
                  title={landingData.introTitle}
                  cmsDescription={book.description || null}
                  introText={landingData.introText}
                  bookId={book.id}
                  languageCode={languageCode}
                />
              </div>
            </div>

            {/* Key themes */}
            {landingData.structureItems.length > 0 && (
              <div className="mt-8">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-3">
                  {landingData.structureTitle}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {landingData.structureItems.map((item, idx) => (
                    <button
                      key={idx}
                      className="text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all p-4 flex flex-col cursor-pointer group"
                      onClick={() => {
                        if (onSelectChapter && chapters[idx]) {
                          onSelectChapter(book.id, chapters[idx].number);
                        } else {
                          onSelectBook(book.id);
                        }
                      }}
                      data-testid={`structure-item-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-serif font-bold text-foreground leading-snug text-[15px] pt-0.5">
                          {item.title}
                        </p>
                        <span className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                          <span className="font-body text-lg text-primary/80 leading-none">ॐ</span>
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed line-clamp-4">
                        {item.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Extra section (e.g. Brahma Sutra commentary note) */}
            {landingData.extraSection && (
              <div className="mt-8">
                <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                  {landingData.extraSection.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-3xl">
                  {landingData.extraSection.text}
                </p>
              </div>
            )}

            {/* Closing verse */}
            <div className="mt-9 pt-5 border-t border-border/40">
              <p className="text-center text-primary/60 text-sm tracking-[0.35em] font-body">
                ॥ सर्वं खल्विदं ब्रह्म ॥
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

interface PrincipalUpanishad {
  number: string;
  devanagari: string;
  devanagariLong: string;
  iast: string;
  iastFull: string;
  veda: string;
  slugMatch: string;
  /** Extra slug/title fragments when CMS slug differs (e.g. kathopanishad vs katha). */
  slugPatterns?: string[];
  /** Related texts shown in the principal grid (e.g. Kena Pādabhashyam). */
  companionPatterns?: string[];
  quote: string;
  introText: string;
  structureTitle: string;
  structureItems: { title: string; description: string }[];
  extraSection?: { title: string; text: string };
}

const PRINCIPAL_UPANISHADS: PrincipalUpanishad[] = [
  {
    number: "01", devanagari: "ईश", devanagariLong: "ईशावास्योपनिषद्", iast: "Īśa", iastFull: "Īśāvāsyopaniṣad",
    veda: "Shukla Yajur", slugMatch: "isha", slugPatterns: ["isha", "ishavasya", "ishavasyopanishad"],
    quote: '"Īśā vāsyam idaṁ sarvaṁ — All this is pervaded by the Lord."',
    introText: "The Isha Upanishad, the opening chapter of the Shukla Yajurveda, is one of the shortest yet most profound Upanishads. In just 18 verses, it establishes the foundational vision of Advaita — that the entire universe is pervaded by Ishvara, and true renunciation lies in seeing the Self in all beings.",
    structureTitle: "Key Themes",
    structureItems: [
      { title: "Verses 1–3", description: "The vision of Ishvara pervading all creation, and the consequences of ignorance." },
      { title: "Verses 4–8", description: "The nature of Atman — unmoving yet swifter than the mind, beyond duality." },
      { title: "Verses 9–18", description: "Vidya and Avidya, knowledge and ritual — their synthesis for liberation." },
    ],
  },
  {
    number: "02", devanagari: "केन", devanagariLong: "केनोपनिषद्", iast: "Kena", iastFull: "Kenopaniṣad",
    veda: "Sama Veda", slugMatch: "kena", slugPatterns: ["kena", "kenopanishad", "kenopani"],
    companionPatterns: ["padabhash", "pada-bhash", "padabhashyam"],
    quote: '"By whom directed does the mind go towards its objects? — Kena?"',
    introText: "The Kena Upanishad takes its name from its opening word 'Kena' (by whom?). Belonging to the Talavakara Brahmana of the Sama Veda, it inquires into the ultimate cause behind all perception and cognition — the Brahman that is the ear of the ear, the mind of the mind.",
    structureTitle: "Structure",
    structureItems: [
      { title: "Section I (Verses 1–4)", description: "The inquiry: What power enables the senses and mind to function?" },
      { title: "Section II (Verses 5–9)", description: "Brahman defined as that which cannot be objectified by speech, mind, or senses." },
      { title: "Sections III–IV", description: "The parable of Yaksha — how even the gods could not comprehend Brahman without grace." },
    ],
  },
  {
    number: "03", devanagari: "कठ", devanagariLong: "कठोपनिषद्", iast: "Kaṭha", iastFull: "Kaṭhopaniṣad",
    veda: "Krishna Yajur", slugMatch: "katha", slugPatterns: ["katha", "katho", "kathopanishad", "kathopani"],
    quote: '"The Self is not attained by discourse, nor by intellect, nor by much hearing."',
    introText: "The Katha Upanishad narrates the dialogue between the young Nachiketas and Yama, the lord of death. Nachiketas, through his unwavering resolve, receives the supreme teaching on the nature of the Self, death, and immortality — making this one of the most celebrated Upanishads.",
    structureTitle: "Structure",
    structureItems: [
      { title: "Valli 1–3 (Adhyaya I)", description: "Nachiketas' journey to Yama, the choice between Preyas (pleasant) and Shreyas (good), and the teaching of the imperishable Atman." },
      { title: "Valli 4–6 (Adhyaya II)", description: "The chariot metaphor for body-mind-Self, the hierarchy of reality, and the path to liberation through knowledge." },
    ],
  },
  {
    number: "04", devanagari: "प्रश्न", devanagariLong: "प्रश्नोपनिषद्", iast: "Praśna", iastFull: "Praśnopaniṣad",
    veda: "Atharva Veda", slugMatch: "prashna", slugPatterns: ["prashna", "prashnopanishad"],
    quote: '"Prana is born of the Self. As a shadow is cast by a person, so is Prana attached to the Self."',
    introText: "The Prashna Upanishad consists of six questions posed by six seekers to the sage Pippalada. Each question progressively deepens the inquiry — from the origin of creation to the nature of Prana, the states of consciousness, and ultimately the supreme Purusha with sixteen parts.",
    structureTitle: "The Six Questions",
    structureItems: [
      { title: "Questions 1–2", description: "Origin of created beings, and the supremacy of Prana over the senses and elements." },
      { title: "Questions 3–4", description: "The nature of Prana, its relation to the Self, and the three states of waking, dream, and deep sleep." },
      { title: "Questions 5–6", description: "Meditation on Om, and the Purusha of sixteen parts — the ultimate reality." },
    ],
  },
  {
    number: "05", devanagari: "मुण्डक", devanagariLong: "मुण्डकोपनिषद्", iast: "Muṇḍaka", iastFull: "Muṇḍakopaniṣad",
    veda: "Atharva Veda", slugMatch: "mundaka", slugPatterns: ["mundaka", "mundakopanishad"],
    quote: '"Two birds, inseparable companions, perch on the same tree. One eats the fruit; the other looks on without eating."',
    introText: "The Mundaka Upanishad, belonging to the Atharva Veda, is famous for its distinction between Para Vidya (higher knowledge of Brahman) and Apara Vidya (lower knowledge of rituals). Through vivid imagery — two birds on a tree, sparks from fire — it guides the seeker from worldly knowledge to Self-realization.",
    structureTitle: "Three Mundakas",
    structureItems: [
      { title: "Mundaka I", description: "Para and Apara Vidya — the distinction between knowledge of Brahman and ritualistic knowledge." },
      { title: "Mundaka II", description: "The nature of Brahman — all-pervading, self-luminous, the source from which all beings emerge like sparks from fire." },
      { title: "Mundaka III", description: "The path to realization — the two birds metaphor, renunciation, and the attainment of Brahman through knowledge." },
    ],
  },
  {
    number: "06", devanagari: "माण्डूक्य", devanagariLong: "माण्डूक्योपनिषद्", iast: "Māṇḍūkya", iastFull: "Māṇḍūkyopaniṣad",
    veda: "Atharva Veda", slugMatch: "mandukya",
    quote: '"Om — this syllable is the whole world. All that is past, present, and future is truly Om."',
    introText: "The Mandukya Upanishad is the shortest of the principal Upanishads with just 12 verses, yet it is considered the most concentrated teaching of Advaita Vedanta. Gaudapada's Karikas (200 verses) expand on its four states of consciousness and establish Ajativada — the doctrine of non-origination.",
    structureTitle: "The Four States",
    structureItems: [
      { title: "Vaishvanara (A)", description: "The waking state — consciousness turned outward, experiencing the gross world through 19 doors." },
      { title: "Taijasa (U)", description: "The dream state — consciousness turned inward, experiencing subtle impressions." },
      { title: "Prajna (M)", description: "Deep sleep — undifferentiated consciousness, the seed state of bliss and ignorance." },
      { title: "Turiya (Silence)", description: "The fourth — pure awareness beyond all states, non-dual, the true nature of Atman." },
    ],
  },
  {
    number: "07", devanagari: "ऐतरेय", devanagariLong: "ऐतरेयोपनिषद्", iast: "Aitareya", iastFull: "Aitareyopaniṣad",
    veda: "Rig Veda", slugMatch: "aitareya",
    quote: '"Prajñānam Brahma — Consciousness is Brahman."',
    introText: "The Aitareya Upanishad belongs to the Rig Veda and contains one of the four Mahavakyas: 'Prajñānam Brahma.' It describes the creation of the universe from the Self, the entry of the Self into creation, and the three births of the individual — providing a complete cosmological and spiritual framework.",
    structureTitle: "Three Chapters",
    structureItems: [
      { title: "Chapter I", description: "Cosmogony — how the Self (Atman) created the worlds, the cosmic person, and the elements." },
      { title: "Chapter II", description: "The three births — physical birth, the birth of the Self into the body, and the birth into immortality." },
      { title: "Chapter III", description: "The nature of the Self as pure consciousness (Prajñāna) — the Mahavakya: Prajñānam Brahma." },
    ],
  },
  {
    number: "08", devanagari: "तैत्तिरीय", devanagariLong: "तैत्तिरीयोपनिषद्", iast: "Taittirīya", iastFull: "Taittirīyopaniṣad",
    veda: "Krishna Yajur", slugMatch: "taittariya", slugPatterns: ["taittariya", "taittiriya", "taitiriya"],
    quote: '"Satyam Jñānam Anantam Brahma — Brahman is Truth, Knowledge, Infinite."',
    introText: "The Taittiriya Upanishad is one of the older, \"primary\" Upanishads, part of the Yajur Veda. It says that the highest goal is to know the Brahman, for that is truth. It is divided into three sections (Vallis), progressing from phonetics and ethics through the five sheaths (Pancha Kosha) to Bhrigu's realization of Brahman as Ananda (bliss).",
    structureTitle: "Three Vallis",
    structureItems: [
      { title: "Shiksha Valli", description: "The preparatory section — meditation on syllables, ethics of a student's life, and the fivefold meditations." },
      { title: "Brahmananda Valli", description: "The Pancha Kosha analysis — Annamaya to Anandamaya — leading to the definition: Satyam Jñānam Anantam Brahma." },
      { title: "Bhrigu Valli", description: "Bhrigu's progressive realization through tapas — from food to bliss — culminating in Brahman-knowledge." },
    ],
  },
  {
    number: "09", devanagari: "छान्दोग्य", devanagariLong: "छान्दोग्योपनिषद्", iast: "Chāndogya", iastFull: "Chāndogyopaniṣad",
    veda: "Sama Veda", slugMatch: "chandogya",
    quote: '"Tat Tvam Asi — That Thou Art."',
    introText: "The Chandogya Upanishad is one of the oldest and largest Upanishads, belonging to the Sama Veda. It contains the celebrated Mahavakya 'Tat Tvam Asi' taught by Uddalaka to Shvetaketu. Through nine examples (honey doctrine, rivers merging in ocean, salt in water), it demonstrates the identity of the individual self with Brahman.",
    structureTitle: "Key Sections",
    structureItems: [
      { title: "Chapters I–III", description: "Meditation on Udgitha (Om), the honey doctrine, and the five fires — preparatory meditations." },
      { title: "Chapters IV–V", description: "Stories of Satyakama, Raikva, and the doctrine of Vaishvanara — progressive teachings on Brahman." },
      { title: "Chapters VI–VIII", description: "The teaching of Tat Tvam Asi, the Bhuma Vidya (meditation on the Infinite), and Dahara Vidya (the space within the heart)." },
    ],
  },
  {
    number: "10", devanagari: "बृहदारण्यक", devanagariLong: "बृहदारण्यकोपनिषद्", iast: "Bṛhadāraṇyaka", iastFull: "Bṛhadāraṇyakopaniṣad",
    veda: "Shukla Yajur", slugMatch: "brihadaranyaka", slugPatterns: ["brihadaranyaka", "brihadaranyak", "brhadaranyaka"],
    quote: '"Aham Brahmāsmi — I am Brahman."',
    introText: "The Brihadaranyaka is the largest and arguably the most important Upanishad, belonging to the Shukla Yajurveda. It contains the Mahavakya 'Aham Brahmasmi' and Yajnavalkya's celebrated dialogues with Maitreyi and King Janaka — representing the pinnacle of Upanishadic wisdom on the nature of the Self.",
    structureTitle: "Three Kandas",
    structureItems: [
      { title: "Madhu Kanda (I–II)", description: "The Ashvamedha allegory, creation from the Self, the honey doctrine — everything is interconnected through Brahman." },
      { title: "Muni Kanda (III–IV)", description: "Yajnavalkya's debates at Janaka's court, the 'Neti Neti' teaching, and the dialogue with Maitreyi on the Self as pure awareness." },
      { title: "Khila Kanda (V–VI)", description: "Supplementary meditations, the Gayatri as Brahman, and the path of the departed — Devayana and Pitriyana." },
    ],
  },
];

function getSlugPatterns(up: PrincipalUpanishad): string[] {
  return up.slugPatterns ?? [up.slugMatch];
}

function bookMatchesPrincipalPattern(book: Book, pattern: string): boolean {
  const slug = book.slug?.toLowerCase() || "";
  const title = book.title?.toLowerCase() || "";
  if (!pattern) return false;

  // Slug segment match (avoids "isha" matching inside "upanishad",
  // and "katha" matching inside "katharudra")
  if (slug === pattern || slug.startsWith(`${pattern}-`)) return true;
  if (new RegExp(`(^|-)${pattern}(-|$)`).test(slug)) return true;

  // Title: word-boundary match for principal names only
  if (new RegExp(`\\b${pattern}\\b`).test(title)) return true;

  return false;
}

function bookMatchesCompanionPattern(book: Book, pattern: string): boolean {
  const slug = book.slug?.toLowerCase() || "";
  const title = book.title?.toLowerCase() || "";
  return slug.includes(pattern) || title.includes(pattern);
}

function isCompanionOfPrincipal(book: Book, up: PrincipalUpanishad): boolean {
  const patterns = up.companionPatterns;
  if (!patterns?.length) return false;
  return patterns.some((p) => bookMatchesCompanionPattern(book, p));
}

function findBookForPrincipal(up: PrincipalUpanishad, books: Book[]): Book | undefined {
  const candidates = books.filter((b) =>
    getSlugPatterns(up).some((pattern) => bookMatchesPrincipalPattern(b, pattern)),
  );
  if (!candidates.length) return undefined;
  const primary = candidates.find((b) => !isCompanionOfPrincipal(b, up));
  return primary ?? candidates[0];
}

function findCompanionBooksForPrincipal(
  up: PrincipalUpanishad,
  books: Book[],
  primaryBook?: Book,
): Book[] {
  if (!up.companionPatterns?.length) return [];
  return books.filter((b) => {
    if (primaryBook && b.id === primaryBook.id) return false;
    if (!isCompanionOfPrincipal(b, up)) return false;
    return getSlugPatterns(up).some((pattern) => bookMatchesPrincipalPattern(b, pattern));
  });
}

function UpanishadLandingPage({ books, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, onGoBack, languageCode, onCoverBookChange }: {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onSelectPart?: (bookId: string, adhyayNumber: number, khandaNumber: number) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  onGoBack?: () => void;
  languageCode?: string | null;
  onCoverBookChange?: (info: { bookId: string; title: string } | null) => void;
}) {
  const { theme } = useTheme();
  const [selectedUpanishadSlug, setSelectedUpanishadSlug] = useState<string | null>(null);
  /** null = two category boxes; principal | other = show that section's grid */
  const [categoryView, setCategoryView] = useState<"principal" | "other" | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showGuidance, setShowGuidance] = useState(true);

  const selectedUp = selectedUpanishadSlug
    ? PRINCIPAL_UPANISHADS.find((u) => u.slugMatch === selectedUpanishadSlug)
    : null;
  const selectedBook = selectedUpanishadSlug
    ? selectedUp
      ? findBookForPrincipal(selectedUp, books)
      : books.find(
          (b) =>
            b.slug?.toLowerCase() === selectedUpanishadSlug ||
            b.id === selectedUpanishadSlug,
        )
    : null;
  const chapters = useBookChapters(selectedBook?.id);

  const principalEntries = PRINCIPAL_UPANISHADS.map((up) => {
    const book = findBookForPrincipal(up, books);
    return book ? { up, book } : null;
  }).filter((entry): entry is { up: PrincipalUpanishad; book: Book } => entry != null);

  const principalCompanionEntries = principalEntries.flatMap(({ up, book }) =>
    findCompanionBooksForPrincipal(up, books, book).map((companion) => ({ up, book: companion })),
  );

  const principalBookIds = new Set([
    ...principalEntries.map((e) => e.book.id),
    ...principalCompanionEntries.map((e) => e.book.id),
  ]);
  /** Everything in the Upanishad catalog except principal texts and their companions */
  const otherBooks = books.filter((b) => !principalBookIds.has(b.id));
  const principalCompanionCount = principalCompanionEntries.length;

  if (selectedBook) {
    const chapterStructure = chapters.length > 0
      ? chapters.slice(0, 6).map((ch) => ({
          title: ch.title || `Chapter ${ch.number}`,
          description: ch.khandas && ch.khandas.length > 0
            ? `${ch.khandas.length} sections, ${ch.verseCount} mantras`
            : `${ch.verseCount} mantras`,
        }))
      : [];

    const landingData: BookLandingData = selectedUp
      ? {
          iastTitle: selectedUp.iastFull,
          devanagariTitle: selectedUp.devanagariLong,
          authorIast: selectedBook.author || "Śrī Śaṅkarācārya",
          verseCount: String(selectedBook.totalVerses || 0),
          verseLabel: "Mantras",
          veda: selectedUp.veda,
          quote: selectedUp.quote,
          introTitle: "Introduction",
          introText: selectedUp.introText,
          structureTitle: selectedUp.structureTitle,
          structureItems: selectedUp.structureItems,
          extraSection: selectedUp.extraSection,
          ctaLabel: "Open Text",
          sidebarLabel: selectedUp.iastFull,
          sidebarDescription: `${selectedUp.veda} Veda Upanishad with ${selectedBook.bhashyamName || "Shankara Bhashya"}.`,
          sidebarTreeLabel: "Text Structure",
        }
      : {
          iastTitle: selectedBook.title || "Upanishad",
          devanagariTitle: (selectedBook as any).titleDevanagari || selectedBook.title || "",
          authorIast: selectedBook.author || "Śrī Śaṅkarācārya",
          verseCount: String(selectedBook.totalVerses || 0),
          verseLabel: "Mantras",
          quote: "",
          introTitle: "Introduction",
          introText: selectedBook.description || "",
          structureTitle: chapterStructure.length > 0 ? "Key Themes" : "",
          structureItems: chapterStructure,
          ctaLabel: "Open Text",
          sidebarLabel: selectedBook.title || "Upanishad",
          sidebarDescription: selectedBook.description || "Upanishad text with commentary.",
          sidebarTreeLabel: "Text Structure",
        };

    const categoryBackLabel =
      categoryView === "other" ? "Other Upanishads" : "Principal Upanishads";

    return (
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background" data-testid="upanishad-detail-view">
        <BookLandingPage
          book={selectedBook}
          landingData={landingData}
          chapters={chapters}
          onSelectBook={onSelectBook}
          onSelectChapter={onSelectChapter}
          onSelectPart={onSelectPart}
          onSelectVerse={onSelectVerse}
          onBack={() => setSelectedUpanishadSlug(null)}
          backLabel={categoryBackLabel}
          hierarchyLegend={[
            { label: "Adhyaya (Chapter)", dotClass: "bg-primary" },
            { label: "Khanda (Section)", dotClass: "bg-primary/45" },
            { label: "Mantra (Line)", dotClass: "bg-muted-foreground/40" },
          ]}
          t={(k: any) => k}
          tc={(text) => text || ""}
          onCoverBookChange={onCoverBookChange}
        />
      </div>
    );
  }

  const renderUpanishadCard = (
    book: Book,
    principalUp?: PrincipalUpanishad,
    catalogSection: "principal" | "other" = principalUp ? "principal" : "other",
    isCompanion = false,
    layout: "grid" | "list" = "grid",
  ) => {
    const slugKey = isCompanion
      ? book.slug?.toLowerCase() || book.id
      : principalUp?.slugMatch || book.slug?.toLowerCase() || book.id;
    const coverImage = resolveBookCoverImage(book);
    const displayTitle = isCompanion ? book.title : principalUp ? principalUp.iastFull : book.title;
    const isList = layout === "list";
    const openCard = () => {
      setCategoryView(catalogSection);
      setSelectedUpanishadSlug(slugKey);
    };
    const stop = (e: ReactMouseEvent) => e.stopPropagation();

    const metaLine = isCompanion
      ? `${book.author || "Sri Shankaracharya"}${principalUp ? ` · ${formatVeda(principalUp.veda)}` : ""}`
      : principalUp
        ? formatVeda(principalUp.veda)
        : book.author || "Sri Shankaracharya";

    const actionButtons = (
      <div className="flex items-center gap-1">
        <button
          onClick={stop}
          title="Bookmark"
          aria-label="Bookmark"
          className="w-6 h-6 rounded-md bg-background/85 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-primary shadow-sm transition-colors"
        >
          <Bookmark className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={stop}
          title="Share"
          aria-label="Share"
          className="w-6 h-6 rounded-md bg-background/85 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-primary shadow-sm transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );

    const footer = (
      <div className="mt-auto border-t border-border/50 px-3.5 py-2.5 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wide"
          data-testid={`button-open-text-${book.id}`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Open Text
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Cloud className="h-3 w-3" />
          Available Offline
        </span>
      </div>
    );

    // Badge over the cover: commentary label for companions, sequence number for principals.
    const badge = isCompanion ? (
      <span className="absolute top-2 left-2 h-6 px-2 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center shadow-sm group-hover:bg-background group-hover:text-primary transition-colors">
        {principalUp ? `${principalUp.iast} Commentary` : "Commentary"}
      </span>
    ) : principalUp ? (
      <span className="absolute top-2 left-2 min-w-[1.6rem] h-6 px-1.5 rounded-md bg-background/85 backdrop-blur-sm text-[11px] font-mono font-semibold text-foreground/80 flex items-center justify-center shadow-sm">
        {principalUp.number}
      </span>
    ) : null;

    const cover = (
      <div className={`relative overflow-hidden shrink-0 ${isList ? "w-32 sm:w-44 self-stretch" : "w-full"}`}>
        {coverImage ? (
          <img
            src={coverImage}
            alt=""
            className={`block object-cover object-center transition-transform duration-300 group-hover:scale-[1.05] ${isList ? "absolute inset-0 h-full w-full" : "w-full h-[clamp(7rem,13vw,10rem)]"}`}
            loading="lazy"
          />
        ) : (
          <div className={`bg-gradient-to-br from-primary/15 via-primary/5 to-transparent flex items-end px-4 pb-3 ${isList ? "h-full w-full min-h-[9rem]" : "w-full h-[clamp(7rem,13vw,10rem)]"}`}>
            {principalUp && (
              <span className="font-body text-4xl text-primary/25 leading-none">{principalUp.devanagari}</span>
            )}
          </div>
        )}
        {badge}
        {/* In list mode the actions live in the title row so they don't crowd the narrow cover. */}
        {!isList && <div className="absolute top-2 right-2">{actionButtons}</div>}
      </div>
    );

    const body = (
      <div className={`flex flex-col flex-1 min-w-0 px-3.5 ${isList ? "py-3" : "pt-3"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="font-serif font-bold text-[17px] text-foreground leading-snug group-hover:text-primary transition-colors"
              data-testid={`text-upanishad-title-${book.id}`}
            >
              {displayTitle}
            </h3>
            {principalUp && !isCompanion && (
              <p className="text-xs text-primary/70 font-body mt-0.5">{principalUp.devanagariLong}</p>
            )}
          </div>
          {isList && (
            <div className="flex items-center gap-0.5 shrink-0 -mr-1">
              <button
                onClick={stop}
                title="Bookmark"
                aria-label="Bookmark"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <button
                onClick={stop}
                title="Share"
                aria-label="Share"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">{metaLine}</p>
        {book.description && (
          <p className={`text-[13px] text-muted-foreground leading-snug mt-1.5 flex-1 ${isList ? "line-clamp-2 sm:line-clamp-3" : "line-clamp-2"}`}>
            {book.description}
          </p>
        )}
        <div className={isList ? "mt-2" : "pb-2.5"}>
          <BookProgressBar bookId={book.id} totalVerses={book.totalVerses} alwaysShow compact unitLabel="Mantras" />
        </div>
      </div>
    );

    // Same structure for every grantha; on hover a padding-frame turns orange
    // (echoing the Kena padabhashyam commentary treatment) around a white inner panel.
    return (
      <Card
        key={book.id}
        className="group relative h-full p-[5px] rounded-2xl border border-border/60 bg-card cursor-pointer overflow-hidden flex transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary hover:bg-gradient-to-br hover:from-primary hover:to-primary/90"
        onClick={openCard}
        data-testid={`upanishad-card-${slugKey}`}
      >
        <div className={`relative rounded-xl bg-card overflow-hidden flex-1 min-w-0 flex group-hover:shadow-md ${isList ? "flex-row items-stretch" : "flex-col"}`}>
          {cover}
          <div className="flex flex-col flex-1 min-w-0">
            {body}
            {footer}
          </div>
        </div>
      </Card>
    );
  };

  if (categoryView === null) {
    const shortenUpanishad = (title: string) =>
      (title || "").replace(/\s*Upani[sṣ]ad.*$/i, "").replace(/[’']s$/i, "").trim() || title;
    const principalChips = principalEntries.slice(0, 5).map(({ up }) => up.iast);
    const principalMore = Math.max(0, principalEntries.length - principalChips.length);
    const otherChips = otherBooks.slice(0, 4).map((b) => shortenUpanishad(b.title));
    const otherMore = Math.max(0, otherBooks.length - otherChips.length);
    const collectionCards = [
      {
        key: "principal" as const,
        image: theme === "dark" ? upanishadPrincipalDark : upanishadPrincipalImg,
        icon: BookOpen,
        title: "Principal Upanishads",
        description: "The ten classical Upanishads traditionally studied in Vedanta.",
        chips: principalChips,
        more: principalMore,
        count: principalEntries.length,
      },
      {
        key: "other" as const,
        image: theme === "dark" ? upanishadAdditionalDark : upanishadAdditionalImg,
        icon: FileText,
        title: "Additional Upanishads",
        description: "Specialized Upanishadic literature with Advaita bhāṣyas & commentaries.",
        chips: otherChips,
        more: otherMore,
        count: otherBooks.length,
      },
    ];
    return (
      <div
        className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/25 via-background to-background px-3 sm:px-5 lg:px-8 py-4 sm:py-5"
        data-testid="upanishad-landing-view"
      >
        <div className="w-full max-w-6xl mx-auto space-y-6 sm:space-y-7">
          {/* Header: back + title + divider */}
          <div className="space-y-3">
            {onGoBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoBack}
                className="gap-1.5 text-xs text-muted-foreground -ml-2"
                data-testid="button-upanishad-back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Home
              </Button>
            )}
            <div className="flex items-center gap-3">
              <Library className="h-6 w-6 text-primary shrink-0" />
              <h1 className="font-page-heading text-xl sm:text-2xl font-semibold text-primary" data-testid="heading-upanishad">
                Upanishad
              </h1>
              <div className="h-px flex-1 bg-gradient-to-r from-primary/50 via-primary/25 to-transparent"></div>
            </div>
          </div>

          {/* Guidance banner */}
          {showGuidance ? (
            <div className="relative flex items-start gap-4 sm:gap-5 rounded-2xl border border-primary/15 bg-[#fdf4ea] dark:bg-primary/[0.06] px-4 sm:px-6 py-4 sm:py-5" data-testid="upanishad-guidance">
              <img
                src={shankaracharyaPortrait}
                alt=""
                aria-hidden="true"
                className="h-14 sm:h-16 w-auto object-contain shrink-0"
                draggable={false}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-lg sm:text-2xl font-semibold text-primary leading-tight">
                    Not sure where to begin?
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowGuidance(false)}
                    className="flex items-center gap-1 text-xs sm:text-sm text-primary/70 hover:text-primary transition-colors shrink-0"
                    data-testid="button-hide-guidance"
                  >
                    Hide Guidance <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Start with the Principal Upanishads, the ten classical Upanishads traditionally studied in Vedanta.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGuidance(true)}
              className="flex items-center gap-1 text-sm text-primary/80 hover:text-primary transition-colors"
              data-testid="button-show-guidance"
            >
              Show Guidance <ChevronDown className="h-4 w-4" />
            </button>
          )}

          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 w-full"
            data-testid="upanishad-category-boxes"
          >
            {collectionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.key}
                  className="group flex flex-col p-0 overflow-hidden border-border/60 bg-card hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer rounded-2xl"
                  onClick={() => setCategoryView(card.key)}
                  data-testid={`box-${card.key}-upanishads`}
                >
                  {/* Icon + product image header */}
                  <div className="relative flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6">
                    <div className="p-2.5 rounded-xl bg-[#f6ead7] dark:bg-primary/10 border border-primary/15 shrink-0 z-10">
                      <Icon className="h-5 w-5 text-primary/80" />
                    </div>
                    <img
                      key={card.image}
                      src={card.image}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none -mt-2 -mr-2 h-28 sm:h-32 w-auto max-w-[55%] object-contain mix-blend-multiply dark:mix-blend-normal animate-in fade-in-0 duration-500"
                      style={{
                        maskImage: "radial-gradient(ellipse 82% 82% at 68% 42%, #000 46%, transparent 84%)",
                        WebkitMaskImage: "radial-gradient(ellipse 82% 82% at 68% 42%, #000 46%, transparent 84%)",
                      }}
                      draggable={false}
                    />
                  </div>

                  <div className="flex flex-col flex-1 px-5 sm:px-6 pb-5 sm:pb-6 pt-2">
                    <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
                      {card.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {card.description}
                    </p>

                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary/70 font-semibold mb-2">
                        Includes
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {card.chips.map((chip, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground/80"
                          >
                            {chip}
                          </span>
                        ))}
                        {card.more > 0 && (
                          <span className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground">
                            + {card.more} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" /> {card.count} {card.count === 1 ? "text" : "texts"}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-medium text-primary transition-all group-hover:gap-2">
                        Explore Collection <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const isPrincipal = categoryView === "principal";
  const headerTitle = isPrincipal ? "Principal Upanishad" : "Other Upanishads";
  const headerSubtitle = isPrincipal
    ? "The ten foundational Upanishads forming the core of Vedāntic inquiry."
    : "Additional Upanishads with advaita bhāṣyas and related commentaries.";
  const sectionCount = isPrincipal ? principalEntries.length : otherBooks.length;
  const gridClass =
    viewMode === "list"
      ? "grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch max-w-4xl xl:max-w-none mx-auto"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 items-stretch";

  return (
    <div
      className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/25 via-background to-background px-3 sm:px-5 lg:px-8 py-4 sm:py-5"
      data-testid="upanishad-landing-view"
    >
      <div className="w-full max-w-[min(100%,120rem)] mx-auto">
        <button
          onClick={() => setCategoryView(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          data-testid="button-back-to-upanishad-categories"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to collections
        </button>

        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <ScrollText className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            <h1 className="font-page-heading text-2xl sm:text-3xl font-bold text-primary leading-none">
              {headerTitle}
            </h1>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/40 via-primary/15 to-transparent" />
        </div>
        <p className="text-sm sm:text-base text-muted-foreground mt-2.5">{headerSubtitle}</p>

        {/* Summary pills */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.04] px-3 py-1 text-xs font-medium text-foreground/80">
            <BookOpen className="h-3.5 w-3.5 text-primary/70" />
            {sectionCount} Upanishad{sectionCount === 1 ? "" : "s"}
          </span>
          {isPrincipal && principalCompanionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.04] px-3 py-1 text-xs font-medium text-foreground/80">
              <Users className="h-3.5 w-3.5 text-primary/70" />
              {principalCompanionCount} Related Commentar{principalCompanionCount === 1 ? "y" : "ies"}
            </span>
          )}
        </div>

        {/* Count + view toggle */}
        <div className="flex items-center justify-between gap-3 mt-5 mb-3.5">
          <p className="text-xs sm:text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{sectionCount} Upanishad{sectionCount === 1 ? "" : "s"}</span>
            {isPrincipal ? `  ·  ${principalEntries.length} of 10 principal texts` : ""}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">View:</span>
            <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                aria-label="Grid view"
                className={`flex items-center justify-center h-8 w-8 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                aria-label="List view"
                className={`flex items-center justify-center h-8 w-8 border-l border-border/60 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isPrincipal ? (
          <section data-testid="principal-upanishads-section">
            <div className={gridClass} data-testid="principal-upanishad-grid">
              {principalEntries.flatMap(({ up, book }) => {
                const companions = findCompanionBooksForPrincipal(up, books, book);
                return [
                  renderUpanishadCard(book, up, "principal", false, viewMode),
                  ...companions.map((companion) => renderUpanishadCard(companion, up, "principal", true, viewMode)),
                ];
              })}
            </div>
          </section>
        ) : (
          <section data-testid="other-upanishads-section">
            {otherBooks.length > 0 ? (
              <div className={gridClass} data-testid="other-upanishad-grid">
                {otherBooks.map((book) => renderUpanishadCard(book, undefined, "other", false, viewMode))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-8 text-center">
                No other Upanishads available yet.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function GenericBookLanding({ book, onSelectBook, t, tc }: {
  book: Book;
  onSelectBook: (bookId: string) => void;
  t: (key: any) => string;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
}) {
  return (
    <div className="flex-1 min-w-0" data-testid={`book-landing-${book.slug}`}>
      <Card
        className="group border-border/60 bg-card border-l-[3px] border-l-primary/50 hover:border-l-primary hover:shadow-lg transition-all cursor-pointer overflow-hidden"
        onClick={() => onSelectBook(book.id)}
        data-testid={`card-book-${book.slug || book.id}`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground leading-snug">
                {tc(book.title, bookTitleTranslations)}
              </h3>
              {book.author && (
                <p className="text-xs text-primary/80 mt-1 font-medium uppercase tracking-wider">
                  {tc(book.author, bookAuthorTranslations)}
                  {book.totalVerses ? ` | ${book.totalVerses} ${t("verses")}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{t("openText")}</span>
            </div>
          </div>
          {book.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {tc(book.description, bookDescriptionTranslations)}
            </p>
          )}
          {book.bhashyamName && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {book.bhashyamName}
              </Badge>
              {book.teekasList?.map((teeka, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {teeka.name} — {teeka.author}
                </Badge>
              ))}
            </div>
          )}
          <BookProgressBar bookId={book.id} totalVerses={book.totalVerses} />
        </div>
      </Card>
    </div>
  );
}

interface GitaChapter {
  num: number;
  name: string;
  transliteration: string;
  meaning: string;
  verses: number;
}

const GITA_CHAPTERS: GitaChapter[] = [
  { num: 1, name: "अर्जुनविषादयोग", transliteration: "Arjun Viṣhād Yog", meaning: "Arjuna's Dilemma", verses: 47 },
  { num: 2, name: "सांख्ययोग", transliteration: "Sānkhya Yog", meaning: "The Yoga of Knowledge", verses: 72 },
  { num: 3, name: "कर्मयोग", transliteration: "Karm Yog", meaning: "The Yoga of Action", verses: 43 },
  { num: 4, name: "ज्ञानकर्मसंन्यासयोग", transliteration: "Jñāna Karm Sanyās Yog", meaning: "The Yoga of Knowledge and Action", verses: 42 },
  { num: 5, name: "कर्मसंन्यासयोग", transliteration: "Karm Sanyās Yog", meaning: "The Yoga of Renunciation", verses: 29 },
  { num: 6, name: "ध्यानयोग", transliteration: "Dhyān Yog", meaning: "The Yoga of Meditation", verses: 47 },
  { num: 7, name: "ज्ञानविज्ञानयोग", transliteration: "Jñāna Vijñāna Yog", meaning: "The Yoga of Knowledge and Wisdom", verses: 30 },
  { num: 8, name: "अक्षरब्रह्मयोग", transliteration: "Akṣhar Brahma Yog", meaning: "The Yoga of the Imperishable Brahman", verses: 28 },
  { num: 9, name: "राजविद्याराजगुह्ययोग", transliteration: "Rāja Vidyā Yog", meaning: "The Yoga of Royal Knowledge", verses: 34 },
  { num: 10, name: "विभूतियोग", transliteration: "Vibhūti Yog", meaning: "The Yoga of Divine Glories", verses: 42 },
  { num: 11, name: "विश्वरूपदर्शनयोग", transliteration: "Viśhwarūp Darśhan Yog", meaning: "The Yoga of the Universal Form", verses: 55 },
  { num: 12, name: "भक्तियोग", transliteration: "Bhakti Yog", meaning: "The Yoga of Devotion", verses: 20 },
  { num: 13, name: "क्षेत्र-क्षेत्रज्ञविभागयोग", transliteration: "Kṣhetra Kṣhetrajña Vibhāg Yog", meaning: "The Yoga of the Field and the Knower", verses: 35 },
  { num: 14, name: "गुणत्रयविभागयोग", transliteration: "Guṇa Traya Vibhāg Yog", meaning: "The Yoga of the Three Gunas", verses: 27 },
  { num: 15, name: "पुरुषोत्तमयोग", transliteration: "Puruṣhottam Yog", meaning: "The Yoga of the Supreme Person", verses: 20 },
  { num: 16, name: "दैवासुरसम्पद्विभागयोग", transliteration: "Daivāsura Sampad Vibhāg Yog", meaning: "The Yoga of Divine and Demoniac Natures", verses: 24 },
  { num: 17, name: "श्रद्धात्रयविभागयोग", transliteration: "Śhraddhā Traya Vibhāg Yog", meaning: "The Yoga of the Three Divisions of Faith", verses: 28 },
  { num: 18, name: "मोक्षसंन्यासयोग", transliteration: "Mokṣha Sanyās Yog", meaning: "The Yoga of Liberation through Renunciation", verses: 78 },
];

// Per-chapter cover art served from public/images/gita-chapters/{num}.jpg (chapters 1–18).
const GITA_CHAPTER_IMAGES: Record<number, string> = Object.fromEntries(
  GITA_CHAPTERS.map((ch) => [ch.num, `/images/gita-chapters/${ch.num}.jpg`]),
);

function GitaChapterGrid({ book, chapters, onSelectBook, onSelectChapter, onGoBack, landingData, t, tc, languageCode }: {
  book: Book;
  chapters: ChapterInfo[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onGoBack: () => void;
  landingData?: BookLandingData;
  t: (key: any) => string;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
  languageCode?: string | null;
}) {
  const verseCountFor = (num: number) =>
    chapters.find(c => c.number === num)?.verseCount ?? GITA_CHAPTERS.find(c => c.num === num)?.verses ?? 0;

  const handleOpen = (num: number) => {
    if (onSelectChapter) onSelectChapter(book.id, num);
    else onSelectBook(book.id);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background" data-testid="gita-chapter-grid-view">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1.5 text-xs w-fit text-muted-foreground -ml-2 mb-3"
            data-testid="button-back-gita-chapters"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <div className="flex items-start justify-between gap-3 border-l-[3px] border-l-primary/60 pl-3 sm:pl-4 mb-5">
            <div className="min-w-0">
              <h1 className="font-page-heading text-2xl sm:text-3xl font-bold text-foreground leading-tight tracking-tight">
                {landingData?.iastTitle ?? tc(book.title, bookTitleTranslations)}
              </h1>
              {landingData?.devanagariTitle && (
                <p className="font-body text-lg sm:text-xl text-foreground/70 mt-0.5">
                  {landingData.devanagariTitle}
                </p>
              )}
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-[0.15em] mt-2">
                {t("chapterFull")} 1–{GITA_CHAPTERS.length} · {book.totalVerses ?? 701} {t("verses")}
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 gap-2 border-primary/40 bg-background/85 text-primary hover:bg-primary/10 hover:border-primary/60 font-semibold uppercase text-xs tracking-wider shadow-sm"
              onClick={() => onSelectBook(book.id)}
              data-testid="button-open-full-text-gita"
            >
              <BookOpen className="h-4 w-4" />
              {landingData?.ctaLabel ?? t("openText")}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="gita-chapters-grid">
            {GITA_CHAPTERS.map(ch => {
              const img = GITA_CHAPTER_IMAGES[ch.num];
              return (
                <Card
                  key={ch.num}
                  className="group relative flex flex-col border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden border-l-[3px] border-l-primary/50 hover:border-l-primary"
                  onClick={() => handleOpen(ch.num)}
                  data-testid={`card-gita-chapter-${ch.num}`}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-accent/20">
                    {img ? (
                      <img
                        src={img}
                        alt={ch.transliteration}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-body text-3xl sm:text-4xl text-foreground/70" data-testid={`gita-chapter-devanagari-${ch.num}`}>
                          {ch.name}
                        </span>
                      </div>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-background/85 backdrop-blur-sm text-primary text-xs font-bold tabular-nums shadow-sm">
                      {ch.num}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider">
                          {t("chapterFull")} {ch.num}
                        </p>
                        <h3 className="font-serif text-base font-semibold text-foreground leading-snug mt-0.5">
                          {ch.transliteration}
                        </h3>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                      {ch.meaning}
                    </p>
                    <div className="mt-auto pt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      <span>{verseCountFor(ch.num)} {t("verses")}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SubCategoryDetailViewProps {
  categoryId: string;
  subCategoryId: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onSelectPart?: (bookId: string, adhyayNumber: number, khandaNumber: number) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  onGoBack: () => void;
  languageCode?: string | null;
  onCoverBookChange?: (info: { bookId: string; title: string } | null) => void;
}

export function SubCategoryDetailView({ categoryId, subCategoryId, books, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, onGoBack, languageCode, onCoverBookChange }: SubCategoryDetailViewProps) {
  const category = CATALOG_TREE.find(c => c.id === categoryId);
  const subCategory = category?.children?.find(s => s.id === subCategoryId);
  if (!category || !subCategory) return null;

  const { t } = useTranslation(languageCode ?? null);
  const lang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, lang);

  const subBooks = books.filter(b => matchesCategory(subCategory.categoryMatch, subCategory.categoryAltMatch, b.category));

  const landingData = BOOK_LANDING_DATA[subCategoryId];
  const primaryBook = subBooks.length > 0 ? subBooks[0] : null;
  const chapters = useBookChapters(landingData && primaryBook ? primaryBook.id : undefined);

  if (subCategoryId === "pt-upanishad") {
    return (
      <UpanishadLandingPage
        books={subBooks}
        onSelectBook={onSelectBook}
        onSelectChapter={onSelectChapter}
        onSelectPart={onSelectPart}
        onSelectVerse={onSelectVerse}
        onGoBack={onGoBack}
        languageCode={languageCode}
        onCoverBookChange={onCoverBookChange}
      />
    );
  }

  if (subCategoryId === "pt-gita" && primaryBook) {
    return (
      <GitaChapterGrid
        book={primaryBook}
        chapters={chapters}
        onSelectBook={onSelectBook}
        onSelectChapter={onSelectChapter}
        onGoBack={onGoBack}
        landingData={landingData}
        t={t}
        tc={tc}
        languageCode={languageCode}
      />
    );
  }

  if (landingData && primaryBook) {
    const hasCoverHero = Boolean(resolveBookCoverImage(primaryBook));
    return (
      <div
        className={hasCoverHero ? "flex flex-1 min-h-0 flex-col overflow-hidden bg-background" : "flex-1"}
        data-testid="subcategory-book-landing"
      >
        <BookLandingPage
          book={primaryBook}
          landingData={landingData}
          chapters={chapters}
          onSelectBook={onSelectBook}
          onSelectChapter={onSelectChapter}
          onSelectPart={onSelectPart}
          onSelectVerse={onSelectVerse}
          t={t}
          tc={tc}
          languageCode={languageCode}
          onCoverBookChange={onCoverBookChange}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background" data-testid="subcategory-detail-view">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">

          <div className="lg:w-72 shrink-0 lg:sticky lg:top-4 lg:self-start">
            <Card className="p-5 border-border/60 bg-card flex flex-col max-h-[calc(100dvh-5.5rem)] min-h-0" data-testid="subcat-overview-panel">
              <div className="shrink-0">
              <h2 className="font-serif text-lg font-semibold text-foreground" data-testid="text-subcat-title">
                {getTranslatedLabel(subCategory, t)}
              </h2>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-3" data-testid="label-subcat-overview">
                {t("categoryOverview")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {getTranslatedDescription(category, t)}
              </p>

              <div className="h-px bg-border my-4"></div>

              <p className="text-xs font-semibold text-foreground uppercase tracking-wider" data-testid="label-subcat-texts">
                {t("textsAndChapters")}
              </p>
              </div>
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-1 pr-0.5" data-testid="subcat-scripture-tree">
                {subBooks.map(book => (
                  <button
                    key={book.id}
                    className="flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSelectBook(book.id)}
                    data-testid={`tree-book-${book.slug || book.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{tc(book.title, bookTitleTranslations)}</span>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        <span>{book.totalVerses ?? 0} {t("verses")}</span>
                      </div>
                      <BookProgressBar bookId={book.id} totalVerses={book.totalVerses} compact />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            {subBooks.length > 0 ? (
              <div className="space-y-4" data-testid="subcat-books-grid">
                {subBooks.map(book => (
                  <GenericBookLanding
                    key={book.id}
                    book={book}
                    onSelectBook={onSelectBook}
                    t={t}
                    tc={tc}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground/60 italic">{t("comingSoon")}...</p>
              </div>
            )}
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
