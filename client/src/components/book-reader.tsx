import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import type { BookWithDetails, Verse, VerseTranslation } from "@shared/schema";

interface BookReaderProps {
  bookId: string;
  selectedLanguage: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
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
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 sm:h-12 w-3/4" />
          <Skeleton className="h-5 sm:h-6 w-1/2" />
          <div className="space-y-4 mt-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-16 sm:h-20 w-full" />
              </div>
            ))}
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

  const getTranslation = (verse: any): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === selectedLanguage
    );
    return translation?.content || verse.translations?.[0]?.content || "";
  };

  const handleVerseClick = (verse: any) => {
    const content = getTranslation(verse);
    onVerseSelect(verse.id, content);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-6 bg-card/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2 min-w-0">
              <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight truncate">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{book.author}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 self-start">
              {book.category}
            </Badge>
          </div>
          {book.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4 leading-relaxed line-clamp-3 sm:line-clamp-none">
              {book.description}
            </p>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {currentVerses.map((verse: any) => {
            const content = getTranslation(verse);
            const isSelected = verse.id === selectedVerseId;
            
            return (
              <div
                key={verse.id}
                onClick={() => handleVerseClick(verse)}
                className={`group p-3 sm:p-5 rounded-md border transition-all cursor-pointer ${
                  isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-transparent hover:border-border hover:bg-muted/30"
                }`}
                data-testid={`verse-${verse.verseNumber}`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                    {verse.verseNumber}
                  </span>
                  <div className="flex-1 space-y-2 min-w-0">
                    {verse.sectionTitle && (
                      <p className="text-xs font-medium text-primary uppercase tracking-wider">
                        {verse.sectionTitle}
                      </p>
                    )}
                    <p className="font-serif text-base sm:text-lg leading-relaxed whitespace-pre-wrap break-words">
                      {content}
                    </p>
                    <p className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                      Click to view translations and explanations
                    </p>
                    <p className="text-xs text-primary sm:hidden">
                      Tap to view more
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="border-t border-border px-4 sm:px-8 py-3 sm:py-4 bg-card/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              data-testid="button-prev-page"
              className="px-2 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              data-testid="button-next-page"
              className="px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
