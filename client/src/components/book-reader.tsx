import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import type { BookWithDetails, Verse, VerseTranslation, Explanation } from "@shared/schema";

interface BookReaderProps {
  bookId: string;
  selectedLanguage: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
}

// Component to fetch and display explanation for a verse
function VerseExplanation({ verseId, languageCode }: { verseId: string; languageCode: string }) {
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  // Filter explanations by selected language
  const explanation = explanations?.find(e => e.languageCode === languageCode);
  
  if (!explanation) {
    return null;
  }

  return (
    <div className="mt-5 pt-5 border-t border-amber-300/40 dark:border-amber-800/40" data-testid={`explanation-${verseId}`}>
      <p className="text-xs text-amber-700/70 dark:text-amber-400/60 mb-3 font-medium italic">
        {explanation.authorName} {explanation.authorTitle && `— ${explanation.authorTitle}`}
      </p>
      <p className="font-serif text-sm sm:text-base leading-loose whitespace-pre-wrap break-words text-amber-900/80 dark:text-amber-200/80 tracking-wide">
        {explanation.content}
      </p>
    </div>
  );
}

export function BookReader({ 
  bookId, 
  selectedLanguage, 
  onVerseSelect,
  selectedVerseId 
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const versesPerPage = 10;

  const { data: book, isLoading, error } = useQuery<BookWithDetails>({
    queryKey: ["/api/books", bookId],
  });

  useEffect(() => {
    setCurrentPage(0);
  }, [bookId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-amber-50/30 via-orange-50/20 to-amber-100/30 dark:from-amber-950/20 dark:via-stone-950/30 dark:to-amber-950/20 p-2 sm:p-6">
        <div className="flex-1 max-w-4xl mx-auto w-full">
          <div className="h-full bg-gradient-to-b from-amber-50 via-orange-50/80 to-amber-100/90 dark:from-stone-900 dark:via-stone-900/95 dark:to-stone-800 rounded-sm sm:rounded-md shadow-xl border border-amber-200/50 dark:border-amber-900/30 p-6 sm:p-12">
            <div className="space-y-6 animate-pulse">
              <div className="text-center space-y-3">
                <Skeleton className="h-4 w-24 mx-auto bg-amber-200/50" />
                <Skeleton className="h-8 sm:h-10 w-2/3 mx-auto bg-amber-200/50" />
                <Skeleton className="h-4 w-1/3 mx-auto bg-amber-200/50" />
              </div>
              <div className="space-y-6 mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-5 w-8 bg-amber-200/50" />
                    <Skeleton className="h-20 sm:h-24 w-full bg-amber-200/50" />
                  </div>
                ))}
              </div>
            </div>
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
  const totalPages = Math.ceil(verses.length / versesPerPage);
  const startIdx = currentPage * versesPerPage;
  const currentVerses = verses.slice(startIdx, startIdx + versesPerPage);

  const getTranslation = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  const getOriginalDevanagari = (verse: any): string => {
    return getTranslation(verse, "devanagari");
  };

  const handleVerseClick = (verse: any) => {
    const content = getTranslation(verse, selectedLanguage);
    onVerseSelect(verse.id, content);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-amber-50/30 via-orange-50/20 to-amber-100/30 dark:from-amber-950/20 dark:via-stone-950/30 dark:to-amber-950/20 p-2 sm:p-6">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="relative flex-1 flex flex-col bg-gradient-to-b from-amber-50 via-orange-50/80 to-amber-100/90 dark:from-stone-900 dark:via-stone-900/95 dark:to-stone-800 rounded-sm sm:rounded-md shadow-xl border border-amber-200/50 dark:border-amber-900/30 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-3 sm:w-6 bg-gradient-to-r from-amber-800/20 via-amber-700/10 to-transparent dark:from-amber-900/40 dark:via-amber-900/20 dark:to-transparent" />
          <div className="absolute left-[3px] sm:left-[6px] top-0 bottom-0 w-[2px] sm:w-1 bg-amber-900/30 dark:bg-amber-700/40" />
          
          <div className="relative z-10 px-6 sm:px-12 py-4 sm:py-8 border-b border-amber-200/60 dark:border-amber-900/40">
            <div className="text-center space-y-2 sm:space-y-3">
              <div className="flex items-center justify-center gap-3 text-amber-700/60 dark:text-amber-500/50">
                <span className="h-px flex-1 max-w-12 bg-current" />
                <span className="text-xs tracking-[0.3em] uppercase font-medium">{book.category}</span>
                <span className="h-px flex-1 max-w-12 bg-current" />
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-wide text-amber-950 dark:text-amber-100">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-sm text-amber-800/70 dark:text-amber-300/60 italic">{book.author}</p>
              )}
              {book.description && (
                <p className="text-xs sm:text-sm text-amber-900/60 dark:text-amber-200/50 mt-2 leading-relaxed max-w-xl mx-auto line-clamp-2 sm:line-clamp-none">
                  {book.description}
                </p>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 sm:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8">
              {currentVerses.map((verse: any, index: number) => {
                const originalText = getOriginalDevanagari(verse);
                const isSelected = verse.id === selectedVerseId;
                
                return (
                  <div key={verse.id}>
                    <div
                      onClick={() => handleVerseClick(verse)}
                      className={`group cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? "bg-amber-100/50 dark:bg-amber-900/20 -mx-3 px-3 py-2 rounded-md" 
                          : ""
                      }`}
                      data-testid={`verse-${verse.verseNumber}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-amber-700/80 dark:text-amber-400/70 font-serif text-lg sm:text-xl font-semibold">
                            {verse.verseNumber}
                          </span>
                          {verse.sectionTitle && (
                            <span className="text-xs font-medium text-amber-700/60 dark:text-amber-400/50 uppercase tracking-wider border-l border-amber-300 dark:border-amber-700 pl-3">
                              {verse.sectionTitle}
                            </span>
                          )}
                        </div>
                        <div className="pl-0 sm:pl-2 space-y-4">
                          <p className="font-serif text-lg sm:text-xl leading-loose whitespace-pre-wrap break-words text-amber-950 dark:text-amber-100 tracking-wide" data-testid={`text-original-${verse.verseNumber}`}>
                            {originalText}
                          </p>
                          <VerseExplanation verseId={verse.id} languageCode={selectedLanguage} />
                        </div>
                      </div>
                    </div>
                    {index < currentVerses.length - 1 && (
                      <div className="flex items-center justify-center py-4 sm:py-6">
                        <div className="flex items-center gap-2 text-amber-600/40 dark:text-amber-600/30">
                          <span className="h-px w-8 bg-current" />
                          <span className="text-xs">॰</span>
                          <span className="h-px w-8 bg-current" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {totalPages > 1 && (
            <div className="relative z-10 px-6 sm:px-12 py-3 sm:py-4 border-t border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-t from-amber-100/50 to-transparent dark:from-stone-800/50 dark:to-transparent">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  data-testid="button-prev-page"
                  className="text-amber-800 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/30"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-2 text-amber-800/70 dark:text-amber-400/60">
                  <span className="text-xs tracking-wider uppercase">Page</span>
                  <span className="font-serif text-sm">{currentPage + 1}</span>
                  <span className="text-xs">of</span>
                  <span className="font-serif text-sm">{totalPages}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  data-testid="button-next-page"
                  className="text-amber-800 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/30"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
