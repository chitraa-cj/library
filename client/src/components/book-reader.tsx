import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, User, Globe, Sparkles, MessageSquareText, StickyNote } from "lucide-react";
import { VideoPopup } from "@/components/video-popup";
import { WordTooltip } from "@/components/word-tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookWithVerseMeta, VerseMeta, VerseTranslation, Explanation, VerseWithTranslations } from "@shared/schema";
import shankaracharyaImg from "@assets/image_1770455528511.png";
import rishiImg from "@assets/image_1770455608411.png";
import meditatingRishiImg from "@assets/image_1770455642043.png";

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
  onLanguageChange: (lang: string | null) => void;
  navigateToVerse?: number | null;
  onVerseChange?: (verseNumber: number) => void;
  onBreadcrumbChange?: (breadcrumb: VerseBreadcrumb) => void;
  onAddNoteWithText?: (text: string) => void;
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
  const [showMoreCommentaries, setShowMoreCommentaries] = useState(false);
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  const allForLanguage = explanations?.filter(e => e.languageCode === languageCode) || [];

  const primaryExplanations = showAll
    ? allForLanguage
    : allForLanguage.filter(e => !authorName || e.authorName === authorName);

  const otherExplanations = !showAll && authorName
    ? allForLanguage.filter(e => e.authorName !== authorName)
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
        <h4 className="text-sm font-semibold text-foreground">{group.authorName}</h4>
        {group.authorTitle && (
          <span className="text-xs text-muted-foreground">- {group.authorTitle}</span>
        )}
      </div>
      {group.items.map((explanation, idx) => (
        <div key={idx} className={idx > 0 ? "mt-3 pt-3 border-t border-border/20" : ""}>
          <div className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90 pl-6">
            <WordTooltip
              content={explanation.content}
              sourceLanguage={languageCode}
              verseId={verseId}
              className="inline"
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
              <span>{showMoreCommentaries ? "Hide Other Commentaries" : `Show More (${Object.keys(otherGrouped).length} more)`}</span>
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
  onLanguageChange,
  navigateToVerse,
  onVerseChange,
  onBreadcrumbChange,
  onAddNoteWithText,
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [commentaryExpanded, setCommentaryExpanded] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);

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
    enabled: !!currentVerseMeta?.id,
  });

  useEffect(() => {
    setInitialized(false);
    onAuthorChange("__all__");
  }, [bookId, onAuthorChange]);

  useEffect(() => {
    if (commentaryOptions && !initialized) {
      onAuthorChange("__all__");
      if (commentaryOptions.languages.length > 0) {
        onLanguageChange(commentaryOptions.languages[0].code);
      }
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, onAuthorChange, onLanguageChange]);

  const isShowingAll = selectedAuthor === "__all__";

  const currentVerse = currentVerseMeta;

  const availableLanguagesForAuthor = useMemo(() => {
    if (!commentaryOptions) return [];
    if (isShowingAll) {
      return commentaryOptions.languages;
    }
    const author = commentaryOptions.authors.find(a => a.authorName === selectedAuthor);
    if (!author) return [];
    return commentaryOptions.languages.filter(l => author.languageCodes.includes(l.code));
  }, [selectedAuthor, commentaryOptions, isShowingAll]);

  const availableAuthors = useMemo(() => {
    return commentaryOptions?.authors || [];
  }, [commentaryOptions]);

  const handleAuthorChange = (authorName: string) => {
    onAuthorChange(authorName);
    if (authorName === "__all__") {
      if (commentaryOptions && commentaryOptions.languages.length > 0) {
        if (!selectedCommentaryLanguage) {
          onLanguageChange(commentaryOptions.languages[0].code);
        }
      }
    } else {
      const author = commentaryOptions?.authors.find(a => a.authorName === authorName);
      if (author && author.languageCodes.length > 0) {
        if (!selectedCommentaryLanguage || !author.languageCodes.includes(selectedCommentaryLanguage)) {
          onLanguageChange(author.languageCodes[0]);
        }
      }
    }
  };

  const handleLanguageChange = (langCode: string) => {
    onLanguageChange(langCode);
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
  }, [bookId]);

  useEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && verses.length > 0) {
      const pageIndex = verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0 && pageIndex !== currentPage) {
        setCurrentPage(pageIndex);
      }
    }
  }, [navigateToVerse, verses]);

  useEffect(() => {
    if (onVerseChange && currentVerse) {
      onVerseChange(currentVerse.verseNumber);
    }
  }, [currentPage, currentVerse, onVerseChange]);

  useEffect(() => {
    if (onBreadcrumbChange && currentVerse) {
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
        bookTitle: book.title,
        adhyayNumber: adhyayNum ?? null,
        adhyayTitle: verse.adhyayTitle || null,
        khandaNumber: khandaNum ?? null,
        khandaTitle: verse.khandaTitle || null,
        verseLabel: verse.sectionTitle || `Mantra ${verse.verseNumber}`,
        numericLabel,
      });
    }
  }, [currentPage, book, onBreadcrumbChange]);

  useEffect(() => {
    if (currentVerse && currentVerseDetails) {
      const langCode = selectedCommentaryLanguage || "devanagari";
      const content = getTranslation(currentVerseDetails, langCode);
      onVerseSelect(currentVerse.id, content);
    }
  }, [currentVerse, currentVerseDetails, selectedCommentaryLanguage]);

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
    return getTranslation(verse, "devanagari");
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

  if (!currentVerse) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No verses available</p>
        </div>
      </div>
    );
  }

  const originalDevanagari = currentVerseDetails ? getOriginalDevanagari(currentVerseDetails) : "";
  const isNonDevanagariSelected = selectedCommentaryLanguage && selectedCommentaryLanguage !== "devanagari";
  const translationText = isNonDevanagariSelected && currentVerseDetails
    ? getTranslation(currentVerseDetails, selectedCommentaryLanguage)
    : "";

  const commentaryContext = (() => {
    if (!selectedAuthor || !selectedCommentaryLanguage || !currentVerseDetails) return "";
    const explanation = currentVerseDetails.explanations?.find(
      (e: Explanation) => e.authorName === selectedAuthor && e.languageCode === selectedCommentaryLanguage
    );
    return explanation?.content || "";
  })();

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 focus:outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="border-b border-border px-3 sm:px-8 py-3 sm:py-5 bg-card/50 shrink-0">
        <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                <h1 className="font-serif text-base sm:text-xl font-semibold tracking-tight truncate">
                  {book.title}
                </h1>
                <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs">
                  {book.category}
                </Badge>
              </div>
              {book.author && (
                <p className="text-[11px] sm:text-sm text-muted-foreground">{book.author}</p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <img 
                src={meditatingRishiImg} 
                alt="Meditating sage" 
                className="h-14 w-14 object-contain select-none hidden sm:block opacity-80"
                data-testid="img-meditating-rishi"
              />
              <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-xs sm:text-sm text-muted-foreground">
                {currentNumericLabel && (
                  <Badge variant="outline" className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 h-4 sm:h-5 border-muted-foreground/30" data-testid="text-header-numeric">
                    {currentNumericLabel}
                  </Badge>
                )}
                <span className="text-[11px] sm:text-sm">{currentPage + 1} / {totalPages}</span>
              </div>
            </div>
          </div>
          {book.description && (
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-2 sm:mt-3 leading-relaxed line-clamp-1 sm:line-clamp-3">
              {book.description}
            </p>
          )}
          {hasCommentaryOptions && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                <Select
                  value={selectedAuthor || "__all__"}
                  onValueChange={handleAuthorChange}
                >
                  <SelectTrigger 
                    className="w-[140px] sm:w-[180px] h-7 sm:h-8 text-[11px] sm:text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
                    data-testid="select-author"
                  >
                    <SelectValue placeholder="Select Author" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      value="__all__"
                      data-testid="option-author-all"
                    >
                      All Commentators
                    </SelectItem>
                    {availableAuthors.map((author) => (
                      <SelectItem 
                        key={author.authorName} 
                        value={author.authorName}
                        data-testid={`option-author-${author.authorName.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {author.authorName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                <Select
                  value={selectedCommentaryLanguage || ""}
                  onValueChange={handleLanguageChange}
                  disabled={availableLanguagesForAuthor.length === 0}
                >
                  <SelectTrigger 
                    className="w-[120px] sm:w-[140px] h-7 sm:h-8 text-[11px] sm:text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
                    data-testid="select-commentary-language"
                  >
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguagesForAuthor.map((lang) => (
                      <SelectItem 
                        key={lang.code} 
                        value={lang.code}
                        data-testid={`option-lang-${lang.code}`}
                      >
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Dharmic background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 text-[12rem] text-primary/[0.03] font-serif select-none">ॐ</div>
          <div className="absolute bottom-20 right-10 text-[10rem] text-primary/[0.03] font-serif select-none rotate-12">ॐ</div>
          <div className="absolute top-1/2 left-1/4 text-[8rem] text-primary/[0.02] font-serif select-none -rotate-6">श्री</div>
          <div className="absolute top-1/3 right-1/4 text-6xl text-primary/[0.03] font-serif select-none">॥</div>
          <div className="absolute bottom-1/3 left-1/3 text-5xl text-primary/[0.03] font-serif select-none">॥</div>
        </div>
        
        <div className="flex-1 p-3 sm:p-8 overflow-y-auto relative z-10">
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
          <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl w-full mx-auto">
            {isVerseLoading || !currentVerseDetails ? (
              <div className="backdrop-blur-md bg-gradient-to-br from-white/70 via-orange-50/50 to-amber-50/40 dark:from-card/80 dark:via-card/70 dark:to-orange-950/30 border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-10 shadow-lg shadow-primary/5">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32 mx-auto" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-12 w-3/4 mx-auto" />
                </div>
              </div>
            ) : (
            <div 
              className="backdrop-blur-md bg-gradient-to-br from-white/70 via-orange-50/50 to-amber-50/40 dark:from-card/80 dark:via-card/70 dark:to-orange-950/30 border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-10 shadow-lg shadow-primary/5 relative overflow-hidden"
              data-testid={`verse-${currentVerse.verseNumber}`}
              onMouseUp={handleTextSelect}
              onTouchEnd={handleTextSelect}
            >
              <div className="absolute top-0 left-0 w-12 sm:w-20 h-12 sm:h-20 border-t-2 border-l-2 border-primary/20 rounded-tl-xl sm:rounded-tl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-12 sm:w-20 h-12 sm:h-20 border-b-2 border-r-2 border-primary/20 rounded-br-xl sm:rounded-br-2xl"></div>
              
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-4xl sm:text-6xl text-primary/[0.08] font-serif select-none pointer-events-none">ॐ</div>
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 text-3xl sm:text-4xl text-primary/[0.06] font-serif select-none pointer-events-none hidden sm:block">ॐ</div>
              
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <span className="text-primary/40 text-sm sm:text-base">॥</span>
                <span className="text-xs sm:text-sm font-medium text-primary bg-gradient-to-r from-primary/15 to-primary/10 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-primary/20 flex items-center gap-1.5 sm:gap-2">
                  {currentNumericLabel && (
                    <span className="font-mono text-[10px] sm:text-xs opacity-70" data-testid="text-verse-numeric">{currentNumericLabel}</span>
                  )}
                  <span className="truncate max-w-[150px] sm:max-w-none">{currentVerse.sectionTitle || `Verse ${currentVerse.verseNumber}`}</span>
                </span>
                <span className="text-primary/40 text-sm sm:text-base">॥</span>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="relative flex-1 min-w-0">
                    <div className="absolute -left-1 sm:-left-2 top-0 text-xl sm:text-2xl text-primary/20 font-serif">❝</div>
                    <div 
                      className="font-serif text-lg sm:text-2xl leading-relaxed text-center px-2 sm:px-4"
                      data-testid={`text-original-${currentVerse.verseNumber}`}
                    >
                      <WordTooltip
                        content={originalDevanagari}
                        commentaryContent={commentaryContext}
                        sourceLanguage="devanagari"
                        verseId={currentVerse.id}
                      />
                    </div>
                    <div className="absolute -right-1 sm:-right-2 bottom-0 text-xl sm:text-2xl text-primary/20 font-serif rotate-180">❝</div>
                  </div>
                  <img 
                    src={rishiImg} 
                    alt="Rishi reading scripture" 
                    className="w-28 shrink-0 opacity-80 select-none pointer-events-none hidden sm:block"
                    data-testid="img-rishi"
                  />
                </div>

                {isNonDevanagariSelected && translationText && (
                  <div className="border-t border-primary/10 pt-3 sm:pt-4">
                    <div 
                      className="text-sm sm:text-lg leading-relaxed text-center px-1 sm:px-4 text-muted-foreground"
                      data-testid={`text-translation-${currentVerse.verseNumber}`}
                    >
                      <WordTooltip
                        content={translationText}
                        commentaryContent={commentaryContext}
                        sourceLanguage={selectedCommentaryLanguage || "devanagari"}
                        verseId={currentVerse.id}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground/70 bg-muted/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>Tap any word for AI translation</span>
                  </div>
                </div>

                {hasCommentaryOptions && (
                  <div className="mt-1 sm:mt-2 space-y-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => setCommentaryExpanded(!commentaryExpanded)}
                        className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-border/50 hover:border-primary/30 bg-background/60 backdrop-blur-sm"
                        data-testid="button-toggle-commentary"
                      >
                        <MessageSquareText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>{commentaryExpanded ? "Hide Commentary" : "Show Commentary"}</span>
                        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 ${commentaryExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {commentaryExpanded && selectedCommentaryLanguage && (
                      <div className="pt-4 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
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
            )}

            <div className="flex items-center justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border/50">
              <Button
                variant="outline"
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="gap-1 sm:gap-2"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="flex items-center gap-1">
                {totalPages <= 10 ? (
                  Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === currentPage 
                          ? "bg-primary" 
                          : "bg-muted hover:bg-muted-foreground/30"
                      }`}
                      data-testid={`page-dot-${i + 1}`}
                    />
                  ))
                ) : (
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {currentPage + 1} / {totalPages}
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                onClick={goToNextPage}
                disabled={currentPage === totalPages - 1}
                className="gap-1 sm:gap-2"
                data-testid="button-next-page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>
        </div>

        <div className="border-t border-border px-3 sm:px-8 py-2 sm:py-3 bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto flex items-center justify-center">
            <VideoPopup 
              videoId="8ELHatzdtAk"
              title="Introduction to Isha Upanishad"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
