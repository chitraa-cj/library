import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, User, MessageSquareText, StickyNote, List, Globe, Languages, Sparkles, Feather, ScrollText, Check, Lock, Copy, Share2, Bookmark, Volume2, VolumeX, ArrowLeftRight, Sun, Maximize2, Minimize2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPopup } from "@/components/video-popup";
import { WordTooltip } from "@/components/word-tooltip";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { useTranslation } from "@/lib/translations";
import { useAuth } from "@/hooks/use-auth";
import { useBookProgress, useMarkVerseComplete, useUnmarkVerseComplete } from "@/hooks/use-progress";
import { useToast } from "@/hooks/use-toast";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations, chapterTitleTranslations, sectionTitleTranslations, verseSectionTitleTranslations } from "@/lib/content-translations";
import type { BookWithVerseMeta, VerseMeta, VerseTranslation, Explanation, VerseWithTranslations } from "@shared/schema";
import { NotesDialog } from "@/components/notes-dialog";
import { isBookmarked, toggleBookmark, subscribeBookmarks, type BookmarkEntry } from "@/lib/bookmarks";
import shankaracharyaImg from "@assets/image_1770455528511.png";
import shishyasImg from "@assets/shishyas.png";
import mantraMandalaImg from "@assets/mantra-mandala.png";
import readerIllustration from "@assets/reader-shankaracharya-standing.jpg";

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

function explanationMatchesLanguages(e: Explanation, languageCodes: string[]): boolean {
  return languageCodes.some((l) => langMatches(e.languageCode, l));
}

/** Authors present on a specific verse (not the whole book). */
function getVerseCommentaryAuthors(
  explanations: Explanation[] | undefined,
  filterFn: (e: Explanation) => boolean,
  languageCodes: string[],
  bookAuthors: CommentaryOption[],
): CommentaryOption[] {
  if (!explanations?.length) return [];

  const seen = new Set<string>();
  const onVerse: CommentaryOption[] = [];

  for (const e of explanations) {
    if (!filterFn(e) || !explanationMatchesLanguages(e, languageCodes) || seen.has(e.authorName)) {
      continue;
    }
    seen.add(e.authorName);
    const meta = bookAuthors.find((a) => a.authorName === e.authorName);
    onVerse.push({
      authorName: e.authorName,
      authorTitle: e.authorTitle ?? meta?.authorTitle ?? null,
      languageCodes: meta?.languageCodes ?? [e.languageCode],
      commentaryType: (e as Explanation & { commentaryType?: "bhashya" | "teeka" }).commentaryType ?? meta?.commentaryType,
    });
  }

  const order = new Map(bookAuthors.map((a, i) => [a.authorName, i]));
  onVerse.sort((a, b) => (order.get(a.authorName) ?? 999) - (order.get(b.authorName) ?? 999));
  return onVerse;
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

/** Collapse accidental consecutive duplicate words in CMS titles, e.g. "Mantra Mantra 3.5" -> "Mantra 3.5". */
function dedupeTitleWords(title: string): string {
  return title.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
}

// Verse-unit synonyms (all mean "verse/stanza"). The CMS occasionally stores a
// section title with two of these stacked — e.g. "Mantra Shloka 1.6" — which reads
// as a duplicate. Keep the trailing one (it carries the number) and drop a leading
// synonym only when it's immediately followed by another synonym.
const VERSE_UNIT_SYNONYMS = "mantra|mantram|shloka|sloka|śloka|shlokam|slokam|sutra|sūtra|sutram|karika|kārikā|kaarika|verse|richa|richā|padya";
function collapseVerseUnitSynonyms(title: string): string {
  const re = new RegExp(`^\\s*(?:${VERSE_UNIT_SYNONYMS})\\s+(?=(?:${VERSE_UNIT_SYNONYMS})\\b)`, "i");
  let out = title;
  // Loop in case three or more are stacked (e.g. "Mantra Shloka Karika 1.6").
  while (re.test(out)) out = out.replace(re, "");
  return out;
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

/** Fixed ~one-screen commentary panels; content scrolls inside the box. */
const COMMENTARY_PANEL_SHELL_CLASS =
  "flex flex-col h-[calc(100dvh-11rem)] min-h-[20rem] max-h-[calc(100dvh-11rem)] overflow-hidden rounded-xl border border-border/60 bg-card/80 dark:bg-card/50 shadow-sm";
const COMMENTARY_PANEL_BODY_CLASS =
  "flex-1 min-h-0 overflow-y-auto overscroll-contain p-4";

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
  // Incrementing counter that asks the reader to open its cover / table-of-contents
  // view (used by the sidebar book-title button). Ignored on its initial value.
  showCoverSignal?: number;
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80 font-body" data-testid="text-english-translation">
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
  mode,
  hideAuthorHeading = false
}: {
  verseId: string;
  languageCode: string;
  languageCodes?: string[];
  authorName: string | null;
  showAll: boolean;
  filterFn?: (explanation: any) => boolean;
  mode?: "bhashyam" | "teeka";
  hideAuthorHeading?: boolean;
}) {
  const { t, locale } = useTranslation(languageCode);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, locale);
  const [showMoreCommentaries, setShowMoreCommentaries] = useState(false);
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
    ...cmsContentQueryOptions,
  });

  const effectiveLanguages = languageCodes && languageCodes.length > 0 ? languageCodes : [languageCode];

  useEffect(() => {
    setShowMoreCommentaries(false);
  }, [verseId, authorName]);

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  let allForLanguages = explanations?.filter(e => effectiveLanguages.some(l => langMatches(e.languageCode, l))) || [];
  if (filterFn) {
    allForLanguages = allForLanguages.filter(e => filterFn(e));
  }

  const primaryExplanations = showAll
    ? allForLanguages
    : authorName
      ? allForLanguages.filter((e) => e.authorName === authorName)
      : allForLanguages;

  const otherExplanations =
    !showAll && authorName && primaryExplanations.length > 0
      ? allForLanguages.filter((e) => e.authorName !== authorName)
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

  const renderGroup = (group: { authorName: string; authorTitle: string | null; items: Explanation[] }, gIdx: number, hideHeader = false) => {
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
        {!hideHeader && (
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
        )}
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
              <div className="font-body text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90 pl-6" data-testid={`commentary-text-${explanation.languageCode}-${idx}`}>
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
      {Object.values(primaryGrouped).map((group, gIdx) => renderGroup(group, gIdx, hideAuthorHeading))}

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

/** Strip HTML tags / collapse whitespace so text can be read aloud, copied, or shared cleanly. */
function toPlainText(s: string | null | undefined): string {
  return (s || "").replace(/<[^>]*>/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Mandala image used to decorate the mantra card corners. */
function MandalaCorner({ className }: { className?: string }) {
  return (
    <img src={mantraMandalaImg} alt="" aria-hidden="true" className={className} draggable={false} />
  );
}

/** Small circular icon button used across the mantra/commentary toolbars. */
function IconAction({ icon: Icon, label, onClick, active = false, className = "" }: {
  icon: typeof Copy;
  label: string;
  onClick?: (e: ReactMouseEvent) => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <HintTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/70 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"} ${className}`}
      >
        <Icon className="h-4 w-4" />
      </button>
    </HintTooltip>
  );
}

/** Reads the given text aloud via the Web Speech API (no backend needed). */
function ListenButton({ text, hint, stopHint }: { text: string; hint?: string; stopHint?: string }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* noop */ } }, []);
  const toggle = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const plain = toPlainText(text);
    if (!plain) return;
    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = "hi-IN";
    utter.rate = 0.82;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utter);
    setSpeaking(true);
  };
  return (
    <HintTooltip label={speaking ? stopHint : hint}>
      <button
        type="button"
        onClick={toggle}
        aria-label={speaking ? "Stop" : "Listen"}
        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors"
        data-testid="button-listen"
      >
        {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {speaking ? "Stop" : "Listen"}
      </button>
    </HintTooltip>
  );
}

