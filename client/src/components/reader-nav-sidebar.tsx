import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";

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

function getChapterLabel(title: string) {
  if (title.includes(' - ')) return title.split(' - ').pop()?.trim() || title;
  return title;
}

function detectLabels(chapters: ChapterInfo[]): { chapterLabel: string; khandaLabel: string; mantraLabel: string } {
  const firstTitle = chapters[0]?.title?.toLowerCase() || "";
  const hasKhandas = chapters.some(ch => ch.khandas && ch.khandas.length > 0);
  const firstKhandaTitle = hasKhandas ? chapters.find(ch => ch.khandas?.length)?.khandas?.[0]?.title?.toLowerCase() || "" : "";

  let chapterLabel = "Adhyāya";
  if (firstTitle.includes("valli") || firstTitle.includes("vallī")) chapterLabel = "Valli";
  else if (firstTitle.includes("mundaka") || firstTitle.includes("muṇḍaka")) chapterLabel = "Muṇḍaka";
  else if (firstTitle.includes("prashna") || firstTitle.includes("praśna")) chapterLabel = "Praśna";
  else if (firstTitle.includes("chapter")) chapterLabel = "Chapter";
  else if (firstTitle.includes("adhyay") || firstTitle.includes("adhyāy")) chapterLabel = "Adhyāya";
  else if (firstTitle.includes("pada") || firstTitle.includes("pāda")) chapterLabel = "Pāda";

  let khandaLabel = "Khaṇḍa";
  if (firstKhandaTitle.includes("anuvaka") || firstKhandaTitle.includes("anuvāka")) khandaLabel = "Anuvāka";
  else if (firstKhandaTitle.includes("valli") || firstKhandaTitle.includes("vallī")) khandaLabel = "Valli";
  else if (firstKhandaTitle.includes("khanda") || firstKhandaTitle.includes("khaṇḍa")) khandaLabel = "Khaṇḍa";
  else if (firstKhandaTitle.includes("section")) khandaLabel = "Section";

  return { chapterLabel, khandaLabel, mantraLabel: "Mantra" };
}

