import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { Globe, MessageSquare, Play, PanelRightClose, PanelRightOpen, User } from "lucide-react";
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

const LANG_ALIASES: Record<string, string[]> = {
  "english": ["english", "en"],
  "en": ["english", "en"],
  "hi": ["hi", "hindi"],
  "hindi": ["hi", "hindi"],
  "de": ["de", "german"],
  "german": ["de", "german"],
  "fr": ["fr", "french"],
  "french": ["fr", "french"],
  "es": ["es", "spanish"],
  "spanish": ["es", "spanish"],
  "zh": ["zh", "mandarin", "chinese"],
  "mandarin": ["zh", "mandarin", "chinese"],
  "chinese": ["zh", "mandarin", "chinese"],
  "ar": ["ar", "arabic"],
  "arabic": ["ar", "arabic"],
  "kn": ["kn", "kannada"],
  "kannada": ["kn", "kannada"],
  "te": ["te", "telugu"],
  "telugu": ["te", "telugu"],
  "ta": ["ta", "tamil"],
  "tamil": ["ta", "tamil"],
};

function langMatches(langCode: string, target: string): boolean {
  const codes = LANG_ALIASES[target] || [target];
  return codes.includes(langCode);
}
import { useIsMobile } from "@/hooks/use-mobile";
import { VideoInline } from "@/components/video-popup";
import { VerseNotes } from "@/components/verse-notes";
import { useTranslation } from "@/lib/translations";
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  pendingNoteText?: string | null;
  onPendingNoteTextConsumed?: () => void;
}

function PanelContent({
  bookId,
  selectedVerseId,
  selectedContent,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  pendingNoteText,
  onPendingNoteTextConsumed,
}: Omit<TranslationPanelProps, 'open' | 'onOpenChange' | 'collapsed' | 'onCollapsedChange'>) {
  const { t } = useTranslation(selectedCommentaryLanguage);
  const [selectedExplanation, setSelectedExplanation] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
    ...cmsContentQueryOptions,
  });

  const { data: explanations = [], isLoading: explanationsLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", selectedVerseId, "explanations"],
    enabled: !!selectedVerseId,
    ...cmsContentQueryOptions,
  });

  useEffect(() => {
    setInitialized(false);
  }, [bookId]);

  const isShowingAll = selectedAuthor === "__all__";

  useEffect(() => {
    if (commentaryOptions && !initialized && !selectedAuthor) {
      const firstAuthor = commentaryOptions.authors.length > 0
        ? commentaryOptions.authors[0].authorName
        : "__all__";
      onAuthorChange(firstAuthor);
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, selectedAuthor, onAuthorChange]);

  const filteredExplanations = explanations.filter(
    (e) => langMatches(e.languageCode, selectedCommentaryLanguage || "") && (isShowingAll || e.authorName === selectedAuthor)
  );

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  const matchCodesForAuthors = selectedCommentaryLanguage ? (LANG_ALIASES[selectedCommentaryLanguage] || [selectedCommentaryLanguage]) : [];
  const availableAuthors = commentaryOptions
    ? (selectedCommentaryLanguage
        ? commentaryOptions.authors.filter(a => a.languageCodes.some(c => matchCodesForAuthors.includes(c)))
        : commentaryOptions.authors)
    : [];

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {selectedVerseId ? (
          <>
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("selectedVerse")}
              </h3>
              <Card className="p-4">
                <p className="font-serif text-sm leading-relaxed">
                  {selectedContent || t("noContentAvailable")}
                </p>
              </Card>
            </div>

            <Separator />

            <VerseNotes
              verseId={selectedVerseId}
              pendingSelectedText={pendingNoteText}
              onSelectedTextConsumed={onPendingNoteTextConsumed}
              languageCode={selectedCommentaryLanguage}
            />

            <Separator />

            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2" data-testid="heading-panel-explanatory-videos">
                <Play className="h-3 w-3" />
                {t("explanatoryVideos")}
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
  open,
  onOpenChange,
  collapsed,
  onCollapsedChange,
  pendingNoteText,
  onPendingNoteTextConsumed,
}: TranslationPanelProps) {
  const isMobile = useIsMobile();

  const { t } = useTranslation();

  const header = (
    <div className="p-4 border-b border-border">
      <h2 className="font-medium text-sm flex items-center gap-2">
        <Globe className="h-4 w-4" />
        {t("commentaryAndInsight")}
      </h2>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("commentaryAndInsight")}</SheetTitle>
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
            pendingNoteText={pendingNoteText}
            onPendingNoteTextConsumed={onPendingNoteTextConsumed}
          />
        </SheetContent>
      </Sheet>
    );
  }

  if (collapsed) {
    return (
      <div className="border-l border-border bg-card/30 flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange?.(false)}
          title="Show commentary panel"
          data-testid="button-toggle-right-panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-border bg-card/30 flex flex-col transition-all duration-300">
      <div className="p-2 flex items-center justify-between border-b border-border">
        <h2 className="font-medium text-sm flex items-center gap-2 px-2">
          <Globe className="h-4 w-4" />
          {t("commentaryAndInsight")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange?.(true)}
          title="Hide commentary panel"
          data-testid="button-toggle-right-panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <PanelContent
        bookId={bookId}
        selectedVerseId={selectedVerseId}
        selectedContent={selectedContent}
        selectedAuthor={selectedAuthor}
        selectedCommentaryLanguage={selectedCommentaryLanguage}
        onAuthorChange={onAuthorChange}
        pendingNoteText={pendingNoteText}
        onPendingNoteTextConsumed={onPendingNoteTextConsumed}
      />
    </div>
  );
}
