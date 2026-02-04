import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import type { BookWithDetails, Verse, VerseTranslation, Explanation } from "@shared/schema";

interface BookReaderProps {
  bookId: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
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
    <div className="mt-4 pt-4 border-t border-border/50" data-testid={`explanation-${verseId}`}>
      {filteredExplanations.map((explanation, idx) => (
        <div key={idx} className={idx > 0 ? "mt-4 pt-4 border-t border-border/30" : ""}>
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            {explanation.authorName} {explanation.authorTitle && `- ${explanation.authorTitle}`}
          </p>
          <p className="font-serif text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
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
  selectedCommentaryLanguage
}: BookReaderProps) {
  const { data: book, isLoading, error } = useQuery<BookWithDetails>({
    queryKey: ["/api/books", bookId],
  });

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
    const langCode = selectedCommentaryLanguage || "devanagari";
    const content = getTranslation(verse, langCode);
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
          {verses.map((verse: any) => {
            const verseText = selectedCommentaryLanguage 
              ? getTranslation(verse, selectedCommentaryLanguage) || getOriginalDevanagari(verse)
              : getOriginalDevanagari(verse);
            const isSelected = verse.id === selectedVerseId;
            
            return (
              <div
                key={verse.id}
                onClick={() => handleVerseClick(verse)}
                className={`group p-3 sm:p-5 rounded-md border cursor-pointer hover-elevate active-elevate-2 ${
                  isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-transparent"
                }`}
                data-testid={`verse-${verse.verseNumber}`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                    {verse.verseNumber}
                  </span>
                  <div className="flex-1 space-y-3 min-w-0">
                    {verse.sectionTitle && (
                      <p className="text-xs font-medium text-primary uppercase tracking-wider">
                        {verse.sectionTitle}
                      </p>
                    )}
                    <div className="space-y-3">
                      <p className="font-serif text-base sm:text-lg leading-relaxed whitespace-pre-wrap break-words" data-testid={`text-original-${verse.verseNumber}`}>
                        {verseText}
                      </p>
                      {selectedAuthor && selectedCommentaryLanguage && (
                        <VerseExplanation 
                          verseId={verse.id} 
                          languageCode={selectedCommentaryLanguage}
                          authorName={selectedAuthor}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
