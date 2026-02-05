import { useState, useRef, useEffect } from "react";
import { Info, Loader2, X, BookOpen, Languages, Sparkles } from "lucide-react";
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
  verseContent: string;
  commentaryContent: string;
  sourceLanguage: string;
  targetLanguage?: string;
}

export function WordTooltip({ 
  verseContent, 
  commentaryContent, 
  sourceLanguage,
  targetLanguage = "english" 
}: WordTooltipProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  const [showInfoButton, setShowInfoButton] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<WordTranslation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (tooltipRef.current && !tooltipRef.current.contains(target) && 
          !containerRef.current?.contains(target)) {
        setShowTooltip(false);
        setShowInfoButton(false);
        setSelectedWord(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = selection.toString().trim();
      if (text && text.length > 0 && text.length < 100) {
        const rect = range.getBoundingClientRect();
        
        setSelectedWord(text);
        setSelectedPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
        });
        setShowInfoButton(true);
        setShowTooltip(false);
        setTranslation(null);
        setError(null);
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const fetchTranslation = async () => {
    if (!selectedWord) return;
    
    setIsLoading(true);
    setShowInfoButton(false);
    setShowTooltip(true);
    setError(null);

    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: selectedWord,
          sourceLanguage,
          targetLanguage,
          verseContext: verseContent,
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
    setShowInfoButton(false);
    setSelectedWord(null);
    setTranslation(null);
    setError(null);
  };

  return (
    <div ref={containerRef} className="relative select-text cursor-text">
      <p className="text-lg leading-relaxed whitespace-pre-wrap font-serif">
        {verseContent}
      </p>

      {showInfoButton && selectedPosition && (
        <div
          style={{
            position: "fixed",
            left: selectedPosition.x,
            top: selectedPosition.y,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
        >
          <Button
            size="sm"
            variant="default"
            onClick={fetchTranslation}
            className="h-7 px-2 gap-1 rounded-full bg-primary/90 hover:bg-primary shadow-lg animate-in fade-in-0 zoom-in-95"
            data-testid="button-word-info"
          >
            <Info className="h-3.5 w-3.5" />
            <span className="text-xs">Explain</span>
          </Button>
        </div>
      )}

      {showTooltip && selectedPosition && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: Math.min(Math.max(selectedPosition.x, 180), window.innerWidth - 180),
            top: selectedPosition.y,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
          className="animate-in fade-in-0 slide-in-from-top-2"
        >
          <Card className="w-80 max-h-96 overflow-y-auto shadow-2xl border-primary/20 bg-background/95 backdrop-blur-md">
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