export function ReaderNavSidebar({ bookId, bookTitle, chapters, currentVerseNumber, onSelectVerse, onSelectBook }: {
  bookId: string;
  bookTitle: string;
  chapters: ChapterInfo[];
  currentVerseNumber: number;
  onSelectVerse: (bookId: string, verseNumber: number) => void;
  onSelectBook: (bookId: string) => void;
}) {
  const hasKhandas = useMemo(() => chapters.some(ch => ch.khandas && ch.khandas.length > 0), [chapters]);
  const labels = useMemo(() => detectLabels(chapters), [chapters]);

  const [selectedChapterNum, setSelectedChapterNum] = useState<number | null>(null);
  const [selectedKhandaNum, setSelectedKhandaNum] = useState<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  const activeVerseRef = useRef<HTMLButtonElement>(null);

  const activeChapter = useMemo(() => {
    for (const ch of chapters) {
      if (ch.verseNumbers.includes(currentVerseNumber)) return ch.number;
    }
    return null;
  }, [chapters, currentVerseNumber]);

  const activeKhandaObj = useMemo(() => {
    for (const ch of chapters) {
      if (ch.khandas) {
        for (const kh of ch.khandas) {
          if (kh.verseNumbers.includes(currentVerseNumber)) {
            return { chapterNum: ch.number, khandaNum: kh.number };
          }
        }
      }
    }
    return null;
  }, [chapters, currentVerseNumber]);

  useEffect(() => {
    if (activeChapter != null) {
      setSelectedChapterNum(activeChapter);
      setExpandedChapters(prev => {
        const next = new Set(prev);
        next.add(activeChapter);
        return next;
      });
    }
    if (activeKhandaObj) {
      setSelectedKhandaNum(activeKhandaObj.khandaNum);
    }
  }, [activeChapter, activeKhandaObj]);

  useEffect(() => {
    setTimeout(() => {
      activeVerseRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
  }, [currentVerseNumber]);

  const selectedChapter = useMemo(() => chapters.find(ch => ch.number === selectedChapterNum), [chapters, selectedChapterNum]);

  const verseNumbers = useMemo(() => {
    if (!selectedChapter) return [];
    if (hasKhandas && selectedKhandaNum != null) {
      const kh = selectedChapter.khandas?.find(k => k.number === selectedKhandaNum);
      return kh?.verseNumbers || [];
    }
    return selectedChapter.verseNumbers;
  }, [selectedChapter, hasKhandas, selectedKhandaNum]);

  const toggleChapter = (chNum: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chNum)) next.delete(chNum);
      else next.add(chNum);
      return next;
    });
    setSelectedChapterNum(chNum);
    if (hasKhandas) {
      const ch = chapters.find(c => c.number === chNum);
      setSelectedKhandaNum(ch?.khandas?.[0]?.number ?? null);
    }
  };

  return (
    <div className="h-full flex flex-col border-r border-border bg-card" data-testid="reader-nav-sidebar">
      <div className="px-3 pt-3 pb-2 shrink-0 space-y-2">
        <button
          className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-sm bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
          onClick={() => onSelectBook(bookId)}
          data-testid="reader-nav-book-title"
        >
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary truncate text-xs">{bookTitle}</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden" data-testid="reader-chapter-tree">
        <div className="w-1/2 border-r border-border/40 overflow-y-auto">
          <div className="px-2 py-1.5 border-b border-border/60">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.chapterLabel}</span>
          </div>
          <div className="divide-y divide-border/20">
            {chapters.map(ch => {
              const isExpanded = expandedChapters.has(ch.number);
              const isActive = activeChapter === ch.number;
              return (
                <div key={ch.number}>
                  <button
                    className={`flex items-center w-full text-left px-2 py-2 text-[11px] transition-colors ${
                      selectedChapterNum === ch.number
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-accent/60 text-foreground/80"
                    } ${isActive ? "border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"}`}
                    onClick={() => toggleChapter(ch.number)}
                    data-testid={`nav-chapter-${ch.number}`}
                  >
                    {(hasKhandas && ch.khandas?.length) ? (
                      <ChevronRight className={`h-3 w-3 shrink-0 mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="flex-1 truncate leading-tight">{getChapterLabel(ch.title)}</span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">{ch.verseCount}</span>
                  </button>
                  {hasKhandas && isExpanded && ch.khandas && (
                    <div className="bg-muted/30">
                      {ch.khandas.map(kh => {
                        const isKhandaActive = activeKhandaObj?.chapterNum === ch.number && activeKhandaObj?.khandaNum === kh.number;
                        return (
                          <button
                            key={kh.number}
                            className={`flex items-center w-full text-left pl-6 pr-2 py-1.5 text-[10px] transition-colors ${
                              selectedChapterNum === ch.number && selectedKhandaNum === kh.number
                                ? "bg-primary/8 text-primary font-semibold"
                                : "hover:bg-accent/40 text-foreground/70"
                            } ${isKhandaActive ? "border-l-[2px] border-l-primary" : ""}`}
                            onClick={() => {
                              setSelectedChapterNum(ch.number);
                              setSelectedKhandaNum(kh.number);
                            }}
                            data-testid={`nav-khanda-${ch.number}-${kh.number}`}
                          >
                            <span className="flex-1 truncate">{kh.title}</span>
                            <span className="text-[9px] text-muted-foreground/50 font-mono ml-1">{kh.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-1/2 overflow-y-auto">
          <div className="px-2 py-1.5 border-b border-border/60">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.mantraLabel}</span>
          </div>
          {verseNumbers.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 p-2" data-testid="nav-mantra-grid">
              {verseNumbers.map(vn => {
                const isActive = currentVerseNumber === vn;
                return (
                  <button
                    key={vn}
                    ref={isActive ? activeVerseRef : undefined}
                    className={`py-1.5 rounded text-xs font-mono transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "bg-muted/40 hover:bg-accent text-foreground/70 hover:text-foreground"
                    }`}
                    onClick={() => onSelectVerse(bookId, vn)}
                    data-testid={`nav-mantra-${vn}`}
                  >
                    {vn}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground text-center py-6 px-2">
              Select a {labels.chapterLabel.toLowerCase()} to see mantras
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
