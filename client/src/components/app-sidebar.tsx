import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Loader2, ChevronRight, ChevronDown, Home, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Book, Verse } from "@shared/schema";

interface AppSidebarProps {
  selectedBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onSelectVerse?: (verseNumber: number) => void;
  selectedVerseNumber?: number;
  onGoHome?: () => void;
  onGoBack?: () => void;
}

interface AdhyayGroup {
  adhyayNumber: number;
  adhyayTitle: string;
  khandas: KhandaGroup[];
}

interface KhandaGroup {
  khandaNumber: number;
  khandaTitle: string;
  verses: Verse[];
}

function hasHierarchyData(verses: Verse[]): boolean {
  return verses.some((v) => v.adhyayNumber != null && v.khandaNumber != null);
}

function buildHierarchy(verses: Verse[]): AdhyayGroup[] {
  const hierarchyVerses = verses.filter(
    (v) => v.adhyayNumber != null && v.khandaNumber != null
  );
  if (hierarchyVerses.length === 0) return [];

  const adhyayMap = new Map<number, AdhyayGroup>();

  for (const verse of hierarchyVerses) {
    const adhyayNum = verse.adhyayNumber!;
    const adhyayTitle = verse.adhyayTitle ?? `Adhyay ${adhyayNum}`;
    const khandaNum = verse.khandaNumber!;
    const khandaTitle = verse.khandaTitle ?? `Khanda ${khandaNum}`;

    if (!adhyayMap.has(adhyayNum)) {
      adhyayMap.set(adhyayNum, {
        adhyayNumber: adhyayNum,
        adhyayTitle,
        khandas: [],
      });
    }

    const adhyay = adhyayMap.get(adhyayNum)!;
    let khanda = adhyay.khandas.find((k) => k.khandaNumber === khandaNum);
    if (!khanda) {
      khanda = { khandaNumber: khandaNum, khandaTitle, verses: [] };
      adhyay.khandas.push(khanda);
    }
    khanda.verses.push(verse);
  }

  const sorted = Array.from(adhyayMap.values()).sort(
    (a, b) => a.adhyayNumber - b.adhyayNumber
  );
  for (const adhyay of sorted) {
    adhyay.khandas.sort((a, b) => a.khandaNumber - b.khandaNumber);
    for (const khanda of adhyay.khandas) {
      khanda.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    }
  }
  return sorted;
}

