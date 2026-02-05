import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, X, BookOpen, Languages, Sparkles, Globe } from "lucide-react";
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

interface WordTranslation {
  word: string;
  translation: string;
  grammaticalInfo: string;
  etymology: string;
  contextualMeaning: string;
  cached?: boolean;
}

const TRANSLATION_LANGUAGES = [
  { code: "english", name: "English" },
  { code: "hindi", name: "Hindi (हिन्दी)" },
  { code: "kannada", name: "Kannada (ಕನ್ನಡ)" },
  { code: "tamil", name: "Tamil (தமிழ்)" },
  { code: "telugu", name: "Telugu (తెలుగు)" },
];

interface WordTooltipProps {
  content: string;
  commentaryContent?: string;
  sourceLanguage: string;
  className?: string;
}

export function WordTooltip({ 
  content, 
  commentaryContent = "",
  sourceLanguage,
  className = ""
}: WordTooltipProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [clickedWordRect, setClickedWordRect] = useState<DOMRect | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<WordTranslation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("english");
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        const isSelectContent = target.closest('[data-radix-popper-content-wrapper]') ||
                               target.closest('[role="listbox"]') ||
                               target.closest('[role="option"]');
        if (!isSelectContent) {
          closeTooltip();
        }
      }
    }
    
    function handleScroll(event: Event) {
      const target = event.target as HTMLElement;
      if (target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }
      closeTooltip();
    }
    
    if (showTooltip) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showTooltip]);

  const handleWordClick = (word: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const cleanWord = word.replace(/[।॥,.;:!?'"()[\]{}—–-]/g, '').trim();
    
    if (!cleanWord || cleanWord.length === 0) return;
    
    setSelectedWord(cleanWord);
    setClickedWordRect(rect);
    setShowTooltip(true);
    setTranslation(null);
    setError(null);
    
    fetchTranslation(cleanWord, targetLanguage);
  };

  const fetchTranslation = async (word: string, lang: string) => {
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
      fetchTranslation(selectedWord, newLang);
    }
  };

  const closeTooltip = () => {
    setShowTooltip(false);
    setSelectedWord(null);
    setTranslation(null);
    setError(null);
    setClickedWordRect(null);
  };

  const getTooltipStyle = useCallback(() => {
    if (!clickedWordRect) return {};
    
    const tooltipWidth = 340;
    const tooltipMaxHeight = 450;
    const gap = 8;
    
    const wordCenterX = clickedWordRect.left + clickedWordRect.width / 2;
    let left = wordCenterX - tooltipWidth / 2;
    let top = clickedWordRect.bottom + gap;
    
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    if (top + tooltipMaxHeight > window.innerHeight - 10) {
      top = clickedWordRect.top - tooltipMaxHeight - gap;
      if (top < 10) top = 10;
    }
    
    const arrowLeft = Math.max(16, Math.min(wordCenterX - left, tooltipWidth - 16));
    
    return { left, top, arrowLeft };
  }, [clickedWordRect]);

  const words = content.split(/(\s+)/);
  const tooltipStyle = getTooltipStyle();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <span className="leading-relaxed">
        {words.map((segment, index) => {
          if (/^\s+$/.test(segment)) {
            return <span key={index}>{segment}</span>;
          }
          
          const cleanWord = segment.replace(/[।॥,.;:!?'"()[\]{}—–-]/g, '').trim();
          if (!cleanWord) {
            return <span key={index}>{segment}</span>;
          }

          return (
            <span
              key={index}
              onClick={(e) => handleWordClick(segment, e)}
              className="cursor-pointer hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary/50 pb-0.5 inline"
              data-testid={`word-${index}`}
            >
              {segment}
            </span>
          );
        })}
      </span>

      {showTooltip && clickedWordRect && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: tooltipStyle.left,
            top: tooltipStyle.top,
            zIndex: 9999,
            width: 340,
          }}
          className="animate-in fade-in-0 slide-in-from-top-2 duration-150"
        >
          <div 
            className="absolute -top-2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-b-card"
            style={{ left: (tooltipStyle.arrowLeft || 170) - 10 }}
          />
          <Card className="w-full max-h-[420px] overflow-y-auto shadow-xl border-2 border-primary/30 bg-card">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary text-sm">AI Word Analysis</span>
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

              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Translate to:</span>
                <Select value={targetLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="select-target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  <span className="ml-2 text-sm text-muted-foreground">Analyzing...</span>
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
                      <Badge variant="secondary" className="text-xs">Word</Badge>
                      <span className="font-bold text-base">{translation.word}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Translation</span>
                    </div>
                    <p className="text-sm font-medium">{translation.translation}</p>
                  </div>

                  {translation.grammaticalInfo && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grammar</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{translation.grammaticalInfo}</p>
                      </div>
                    </>
                  )}

                  {translation.etymology && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Etymology</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{translation.etymology}</p>
                      </div>
                    </>
                  )}

                  {translation.contextualMeaning && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contextual Meaning</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{translation.contextualMeaning}</p>
                      </div>
                    </>
                  )}

                  {translation.cached && (
                    <div className="text-[10px] text-muted-foreground/60 text-right">
                      (from cache)
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
