import { useState, useRef, useEffect, useMemo } from "react";
import { BookOpen, Library, FolderOpen, Lock, ArrowLeft, ArrowRight, ChevronRight, ScrollText, Feather, Users, Heart, BookMarked, Music, Layers, Search, X, FileText, Archive, Sparkles } from "lucide-react";
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

import catImgPrasthana from "@assets/image_1770803826016.png";
import catImgPrakarana from "@assets/image_1770803849999.png";
import catImgShlokas from "@assets/image_1770803820218.png";

function BookProgressBar({ bookId, totalVerses, compact = false, alwaysShow = false }: { bookId: string; totalVerses: number | null | undefined; compact?: boolean; alwaysShow?: boolean }) {
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
        {completed}/{total}
      </span>
    </div>
  );
}

const categoryImages: Record<string, string> = {
  "prasthana-thraya": catImgPrasthana,
  "prakarana-granthas": catImgPrakarana,
  "other-texts": catImgShlokas,
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
  onBrowseLibrary: () => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
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

export function WelcomeScreen({ books, onSelectBook, onBrowseLibrary, onSelectSubCategory, languageCode }: WelcomeScreenProps) {
  const { t } = useTranslation(languageCode ?? null);

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

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif rotate-12">ॐ</div>
        <div className="absolute top-1/2 right-1/3 text-[7rem] text-primary/[0.01] dark:text-primary/[0.015] font-serif -rotate-6">श्री</div>
      </div>

      <div className="max-w-6xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="text-center space-y-3 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/[0.06] dark:border-primary/[0.10]" style={{ width: 600, height: 600 }}></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/[0.08] dark:border-primary/[0.14]" style={{ width: 400, height: 400 }}></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/[0.10] dark:border-primary/[0.18]" style={{ width: 240, height: 240 }}></div>
          </div>
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-primary/5 dark:bg-primary/15 rounded-full blur-xl"></div>
            <img
              src="https://oneness.org.in/assets/img/favicon.png"
              alt="Advaita Vaaridhi"
              className="h-16 sm:h-20 w-16 sm:w-20 object-contain mx-auto relative"
            />
          </div>
          <div className="relative flex items-center justify-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
            <h1 className="font-serif text-xl sm:text-3xl font-semibold tracking-tight text-primary">
              {t("advaitaVedantaDigitalLibrary")}
            </h1>
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
          </div>
          <p className="relative text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {t("eternalEchoOfNonDuality")}
          </p>
          <p className="relative text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-2">
            {t("welcomeDescription")}
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            variant="default"
            onClick={onBrowseLibrary}
            className="gap-2 font-serif"
            data-testid="button-browse-library"
          >
            <Library className="h-4 w-4" />
            {t("browseTheLibrary")}
          </Button>
        </div>

        <HomeSearchBar books={books} onSelectBook={onSelectBook} languageCode={languageCode ?? null} />

        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">Prasthanatrayi — The Triple Canon</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pl-0 sm:pl-8" data-testid="triple-canon-grid">
              {tripleCanon.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelectSubCategory?.("prasthana-thraya", c.subId)}
                  className="group flex flex-col items-center text-center p-5 rounded-xl bg-card/70 dark:bg-card/40 border border-border/60 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  data-testid={`triple-canon-${c.key}`}
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <span className="text-xl text-primary font-serif leading-none">{c.symbol}</span>
                  </div>
                  <div className="font-serif text-base font-semibold text-foreground leading-snug">{c.title}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mt-1">{c.subtitle}</div>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <span>{c.count} {c.countLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <BookMarked className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("treasuryOfWisdom")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
              The Nyas has meticulously curated a vast collection spanning from the foundational Triple Canon to the sophisticated dialectical works of later Advaita masters — commentaries, introductory monographs, scholastic debates, and rare regional masterpieces.
            </p>

            <div className="space-y-3 pl-0 sm:pl-8">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
                Prakarana Granthas — Introductory Monographs
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-testid="prakarana-list">
                {prakaranaBookList.map((p) => {
                  const book = findBookBySlug(p.slugs);
                  return (
                    <button
                      key={p.title}
                      type="button"
                      disabled={!book}
                      onClick={() => book && onSelectBook(book.id)}
                      className="group flex items-center justify-between gap-3 p-3 rounded-lg bg-card/60 dark:bg-card/40 border border-border/60 hover:border-primary/40 hover:bg-card/90 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`prakarana-item-${p.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="min-w-0">
                        <div className="font-serif text-sm font-semibold text-foreground truncate">{p.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.author}</div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-primary/70 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pl-0 sm:pl-8">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
                The Scholastic Tradition — Two Schools
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="two-schools-grid">
                {twoSchools.map((s) => (
                  <div
                    key={s.name}
                    className={`p-3.5 rounded-lg bg-card/60 dark:bg-card/40 border border-border/60 border-l-[3px] ${s.colorClass}`}
                    data-testid={`school-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="font-serif text-sm font-semibold text-foreground mb-1">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.members.join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pl-0 sm:pl-8">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
                Regional Luminaries
              </div>
              <div className="flex flex-wrap gap-2" data-testid="regional-luminaries">
                {regionalLuminaries.map((name) => (
                  <span
                    key={name}
                    className="px-3 py-1 rounded-full bg-card/70 dark:bg-card/40 border border-border/60 text-[11px] text-foreground/80"
                    data-testid={`luminary-${name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {name}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={onBrowseLibrary}
                  className="px-3 py-1 rounded-full bg-card/70 dark:bg-card/40 border border-border/60 text-[11px] text-primary hover:bg-primary/5 transition-colors inline-flex items-center gap-1"
                  data-testid="luminary-view-all"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">Manifestations Across Traditions</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
              Non-dual wisdom does not belong to Sanskrit alone. It pours through the abhangas of Maharashtra, the padas of Rajasthan, the Gurbani of the Sikhs, and the Tiruvachakam of Tamil Nadu — each a different shore of the same boundless ocean.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-8" data-testid="manifestations-grid">
              {manifestations.map((m) => (
                <div
                  key={m.title}
                  className={`p-4 rounded-xl bg-card/60 dark:bg-card/40 border border-border/60 border-t-[3px] ${m.borderClass}`}
                  data-testid={`manifestation-${m.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {m.tags.map(tag => (
                      <span key={tag} className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider ${m.tagClass}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="font-serif text-sm font-semibold text-foreground mb-1">{m.title}</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{m.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("ourVisionSanskritikEkta")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
              <p>{t("visionDescription")}</p>
            </div>
            <blockquote className="text-center font-serif text-sm sm:text-base text-primary/70 italic py-2">
              {t("brahmanQuote")}
            </blockquote>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Library className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("featuresOfDigitalLibrary")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-8" data-testid="features-grid">
              {[
                { icon: FileText, labelKey: "authenticTranscriptionsLabel", descKey: "authenticTranscriptionsDesc" },
                { icon: Archive, labelKey: "manuscriptPreservationLabel", descKey: "manuscriptPreservationDesc" },
                { icon: Search, labelKey: "scholarlySearchLabel", descKey: "scholarlySearchDesc" },
              ].map(({ icon: Icon, labelKey, descKey }) => (
                <div
                  key={labelKey}
                  className="p-4 rounded-xl bg-card/60 dark:bg-card/40 border border-border/60 hover:border-primary/40 hover:shadow-md transition-all"
                  data-testid={`feature-card-${labelKey}`}
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-serif text-sm font-semibold text-foreground leading-snug mb-1.5">
                    {t(labelKey as any).replace(/:\s*$/, "")}
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    {t(descKey as any)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center pt-2">
            <div className="mx-auto h-px w-16 bg-primary/20 mb-3"></div>
            <blockquote className="font-serif text-base sm:text-lg text-primary/80 italic leading-relaxed">
              {t("saVidyaQuote")}
            </blockquote>
          </div>

          <p className="text-xs text-center text-muted-foreground/70">
            {t("invitationText")}
          </p>
          <p className="text-[10px] text-center text-muted-foreground/50 italic">
            {t("managedByNyas")}
          </p>
        </div>

        {books.some(b => bookVideoConfig[b.slug]) && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-primary/30"></div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid="heading-explanatory-videos">
                {t("watchIntroduction")}
              </h2>
              <div className="h-px w-8 bg-primary/30"></div>
            </div>
            {books.filter(b => bookVideoConfig[b.slug]).map(b => (
              <VideoInline
                key={b.slug}
                videoId={bookVideoConfig[b.slug].videoId}
                title={bookVideoConfig[b.slug].videoTitle}
                className="max-w-xl mx-auto rounded-xl overflow-hidden border border-primary/20"
              />
            ))}
          </div>
        )}

        <div className="text-center pb-4">
          <div className="text-primary/25 text-xs tracking-widest font-serif">
            ॥ सर्वं खल्विदं ब्रह्म ॥
          </div>
        </div>
      </div>
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
  const welcomeLang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, welcomeLang);

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif rotate-12">ॐ</div>
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
            <h1 className="font-serif text-lg sm:text-2xl font-semibold text-primary" data-testid="heading-browse-library">
              {t("browseTheLibrary")}
            </h1>
            <div className="h-px flex-1 bg-border"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5" data-testid="catalog-tree">
          {CATALOG_TREE.map(cat => {
            const catBooks = getBooksForCategory(books, cat);
            const IconComponent = categoryIcons[cat.id] || Library;

            return (
              <Card
                key={cat.id}
                className="p-0 overflow-hidden border-primary/20 bg-card/90 backdrop-blur-sm flex flex-col hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all rounded-xl"
                data-testid={`card-category-${cat.id}`}
              >
                <div
                  className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 cursor-pointer"
                  onClick={() => onSelectCategory?.(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground leading-tight">
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

                  {catBooks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] mt-3">
                      {catBooks.length} {catBooks.length === 1 ? t("textSingular") : t("textPlural")}
                    </Badge>
                  )}
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
                        <span className="text-sm font-serif text-foreground group-hover:text-primary transition-colors truncate">
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
          <div className="text-primary/25 text-xs tracking-widest font-serif">
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
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
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
                  <p className="font-serif text-sm text-foreground/50 mt-0.5">
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
          <div className="text-primary/25 text-xs tracking-widest font-serif">
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
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="category-detail-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-5 border-border/60 bg-card sticky top-4" data-testid="category-overview-panel">
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
              <div className="mt-3 space-y-1" data-testid="scripture-tree">
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
  );
}

interface BookLandingData {
  iastTitle: string;
  devanagariTitle: string;
  authorIast: string;
  verseCount: string;
  verseLabel: string;
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

function IntroSection({ title, cmsDescription, introText }: {
  title: string;
  cmsDescription: string | null;
  introText: string;
  bookId?: string;
  languageCode?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const primaryIntro = cmsDescription;
  const fullText = [primaryIntro, introText && (!primaryIntro || introText !== primaryIntro) ? introText : null].filter(Boolean).join("\n\n");
  const previewLength = 200;
  const needsTruncation = fullText.length > previewLength;
  const displayText = !expanded && needsTruncation
    ? fullText.substring(0, previewLength).replace(/\s+\S*$/, "") + "..."
    : fullText;

  return (
    <div>
      <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
        {title}
      </h3>
      {displayText.split("\n\n").map((paragraph, idx) => (
        <p key={idx} className="text-sm text-muted-foreground mt-3 leading-relaxed">
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

function BookLandingPage({ book, landingData, chapters, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, t, tc, languageCode }: {
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
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="book-landing-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-4 border-border/60 bg-card sticky top-4" data-testid="book-landing-sidebar">
              <h2 className="font-serif text-base font-semibold text-foreground mb-1" data-testid="text-landing-title">
                {landingData.sidebarLabel}
              </h2>

              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {t("categoryOverview")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {landingData.sidebarDescription}
              </p>

              <div className="h-px bg-border my-3"></div>

              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">
                {landingData.sidebarTreeLabel}
              </p>
              <div className="max-h-[45vh] overflow-y-auto pr-0.5">
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

              {(book.author || (book.teekasList && book.teekasList.length > 0)) && (
                <>
                  <div className="h-px bg-border my-3"></div>

                  {book.author && (
                    <div data-testid="landing-bhashyakara">
                      <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-[0.15em]">
                        Bhāṣyakāra (Commentator)
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-3 w-3 text-primary/70" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{book.author}</span>
                      </div>
                      {book.bhashyamName && (
                        <p className="text-xs text-muted-foreground mt-1 ml-8 italic">{book.bhashyamName}</p>
                      )}
                    </div>
                  )}

                  {book.teekasList && book.teekasList.length > 0 && (
                    <div className="mt-3" data-testid="landing-teekakaras">
                      <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-[0.15em]">
                        Ṭīkākāras (Sub-commentators)
                      </p>
                      <div className="mt-1.5 space-y-1.5">
                        {book.teekasList.map((teeka, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-accent/60 flex items-center justify-center shrink-0 mt-0.5">
                              <Feather className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-foreground">{teeka.author || teeka.name}</span>
                              {teeka.author && teeka.name && (
                                <p className="text-xs text-muted-foreground italic truncate">{teeka.name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="flex-1 min-w-0" data-testid="book-landing-content">
            <div className="border-l-[3px] border-l-primary/60 pl-6 sm:pl-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight tracking-tight">
                    {landingData.iastTitle}
                  </h1>
                  <p className="font-serif text-lg sm:text-xl text-foreground/70 mt-1">
                    {landingData.devanagariTitle}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 gap-2 border-primary/30 text-primary hover:bg-primary/5 font-semibold uppercase text-xs tracking-wider"
                  onClick={() => onSelectBook(book.id)}
                  data-testid="button-open-text-landing"
                >
                  <BookOpen className="h-4 w-4" />
                  {landingData.ctaLabel}
                </Button>
              </div>

              <p className="text-xs font-semibold text-primary/80 uppercase tracking-[0.15em] mt-3">
                {landingData.authorIast} | {landingData.verseCount} {landingData.verseLabel}
              </p>

              <blockquote className="border-l-2 border-primary/30 pl-4 mt-6 text-base sm:text-lg text-foreground/80 font-serif italic leading-relaxed">
                {landingData.quote}
              </blockquote>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <IntroSection
                  title={landingData.introTitle}
                  cmsDescription={book.description || null}
                  introText={landingData.introText}
                  bookId={book.id}
                  languageCode={languageCode}
                />

                <div>
                  <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                    {landingData.structureTitle}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {landingData.structureItems.map((item, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left border-l-[3px] border-l-primary/50 bg-primary/[0.03] dark:bg-primary/[0.06] rounded-r-lg p-3 hover:bg-primary/[0.08] dark:hover:bg-primary/[0.12] transition-colors cursor-pointer"
                        onClick={() => {
                          if (onSelectChapter && chapters[idx]) {
                            onSelectChapter(book.id, chapters[idx].number);
                          } else {
                            onSelectBook(book.id);
                          }
                        }}
                        data-testid={`structure-item-${idx}`}
                      >
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">
                          {item.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {landingData.extraSection && (
                <div className="mt-8">
                  <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                    {landingData.extraSection.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {landingData.extraSection.text}
                  </p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-border/40">
                <div className="text-center">
                  <div className="text-primary/25 text-xs tracking-widest font-serif">
                    ॥ सर्वं खल्विदं ब्रह्म ॥
                  </div>
                </div>
              </div>
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
  quote: string;
  introText: string;
  structureTitle: string;
  structureItems: { title: string; description: string }[];
  extraSection?: { title: string; text: string };
}

const PRINCIPAL_UPANISHADS: PrincipalUpanishad[] = [
  {
    number: "01", devanagari: "ईश", devanagariLong: "ईशावास्योपनिषद्", iast: "Īśa", iastFull: "Īśāvāsyopaniṣad",
    veda: "Shukla Yajur", slugMatch: "isha",
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
    veda: "Sama Veda", slugMatch: "kena",
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
    veda: "Krishna Yajur", slugMatch: "katha",
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
    veda: "Atharva Veda", slugMatch: "prashna",
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
    veda: "Atharva Veda", slugMatch: "mundaka",
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
    number: "07", devanagari: "तैत्तिरीय", devanagariLong: "तैत्तिरीयोपनिषद्", iast: "Taittirīya", iastFull: "Taittirīyopaniṣad",
    veda: "Krishna Yajur", slugMatch: "taittariya",
    quote: '"Satyam Jñānam Anantam Brahma — Brahman is Truth, Knowledge, Infinite."',
    introText: "The Taittiriya Upanishad belongs to the Krishna Yajurveda and is structured in three sections (Vallis). It progresses from phonetics and ethics through the five sheaths (Pancha Kosha) to the ecstatic realization of Brahman as Ananda (bliss) — making it essential for understanding Advaita methodology.",
    structureTitle: "Three Vallis",
    structureItems: [
      { title: "Shiksha Valli", description: "The preparatory section — meditation on syllables, ethics of a student's life, and the fivefold meditations." },
      { title: "Brahmananda Valli", description: "The Pancha Kosha analysis — Annamaya to Anandamaya — leading to the definition: Satyam Jñānam Anantam Brahma." },
      { title: "Bhrigu Valli", description: "Bhrigu's progressive realization through tapas — from food to bliss — culminating in Brahman-knowledge." },
    ],
  },
  {
    number: "08", devanagari: "ऐतरेय", devanagariLong: "ऐतरेयोपनिषद्", iast: "Aitareya", iastFull: "Aitareyopaniṣad",
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
    veda: "Shukla Yajur", slugMatch: "brihadaranyaka",
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

function UpanishadLandingPage({ books, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, languageCode }: {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onSelectPart?: (bookId: string, adhyayNumber: number, khandaNumber: number) => void;
  onSelectVerse?: (bookId: string, verseNumber: number) => void;
  languageCode?: string | null;
}) {
  const [selectedUpanishadSlug, setSelectedUpanishadSlug] = useState<string | null>(null);

  const findBook = (slugMatch: string) =>
    books.find(b => b.slug?.toLowerCase().startsWith(slugMatch)) ||
    books.find(b => b.slug?.toLowerCase() === slugMatch);

  const selectedUp = selectedUpanishadSlug
    ? PRINCIPAL_UPANISHADS.find(u => u.slugMatch === selectedUpanishadSlug)
    : null;
  const selectedBook = selectedUpanishadSlug ? findBook(selectedUpanishadSlug) : null;
  const chapters = useBookChapters(selectedBook?.id);

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
          authorIast: "Śrī Śaṅkarācārya",
          verseCount: String(selectedBook.totalVerses || 0),
          verseLabel: "Manthras",
          quote: selectedUp.quote,
          introTitle: "Introduction",
          introText: selectedUp.introText,
          structureTitle: selectedUp.structureTitle,
          structureItems: selectedUp.structureItems,
          extraSection: selectedUp.extraSection,
          ctaLabel: "Open Text",
          sidebarLabel: selectedUp.iastFull,
          sidebarDescription: `${selectedUp.veda} Veda Upanishad with Shankara Bhashya.`,
          sidebarTreeLabel: "Structure",
        }
      : {
          iastTitle: selectedBook.title || "Upanishad",
          devanagariTitle: (selectedBook as any).titleDevanagari || selectedBook.title || "",
          authorIast: selectedBook.author || "Śrī Śaṅkarācārya",
          verseCount: String(selectedBook.totalVerses || 0),
          verseLabel: "Manthras",
          quote: "",
          introTitle: "Introduction",
          introText: selectedBook.description || "",
          structureTitle: chapterStructure.length > 0 ? "Structure" : "",
          structureItems: chapterStructure,
          ctaLabel: "Open Text",
          sidebarLabel: selectedBook.title || "Upanishad",
          sidebarDescription: selectedBook.description || "Upanishad text with commentary.",
          sidebarTreeLabel: "Structure",
        };

    return (
      <div className="flex-1 overflow-y-auto bg-background" data-testid="upanishad-detail-view">
        <div className="px-4 sm:px-6 lg:px-8 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedUpanishadSlug(null)}
            className="gap-1.5 text-xs text-muted-foreground mb-2"
            data-testid="button-back-to-upanishads"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Upanishads
          </Button>
        </div>
        <BookLandingPage
          book={selectedBook}
          landingData={landingData}
          chapters={chapters}
          onSelectBook={onSelectBook}
          onSelectChapter={onSelectChapter}
          onSelectPart={onSelectPart}
          onSelectVerse={onSelectVerse}
          t={(k: any) => k}
          tc={(text) => text || ""}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="upanishad-landing-view">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg sm:text-xl text-foreground uppercase tracking-wide">
              Upanishad
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">
            {books.length} texts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="upanishad-grid">
          {books.map((book) => {
            const principalUp = PRINCIPAL_UPANISHADS.find(up => book.slug?.toLowerCase().startsWith(up.slugMatch));
            const slugKey = principalUp?.slugMatch || book.slug?.toLowerCase() || book.id;
            return (
              <Card
                key={book.id}
                className="p-4 border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all flex flex-col cursor-pointer group border-l-[3px] border-l-primary/50 hover:border-l-primary"
                onClick={() => setSelectedUpanishadSlug(slugKey)}
                data-testid={`upanishad-card-${slugKey}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base text-foreground leading-snug" data-testid={`text-upanishad-title-${book.id}`}>
                    {book.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5" data-testid={`button-open-text-${book.id}`}>
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Open Text</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {book.author || "Sri Shankaracharya"}
                </p>
                {book.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                    {book.description}
                  </p>
                )}
                <BookProgressBar bookId={book.id} totalVerses={book.totalVerses} alwaysShow />
              </Card>
            );
          })}
        </div>
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
}

export function SubCategoryDetailView({ categoryId, subCategoryId, books, onSelectBook, onSelectChapter, onSelectPart, onSelectVerse, onGoBack, languageCode }: SubCategoryDetailViewProps) {
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
        languageCode={languageCode}
      />
    );
  }

  if (landingData && primaryBook) {
    return (
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
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="subcategory-detail-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-5 border-border/60 bg-card sticky top-4" data-testid="subcat-overview-panel">
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
              <div className="mt-3 space-y-1" data-testid="subcat-scripture-tree">
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
  );
}
