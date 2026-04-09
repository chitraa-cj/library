import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { WelcomeScreen, LibraryCatalogView, CategoryDetailView, SubCategoryDetailView } from "@/components/welcome-screen";
import { BookReader } from "@/components/book-reader";
import { TranslationPanel } from "@/components/translation-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, Globe, LogIn, LogOut, Settings, User, Search, Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { PreferencesDialog } from "@/components/preferences-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import TranslatePage from "@/pages/translate-page";
import { useTranslation } from "@/lib/translations";
import { translateContent, bookAuthorTranslations } from "@/lib/content-translations";
import type { Book, Language } from "@shared/schema";

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
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

function HomePageContent() {
  const [location, setLocation] = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const { toggleSidebar, state: sidebarState } = useSidebar();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [langSearchOpen, setLangSearchOpen] = useState(false);
  const [langSearchQuery, setLangSearchQuery] = useState("");
  const [selectedCommentaryLanguage, setSelectedCommentaryLanguage] = useState<string | null>(() => {
    const legacyAliases: Record<string, string> = {
      en: "english", sa: "devanagari", sanskrit: "devanagari",
      hi: "hindi", kn: "kannada", te: "telugu", ta: "tamil",
      de: "german", fr: "french", es: "spanish",
      zh: "mandarin", chinese: "mandarin", ar: "arabic",
    };
    const normalize = (code: string | null): string => {
      if (!code) return "english";
      const c = code.toLowerCase().trim();
      if (legacyAliases[c]) return legacyAliases[c];
      return c || "english";
    };
    if (typeof window !== 'undefined') {
      return normalize(localStorage.getItem('preferredLanguage'));
    }
    return 'english';
  });
  const [navigateToVerse, setNavigateToVerse] = useState<number | null>(null);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(1);
  const [chapterViewAdhyay, setChapterViewAdhyay] = useState<number | null>(null);
  const [chapterViewKhanda, setChapterViewKhanda] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | null>(null);
  const [showLibraryCatalog, setShowLibraryCatalog] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const [verseBreadcrumb, setVerseBreadcrumb] = useState<VerseBreadcrumb | null>(null);
  const [pendingNoteText, setPendingNoteText] = useState<string | null>(null);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const [mobileInitialPanelShown, setMobileInitialPanelShown] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const isMobile = useIsMobile();
  const { user, isLoading: authLoading, isAuthenticated: isLoggedIn } = useAuth();
  const { setTheme } = useTheme();
  const { t, locale } = useTranslation(selectedCommentaryLanguage);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, locale);

  const { data: allBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: allLanguages } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", selectedBookId, "commentary-options"],
    enabled: !!selectedBookId,
  });

  const headerLanguages = useMemo(() => {
    return [
      { code: "english", name: "English", searchTerms: "english" },
      { code: "devanagari", name: "संस्कृतम्", searchTerms: "sanskrit devanagari samskritam" },
      { code: "hindi", name: "हिन्दी", searchTerms: "hindi" },
      { code: "kannada", name: "ಕನ್ನಡ", searchTerms: "kannada" },
      { code: "telugu", name: "తెలుగు", searchTerms: "telugu" },
      { code: "tamil", name: "தமிழ்", searchTerms: "tamil" },
      { code: "german", name: "Deutsch", searchTerms: "german deutsch" },
      { code: "french", name: "Français", searchTerms: "french francais français" },
      { code: "spanish", name: "Español", searchTerms: "spanish espanol español" },
      { code: "mandarin", name: "中文", searchTerms: "mandarin chinese zhongwen 中文" },
      { code: "arabic", name: "العربية", searchTerms: "arabic arabi العربية" },
      { code: "pt", name: "Português", searchTerms: "portuguese portugues português" },
      { code: "ru", name: "Русский", searchTerms: "russian russkiy русский" },
      { code: "id", name: "Bahasa Indonesia", searchTerms: "indonesian bahasa indonesia" },
      { code: "ja", name: "日本語", searchTerms: "japanese nihongo 日本語" },
      { code: "pcm", name: "Naijá", searchTerms: "nigerian pidgin naija" },
      { code: "arz", name: "مصري", searchTerms: "egyptian arabic masri مصري" },
      { code: "vi", name: "Tiếng Việt", searchTerms: "vietnamese tieng viet" },
      { code: "ha", name: "Hausa", searchTerms: "hausa" },
      { code: "tr", name: "Türkçe", searchTerms: "turkish turkce türkçe" },
      { code: "ko", name: "한국어", searchTerms: "korean hangugeo 한국어" },
      { code: "th", name: "ไทย", searchTerms: "thai ไทย" },
      { code: "it", name: "Italiano", searchTerms: "italian italiano" },
      { code: "si", name: "සිංහල", searchTerms: "sinhalese sinhala සිංහල" },
      { code: "uk", name: "Українська", searchTerms: "ukrainian ukrainska українська" },
      { code: "fa", name: "فارسی", searchTerms: "persian farsi فارسی" },
      { code: "ku", name: "Kurdî", searchTerms: "kurdish kurdi kurdî" },
      { code: "az", name: "Azərbaycan", searchTerms: "azeri azerbaijani azərbaycan" },
      { code: "mn", name: "Монгол", searchTerms: "mongolian mongol монгол" },
      { code: "bo", name: "བོད་སྐད", searchTerms: "tibetan bodskad བོད་སྐད" },
      { code: "my", name: "မြန်မာ", searchTerms: "burmese myanmar မြန်မာ" },
      { code: "ms", name: "Bahasa Melayu", searchTerms: "malay melayu bahasa" },
      { code: "gu", name: "ગુજરાતી", searchTerms: "gujarati ગુજરાતી" },
      { code: "bho", name: "भोजपुरी", searchTerms: "bhojpuri भोजपुरी" },
      { code: "as", name: "অসমীয়া", searchTerms: "assamese অসমীয়া" },
      { code: "ks", name: "कॉशुर", searchTerms: "kashmiri कॉशुर" },
      { code: "mr", name: "मराठी", searchTerms: "marathi मराठी" },
      { code: "kok", name: "कोंकणी", searchTerms: "konkani कोंकणी" },
      { code: "ml", name: "മലയാളം", searchTerms: "malayalam മലയാളം" },
      { code: "pa", name: "ਪੰਜਾਬੀ", searchTerms: "punjabi ਪੰਜਾਬੀ" },
      { code: "bn", name: "বাংলা", searchTerms: "bengali bangla বাংলা" },
      { code: "mni", name: "মণিপুরী", searchTerms: "manipuri মণিপুরী" },
      { code: "ne", name: "नेपाली", searchTerms: "nepali नेपाली" },
      { code: "ur", name: "اردو", searchTerms: "urdu اردو" },
      { code: "or", name: "ଓଡ଼ିଆ", searchTerms: "odia oriya ଓଡ଼ିଆ" },
      { code: "sd", name: "سنڌي", searchTerms: "sindhi سنڌي" },
    ];
  }, []);

  const filteredHeaderLanguages = useMemo(() => {
    if (!langSearchQuery.trim()) return headerLanguages;
    const q = langSearchQuery.toLowerCase().trim();
    return headerLanguages.filter(lang =>
      lang.name.toLowerCase().includes(q) ||
      lang.searchTerms.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  }, [headerLanguages, langSearchQuery]);

  const currentLangLabel = useMemo(() => {
    const lang = headerLanguages.find(l => l.code === (selectedCommentaryLanguage || "english"));
    return lang?.name || "English";
  }, [headerLanguages, selectedCommentaryLanguage]);

  const headerAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    if (!selectedCommentaryLanguage) return commentaryOptions.authors;
    const langAliases: Record<string, string[]> = {
      "english": ["english", "en"], "en": ["english", "en"],
      "hi": ["hi", "hindi"], "hindi": ["hi", "hindi"],
      "de": ["de", "german"], "german": ["de", "german"],
      "fr": ["fr", "french"], "french": ["fr", "french"],
      "es": ["es", "spanish"], "spanish": ["es", "spanish"],
      "zh": ["zh", "mandarin", "chinese"], "mandarin": ["zh", "mandarin", "chinese"], "chinese": ["zh", "mandarin", "chinese"],
      "ar": ["ar", "arabic"], "arabic": ["ar", "arabic"],
      "kn": ["kn", "kannada"], "kannada": ["kn", "kannada"],
      "te": ["te", "telugu"], "telugu": ["te", "telugu"],
      "ta": ["ta", "tamil"], "tamil": ["ta", "tamil"],
    };
    const matchCodes = langAliases[selectedCommentaryLanguage] || [selectedCommentaryLanguage];
    return commentaryOptions.authors.filter(a => a.languageCodes.some(c => matchCodes.includes(c)));
  }, [commentaryOptions, selectedCommentaryLanguage]);

  useEffect(() => {
    if (headerAuthors.length > 0) {
      const currentValid = selectedAuthor && headerAuthors.some(a => a.authorName === selectedAuthor);
      if (!currentValid) {
        setSelectedAuthor(headerAuthors[0].authorName);
      }
    }
  }, [headerAuthors]);

  const [prefsApplied, setPrefsApplied] = useState(false);
  useEffect(() => {
    if (!user || prefsApplied) return;
    if (user.preferredLanguage) {
      const prefLegacyAliases: Record<string, string> = {
        en: "english", sa: "devanagari", sanskrit: "devanagari",
        hi: "hindi", kn: "kannada", te: "telugu", ta: "tamil",
        de: "german", fr: "french", es: "spanish",
        zh: "mandarin", chinese: "mandarin", ar: "arabic",
      };
      const normalizedLang = prefLegacyAliases[user.preferredLanguage.toLowerCase().trim()] || user.preferredLanguage;
      setSelectedCommentaryLanguage(normalizedLang);
      localStorage.setItem('preferredLanguage', normalizedLang);
    }
    if (user.preferredAuthor) {
      setSelectedAuthor(user.preferredAuthor);
    }
    if (user.preferredTheme && (user.preferredTheme === "light" || user.preferredTheme === "dark")) {
      setTheme(user.preferredTheme);
    }
    setPrefsApplied(true);
  }, [user]);

  const handleGlobalLanguageChange = useCallback((langCode: string) => {
    setSelectedCommentaryLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
    if (isLoggedIn) {
      apiRequest("PATCH", "/api/user/preferred-language", { language: langCode }).catch(console.error);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setRightPanelCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const urlParts = location.replace(/^\//, '').split('/').filter(Boolean);
  const bookSlugFromUrl = urlParts[0] && urlParts[0] !== 'auth' ? urlParts[0] : null;
  const isChapterUrl = urlParts[1] === 'chapter';
  const chapterNumberFromUrl = isChapterUrl && urlParts[2] ? parseInt(urlParts[2], 10) : null;
  const partNumberFromUrl = isChapterUrl && urlParts[3] ? parseInt(urlParts[3], 10) : null;
  const verseNumberFromUrl = !isChapterUrl && urlParts[1] ? parseInt(urlParts[1], 10) : null;

  useEffect(() => {
    if (urlInitialized || !allBooks) return;

    if (bookSlugFromUrl) {
      const matchedBook = allBooks.find(b => b.slug === bookSlugFromUrl);
      if (matchedBook) {
        setSelectedBookId(matchedBook.id);
        if (chapterNumberFromUrl !== null && !isNaN(chapterNumberFromUrl)) {
          setChapterViewAdhyay(chapterNumberFromUrl);
          if (partNumberFromUrl !== null && !isNaN(partNumberFromUrl)) {
            setChapterViewKhanda(partNumberFromUrl);
          }
        } else if (verseNumberFromUrl !== null && !isNaN(verseNumberFromUrl)) {
          setNavigateToVerse(verseNumberFromUrl);
          setCurrentVerseNumber(verseNumberFromUrl);
        }
      } else {
        setLocation("/");
      }
    }
    setUrlInitialized(true);
  }, [allBooks, bookSlugFromUrl, verseNumberFromUrl, chapterNumberFromUrl, partNumberFromUrl, urlInitialized, setLocation]);

  useEffect(() => {
    if (!urlInitialized || !allBooks) return;

    if (!bookSlugFromUrl) {
      if (selectedBookId) {
        setSelectedBookId(null);
        setSelectedCategoryId(null);
        setNavigateToVerse(null);
      }
      return;
    }

    const matchedBook = allBooks.find(b => b.slug === bookSlugFromUrl);
    if (!matchedBook) return;

    if (matchedBook.id !== selectedBookId) {
      setSelectedBookId(matchedBook.id);
    }

    if (chapterNumberFromUrl !== null && !isNaN(chapterNumberFromUrl)) {
      if (chapterNumberFromUrl !== chapterViewAdhyay) {
        setChapterViewAdhyay(chapterNumberFromUrl);
      }
      const resolvedPart = partNumberFromUrl !== null && !isNaN(partNumberFromUrl) ? partNumberFromUrl : null;
      if (resolvedPart !== chapterViewKhanda) {
        setChapterViewKhanda(resolvedPart);
      }
    } else {
      if (chapterViewAdhyay !== null) {
        setChapterViewAdhyay(null);
        setChapterViewKhanda(null);
      }
      if (verseNumberFromUrl !== null && !isNaN(verseNumberFromUrl) && verseNumberFromUrl !== currentVerseNumber) {
        setNavigateToVerse(verseNumberFromUrl);
        setCurrentVerseNumber(verseNumberFromUrl);
      }
    }
  }, [urlInitialized, allBooks, bookSlugFromUrl, verseNumberFromUrl, chapterNumberFromUrl, partNumberFromUrl]);

  const getBookSlug = useCallback((bookId: string): string | null => {
    const book = allBooks?.find(b => b.id === bookId);
    return book?.slug || null;
  }, [allBooks]);

  const handleVerseSelect = (verseId: string, content: string) => {
    setSelectedVerseId(verseId || null);
    setSelectedContent(content);
  };

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setMobileInitialPanelShown(false);
    setSelectedAuthor(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setChapterViewAdhyay(null);
    setChapterViewKhanda(null);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    const slug = getBookSlug(bookId);
    if (slug) {
      setLocation(`/${slug}`);
    }
  };

  const handleGoHome = () => {
    setSelectedBookId(null);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setShowLibraryCatalog(false);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setLocation("/");
  };

  useEffect(() => {
    if (isMobile && selectedBookId && selectedVerseId && !mobileInitialPanelShown) {
      setShowTranslationPanel(true);
      setMobileInitialPanelShown(true);
    }
  }, [isMobile, selectedBookId, selectedVerseId, mobileInitialPanelShown]);

  const handleShowCoverPage = useCallback(() => {
    setChapterViewAdhyay(null);
    setChapterViewKhanda(null);
    setNavigateToVerse(null);
    setVerseBreadcrumb(null);
    setCurrentVerseNumber(null);
    const slug = selectedBookId ? getBookSlug(selectedBookId) : null;
    if (slug) {
      setLocation(`/${slug}`);
    }
  }, [selectedBookId, getBookSlug]);

  const handleSidebarVerseSelect = (verseNumber: number) => {
    setChapterViewAdhyay(null);
    setChapterViewKhanda(null);
    setNavigateToVerse(verseNumber);
    setCurrentVerseNumber(verseNumber);
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        setLocation(`/${slug}/${verseNumber}`);
      }
    }
  };

  const handleSelectChapter = useCallback((adhyayNumber: number) => {
    setChapterViewAdhyay(adhyayNumber);
    setChapterViewKhanda(null);
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        setLocation(`/${slug}/chapter/${adhyayNumber}`);
      }
    }
  }, [selectedBookId, getBookSlug, setLocation]);

  const handleSelectPart = useCallback((adhyayNumber: number, khandaNumber: number) => {
    setChapterViewAdhyay(adhyayNumber);
    setChapterViewKhanda(khandaNumber);
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        setLocation(`/${slug}/chapter/${adhyayNumber}/${khandaNumber}`);
      }
    }
  }, [selectedBookId, getBookSlug, setLocation]);

  const handleVerseChange = useCallback((verseNumber: number) => {
    setCurrentVerseNumber(verseNumber);
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        const targetPath = `/${slug}/${verseNumber}`;
        if (locationRef.current !== targetPath) {
          setLocation(targetPath);
        }
      }
    }
  }, [selectedBookId, getBookSlug, setLocation]);

  return (
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar
          selectedBookId={selectedBookId}
          onSelectBook={handleBookSelect}
          onSelectVerse={handleSidebarVerseSelect}
          onSelectChapter={handleSelectChapter}
          onSelectPart={handleSelectPart}
          languageCode={selectedCommentaryLanguage}
          onSelectCategory={(categoryId) => {
            setSelectedCategoryId(categoryId);
            setSelectedSubCategoryId(null);
            setSelectedBookId(null);
            setShowLibraryCatalog(false);
          }}
          onSelectSubCategory={(categoryId, subCategoryId) => {
            setSelectedCategoryId(categoryId);
            setSelectedSubCategoryId(subCategoryId);
            setSelectedBookId(null);
            setShowLibraryCatalog(false);
          }}
          onShowCoverPage={handleShowCoverPage}
          selectedVerseNumber={currentVerseNumber}
          chapterViewAdhyay={chapterViewAdhyay}
          chapterViewKhanda={chapterViewKhanda}
          onGoHome={handleGoHome}
          onGoBack={selectedBookId ? handleGoHome : undefined}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/8 to-accent/5 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {selectedBookId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    window.history.back();
                  }}
                  title="Go back"
                  data-testid="button-go-back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {selectedBookId && verseBreadcrumb ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src="https://oneness.org.in/assets/img/favicon.png"
                    alt="Advaita Vaaridhi"
                    className="h-6 w-6 object-contain shrink-0 cursor-pointer"
                    onClick={handleShowCoverPage}
                    data-testid="breadcrumb-logo"
                  />
                {verseBreadcrumb.numericLabel && (
                  <span className="shrink-0 text-[10px] font-mono text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded" data-testid="breadcrumb-numeric-label">
                    {verseBreadcrumb.numericLabel}
                  </span>
                )}
                <nav className="flex items-center gap-1 min-w-0 flex-wrap" data-testid="breadcrumb-nav" aria-label="Current verse position">
                  {(() => {
                    const items: { label: string; onClick?: () => void }[] = [];
                    if (verseBreadcrumb.adhyayTitle && verseBreadcrumb.adhyayNumber != null) {
                      items.push({
                        label: verseBreadcrumb.adhyayTitle,
                        onClick: () => handleSelectChapter(verseBreadcrumb.adhyayNumber!),
                      });
                    }
                    if (verseBreadcrumb.khandaTitle && verseBreadcrumb.khandaTitle !== verseBreadcrumb.adhyayTitle && verseBreadcrumb.adhyayNumber != null && verseBreadcrumb.khandaNumber != null) {
                      items.push({
                        label: verseBreadcrumb.khandaTitle,
                        onClick: () => handleSelectPart(verseBreadcrumb.adhyayNumber!, verseBreadcrumb.khandaNumber!),
                      });
                    }
                    if (verseBreadcrumb.verseLabel && !items.some(i => i.label === verseBreadcrumb.verseLabel)) {
                      items.push({ label: verseBreadcrumb.verseLabel });
                    }
                    return items.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        {item.onClick ? (
                          <button
                            onClick={item.onClick}
                            className="truncate text-xs max-w-[120px] sm:max-w-[160px] text-muted-foreground hover:text-primary cursor-pointer transition-colors bg-transparent border-none p-0"
                            title={item.label}
                            data-testid={`breadcrumb-part-${idx}`}
                          >
                            {item.label}
                          </button>
                        ) : (
                          <span
                            className="truncate text-xs max-w-[120px] sm:max-w-[160px] text-foreground/80 font-medium"
                            title={item.label}
                            data-testid={`breadcrumb-part-${idx}`}
                          >
                            {item.label}
                          </span>
                        )}
                      </span>
                    ));
                  })()}
                </nav>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-primary/15 rounded-full blur-sm"></div>
                    <img 
                      src="https://oneness.org.in/assets/img/favicon.png" 
                      alt="Advaita Vaaridhi"
                      className="h-8 w-8 object-contain relative"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-primary/50">ॐ</span>
                      <span className="font-serif text-sm font-bold text-primary">
                        {t("advaitaVaaridhi")}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tracking-wide">
                      {t("encyclopaediaOfAdvaitaVedanta")}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" data-testid="language-selector-header">
                <Popover open={langSearchOpen} onOpenChange={(open) => { setLangSearchOpen(open); if (!open) setLangSearchQuery(""); }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs font-normal"
                      data-testid="select-header-language"
                    >
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="max-w-[80px] truncate">{currentLangLabel}</span>
                      <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0" align="end">
                    <div className="flex items-center gap-2 px-3 py-2 border-b">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search..."
                        value={langSearchQuery}
                        onChange={(e) => setLangSearchQuery(e.target.value)}
                        autoFocus
                        data-testid="input-language-search"
                      />
                    </div>
                    <div className="py-1 max-h-[200px] overflow-y-auto">
                      {filteredHeaderLanguages.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
                      ) : (
                        filteredHeaderLanguages.map((lang) => (
                          <button
                            key={lang.code}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover-elevate cursor-pointer"
                            onClick={() => {
                              handleGlobalLanguageChange(lang.code);
                              setLangSearchOpen(false);
                              setLangSearchQuery("");
                            }}
                            data-testid={`option-header-lang-${lang.code}`}
                          >
                            <Check className={`h-3.5 w-3.5 shrink-0 ${(selectedCommentaryLanguage || "english") === lang.code ? "opacity-100" : "opacity-0"}`} />
                            <span>{lang.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <ThemeToggle />
              {!authLoading && (
                isLoggedIn && user ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.profileImageUrl ?? undefined} alt={user.firstName ?? "User"} />
                      <AvatarFallback className="text-xs">
                        {(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                        queryClient.setQueryData(["/api/auth/user"], null);
                      }}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("logOut")}</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setLocation("/auth"); }}
                    data-testid="button-login"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t("logIn")}</span>
                  </Button>
                )
              )}
            </div>
            </div>
          </header>
          <main className="flex flex-1 min-h-0 overflow-hidden">
            {selectedBookId ? (
              <>
                <BookReader
                  bookId={selectedBookId}
                  onVerseSelect={handleVerseSelect}
                  selectedVerseId={selectedVerseId}
                  selectedAuthor={selectedAuthor}
                  selectedCommentaryLanguage={selectedCommentaryLanguage}
                  onAuthorChange={setSelectedAuthor}
                  navigateToVerse={navigateToVerse}
                  onVerseChange={handleVerseChange}
                  onBreadcrumbChange={setVerseBreadcrumb}
                  chapterViewAdhyay={chapterViewAdhyay}
                  chapterViewKhanda={chapterViewKhanda}
                  onExitChapterView={(verseNum) => {
                    const targetVerse = verseNum ?? currentVerseNumber;
                    setChapterViewAdhyay(null);
                    setChapterViewKhanda(null);
                    setCurrentVerseNumber(targetVerse);
                    setNavigateToVerse(targetVerse);
                    if (selectedBookId) {
                      const slug = getBookSlug(selectedBookId);
                      if (slug) {
                        setLocation(`/${slug}/${targetVerse}`);
                      }
                    }
                  }}
                  onSelectChapter={handleSelectChapter}
                  onSelectPart={handleSelectPart}
                  onShowCoverPage={handleShowCoverPage}
                  onAddNoteWithText={(text) => {
                    setPendingNoteText(text);
                    if (isMobile) {
                      setShowTranslationPanel(true);
                    } else if (rightPanelCollapsed) {
                      setRightPanelCollapsed(false);
                    }
                  }}
                />
                <TranslationPanel
                  bookId={selectedBookId}
                  selectedVerseId={selectedVerseId}
                  selectedContent={selectedContent}
                  selectedAuthor={selectedAuthor}
                  selectedCommentaryLanguage={selectedCommentaryLanguage}
                  onAuthorChange={setSelectedAuthor}
                  open={showTranslationPanel}
                  onOpenChange={setShowTranslationPanel}
                  collapsed={rightPanelCollapsed}
                  onCollapsedChange={setRightPanelCollapsed}
                  pendingNoteText={pendingNoteText}
                  onPendingNoteTextConsumed={() => setPendingNoteText(null)}
                />
              </>
            ) : selectedCategoryId && selectedSubCategoryId ? (
              <SubCategoryDetailView
                categoryId={selectedCategoryId}
                subCategoryId={selectedSubCategoryId}
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onGoBack={() => {
                  setSelectedSubCategoryId(null);
                }}
                languageCode={selectedCommentaryLanguage}
              />
            ) : selectedCategoryId ? (
              <CategoryDetailView
                categoryId={selectedCategoryId}
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onSelectSubCategory={(catId, subCatId) => {
                  setSelectedSubCategoryId(subCatId);
                }}
                onGoBack={() => {
                  setSelectedCategoryId(null);
                  setShowLibraryCatalog(true);
                }}
                languageCode={selectedCommentaryLanguage}
              />
            ) : showLibraryCatalog ? (
              <LibraryCatalogView
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onSelectCategory={(categoryId) => {
                  setSelectedCategoryId(categoryId);
                }}
                onSelectSubCategory={(categoryId, subCategoryId) => {
                  setSelectedCategoryId(categoryId);
                  setSelectedSubCategoryId(subCategoryId);
                }}
                onGoBack={() => setShowLibraryCatalog(false)}
                languageCode={selectedCommentaryLanguage}
              />
            ) : (
              <WelcomeScreen
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onBrowseLibrary={() => setShowLibraryCatalog(true)}
                languageCode={selectedCommentaryLanguage}
              />
            )}
          </main>
        </div>
        {isLoggedIn && user && (
          <PreferencesDialog
            open={showPreferences}
            onOpenChange={setShowPreferences}
            user={user}
            currentLanguage={selectedCommentaryLanguage}
            currentAuthor={selectedAuthor}
            onLanguageChange={handleGlobalLanguageChange}
            onAuthorChange={setSelectedAuthor}
            languageCode={selectedCommentaryLanguage}
          />
        )}
      </div>
  );
}

function HomePage() {
  const sidebarStyle = {
    "--sidebar-width": "22rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <HomePageContent />
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/translate" component={TranslatePage} />
      <Route path="/:bookSlug" component={HomePage} />
      <Route path="/:bookSlug/chapter/:chapterNumber" component={HomePage} />
      <Route path="/:bookSlug/chapter/:chapterNumber/:partNumber" component={HomePage} />
      <Route path="/:bookSlug/:verseNumber" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
