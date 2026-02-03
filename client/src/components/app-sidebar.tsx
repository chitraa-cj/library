import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Loader2, Library } from "lucide-react";
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
} from "@/components/ui/sidebar";
import type { Book } from "@shared/schema";

interface AppSidebarProps {
  selectedBookId: string | null;
  onSelectBook: (bookId: string) => void;
}

const categoryIcons: Record<string, string> = {
  "Upanishad": "sacred-texts",
  "Bhashya": "commentary",
  "Sutra": "aphorisms",
  "default": "scripture"
};

export function AppSidebar({ selectedBookId, onSelectBook }: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: books = [], isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
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
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground">
            <Library className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-sm">Sacred Texts</span>
            <span className="text-xs text-muted-foreground">Library</span>
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
                    {categoryBooks.map((book) => (
                      <SidebarMenuItem key={book.id}>
                        <SidebarMenuButton
                          onClick={() => onSelectBook(book.id)}
                          className={`mx-2 rounded-md transition-colors ${
                            selectedBookId === book.id
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : ""
                          }`}
                          data-testid={`button-book-${book.id}`}
                        >
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-serif text-sm truncate">{book.title}</span>
                            {book.author && (
                              <span className="text-xs text-muted-foreground truncate">
                                {book.author}
                              </span>
                            )}
                          </div>
                          {book.totalVerses && book.totalVerses > 0 && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {book.totalVerses}
                            </Badge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
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
