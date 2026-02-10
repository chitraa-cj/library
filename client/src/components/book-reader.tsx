import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, User, MessageSquareText, StickyNote, List } from "lucide-react";
import { VideoPopup } from "@/components/video-popup";
import { WordTooltip } from "@/components/word-tooltip";
import { useTranslation } from "@/lib/translations";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations, chapterTitleTranslations, sectionTitleTranslations, verseSectionTitleTranslations } from "@/lib/content-translations";
import type { BookWithVerseMeta, VerseMeta, VerseTranslation, Explanation, VerseWithTranslations } from "@shared/schema";
import shankaracharyaImg from "@assets/image_1770455528511.png";

interface TOCAdhyay {
  adhyayNumber: number;
  adhyayTitle: string;
  verses: VerseMeta[];
  khandas: TOCKhanda[];
}

interface TOCKhanda {
  khandaNumber: number;
  khandaTitle: string;
  verses: VerseMeta[];
}

function buildTOCHierarchy(verses: VerseMeta[], t?: (key: string) => string): { type: "three-level" | "two-level" | "flat"; groups: TOCAdhyay[] } {
  const hasThreeLevel = verses.some(v => v.adhyayNumber != null && v.khandaNumber != null);
  const hasTwoLevel = verses.some(v => v.adhyayNumber != null);
  if (!hasThreeLevel && !hasTwoLevel) return { type: "flat", groups: [] };

  const chapterLabel = t ? t("chapterFull") : "Chapter";
  const sectionLabel = t ? t("section") : "Section";

  const type = hasThreeLevel ? "three-level" : "two-level";
  const hierarchyVerses = verses.filter(v => v.adhyayNumber != null);
  const adhyayMap = new Map<number, TOCAdhyay>();

  for (const verse of hierarchyVerses) {
    const adhyayNum = verse.adhyayNumber!;
    if (!adhyayMap.has(adhyayNum)) {
      adhyayMap.set(adhyayNum, {
        adhyayNumber: adhyayNum,
        adhyayTitle: verse.adhyayTitle ?? `${chapterLabel} ${adhyayNum}`,
        verses: [],
        khandas: [],
      });
    }
    const adhyay = adhyayMap.get(adhyayNum)!;
    if (type === "three-level" && verse.khandaNumber != null) {
      let khanda = adhyay.khandas.find(k => k.khandaNumber === verse.khandaNumber);
      if (!khanda) {
        khanda = { khandaNumber: verse.khandaNumber, khandaTitle: verse.khandaTitle ?? `${sectionLabel} ${verse.khandaNumber}`, verses: [] };
        adhyay.khandas.push(khanda);
      }
      khanda.verses.push(verse);
    } else {
      adhyay.verses.push(verse);
    }
  }

  const sorted = Array.from(adhyayMap.values()).sort((a, b) => a.adhyayNumber - b.adhyayNumber);
  for (const adhyay of sorted) {
    adhyay.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    adhyay.khandas.sort((a, b) => a.khandaNumber - b.khandaNumber);
    for (const khanda of adhyay.khandas) {
      khanda.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    }
  }
  return { type, groups: sorted };
}

const bookMediaConfig: Record<string, { videoId?: string; videoTitle?: string }> = {
  "isha-upanishad-bhashya": {
    videoId: "8ELHatzdtAk",
    videoTitle: "Introduction to Isha Upanishad",
  },
};

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
}

interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

interface VerseBreadcrumb {
  bookTitle: string;
  adhyayNumber: number | null;
  adhyayTitle: string | null;
  khandaNumber: number | null;
  khandaTitle: string | null;
  verseLabel: string;
  numericLabel: string;
}

interface BookReaderProps {
  bookId: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
  onAuthorChange: (author: string | null) => void;
  navigateToVerse?: number | null;
  onVerseChange?: (verseNumber: number) => void;
  onBreadcrumbChange?: (breadcrumb: VerseBreadcrumb) => void;
  onAddNoteWithText?: (text: string) => void;
  chapterViewAdhyay?: number | null;
  chapterViewKhanda?: number | null;
  onExitChapterView?: (verseNumber?: number) => void;
  onSelectChapter?: (adhyayNumber: number) => void;
  onSelectPart?: (adhyayNumber: number, khandaNumber: number) => void;
  onShowCoverPage?: () => void;
}

function isShankaracharya(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("shankaracharya") || lower.includes("sankara") || lower.includes("śaṅkara");
}