/** Bookmark toggle persisted in localStorage (no auth required). */
function BookmarkButton({ verseId, entry, variant = "plain", hint, removeHint }: { verseId: string; entry?: Omit<BookmarkEntry, "verseId">; variant?: "plain" | "action"; hint?: string; removeHint?: string }) {
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    setMarked(isBookmarked(verseId));
    return subscribeBookmarks(() => setMarked(isBookmarked(verseId)));
  }, [verseId]);
  const toggle = (e?: ReactMouseEvent) => {
    e?.stopPropagation();
    setMarked(toggleBookmark({ verseId, ...entry }));
  };
  const tip = marked ? removeHint : hint;
  if (variant === "action") {
    return (
      <HintTooltip label={tip}>
        <button
          type="button"
          aria-label="Bookmark"
          onClick={toggle}
          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${marked ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/70 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"}`}
          data-testid="button-bookmark"
        >
          <Bookmark className={`h-4 w-4 ${marked ? "fill-current" : ""}`} />
        </button>
      </HintTooltip>
    );
  }
  return (
    <HintTooltip label={tip}>
      <button type="button" onClick={toggle} aria-label="Bookmark" className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors" data-testid="button-bookmark">
        <Bookmark className={`h-3.5 w-3.5 ${marked ? "fill-primary text-primary" : ""}`} />
      </button>
    </HintTooltip>
  );
}

