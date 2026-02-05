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
import { PanelRightClose, PanelRightOpen, Home as HomeIcon } from "lucide-react";
import NotFound from "@/pages/not-found";

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
  const isMobile = useIsMobile();

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
  };

  const handleSidebarVerseSelect = (verseNumber: number) => {
    setNavigateToVerse(verseNumber);
  };

  const handleVerseChange = (verseNumber: number) => {
    setCurrentVerseNumber(verseNumber);
  };

  const sidebarStyle = {
    "--sidebar-width": "18rem",
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
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/8 to-accent/5 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {selectedBookId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleGoHome}
                  title="Go to home"
                  data-testid="button-go-home"
                >
                  <HomeIcon className="h-4 w-4" />
                </Button>
              )}
              <div className="hidden sm:flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-primary/15 rounded-full blur-sm"></div>
                  <img 
                    src="https://oneness.org.in/assets/img/favicon.png" 
                    alt="Ekatma Dham"
                    className="h-8 w-8 object-contain relative"
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-primary/50">ॐ</span>
                    <span className="font-serif text-sm font-bold text-primary">
                      Ekatma Dham
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tracking-wide">
                    ABODE OF ONENESS
                  </span>
                </div>
              </div>
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