function VerseExplanation({ 
  verseId, 
  languageCode, 
  authorName,
  showAll 
}: { 
  verseId: string; 
  languageCode: string;
  authorName: string | null;
  showAll: boolean;
}) {
  const { t, locale } = useTranslation(languageCode);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, locale);
  const [showMoreCommentaries, setShowMoreCommentaries] = useState(false);
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  const allForLanguage = explanations?.filter(e => e.languageCode === languageCode) || [];

  let effectiveAuthor = authorName;
  if (!showAll && authorName && !allForLanguage.some(e => e.authorName === authorName) && allForLanguage.length > 0) {
    effectiveAuthor = allForLanguage[0].authorName;
  }

  const primaryExplanations = showAll
    ? allForLanguage
    : allForLanguage.filter(e => !effectiveAuthor || e.authorName === effectiveAuthor);

  const otherExplanations = !showAll && effectiveAuthor
    ? allForLanguage.filter(e => e.authorName !== effectiveAuthor)
    : [];

  if (primaryExplanations.length === 0 && otherExplanations.length === 0) {
    return null;
  }

  const groupExplanations = (items: Explanation[]) =>
    items.reduce((acc, exp) => {
      const key = exp.authorName;
      if (!acc[key]) acc[key] = { authorName: exp.authorName, authorTitle: exp.authorTitle, items: [] };
      acc[key].items.push(exp);
      return acc;
    }, {} as Record<string, { authorName: string; authorTitle: string | null; items: Explanation[] }>);

  const primaryGrouped = groupExplanations(primaryExplanations);
  const otherGrouped = groupExplanations(otherExplanations);

  const renderGroup = (group: { authorName: string; authorTitle: string | null; items: Explanation[] }, gIdx: number) => (
    <div 
      key={group.authorName} 
      className={`${gIdx > 0 ? "pt-5 border-t border-border/40" : ""}`}
      data-testid={`commentary-group-${group.authorName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-3">
        {isShankaracharya(group.authorName) ? (
          <img src={shankaracharyaImg} alt="Adi Shankaracharya" className="h-8 w-8 object-contain shrink-0" />
        ) : (
          <User className="h-4 w-4 text-primary/70 shrink-0" />
        )}
        <h4 className="text-sm font-semibold text-foreground">{tc(group.authorName, bookAuthorTranslations)}</h4>
        {group.authorTitle && (
          <span className="text-xs text-muted-foreground">- {group.authorTitle}</span>
        )}
      </div>
      {group.items.map((explanation, idx) => (
        <div key={idx} className={idx > 0 ? "mt-3 pt-3 border-t border-border/20" : ""}>
          <div className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90 pl-6" data-testid={`commentary-text-${idx}`}>
            <WordTooltip
              content={explanation.content}
              sourceLanguage={languageCode}
              verseId={verseId}
              className="inline"
              useWordMeanings={false}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-6 space-y-6" data-testid={`explanation-${verseId}`}>
      {Object.values(primaryGrouped).map((group, gIdx) => renderGroup(group, gIdx))}

      {otherExplanations.length > 0 && (
        <>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowMoreCommentaries(!showMoreCommentaries)}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-border/50 hover:border-primary/30 bg-background/60 backdrop-blur-sm"
              data-testid="button-show-more-commentaries"
            >
              <MessageSquareText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{showMoreCommentaries ? t("hideOtherCommentaries") : `${t("showMore")} (${Object.keys(otherGrouped).length} ${t("more")})`}</span>
              <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 ${showMoreCommentaries ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showMoreCommentaries && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
              {Object.values(otherGrouped).map((group, gIdx) => renderGroup(group, gIdx))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BookReader({ 
  bookId, 
  onVerseSelect,
  selectedVerseId,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  navigateToVerse,

  onVerseChange,
  onBreadcrumbChange,
  onAddNoteWithText,
  chapterViewAdhyay,
  chapterViewKhanda,
  onExitChapterView,
  onSelectChapter,
  onSelectPart,
  onShowCoverPage,
}: BookReaderProps) {
  const { t } = useTranslation(selectedCommentaryLanguage);
  const lang = selectedCommentaryLanguage || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, lang);
  const [currentPage, setCurrentPage] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const hasNavigatedRef = useRef(false);
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showCoverPage, setShowCoverPage] = useState(true);
  const [expandedTOCAdhyays, setExpandedTOCAdhyays] = useState<Set<number>>(new Set());
  const [expandedTOCKhandas, setExpandedTOCKhandas] = useState<Set<string>>(new Set());

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 2) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  const handleAddNoteFromSelection = useCallback(() => {
    if (selectionPopup && onAddNoteWithText) {
      onAddNoteWithText(selectionPopup.text);
      window.getSelection()?.removeAllRanges();
      setSelectionPopup(null);
    }
  }, [selectionPopup, onAddNoteWithText]);

  useEffect(() => {
    const dismiss = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setSelectionPopup(null);
        }
      }, 200);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  const { data: book, isLoading, error } = useQuery<BookWithVerseMeta>({
    queryKey: ["/api/books", bookId],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
  });

  const verses = book?.verses || [];
  const currentVerseMeta = verses[currentPage] || null;

  const { data: currentVerseDetails, isLoading: isVerseLoading } = useQuery<VerseWithTranslations>({
    queryKey: ["/api/verses", currentVerseMeta?.id],
    enabled: !!currentVerseMeta?.id && chapterViewAdhyay == null,
  });

  const { data: chapterVerses, isLoading: isChapterLoading } = useQuery<VerseWithTranslations[]>({
    queryKey: ["/api/books", bookId, "chapter", chapterViewAdhyay, "verses"],
    enabled: chapterViewAdhyay != null,
  });

  useEffect(() => {
    setInitialized(false);
  }, [bookId]);

  useEffect(() => {
    if (commentaryOptions && !initialized) {
      onAuthorChange("__all__");
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, onAuthorChange]);

  const isShowingAll = selectedAuthor === "__all__";

  const currentVerse = currentVerseMeta;

  const availableAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    if (!selectedCommentaryLanguage) return commentaryOptions.authors;
    return commentaryOptions.authors.filter(a => a.languageCodes.includes(selectedCommentaryLanguage));
  }, [commentaryOptions, selectedCommentaryLanguage]);

  const handleAuthorChange = (authorName: string) => {
    onAuthorChange(authorName);
  };

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  const currentNumericLabel = useMemo(() => {
    if (!currentVerse || currentVerse.adhyayNumber == null || currentVerse.khandaNumber == null) {
      return null;
    }
    const khandaVerses = verses
      .filter((v: VerseMeta) => v.adhyayNumber === currentVerse.adhyayNumber && v.khandaNumber === currentVerse.khandaNumber)
      .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
    const idx = khandaVerses.findIndex((v: VerseMeta) => v.id === currentVerse.id);
    return `${currentVerse.adhyayNumber}.${currentVerse.khandaNumber}.${idx >= 0 ? idx + 1 : 1}`;
  }, [currentVerse, verses]);

  useEffect(() => {
    setCurrentPage(0);
    setShowCoverPage(true);
    hasNavigatedRef.current = false;
    setExpandedTOCAdhyays(new Set());
    setExpandedTOCKhandas(new Set());
  }, [bookId]);

  useEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && verses.length > 0) {
      const pageIndex = verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0) {
        setCurrentPage(pageIndex);
        setShowCoverPage(false);
        hasNavigatedRef.current = true;
      }
    } else if (chapterViewAdhyay == null && navigateToVerse == null && !showCoverPage && !hasNavigatedRef.current) {
      setShowCoverPage(true);
    }
  }, [chapterViewAdhyay, navigateToVerse, verses]);

  useEffect(() => {
    if (onVerseChange && currentVerse && !showCoverPage) {
      onVerseChange(currentVerse.verseNumber);
    }
  }, [currentPage, currentVerse, onVerseChange, showCoverPage]);

  useEffect(() => {
    if (onBreadcrumbChange && currentVerse && !showCoverPage && book) {
      const verse = currentVerse;
      const adhyayNum = verse.adhyayNumber;
      const khandaNum = verse.khandaNumber;

      let numericLabel: string;
      if (adhyayNum != null && khandaNum != null) {
        const khandaVerses = verses
          .filter((v: VerseMeta) => v.adhyayNumber === adhyayNum && v.khandaNumber === khandaNum)
          .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
        const idx = khandaVerses.findIndex((v) => v.id === verse.id);
        numericLabel = `${adhyayNum}.${khandaNum}.${idx >= 0 ? idx + 1 : 1}`;
      } else {
        numericLabel = `${verse.verseNumber}`;
      }

      onBreadcrumbChange({
        bookTitle: tc(book.title, bookTitleTranslations),
        adhyayNumber: adhyayNum ?? null,
        adhyayTitle: tc(verse.adhyayTitle, chapterTitleTranslations) || null,
        khandaNumber: khandaNum ?? null,
        khandaTitle: tc(verse.khandaTitle, sectionTitleTranslations) || null,
        verseLabel: tc(verse.sectionTitle, verseSectionTitleTranslations) || `${t("mantra")} ${verse.verseNumber}`,
        numericLabel,
      });
    }
  }, [currentPage, book, onBreadcrumbChange, showCoverPage]);

  const availableTranslations = useMemo(() => {
    if (!currentVerseDetails?.translations) return [];
    if (!selectedCommentaryLanguage || selectedCommentaryLanguage === "devanagari" || selectedCommentaryLanguage === "sa") {
      return [];
    }
    const langAliases: Record<string, string[]> = {
      "english": ["english", "en"],
      "en": ["english", "en"],
      "hi": ["hi", "hindi"],
      "hindi": ["hi", "hindi"],
    };
    const matchCodes = langAliases[selectedCommentaryLanguage] || [selectedCommentaryLanguage];
    const filtered = currentVerseDetails.translations.filter((t: VerseTranslation) =>
      matchCodes.includes(t.languageCode)
    );
    return filtered;
  }, [currentVerseDetails, selectedCommentaryLanguage]);

  const commentaryContext = useMemo(() => {
    if (!selectedAuthor || !selectedCommentaryLanguage || !currentVerseDetails) return "";
    const explanation = currentVerseDetails.explanations?.find(
      (e: Explanation) => e.authorName === selectedAuthor && e.languageCode === selectedCommentaryLanguage
    );
    return explanation?.content || "";
  }, [selectedAuthor, selectedCommentaryLanguage, currentVerseDetails]);

  useEffect(() => {
    if (currentVerse && currentVerseDetails) {
      const langCode = selectedCommentaryLanguage || "devanagari";
      if (langCode === "devanagari" || langCode === "sa") {
        const content = getOriginalDevanagari(currentVerseDetails);
        onVerseSelect(currentVerse.id, content);
        return;
      }
      const langAliases: Record<string, string[]> = {
        "english": ["english", "en"],
        "en": ["english", "en"],
        "hi": ["hi", "hindi"],
        "hindi": ["hi", "hindi"],
      };
      const matchCodes = langAliases[langCode] || [langCode];
      let content = "";
      const matched = currentVerseDetails.translations?.find(
        (t: VerseTranslation) => matchCodes.includes(t.languageCode)
      );
      content = matched?.content || "";
      if (!content) {
        content = getOriginalDevanagari(currentVerseDetails);
      }
      onVerseSelect(currentVerse.id, content);
    }
  }, [currentVerse, currentVerseDetails, selectedCommentaryLanguage]);

  const tocHierarchy = useMemo(() => buildTOCHierarchy(verses, t as any), [verses, t]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 sm:h-12 w-3/4" />
          <Skeleton className="h-5 sm:h-6 w-1/2" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Unable to load this text</p>
        </div>
      </div>
    );
  }

  const totalPages = verses.length;

  const getTranslation = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  const getOriginalDevanagari = (verse: any): string => {
    const devText = getTranslation(verse, "devanagari");
    if (devText) return devText;
    return getTranslation(verse, "sa");
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goToNextPage();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPrevPage();
    }
  };

  const originalDevanagari = currentVerseDetails ? getOriginalDevanagari(currentVerseDetails) : "";

  const handleTOCVerseClick = (verseNumber: number) => {
    const pageIndex = verses.findIndex(v => v.verseNumber === verseNumber);
    if (pageIndex >= 0) {
      setCurrentPage(pageIndex);
      setShowCoverPage(false);
    }
  };

  const toggleTOCAdhyay = (adhyayNumber: number) => {
    const next = new Set(expandedTOCAdhyays);
    if (next.has(adhyayNumber)) next.delete(adhyayNumber);
    else next.add(adhyayNumber);
    setExpandedTOCAdhyays(next);
  };

  const toggleTOCKhanda = (key: string) => {
    const next = new Set(expandedTOCKhandas);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedTOCKhandas(next);
  };

  if (showCoverPage && book && !isLoading && chapterViewAdhyay == null) {
    return (
      <div className="flex-1 flex flex-col min-w-0 focus:outline-none">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-2xl xl:max-w-3xl mx-auto">
            <div className="py-4 sm:py-6">
              <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                <span className="text-2xl sm:text-3xl text-primary/20 font-serif mb-2 select-none pointer-events-none">ॐ</span>
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight" data-testid="text-cover-title">
                  {tc(book.title, bookTitleTranslations)}
                </h1>
                <Badge variant="secondary" className="mt-1.5 text-[10px] sm:text-xs">
                  {tc(book.category, bookCategoryTranslations)}
                </Badge>
              </div>

              {book.description && (
                <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed text-center mb-3 sm:mb-4 max-w-lg mx-auto" data-testid="text-cover-description">
                  {tc(book.title, bookDescriptionTranslations) !== book.title ? tc(book.title, bookDescriptionTranslations) : book.description}
                </p>
              )}

              <div className="flex items-center justify-center mb-3">
                <span className="text-xs text-muted-foreground">{verses.length} {t("verses")}</span>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => {
                  if (tocHierarchy.groups.length > 0) {
                    onSelectChapter?.(tocHierarchy.groups[0].adhyayNumber);
                  } else {
                    setCurrentPage(0);
                    setShowCoverPage(false);
                  }
                }}
                data-testid="button-start-reading"
              >
                <BookOpen className="h-4 w-4" />
                {t("startReading")}
              </Button>
            </div>

            {tocHierarchy.groups.length > 0 && (
              <div className="mt-4 sm:mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <List className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="font-serif text-base sm:text-lg font-semibold" data-testid="text-toc-heading">{t("tableOfContents")}</h2>
                </div>

                <div className="space-y-1" data-testid="toc-list">
                  {tocHierarchy.groups.map(adhyay => {
                    const isExpanded = expandedTOCAdhyays.has(adhyay.adhyayNumber);
                    return (
                      <div key={adhyay.adhyayNumber}>
                        <div className="flex items-center w-full rounded-lg hover-elevate active-elevate-2 transition-colors">
                          <button
                            className="shrink-0 px-2 py-2.5"
                            onClick={() => toggleTOCAdhyay(adhyay.adhyayNumber)}
                            data-testid={`toc-toggle-adhyay-${adhyay.adhyayNumber}`}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                          <button
                            className="flex items-center gap-2 flex-1 min-w-0 py-2.5 pr-3 text-left"
                            onClick={() => {
                              onSelectChapter?.(adhyay.adhyayNumber);
                            }}
                            data-testid={`toc-adhyay-${adhyay.adhyayNumber}`}
                          >
                            <Badge variant="outline" className="font-mono text-[10px] sm:text-[11px] px-1.5 h-5 shrink-0 border-primary/30 text-primary">
                              {t("chapter")} {adhyay.adhyayNumber}
                            </Badge>
                            <span className="text-sm sm:text-base font-medium truncate">{tc(adhyay.adhyayTitle, chapterTitleTranslations)}</span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="ml-5 sm:ml-6 pl-3 border-l border-primary/10 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            {tocHierarchy.type === "three-level" ? (
                              adhyay.khandas.map(khanda => {
                                const khandaKey = `${adhyay.adhyayNumber}-${khanda.khandaNumber}`;
                                const isKhandaExpanded = expandedTOCKhandas.has(khandaKey);
                                return (
                                  <div key={khandaKey}>
                                    <div className="flex items-center w-full rounded-lg hover-elevate active-elevate-2 transition-colors">
                                      <button
                                        className="shrink-0 px-2 py-2"
                                        onClick={() => toggleTOCKhanda(khandaKey)}
                                        data-testid={`toc-toggle-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                                      >
                                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isKhandaExpanded ? "rotate-90" : ""}`} />
                                      </button>
                                      <button
                                        className="flex items-center gap-2 flex-1 min-w-0 py-2 pr-2 text-left"
                                        onClick={() => {
                                          onSelectPart?.(adhyay.adhyayNumber, khanda.khandaNumber);
                                        }}
                                        data-testid={`toc-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                                      >
                                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 h-4.5 shrink-0 border-muted-foreground/30">
                                          {t("part")} {adhyay.adhyayNumber}.{khanda.khandaNumber}
                                        </Badge>
                                        <span className="text-xs sm:text-sm text-muted-foreground truncate">{tc(khanda.khandaTitle, sectionTitleTranslations)}</span>
                                      </button>
                                    </div>

                                    {isKhandaExpanded && (
                                      <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                        {khanda.verses.map((v, idx) => (
                                          <button
                                            key={v.id}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover-elevate active-elevate-2 transition-colors"
                                            onClick={() => handleTOCVerseClick(v.verseNumber)}
                                            data-testid={`toc-verse-${v.verseNumber}`}
                                          >
                                            <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-14">
                                              {t("sloka")} {adhyay.adhyayNumber}.{khanda.khandaNumber}.{idx + 1}
                                            </span>
                                            <span className="text-xs text-muted-foreground truncate">
                                              {tc(v.sectionTitle, verseSectionTitleTranslations) || `${t("mantra")} ${idx + 1}`}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              adhyay.verses.map((v, idx) => (
                                <button
                                  key={v.id}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover-elevate active-elevate-2 transition-colors"
                                  onClick={() => handleTOCVerseClick(v.verseNumber)}
                                  data-testid={`toc-verse-${v.verseNumber}`}
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-10">
                                    {t("sloka")} {adhyay.adhyayNumber}.{idx + 1}
                                  </span>
                                  <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                    {tc(v.sectionTitle, verseSectionTitleTranslations) || `${t("verse")} ${idx + 1}`}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {book?.slug && bookMediaConfig[book.slug]?.videoId && (
          <div className="border-t border-border px-3 sm:px-8 py-2 sm:py-3 bg-background/80 backdrop-blur-sm">
            <div className="max-w-3xl xl:max-w-4xl mx-auto flex items-center justify-center">
              <VideoPopup
                videoId={bookMediaConfig[book.slug].videoId!}
                title={bookMediaConfig[book.slug].videoTitle || t("introductionVideo")}
                buttonLabel={t("watchVideo")}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (chapterViewAdhyay != null && book) {
    const chapterInfo = tocHierarchy.groups.find(g => g.adhyayNumber === chapterViewAdhyay);
    const chapterTitle = chapterInfo?.adhyayTitle || `${t("chapterFull")} ${chapterViewAdhyay}`;
    const selectedKhandaInfo = chapterViewKhanda != null && chapterInfo
      ? chapterInfo.khandas.find(k => k.khandaNumber === chapterViewKhanda)
      : null;

    const getChapterTranslation = (verse: VerseWithTranslations, langCode: string): string => {
      const langAliases: Record<string, string[]> = {
        "english": ["english", "en"],
        "en": ["english", "en"],
        "hi": ["hi", "hindi"],
        "hindi": ["hi", "hindi"],
      };
      const matchCodes = langAliases[langCode] || [langCode];
      const tr = verse.translations?.find(tr => matchCodes.includes(tr.languageCode));
      return tr?.content || "";
    };

    const getChapterDevanagari = (verse: VerseWithTranslations): string => {
      const devText = verse.translations?.find(tr => tr.languageCode === "devanagari")?.content;
      if (devText) return devText;
      return verse.translations?.find(tr => tr.languageCode === "sa")?.content || "";
    };

    const showTranslation = selectedCommentaryLanguage && selectedCommentaryLanguage !== "devanagari" && selectedCommentaryLanguage !== "sa";

    const filteredChapterVerses = chapterViewKhanda != null && selectedKhandaInfo
      ? chapterVerses?.filter(v => selectedKhandaInfo.verses.some(sv => sv.verseNumber === v.verseNumber))
      : chapterVerses;

    const groupedByKhanda = chapterViewKhanda == null && chapterInfo && tocHierarchy.type === "three-level"
      ? chapterInfo.khandas.map(k => ({
          khandaNumber: k.khandaNumber,
          khandaTitle: k.khandaTitle,
          verseNumbers: k.verses.map(v => v.verseNumber),
        }))
      : null;

    const headerBadge = chapterViewKhanda != null
      ? `${t("part")} ${chapterViewAdhyay}.${chapterViewKhanda}`
      : `${t("chapter")} ${chapterViewAdhyay}`;
    const headerSubtitle = selectedKhandaInfo
      ? tc(selectedKhandaInfo.khandaTitle, sectionTitleTranslations)
      : chapterTitle;

    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border/50 px-4 sm:px-8 py-2 sm:py-3 shrink-0">
          <div className="max-w-2xl xl:max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs sm:text-sm">
                <span
                  className="font-serif text-muted-foreground/70 truncate max-w-[120px] cursor-pointer hover:text-primary transition-colors shrink-0 hidden sm:inline"
                  onClick={onShowCoverPage}
                  data-testid="chapter-nav-book"
                >
                  {tc(book.title, bookTitleTranslations)}
                </span>
                {chapterViewKhanda != null ? (
                  <>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40 hidden sm:block" />
                    <span
                      className="font-serif text-muted-foreground/70 truncate max-w-[100px] cursor-pointer hover:text-primary transition-colors shrink-0"
                      onClick={() => onSelectChapter?.(chapterViewAdhyay!)}
                      data-testid="chapter-nav-adhyay"
                    >
                      {chapterTitle}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <span className="font-serif text-foreground/80 font-medium truncate">
                      {headerSubtitle}
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40 hidden sm:block" />
                    <span className="font-serif text-foreground/80 font-medium truncate">
                      {headerSubtitle}
                    </span>
                  </>
                )}
                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-4.5 shrink-0">{headerBadge}</Badge>
              </div>
              {onExitChapterView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExitChapterView}
                  className="gap-1.5 text-xs"
                  data-testid="button-exit-chapter-view"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("singleVerse")}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl xl:max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
            {isChapterLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-5 w-20 mx-auto" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-3/4 mx-auto" />
                  </div>
                ))}
              </div>
            ) : filteredChapterVerses && filteredChapterVerses.length > 0 ? (
              <div>
                {groupedByKhanda ? (
                  groupedByKhanda.map((khanda, kIdx) => {
                    const khandaVerses = filteredChapterVerses.filter(v => khanda.verseNumbers.includes(v.verseNumber));
                    if (khandaVerses.length === 0) return null;
                    return (
                      <div key={khanda.khandaNumber}>
                        {kIdx > 0 && (
                          <div className="my-8 sm:my-10 flex items-center gap-4">
                            <div className="h-px flex-1 bg-primary/20"></div>
                            <span className="text-primary/30 text-lg">✦</span>
                            <div className="h-px flex-1 bg-primary/20"></div>
                          </div>
                        )}
                        <div
                          className="text-center mb-6 sm:mb-8 cursor-pointer group"
                          onClick={() => onSelectPart?.(chapterViewAdhyay!, khanda.khandaNumber)}
                          data-testid={`chapter-view-khanda-${khanda.khandaNumber}`}
                        >
                          <span className="text-xs sm:text-sm font-serif text-primary/60 tracking-wider uppercase group-hover:text-primary transition-colors">
                            {t("part")} {chapterViewAdhyay}.{khanda.khandaNumber}
                          </span>
                          <h3 className="font-serif text-sm sm:text-base text-foreground/80 mt-1 group-hover:text-primary transition-colors">
                            {tc(khanda.khandaTitle, sectionTitleTranslations)}
                          </h3>
                        </div>
                        {khandaVerses.map((verse, idx) => {
                          const devanagari = getChapterDevanagari(verse);
                          const translation = showTranslation ? getChapterTranslation(verse, selectedCommentaryLanguage!) : "";
                          const verseLabel = `${chapterViewAdhyay}.${khanda.khandaNumber}.${idx + 1}`;
                          return (
                            <div key={verse.id}>
                              <div
                                className="py-4 sm:py-6 text-center cursor-pointer group"
                                onClick={() => {
                                  const pageIdx = verses.findIndex(v => v.verseNumber === verse.verseNumber);
                                  if (pageIdx >= 0) {
                                    setCurrentPage(pageIdx);
                                    setShowCoverPage(false);
                                    hasNavigatedRef.current = true;
                                    onExitChapterView?.(verse.verseNumber);
                                  }
                                }}
                                data-testid={`chapter-verse-${verse.verseNumber}`}
                              >
                                {devanagari && (
                                  <div className="font-serif text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors">
                                    {devanagari}
                                  </div>
                                )}
                                <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-serif">
                                  ॥ {verseLabel} ॥
                                </div>
                                {verse.sectionTitle && (
                                  <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-serif mt-1 italic">
                                    {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                                  </div>
                                )}
                                {translation && (
                                  <div className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-muted-foreground">
                                    {translation}
                                  </div>
                                )}
                              </div>
                              {idx < khandaVerses.length - 1 && (
                                <div className="flex justify-center py-1">
                                  <div className="w-16 h-px bg-primary/15"></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  filteredChapterVerses.map((verse, idx) => {
                    const devanagari = getChapterDevanagari(verse);
                    const translation = showTranslation ? getChapterTranslation(verse, selectedCommentaryLanguage!) : "";
                    const verseLabel = chapterViewKhanda != null
                      ? `${chapterViewAdhyay}.${chapterViewKhanda}.${idx + 1}`
                      : `${chapterViewAdhyay}.${idx + 1}`;
                    return (
                      <div key={verse.id}>
                        <div
                          className="py-4 sm:py-6 text-center cursor-pointer group"
                          onClick={() => {
                            const pageIdx = verses.findIndex(v => v.verseNumber === verse.verseNumber);
                            if (pageIdx >= 0) {
                              setCurrentPage(pageIdx);
                              setShowCoverPage(false);
                              hasNavigatedRef.current = true;
                              onExitChapterView?.(verse.verseNumber);
                            }
                          }}
                          data-testid={`chapter-verse-${verse.verseNumber}`}
                        >
                          {devanagari && (
                            <div className="font-serif text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors">
                              {devanagari}
                            </div>
                          )}
                          <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-serif">
                            ॥ {verseLabel} ॥
                          </div>
                          {verse.sectionTitle && (
                            <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-serif mt-1 italic">
                              {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                            </div>
                          )}
                          {translation && (
                            <div className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-muted-foreground">
                              {translation}
                            </div>
                          )}
                        </div>
                        {idx < filteredChapterVerses.length - 1 && (
                          <div className="flex justify-center py-1">
                            <div className="w-16 h-px bg-primary/15"></div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{t("noVersesInChapter")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentVerse) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">{t("noVersesAvailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 focus:outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
          {selectionPopup && onAddNoteWithText && (
            <div
              className="fixed z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
              style={{ left: `${selectionPopup.x}px`, top: `${selectionPopup.y}px`, transform: "translate(-50%, -100%)" }}
              data-testid="selection-popup"
            >
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs shadow-lg"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNoteFromSelection}
                data-testid="button-annotate-selection"
              >
                <StickyNote className="h-3 w-3" />
                Add Note
              </Button>
            </div>
          )}
          <div className="max-w-2xl xl:max-w-3xl w-full mx-auto">
            {isVerseLoading || !currentVerseDetails ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-32 mx-auto" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-3/4 mx-auto" />
              </div>
            ) : (
            <div 
              className="py-2"
              data-testid={`verse-${currentVerse.verseNumber}`}
              onMouseUp={handleTextSelect}
              onTouchEnd={handleTextSelect}
            >
              <div className="text-center mb-4 sm:mb-5">
                <span className="text-xs text-muted-foreground font-serif">
                  {tc(currentVerse.sectionTitle, verseSectionTitleTranslations) || `${t("verse")} ${currentVerse.verseNumber}`}
                  {currentNumericLabel && <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">({currentNumericLabel})</span>}
                </span>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div 
                  className="font-serif text-lg sm:text-xl leading-relaxed sm:leading-loose text-center"
                  data-testid={`text-original-${currentVerse.verseNumber}`}
                >
                  <WordTooltip
                    content={originalDevanagari}
                    commentaryContent={commentaryContext}
                    sourceLanguage="devanagari"
                    verseId={currentVerse.id}
                  />
                </div>

                {availableTranslations.length > 0 && (
                  <div className="border-t border-border/30 pt-3 sm:pt-4 space-y-3">
                    {availableTranslations.map((translation: VerseTranslation) => (
                      <div key={translation.id}>
                        <div 
                          className="text-sm sm:text-base leading-relaxed text-center text-muted-foreground"
                          data-testid={`text-translation-${translation.languageCode}-${currentVerse.verseNumber}`}
                        >
                          <WordTooltip
                            content={translation.content}
                            commentaryContent={commentaryContext}
                            sourceLanguage={translation.languageCode}
                            verseId={currentVerse.id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hasCommentaryOptions && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setCommentaryExpanded(!commentaryExpanded)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                        data-testid="button-toggle-commentary"
                      >
                        <MessageSquareText className="h-3.5 w-3.5" />
                        <span>{commentaryExpanded ? `Hide ${t("commentary")}` : t("commentary")}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${commentaryExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {commentaryExpanded && selectedCommentaryLanguage && (
                      <div className="pt-3 border-t border-border/30 animate-in fade-in slide-in-from-top-2 duration-200">
                        <VerseExplanation 
                          verseId={currentVerse.id} 
                          languageCode={selectedCommentaryLanguage}
                          authorName={isShowingAll ? null : selectedAuthor}
                          showAll={isShowingAll}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 px-4 sm:px-8 py-2 sm:py-3">
          <div className="max-w-2xl xl:max-w-3xl mx-auto flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="gap-1"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("previous")}</span>
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="gap-1"
              data-testid="button-next-page"
            >
              <span className="hidden sm:inline">{t("next")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {book?.slug && bookMediaConfig[book.slug]?.videoId && (
          <div className="border-t border-border px-3 sm:px-8 py-2 bg-background/80">
            <div className="max-w-2xl xl:max-w-3xl mx-auto flex items-center justify-center">
              <VideoPopup 
                videoId={bookMediaConfig[book.slug].videoId!}
                title={bookMediaConfig[book.slug].videoTitle || t("introductionVideo")}
                buttonLabel={t("watchVideo")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
