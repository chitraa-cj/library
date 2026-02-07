import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  LayoutGrid,
  List,
  FileText,
  BookOpen,
  Sparkles,
} from "lucide-react";
import type { Book, Verse } from "@shared/schema";

type ViewMode = "icon" | "list" | "detailed";

interface CatalogueViewProps {
  onSelectVerse: (bookId: string, verseNumber: number) => void;
}

interface BookWithVerses extends Book {
  verses: Verse[];
}

export function CatalogueView({ onSelectVerse }: CatalogueViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("catalogue-view-mode") as ViewMode) || "icon";
    }
    return "icon";
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("catalogue-view-mode", viewMode);
  }, [viewMode]);

  const { data: books = [], isLoading: booksLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const bookId = books[0]?.id;

  const { data: bookData, isLoading: bookLoading } = useQuery<BookWithVerses>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const isLoading = booksLoading || bookLoading;
  const verses = bookData?.verses || [];

  const filteredVerses = verses.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (v.sectionTitle || "").toLowerCase().includes(q) ||
      `verse ${v.verseNumber}`.includes(q) ||
      `mantra ${v.verseNumber}`.includes(q)
    );
  });

  const handleSelect = (verse: Verse) => {
    if (bookId) {
      onSelectVerse(bookId, verse.verseNumber);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2 space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search mantras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-catalogue-search"
            />
          </div>
          <div className="flex items-center border border-border rounded-md">
            <Button
              variant={viewMode === "icon" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("icon")}
              title="Grid view"
              data-testid="button-view-icon"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              title="List view"
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "detailed" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("detailed")}
              title="Detailed view"
              data-testid="button-view-detailed"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredVerses.length} section{filteredVerses.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredVerses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No mantras found</p>
          </div>
        ) : viewMode === "icon" ? (
          <IconView verses={filteredVerses} onSelect={handleSelect} />
        ) : viewMode === "list" ? (
          <ListView verses={filteredVerses} onSelect={handleSelect} />
        ) : (
          <DetailedView verses={filteredVerses} onSelect={handleSelect} bookData={bookData} />
        )}
      </div>
    </div>
  );
}

function getMantraLabel(verseNumber: number): string {
  if (verseNumber === 0) return "Intro";
  return `${verseNumber}`;
}

function getThemeColor(verseNumber: number): string {
  const colors = [
    "from-orange-500/20 to-amber-500/10",
    "from-amber-500/20 to-yellow-500/10",
    "from-yellow-500/20 to-orange-500/10",
    "from-red-500/15 to-orange-500/10",
    "from-orange-600/20 to-red-500/10",
    "from-amber-600/20 to-orange-500/10",
  ];
  return colors[verseNumber % colors.length];
}

function IconView({ verses, onSelect }: { verses: Verse[]; onSelect: (v: Verse) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {verses.map((verse) => (
        <Card
          key={verse.id}
          className={`relative overflow-visible cursor-pointer hover-elevate active-elevate-2 border-primary/15 bg-gradient-to-br ${getThemeColor(verse.verseNumber)}`}
          onClick={() => onSelect(verse)}
          data-testid={`card-verse-icon-${verse.verseNumber}`}
        >
          <div className="flex flex-col items-center justify-center p-3 text-center min-h-[100px]">
            <div className="text-2xl font-serif text-primary/60 mb-1">ॐ</div>
            <div className="text-lg font-bold text-primary font-serif">
              {getMantraLabel(verse.verseNumber)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
              {verse.sectionTitle || `Verse ${verse.verseNumber}`}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ListView({ verses, onSelect }: { verses: Verse[]; onSelect: (v: Verse) => void }) {
  return (
    <div className="space-y-1.5">
      {verses.map((verse) => (
        <div
          key={verse.id}
          className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer hover-elevate active-elevate-2 border border-transparent hover:border-primary/10"
          onClick={() => onSelect(verse)}
          data-testid={`row-verse-list-${verse.verseNumber}`}
        >
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-gradient-to-br ${getThemeColor(verse.verseNumber)} border border-primary/15`}>
            <span className="text-sm font-bold text-primary font-serif">
              {getMantraLabel(verse.verseNumber)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {verse.sectionTitle || `Verse ${verse.verseNumber}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {verse.verseNumber === 0 ? "Introduction" : `Mantra ${verse.verseNumber}`}
            </p>
          </div>
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface DetailedViewProps {
  verses: Verse[];
  onSelect: (v: Verse) => void;
  bookData?: BookWithVerses;
}

function DetailedView({ verses, onSelect, bookData }: DetailedViewProps) {
  const descriptions: Record<number, string> = {
    0: "Shankaracharya's introduction explaining the purpose and context of the Upanishad",
    1: "Renunciation and enjoyment - all this is pervaded by the Lord",
    2: "One should desire to live a hundred years performing action",
    3: "Those who slay the Self go to sunless regions covered by darkness",
    4: "The Self is unmoving yet swifter than the mind",
    5: "It moves and It moves not. It is far and It is near",
    6: "One who sees all beings in the Self sees no hatred",
    7: "When one realizes all beings as the Self, what delusion or sorrow remains?",
    8: "The Self is all-pervading, radiant, without body or sin",
    9: "Into blinding darkness enter those who worship Avidya alone",
    10: "Different are the results of Vidya and Avidya",
    11: "One who knows both Vidya and Avidya together crosses death through Avidya",
    12: "Into blinding darkness enter those who worship the Unmanifest",
    13: "Different are the results of worship of the Manifest and the Unmanifest",
    14: "One who knows both Sambhuti and Vinasha together crosses death",
    15: "The face of Truth is covered by a golden disc - O Sun, remove it",
    16: "O Pushan, the sole seer, remove thy rays and gather thy light",
    17: "O mind, remember thy deeds - O Agni, lead us by the good path",
    18: "O Agni, knowing all our deeds, lead us away from sin",
  };

  return (
    <div className="space-y-3">
      {verses.map((verse) => (
        <Card
          key={verse.id}
          className="overflow-visible cursor-pointer hover-elevate active-elevate-2 border-primary/10"
          onClick={() => onSelect(verse)}
          data-testid={`card-verse-detail-${verse.verseNumber}`}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 bg-gradient-to-br ${getThemeColor(verse.verseNumber)} border border-primary/15`}>
                <div className="text-center">
                  <div className="text-xs text-primary/50 font-serif leading-none">ॐ</div>
                  <span className="text-base font-bold text-primary font-serif">
                    {getMantraLabel(verse.verseNumber)}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-medium text-sm">
                  {verse.sectionTitle || `Verse ${verse.verseNumber}`}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {descriptions[verse.verseNumber] || "Explore this sacred verse with commentary"}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {verse.verseNumber === 0 ? "Introduction" : `Mantra ${verse.verseNumber}`}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/70">
                    5 Scripts
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
