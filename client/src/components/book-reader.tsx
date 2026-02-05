import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { VideoPopup } from "@/components/video-popup";
import type { BookWithDetails, VerseTranslation, Explanation } from "@shared/schema";

interface BookReaderProps {
  bookId: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
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
  navigateToVerse,
  onVerseChange
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const { data: book, isLoading, error } = useQuery<BookWithDetails>({
    queryKey: ["/api/books", bookId],
  });

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
      <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-5 bg-card/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-lg sm:text-xl font-semibold tracking-tight truncate">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 sm:p-8 overflow-auto">
          <div className="max-w-3xl w-full mx-auto">
            <div 
              className="bg-gradient-to-b from-card to-card/80 border border-primary/15 rounded-xl p-6 sm:p-10 shadow-sm relative overflow-hidden"
              data-testid={`verse-${currentVerse.verseNumber}`}
            >
              <div className="absolute top-2 right-2 text-4xl text-primary/5 font-serif select-none pointer-events-none">ॐ</div>
              
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
