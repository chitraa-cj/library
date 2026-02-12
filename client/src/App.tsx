import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { WelcomeScreen, CategoryDetailView } from "@/components/welcome-screen";
import { BookReader } from "@/components/book-reader";
import { TranslationPanel } from "@/components/translation-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, Globe, LogIn, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { PreferencesDialog } from "@/components/preferences-dialog";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
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
  const [selectedCommentaryLanguage, setSelectedCommentaryLanguage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredLanguage') || 'english';
    }
    return 'english';
  });
  const [navigateToVerse, setNavigateToVerse] = useState<number | null>(null);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(1);
  const [chapterViewAdhyay, setChapterViewAdhyay] = useState<number | null>(null);
  const [chapterViewKhanda, setChapterViewKhanda] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
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
    if (selectedBookId && commentaryOptions?.languages?.length) {
      const allLangMap = new Map((allLanguages || []).map(l => [l.code, l]));
      return commentaryOptions.languages.map(bl => {
        const full = allLangMap.get(bl.code);
        return {
          code: bl.code,
          name: full?.nativeName || full?.name || bl.name || bl.code,
        };
      });
    }
    const seen = new Set<string>();
    return (allLanguages || []).reduce<{code: string; name: string}[]>((acc, l) => {
      const displayName = l.nativeName || l.name;
      if (!seen.has(displayName)) {
        seen.add(displayName);
        acc.push({ code: l.code, name: displayName });
      }
      return acc;
    }, []);
  }, [selectedBookId, commentaryOptions, allLanguages]);

  useEffect(() => {
    if (!commentaryOptions?.languages?.length || !selectedCommentaryLanguage) return;
    const bookLangCodes = commentaryOptions.languages.map(l => l.code);
    if (!bookLangCodes.includes(selectedCommentaryLanguage)) {
      const equivalents: Record<string, string[]> = {
        hi: ["devanagari", "sa"],
        devanagari: ["hi", "sa"],
        sa: ["devanagari", "hi"],
      };
      const alts = equivalents[selectedCommentaryLanguage] || [];
      const match = alts.find(alt => bookLangCodes.includes(alt));
      if (match) {
        setSelectedCommentaryLanguage(match);
      } else {
        handleGlobalLanguageChange(bookLangCodes[0]);
      }
    }
  }, [commentaryOptions]);

  const headerAuthors = useMemo(() => {
    if (!commentaryOptions) return [];
    if (!selectedCommentaryLanguage) return commentaryOptions.authors;
    return commentaryOptions.authors.filter(a => a.languageCodes.includes(selectedCommentaryLanguage));
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
      setSelectedCommentaryLanguage(user.preferredLanguage);
      localStorage.setItem('preferredLanguage', user.preferredLanguage);
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
    setSelectedVerseId(verseId);
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
    setSelectedCategoryId(null);
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
            setSelectedBookId(null);
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
                <nav className="flex items-center gap-1 min-w-0 flex-wrap" data-testid="breadcrumb-nav" aria-label="Current verse position">
                  {verseBreadcrumb.adhyayTitle && (
                    <span className="truncate text-muted-foreground text-xs max-w-[120px] sm:max-w-[160px]" title={verseBreadcrumb.adhyayTitle} data-testid="breadcrumb-chapter">
                      {verseBreadcrumb.adhyayTitle}
                    </span>
                  )}
                  {verseBreadcrumb.khandaTitle && (
                    <>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="truncate text-muted-foreground text-xs max-w-[100px] sm:max-w-[140px]" title={verseBreadcrumb.khandaTitle} data-testid="breadcrumb-part">
                        {verseBreadcrumb.khandaTitle}
                      </span>
                    </>
                  )}
                  {(verseBreadcrumb.adhyayTitle || verseBreadcrumb.khandaTitle) && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="truncate text-foreground/80 font-medium text-xs max-w-[140px]" title={verseBreadcrumb.verseLabel} data-testid="breadcrumb-verse">
                    {verseBreadcrumb.verseLabel}
                  </span>
                </nav>
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
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                <Select
                  value={selectedCommentaryLanguage || "english"}
                  onValueChange={handleGlobalLanguageChange}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[80px] max-w-[130px] text-xs border-none bg-transparent shadow-none focus:ring-0 px-1.5" data-testid="select-header-language">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {headerLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} data-testid={`option-header-lang-${lang.code}`}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedBookId && headerAuthors.length > 0 && (
                <div className="flex items-center gap-1" data-testid="commentator-selector-header">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                  <Select
                    value={selectedAuthor || headerAuthors[0]?.authorName || ""}
                    onValueChange={setSelectedAuthor}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[80px] max-w-[150px] text-xs border-none bg-transparent shadow-none focus:ring-0 px-1.5" data-testid="select-header-commentator">
                      <SelectValue placeholder={t("commentator")} />
                    </SelectTrigger>
                    <SelectContent>
                      {headerAuthors.map((author) => (
                        <SelectItem key={author.authorName} value={author.authorName} data-testid={`option-header-author-${author.authorName}`}>
                          {tc(author.authorName, bookAuthorTranslations)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            ) : selectedCategoryId ? (
              <CategoryDetailView
                categoryId={selectedCategoryId}
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onGoBack={handleGoHome}
                languageCode={selectedCommentaryLanguage}
              />
            ) : (
              <WelcomeScreen
                books={allBooks || []}
                onSelectBook={handleBookSelect}
                onSelectCategory={(categoryId) => {
                  setSelectedCategoryId(categoryId);
                }}
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
