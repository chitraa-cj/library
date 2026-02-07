import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import { PanelRightClose, PanelRightOpen, ChevronRight, LogIn, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

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
  const isMobile = useIsMobile();
  const { user, isLoading: authLoading, isAuthenticated: isLoggedIn } = useAuth();

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
  };

  const handleSidebarVerseSelect = (verseNumber: number) => {
    setNavigateToVerse(verseNumber);
  };

  const handleVerseChange = (verseNumber: number) => {
    setCurrentVerseNumber(verseNumber);
  };

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
                <nav className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden" data-testid="breadcrumb-nav" aria-label="Current verse position">
                  <Badge variant="secondary" className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 h-5 shrink-0" data-testid="text-numeric-label">
                    {verseBreadcrumb.numericLabel}
                  </Badge>
                  <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 text-[11px] sm:text-xs text-muted-foreground overflow-hidden">
                    <span className="hidden lg:inline truncate max-w-[100px] font-medium text-foreground/70">{verseBreadcrumb.bookTitle}</span>
                    {verseBreadcrumb.adhyayTitle && (
                      <>
                        <ChevronRight className="hidden lg:block h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="hidden md:inline truncate max-w-[100px] lg:max-w-[120px]">{verseBreadcrumb.adhyayTitle}</span>
                      </>
                    )}
                    {verseBreadcrumb.khandaTitle && (
                      <>
                        <ChevronRight className="hidden md:block h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="hidden md:inline truncate max-w-[100px] lg:max-w-[120px]">{verseBreadcrumb.khandaTitle}</span>
                      </>
                    )}
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    <span className="truncate max-w-[90px] sm:max-w-[120px] md:max-w-[140px] text-foreground/80 font-medium">{verseBreadcrumb.verseLabel}</span>
                  </div>
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
              {selectedBookId && !isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                  title={rightPanelCollapsed ? "Show commentary panel" : "Hide commentary panel"}
                  data-testid="button-toggle-right-panel"
                >
                  {rightPanelCollapsed ? (
                    <PanelRightOpen className="h-4 w-4" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" />
                  )}
                </Button>
              )}
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
                      onClick={() => { window.location.href = "/api/logout"; }}
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
                    onClick={() => { window.location.href = "/api/login"; }}
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