export function AppSidebar({ selectedBookId, onSelectBook, onSelectVerse, selectedVerseNumber, onGoHome, onGoBack }: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [expandedAdhyays, setExpandedAdhyays] = useState<Set<string>>(new Set());
  const [expandedKhandas, setExpandedKhandas] = useState<Set<string>>(new Set());
  const { isMobile, setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleBookSelect = (bookId: string) => {
    onSelectBook(bookId);
    setExpandedBooks(new Set([bookId]));
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleVerseSelect = (bookId: string, verseNumber: number) => {
    if (selectedBookId !== bookId) {
      onSelectBook(bookId);
    }
    if (onSelectVerse) {
      onSelectVerse(verseNumber);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const toggleBookExpand = (bookId: string) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId);
    } else {
      newExpanded.add(bookId);
    }
    setExpandedBooks(newExpanded);
  };

  const toggleAdhyay = (key: string) => {
    const next = new Set(expandedAdhyays);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedAdhyays(next);
  };

  const toggleKhanda = (key: string) => {
    const next = new Set(expandedKhandas);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKhandas(next);
  };

  const { data: books = [], isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: selectedBookData } = useQuery<{ book: Book; verses: Verse[] }>({
    queryKey: ["/api/books", selectedBookId],
    enabled: !!selectedBookId,
  });

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedBooks = filteredBooks.reduce((acc, book) => {
    const category = book.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(book);
    return acc;
  }, {} as Record<string, Book[]>);

  const hierarchy = useMemo(() => {
    if (!selectedBookData?.verses) return [];
    return buildHierarchy(selectedBookData.verses);
  }, [selectedBookData?.verses]);

  const hasHierarchy = hierarchy.length > 0 && hasHierarchyData(selectedBookData?.verses ?? []);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={`border-b border-primary/30 bg-gradient-to-b from-primary/20 via-primary/10 to-transparent ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <img 
              src="https://oneness.org.in/assets/img/favicon.png" 
              alt="Ekatma Dham"
              className="h-8 w-8 object-contain cursor-pointer"
              onClick={onGoHome}
            />
            {selectedBookId && onGoBack && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onGoBack}
                    data-testid="button-go-back-collapsed"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Back</TooltipContent>
              </Tooltip>
            )}
            {onGoHome && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onGoHome}
                    data-testid="button-go-home-collapsed"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Home</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={onGoHome}>
                <div className="relative">
                  <div className="absolute -inset-1 bg-primary/20 rounded-full blur-md"></div>
                  <img 
                    src="https://oneness.org.in/assets/img/favicon.png" 
                    alt="Ekatma Dham"
                    className="h-10 w-10 object-contain relative"
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-primary/50">ॐ</span>
                    <span className="font-serif font-bold text-base text-primary">Ekatma Dham</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Abode of Oneness</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedBookId && onGoBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onGoBack}
                    title="Go back"
                    data-testid="button-go-back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {onGoHome && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onGoHome}
                    title="Go to home"
                    data-testid="button-go-home"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search texts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-books"
              />
            </div>
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-10rem)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedBooks).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No texts found" : "No texts available yet"}
              </p>
            </div>
          ) : (
            Object.entries(groupedBooks).map(([category, categoryBooks]) => (
              <SidebarGroup key={category}>
                {!isCollapsed && (
                  <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {category}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {categoryBooks.map((book) => {
                      const isExpanded = expandedBooks.has(book.id) || selectedBookId === book.id;
                      const verses = selectedBookId === book.id && selectedBookData?.verses ? selectedBookData.verses : [];
                      
                      return (
                        <Collapsible
                          key={book.id}
                          open={isExpanded}
                          onOpenChange={() => toggleBookExpand(book.id)}
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                onClick={() => handleBookSelect(book.id)}
                                tooltip={book.title}
                                className={`${isCollapsed ? 'mx-1 my-1 p-2 justify-center' : 'mx-2 px-3 py-3'} rounded-xl transition-all shadow-sm ${
                                  selectedBookId === book.id
                                    ? "bg-gradient-to-br from-primary/15 via-primary/10 to-orange-100/50 dark:to-orange-900/20 text-primary shadow-primary/10"
                                    : "bg-gradient-to-br from-background/80 to-muted/30 hover:from-primary/5 hover:to-primary/10"
                                }`}
                                data-testid={`button-book-${book.id}`}
                              >
                                <div className={`${isCollapsed ? 'p-1.5' : 'p-2'} rounded-lg shrink-0 ${selectedBookId === book.id ? 'bg-primary/15' : 'bg-muted/50'}`}>
                                  <BookOpen className={`h-4 w-4 ${selectedBookId === book.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                </div>
                                {!isCollapsed && (
                                  <>
                                    <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                                      <span className={`font-serif text-sm leading-snug ${selectedBookId === book.id ? 'font-semibold text-primary' : 'font-medium'}`}>{book.title}</span>
                                      {book.author && (
                                        <span className={`text-xs leading-snug ${selectedBookId === book.id ? 'text-primary/60' : 'text-muted-foreground'}`}>
                                          {book.author}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {book.totalVerses && book.totalVerses > 0 && (
                                        <Badge variant={selectedBookId === book.id ? "default" : "secondary"} className="text-[10px] font-medium px-1.5 h-5">
                                          {book.totalVerses}
                                        </Badge>
                                      )}
                                      <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                                    </div>
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {!isCollapsed && selectedBookId === book.id && verses.length > 0 && (
                                <SidebarMenuSub className="py-2 space-y-0.5">
                                  {hasHierarchy ? (
                                    hierarchy.map((adhyay) => {
                                      const adhyayKey = `${book.id}-a${adhyay.adhyayNumber}`;
                                      const isAdhyayOpen = expandedAdhyays.has(adhyayKey);
                                      const isCurrentAdhyay = adhyay.khandas.some(k =>
                                        k.verses.some(v => v.verseNumber === selectedVerseNumber)
                                      );

                                      return (
                                        <SidebarMenuSubItem key={adhyayKey}>
                                          <SidebarMenuSubButton
                                            onClick={() => toggleAdhyay(adhyayKey)}
                                            className={`text-sm py-2 px-2 rounded-md transition-colors h-auto min-h-[2rem] overflow-visible [&>span]:!truncate-none ${
                                              isCurrentAdhyay && !isAdhyayOpen
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:text-foreground"
                                            }`}
                                            data-testid={`button-adhyay-${adhyay.adhyayNumber}`}
                                          >
                                            <span className="flex items-center gap-2 whitespace-normal leading-snug w-full">
                                              {isAdhyayOpen ? (
                                                <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 shrink-0" />
                                              )}
                                              <Badge variant="secondary" className="text-[10px] px-1.5 h-4 shrink-0 font-mono">
                                                {adhyay.adhyayNumber}
                                              </Badge>
                                              <span className="text-xs font-medium">{adhyay.adhyayTitle}</span>
                                            </span>
                                          </SidebarMenuSubButton>

                                          {isAdhyayOpen && (
                                            <div className="ml-3 pl-2 border-l border-border/40 mt-1 space-y-0.5">
                                              {adhyay.khandas.map((khanda) => {
                                                const khandaKey = `${adhyayKey}-k${khanda.khandaNumber}`;
                                                const isKhandaOpen = expandedKhandas.has(khandaKey);
                                                const isCurrentKhanda = khanda.verses.some(
                                                  (v) => v.verseNumber === selectedVerseNumber
                                                );

                                                return (
                                                  <div key={khandaKey}>
                                                    <button
                                                      onClick={() => toggleKhanda(khandaKey)}
                                                      className={`flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors ${
                                                        isCurrentKhanda && !isKhandaOpen
                                                          ? "bg-primary/10 text-primary font-medium"
                                                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                                                      }`}
                                                      data-testid={`button-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                                                    >
                                                      {isKhandaOpen ? (
                                                        <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                                                      ) : (
                                                        <ChevronRight className="h-3 w-3 shrink-0" />
                                                      )}
                                                      <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0 font-mono border-muted-foreground/30">
                                                        {adhyay.adhyayNumber}.{khanda.khandaNumber}
                                                      </Badge>
                                                      <span className="truncate">{khanda.khandaTitle}</span>
                                                    </button>

                                                    {isKhandaOpen && (
                                                      <div className="ml-3 pl-2 border-l border-border/30 mt-0.5 space-y-0.5">
                                                        {khanda.verses.map((verse, idx) => {
                                                          const verseLabel = `${adhyay.adhyayNumber}.${khanda.khandaNumber}.${idx + 1}`;
                                                          return (
                                                            <button
                                                              key={verse.id}
                                                              onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
                                                              className={`flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors ${
                                                                selectedVerseNumber === verse.verseNumber
                                                                  ? "bg-primary/15 text-primary font-medium"
                                                                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                                                              }`}
                                                              data-testid={`button-verse-nav-${verse.verseNumber}`}
                                                            >
                                                              <span className="font-mono text-[10px] text-primary/70 shrink-0 min-w-[2rem]">
                                                                {verseLabel}
                                                              </span>
                                                              <span className="whitespace-normal leading-snug text-wrap break-words">
                                                                {verse.sectionTitle || `Mantra ${verse.verseNumber}`}
                                                              </span>
                                                            </button>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </SidebarMenuSubItem>
                                      );
                                    })
                                  ) : (
                                    verses.map((verse) => (
                                      <SidebarMenuSubItem key={verse.id}>
                                        <SidebarMenuSubButton
                                          onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
                                          className={`text-sm py-2.5 px-3 rounded-md transition-colors h-auto min-h-[2.5rem] overflow-visible [&>span]:!truncate-none ${
                                            selectedVerseNumber === verse.verseNumber
                                              ? "bg-primary/15 text-primary font-medium border-l-2 border-primary"
                                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                                          }`}
                                          data-testid={`button-verse-nav-${verse.verseNumber}`}
                                        >
                                          <span className="whitespace-normal leading-snug text-wrap break-words">
                                            {verse.sectionTitle || `Verse ${verse.verseNumber}`}
                                          </span>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))
                                  )}
                                </SidebarMenuSub>
                              )}
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          )}
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
