import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, MessageSquare, ChevronDown, User, Loader2, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { VideoInline } from "@/components/video-popup";
import type { Explanation, VerseTranslation } from "@shared/schema";

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
}

interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

interface TranslationPanelProps {
  bookId: string;
  selectedVerseId: string | null;
  selectedContent: string;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
  onAuthorChange: (author: string | null) => void;
  onLanguageChange: (lang: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function PanelContent({
  bookId,
  selectedVerseId,
  selectedContent,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  onLanguageChange,
}: Omit<TranslationPanelProps, 'open' | 'onOpenChange'>) {
  const [selectedExplanation, setSelectedExplanation] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: commentaryOptions, isLoading: isLoadingOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
  });

  const { data: explanations = [], isLoading: explanationsLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", selectedVerseId, "explanations"],
    enabled: !!selectedVerseId,
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

  useEffect(() => {
    if (selectedAuthor && commentaryOptions && initialized) {
      const author = commentaryOptions.authors.find(a => a.authorName === selectedAuthor);
      if (author && author.languageCodes.length > 0) {
        if (!selectedCommentaryLanguage || !author.languageCodes.includes(selectedCommentaryLanguage)) {
          onLanguageChange(author.languageCodes[0]);
        }
      }
    }
  }, [selectedAuthor, commentaryOptions, selectedCommentaryLanguage, initialized, onLanguageChange]);

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

  const filteredExplanations = explanations.filter(
    (e) => e.languageCode === selectedCommentaryLanguage && e.authorName === selectedAuthor
  );

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {hasCommentaryOptions && (
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Commentary Selection
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={selectedAuthor || ""}
                  onValueChange={handleAuthorChange}
                >
                  <SelectTrigger 
                    className="flex-1" 
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
                    className="flex-1" 
                    data-testid="select-commentary-language"
                  >
                    <SelectValue placeholder="Select Language" />
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
          </div>
        )}

        {hasCommentaryOptions && <Separator />}

        {selectedVerseId ? (
          <>
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Selected Verse
              </h3>
              <Card className="p-4">
                <p className="font-serif text-sm leading-relaxed">
                  {selectedContent || "No content available"}
                </p>
              </Card>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2" data-testid="heading-panel-explanatory-videos">
                <Play className="h-3 w-3" />
                Explanatory Videos
              </h3>
              <VideoInline
                videoId="8ELHatzdtAk"
                title="Introduction to Isha Upanishad"
                className="w-full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Select a verse to see translations and explanations
              </p>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function TranslationPanel({
  bookId,
  selectedVerseId,
  selectedContent,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  onLanguageChange,
  open,
  onOpenChange,
  collapsed,
  onCollapsedChange,
}: TranslationPanelProps) {
  const isMobile = useIsMobile();

  const header = (
    <div className="p-4 border-b border-border">
      <h2 className="font-medium text-sm flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Commentary & Insight
      </h2>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Commentary & Insight</SheetTitle>
            <p>View translations and scholarly explanations for the selected verse</p>
          </SheetHeader>
          {header}
          <PanelContent
            bookId={bookId}
            selectedVerseId={selectedVerseId}
            selectedContent={selectedContent}
            selectedAuthor={selectedAuthor}
            selectedCommentaryLanguage={selectedCommentaryLanguage}
            onAuthorChange={onAuthorChange}
            onLanguageChange={onLanguageChange}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: collapsible panel
  if (collapsed) {
    return null;
  }

  return (
    <div className="w-80 border-l border-border bg-card/30 flex flex-col transition-all duration-300">
      {header}
      <PanelContent
        bookId={bookId}
        selectedVerseId={selectedVerseId}
        selectedContent={selectedContent}
        selectedAuthor={selectedAuthor}
        selectedCommentaryLanguage={selectedCommentaryLanguage}
        onAuthorChange={onAuthorChange}
        onLanguageChange={onLanguageChange}
      />
    </div>
  );
}
