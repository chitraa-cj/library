import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest, cmsContentQueryOptions } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { CATALOG_TREE, findBookPath, matchesCategory } from "@/components/app-sidebar";
import { WelcomeScreen, LibraryCatalogView, CategoryDetailView, SubCategoryDetailView } from "@/components/welcome-screen";
import { AcharyasPage } from "@/components/acharyas-page";
import { BookReader } from "@/components/book-reader";
import { ReaderNavSidebar, useBookChapters } from "@/components/reader-nav-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, Globe, LogIn, LogOut, Settings, User, Search, Check, ChevronsUpDown, Menu } from "lucide-react";
import { MyLibraryPanel } from "@/components/my-library-panel";
import { setLastRead } from "@/lib/last-read";
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

const SLUG_ALIASES: Record<string, string> = {
  "katha-upanishad-bhashya": "kathopanishad",
  "isha-upanishad-bhashya": "ishavasya-upanishad",
  "bhagavad-gita": "srimad-bhagavad-gita",
};

function HomePageContent() {
  const [location, setLocation] = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  // The right "Commentary & Insight" panel was removed. Keep a no-op setter so the
  // existing navigation handlers stay unchanged; the value is no longer read anywhere.
  const setShowTranslationPanel = (_open: boolean) => {};
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
  // Acharyas (guru-parampara) view: showAcharyas toggles the page; slug = detail.
  const [showAcharyas, setShowAcharyas] = useState(false);
  const [selectedAcharyaSlug, setSelectedAcharyaSlug] = useState<string | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const [verseBreadcrumb, setVerseBreadcrumb] = useState<VerseBreadcrumb | null>(null);
  const [coverBook, setCoverBook] = useState<{ bookId: string; title: string } | null>(null);
  // Bumped to ask the open BookReader to show its cover / table-of-contents view.
  const [readerCoverSignal, setReaderCoverSignal] = useState(0);
  const [pendingNoteText, setPendingNoteText] = useState<string | null>(null);
  const [showMyLibrary, setShowMyLibrary] = useState(false);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const [mobileInitialPanelShown, setMobileInitialPanelShown] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [readerNavCollapsed, setReaderNavCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { user, isLoading: authLoading, isAuthenticated: isLoggedIn } = useAuth();
  const { setTheme } = useTheme();
  const { t, locale } = useTranslation(selectedCommentaryLanguage);
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, locale);

  const { data: allBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    ...cmsContentQueryOptions,
  });

  const { data: allLanguages } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", selectedBookId, "commentary-options"],
    enabled: !!selectedBookId,
    ...cmsContentQueryOptions,
  });

  const readerChapters = useBookChapters(selectedBookId || undefined);
  const selectedBook = useMemo(() => allBooks?.find(b => b.id === selectedBookId), [allBooks, selectedBookId]);

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
      let matchedBook = allBooks.find(b => b.slug === bookSlugFromUrl);

      // Slug aliases: legacy URLs that should redirect to the new canonical slug.
      if (!matchedBook && SLUG_ALIASES[bookSlugFromUrl]) {
        const targetSlug = SLUG_ALIASES[bookSlugFromUrl];
        const aliased = allBooks.find(b => b.slug === targetSlug);
        if (aliased) {
          const tail = location.replace(/^\//, '').split('/').slice(1).join('/');
          setLocation(`/${targetSlug}${tail ? `/${tail}` : ''}`);
          return;
        }
      }

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
  }, [allBooks, bookSlugFromUrl, verseNumberFromUrl, chapterNumberFromUrl, partNumberFromUrl, urlInitialized, setLocation, location]);

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

    let matchedBook = allBooks.find(b => b.slug === bookSlugFromUrl);
    if (!matchedBook && SLUG_ALIASES[bookSlugFromUrl]) {
      const targetSlug = SLUG_ALIASES[bookSlugFromUrl];
      const aliased = allBooks.find(b => b.slug === targetSlug);
      if (aliased) {
        const tail = location.replace(/^\//, '').split('/').slice(1).join('/');
        setLocation(`/${targetSlug}${tail ? `/${tail}` : ''}`);
        return;
      }
    }
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
    setShowAcharyas(false);
    setSelectedAcharyaSlug(null);
    setLocation("/");
  };

  // Open the guru-parampara (acharya) page. Clears book/category selection so the
  // acharya branch actually renders (it sits below the category views in the tree).
  const handleOpenAcharya = (slug?: string) => {
    setSelectedBookId(null);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setShowLibraryCatalog(false);
    setSelectedAcharyaSlug(slug ?? null);
    setShowAcharyas(true);
  };

  useEffect(() => {
    if (isMobile && selectedBookId && selectedVerseId && !mobileInitialPanelShown) {
      setShowTranslationPanel(true);
      setMobileInitialPanelShown(true);
    }
  }, [isMobile, selectedBookId, selectedVerseId, mobileInitialPanelShown]);

  // Remember the reader's position so "My Library → Resume Study" can return here.
  useEffect(() => {
    if (selectedBookId && typeof currentVerseNumber === "number" && currentVerseNumber > 0) {
      setLastRead({
        bookId: selectedBookId,
        bookSlug: getBookSlug(selectedBookId) || undefined,
        bookTitle: verseBreadcrumb?.bookTitle || selectedBook?.title || undefined,
        verseNumber: currentVerseNumber,
        verseLabel: verseBreadcrumb?.verseLabel || String(currentVerseNumber),
      });
    }
  }, [selectedBookId, currentVerseNumber, verseBreadcrumb, selectedBook, getBookSlug]);

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

  // Sidebar book-title button: reset navigation to the book root and tell the
  // reader to render its cover / table of contents.
  const handleShowReaderCover = useCallback(() => {
    handleShowCoverPage();
    setReaderCoverSignal((n) => n + 1);
  }, [handleShowCoverPage]);

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

  const handleLandingSelectVerse = useCallback((bookId: string, verseNumber: number) => {
    setSelectedBookId(bookId);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setShowLibraryCatalog(false);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setNavigateToVerse(verseNumber);
    setCurrentVerseNumber(verseNumber);
    setVerseBreadcrumb(null);
    setChapterViewAdhyay(null);
    setChapterViewKhanda(null);
    const book = allBooks?.find(b => b.id === bookId);
    if (book?.slug) {
      setLocation(`/${book.slug}/${verseNumber}`);
    }
  }, [allBooks, setLocation]);

  const handleReaderNavSelectVerse = useCallback((bookId: string, verseNumber: number) => {
    if (bookId === selectedBookId) {
      setNavigateToVerse(verseNumber);
      setCurrentVerseNumber(verseNumber);
      setChapterViewAdhyay(null);
      setChapterViewKhanda(null);
      const slug = getBookSlug(bookId);
      if (slug) {
        setLocation(`/${slug}/${verseNumber}`);
      }
    } else {
      handleLandingSelectVerse(bookId, verseNumber);
    }
  }, [selectedBookId, getBookSlug, setLocation, handleLandingSelectVerse]);

  const handleLandingSelectChapter = useCallback((bookId: string, adhyayNumber: number) => {
    setSelectedBookId(bookId);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setShowLibraryCatalog(false);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setChapterViewAdhyay(adhyayNumber);
    setChapterViewKhanda(null);
    const book = allBooks?.find(b => b.id === bookId);
    if (book?.slug) {
      setLocation(`/${book.slug}/chapter/${adhyayNumber}`);
    }
  }, [allBooks, setLocation]);

  const handleLandingSelectPart = useCallback((bookId: string, adhyayNumber: number, khandaNumber: number) => {
    setSelectedBookId(bookId);
    setSelectedCategoryId(null);
    setSelectedSubCategoryId(null);
    setShowLibraryCatalog(false);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setChapterViewAdhyay(adhyayNumber);
    setChapterViewKhanda(khandaNumber);
    const book = allBooks?.find(b => b.id === bookId);
    if (book?.slug) {
      setLocation(`/${book.slug}/chapter/${adhyayNumber}/${khandaNumber}`);
    }
  }, [allBooks, setLocation]);

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
    if (chapterViewAdhyay != null) return;
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        const targetPath = `/${slug}/${verseNumber}`;
        if (locationRef.current !== targetPath) {
          setLocation(targetPath);
        }
      }
    }
  }, [selectedBookId, getBookSlug, setLocation, chapterViewAdhyay]);

  // The "My Library" button shows on every view except the pure home/welcome screen.
  const isHomeScreen = !selectedBookId && !selectedCategoryId && !selectedSubCategoryId && !showAcharyas && !showLibraryCatalog;

  return (
      <div className="flex h-screen w-full overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center h-12 px-3 sm:px-4">
            <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={handleGoHome} data-testid="header-logo">
              <img
                src="https://oneness.org.in/assets/img/favicon.png"
                alt="Advaita Vaaridhi"
                className="h-6 w-6 object-contain"
              />
              <span className="hidden sm:inline font-serif text-sm font-bold text-primary whitespace-nowrap">
                {t("advaitaVaaridhi")}
              </span>
            </div>

            <nav className="flex items-center gap-1 mx-4 min-w-0 flex-1 overflow-x-auto" data-testid="breadcrumb-nav" aria-label="Navigation">
              {(() => {
                const crumbs: { label: string; onClick?: () => void }[] = [];

                crumbs.push({ label: t("home"), onClick: handleGoHome });

                if (selectedCategoryId) {
                  const cat = CATALOG_TREE.find(c => c.id === selectedCategoryId);
                  if (cat) {
                    crumbs.push({
                      label: cat.labelKey ? t(cat.labelKey) !== cat.labelKey ? t(cat.labelKey) : cat.label : cat.label,
                      onClick: selectedSubCategoryId || selectedBookId ? () => {
                        setSelectedSubCategoryId(null);
                        setSelectedBookId(null);
                        setSelectedVerseId(null);
                        setSelectedContent("");
                        setShowTranslationPanel(false);
                        setSelectedAuthor(null);
                        setNavigateToVerse(null);
                        setCurrentVerseNumber(1);
                        setVerseBreadcrumb(null);
                      } : undefined,
                    });
                  }
                  if (selectedSubCategoryId) {
                    const sub = cat?.children?.find(s => s.id === selectedSubCategoryId);
                    if (sub) {
                      crumbs.push({
                        label: sub.labelKey ? t(sub.labelKey) !== sub.labelKey ? t(sub.labelKey) : sub.label : sub.label,
                        onClick: selectedBookId ? () => {
                          setSelectedBookId(null);
                          setSelectedVerseId(null);
                          setSelectedContent("");
                          setShowTranslationPanel(false);
                          setSelectedAuthor(null);
                          setNavigateToVerse(null);
                          setCurrentVerseNumber(1);
                          setVerseBreadcrumb(null);
                        } : undefined,
                      });
                    }
                  }
                } else if (showLibraryCatalog) {
                  // "Browse Library" returns to the catalog root (keeps the catalog
                  // open) rather than going all the way Home. When nothing deeper is
                  // selected it IS the current page, so it renders non-clickable.
                  crumbs.push({
                    label: t("browseTheLibrary"),
                    onClick: selectedBookId ? () => {
                      setSelectedBookId(null);
                      setSelectedVerseId(null);
                      setSelectedContent("");
                      setShowTranslationPanel(false);
                      setSelectedAuthor(null);
                      setNavigateToVerse(null);
                      setCurrentVerseNumber(1);
                      setVerseBreadcrumb(null);
                      setSelectedCategoryId(null);
                      setSelectedSubCategoryId(null);
                      setShowLibraryCatalog(true);
                      setLocation("/");
                    } : undefined,
                  });
                }

                if (selectedBookId) {
                  const selectedBook = allBooks?.find(b => b.id === selectedBookId);
                  if (!selectedCategoryId && selectedBook) {
                    const bookPath = findBookPath(selectedBook);
                    if (bookPath) {
                      const cat = CATALOG_TREE.find(c => c.id === bookPath.categoryId);
                      if (cat) {
                        crumbs.push({
                          label: cat.labelKey ? t(cat.labelKey) !== cat.labelKey ? t(cat.labelKey) : cat.label : cat.label,
                          onClick: () => {
                            setSelectedBookId(null);
                            setSelectedVerseId(null);
                            setSelectedContent("");
                            setShowTranslationPanel(false);
                            setSelectedAuthor(null);
                            setNavigateToVerse(null);
                            setCurrentVerseNumber(1);
                            setVerseBreadcrumb(null);
                            setSelectedCategoryId(bookPath.categoryId);
                            setSelectedSubCategoryId(null);
                            setShowLibraryCatalog(false);
                            setLocation("/");
                          },
                        });
                        if (bookPath.subCategoryId && cat.children) {
                          const sub = cat.children.find(s => s.id === bookPath.subCategoryId);
                          // A single-book subcategory (e.g. "Bhagavad Gita" → the one
                          // Srimad Bhagavad Gita text, or "Brahma Sutra" → Brahmasūtra)
                          // resolves to the same landing as the book itself, so showing
                          // both reads as a duplicate. Skip the subcategory crumb in that
                          // case; keep it when the subcategory holds many texts (e.g.
                          // "Upanishad"), where it's a genuinely distinct list page.
                          const subBookCount = sub
                            ? (allBooks ?? []).filter(b => matchesCategory(sub.categoryMatch, sub.categoryAltMatch, b.category)).length
                            : 0;
                          if (sub && subBookCount !== 1) {
                            crumbs.push({
                              label: sub.labelKey ? t(sub.labelKey) !== sub.labelKey ? t(sub.labelKey) : sub.label : sub.label,
                              onClick: () => {
                                setSelectedBookId(null);
                                setSelectedVerseId(null);
                                setSelectedContent("");
                                setShowTranslationPanel(false);
                                setSelectedAuthor(null);
                                setNavigateToVerse(null);
                                setCurrentVerseNumber(1);
                                setVerseBreadcrumb(null);
                                setSelectedCategoryId(bookPath.categoryId);
                                setSelectedSubCategoryId(bookPath.subCategoryId);
                                setShowLibraryCatalog(false);
                                setLocation("/");
                              },
                            });
                          }
                        }
                      }
                    }
                  }

                  const bookTitle = verseBreadcrumb?.bookTitle || selectedBook?.title || "";
                  if (bookTitle) {
                    crumbs.push({
                      label: bookTitle,
                      onClick: verseBreadcrumb ? handleShowCoverPage : undefined,
                    });
                  }

                  if (verseBreadcrumb) {
                    if (verseBreadcrumb.adhyayTitle && verseBreadcrumb.adhyayNumber != null) {
                      crumbs.push({
                        label: verseBreadcrumb.adhyayTitle,
                        onClick: () => handleSelectChapter(verseBreadcrumb.adhyayNumber!),
                      });
                    }
                    if (verseBreadcrumb.khandaTitle && verseBreadcrumb.khandaTitle !== verseBreadcrumb.adhyayTitle && verseBreadcrumb.adhyayNumber != null && verseBreadcrumb.khandaNumber != null) {
                      crumbs.push({
                        label: verseBreadcrumb.khandaTitle,
                        onClick: () => handleSelectPart(verseBreadcrumb.adhyayNumber!, verseBreadcrumb.khandaNumber!),
                      });
                    }
                    if (verseBreadcrumb.verseLabel) {
                      crumbs.push({ label: verseBreadcrumb.verseLabel });
                    }
                  }
                } else if (coverBook) {
                  crumbs.push({ label: coverBook.title });
                }

                // Collapse an adjacent duplicate label. A single-book subcategory
                // (e.g. the "Brahma Sutra" subcategory holding only "Brahmasūtra")
                // otherwise renders the same name twice in a row. Drop the earlier
                // (subcategory) crumb and keep the more specific book/current one.
                const normCrumb = (s: string) =>
                  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
                const dedupedCrumbs = crumbs.filter((crumb, idx) => {
                  const next = crumbs[idx + 1];
                  return !(next && normCrumb(crumb.label) === normCrumb(next.label));
                });

                return dedupedCrumbs.map((crumb, idx) => (
                  <span key={idx} className="flex items-center gap-1 shrink-0">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                    {crumb.onClick ? (
                      <button
                        onClick={crumb.onClick}
                        className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors bg-transparent border-none p-0 whitespace-nowrap"
                        data-testid={`breadcrumb-part-${idx}`}
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className="text-xs text-foreground/80 font-medium whitespace-nowrap"
                        data-testid={`breadcrumb-part-${idx}`}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ));
              })()}
            </nav>

            <div className="flex items-center gap-1 shrink-0">
              {!isHomeScreen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 mr-1 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={() => setShowMyLibrary(true)}
                  data-testid="button-my-library"
                >
                  <span className="hidden sm:inline">{t("myLibrary")}</span>
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <Popover open={langSearchOpen} onOpenChange={(open) => { setLangSearchOpen(open); if (!open) setLangSearchQuery(""); }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    data-testid="select-header-language"
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
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
              <ThemeToggle />
              {!authLoading && (
                isLoggedIn && user ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                      queryClient.setQueryData(["/api/auth/user"], null);
                    }}
                    data-testid="button-logout"
                    title={t("logOut")}
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setLocation("/auth"); }}
                    data-testid="button-login"
                    title={t("logIn")}
                  >
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )
              )}
            </div>
            </div>
          </header>
          <main className="flex flex-1 min-h-0 overflow-hidden">
            {selectedBookId ? (
              <>
                {!isMobile && readerChapters.length > 0 && !readerNavCollapsed && (
                  <div className="w-72 xl:w-80 shrink-0 h-full" data-testid="reader-nav-sidebar-wrapper">
                    <ReaderNavSidebar
                      bookId={selectedBookId}
                      bookTitle={selectedBook?.title || ""}
                      chapters={readerChapters}
                      currentVerseNumber={currentVerseNumber}
                      chapterViewAdhyay={chapterViewAdhyay}
                      chapterViewKhanda={chapterViewKhanda}
                      onSelectVerse={handleReaderNavSelectVerse}
                      onSelectBook={handleBookSelect}
                      onShowCover={handleShowReaderCover}
                      onOpenAcharya={handleOpenAcharya}
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden">
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
                  showCoverSignal={readerCoverSignal}
                />
                </div>
              </>
            ) : selectedCategoryId && selectedSubCategoryId ? (
              <SubCategoryDetailView
                categoryId={selectedCategoryId}
                subCategoryId={selectedSubCategoryId}
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onSelectChapter={handleLandingSelectChapter}
                onSelectPart={handleLandingSelectPart}
                onSelectVerse={handleLandingSelectVerse}
                onGoBack={() => {
                  setSelectedSubCategoryId(null);
                }}
                languageCode={selectedCommentaryLanguage}
                onCoverBookChange={setCoverBook}
                onOpenAcharya={handleOpenAcharya}
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
            ) : showAcharyas ? (
              <AcharyasPage
                slug={selectedAcharyaSlug}
                onSelectAcharya={(slug) => setSelectedAcharyaSlug(slug)}
                onBack={() => {
                  if (selectedAcharyaSlug) setSelectedAcharyaSlug(null);
                  else setShowAcharyas(false);
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
                onSelectVerse={handleReaderNavSelectVerse}
                onSelectChapter={handleLandingSelectChapter}
                onBrowseLibrary={() => setShowLibraryCatalog(true)}
                onSelectSubCategory={(categoryId, subCategoryId) => {
                  setSelectedCategoryId(categoryId);
                  setSelectedSubCategoryId(subCategoryId);
                }}
                onOpenAcharya={handleOpenAcharya}
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
        <MyLibraryPanel
          open={showMyLibrary}
          onOpenChange={setShowMyLibrary}
          allBooks={allBooks}
          isAuthenticated={isLoggedIn}
          languageCode={selectedCommentaryLanguage}
          onResume={(entry) => handleLandingSelectVerse(entry.bookId, entry.verseNumber)}
          onOpenBookmark={(entry) => {
            if (entry.bookId && typeof entry.verseNumber === "number") {
              handleLandingSelectVerse(entry.bookId, entry.verseNumber);
            }
          }}
          onBrowse={() => setShowLibraryCatalog(true)}
          onOpenSettings={() => {
            if (isLoggedIn && user) setShowPreferences(true);
            else setLocation("/auth");
          }}
        />
      </div>
  );
}

function HomePage() {
  return <HomePageContent />;
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
