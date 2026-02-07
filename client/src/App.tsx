import { useState, useEffect, useCallback } from "react";
import { Switch, Route, useLocation, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { WelcomeScreen } from "@/components/welcome-screen";
import { BookReader } from "@/components/book-reader";
import { TranslationPanel } from "@/components/translation-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, LogIn, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import type { Book } from "@shared/schema";

interface VerseBreadcrumb {
  bookTitle: string;
  adhyayNumber: number | null;
  adhyayTitle: string | null;
  khandaNumber: number | null;
  khandaTitle: string | null;
  verseLabel: string;
  numericLabel: string;
}

function HomePage() {
  const params = useParams<{ bookSlug?: string; verseNumber?: string }>();
  const [location, setLocation] = useLocation();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedCommentaryLanguage, setSelectedCommentaryLanguage] = useState<string | null>(null);
  const [navigateToVerse, setNavigateToVerse] = useState<number | null>(null);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(1);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [verseBreadcrumb, setVerseBreadcrumb] = useState<VerseBreadcrumb | null>(null);
  const [pendingNoteText, setPendingNoteText] = useState<string | null>(null);
  const [urlInitialized, setUrlInitialized] = useState(false);
  const isMobile = useIsMobile();
  const { user, isLoading: authLoading, isAuthenticated: isLoggedIn } = useAuth();

  const { data: allBooks } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const bookSlugFromUrl = params?.bookSlug || null;
  const verseNumberFromUrl = params?.verseNumber ? parseInt(params.verseNumber, 10) : null;

  useEffect(() => {
    if (urlInitialized || !allBooks) return;

    if (bookSlugFromUrl) {
      const matchedBook = allBooks.find(b => b.slug === bookSlugFromUrl);
      if (matchedBook) {
        setSelectedBookId(matchedBook.id);
        if (verseNumberFromUrl !== null && !isNaN(verseNumberFromUrl)) {
          setNavigateToVerse(verseNumberFromUrl);
          setCurrentVerseNumber(verseNumberFromUrl);
        }
      } else {
        setLocation("/");
      }
    }
    setUrlInitialized(true);
  }, [allBooks, bookSlugFromUrl, verseNumberFromUrl, urlInitialized, setLocation]);

  const getBookSlug = useCallback((bookId: string): string | null => {
    const book = allBooks?.find(b => b.id === bookId);
    return book?.slug || null;
  }, [allBooks]);

  const handleVerseSelect = (verseId: string, content: string) => {
    setSelectedVerseId(verseId);
    setSelectedContent(content);
    if (isMobile) {
      setShowTranslationPanel(true);
    }
  };

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedVerseId(null);
    setSelectedContent("");
    setShowTranslationPanel(false);
    setSelectedAuthor(null);
    setSelectedCommentaryLanguage(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
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
    setSelectedCommentaryLanguage(null);
    setNavigateToVerse(null);
    setCurrentVerseNumber(1);
    setVerseBreadcrumb(null);
    setLocation("/");
  };

  const handleSidebarVerseSelect = (verseNumber: number) => {
    setNavigateToVerse(verseNumber);
  };

  const handleVerseChange = useCallback((verseNumber: number) => {
    setCurrentVerseNumber(verseNumber);
    if (selectedBookId) {
      const slug = getBookSlug(selectedBookId);
      if (slug) {
        const targetPath = `/${slug}/${verseNumber}`;
        if (location !== targetPath) {
          setLocation(targetPath);
        }
      }
    }
  }, [selectedBookId, getBookSlug, location, setLocation]);

  const sidebarStyle = {
    "--sidebar-width": "22rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar
          selectedBookId={selectedBookId}
          onSelectBook={handleBookSelect}
          onSelectVerse={handleSidebarVerseSelect}
          selectedVerseNumber={currentVerseNumber}
          onGoHome={handleGoHome}
          onGoBack={selectedBookId ? handleGoHome : undefined}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/8 to-accent/5 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {selectedBookId && verseBreadcrumb ? (
                <nav className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden" data-testid="breadcrumb-nav" aria-label="Current verse position" style={{ direction: "rtl" }}>
                  <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 text-[11px] sm:text-xs text-muted-foreground overflow-hidden" style={{ direction: "ltr" }}>
                    <span
                      className="hidden lg:inline truncate max-w-[120px] font-medium text-foreground/70 shrink-0 cursor-pointer hover:text-primary transition-colors"
                      onClick={handleGoHome}
                      title={verseBreadcrumb.bookTitle}
                      data-testid="breadcrumb-book"
                    >
                      {verseBreadcrumb.bookTitle}
                    </span>
                    {verseBreadcrumb.adhyayTitle && (
                      <>
                        <ChevronRight className="hidden lg:block h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="hidden lg:inline truncate max-w-[100px] shrink-0">{verseBreadcrumb.adhyayTitle}</span>
                      </>
                    )}
                    {verseBreadcrumb.khandaTitle && (
                      <>
                        <ChevronRight className="hidden xl:block h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="hidden xl:inline truncate max-w-[100px] shrink-0">{verseBreadcrumb.khandaTitle}</span>
                      </>
                    )}
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    <span className="truncate text-foreground/80 font-medium max-w-[140px]" title={verseBreadcrumb.verseLabel} data-testid="breadcrumb-verse">
                      {verseBreadcrumb.verseLabel}
                    </span>
                    {selectedAuthor && (
                      <>
                        <ChevronRight className="hidden md:block h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="hidden md:inline truncate max-w-[130px] text-muted-foreground/70 shrink-0" title={selectedAuthor} data-testid="breadcrumb-commentary">
                          {selectedAuthor}
                        </span>
                      </>
                    )}
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 h-5 shrink-0" data-testid="text-numeric-label" style={{ direction: "ltr" }}>
                    {verseBreadcrumb.numericLabel}
                  </Badge>
                </nav>
              ) : (
                <div className="hidden sm:flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-primary/15 rounded-full blur-sm"></div>
                    <img 
                      src="https://oneness.org.in/assets/img/favicon.png" 
                      alt="Advaita Sharada"
                      className="h-8 w-8 object-contain relative"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-primary/50">ॐ</span>
                      <span className="font-serif text-sm font-bold text-primary">
                        Advaita Sharada
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tracking-wide">
                      ENCYCLOPAEDIA OF ADVAITA VEDANTA
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                      size="icon"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                        queryClient.setQueryData(["/api/auth/user"], null);
                      }}
                      title="Log out"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setLocation("/auth"); }}
                    title="Log in"
                    data-testid="button-login"
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                )
              )}
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
                  onLanguageChange={setSelectedCommentaryLanguage}
                  navigateToVerse={navigateToVerse}
                  onVerseChange={handleVerseChange}
                  onBreadcrumbChange={setVerseBreadcrumb}
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
                  onLanguageChange={setSelectedCommentaryLanguage}
                  open={showTranslationPanel}
                  onOpenChange={setShowTranslationPanel}
                  collapsed={rightPanelCollapsed}
                  onCollapsedChange={setRightPanelCollapsed}
                  pendingNoteText={pendingNoteText}
                  onPendingNoteTextConsumed={() => setPendingNoteText(null)}
                />
              </>
            ) : (
              <WelcomeScreen />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/:bookSlug" component={HomePage} />
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