/** Multi-language checkbox popover (Devanagari always on). Reused for the header + commentary. */
function LanguagePopover({ languages, selected, onToggle, label, align = "right", hint }: {
  languages: { code: string; name: string }[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  label: string;
  align?: "left" | "right";
  hint?: string;
}) {
  const PANEL_WIDTH = 240; // matches w-60
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposition = useCallback(() => {
    const btn = ref.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 8;
    // Anchor to the button, then clamp fully into the viewport so no ancestor
    // overflow can clip the panel (the reader scroll area is overflow-x-hidden).
    let left = align === "right" ? r.right - PANEL_WIDTH : r.left;
    const maxLeft = window.innerWidth - PANEL_WIDTH - margin;
    left = Math.max(margin, Math.min(left, maxLeft));
    setPos({ top: r.bottom + 6, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <HintTooltip label={hint}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 h-9 px-3 text-xs sm:text-sm border border-border/60 bg-card hover:bg-accent/50 rounded-lg transition-colors"
          data-testid="button-language-selector"
        >
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground/80">{label}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </HintTooltip>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 w-60 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-2"
          style={{ top: pos.top, left: pos.left }}
          data-testid="language-checkbox-panel"
        >
          {languages.map((l) => {
            const norm = l.code === "hi" ? "hindi" : l.code === "en" ? "english" : l.code;
            const isDeva = norm === "devanagari" || norm === "sa";
            const checked = isDeva || selected.has(norm);
            return (
              <button
                key={norm}
                type="button"
                onClick={() => !isDeva && onToggle(norm)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${isDeva ? "opacity-70 cursor-default" : "hover:bg-accent cursor-pointer"}`}
              >
                <span className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-left text-foreground/90">{l.name}</span>
                {isDeva && <Lock className="h-3 w-3 text-muted-foreground" />}
              </button>
            );
          })}
        </div>,
        document.body
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
  showCoverSignal,
}: BookReaderProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { data: bookProgress } = useBookProgress(bookId);
  const markCompleteMutation = useMarkVerseComplete();
  const unmarkCompleteMutation = useUnmarkVerseComplete();
  const completedSet = useMemo(() => new Set(bookProgress?.completedVerseIds || []), [bookProgress]);
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
  const consumedNavigateRef = useRef<number | null>(null);
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const [commentaryMode, setCommentaryMode] = useState<"bhashyam" | "teeka">("bhashyam");
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  // Notes modal: replaces the old right-hand notes sidebar.
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDialogView, setNotesDialogView] = useState<"list" | "add">("list");
  const [notesPendingText, setNotesPendingText] = useState<string | null>(null);
  const [showCoverPage, setShowCoverPage] = useState(false);
  const [expandedTOCAdhyays, setExpandedTOCAdhyays] = useState<Set<number>>(new Set());
  const [expandedTOCKhandas, setExpandedTOCKhandas] = useState<Set<string>>(new Set());
  const [showTeekas, setShowTeekas] = useState(false);
  const commentaryRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    const el = commentaryRef.current;
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  // In fullscreen, let the bhāṣya/ṭīkā panels grow to fill the viewport instead of the fixed 480px.
  const commentaryPanelHeight = isFullscreen ? "h-[calc(100vh-9rem)]" : "h-[480px]";
  const [selectedBhashyaAuthor, setSelectedBhashyaAuthor] = useState<string | null>(null);
  const [selectedTeekaAuthor, setSelectedTeekaAuthor] = useState<string | null>(null);
  // Remember the user's explicitly chosen commentary author across page/verse changes.
  // The selection state above can momentarily reset while a new verse's commentaries
  // load, so these refs preserve the preference and let us restore it when available.
  const preferredBhashyaAuthorRef = useRef<string | null>(null);
  const preferredTeekaAuthorRef = useRef<string | null>(null);

  const handleSelectTeekaAuthor = useCallback((authorName: string) => {
    preferredTeekaAuthorRef.current = authorName;
    setSelectedTeekaAuthor(authorName);
  }, []);

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

  const openNotesDialog = useCallback((view: "list" | "add", text: string | null = null) => {
    setNotesPendingText(text);
    setNotesDialogView(view);
    setNotesDialogOpen(true);
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
    openNotesDialog("add", selectionPopup.text);
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  }, [selectionPopup, isAuthenticated, toast, t, openNotesDialog]);

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
    ...cmsContentQueryOptions,
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
    ...cmsContentQueryOptions,
  });

  const verses = useMemo(
    () =>
      (book?.verses || []).map((v) =>
        v.sectionTitle ? { ...v, sectionTitle: collapseVerseUnitSynonyms(dedupeTitleWords(v.sectionTitle)) } : v
      ),
    [book]
  );
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
    ...cmsContentQueryOptions,
  });

  const { data: currentVerseDetails, isLoading: isVerseLoading } = useQuery<VerseWithTranslations>({
    queryKey: ["/api/verses", currentVerseMeta?.id],
    enabled: !!currentVerseMeta?.id && chapterViewAdhyay == null,
    ...cmsContentQueryOptions,
  });

  const { data: currentVerseExplanations } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", currentVerseMeta?.id, "explanations"],
    enabled: !!currentVerseMeta?.id && chapterViewAdhyay == null,
    ...cmsContentQueryOptions,
  });

  const { data: chapterVerses, isLoading: isChapterLoading } = useQuery<VerseWithTranslations[]>({
    queryKey: ["/api/books", bookId, "chapter", chapterViewAdhyay, "verses"],
    enabled: chapterViewAdhyay != null,
    ...cmsContentQueryOptions,
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
    if (!currentVerse || currentVerse.adhyayNumber == null) {
      return null;
    }
    if (currentVerse.khandaNumber != null) {
      // Three-level (adhyaya → khanda → mantra), e.g. Chandogya "1.2.3".
      const khandaVerses = verses
        .filter((v: VerseMeta) => v.adhyayNumber === currentVerse.adhyayNumber && v.khandaNumber === currentVerse.khandaNumber)
        .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
      const idx = khandaVerses.findIndex((v: VerseMeta) => v.id === currentVerse.id);
      return `${currentVerse.adhyayNumber}.${currentVerse.khandaNumber}.${idx >= 0 ? idx + 1 : 1}`;
    }
    // Two-level (adhyaya → mantra), e.g. Bhagavad Gita "2.18": show the mantra's
    // position within its chapter, not its absolute number across the whole book.
    const adhyayVerses = verses
      .filter((v: VerseMeta) => v.adhyayNumber === currentVerse.adhyayNumber)
      .sort((a: VerseMeta, b: VerseMeta) => a.verseNumber - b.verseNumber);
    const idx = adhyayVerses.findIndex((v: VerseMeta) => v.id === currentVerse.id);
    return `${currentVerse.adhyayNumber}.${idx >= 0 ? idx + 1 : 1}`;
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
    consumedNavigateRef.current = null;
    setExpandedTOCAdhyays(new Set());
    setExpandedTOCKhandas(new Set());
    setLocalLanguage(selectedCommentaryLanguage);
  }, [bookId]);

  // The sidebar book-title button asks for the cover / table-of-contents view by
  // bumping this counter. Skip the initial mount so we don't hijack the first render.
  const coverSignalRef = useRef(showCoverSignal);
  useEffect(() => {
    if (showCoverSignal === undefined || showCoverSignal === coverSignalRef.current) return;
    coverSignalRef.current = showCoverSignal;
    setShowCoverPage(true);
  }, [showCoverSignal]);

  useLayoutEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && verses.length > 0) {
      const pageIndex = verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0) {
        setCurrentPage(pageIndex);
        setShowCoverPage(false);
        hasNavigatedRef.current = true;
      }
    } else if (verses.length > 0 && !hasNavigatedRef.current) {
      // Opening the text fresh: land on the Sambandha Bhāṣyam (intro) when present,
      // otherwise fall back to the first non-intro verse.
      const introIdx = verses.findIndex(v => v.verseNumber === 0 && isIntroSection(v.sectionTitle));
      const firstNonIntro = verses.findIndex(v => v.verseNumber !== 0 || !isIntroSection(v.sectionTitle));
      const startIdx = introIdx >= 0 ? introIdx : firstNonIntro;
      setCurrentPage(startIdx >= 0 ? startIdx : 0);
      hasNavigatedRef.current = true;
    }
  }, [chapterViewAdhyay, navigateToVerse, verses]);

  useEffect(() => {
    if (!onVerseChange || !currentVerse || showCoverPage || isCurrentVerseIntro) return;
    // While a navigation request is still settling on its target, suppress stale
    // reports from the in-between page. Once the target page is reached we mark it
    // consumed, so subsequent manual Next/Prev (which move off the target) report
    // normally and the side nav stays in sync.
    const navPending =
      navigateToVerse !== null &&
      navigateToVerse !== undefined &&
      consumedNavigateRef.current !== navigateToVerse &&
      currentVerse.verseNumber !== navigateToVerse;
    if (navPending) {
      return;
    }
    if (navigateToVerse !== null && navigateToVerse !== undefined && currentVerse.verseNumber === navigateToVerse) {
      consumedNavigateRef.current = navigateToVerse;
    }
    onVerseChange(currentVerse.verseNumber);
  }, [currentPage, currentVerse, onVerseChange, showCoverPage, isCurrentVerseIntro, navigateToVerse]);

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

  const commentaryLanguageCodes = useMemo(() => {
    const codes = Array.from(selectedLanguages);
    if (effectiveLang && !codes.includes(effectiveLang)) {
      codes.push(effectiveLang);
    }
    return codes.length > 0 ? codes : ["devanagari"];
  }, [selectedLanguages, effectiveLang]);

  const teekaFilterFn = useCallback(
    (e: Explanation) =>
      (e as Explanation & { commentaryType?: "bhashya" | "teeka" }).commentaryType
        ? (e as Explanation & { commentaryType?: "bhashya" | "teeka" }).commentaryType === "teeka"
        : isTeekaAuthorByName(e.authorName),
    [],
  );

  const bhashyaFilterFn = useCallback(
    (e: Explanation) =>
      (e as Explanation & { commentaryType?: "bhashya" | "teeka" }).commentaryType
        ? (e as Explanation & { commentaryType?: "bhashya" | "teeka" }).commentaryType === "bhashya"
        : isBhashyaAuthorByName(e.authorName),
    [],
  );

  const verseTeekaAuthors = useMemo(
    () => getVerseCommentaryAuthors(currentVerseExplanations, teekaFilterFn, commentaryLanguageCodes, teekaAuthors),
    [currentVerseExplanations, teekaFilterFn, commentaryLanguageCodes, teekaAuthors],
  );

  const verseBhashyaAuthors = useMemo(
    () => getVerseCommentaryAuthors(currentVerseExplanations, bhashyaFilterFn, commentaryLanguageCodes, bhashyaAuthors),
    [currentVerseExplanations, bhashyaFilterFn, commentaryLanguageCodes, bhashyaAuthors],
  );

  useEffect(() => {
    if (verseBhashyaAuthors.length === 0) return;
    if (!selectedBhashyaAuthor || !verseBhashyaAuthors.some((a) => a.authorName === selectedBhashyaAuthor)) {
      const preferred = preferredBhashyaAuthorRef.current;
      const next = preferred && verseBhashyaAuthors.some((a) => a.authorName === preferred)
        ? preferred
        : verseBhashyaAuthors[0].authorName;
      setSelectedBhashyaAuthor(next);
    }
  }, [currentVerseMeta?.id, verseBhashyaAuthors, selectedBhashyaAuthor]);

  useEffect(() => {
    if (verseTeekaAuthors.length === 0) {
      setSelectedTeekaAuthor(null);
      return;
    }
    if (!selectedTeekaAuthor || !verseTeekaAuthors.some((a) => a.authorName === selectedTeekaAuthor)) {
      const preferred = preferredTeekaAuthorRef.current;
      const next = preferred && verseTeekaAuthors.some((a) => a.authorName === preferred)
        ? preferred
        : verseTeekaAuthors[0].authorName;
      setSelectedTeekaAuthor(next);
    }
  }, [currentVerseMeta?.id, verseTeekaAuthors, selectedTeekaAuthor]);

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

  const currentVerseIsCompleted = currentVerse ? completedSet.has(currentVerse.id) : false;
  const completedCount = completedSet.size;
  const verseTotal = verses.length || 0;
  const completedPct = verseTotal > 0 ? Math.round((completedCount / verseTotal) * 100) : 0;
  const progressAuthed = isAuthenticated;

  const handleMarkCompleteAndNext = async () => {
    if (!progressAuthed) {
      toast({ title: t("signInRequired" as any) || "Sign in required", description: t("signInToTrackProgress" as any) || "Please sign in to track your reading progress.", variant: "destructive" });
      return;
    }
    if (!book?.id || !currentVerse?.id) return;
    try {
      if (!currentVerseIsCompleted) {
        await markCompleteMutation.mutateAsync({ bookId: book.id, verseId: currentVerse.id });
      }
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to mark complete", variant: "destructive" });
    }
  };

  const handleToggleComplete = async () => {
    if (!progressAuthed) {
      toast({ title: t("signInRequired" as any) || "Sign in required", description: t("signInToTrackProgress" as any) || "Please sign in to track your reading progress.", variant: "destructive" });
      return;
    }
    if (!book?.id || !currentVerse?.id) return;
    try {
      if (currentVerseIsCompleted) {
        await unmarkCompleteMutation.mutateAsync({ bookId: book.id, verseId: currentVerse.id });
      } else {
        await markCompleteMutation.mutateAsync({ bookId: book.id, verseId: currentVerse.id });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update progress", variant: "destructive" });
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden focus:outline-none">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <div className="p-4 sm:p-6 max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto">
            <div className="py-4 sm:py-6">
              <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
                <span className="text-2xl sm:text-3xl text-primary/20 font-body mb-2 select-none pointer-events-none">ॐ</span>
                <h1 className="font-page-heading text-xl sm:text-2xl font-bold text-foreground tracking-tight" data-testid="text-cover-title">
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
      const devText = verse.translations?.find(tr => tr.languageCode === "devanagari")?.content
        || verse.translations?.find(tr => tr.languageCode === "sa")?.content;
      if (devText) return devText;
      // Fall back to the verse-meta preview (the full mantra text) so the chapter
      // view still renders when the full-text query is slow/unavailable.
      return (verse as VerseWithTranslations & { preview?: string }).preview || "";
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

    // Drive the chapter/part verse list from the always-available cached verse
    // meta (loaded with the book) rather than the separate /chapter/verses query,
    // which is slow and occasionally fails for large CMS-backed books — leaving
    // every adhyaya AND khanda view empty and indistinguishable. The query result
    // (when present) only enriches each mantra with its full text / translations.
    const chapterFullByNum = new Map<number, VerseWithTranslations>(
      (chapterVerses || []).map(v => [v.verseNumber, v])
    );
    const metaInAdhyay = verses.filter(v => v.adhyayNumber === chapterViewAdhyay);
    const metaInScope = chapterViewKhanda != null
      ? metaInAdhyay.filter(v => v.khandaNumber === chapterViewKhanda)
      : metaInAdhyay;
    const filteredChapterVerses: VerseWithTranslations[] = metaInScope.map(m => {
      const full = chapterFullByNum.get(m.verseNumber);
      return full
        ? { ...m, ...full }
        : ({ ...m, translations: [], explanations: [] } as unknown as VerseWithTranslations);
    });

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
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

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
            {isChapterLoading && filteredChapterVerses.length === 0 ? (
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
                          <span className="text-xs sm:text-sm font-body text-primary/60 tracking-wider uppercase group-hover:text-primary transition-colors">
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
                                  <div className="font-hindi-reading text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors whitespace-pre-line">
                                    {devanagari}
                                  </div>
                                )}
                                <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-body">
                                  ॥ {verseLabel} ॥
                                </div>
                                {verse.sectionTitle && (
                                  <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-body mt-1 italic">
                                    {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                                  </div>
                                )}
                                {iast && (
                                  <div className="mt-2 sm:mt-3 font-body text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-primary/70 italic whitespace-pre-line">
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
                            <div className="font-hindi-reading text-base sm:text-xl leading-loose sm:leading-loose text-center px-2 sm:px-8 group-hover:text-primary transition-colors whitespace-pre-line">
                              {devanagari}
                            </div>
                          )}
                          <div className="mt-2 sm:mt-3 text-primary/50 text-xs sm:text-sm font-body">
                            ॥ {verseLabel} ॥
                          </div>
                          {verse.sectionTitle && (
                            <div className="text-[11px] sm:text-xs text-muted-foreground/60 font-body mt-1 italic">
                              {tc(verse.sectionTitle, verseSectionTitleTranslations)}
                            </div>
                          )}
                          {iast && (
                            <div className="mt-2 sm:mt-3 font-body text-xs sm:text-sm leading-relaxed text-center px-4 sm:px-12 text-primary/70 italic whitespace-pre-line">
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden focus:outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
        <NotesDialog
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          verseId={currentVerse?.id ?? null}
          verseReference={`${tc(book.title, bookTitleTranslations)} ${currentNumericLabel || ""}`.trim()}
          verseLabel={currentNumericLabel || ""}
          initialView={notesDialogView}
          initialSelectedText={notesPendingText}
          languageCode={selectedCommentaryLanguage}
        />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <div
            className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10"
            onMouseUp={handleTextSelect}
            onTouchEnd={handleTextSelect}
          >
            {selectionPopup && (
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
              <h1 className="font-page-heading text-xl sm:text-2xl font-bold text-foreground tracking-tight" data-testid="text-intro-title">
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
                <div className="font-body text-sm sm:text-base leading-relaxed sm:leading-loose text-foreground/90" data-testid="text-intro-sanskrit">
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
                <div className="font-body text-sm sm:text-base leading-relaxed sm:leading-loose text-foreground/80">
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

  const mantraLabel = currentNumericLabel || (currentVerse ? String(currentVerse.verseNumber) : "");
  const bookmarkEntry: Omit<BookmarkEntry, "verseId"> | undefined = book && currentVerse ? {
    bookId: book.id,
    bookSlug: book.slug,
    bookTitle: tc(book.title, bookTitleTranslations),
    verseLabel: mantraLabel,
    verseNumber: currentVerse.verseNumber,
  } : undefined;
  const mantraPlain = toPlainText(originalDevanagari);
  const shareTitle = `${tc(book.title, bookTitleTranslations)} — ${t("mantra") || "Mantra"} ${mantraLabel}`;
  const shareBody = [
    mantraPlain,
    verseTransliteration ? toPlainText(verseTransliteration) : "",
    availableTranslations[0]?.content ? toPlainText(availableTranslations[0].content) : "",
  ].filter(Boolean).join("\n\n");
  const copyMantra = async () => {
    try { await navigator.clipboard.writeText(`${shareTitle}\n\n${shareBody}`); toast({ title: "Copied to clipboard" }); }
    catch { /* clipboard unavailable */ }
  };
  const shareMantra = async () => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: shareTitle, text: shareBody });
      } else {
        await navigator.clipboard.writeText(`${shareTitle}\n\n${shareBody}`);
        toast({ title: "Copied to clipboard" });
      }
    } catch { /* share dismissed */ }
  };
  const teekaAvailable = verseTeekaAuthors.length > 0;
  const activeCommentaryMode = commentaryMode === "teeka" && teekaAvailable ? "teeka" : "bhashyam";
  const commentaryLanguageList = commentaryOptions?.languages ?? [];
  // The illustration showcase layout is reserved for Independent Advaita Works (Prakarana Grantha) only.
  const isIndependentAdvaitaWork = (book?.category || "").trim().toLowerCase() === "prakarana grantha";

  return (
    <div
      className="grid grid-rows-[minmax(0,1fr)_auto] h-full min-h-0 flex-1 min-w-0 overflow-hidden focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <NotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        verseId={currentVerse?.id ?? null}
        verseReference={`${tc(book.title, bookTitleTranslations)} ${mantraLabel}`.trim()}
        verseLabel={mantraLabel}
        initialView={notesDialogView}
        initialSelectedText={notesPendingText}
        languageCode={selectedCommentaryLanguage}
      />
      <div
        className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        data-testid="reader-scroll-area"
      >
        <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 pb-6">
          {selectionPopup && (
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
          <div className="max-w-6xl xl:max-w-none w-full mx-auto">
            {isVerseLoading || !currentVerseDetails ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-32 mx-auto" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-3/4 mx-auto" />
              </div>
            ) : (
            <div
              className="py-1 space-y-3"
              data-testid={`verse-${currentVerse.verseNumber}`}
              onMouseUp={handleTextSelect}
              onTouchEnd={handleTextSelect}
            >
              <div className="shrink-0 space-y-4">
                {/* Decorative header with Shankaracharya portraits */}
                <div className="flex items-center justify-center gap-3 sm:gap-6" data-testid="reader-book-header">
                  <img src={shankaracharyaImg} alt="" className="hidden sm:block h-16 lg:h-20 w-auto object-contain shrink-0 opacity-90" aria-hidden="true" />
                  <div className="text-center min-w-0">
                    <div className="flex items-center justify-center gap-2.5">
                      <span className="text-primary/40 text-sm hidden sm:inline">❖</span>
                      <h1 className="font-page-heading text-2xl sm:text-3xl lg:text-[2rem] font-bold text-primary tracking-tight leading-none truncate" data-testid="reader-book-title">
                        {tc(book.title, bookTitleTranslations)}
                      </h1>
                      <span className="text-primary/40 text-sm hidden sm:inline">❖</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground tracking-wide">
                      {(t("mantra") || "Mantra")} {mantraLabel}
                    </p>
                  </div>
                  <img src={shishyasImg} alt="" className="hidden sm:block h-16 lg:h-20 w-auto object-contain shrink-0 opacity-90" aria-hidden="true" />
                </div>

                {/* Toolbar: Add Note + Language */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openNotesDialog("list")}
                    title={t("addNoteHint")}
                    className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-dashed border-primary/50 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                    data-testid="button-add-note"
                  >
                    <StickyNote className="h-4 w-4" />
                    {t("addNote")}
                  </button>
                  {commentaryLanguageList.length > 0 && (
                    <LanguagePopover
                      languages={commentaryLanguageList}
                      selected={selectedLanguages}
                      onToggle={toggleLanguage}
                      label="Language"
                      align="right"
                      hint={t("hintLanguageSelector")}
                    />
                  )}
                </div>

              {isIndependentAdvaitaWork ? (
              <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/[0.07] to-primary/[0.03] p-2.5 sm:p-3.5 lg:p-4" data-testid="mantra-showcase">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-stretch">
                  {/* Left: contemplative illustration spanning the full height */}
                  <div className="relative rounded-xl overflow-hidden border border-primary/20 bg-primary/5 min-h-[300px] lg:min-h-0" data-testid="mantra-illustration">
                    <img
                      src={readerIllustration}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>

                  {/* Right: mantra card + meaning stacked */}
                  <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
                    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-[#fdf7ec] dark:bg-card px-4 sm:px-7 py-5 sm:py-7 flex flex-col justify-center flex-1" data-testid="verse-card">
                      <MandalaCorner className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 opacity-[0.18] dark:opacity-[0.26]" />
                      <MandalaCorner className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 opacity-[0.18] dark:opacity-[0.26]" />
                      <div className="relative flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-1.5">
                          <IconAction icon={Copy} label={t("hintCopyVerse")} onClick={copyMantra} />
                          <IconAction icon={Share2} label={t("hintShareVerse")} onClick={shareMantra} />
                          <BookmarkButton verseId={currentVerse.id} entry={bookmarkEntry} variant="action" hint={t("hintBookmark")} removeHint={t("hintRemoveBookmark")} />
                        </div>
                        <ListenButton text={mantraPlain} hint={t("hintListen")} stopHint={t("hintStopListen")} />
                      </div>
                      <div
                        className="relative font-hindi-reading text-xl sm:text-2xl lg:text-[1.7rem] leading-relaxed sm:leading-loose text-center text-primary"
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
                          className="relative font-body text-sm sm:text-base leading-relaxed text-center text-primary/60 dark:text-primary/50 italic whitespace-pre-line mt-3 pt-3 border-t border-primary/15"
                          data-testid={`text-transliteration-${currentVerse.verseNumber}`}
                        >
                          {verseTransliteration}
                        </div>
                      )}
                    </div>

                    {availableTranslations.length > 0 && (
                      <div className="rounded-xl border border-border/50 bg-[#fdf7ec]/70 dark:bg-muted/10 px-4 sm:px-6 py-4" data-testid="meaning-section">
                        <div className="flex items-center gap-2 mb-2">
                          <Sun className="h-4 w-4 text-primary" />
                          <span className="text-xs uppercase tracking-widest font-bold text-primary">{t("meaning") || "MEANING"}</span>
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
                            gujarati: "ગુજરાતી", gu: "ગુજરાতী",
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
                                className="text-sm sm:text-base leading-relaxed text-foreground/80 font-body"
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
                  </div>
                </div>
              </div>
              ) : (
              <>
              <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.10] via-primary/[0.05] to-primary/[0.09] px-4 sm:px-8 py-3 sm:py-4" data-testid="verse-card">
                <MandalaCorner className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 opacity-20 dark:opacity-[0.28]" />
                <MandalaCorner className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 opacity-20 dark:opacity-[0.28]" />
                <div className="relative flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <IconAction icon={Copy} label={t("hintCopyVerse")} onClick={copyMantra} />
                    <IconAction icon={Share2} label={t("hintShareVerse")} onClick={shareMantra} />
                    <BookmarkButton verseId={currentVerse.id} entry={bookmarkEntry} variant="action" hint={t("hintBookmark")} removeHint={t("hintRemoveBookmark")} />
                  </div>
                  <ListenButton text={mantraPlain} hint={t("hintListen")} stopHint={t("hintStopListen")} />
                </div>
                <div
                  className="relative font-hindi-reading text-xl sm:text-2xl lg:text-[1.7rem] leading-relaxed text-center text-primary py-2"
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
                    className="relative font-body text-sm sm:text-base leading-relaxed text-center text-primary/60 dark:text-primary/50 italic whitespace-pre-line mt-3 pt-3 border-t border-primary/15"
                    data-testid={`text-transliteration-${currentVerse.verseNumber}`}
                  >
                    {verseTransliteration}
                  </div>
                )}
              </div>

              {availableTranslations.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/30 dark:bg-muted/10 px-4 sm:px-5 py-4" data-testid="meaning-section">
                  <div className="flex items-center gap-2 mb-2">
                    <Sun className="h-4 w-4 text-primary" />
                    <span className="text-xs uppercase tracking-widest font-bold text-primary">{t("meaning") || "MEANING"}</span>
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
                          className="text-sm sm:text-base leading-relaxed text-foreground/80 font-body"
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
              </>
              )}
              </div>

              {hasCommentaryOptions && (
                <div ref={commentaryRef} className={`rounded-2xl border border-border/60 bg-card overflow-hidden ${isFullscreen ? "h-screen overflow-y-auto" : ""}`} data-testid="commentary-section">
                  {/* Tab bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 px-2 sm:px-3">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => { setCommentaryMode("bhashyam"); setShowTeekas(false); setCommentaryExpanded(true); }}
                        className={`relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide transition-colors ${!showTeekas && activeCommentaryMode === "bhashyam" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="tab-bhashyam"
                      >
                        <span className="inline-flex items-center gap-1.5"><Feather className="h-4 w-4" />{t("bhashyam")}</span>
                        {!showTeekas && activeCommentaryMode === "bhashyam" && <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-primary rounded-full" />}
                      </button>
                      {teekaAvailable && (
                        <button
                          type="button"
                          onClick={() => { setCommentaryMode("teeka"); setShowTeekas(false); setCommentaryExpanded(true); }}
                          className={`relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide transition-colors ${!showTeekas && activeCommentaryMode === "teeka" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          data-testid="tab-teeka"
                        >
                          <span className="inline-flex items-center gap-1.5"><ScrollText className="h-4 w-4" />{t("teeka")}</span>
                          {!showTeekas && activeCommentaryMode === "teeka" && <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-primary rounded-full" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 py-1.5">
                      {!showTeekas && (
                        <>
                          <IconAction icon={Copy} label={t("hintCopyVerse")} onClick={copyMantra} />
                          <IconAction icon={Share2} label={t("hintShareVerse")} onClick={shareMantra} />
                          <BookmarkButton verseId={currentVerse.id} entry={bookmarkEntry} variant="action" hint={t("hintBookmark")} removeHint={t("hintRemoveBookmark")} />
                        </>
                      )}
                      {showTeekas && (
                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/60 bg-card/70 text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                          data-testid="button-fullscreen"
                        >
                          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                          <span className="hidden sm:inline">{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
                        </button>
                      )}
                      {teekaAvailable && (
                        <HintTooltip label={showTeekas ? "Exit pair mode" : t("hintPairMode")}>
                          <button
                            type="button"
                            onClick={() => setShowTeekas((v) => !v)}
                            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors ${showTeekas ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/70 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"}`}
                            data-testid="button-pair-mode"
                          >
                            {showTeekas ? <X className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">{showTeekas ? "Exit Pair Mode" : "Pair Mode"}</span>
                          </button>
                        </HintTooltip>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 sm:p-6">
                    {(showTeekas && teekaAvailable) ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="commentary-pair">
                        <div data-testid="bhashya-content-card">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <img src={shankaracharyaImg} alt="" className="h-7 w-7 object-contain shrink-0" aria-hidden="true" />
                              <h3 className="font-serif text-base sm:text-lg font-bold text-foreground">
                                {tc(selectedBhashyaAuthor || (verseBhashyaAuthors[0]?.authorName ?? ""), bookAuthorTranslations)} Bhāṣya
                              </h3>
                              <span className="flex items-center gap-1">
                                <IconAction icon={Copy} label={t("hintCopyVerse")} onClick={copyMantra} />
                                <IconAction icon={Share2} label={t("hintShareVerse")} onClick={shareMantra} />
                                <BookmarkButton verseId={currentVerse.id} entry={bookmarkEntry} variant="action" hint={t("hintBookmark")} removeHint={t("hintRemoveBookmark")} />
                              </span>
                            </div>
                          </div>
                          {effectiveLang && (
                            <div className={`${commentaryPanelHeight} overflow-y-auto overscroll-contain pr-2`}>
                              <VerseExplanation
                                verseId={currentVerse.id}
                                languageCode={effectiveLang}
                                languageCodes={Array.from(selectedLanguages)}
                                authorName={selectedBhashyaAuthor}
                                showAll={false}
                                filterFn={(e: any) => e.commentaryType ? e.commentaryType === "bhashya" : isBhashyaAuthorByName(e.authorName)}
                                mode="bhashyam"
                                hideAuthorHeading
                              />
                            </div>
                          )}
                        </div>
                        <div className="border-t border-border/40 pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:border-border/40 lg:pl-6" data-testid="teeka-content-card">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <h3 className="font-serif text-base sm:text-lg font-bold text-foreground">
                                {tc(selectedTeekaAuthor || (verseTeekaAuthors[0]?.authorName ?? ""), bookAuthorTranslations)} Ṭīkā
                              </h3>
                              <span className="flex items-center gap-1">
                                <IconAction icon={Copy} label={t("hintCopyVerse")} onClick={copyMantra} />
                                <IconAction icon={Share2} label={t("hintShareVerse")} onClick={shareMantra} />
                                <BookmarkButton verseId={currentVerse.id} entry={bookmarkEntry} variant="action" hint={t("hintBookmark")} removeHint={t("hintRemoveBookmark")} />
                              </span>
                            </div>
                            {verseTeekaAuthors.length > 1 && (
                              <Select value={selectedTeekaAuthor || verseTeekaAuthors[0]?.authorName || ""} onValueChange={handleSelectTeekaAuthor}>
                                <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[200px] text-[11px] border border-border/50 bg-card px-2 rounded-lg" data-testid="select-teeka-author">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {verseTeekaAuthors.map((author) => (
                                    <SelectItem key={author.authorName} value={author.authorName}>
                                      {tc(author.authorName, bookAuthorTranslations)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          {effectiveLang && (
                            <div className={`${commentaryPanelHeight} overflow-y-auto overscroll-contain pr-2`}>
                              <VerseExplanation
                                verseId={currentVerse.id}
                                languageCode={effectiveLang}
                                languageCodes={Array.from(selectedLanguages)}
                                authorName={selectedTeekaAuthor}
                                showAll={false}
                                filterFn={(e: any) => e.commentaryType ? e.commentaryType === "teeka" : isTeekaAuthorByName(e.authorName)}
                                mode="teeka"
                                hideAuthorHeading
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : activeCommentaryMode === "teeka" ? (
                      <div data-testid="teeka-content-card">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <h3 className="font-serif text-base sm:text-lg font-bold text-foreground">
                            {tc(selectedTeekaAuthor || (verseTeekaAuthors[0]?.authorName ?? ""), bookAuthorTranslations)} Ṭīkā
                          </h3>
                          <div className="flex items-center gap-2">
                            {verseTeekaAuthors.length > 1 && (
                              <Select value={selectedTeekaAuthor || verseTeekaAuthors[0]?.authorName || ""} onValueChange={handleSelectTeekaAuthor}>
                                <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[200px] text-[11px] border border-border/50 bg-card px-2 rounded-lg" data-testid="select-teeka-author">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {verseTeekaAuthors.map((author) => (
                                    <SelectItem key={author.authorName} value={author.authorName}>
                                      {tc(author.authorName, bookAuthorTranslations)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                        {effectiveLang && (
                          <div className={`${commentaryPanelHeight} overflow-y-auto overscroll-contain pr-2`}>
                            <VerseExplanation
                              verseId={currentVerse.id}
                              languageCode={effectiveLang}
                              languageCodes={Array.from(selectedLanguages)}
                              authorName={selectedTeekaAuthor}
                              showAll={false}
                              filterFn={(e: any) => e.commentaryType ? e.commentaryType === "teeka" : isTeekaAuthorByName(e.authorName)}
                              mode="teeka"
                              hideAuthorHeading
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div data-testid="bhashya-content-card">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <img src={shankaracharyaImg} alt="" className="h-7 w-7 object-contain shrink-0" aria-hidden="true" />
                            <h3 className="font-serif text-base sm:text-lg font-bold text-foreground">
                              {tc(selectedBhashyaAuthor || (verseBhashyaAuthors[0]?.authorName ?? ""), bookAuthorTranslations)} Bhāṣya
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {verseBhashyaAuthors.length > 1 && (
                              <Select
                                value={selectedBhashyaAuthor || verseBhashyaAuthors[0]?.authorName || ""}
                                onValueChange={(v) => { preferredBhashyaAuthorRef.current = v; setSelectedBhashyaAuthor(v); handleAuthorChange(v); }}
                              >
                                <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[200px] text-[11px] border border-border/50 bg-card px-2 rounded-lg" data-testid="select-bhashya-author">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {verseBhashyaAuthors.map((author) => (
                                    <SelectItem key={author.authorName} value={author.authorName}>
                                      {tc(author.authorName, bookAuthorTranslations)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                        {commentaryExpanded && effectiveLang && (
                          <div className={`${commentaryPanelHeight} overflow-y-auto overscroll-contain pr-2`}>
                            <VerseExplanation
                              verseId={currentVerse.id}
                              languageCode={effectiveLang}
                              languageCodes={Array.from(selectedLanguages)}
                              authorName={selectedBhashyaAuthor}
                              showAll={false}
                              filterFn={(e: any) => e.commentaryType ? e.commentaryType === "bhashya" : isBhashyaAuthorByName(e.authorName)}
                              mode="bhashyam"
                              hideAuthorHeading
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          {book?.slug && bookMediaConfig[book.slug]?.videoId && (
            <div className="border-t border-border mt-6 px-0 py-2">
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

        <div className="border-t border-border/50 bg-background px-4 sm:px-8 py-2 sm:py-3">
          <div className="max-w-6xl xl:max-w-none mx-auto space-y-2">
            {progressAuthed && verseTotal > 0 && (
              <div className="flex items-center gap-2" data-testid="reader-progress-bar">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${completedPct}%` }}
                    data-testid="reader-progress-fill"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0" data-testid="text-reader-progress">
                  {completedCount}/{verseTotal} ({completedPct}%)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40"
                data-testid="button-prev-page"
                title={currentVerseIsCompleted ? "Completed" : undefined}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t("previous") || "Previous"}</span>
                <span className="hidden sm:inline">{t("mantra") || "Mantra"}</span>
              </Button>

              <span className="text-xs sm:text-sm text-muted-foreground tabular-nums text-center px-2" data-testid="text-reader-position">
                {(t("mantra") || "Mantra")} {currentPage + 1} of {totalPages}
              </span>

              <Button
                variant="default"
                size="sm"
                onClick={() => { if (progressAuthed && currentVerse && !currentVerseIsCompleted) { handleToggleComplete(); } goToNextPage(); }}
                disabled={currentPage === totalPages - 1 || markCompleteMutation.isPending}
                className="gap-1.5 rounded-lg disabled:opacity-40"
                data-testid="button-next-page"
              >
                <span>{t("next") || "Next"}</span>
                <span className="hidden sm:inline">{t("mantra") || "Mantra"}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
}
