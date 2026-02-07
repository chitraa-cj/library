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
import { BookReader } from "@/components/book-reader";
import { TranslationPanel } from "@/components/translation-panel";
import { CatalogueView } from "@/components/catalogue-view";
import { MindmapView } from "@/components/mindmap-view";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  PanelRightClose,
  PanelRightOpen,
  Home as HomeIcon,
  BookOpen,
  Network,
  LayoutGrid,
} from "lucide-react";
import NotFound from "@/pages/not-found";

type MobileTab = "catalogue" | "mindmap" | "reader";

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
  const [activeTab, setActiveTab] = useState<MobileTab>("catalogue");
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
    if (isMobile) {
      setActiveTab("catalogue");
    }
  };

  const handleSidebarVerseSelect = (verseNumber: number) => {
    setNavigateToVerse(verseNumber);
  };

  const handleVerseChange = (verseNumber: number) => {
    setCurrentVerseNumber(verseNumber);
  };

  const handleCatalogueSelect = (bookId: string, verseNumber: number) => {
    setSelectedBookId(bookId);
    setNavigateToVerse(verseNumber);
    setCurrentVerseNumber(verseNumber);
    setSelectedVerseId(null);
    setSelectedContent("");
    if (isMobile) {
      setActiveTab("reader");
    }
  };

  const handleMindmapSelect = (bookId: string, verseNumber: number) => {
    setSelectedBookId(bookId);
    setNavigateToVerse(verseNumber);
    setCurrentVerseNumber(verseNumber);
    setSelectedVerseId(null);
    setSelectedContent("");
    if (isMobile) {
      setActiveTab("reader");
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "22rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/8 to-accent/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative" onClick={handleGoHome}>
              <img 
                src="https://oneness.org.in/assets/img/favicon.png" 
                alt="Ekatma Dham"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="flex flex-col cursor-pointer" onClick={handleGoHome}>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-primary/50">ॐ</span>
                <span className="font-serif text-sm font-bold text-primary">
                  Ekatma Dham
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground tracking-wide">
                ABODE OF ONENESS
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeTab === "reader" && selectedBookId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoHome}
                data-testid="button-go-home-mobile"
              >
                <HomeIcon className="h-4 w-4" />
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeTab === "catalogue" && (
            <CatalogueView onSelectVerse={handleCatalogueSelect} />
          )}
          {activeTab === "mindmap" && (
            <MindmapView onSelectVerse={handleMindmapSelect} />
          )}
          {activeTab === "reader" && selectedBookId ? (
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
          ) : activeTab === "reader" && !selectedBookId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a mantra from the catalogue to start reading
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab("catalogue")}
                data-testid="button-go-to-catalogue"
              >
                Browse Catalogue
              </Button>
            </div>
          ) : null}
        </main>

        <nav className="flex items-center border-t border-primary/20 bg-card/95 backdrop-blur-sm shrink-0 safe-area-bottom" data-testid="nav-bottom-tabs">
          <button
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 transition-colors ${
              activeTab === "catalogue"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("catalogue")}
            data-testid="tab-catalogue"
          >
            <LayoutGrid className={`h-5 w-5 ${activeTab === "catalogue" ? "text-primary" : ""}`} />
            <span className="text-[10px] font-medium">Catalogue</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 transition-colors ${
              activeTab === "mindmap"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("mindmap")}
            data-testid="tab-mindmap"
          >
            <Network className={`h-5 w-5 ${activeTab === "mindmap" ? "text-primary" : ""}`} />
            <span className="text-[10px] font-medium">Mindmap</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 transition-colors ${
              activeTab === "reader"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("reader")}
            data-testid="tab-reader"
          >
            <BookOpen className={`h-5 w-5 ${activeTab === "reader" ? "text-primary" : ""}`} />
            <span className="text-[10px] font-medium">Reader</span>
          </button>
        </nav>
      </div>
    );
  }

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
              <div className="flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
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
              {!selectedBookId && (
                <div className="flex items-center border border-border rounded-md">
                  <Button
                    variant={activeTab === "catalogue" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("catalogue")}
                    className="gap-1.5"
                    data-testid="button-desktop-catalogue"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Catalogue
                  </Button>
                  <Button
                    variant={activeTab === "mindmap" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("mindmap")}
                    className="gap-1.5"
                    data-testid="button-desktop-mindmap"
                  >
                    <Network className="h-3.5 w-3.5" />
                    Mindmap
                  </Button>
                </div>
              )}
              {selectedBookId && (
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
            ) : activeTab === "mindmap" ? (
              <MindmapView onSelectVerse={handleCatalogueSelect} />
            ) : (
              <CatalogueView onSelectVerse={handleCatalogueSelect} />
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
