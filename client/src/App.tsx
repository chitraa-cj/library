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
import { VideoPopup } from "@/components/video-popup";
import { useIsMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";

function Home() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedCommentaryLanguage, setSelectedCommentaryLanguage] = useState<string | null>(null);
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
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="font-serif text-sm text-muted-foreground hidden sm:block">
                Sacred Texts Library
              </span>
            </div>
            <div className="flex items-center gap-2">
              <VideoPopup 
                videoId="8ELHatzdtAk"
                title="Introduction to Sacred Texts"
              />
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
