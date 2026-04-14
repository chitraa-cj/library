import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface KhandaInfo {
  number: number;
  title: string;
  count: number;
  verseNumbers: number[];
}

export interface ChapterInfo {
  number: number;
  title: string;
  verseCount: number;
  khandas?: KhandaInfo[];
  verseNumbers: number[];
}

export function useBookChapters(bookId: string | undefined): ChapterInfo[] {
  const { data } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  return useMemo(() => {
    if (!data?.verses) return [];

    const chapterMap = new Map<number, ChapterInfo>();
    for (const v of data.verses) {
      const adhyay = v.adhyayNumber;
      if (adhyay == null) continue;

      if (!chapterMap.has(adhyay)) {
        chapterMap.set(adhyay, {
          number: adhyay,
          title: v.adhyayTitle || `Chapter ${adhyay}`,
          verseCount: 0,
          verseNumbers: [],
        });
      }
      const ch = chapterMap.get(adhyay)!;
      ch.verseCount++;
      ch.verseNumbers.push(v.verseNumber);

      if (v.khandaNumber != null) {
        if (!ch.khandas) ch.khandas = [];
        const existingKhanda = ch.khandas.find(k => k.number === v.khandaNumber);
        if (existingKhanda) {
          existingKhanda.count++;
          existingKhanda.verseNumbers.push(v.verseNumber);
        } else {
          ch.khandas.push({
            number: v.khandaNumber,
            title: v.khandaTitle || `Part ${v.khandaNumber}`,
            count: 1,
            verseNumbers: [v.verseNumber],
          });
        }
      }
    }

    const result = Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
    result.forEach(ch => {
      ch.verseNumbers.sort((a, b) => a - b);
      ch.khandas?.forEach(k => k.verseNumbers.sort((a, b) => a - b));
    });
    return result;
  }, [data]);
}

export function ReaderNavSidebar({ bookId, bookTitle, chapters, currentVerseNumber, onSelectVerse, onSelectBook }: {
  bookId: string;
  bookTitle: string;
  chapters: ChapterInfo[];
  currentVerseNumber: number;
  onSelectVerse: (bookId: string, verseNumber: number) => void;
  onSelectBook: (bookId: string) => void;
}) {
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);
  const [expandedKhanda, setExpandedKhanda] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const activeChapter = useMemo(() => {
    for (const ch of chapters) {
      if (ch.verseNumbers.includes(currentVerseNumber)) return ch.number;
    }
    return null;
  }, [chapters, currentVerseNumber]);

  const activeKhanda = useMemo(() => {
    for (const ch of chapters) {
      if (ch.khandas) {
        for (const kh of ch.khandas) {
          if (kh.verseNumbers.includes(currentVerseNumber)) {
            return `${ch.number}-${kh.number}`;
          }
        }
      }
    }
    return null;
  }, [chapters, currentVerseNumber]);

  useEffect(() => {
    if (activeChapter != null && expandedChapter !== activeChapter) {
      setExpandedChapter(activeChapter);
    }
    if (activeKhanda != null && expandedKhanda !== activeKhanda) {
      setExpandedKhanda(activeKhanda);
    }
  }, [activeChapter, activeKhanda]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(ch =>
      ch.title.toLowerCase().includes(q) ||
      ch.khandas?.some(kh => kh.title.toLowerCase().includes(q)) ||
      ch.verseNumbers.some(vn => String(vn) === q)
    );
  }, [chapters, searchQuery]);

  const handleChapterClick = (ch: ChapterInfo) => {
    if (expandedChapter === ch.number) {
      setExpandedChapter(null);
      setExpandedKhanda(null);
    } else {
      setExpandedChapter(ch.number);
      setExpandedKhanda(null);
    }
  };

  const handleKhandaClick = (chNum: number, khNum: number) => {
    const key = `${chNum}-${khNum}`;
    setExpandedKhanda(expandedKhanda === key ? null : key);
  };

  const renderVerseGrid = (verseNumbers: number[]) => (
    <div className="flex flex-wrap gap-1 mt-1.5 mb-1 px-1" data-testid="verse-number-grid">
      {verseNumbers.map(vn => (
        <button
          key={vn}
          onClick={() => onSelectVerse(bookId, vn)}
          className={`w-8 h-8 rounded-md text-xs font-medium border transition-colors flex items-center justify-center ${
            vn === currentVerseNumber
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border/40 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary"
          }`}
          data-testid={`nav-verse-${vn}`}
        >
          {vn}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col border-r border-border bg-card" data-testid="reader-nav-sidebar">
      <div className="px-3 pt-3 pb-2 border-b border-border/60 shrink-0">
        <button
          className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg text-sm bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors mb-2"
          onClick={() => onSelectBook(bookId)}
          data-testid="reader-nav-book-title"
        >
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary truncate text-xs">{bookTitle}</span>
        </button>
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            className="h-8 pl-8 text-xs bg-background"
            placeholder="Search chapter, verse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-nav-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5" data-testid="reader-chapter-tree">
        {filteredChapters.map((ch, idx) => {
          const isExpanded = expandedChapter === ch.number;
          const isActive = activeChapter === ch.number;
          const hasKhandas = ch.khandas && ch.khandas.length > 0;
          const chapterLabel = ch.title.includes(' - ') ? ch.title.split(' - ').pop()?.trim() : ch.title;

          return (
            <div key={ch.number} data-testid={`reader-nav-chapter-${ch.number}`}>
              <button
                className={`flex items-center gap-1.5 w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  isActive && !isExpanded
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : isExpanded
                    ? "bg-accent text-foreground font-medium"
                    : "hover:bg-accent/60 text-foreground/80"
                }`}
                onClick={() => handleChapterClick(ch)}
                data-testid={`reader-tree-chapter-${ch.number}`}
              >
                <span className="text-[10px] text-muted-foreground/60 w-4 text-right shrink-0 font-mono">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate flex-1 leading-tight">{chapterLabel}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{ch.verseCount}</span>
                <ChevronRight className={`h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>

              {isExpanded && (
                <div className="ml-4 pl-2 border-l-2 border-primary/15 mt-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                  {hasKhandas ? (
                    ch.khandas!.map((kh) => {
                      const khandaKey = `${ch.number}-${kh.number}`;
                      const isKhandaExpanded = expandedKhanda === khandaKey;
                      const isKhandaActive = activeKhanda === khandaKey;
                      return (
                        <div key={kh.number} data-testid={`reader-nav-khanda-${ch.number}-${kh.number}`}>
                          <button
                            className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                              isKhandaActive && !isKhandaExpanded
                                ? "bg-primary/5 text-primary font-medium"
                                : isKhandaExpanded
                                ? "bg-primary/5 text-primary font-medium"
                                : "hover:bg-accent/50 text-foreground/70"
                            }`}
                            onClick={() => handleKhandaClick(ch.number, kh.number)}
                            data-testid={`reader-tree-khanda-${ch.number}-${kh.number}`}
                          >
                            <span className="truncate flex-1">{kh.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{kh.count}</span>
                            <ChevronRight className={`h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform ${isKhandaExpanded ? "rotate-90" : ""}`} />
                          </button>
                          {isKhandaExpanded && (
                            <div className="pl-1 animate-in slide-in-from-top-1 duration-150">
                              {renderVerseGrid(kh.verseNumbers)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    renderVerseGrid(ch.verseNumbers)
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredChapters.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
