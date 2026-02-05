import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Loader2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
}

export function AppSidebar({ selectedBookId, onSelectBook, onSelectVerse, selectedVerseNumber }: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const { isMobile, setOpenMobile } = useSidebar();

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

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-primary/30 bg-gradient-to-b from-primary/15 to-primary/5">
        <div className="flex items-center gap-3 mb-4">
          <img 
            src="https://oneness.org.in/assets/img/ekatma2.png" 
            alt="Ekatma Dham"
            className="h-12 w-auto"
          />
          <div className="flex flex-col">
            <span className="font-serif font-bold text-base text-primary">Ekatma Dham</span>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Abode of Oneness</span>
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
                <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {category}
                </SidebarGroupLabel>
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
                                className={`mx-2 rounded-lg transition-all ${
                                  selectedBookId === book.id
                                    ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                                    : "hover:bg-sidebar-accent/50"
                                }`}
                                data-testid={`button-book-${book.id}`}
                              >
                                <div className={`p-1.5 rounded-md ${selectedBookId === book.id ? 'bg-primary/20' : 'bg-muted/50'}`}>
                                  <BookOpen className={`h-4 w-4 shrink-0 ${selectedBookId === book.id ? 'text-primary' : ''}`} />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className={`font-serif text-sm truncate ${selectedBookId === book.id ? 'font-semibold' : ''}`}>{book.title}</span>
                                  {book.author && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {book.author}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {book.totalVerses && book.totalVerses > 0 && (
                                    <Badge variant={selectedBookId === book.id ? "default" : "secondary"} className="text-xs">
                                      {book.totalVerses}
                                    </Badge>
                                  )}
                                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                                </div>
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {selectedBookId === book.id && verses.length > 0 && (
                                <SidebarMenuSub>
                                  {verses.map((verse) => (
                                    <SidebarMenuSubItem key={verse.id}>
                                      <SidebarMenuSubButton
                                        onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
                                        className={`text-xs ${
                                          selectedVerseNumber === verse.verseNumber
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                        data-testid={`button-verse-nav-${verse.verseNumber}`}
                                      >
                                        <span className="truncate">
                                          {verse.sectionTitle || `Verse ${verse.verseNumber}`}
                                        </span>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
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
