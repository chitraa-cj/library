import { useState, useRef, useEffect, useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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

interface TooltipPosition {
  top: number;
  left: number;
  arrowLeft: number;
}

export function WordTooltip({ 
  content, 
  commentaryContent = "",
  sourceLanguage,
  className = ""
}: WordTooltipProps) {
  const instanceId = useId();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [translation, setTranslation] = useState<WordTranslation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("english");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const clickedWordRef = useRef<DOMRect | null>(null);

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
  }, [showTooltip]);

  const handleWordClick = (word: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.currentTarget.getBoundingClientRect();
    clickedWordRef.current = rect;
    
    const cleanWord = word.replace(/[।॥,.;:!?'"()[\]{}—–-]/g, '').trim();
    if (!cleanWord || cleanWord.length === 0) return;
    
    setSelectedWord(cleanWord);
    setShowTooltip(true);
    setTranslation(null);
    setError(null);
    setPosition(null);
    
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
    setPosition(null);
    clickedWordRef.current = null;
  };

  if (!content) return null;
  
  const words = content.split(/(\s+)/);

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
          style={{
            position: 'absolute',
            top: -10,
            left: position.arrowLeft,
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderBottom: '10px solid #fff',
            zIndex: 1,
          }}
        />
      )}
      <Card 
        className="w-full max-h-[400px] overflow-y-auto shadow-xl border-2 border-primary/30"
        style={{ backgroundColor: '#ffffff' }}
      >
        <div className="p-4 bg-white">
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
              <SelectTrigger className="h-7 w-[140px] text-xs bg-white" data-testid="select-target-language">
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
  ) : null;

  return (
    <span className={className}>
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
