import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, User, MessageSquareText, StickyNote, List, Globe, Languages, Sparkles, Feather, ScrollText, Check, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPopup } from "@/components/video-popup";
import { WordTooltip } from "@/components/word-tooltip";
import { useTranslation } from "@/lib/translations";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations, chapterTitleTranslations, sectionTitleTranslations, verseSectionTitleTranslations } from "@/lib/content-translations";
import type { BookWithVerseMeta, VerseMeta, VerseTranslation, Explanation, VerseWithTranslations } from "@shared/schema";
import shankaracharyaImg from "@assets/image_1770455528511.png";

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
  "devanagari": ["devanagari", "sa", "sanskrit"],
  "sa": ["devanagari", "sa", "sanskrit"],
  "sanskrit": ["devanagari", "sa", "sanskrit"],
  "ml": ["ml", "malayalam"],
  "malayalam": ["ml", "malayalam"],
  "bn": ["bn", "bengali"],
  "bengali": ["bn", "bengali"],
  "gu": ["gu", "gujarati"],
  "gujarati": ["gu", "gujarati"],
  "mr": ["mr", "marathi"],
  "marathi": ["mr", "marathi"],
  "or": ["or", "odia"],
  "odia": ["or", "odia"],
  "pa": ["pa", "punjabi"],
  "punjabi": ["pa", "punjabi"],
};

function langMatches(langCode: string, target: string): boolean {
  const codes = LANG_ALIASES[target] || [target];
  return codes.includes(langCode);
}

interface TOCAdhyay {
  adhyayNumber: number;
  adhyayTitle: string;
  verses: VerseMeta[];
  khandas: TOCKhanda[];
}

interface TOCKhanda {
  khandaNumber: number;
  khandaTitle: string;
  verses: VerseMeta[];
}

function buildTOCHierarchy(verses: VerseMeta[], t?: (key: string) => string): { type: "three-level" | "two-level" | "flat"; groups: TOCAdhyay[] } {
  const hasThreeLevel = verses.some(v => v.adhyayNumber != null && v.khandaNumber != null);
  const hasTwoLevel = verses.some(v => v.adhyayNumber != null);
  if (!hasThreeLevel && !hasTwoLevel) return { type: "flat", groups: [] };

  const chapterLabel = t ? t("chapterFull") : "Chapter";
  const sectionLabel = t ? t("section") : "Section";

  const type = hasThreeLevel ? "three-level" : "two-level";
  const hierarchyVerses = verses.filter(v => v.adhyayNumber != null);
  const adhyayMap = new Map<number, TOCAdhyay>();

  for (const verse of hierarchyVerses) {
    const adhyayNum = verse.adhyayNumber!;
    if (!adhyayMap.has(adhyayNum)) {
      adhyayMap.set(adhyayNum, {
        adhyayNumber: adhyayNum,
        adhyayTitle: verse.adhyayTitle ?? `${chapterLabel} ${adhyayNum}`,
        verses: [],
        khandas: [],
      });
    }
    const adhyay = adhyayMap.get(adhyayNum)!;
    if (type === "three-level" && verse.khandaNumber != null) {
      let khanda = adhyay.khandas.find(k => k.khandaNumber === verse.khandaNumber);
      if (!khanda) {
        khanda = { khandaNumber: verse.khandaNumber, khandaTitle: verse.khandaTitle ?? `${sectionLabel} ${verse.khandaNumber}`, verses: [] };
        adhyay.khandas.push(khanda);
      }
      khanda.verses.push(verse);
    } else {
      adhyay.verses.push(verse);
    }
  }

  const sorted = Array.from(adhyayMap.values()).sort((a, b) => a.adhyayNumber - b.adhyayNumber);
  for (const adhyay of sorted) {
    adhyay.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    adhyay.khandas.sort((a, b) => a.khandaNumber - b.khandaNumber);
    for (const khanda of adhyay.khandas) {
      khanda.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    }
  }
  return { type, groups: sorted };
}

const bookMediaConfig: Record<string, { videoId?: string; videoTitle?: string }> = {
  "isha-upanishad-bhashya": {
    videoId: "8ELHatzdtAk",
    videoTitle: "Introduction to Isha Upanishad",
  },
};

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
  commentaryType?: "bhashya" | "teeka";
}

interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

interface VerseBreadcrumb {
  bookTitle: string;
  adhyayNumber: number | null;
  adhyayTitle: string | null;
  khandaNumber: number | null;
  khandaTitle: string | null;
  verseLabel: string;
  numericLabel: string;
}

interface BookReaderProps {
  bookId: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
  onAuthorChange: (author: string | null) => void;
  navigateToVerse?: number | null;
  onVerseChange?: (verseNumber: number) => void;
  onBreadcrumbChange?: (breadcrumb: VerseBreadcrumb) => void;
  onAddNoteWithText?: (text: string) => void;
  chapterViewAdhyay?: number | null;
  chapterViewKhanda?: number | null;
  onExitChapterView?: (verseNumber?: number) => void;
  onSelectChapter?: (adhyayNumber: number) => void;
  onSelectPart?: (adhyayNumber: number, khandaNumber: number) => void;
  onShowCoverPage?: () => void;
}

function isShankaracharya(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("shankaracharya") || lower.includes("shankarayacharya") || lower.includes("sankara") || lower.includes("śaṅkara");
}

function isTeekaAuthorByName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("anandagiri") || lower.includes("ānandagiri");
}

function isBhashyaAuthorByName(name: string): boolean {
  return isShankaracharya(name);
}

function isTeekaAuthor(nameOrOption: string | CommentaryOption): boolean {
  if (typeof nameOrOption === "string") {
    return isTeekaAuthorByName(nameOrOption);
  }
  if (nameOrOption.commentaryType) return nameOrOption.commentaryType === "teeka";
  return isTeekaAuthorByName(nameOrOption.authorName);
}

function isBhashyaAuthor(nameOrOption: string | CommentaryOption): boolean {
  if (typeof nameOrOption === "string") {
    return isBhashyaAuthorByName(nameOrOption);
  }
  if (nameOrOption.commentaryType) return nameOrOption.commentaryType === "bhashya";
  return isBhashyaAuthorByName(nameOrOption.authorName);
}

function EnglishTranslationToggle({ englishContent }: { englishContent: string }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="pl-6 mt-2">
      <button
        onClick={() => setShowTranslation(!showTranslation)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        data-testid="button-see-english-translation"
      >
        <Languages className="h-3 w-3" />
        <span>{showTranslation ? "Hide English translation" : "See English translation"}</span>
      </button>
      {showTranslation && (
        <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border/30">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80 font-serif" data-testid="text-english-translation">
            {englishContent}
          </p>
        </div>
      )}
    </div>
  );
}

