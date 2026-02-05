import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Play, User, Globe } from "lucide-react";
import { VideoPopup } from "@/components/video-popup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookWithDetails, VerseTranslation, Explanation } from "@shared/schema";

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
}

interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
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
}

function VerseExplanation({ 
  verseId, 
  languageCode, 
  authorName 
}: { 
  verseId: string; 
  languageCode: string;
  authorName: string | null;
}) {
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  const filteredExplanations = explanations?.filter(e => {
    const langMatch = e.languageCode === languageCode;
    const authorMatch = !authorName || e.authorName === authorName;
    return langMatch && authorMatch;
  });
  
  if (!filteredExplanations || filteredExplanations.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-border/50" data-testid={`explanation-${verseId}`}>
      {filteredExplanations.map((explanation, idx) => (
        <div key={idx} className={idx > 0 ? "mt-4 pt-4 border-t border-border/30" : ""}>
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            {explanation.authorName} {explanation.authorTitle && `- ${explanation.authorTitle}`}
          </p>
          <p className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {explanation.content}
          </p>
        </div>
      ))}
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
  onVerseChange
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const { data: book, isLoading, error } = useQuery<BookWithDetails>({
    queryKey: ["/api/books", bookId],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
  });

  useEffect(() => {
    setInitialized(false);
  }, [bookId]);

  useEffect(() => {
    if (commentaryOptions && !initialized && !selectedAuthor) {
      if (commentaryOptions.authors.length > 0) {
        const firstAuthor = commentaryOptions.authors[0];
        onAuthorChange(firstAuthor.authorName);
        if (firstAuthor.languageCodes.length > 0) {
          onLanguageChange(firstAuthor.languageCodes[0]);
        }
      }
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, selectedAuthor, onAuthorChange, onLanguageChange]);

  const availableLanguagesForAuthor = useMemo(() => {
    if (!selectedAuthor || !commentaryOptions) return [];
    const author = commentaryOptions.authors.find(a => a.authorName === selectedAuthor);
    if (!author) return [];
    return commentaryOptions.languages.filter(l => author.languageCodes.includes(l.code));
  }, [selectedAuthor, commentaryOptions]);

  const availableAuthors = useMemo(() => {
    return commentaryOptions?.authors || [];
  }, [commentaryOptions]);

  const handleAuthorChange = (authorName: string) => {
    onAuthorChange(authorName);
    const author = commentaryOptions?.authors.find(a => a.authorName === authorName);
    if (author && author.languageCodes.length > 0) {
      if (!selectedCommentaryLanguage || !author.languageCodes.includes(selectedCommentaryLanguage)) {
        onLanguageChange(author.languageCodes[0]);
      }
    }
  };

  const handleLanguageChange = (langCode: string) => {
    onLanguageChange(langCode);
  };

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  useEffect(() => {
    setCurrentPage(0);
  }, [bookId]);

  useEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && book?.verses) {
      const pageIndex = book.verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0 && pageIndex !== currentPage) {
        setCurrentPage(pageIndex);
      }
    }
  }, [navigateToVerse, book?.verses]);

  useEffect(() => {
    if (onVerseChange && book?.verses && book.verses[currentPage]) {
      onVerseChange(book.verses[currentPage].verseNumber);
    }
  }, [currentPage, book?.verses, onVerseChange]);

  useEffect(() => {
    if (book && book.verses && book.verses.length > 0) {
      const verse = book.verses[currentPage];
      if (verse) {
        const langCode = selectedCommentaryLanguage || "devanagari";
        const content = getTranslationFromVerse(verse, langCode);
        onVerseSelect(verse.id, content);
      }
    }
  }, [currentPage, book, selectedCommentaryLanguage]);

  const getTranslationFromVerse = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
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

  const verses = book.verses || [];
  const totalPages = verses.length;
  const currentVerse = verses[currentPage];

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

  const verseText = selectedCommentaryLanguage 
    ? getTranslation(currentVerse, selectedCommentaryLanguage) || getOriginalDevanagari(currentVerse)
    : getOriginalDevanagari(currentVerse);

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 focus:outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-5 bg-card/50 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="font-serif text-lg sm:text-xl font-semibold tracking-tight">
                  {book.title}
                </h1>
                <Badge variant="secondary" className="shrink-0">
                  {book.category}
                </Badge>
              </div>
              {book.author && (
                <p className="text-xs sm:text-sm text-muted-foreground">{book.author}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <span>Verse {currentPage + 1} of {totalPages}</span>
            </div>
          </div>
          {book.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2 sm:line-clamp-3">
              {book.description}
            </p>
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
        
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto relative z-10">
          <div className="max-w-3xl w-full mx-auto">
            <div 
              className="backdrop-blur-md bg-gradient-to-br from-white/70 via-orange-50/50 to-amber-50/40 dark:from-card/80 dark:via-card/70 dark:to-orange-950/30 border border-primary/20 rounded-2xl p-6 sm:p-10 shadow-lg shadow-primary/5 relative overflow-hidden"
              data-testid={`verse-${currentVerse.verseNumber}`}
            >
              {/* Decorative corner elements */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-primary/20 rounded-tl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-primary/20 rounded-br-2xl"></div>
              
              {/* Large Om watermark */}
              <div className="absolute top-4 right-4 text-6xl text-primary/[0.08] font-serif select-none pointer-events-none">ॐ</div>
              <div className="absolute bottom-4 left-4 text-4xl text-primary/[0.06] font-serif select-none pointer-events-none rotate-180">ॐ</div>
              
              {hasCommentaryOptions && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedAuthor || ""}
                      onValueChange={handleAuthorChange}
                    >
                      <SelectTrigger 
                        className="w-[180px] h-8 text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
                        data-testid="select-author"
                      >
                        <SelectValue placeholder="Select Author" />
                      </SelectTrigger>
                      <SelectContent>
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

                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedCommentaryLanguage || ""}
                      onValueChange={handleLanguageChange}
                      disabled={availableLanguagesForAuthor.length === 0}
                    >
                      <SelectTrigger 
                        className="w-[140px] h-8 text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
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

              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="text-primary/40">॥</span>
                <span className="text-sm font-medium text-primary bg-gradient-to-r from-primary/15 to-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
                  {currentVerse.sectionTitle || `Verse ${currentVerse.verseNumber}`}
                </span>
                <span className="text-primary/40">॥</span>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-2xl text-primary/20 font-serif">❝</div>
                  <p 
                    className="font-serif text-xl sm:text-2xl leading-relaxed whitespace-pre-wrap break-words text-center px-4"
                    data-testid={`text-original-${currentVerse.verseNumber}`}
                  >
                    {verseText}
                  </p>
                  <div className="absolute -right-2 bottom-0 text-2xl text-primary/20 font-serif rotate-180">❝</div>
                </div>

                {selectedAuthor && selectedCommentaryLanguage && (
                  <VerseExplanation 
                    verseId={currentVerse.id} 
                    languageCode={selectedCommentaryLanguage}
                    authorName={selectedAuthor}
                  />
                )}
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className="gap-2"
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
                    <span className="text-sm text-muted-foreground">
                      {currentPage + 1} / {totalPages}
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages - 1}
                  className="gap-2"
                  data-testid="button-next-page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-center">
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
