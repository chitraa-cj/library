import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, MessageSquare, ChevronDown, User, Loader2, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface TranslationPanelProps {
  selectedVerseId: string | null;
  selectedContent: string;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: "devanagari", name: "Devanagari", nativeName: "देवनागरी" },
  { code: "kannada", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "telugu", name: "Telugu", nativeName: "తెలుగు" },
  { code: "tamil", name: "Tamil", nativeName: "தமிழ்" },
  { code: "english", name: "English", nativeName: "English" },
];

function PanelContent({
  selectedVerseId,
  selectedContent,
  currentLanguage,
  onLanguageChange,
}: Omit<TranslationPanelProps, 'open' | 'onOpenChange'>) {
  const [selectedExplanation, setSelectedExplanation] = useState<string | null>(null);

  const { data: translations = [], isLoading: translationsLoading } = useQuery<VerseTranslation[]>({
    queryKey: ["/api/verses", selectedVerseId, "translations"],
    enabled: !!selectedVerseId,
  });

  const { data: explanations = [], isLoading: explanationsLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", selectedVerseId, "explanations"],
    enabled: !!selectedVerseId,
  });

  const filteredExplanations = explanations.filter(
    (e) => e.languageCode === currentLanguage || e.languageCode === "english"
  );

  if (!selectedVerseId) {
    return (
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
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
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
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Translations in Other Scripts
          </h3>
          {translationsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : translations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other translations available</p>
          ) : (
            <div className="space-y-2">
              {translations
                .filter((t) => t.languageCode !== currentLanguage)
                .map((translation) => {
                  const langInfo = SUPPORTED_LANGUAGES.find(
                    (l) => l.code === translation.languageCode
                  );
                  return (
                    <Collapsible key={translation.id}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto"
                          data-testid={`button-translation-${translation.languageCode}`}
                        >
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {langInfo?.nativeName || translation.languageCode}
                            </Badge>
                            <span className="text-sm">{langInfo?.name}</span>
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Card className="p-3 mt-1 ml-2">
                          <p className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
                            {translation.content}
                          </p>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="h-3 w-3" />
            Scholarly Explanations
          </h3>
          {explanationsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExplanations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No explanations available</p>
          ) : (
            <div className="space-y-2">
              {filteredExplanations.map((explanation) => (
                <Collapsible
                  key={explanation.id}
                  open={selectedExplanation === explanation.id}
                  onOpenChange={(open) =>
                    setSelectedExplanation(open ? explanation.id : null)
                  }
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-3 h-auto text-left"
                      data-testid={`button-explanation-${explanation.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">{explanation.authorName}</span>
                          {explanation.authorTitle && (
                            <span className="text-xs text-muted-foreground">
                              {explanation.authorTitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="p-4 mt-1 ml-2">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {explanation.content}
                      </p>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
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
      </div>
    </ScrollArea>
  );
}

export function TranslationPanel({
  selectedVerseId,
  selectedContent,
  currentLanguage,
  onLanguageChange,
  open,
  onOpenChange,
}: TranslationPanelProps) {
  const isMobile = useIsMobile();

  const header = (
    <div className="p-4 border-b border-border space-y-4">
      <h2 className="font-medium text-sm flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Translation & Insight
      </h2>
      <Select value={currentLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className="w-full" data-testid="select-language">
          <SelectValue placeholder="Select script" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.name}</span>
                <span className="text-muted-foreground text-xs">{lang.nativeName}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Translation & Insight</SheetTitle>
            <p>View translations and scholarly explanations for the selected verse</p>
          </SheetHeader>
          {header}
          <PanelContent
            selectedVerseId={selectedVerseId}
            selectedContent={selectedContent}
            currentLanguage={currentLanguage}
            onLanguageChange={onLanguageChange}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-card/30 flex flex-col">
      {header}
      <PanelContent
        selectedVerseId={selectedVerseId}
        selectedContent={selectedContent}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
      />
    </div>
  );
}
