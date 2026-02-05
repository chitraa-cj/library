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
import NotFound from "@/pages/not-found";

function Home() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedCommentaryLanguage, setSelectedCommentaryLanguage] = useState<string | null>(null);
  const [navigateToVerse, setNavigateToVerse] = useState<number | null>(null);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(1);
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
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="hidden sm:flex items-center gap-2">
                <img 
                  src="https://oneness.org.in/assets/img/ekatma2.png" 
                  alt="Ekatma Dham"
                  className="h-10 w-auto"
                />
                <div className="flex flex-col">
                  <span className="font-serif text-sm font-bold text-primary">
                    Ekatma Dham
                  </span>
                  <span className="text-[10px] text-muted-foreground tracking-wide">
                    ABODE OF ONENESS
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex flex-1 overflow-hidden">
            {selectedBookId ? (
              <>
                <BookReader
                  bookId={selectedBookId}
                  onVerseSelect={handleVerseSelect}
                  selectedVerseId={selectedVerseId}
                  selectedAuthor={selectedAuthor}
                  selectedCommentaryLanguage={selectedCommentaryLanguage}
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
      <Route path="/" component={Home} />
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
