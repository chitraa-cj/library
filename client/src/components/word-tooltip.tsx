import { useState, useRef, useEffect, useId, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, BookOpen, Languages, Sparkles, Globe, BookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/translations";

interface WordTranslation {
  word: string;
  translation: string;
  grammaticalInfo: string | Record<string, string>;
  etymology: string;
  contextualMeaning: string;
  cached?: boolean;
}

interface DirectWordMeaning {
  id: string;
  verseId: string;
  word: string;
  meaning: string;
  position: number;
}

const TRANSLATION_LANGUAGES = [
  { code: "english", name: "English" },
  { code: "hindi", name: "Hindi (\u0939\u093f\u0928\u094d\u0926\u0940)" },
  { code: "kannada", name: "Kannada (\u0c95\u0ca8\u0ccd\u0ca8\u0ca1)" },
  { code: "tamil", name: "Tamil (\u0ba4\u0bae\u0bbf\u0bb4\u0bcd)" },
  { code: "telugu", name: "Telugu (\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41)" },
];

interface WordTooltipProps {
  content: string;
  commentaryContent?: string;
  sourceLanguage: string;
  verseId?: string;
  className?: string;
  useWordMeanings?: boolean;
  globalLanguage?: string;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowLeft: number;
}

function normalizeWord(word: string): string {
  return word
    .replace(/[\u0964\u0965,.;:!?'"()\[\]{}\u2014\u2013\-\u0902\u0903\u094d]/g, "")
    .trim()
    .toLowerCase();
}

const LANG_CODE_TO_TOOLTIP: Record<string, string> = {
  en: "english", english: "english",
  hi: "hindi", hindi: "hindi",
  kn: "kannada", kannada: "kannada",
  ta: "tamil", tamil: "tamil",
  te: "telugu", telugu: "telugu",
  de: "english", german: "english",
  fr: "english", french: "english",
  es: "english", spanish: "english",
  zh: "english", mandarin: "english", chinese: "english",
  ar: "english", arabic: "english",
  sa: "hindi", devanagari: "hindi", sanskrit: "hindi",
  pt: "english", portuguese: "english",
};

function resolveTooltipLang(lang?: string): string {
  if (!lang) return "english";
  return LANG_CODE_TO_TOOLTIP[lang.toLowerCase()] || "english";
}

export function WordTooltip({ 
  content, 
  commentaryContent = "",
  sourceLanguage,
  verseId,
  className = "",
  useWordMeanings: enableWordMeanings = true,
  globalLanguage,
}: WordTooltipProps) {
  const instanceId = useId();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<WordTranslation | null>(null);
  const [directMeaning, setDirectMeaning] = useState<DirectWordMeaning | null>(null);
  const [showAllMeanings, setShowAllMeanings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(() => resolveTooltipLang(globalLanguage));
  const { t } = useTranslation(targetLanguage);

  useEffect(() => {
    if (globalLanguage) {
      const newLang = resolveTooltipLang(globalLanguage);
      setTargetLanguage(prevLang => {
        if (prevLang !== newLang && selectedWord && showTooltip && !showAllMeanings) {
          setTranslation(null);
          fetchAiTranslation(selectedWord, newLang);
        }
        return newLang;
      });
    }
  }, [globalLanguage]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const clickedWordRef = useRef<DOMRect | null>(null);

  const { data: wordMeanings } = useQuery<DirectWordMeaning[]>({
    queryKey: ["/api/verses", verseId, "word-meanings"],
    queryFn: async () => {
      if (!verseId) return [];
      const res = await fetch(`/api/verses/${verseId}/word-meanings`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!verseId && enableWordMeanings,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!showTooltip) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        const isSelectContent = target.closest('[data-radix-popper-content-wrapper]') ||
                               target.closest('[role="listbox"]') ||
                               target.closest('[role="option"]');
        if (!isSelectContent) {
          closeTooltip();
        }
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTooltip();
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showTooltip]);

  useLayoutEffect(() => {
    if (showTooltip && clickedWordRef.current && tooltipRef.current) {
      const rect = clickedWordRef.current;
      const tooltipWidth = 340;
      const gap = 12;
      
      const wordCenterX = rect.left + rect.width / 2;
      let left = wordCenterX - tooltipWidth / 2;
      let top = rect.bottom + gap;
      
      if (left < 8) left = 8;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      
      const tooltipHeight = tooltipRef.current.offsetHeight || 400;
      if (top + tooltipHeight > window.innerHeight - 8) {
        top = rect.top - tooltipHeight - gap;
        if (top < 8) top = 8;
      }
      
      const arrowLeft = Math.max(16, Math.min(wordCenterX - left - 10, tooltipWidth - 36));
      
      setPosition({ top, left, arrowLeft });
    }
  }, [showTooltip, directMeaning, showAllMeanings, translation]);

  const findDirectMeaning = (clickedWord: string): DirectWordMeaning | null => {
    if (!wordMeanings || wordMeanings.length === 0) return null;

    const normalized = normalizeWord(clickedWord);
    if (!normalized) return null;

    for (const wm of wordMeanings) {
      const wmWords = wm.word.toLowerCase().split(/[\s-]+/);
      if (wmWords.some(w => normalized.includes(w) || w.includes(normalized))) {
        return wm;
      }
      const wmNorm = wm.word.toLowerCase().replace(/[-\s]/g, "");
      if (wmNorm === normalized || normalized.includes(wmNorm) || wmNorm.includes(normalized)) {
        return wm;
      }
    }
    return null;
  };

  const handleWordClick = (word: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    clickedWordRef.current = rect;
    
    const cleanWord = word.replace(/[\u0964\u0965,.;:!?'"()\[\]{}\u2014\u2013\-]/g, '').trim();
    if (!cleanWord || cleanWord.length === 0) return;
    
    setSelectedWord(cleanWord);
    setShowTooltip(true);
    setTranslation(null);
    setDirectMeaning(null);
    setShowAllMeanings(false);
    setError(null);
    setPosition(null);

    if (enableWordMeanings && wordMeanings && wordMeanings.length > 0) {
      const found = findDirectMeaning(cleanWord);
      setDirectMeaning(found);
      setShowAllMeanings(true);
    } else {
      fetchAiTranslation(cleanWord, targetLanguage);
    }
  };

  const fetchAiTranslation = async (word: string, lang: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          sourceLanguage,
          targetLanguage: lang,
          verseContext: content,
          commentaryContext: commentaryContent,
        }),
      });
      if (!response.ok) {
        throw new Error("Translation failed");
      }
      const result: WordTranslation = await response.json();
      setTranslation(result);
    } catch (err) {
      setError("Failed to get translation. Please try again.");
      console.error("Translation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setTargetLanguage(newLang);
    if (selectedWord) {
      fetchAiTranslation(selectedWord, newLang);
    }
  };

  const closeTooltip = () => {
    setShowTooltip(false);
    setSelectedWord(null);
    setTranslation(null);
    setDirectMeaning(null);
    setShowAllMeanings(false);
    setError(null);
    setPosition(null);
    clickedWordRef.current = null;
  };

  if (!content) return null;
  
  const words = content.split(/(\s+)/);

  const hasWordMeanings = wordMeanings && wordMeanings.length > 0;

  const renderDirectMeaningsPanel = () => {
    if (!wordMeanings || wordMeanings.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <BookText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-primary text-sm">{t("wordByWordMeanings")}</span>
        </div>

        {directMeaning && (
          <div className="bg-primary/10 rounded-md p-2.5 mb-2">
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="text-xs shrink-0">Selected</Badge>
              <div>
                <span className="font-bold text-sm">{directMeaning.word}</span>
                <span className="text-muted-foreground mx-1.5">&mdash;</span>
                <span className="text-sm">{directMeaning.meaning}</span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-1 max-h-[220px] overflow-y-auto">
          {wordMeanings.map((wm, idx) => (
            <div
              key={wm.id || idx}
              className={`flex items-start gap-1.5 py-1 px-1.5 rounded-sm text-xs ${
                directMeaning?.id === wm.id ? "bg-primary/10 font-medium" : ""
              }`}
              data-testid={`word-meaning-${idx}`}
            >
              <span className="text-primary/80 font-medium italic shrink-0">{wm.word}</span>
              <span className="text-muted-foreground">&mdash;</span>
              <span className="text-foreground/80">{wm.meaning}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const tooltipContent = showTooltip ? (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        width: 340,
        zIndex: 99999,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="animate-in fade-in-0 slide-in-from-top-2 duration-150"
    >
      {position && (
        <div 
          className="dark:border-b-card"
          style={{
            position: 'absolute',
            top: -10,
            left: position.arrowLeft,
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderBottom: '10px solid var(--arrow-color, hsl(var(--card)))',
            zIndex: 1,
          }}
        />
      )}
      <Card 
        className="w-full max-h-[450px] overflow-y-auto shadow-xl border-2 border-primary/30 bg-card"
      >
        <div className="p-4 bg-card text-card-foreground">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {enableWordMeanings && showAllMeanings ? (
                <>
                  <BookText className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary text-sm">{t("wordByWordMeanings")}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary text-sm">{t("aiWordAnalysis")}</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={closeTooltip}
              data-testid="button-close-tooltip"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {enableWordMeanings && showAllMeanings && renderDirectMeaningsPanel()}

          {!(enableWordMeanings && showAllMeanings) && (
            <>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t("translateTo")}</span>
                <Select value={targetLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-7 w-[140px] text-xs bg-card" data-testid="select-target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    className="z-[100000]" 
                    position="popper" 
                    side="top"
                    sideOffset={5}
                  >
                    {TRANSLATION_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} data-testid={`lang-option-${lang.code}`}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">{t("analyzing")}</span>
                </div>
              )}

              {error && (
                <div className="text-destructive text-sm py-4 text-center">
                  {error}
                </div>
              )}

              {translation && !isLoading && (
                <div className="space-y-3">
                  <div className="bg-primary/10 rounded-md p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{t("word")}</Badge>
                      <span className="font-bold text-base">{translation.word}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("translation")}</span>
                    </div>
                    <p className="text-sm font-medium">{translation.translation}</p>
                  </div>

                  {translation.grammaticalInfo && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("grammar")}</span>
                        </div>
                        {typeof translation.grammaticalInfo === 'string' ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">{translation.grammaticalInfo}</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(translation.grammaticalInfo).map(([key, value]) => (
                              <p key={key} className="text-xs text-muted-foreground leading-relaxed">
                                <span className="font-medium capitalize">{key.replace(/[/_]/g, ' ')}: </span>
                                {String(value)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {translation.etymology && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">{t("etymology")}</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{translation.etymology}</p>
                      </div>
                    </>
                  )}

                  {translation.contextualMeaning && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">{t("contextualMeaning")}</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{translation.contextualMeaning}</p>
                      </div>
                    </>
                  )}

                  {translation.cached && (
                    <div className="text-[10px] text-muted-foreground/60 text-right">
                      {t("fromCache")}
                    </div>
                  )}
                </div>
              )}

              {!isLoading && !translation && !error && selectedWord && (
                <div className="py-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchAiTranslation(selectedWord, targetLanguage)}
                    data-testid="button-ai-translate"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t("analyzeWithAI")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  ) : null;

  return (
    <span className={className}>
      {words.map((segment, index) => {
        if (/^\s+$/.test(segment)) {
          if (segment.includes('\n')) {
            return <br key={index} />;
          }
          return <span key={index}>{segment}</span>;
        }
        
        const cleanWord = segment.replace(/[\u0964\u0965,.;:!?'"()\[\]{}\u2014\u2013\-]/g, '').trim();
        if (!cleanWord) {
          return <span key={index}>{segment}</span>;
        }

        return (
          <span
            key={index}
            onClick={(e) => handleWordClick(segment, e)}
            className="cursor-pointer hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary/50 pb-0.5"
            data-testid={`${instanceId}-word-${index}`}
          >
            {segment}
          </span>
        );
      })}
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </span>
  );
}
