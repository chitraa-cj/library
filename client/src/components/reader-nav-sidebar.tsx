import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, ChevronDown } from "lucide-react";
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

type NavTab = "chapter" | "khanda" | "mantra";

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

  const [activeTab, setActiveTab] = useState<NavTab>("chapter");
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | null>(null);
  const [selectedKhandaNum, setSelectedKhandaNum] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);
  const [khandaDropdownOpen, setKhandaDropdownOpen] = useState(false);

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
    }
    if (activeKhandaObj) {
      setSelectedKhandaNum(activeKhandaObj.khandaNum);
    }
  }, [activeChapter, activeKhandaObj]);

  useEffect(() => {
    if (hasKhandas && activeTab === "khanda" && selectedChapterNum == null && activeChapter != null) {
      setSelectedChapterNum(activeChapter);
    }
  }, [activeTab, hasKhandas, selectedChapterNum, activeChapter]);

  const selectedChapter = useMemo(() => chapters.find(ch => ch.number === selectedChapterNum), [chapters, selectedChapterNum]);
  const selectedKhanda = useMemo(() => selectedChapter?.khandas?.find(kh => kh.number === selectedKhandaNum), [selectedChapter, selectedKhandaNum]);

  const availableTabs = useMemo(() => {
    const tabs: NavTab[] = ["chapter"];
    if (hasKhandas) tabs.push("khanda");
    tabs.push("mantra");
    return tabs;
  }, [hasKhandas]);

  const tabLabel = (tab: NavTab) => {
    switch (tab) {
      case "chapter": return labels.chapterLabel;
      case "khanda": return labels.khandaLabel;
      case "mantra": return labels.mantraLabel;
    }
  };

  const listItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeTab === "chapter") {
      return chapters
        .filter(ch => !q || getChapterLabel(ch.title).toLowerCase().includes(q) || String(ch.number).includes(q))
        .map(ch => ({
          number: ch.number,
          label: getChapterLabel(ch.title),
          count: ch.verseCount,
          isActive: activeChapter === ch.number,
          onClick: () => {
            setSelectedChapterNum(ch.number);
            if (hasKhandas) {
              setActiveTab("khanda");
              setSelectedKhandaNum(ch.khandas?.[0]?.number ?? null);
            } else {
              setActiveTab("mantra");
            }
          },
        }));
    }

    if (activeTab === "khanda" && selectedChapter?.khandas) {
      return selectedChapter.khandas
        .filter(kh => !q || kh.title.toLowerCase().includes(q) || String(kh.number).includes(q))
        .map(kh => ({
          number: kh.number,
          label: kh.title,
          count: kh.count,
          isActive: activeKhandaObj?.chapterNum === selectedChapterNum && activeKhandaObj?.khandaNum === kh.number,
          onClick: () => {
            setSelectedKhandaNum(kh.number);
            setActiveTab("mantra");
          },
        }));
    }

    if (activeTab === "mantra") {
      let verseNums: number[] = [];
      if (hasKhandas && selectedKhanda) {
        verseNums = selectedKhanda.verseNumbers;
      } else if (selectedChapter) {
        verseNums = selectedChapter.verseNumbers;
      } else {
        verseNums = chapters.flatMap(ch => ch.verseNumbers).sort((a, b) => a - b);
      }
      return verseNums
        .filter(vn => !q || String(vn).includes(q))
        .map((vn, idx) => ({
          number: idx + 1,
          label: `Mantra ${vn}`,
          count: vn,
          isActive: currentVerseNumber === vn,
          onClick: () => onSelectVerse(bookId, vn),
        }));
    }

    return [];
  }, [activeTab, chapters, selectedChapter, selectedKhanda, searchQuery, currentVerseNumber, activeChapter, activeKhandaObj, selectedChapterNum, hasKhandas, bookId, onSelectVerse]);

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

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            className="h-8 pl-8 text-xs bg-background"
            placeholder={`Search ${tabLabel(activeTab)}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-nav-search"
          />
        </div>

        <div className="flex gap-1" data-testid="nav-tab-bar">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchQuery(""); }}
              className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              data-testid={`nav-tab-${tab}`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/60 shrink-0">
        {activeTab === "khanda" && (
          <div className="px-3 py-2 border-b border-border/40 relative">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setChapterDropdownOpen(!chapterDropdownOpen)}
              data-testid="dropdown-chapter-selector"
            >
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.chapterLabel}</span>
                <span className="text-xs text-foreground font-medium ml-2">{selectedChapter ? getChapterLabel(selectedChapter.title) : "Select"}</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${chapterDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {chapterDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-20 bg-card border border-border shadow-lg rounded-b-lg max-h-48 overflow-y-auto">
                {chapters.map(ch => (
                  <button
                    key={ch.number}
                    className={`flex items-center gap-2 w-full text-left px-4 py-2 text-xs hover:bg-accent transition-colors ${
                      selectedChapterNum === ch.number ? "bg-primary/5 text-primary font-medium" : "text-foreground/80"
                    }`}
                    onClick={() => {
                      setSelectedChapterNum(ch.number);
                      setSelectedKhandaNum(ch.khandas?.[0]?.number ?? null);
                      setChapterDropdownOpen(false);
                    }}
                    data-testid={`dropdown-chapter-${ch.number}`}
                  >
                    <span className="text-muted-foreground/60 w-4 text-right font-mono text-[10px]">{ch.number}</span>
                    <span className="flex-1 truncate">{getChapterLabel(ch.title)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "mantra" && (
          <div className="px-3 py-2 border-b border-border/40 space-y-1">
            {selectedChapter && (
              <div className="relative">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => { setChapterDropdownOpen(!chapterDropdownOpen); setKhandaDropdownOpen(false); }}
                  data-testid="dropdown-chapter-selector"
                >
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.chapterLabel}</span>
                    <span className="text-xs text-foreground font-medium ml-2">{getChapterLabel(selectedChapter.title)}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${chapterDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {chapterDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 bg-card border border-border shadow-lg rounded-b-lg max-h-48 overflow-y-auto">
                    {chapters.map(ch => (
                      <button
                        key={ch.number}
                        className={`flex items-center gap-2 w-full text-left px-4 py-2 text-xs hover:bg-accent transition-colors ${
                          selectedChapterNum === ch.number ? "bg-primary/5 text-primary font-medium" : "text-foreground/80"
                        }`}
                        onClick={() => {
                          setSelectedChapterNum(ch.number);
                          setSelectedKhandaNum(ch.khandas?.[0]?.number ?? null);
                          setChapterDropdownOpen(false);
                        }}
                        data-testid={`dropdown-chapter-${ch.number}`}
                      >
                        <span className="text-muted-foreground/60 w-4 text-right font-mono text-[10px]">{ch.number}</span>
                        <span className="flex-1 truncate">{getChapterLabel(ch.title)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasKhandas && selectedKhanda && (
              <div className="relative">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => { setKhandaDropdownOpen(!khandaDropdownOpen); setChapterDropdownOpen(false); }}
                  data-testid="dropdown-khanda-selector"
                >
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.khandaLabel}</span>
                    <span className="text-xs text-foreground font-medium ml-2">{selectedKhanda.title}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${khandaDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {khandaDropdownOpen && selectedChapter?.khandas && (
                  <div className="absolute left-0 right-0 top-full z-20 bg-card border border-border shadow-lg rounded-b-lg max-h-48 overflow-y-auto">
                    {selectedChapter.khandas.map(kh => (
                      <button
                        key={kh.number}
                        className={`flex items-center gap-2 w-full text-left px-4 py-2 text-xs hover:bg-accent transition-colors ${
                          selectedKhandaNum === kh.number ? "bg-primary/5 text-primary font-medium" : "text-foreground/80"
                        }`}
                        onClick={() => {
                          setSelectedKhandaNum(kh.number);
                          setKhandaDropdownOpen(false);
                        }}
                        data-testid={`dropdown-khanda-${kh.number}`}
                      >
                        <span className="text-muted-foreground/60 w-4 text-right font-mono text-[10px]">{kh.number}</span>
                        <span className="flex-1 truncate">{kh.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="reader-chapter-tree">
        <div className="divide-y divide-border/30">
          {listItems.map((item) => (
            <button
              key={`${activeTab}-${item.count}-${item.number}`}
              className={`flex items-center w-full text-left px-3 py-2.5 text-xs transition-colors ${
                item.isActive
                  ? "bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                  : "hover:bg-accent/60 text-foreground/80 border-l-[3px] border-l-transparent"
              }`}
              onClick={item.onClick}
              data-testid={`nav-item-${activeTab}-${item.count}`}
            >
              <span className={`w-6 text-right shrink-0 font-mono text-[11px] mr-3 ${
                item.isActive ? "text-primary" : "text-muted-foreground/60"
              }`}>
                {item.number}
              </span>
              <span className="flex-1 truncate leading-tight">{item.label}</span>
              <span className={`text-[11px] font-mono shrink-0 ml-2 ${
                item.isActive ? "text-primary font-bold" : "text-muted-foreground/50"
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {listItems.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