function VerseExplanation({ 
  verseId, 
  languageCode, 
  languageCodes,
  authorName,
  showAll,
  filterFn,
  mode
}: { 
  verseId: string; 
  languageCode: string;
  languageCodes?: string[];
  authorName: string | null;
  showAll: boolean;
  filterFn?: (explanation: any) => boolean;
  mode?: "bhashyam" | "teeka";
}) {
  const { t, locale } = useTranslation(languageCode);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, locale);
  const [showMoreCommentaries, setShowMoreCommentaries] = useState(false);
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  const effectiveLanguages = languageCodes && languageCodes.length > 0 ? languageCodes : [languageCode];

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  let allForLanguages = explanations?.filter(e => effectiveLanguages.some(l => langMatches(e.languageCode, l))) || [];
  if (filterFn) {
    allForLanguages = allForLanguages.filter(e => filterFn(e));
  }

  let effectiveAuthor = authorName;
  if (!showAll && authorName && !allForLanguages.some(e => e.authorName === authorName) && allForLanguages.length > 0) {
    effectiveAuthor = allForLanguages[0].authorName;
  }

  const primaryExplanations = showAll
    ? allForLanguages
    : allForLanguages.filter(e => !effectiveAuthor || e.authorName === effectiveAuthor);

  const otherExplanations = !showAll && effectiveAuthor
    ? allForLanguages.filter(e => e.authorName !== effectiveAuthor)
    : [];

  if (primaryExplanations.length === 0 && otherExplanations.length === 0) {
    const notAvailableMsg = mode === "teeka" ? t("teekaNotAvailable") : t("bhashyamNotAvailable");
    return (
      <div className="mt-3 text-sm text-muted-foreground italic text-center py-2" data-testid="commentary-not-available">
        {notAvailableMsg}
      </div>
    );
  }

  const groupExplanations = (items: Explanation[]) =>
    items.reduce((acc, exp) => {
      const key = exp.authorName;
      if (!acc[key]) acc[key] = { authorName: exp.authorName, authorTitle: exp.authorTitle, items: [] };
      acc[key].items.push(exp);
      return acc;
    }, {} as Record<string, { authorName: string; authorTitle: string | null; items: Explanation[] }>);

  const primaryGrouped = groupExplanations(primaryExplanations);
  const otherGrouped = groupExplanations(otherExplanations);

  const LANG_DISPLAY_NAMES: Record<string, string> = {
    devanagari: "संस्कृतम्", sa: "संस्कृतम्", sanskrit: "संस्कृतम्",
    english: "English", en: "English",
    hindi: "हिन्दी", hi: "हिन्दी",
    kannada: "ಕನ್ನಡ", kn: "ಕನ್ನಡ",
    telugu: "తెలుగు", te: "తెలుగు",
    tamil: "தமிழ்", ta: "தமிழ்",
    malayalam: "മലയാളം", ml: "മലയാളം",
    bengali: "বাংলা", bn: "বাংলা",
    gujarati: "ગુજરાતી", gu: "ગુજરાતી",
    marathi: "मराठी", mr: "मराठी",
    odia: "ଓଡ଼ିଆ", or: "ଓଡ଼ିଆ",
    punjabi: "ਪੰਜਾਬੀ", pa: "ਪੰਜਾਬੀ",
  };

  const renderGroup = (group: { authorName: string; authorTitle: string | null; items: Explanation[] }, gIdx: number) => {
    const sortedItems = effectiveLanguages.length > 1
      ? [...group.items].sort((a, b) => {
          const aIdx = effectiveLanguages.findIndex(l => langMatches(a.languageCode, l));
          const bIdx = effectiveLanguages.findIndex(l => langMatches(b.languageCode, l));
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        })
      : group.items;

    return (
      <div 
        key={group.authorName} 
        className={`${gIdx > 0 ? "pt-3 border-t border-border/40" : ""}`}
        data-testid={`commentary-group-${group.authorName.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2 mb-2">
          {isShankaracharya(group.authorName) ? (
            <img src={shankaracharyaImg} alt="Adi Shankaracharya" className="h-8 w-8 object-contain shrink-0" />
          ) : (
            <User className="h-4 w-4 text-primary/70 shrink-0" />
          )}
          <h4 className="text-sm font-semibold text-foreground">{tc(group.authorName, bookAuthorTranslations)}</h4>
          {group.authorTitle && (
            <span className="text-xs text-muted-foreground">- {group.authorTitle}</span>
          )}
        </div>
        {sortedItems.map((explanation, idx) => {
          const showLangLabel = effectiveLanguages.length > 1;
          const langLabel = LANG_DISPLAY_NAMES[explanation.languageCode] || explanation.languageCode;
          return (
            <div key={`${explanation.languageCode}-${idx}`} className={idx > 0 ? "mt-3 pt-3 border-t border-border/20" : ""}>
              {showLangLabel && (
                <div className="pl-6 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">{langLabel}</span>
                </div>
              )}
              {explanation.isAiTranslated && (
                <div className="pl-6 mb-1">
                  <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate" data-testid="badge-ai-translated">
                    <Sparkles className="h-3 w-3" />
                    AI Translation
                  </Badge>
                </div>
              )}
              <div className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90 pl-6" data-testid={`commentary-text-${explanation.languageCode}-${idx}`}>
                <WordTooltip
                  content={explanation.content}
                  sourceLanguage={explanation.languageCode}
                  verseId={verseId}
                  className="inline"
                  useWordMeanings={false}
                  globalLanguage={languageCode}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-4" data-testid={`explanation-${verseId}`}>
      {Object.values(primaryGrouped).map((group, gIdx) => renderGroup(group, gIdx))}

      {otherExplanations.length > 0 && (
        <>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowMoreCommentaries(!showMoreCommentaries)}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-border/50 hover:border-primary/30 bg-background/60 backdrop-blur-sm"
              data-testid="button-show-more-commentaries"
            >
              <MessageSquareText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{showMoreCommentaries ? t("hideOtherCommentaries") : `${t("showMore")} (${Object.keys(otherGrouped).length} ${t("more")})`}</span>
              <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 ${showMoreCommentaries ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showMoreCommentaries && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
              {Object.values(otherGrouped).map((group, gIdx) => renderGroup(group, gIdx))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BookReader({ 
  bookId, 
  onVerseSelect,
  selectedVerseId,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  navigateToVerse,

  onVerseChange,
  onBreadcrumbChange,
  onAddNoteWithText,
  chapterViewAdhyay,
  chapterViewKhanda,
  onExitChapterView,
  onSelectChapter,
  onSelectPart,
  onShowCoverPage,
}: BookReaderProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [localLanguage, setLocalLanguage] = useState<string | null>(selectedCommentaryLanguage);
  const effectiveLang = localLanguage || selectedCommentaryLanguage;
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(() => {
    const initial = new Set(["devanagari"]);
    const pref = selectedCommentaryLanguage || "english";
    initial.add(pref);
    return initial;
  });
  const [showLanguagePanel, setShowLanguagePanel] = useState(false);
  const langPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCommentaryLanguage) {
      setSelectedLanguages(prev => {
        if (prev.has(selectedCommentaryLanguage)) return prev;
        const next = new Set(prev);
        next.add(selectedCommentaryLanguage);
        return next;
      });
    }
  }, [selectedCommentaryLanguage]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langPanelRef.current && !langPanelRef.current.contains(e.target as Node)) {
        setShowLanguagePanel(false);
      }
    }
    if (showLanguagePanel) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showLanguagePanel]);

  const toggleLanguage = useCallback((langCode: string) => {
    if (langCode === "devanagari" || langCode === "sa" || langCode === "sanskrit") return;
    setSelectedLanguages(prev => {
      const next = new Set(prev);
      if (next.has(langCode)) {
        next.delete(langCode);
      } else {
        next.add(langCode);
      }
      return next;
    });
  }, []);
  const { t } = useTranslation(effectiveLang);
  const lang = selectedCommentaryLanguage || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, lang);
  const [currentPage, setCurrentPage] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const hasNavigatedRef = useRef(false);
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const [commentaryMode, setCommentaryMode] = useState<"bhashyam" | "teeka">("bhashyam");
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showCoverPage, setShowCoverPage] = useState(false);
  const [expandedTOCAdhyays, setExpandedTOCAdhyays] = useState<Set<number>>(new Set());
  const [expandedTOCKhandas, setExpandedTOCKhandas] = useState<Set<string>>(new Set());
  const [showTeekas, setShowTeekas] = useState(false);
  const [selectedBhashyaAuthor, setSelectedBhashyaAuthor] = useState<string | null>(null);
  const [selectedTeekaAuthor, setSelectedTeekaAuthor] = useState<string | null>(null);

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 2) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  const handleAddNoteFromSelection = useCallback(() => {
    if (!selectionPopup) return;
    if (!isAuthenticated) {
      window.getSelection()?.removeAllRanges();
      setSelectionPopup(null);
      toast({
        title: t("loginRequired") || "Login required",
        description: t("loginToAddNotes") || "Please log in to add notes",
      });
      window.location.href = "/auth";
      return;
    }
    if (onAddNoteWithText) {
      onAddNoteWithText(selectionPopup.text);
      window.getSelection()?.removeAllRanges();
      setSelectionPopup(null);
    }
  }, [selectionPopup, onAddNoteWithText, isAuthenticated, toast, t]);

  useEffect(() => {
    const dismiss = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setSelectionPopup(null);
        }
      }, 200);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  const { data: book, isLoading, error } = useQuery<BookWithVerseMeta>({
    queryKey: ["/api/books", bookId],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
  });

  const verses = book?.verses || [];
  const currentVerseMeta = verses[currentPage] || null;

  const isIntroSection = (title?: string | null) => {
    const t = title?.toLowerCase().trim();
    return t === "introduction" || t === "sambandha bhashyam";
  };

  const introVerse = useMemo(() => {
    return verses.find(v => v.verseNumber === 0 && isIntroSection(v.sectionTitle)) || null;
  }, [verses]);

  const hasIntro = !!introVerse;

  const isCurrentVerseIntro = currentVerseMeta?.verseNumber === 0 && isIntroSection(currentVerseMeta?.sectionTitle);

  const { data: introExplanations } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", introVerse?.id, "explanations"],
    enabled: !!introVerse?.id,
  });

  const { data: currentVerseDetails, isLoading: isVerseLoading } = useQuery<VerseWithTranslations>({
    queryKey: ["/api/verses", currentVerseMeta?.id],
    enabled: !!currentVerseMeta?.id && chapterViewAdhyay == null,
  });

  const { data: chapterVerses, isLoading: isChapterLoading } = useQuery<VerseWithTranslations[]>({
    queryKey: ["/api/books", bookId, "chapter", chapterViewAdhyay, "verses"],
    enabled: chapterViewAdhyay != null,
  });

  useEffect(() => {
    setInitialized(false);
  }, [bookId]);

  useEffect(() => {
    if (commentaryOptions && !initialized) {
      onAuthorChange("__all__");
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, onAuthorChange]);

  const isShowingAll = selectedAuthor === "__all__";

  const currentVerse = currentVerseMeta;

  const availableAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    let authors = commentaryOptions.authors;
    if (effectiveLang) {
      const matchCodes = LANG_ALIASES[effectiveLang] || [effectiveLang];
      authors = authors.filter(a => a.languageCodes.some(c => matchCodes.includes(c)));
    }
    if (commentaryMode === "bhashyam") {
      authors = authors.filter(a => isBhashyaAuthor(a));
    } else if (commentaryMode === "teeka") {
      authors = authors.filter(a => isTeekaAuthor(a));
    }
    return authors;
  }, [commentaryOptions, effectiveLang, commentaryMode]);

  const handleAuthorChange = (authorName: string) => {
    onAuthorChange(authorName);
  };

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  const currentNumericLabel = useMemo(() => {
    if (!currentVerse || currentVerse.adhyayNumber == null || currentVerse.khandaNumber == null) {
      return null;
    }
    const khandaVerses = verses
      .filter((v: VerseMeta) => v.adhyayNumber === currentVerse.adhyayNumber && v.khandaNumber === currentVerse.khandaNumber)
      .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
    const idx = khandaVerses.findIndex((v: VerseMeta) => v.id === currentVerse.id);
    return `${currentVerse.adhyayNumber}.${currentVerse.khandaNumber}.${idx >= 0 ? idx + 1 : 1}`;
  }, [currentVerse, verses]);

  const introTextForLang = useMemo(() => {
    if (!introExplanations || introExplanations.length === 0) return null;
    const langToUse = effectiveLang || "english";
    const matchCodes = LANG_ALIASES[langToUse] || [langToUse];
    const match = introExplanations.find(e => matchCodes.includes(e.languageCode));
    if (match) return match.content;
    const devanagari = introExplanations.find(e => e.languageCode === "devanagari" || e.languageCode === "sa");
    return devanagari?.content || introExplanations[0]?.content || null;
  }, [introExplanations, effectiveLang]);

  useEffect(() => {
    setLocalLanguage(selectedCommentaryLanguage);
  }, [selectedCommentaryLanguage]);

  useEffect(() => {
    setShowCoverPage(false);
    hasNavigatedRef.current = false;
    setExpandedTOCAdhyays(new Set());
    setExpandedTOCKhandas(new Set());
    setLocalLanguage(selectedCommentaryLanguage);
  }, [bookId]);

  useLayoutEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && verses.length > 0) {
      const pageIndex = verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0) {
        setCurrentPage(pageIndex);
        setShowCoverPage(false);
        hasNavigatedRef.current = true;
      }
    } else if (verses.length > 0 && !hasNavigatedRef.current) {
      const firstNonIntro = verses.findIndex(v => v.verseNumber !== 0 || !isIntroSection(v.sectionTitle));
      setCurrentPage(firstNonIntro >= 0 ? firstNonIntro : 0);
      hasNavigatedRef.current = true;
    }
  }, [chapterViewAdhyay, navigateToVerse, verses]);

  useEffect(() => {
    if (onVerseChange && currentVerse && !showCoverPage && !isCurrentVerseIntro) {
      onVerseChange(currentVerse.verseNumber);
    }
  }, [currentPage, currentVerse, onVerseChange, showCoverPage, isCurrentVerseIntro]);

  useEffect(() => {
    if (onBreadcrumbChange && currentVerse && !showCoverPage && book) {
      const verse = currentVerse;
      const adhyayNum = verse.adhyayNumber;
      const khandaNum = verse.khandaNumber;

      let numericLabel: string;
      if (adhyayNum != null && khandaNum != null) {
        const khandaVerses = verses
          .filter((v: VerseMeta) => v.adhyayNumber === adhyayNum && v.khandaNumber === khandaNum)
          .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
        const idx = khandaVerses.findIndex((v) => v.id === verse.id);
        numericLabel = `${adhyayNum}.${khandaNum}.${idx >= 0 ? idx + 1 : 1}`;
      } else {
        numericLabel = `${verse.verseNumber}`;
      }

      onBreadcrumbChange({
        bookTitle: tc(book.title, bookTitleTranslations),
        adhyayNumber: adhyayNum ?? null,
        adhyayTitle: tc(verse.adhyayTitle, chapterTitleTranslations) || null,
        khandaNumber: khandaNum ?? null,
        khandaTitle: tc(verse.khandaTitle, sectionTitleTranslations) || null,
        verseLabel: tc(verse.sectionTitle, verseSectionTitleTranslations) || `${t("mantra")} ${verse.verseNumber}`,
        numericLabel,
      });
    }
  }, [currentPage, book, onBreadcrumbChange, showCoverPage, lang]);

  const availableTranslations = useMemo(() => {
    if (!currentVerseDetails?.translations) return [];
    const langsToShow = Array.from(selectedLanguages).filter(l => l !== "devanagari" && l !== "sa");
    if (langsToShow.length === 0) return [];
    const allMatchCodes = langsToShow.flatMap(l => LANG_ALIASES[l] || [l]);
    const filtered = currentVerseDetails.translations.filter((t: VerseTranslation) =>
      allMatchCodes.includes(t.languageCode)
    );
    return filtered;
  }, [currentVerseDetails, selectedLanguages]);

  const verseTransliteration = useMemo(() => {
    if (!currentVerseDetails || !effectiveLang) return null;
    const devanagariLangs = ["devanagari", "sa", "sanskrit", "hindi", "hi", "marathi", "mr", "konkani", "kok"];
    if (devanagariLangs.includes(effectiveLang)) return null;

    const transliterations = (currentVerseDetails as any).transliterations;
    if (transliterations && Array.isArray(transliterations)) {
      const matchCodes = LANG_ALIASES[effectiveLang] || [effectiveLang];
      const match = transliterations.find((tr: any) => matchCodes.includes(tr.languageCode));
      if (match?.content) return match.content;
    }

    if ((currentVerseDetails as any).iastTransliteration) {
      return (currentVerseDetails as any).iastTransliteration;
    }

    return null;
  }, [currentVerseDetails, effectiveLang]);

  const commentaryContext = useMemo(() => {
    if (!selectedAuthor || !effectiveLang || !currentVerseDetails) return "";
    const explanation = currentVerseDetails.explanations?.find(
      (e: Explanation) => e.authorName === selectedAuthor && langMatches(e.languageCode, effectiveLang)
    );
    return explanation?.content || "";
  }, [selectedAuthor, effectiveLang, currentVerseDetails]);

  useEffect(() => {
    if (isCurrentVerseIntro) {
      onVerseSelect("", "");
      return;
    }
    if (currentVerse && currentVerseDetails) {
      const langCode = effectiveLang || "devanagari";
      if (langCode === "devanagari" || langCode === "sa") {
        const content = getOriginalDevanagari(currentVerseDetails);
        onVerseSelect(currentVerse.id, content);
        return;
      }
      const matchCodes = LANG_ALIASES[langCode] || [langCode];
      let content = "";
      const matched = currentVerseDetails.translations?.find(
        (t: VerseTranslation) => matchCodes.includes(t.languageCode)
      );
      content = matched?.content || "";
      if (!content) {
        content = getOriginalDevanagari(currentVerseDetails);
      }
      onVerseSelect(currentVerse.id, content);
    }
  }, [currentVerse, currentVerseDetails, effectiveLang, isCurrentVerseIntro]);

  const tocHierarchy = useMemo(() => buildTOCHierarchy(verses, t as any), [verses, t]);

  useEffect(() => {
    if (onBreadcrumbChange && chapterViewAdhyay != null && book) {
      const chapterInfo = tocHierarchy.groups.find(g => g.adhyayNumber === chapterViewAdhyay);
      const chapterTitle = chapterInfo?.adhyayTitle || `${t("chapterFull")} ${chapterViewAdhyay}`;
      const selectedKhanda = chapterViewKhanda != null && chapterInfo
        ? chapterInfo.khandas.find(k => k.khandaNumber === chapterViewKhanda)
        : null;

      const numericLabel = chapterViewKhanda != null
        ? `${chapterViewAdhyay}.${chapterViewKhanda}`
        : `${chapterViewAdhyay}`;

      onBreadcrumbChange({
        bookTitle: tc(book.title, bookTitleTranslations),
        adhyayNumber: chapterViewAdhyay,
        adhyayTitle: tc(chapterTitle, chapterTitleTranslations) || null,
        khandaNumber: chapterViewKhanda ?? null,
        khandaTitle: selectedKhanda ? (tc(selectedKhanda.khandaTitle, sectionTitleTranslations) || null) : null,
        verseLabel: "",
        numericLabel,
      });
    }
  }, [chapterViewAdhyay, chapterViewKhanda, book, onBreadcrumbChange, tocHierarchy, lang]);

  const bhashyaAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    return commentaryOptions.authors.filter(a => isBhashyaAuthor(a));
  }, [commentaryOptions]);

  const teekaAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    return commentaryOptions.authors.filter(a => isTeekaAuthor(a));
  }, [commentaryOptions]);

  useEffect(() => {
    if (bhashyaAuthors.length > 0 && !selectedBhashyaAuthor) {
      setSelectedBhashyaAuthor(bhashyaAuthors[0].authorName);
    }
  }, [bhashyaAuthors, selectedBhashyaAuthor]);

  useEffect(() => {
    if (teekaAuthors.length > 0 && !selectedTeekaAuthor) {
      setSelectedTeekaAuthor(teekaAuthors[0].authorName);
    }
  }, [teekaAuthors, selectedTeekaAuthor]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 sm:h-12 w-3/4" />
          <Skeleton className="h-5 sm:h-6 w-1/2" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
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

  const totalPages = verses.length;

  const getTranslation = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  const getOriginalDevanagari = (verse: any): string => {
    const devText = getTranslation(verse, "devanagari");
    if (devText) return devText;
    return getTranslation(verse, "sa");
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goToNextPage();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPrevPage();
    }
  };

  const originalDevanagari = currentVerseDetails ? getOriginalDevanagari(currentVerseDetails) : "";

  const handleTOCVerseClick = (verseNumber: number) => {
    const pageIndex = verses.findIndex(v => v.verseNumber === verseNumber);
    if (pageIndex >= 0) {
      setCurrentPage(pageIndex);
      setShowCoverPage(false);
    }
  };

  const toggleTOCAdhyay = (adhyayNumber: number) => {
    const next = new Set(expandedTOCAdhyays);
    if (next.has(adhyayNumber)) next.delete(adhyayNumber);
    else next.add(adhyayNumber);
    setExpandedTOCAdhyays(next);
  };

  const toggleTOCKhanda = (key: string) => {
    const next = new Set(expandedTOCKhandas);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedTOCKhandas(next);
  };

  if (showCoverPage && book && !isLoading && chapterViewAdhyay == null) {
    return (
      <div className="flex-1 flex flex-col min-w-0 focus:outline-none">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto">
            <div className="py-4 sm:py-6">
              <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                <span className="text-2xl sm:text-3xl text-primary/20 font-serif mb-2 select-none pointer-events-none">ॐ</span>
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight" data-testid="text-cover-title">
                  {tc(book.title, bookTitleTranslations)}
                </h1>
                <Badge variant="secondary" className="mt-1.5 text-[10px] sm:text-xs">
                  {tc(book.category, bookCategoryTranslations)}
                </Badge>
              </div>

              {book.description && (
                <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed text-center mb-3 sm:mb-4 max-w-lg mx-auto" data-testid="text-cover-description">
                  {tc(book.title, bookDescriptionTranslations) !== book.title ? tc(book.title, bookDescriptionTranslations) : book.description}
                </p>
              )}

              <div className="flex items-center justify-center mb-3">
                <span className="text-xs text-muted-foreground">{hasIntro ? verses.length - 1 : verses.length} {t("verses")}</span>
              </div>

              {hasIntro && (
                <Button
                  variant="outline"
                  className="w-full gap-2 mb-2"
                  onClick={() => {
                    const introPageIdx = verses.findIndex(v => v.verseNumber === 0 && isIntroSection(v.sectionTitle));
                    if (introPageIdx >= 0) {
                      setCurrentPage(introPageIdx);
                      setShowCoverPage(false);
                    }
                  }}
                  data-testid="button-read-introduction"
                >
                  <BookOpen className="h-4 w-4" />
                  {t("readIntroduction")}
                </Button>
              )}

              <Button
                className="w-full gap-2"
                onClick={() => {
                  if (tocHierarchy.groups.length > 0) {
                    onSelectChapter?.(tocHierarchy.groups[0].adhyayNumber);
                  } else {
                    const firstNonIntroIdx = verses.findIndex(v => v.verseNumber !== 0 || v.sectionTitle?.toLowerCase().trim() !== "introduction");
                    setCurrentPage(firstNonIntroIdx >= 0 ? firstNonIntroIdx : 0);
                    setShowCoverPage(false);
                  }
                }}
                data-testid="button-start-reading"
              >
                <BookOpen className="h-4 w-4" />
                {t("startReading")}
              </Button>
            </div>

            {tocHierarchy.groups.length > 0 && (
              <div className="mt-5 sm:mt-6">
                <div className="rounded-xl border border-border/60 bg-card/60 dark:bg-card/40 overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
                    <h2 className="font-serif text-sm sm:text-base font-semibold text-foreground" data-testid="text-toc-heading">{t("tableOfContents")}</h2>
                    <span className="text-xs text-muted-foreground">
                      {tocHierarchy.groups.length} {tocHierarchy.groups.length === 1 ? t("chapter") : t("chapters")}
                    </span>
                  </div>

                  <div className="p-3 space-y-2" data-testid="toc-list">
                    {hasIntro && (
                      <button
                        className="flex items-center gap-3 w-full px-4 py-3 text-left rounded-lg border border-border/40 bg-card hover:bg-primary/5 transition-colors group"
                        onClick={() => {
                          const introPageIdx = verses.findIndex(v => v.verseNumber === 0 && isIntroSection(v.sectionTitle));
                          if (introPageIdx >= 0) {
                            setCurrentPage(introPageIdx);
                            setShowCoverPage(false);
                          }
                        }}
                        data-testid="toc-introduction"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">✦</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-primary block truncate">{t("introduction")}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-primary/50 shrink-0 group-hover:text-primary transition-colors" />
                      </button>
                    )}
                    {tocHierarchy.groups.map((adhyay, index) => {
                      const isExpanded = expandedTOCAdhyays.has(adhyay.adhyayNumber);
                      const totalVerses = tocHierarchy.type === "three-level"
                        ? adhyay.khandas.reduce((sum, k) => sum + k.verses.length, 0)
                        : adhyay.verses.length;
                      return (
                        <div key={adhyay.adhyayNumber} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                          <div className="flex items-center w-full hover:bg-primary/5 transition-colors group">
                            <button
                              className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left"
                              onClick={() => {
                                onSelectChapter?.(adhyay.adhyayNumber);
                              }}
                              data-testid={`toc-adhyay-${adhyay.adhyayNumber}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-primary">{adhyay.adhyayNumber}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-foreground block truncate">{tc(adhyay.adhyayTitle, chapterTitleTranslations)}</span>
                                <span className="text-[11px] text-muted-foreground">{totalVerses} {t("verses")}</span>
                              </div>
                            </button>
                            {(tocHierarchy.type === "three-level" || adhyay.verses.length > 0) && (
                              <button
                                className="shrink-0 px-3 py-3 self-stretch flex items-center"
                                onClick={() => toggleTOCAdhyay(adhyay.adhyayNumber)}
                                data-testid={`toc-toggle-adhyay-${adhyay.adhyayNumber}`}
                              >
                                <ChevronRight className={`h-4 w-4 text-primary/50 group-hover:text-primary transition-all duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="bg-muted/20 dark:bg-muted/10 border-t border-border/20 animate-in fade-in slide-in-from-top-1 duration-150">
                              {tocHierarchy.type === "three-level" ? (
                                <div className="p-2 space-y-1.5">
                                  {adhyay.khandas.map(khanda => {
                                    const khandaKey = `${adhyay.adhyayNumber}-${khanda.khandaNumber}`;
                                    const isKhandaExpanded = expandedTOCKhandas.has(khandaKey);
                                    return (
                                      <div key={khandaKey} className="rounded-md border border-border/30 bg-card/80 overflow-hidden">
                                        <div className="flex items-center w-full hover:bg-primary/5 transition-colors group/khanda">
                                          <button
                                            className="flex items-center gap-3 flex-1 min-w-0 pl-4 pr-4 py-2.5 text-left"
                                            onClick={() => {
                                              onSelectPart?.(adhyay.adhyayNumber, khanda.khandaNumber);
                                            }}
                                            data-testid={`toc-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                                          >
                                            <div className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                                              <span className="text-[10px] font-medium text-muted-foreground">{adhyay.adhyayNumber}.{khanda.khandaNumber}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <span className="text-xs sm:text-sm text-foreground/80 block truncate">{tc(khanda.khandaTitle, sectionTitleTranslations)}</span>
                                              <span className="text-[10px] text-muted-foreground">{khanda.verses.length} {t("verses")}</span>
                                            </div>
                                          </button>
                                          <button
                                            className="shrink-0 px-3 py-2.5 self-stretch flex items-center"
                                            onClick={() => toggleTOCKhanda(khandaKey)}
                                            data-testid={`toc-toggle-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                                          >
                                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 group-hover/khanda:text-primary transition-all duration-200 ${isKhandaExpanded ? "rotate-90" : ""}`} />
                                          </button>
                                        </div>

                                        {isKhandaExpanded && (
                                          <div className="bg-muted/15 dark:bg-muted/5 border-t border-border/10 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                            {khanda.verses.map((v, idx) => (
                                              <button
                                                key={v.id}
                                                className="w-full flex items-center gap-3 pl-6 pr-4 py-2 text-left rounded-md hover:bg-primary/5 transition-colors border border-transparent hover:border-border/30"
                                                onClick={() => handleTOCVerseClick(v.verseNumber)}
                                                data-testid={`toc-verse-${v.verseNumber}`}
                                              >
                                                <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0 w-12">
                                                  {adhyay.adhyayNumber}.{khanda.khandaNumber}.{idx + 1}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                  {tc(v.sectionTitle, verseSectionTitleTranslations) || `${t("mantra")} ${idx + 1}`}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-2 space-y-1">
                                  {adhyay.verses.map((v, idx) => (
                                    <button
                                      key={v.id}
                                      className="w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left rounded-md hover:bg-primary/5 transition-colors border border-transparent hover:border-border/30"
                                      onClick={() => handleTOCVerseClick(v.verseNumber)}
                                      data-testid={`toc-verse-${v.verseNumber}`}
                                    >
                                      <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0 w-10">
                                        {adhyay.adhyayNumber}.{idx + 1}
                                      </span>
                                      <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                        {tc(v.sectionTitle, verseSectionTitleTranslations) || `${t("verse")} ${idx + 1}`}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {commentaryOptions && commentaryOptions.authors.length > 1 && (
              <div className="mt-5 sm:mt-6" data-testid="cover-commentary-selection">
                <div className="flex items-center gap-2 mb-3">
                  <Feather className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="font-serif text-base sm:text-lg font-semibold">{t("commentaryAndScholars")}</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{t("selectCommentaryHint")}</p>
                <div data-testid="cover-commentary-list">
                  {(() => {
                    const bhashyaAuthors = commentaryOptions.authors.filter(a => isBhashyaAuthor(a));
                    const teekaAuthors = commentaryOptions.authors.filter(a => isTeekaAuthor(a));
                    const otherAuthors = commentaryOptions.authors.filter(a => !isBhashyaAuthor(a) && !isTeekaAuthor(a));
                    const isSelected = (name: string) => selectedAuthor === name;
                    const renderAuthorCard = (author: CommentaryOption) => (
                      <button
                        key={author.authorName}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors w-full ${
                          isSelected(author.authorName)
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5"
                        }`}
                        onClick={() => {
                          handleAuthorChange(author.authorName);
                        }}
                        data-testid={`cover-author-${author.authorName.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected(author.authorName) ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {isSelected(author.authorName) ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`text-sm font-medium ${isSelected(author.authorName) ? "text-primary" : "text-foreground"}`}>
                            {tc(author.authorName, bookAuthorTranslations)}
                          </span>
                          {author.authorTitle && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              ({author.authorTitle})
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {author.languageCodes.length} {author.languageCodes.length === 1 ? t("lang") : t("langs")}
                        </Badge>
                      </button>
                    );

                    const hasBothColumns = bhashyaAuthors.length > 0 && teekaAuthors.length > 0;

                    return (
                      <div className="space-y-4">
                        <div className={hasBothColumns ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
                          {bhashyaAuthors.length > 0 && (
                            <div className="rounded-xl border border-border/60 bg-card/60 dark:bg-card/40 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                                <Feather className="h-3.5 w-3.5 text-primary/70" />
                                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("bhashyam")}</span>
                              </div>
                              <div className="p-2 space-y-2">
                                {bhashyaAuthors.map(renderAuthorCard)}
                              </div>
                            </div>
                          )}
                          {teekaAuthors.length > 0 && (
                            <div className="rounded-xl border border-border/60 bg-card/60 dark:bg-card/40 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                                <ScrollText className="h-3.5 w-3.5 text-primary/70" />
                                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("teeka")}</span>
                              </div>
                              <div className="p-2 space-y-2">
                                {teekaAuthors.map(renderAuthorCard)}
                              </div>
                            </div>
                          )}
                        </div>

                        {otherAuthors.length > 0 && (
                          <div className="rounded-xl border border-border/60 bg-card/60 dark:bg-card/40 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                              <User className="h-3.5 w-3.5 text-primary/70" />
                              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("otherCommentators")}</span>
                            </div>
                            <div className="p-2 space-y-2">
                              {otherAuthors.map(renderAuthorCard)}
                            </div>
                          </div>
                        )}

                        <button
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors w-full ${
                            isShowingAll
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5"
                          }`}
                          onClick={() => handleAuthorChange("__all__")}
                          data-testid="cover-author-all"
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isShowingAll ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            {isShowingAll ? <Check className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                          <span className={`text-sm font-medium ${isShowingAll ? "text-primary" : "text-foreground"}`}>
                            {t("showAllCommentaries")}
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {book?.slug && bookMediaConfig[book.slug]?.videoId && (
          <div className="border-t border-border px-3 sm:px-8 py-2 sm:py-3 bg-background/80 backdrop-blur-sm">
            <div className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto flex items-center justify-center">
              <VideoPopup
                videoId={bookMediaConfig[book.slug].videoId!}
                title={bookMediaConfig[book.slug].videoTitle || t("introductionVideo")}
                buttonLabel={t("watchVideo")}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (chapterViewAdhyay != null && book) {
    const chapterInfo = tocHierarchy.groups.find(g => g.adhyayNumber === chapterViewAdhyay);
    const chapterTitle = chapterInfo?.adhyayTitle || `${t("chapterFull")} ${chapterViewAdhyay}`;
    const selectedKhandaInfo = chapterViewKhanda != null && chapterInfo
      ? chapterInfo.khandas.find(k => k.khandaNumber === chapterViewKhanda)
      : null;

    const getChapterTranslation = (verse: VerseWithTranslations, langCode: string): string => {
      const matchCodes = LANG_ALIASES[langCode] || [langCode];
      const tr = verse.translations?.find(tr => matchCodes.includes(tr.languageCode));
      return tr?.content || "";
    };

    const getChapterDevanagari = (verse: VerseWithTranslations): string => {
      const devText = verse.translations?.find(tr => tr.languageCode === "devanagari")?.content;
      if (devText) return devText;
      return verse.translations?.find(tr => tr.languageCode === "sa")?.content || "";
    };

    const nonIndicLangs = ["english", "en", "devanagari", "sa", "kannada", "kn", "telugu", "te", "tamil", "ta"];
    const showIast = effectiveLang && !nonIndicLangs.includes(effectiveLang);

    const getChapterIast = (verse: VerseWithTranslations): string | null => {
      const enTr = verse.translations?.find(tr => tr.languageCode === "english" || tr.languageCode === "en");
      if (!enTr) return null;
      const content = enTr.content.trim();
      if (!content.includes("||")) return null;
      const parts = content.split(/\n\n/);
      const iastParts = parts.filter(p => /\|\|/.test(p));
      return iastParts.length > 0 ? iastParts.join("\n") : null;
    };

    const showTranslation = true;
    const chapterTransLang = (effectiveLang && effectiveLang !== "devanagari" && effectiveLang !== "sa") ? effectiveLang : "en";

    const filteredChapterVerses = chapterViewKhanda != null && selectedKhandaInfo
      ? chapterVerses?.filter(v => selectedKhandaInfo.verses.some(sv => sv.verseNumber === v.verseNumber))
      : chapterVerses;

    const groupedByKhanda = chapterViewKhanda == null && chapterInfo && tocHierarchy.type === "three-level"
      ? chapterInfo.khandas.map(k => ({
          khandaNumber: k.khandaNumber,
          khandaTitle: k.khandaTitle,
          verseNumbers: k.verses.map(v => v.verseNumber),
        }))
      : null;

    const headerBadge = chapterViewKhanda != null
      ? `${t("part")} ${chapterViewAdhyay}.${chapterViewKhanda}`
      : `${t("chapter")} ${chapterViewAdhyay}`;
    const headerSubtitle = selectedKhandaInfo
      ? tc(selectedKhandaInfo.khandaTitle, sectionTitleTranslations)
      : chapterTitle;

    return (
      <div className="flex-1 flex flex-col min-w-0">
        {onExitChapterView && (
          <div className="border-b border-border/50 px-4 sm:px-8 py-1.5 shrink-0">
            <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitChapterView}
                className="gap-1.5 text-xs"
                data-testid="button-exit-chapter-view"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("singleVerse")}</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
            {isChapterLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-5 w-20 mx-auto" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-3/4 mx-auto" />
                  </div>
                ))}
              </div>
            ) : filteredChapterVerses && filteredChapterVerses.length > 0 ? (
              <div>
                {groupedByKhanda ? (
                  groupedByKhanda.map((khanda, kIdx) => {
                    const khandaVerses = filteredChapterVerses.filter(v => khanda.verseNumbers.includes(v.verseNumber));
                    if (khandaVerses.length === 0) return null;
                    return (
                      <div key={khanda.khandaNumber}>
                        {kIdx > 0 && (
                          <div className="my-8 sm:my-10 flex items-center gap-4">
                            <div className="h-px flex-1 bg-primary/20"></div>
                            <span className="text-primary/30 text-lg">✦</span>
                            <div className="h-px flex-1 bg-primary/20"></div>
                          </div>
                        )}
                        <div
                          className="text-center mb-6 sm:mb-8 cursor-pointer group"
                          onClick={() => onSelectPart?.(chapterViewAdhyay!, khanda.khandaNumber)}
                          data-testid={`chapter-view-khanda-${khanda.khandaNumber}`}
                        >
                          <span className="text-xs sm:text-sm font-serif text-primary/60 tracking-wider uppercase group-hover:text-primary transition-colors">
                            {t("part")} {chapterViewAdhyay}.{khanda.khandaNumber}
                          </span>
                          <h3 className="font-serif text-sm sm:text-base text-foreground/80 mt-1 group-hover:text-primary transition-colors">
                            {tc(khanda.khandaTitle, sectionTitleTranslations)}
                          </h3>
                        </div>
                        {khandaVerses.map((verse, idx) => {
                          const devanagari = getChapterDevanagari(verse);
                          const translation = showTranslation ? getChapterTranslation(verse, chapterTransLang) : "";
                          const iast = showIast ? getChapterIast(verse) : null;
                          const verseLabel = `${chapterViewAdhyay}.${khanda.khandaNumber}.${idx + 1}`;
                          return (
                            <div key={verse.id}>
                              <div
                                className="py-4 sm:py-6 text-center cursor-pointer group"
                                onClick={() => {
                                  const pageIdx = verses.findIndex(v => v.verseNumber === verse.verseNumber);
                                  if (pageIdx >= 0) {
                                    setCurrentPage(pageIdx);
                                    setShowCoverPage(false);
                                    hasNavigatedRef.current = true;
                                    onExitChapterView?.(verse.verseNumber);
                                  }
                                }}
                                data-testid={`chapter-verse-${verse.verseNumber}`}
                              >
                                {devanagari && (
                                  <div className="font-serif text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors whitespace-pre-line">
                                    {devanagari}
                                  </div>
                                )}
                                <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-serif">
                                  ॥ {verseLabel} ॥
                                </div>
                                {verse.sectionTitle && (
                                  <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-serif mt-1 italic">
                                    {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                                  </div>
                                )}
                                {iast && (
                                  <div className="mt-2 sm:mt-3 font-serif text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-primary/70 italic whitespace-pre-line">
                                    {iast}
                                  </div>
                                )}
                                {translation && (
                                  <div className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-muted-foreground">
                                    {translation}
                                  </div>
                                )}
                              </div>
                              {idx < khandaVerses.length - 1 && (
                                <div className="flex justify-center py-1">
                                  <div className="w-16 h-px bg-primary/15"></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  filteredChapterVerses.map((verse, idx) => {
                    const devanagari = getChapterDevanagari(verse);
                    const translation = showTranslation ? getChapterTranslation(verse, chapterTransLang) : "";
                    const iast = showIast ? getChapterIast(verse) : null;
                    const verseLabel = chapterViewKhanda != null
                      ? `${chapterViewAdhyay}.${chapterViewKhanda}.${idx + 1}`
                      : `${chapterViewAdhyay}.${idx + 1}`;
                    return (
                      <div key={verse.id}>
                        <div
                          className="py-4 sm:py-6 text-center cursor-pointer group"
                          onClick={() => {
                            const pageIdx = verses.findIndex(v => v.verseNumber === verse.verseNumber);
                            if (pageIdx >= 0) {
                              setCurrentPage(pageIdx);
                              setShowCoverPage(false);
                              hasNavigatedRef.current = true;
                              onExitChapterView?.(verse.verseNumber);
                            }
                          }}
                          data-testid={`chapter-verse-${verse.verseNumber}`}
                        >
                          {devanagari && (
                            <div className="font-serif text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors whitespace-pre-line">
                              {devanagari}
                            </div>
                          )}
                          <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-serif">
                            ॥ {verseLabel} ॥
                          </div>
                          {verse.sectionTitle && (
                            <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-serif mt-1 italic">
                              {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                            </div>
                          )}
                          {iast && (
                            <div className="mt-2 sm:mt-3 font-serif text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-primary/70 italic whitespace-pre-line">
                              {iast}
                            </div>
                          )}
                          {translation && (
                            <div className="mt-3 sm:mt-4 text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-muted-foreground">
                              {translation}
                            </div>
                          )}
                        </div>
                        {idx < filteredChapterVerses.length - 1 && (
                          <div className="flex justify-center py-1">
                            <div className="w-16 h-px bg-primary/15"></div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{t("noVersesInChapter")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentVerse) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">{t("noVersesAvailable")}</p>
        </div>
      </div>
    );
  }

  if (isCurrentVerseIntro && book) {
    const introSanskrit = introExplanations?.find(e => e.languageCode === "devanagari" || e.languageCode === "sa")?.content;
    const startReadingFromIntro = () => {
      if (tocHierarchy.groups.length > 0) {
        onSelectChapter?.(tocHierarchy.groups[0].adhyayNumber);
      } else {
        const firstNonIntroIdx = verses.findIndex(v => v.verseNumber !== 0 || v.sectionTitle?.toLowerCase().trim() !== "introduction");
        if (firstNonIntroIdx >= 0) {
          setCurrentPage(firstNonIntroIdx);
        }
      }
    };
    const introCommentaryContext = introSanskrit || "";
    return (
      <div className="flex-1 flex flex-col min-w-0 focus:outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="flex-1 overflow-y-auto">
          <div
            className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
            onMouseUp={handleTextSelect}
            onTouchEnd={handleTextSelect}
          >
            {selectionPopup && onAddNoteWithText && (
              <div
                className="fixed z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
                style={{ left: `${selectionPopup.x}px`, top: `${selectionPopup.y}px`, transform: "translate(-50%, -100%)" }}
                data-testid="selection-popup-intro"
              >
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs shadow-lg"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAddNoteFromSelection}
                  data-testid="button-annotate-selection-intro"
                >
                  <StickyNote className="h-3 w-3" />
                  Add Note
                </Button>
              </div>
            )}
            <div className="text-center mb-6 sm:mb-8">
              <Badge variant="secondary" className="mb-2 text-[10px] sm:text-xs">
                {tc(book.title, bookTitleTranslations)}
              </Badge>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight" data-testid="text-intro-title">
                {t("introduction")}
              </h1>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="h-px flex-1 max-w-[60px] bg-primary/20"></div>
                <span className="text-primary/30 text-sm">✦</span>
                <div className="h-px flex-1 max-w-[60px] bg-primary/20"></div>
              </div>
            </div>

            {commentaryOptions && commentaryOptions.languages.length > 1 && (
              <div className="flex items-center justify-end gap-2 mb-4" data-testid="intro-language-selector">
                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={effectiveLang || "english"}
                  onValueChange={(val) => setLocalLanguage(val)}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[70px] max-w-[120px] text-[11px] border-none bg-transparent shadow-none focus:ring-0 px-1" data-testid="select-intro-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commentaryOptions.languages.map((lang) => {
                      const normCode = lang.code === "hi" ? "hindi" : lang.code === "en" ? "english" : lang.code;
                      return (
                        <SelectItem key={normCode} value={normCode} data-testid={`option-intro-lang-${normCode}`}>
                          {lang.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {introSanskrit && effectiveLang !== "devanagari" && effectiveLang !== "sa" && (
              <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg bg-primary/5 border border-primary/10">
                <div className="font-serif text-sm sm:text-base leading-relaxed sm:leading-loose text-foreground/90" data-testid="text-intro-sanskrit">
                  <WordTooltip
                    content={introSanskrit}
                    commentaryContent={introCommentaryContext}
                    sourceLanguage="devanagari"
                    verseId={introVerse?.id || `${book.id}-intro`}
                    globalLanguage={lang}
                  />
                </div>
              </div>
            )}

            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none" data-testid="text-intro-content">
              {introTextForLang ? (
                <div className="font-serif text-sm sm:text-base leading-relaxed sm:leading-loose text-foreground/80">
                  <WordTooltip
                    content={introTextForLang}
                    commentaryContent={introCommentaryContext}
                    sourceLanguage={effectiveLang || "english"}
                    verseId={introVerse?.id || `${book.id}-intro`}
                    globalLanguage={lang}
                  />
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
            </div>

            <div className="mt-8 sm:mt-10 flex items-center justify-center">
              <Button
                className="gap-2"
                onClick={startReadingFromIntro}
                data-testid="button-start-reading-from-intro"
              >
                <BookOpen className="h-4 w-4" />
                {t("startReading")}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 px-4 sm:px-8 py-2 shrink-0">
          <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCoverPage(true)}
              className="gap-1.5 text-xs"
              data-testid="button-back-to-cover"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("tableOfContents")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={startReadingFromIntro}
              className="gap-1.5 text-xs"
              data-testid="button-continue-to-verses"
            >
              {t("startReading")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 focus:outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          {selectionPopup && onAddNoteWithText && (
            <div
              className="fixed z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
              style={{ left: `${selectionPopup.x}px`, top: `${selectionPopup.y}px`, transform: "translate(-50%, -100%)" }}
              data-testid="selection-popup"
            >
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs shadow-lg"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNoteFromSelection}
                data-testid="button-annotate-selection"
              >
                <StickyNote className="h-3 w-3" />
                Add Note
              </Button>
            </div>
          )}
          <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl w-full mx-auto">
            {isVerseLoading || !currentVerseDetails ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-32 mx-auto" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-3/4 mx-auto" />
              </div>
            ) : (
            <div 
              className="py-2"
              data-testid={`verse-${currentVerse.verseNumber}`}
              onMouseUp={handleTextSelect}
              onTouchEnd={handleTextSelect}
            >
              <div className="flex items-center justify-between gap-4 mb-4" data-testid="reader-book-header">
                <h1 className="font-serif text-xl sm:text-2xl text-primary/90 italic tracking-tight truncate" data-testid="reader-book-title">
                  {tc(book.title, bookTitleTranslations)}
                </h1>
                {commentaryOptions && commentaryOptions.languages.length > 0 && (
                  <div className="relative flex items-center gap-2 shrink-0" ref={langPanelRef} data-testid="book-language-selector">
                    <button
                      onClick={() => setShowLanguagePanel(prev => !prev)}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border/50 bg-card/50 hover:bg-card/80 rounded-md transition-colors"
                      data-testid="button-language-selector"
                    >
                      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground/80">{t("languages") || "Languages"}</span>
                      <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] no-default-hover-elevate no-default-active-elevate">{selectedLanguages.size}</Badge>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showLanguagePanel ? "rotate-180" : ""}`} />
                    </button>
                  {showLanguagePanel && (
                    <div className="absolute top-full right-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-2" data-testid="language-checkbox-panel">
                      {commentaryOptions.languages.map((lang) => {
                        const normCode = lang.code === "hi" ? "hindi" : lang.code === "en" ? "english" : lang.code;
                        const isDevanagari = normCode === "devanagari" || normCode === "sa";
                        const isChecked = isDevanagari || selectedLanguages.has(normCode);
                        return (
                          <button
                            key={normCode}
                            onClick={() => !isDevanagari && toggleLanguage(normCode)}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${isDevanagari ? "opacity-70 cursor-default" : "hover:bg-accent cursor-pointer"}`}
                            data-testid={`checkbox-lang-${normCode}`}
                          >
                            <div className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 ${isChecked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                              {isChecked && <Check className="h-3 w-3" />}
                            </div>
                            <span className="flex-1 text-left text-foreground/90">{lang.name}</span>
                            {isDevanagari && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 sm:p-6 mb-4" data-testid="verse-card">
                <div 
                  className="font-serif text-lg sm:text-xl leading-relaxed sm:leading-loose text-center"
                  data-testid={`text-original-${currentVerse.verseNumber}`}
                >
                  <WordTooltip
                    content={originalDevanagari}
                    commentaryContent={commentaryContext}
                    sourceLanguage="devanagari"
                    verseId={currentVerse.id}
                    globalLanguage={lang}
                  />
                </div>

                {verseTransliteration && (
                  <div
                    className="font-serif text-sm sm:text-base leading-relaxed sm:leading-loose text-center text-primary/60 dark:text-primary/50 italic whitespace-pre-line mt-3 pt-3 border-t border-primary/10"
                    data-testid={`text-transliteration-${currentVerse.verseNumber}`}
                  >
                    {verseTransliteration}
                  </div>
                )}
              </div>

              {availableTranslations.length > 0 && (
                <div className="mb-5" data-testid="meaning-section">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase tracking-widest font-bold text-primary">{t("meaning") || "MEANING"}</span>
                    <div className="h-px flex-1 bg-primary/15"></div>
                  </div>
                  {availableTranslations.map((translation: VerseTranslation, idx: number) => {
                    const MEANING_LANG_NAMES: Record<string, string> = {
                      english: "English", en: "English",
                      hindi: "हिन्दी", hi: "हिन्दी",
                      kannada: "ಕನ್ನಡ", kn: "ಕನ್ನಡ",
                      telugu: "తెలుగు", te: "తెలుగు",
                      tamil: "தமிழ்", ta: "தமிழ்",
                      malayalam: "മലയാളം", ml: "മലയാളം",
                      bengali: "বাংলা", bn: "বাংলা",
                      gujarati: "ગુજરાતી", gu: "ગુજરાતી",
                      marathi: "मराठी", mr: "मराठी",
                    };
                    const showLangLabel = selectedLanguages.size > 2 || (selectedLanguages.size === 2 && !selectedLanguages.has("english"));
                    return (
                      <div key={translation.id} className={idx > 0 ? "mt-3 pt-3 border-t border-border/20" : ""}>
                        {showLangLabel && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/60 mb-1 block">
                            {MEANING_LANG_NAMES[translation.languageCode] || translation.languageCode}
                          </span>
                        )}
                        <div 
                          className="text-sm sm:text-base leading-relaxed text-foreground/80 font-serif"
                          data-testid={`text-translation-${translation.languageCode}-${currentVerse.verseNumber}`}
                        >
                          <WordTooltip
                            content={translation.content}
                            commentaryContent={commentaryContext}
                            sourceLanguage={translation.languageCode}
                            verseId={currentVerse.id}
                            globalLanguage={lang}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasCommentaryOptions && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2" data-testid="bhashya-tabs-row">
                    {bhashyaAuthors.map((author) => (
                      <button
                        key={author.authorName}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                          selectedBhashyaAuthor === author.authorName
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
                        }`}
                        onClick={() => {
                          setSelectedBhashyaAuthor(author.authorName);
                          handleAuthorChange(author.authorName);
                          setCommentaryMode("bhashyam");
                          setCommentaryExpanded(true);
                        }}
                        data-testid={`tab-bhashya-${author.authorName.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        {tc(author.authorName, bookAuthorTranslations)}
                      </button>
                    ))}

                    {teekaAuthors.length > 0 && (
                      <button
                        className={`ml-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                          showTeekas
                            ? "bg-primary/15 border border-primary/30 text-primary"
                            : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
                        }`}
                        onClick={() => setShowTeekas(!showTeekas)}
                        data-testid="button-toggle-teekas"
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        {showTeekas ? t("hideTeekas") || "Hide Tīkās" : t("readTeekas") || "Read Tīkās"}
                      </button>
                    )}
                  </div>

                  <div className={`grid gap-4 ${showTeekas && teekaAuthors.length > 0 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                    <div className="rounded-xl border border-border/60 bg-card/80 dark:bg-card/50 overflow-hidden shadow-sm" data-testid="bhashya-content-card">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                        <Feather className="h-3.5 w-3.5 text-primary/70" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                          {selectedBhashyaAuthor 
                            ? `${tc(selectedBhashyaAuthor, bookAuthorTranslations)}`
                            : t("bhashyam")}
                        </span>
                      </div>
                      <div className="p-4">
                        {commentaryExpanded && effectiveLang && (
                          <VerseExplanation 
                            verseId={currentVerse.id} 
                            languageCode={effectiveLang}
                            languageCodes={Array.from(selectedLanguages)}
                            authorName={selectedBhashyaAuthor}
                            showAll={false}
                            filterFn={(e: any) => e.commentaryType ? e.commentaryType === "bhashya" : isBhashyaAuthorByName(e.authorName)}
                            mode="bhashyam"
                          />
                        )}
                      </div>
                    </div>

                    {showTeekas && teekaAuthors.length > 0 && (
                      <div className="rounded-xl border border-border/60 bg-card/80 dark:bg-card/50 overflow-hidden shadow-sm" data-testid="teeka-content-card">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
                          <div className="flex items-center gap-2">
                            <ScrollText className="h-3.5 w-3.5 text-primary/70" />
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                              {t("teeka")}
                            </span>
                          </div>
                          {teekaAuthors.length > 1 && (
                            <Select
                              value={selectedTeekaAuthor || teekaAuthors[0]?.authorName || ""}
                              onValueChange={setSelectedTeekaAuthor}
                            >
                              <SelectTrigger className="h-7 w-auto min-w-[120px] max-w-[200px] text-[11px] border border-border/50 bg-background/60 shadow-none focus:ring-1 focus:ring-primary/30 px-2 rounded-md" data-testid="select-teeka-author">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {teekaAuthors.map((author) => (
                                  <SelectItem key={author.authorName} value={author.authorName} data-testid={`option-teeka-${author.authorName.replace(/\s+/g, '-').toLowerCase()}`}>
                                    {tc(author.authorName, bookAuthorTranslations)}
                                    {author.authorTitle && (
                                      <span className="text-muted-foreground ml-1">— {author.authorTitle}</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {teekaAuthors.length === 1 && (
                            <span className="text-[11px] text-muted-foreground">
                              {tc(teekaAuthors[0].authorName, bookAuthorTranslations)}
                              {teekaAuthors[0].authorTitle && ` — ${teekaAuthors[0].authorTitle}`}
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          {effectiveLang && (
                            <VerseExplanation 
                              verseId={currentVerse.id} 
                              languageCode={effectiveLang}
                              languageCodes={Array.from(selectedLanguages)}
                              authorName={selectedTeekaAuthor}
                              showAll={false}
                              filterFn={(e: any) => e.commentaryType ? e.commentaryType === "teeka" : isTeekaAuthorByName(e.authorName)}
                              mode="teeka"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 px-4 sm:px-8 py-2 sm:py-3">
          <div className="max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="gap-1"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("previous")}</span>
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="gap-1"
              data-testid="button-next-page"
            >
              <span className="hidden sm:inline">{t("next")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {book?.slug && bookMediaConfig[book.slug]?.videoId && (
          <div className="border-t border-border px-3 sm:px-8 py-2 bg-background/80">
            <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex items-center justify-center">
              <VideoPopup 
                videoId={bookMediaConfig[book.slug].videoId!}
                title={bookMediaConfig[book.slug].videoTitle || t("introductionVideo")}
                buttonLabel={t("watchVideo")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
