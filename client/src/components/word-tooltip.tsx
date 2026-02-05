import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, X, BookOpen, Languages, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface WordTranslation {
  word: string;
  translation: string;
  grammaticalInfo: string;
  etymology: string;
  contextualMeaning: string;
  cached?: boolean;
}

interface WordTooltipProps {
  content: string;
  commentaryContent?: string;
  sourceLanguage: string;
  targetLanguage?: string;
  className?: string;
}

export function WordTooltip({ 
  content, 
  commentaryContent = "",
  sourceLanguage,
  targetLanguage = "english",
  className = ""
}: WordTooltipProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; wordCenterX: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<WordTranslation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback((rect: DOMRect, containerRect: DOMRect | null) => {
    const tooltipWidth = 320;
    const padding = 12;
    
    const wordCenterX = rect.left + rect.width / 2;
    let left = wordCenterX - tooltipWidth / 2;
    let top = rect.bottom + padding;
    
    if (left < padding) {
      left = padding;
    }
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    
    const maxTop = window.innerHeight - 420;
    if (top > maxTop) {
      top = rect.top - 420;
      if (top < 10) {
        top = 10;
      }
    }
    
    return { left, top, wordCenterX };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        closeTooltip();
      }
    }
    
    function handleScroll() {
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
    const containerRect = containerRef.current?.getBoundingClientRect() || null;
    const cleanWord = word.replace(/[।॥,.;:!?'"()[\]{}—–-]/g, '').trim();
    
    if (!cleanWord || cleanWord.length === 0) return;
    
    const position = calculatePosition(rect, containerRect);
    
    setSelectedWord(cleanWord);
    setTooltipPosition(position);
    setShowTooltip(true);
    setTranslation(null);
    setError(null);
    
    fetchTranslation(cleanWord);
  };

  const fetchTranslation = async (word: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          sourceLanguage,
          targetLanguage,
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

  const closeTooltip = () => {
    setShowTooltip(false);
    setSelectedWord(null);
    setTranslation(null);
    setError(null);
  };

  const words = content.split(/(\s+)/);

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

      {showTooltip && tooltipPosition && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: tooltipPosition.left,
            top: tooltipPosition.top,
            zIndex: 9999,
            width: 320,
          }}
          className="animate-in fade-in-0 slide-in-from-top-2 duration-200"
        >
          <div 
            className="absolute -top-2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-primary/20"
            style={{
              left: Math.max(8, Math.min(tooltipPosition.wordCenterX - tooltipPosition.left - 8, 304)),
            }}
          />
          <Card className="w-full max-h-96 overflow-y-auto shadow-2xl border-primary/20 bg-background/98 backdrop-blur-md">
            <div className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
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
