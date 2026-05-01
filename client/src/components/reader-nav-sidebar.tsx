import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, ChevronDown, FileText } from "lucide-react";
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

function getChapterLabel(title: string) {
  let t = title;
  if (t.includes(' - ')) t = t.split(' - ').pop()?.trim() || t;
  const levelWord = /(adhy[aā]ya|vall[iī]|pra[sś]na|mu[nṇ][dḍ]aka|kha[nṇ][dḍ]a|anuv[aā]ka|p[aā]da|chapter|section)[ḥh]?/i;
  t = t.replace(new RegExp(`\\s+${levelWord.source}\\.?\\s*$`, 'i'), '').trim();
  t = t.replace(new RegExp(`^${levelWord.source}\\s+[\\d०-९ivxIVX]*\\.?\\s*`, 'i'), '').trim();
  t = t.replace(new RegExp(`^${levelWord.source}\\s+`, 'i'), '').trim();
  return t || title;
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

type NavTab = "chapter" | "khanda" | "mantra";

export function ReaderNavSidebar({ bookId, bookTitle, chapters, currentVerseNumber, onSelectVerse, onSelectBook }: {
  bookId: string;
  bookTitle: string;
  chapters: ChapterInfo[];
  currentVerseNumber: number;
  onSelectVerse: (bookId: string, verseNumber: number) => void;
  onSelectBook: (bookId: string) => void;
}) {
  const { data: bookData } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });
  const introInfo = useMemo(() => {
    if (!bookData?.verses) return { hasIntro: false, label: "Sambandha Bhāṣyam" };
    const introVerse = bookData.verses.find((v: any) =>
      v.verseNumber === 0 &&
      typeof v.sectionTitle === "string" &&
      ["introduction", "sambandha bhashyam"].includes(v.sectionTitle.toLowerCase().trim())
    );
    if (!introVerse) return { hasIntro: false, label: "Sambandha Bhāṣyam" };
    return { hasIntro: true, label: "Sambandha Bhāṣyam" };
  }, [bookData]);
  const hasIntro = introInfo.hasIntro;
  const isIntroActive = currentVerseNumber === 0;
  const hasKhandas = useMemo(() => chapters.some(ch => ch.khandas && ch.khandas.length > 0), [chapters]);
  const labels = useMemo(() => detectLabels(chapters), [chapters]);

  const [activeTab, setActiveTab] = useState<NavTab>("chapter");
  const [selectedChapterNum, setSelectedChapterNum] = useState<number | null>(null);
  const [selectedKhandaNum, setSelectedKhandaNum] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);

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
    if (hasKhandas && activeTab === "chapter") setActiveTab("khanda");
  }, [hasKhandas]);

  useEffect(() => {
    if (activeChapter != null) setSelectedChapterNum(activeChapter);
    if (activeKhandaObj) setSelectedKhandaNum(activeKhandaObj.khandaNum);
  }, [activeChapter, activeKhandaObj]);

  useEffect(() => {
    setTimeout(() => {
      activeVerseRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
  }, [currentVerseNumber]);

  const selectedChapter = useMemo(() => chapters.find(ch => ch.number === selectedChapterNum), [chapters, selectedChapterNum]);

  const availableTabs = useMemo(() => {
    const tabs: NavTab[] = [hasKhandas ? "chapter" : "chapter"];
    if (hasKhandas) tabs[0] = "chapter";
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

  const leftListItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeTab === "chapter") {
      return chapters
        .filter(ch => !q || getChapterLabel(ch.title).toLowerCase().includes(q) || String(ch.number).includes(q))
        .map(ch => ({
          number: ch.number,
          label: getChapterLabel(ch.title),
          count: ch.verseCount,
          isActive: activeChapter === ch.number,
          isSelected: selectedChapterNum === ch.number,
          onClick: () => {
            setSelectedChapterNum(ch.number);
            if (hasKhandas) {
              setSelectedKhandaNum(ch.khandas?.[0]?.number ?? null);
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
          isSelected: selectedKhandaNum === kh.number,
          onClick: () => {
            setSelectedKhandaNum(kh.number);
          },
        }));
    }

    return [];
  }, [activeTab, chapters, selectedChapter, searchQuery, activeChapter, activeKhandaObj, selectedChapterNum, selectedKhandaNum, hasKhandas]);

  const verseLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ch of chapters) {
      if (ch.khandas && ch.khandas.length > 0) {
        for (const kh of ch.khandas) {
          kh.verseNumbers.forEach((vn, idx) => {
            map.set(vn, `${ch.number}.${kh.number}.${idx + 1}`);
          });
        }
        // Cover any chapter verses not in a khanda
        ch.verseNumbers.forEach((vn) => {
          if (!map.has(vn)) {
            const idx = ch.verseNumbers.indexOf(vn);
            map.set(vn, `${ch.number}.${idx + 1}`);
          }
        });
      } else {
        ch.verseNumbers.forEach((vn, idx) => {
          map.set(vn, `${ch.number}.${idx + 1}`);
        });
      }
    }
    return map;
  }, [chapters]);

  const labelFor = (vn: number) => verseLabelMap.get(vn) || String(vn);

  const mantraNumbers = useMemo(() => {
    let nums: number[] = [];
    if (activeTab === "mantra") {
      nums = chapters.flatMap(ch => ch.verseNumbers).sort((a, b) => a - b);
    } else if (activeTab === "khanda") {
      if (selectedKhandaNum != null && selectedChapter?.khandas) {
        const kh = selectedChapter.khandas.find(k => k.number === selectedKhandaNum);
        nums = kh?.verseNumbers || [];
      } else {
        nums = selectedChapter?.verseNumbers || [];
      }
    } else if (activeTab === "chapter") {
      nums = selectedChapter?.verseNumbers || [];
    }
    if (activeTab === "mantra" && searchQuery.trim()) {
      const q = searchQuery.trim();
      nums = nums.filter(n => String(n).includes(q));
    }
    return nums;
  }, [activeTab, selectedChapter, selectedKhandaNum, chapters, searchQuery]);

  const showLeftPanel = activeTab !== "mantra";
  const searchPlaceholder = `Search ${tabLabel(activeTab)}...`;

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

        {hasIntro && (
          <button
            className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
              isIntroActive
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "bg-muted/40 border-border/60 text-foreground/80 hover:bg-accent/60"
            }`}
            onClick={() => onSelectVerse(bookId, 0)}
            data-testid="reader-nav-read-introduction"
          >
            <FileText className={`h-3.5 w-3.5 shrink-0 ${isIntroActive ? "text-primary" : "text-muted-foreground"}`} />
            <span className="truncate">{introInfo.label}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="h-3 w-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
            <Input
              className="h-7 pl-7 text-[11px] bg-background"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-nav-search"
            />
          </div>
        </div>

        <div className="flex gap-1" data-testid="nav-tab-bar">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchQuery(""); setChapterDropdownOpen(false); }}
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

      <div className="flex flex-col flex-1 overflow-hidden border-t border-border/60" data-testid="reader-chapter-tree">
        {activeTab === "khanda" && showLeftPanel && (
          <div className="flex items-stretch shrink-0 border-b border-border/60 bg-muted/30">
            <div className="w-[62%] px-3 py-2 border-r border-border/40 flex items-center">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.12em]">
                {labels.chapterLabel}
              </span>
            </div>
            <div className="w-[38%] px-1.5 py-1.5 relative">
              <button
                className={`flex items-center justify-between gap-1 w-full text-left px-2 py-1 rounded-md border transition-colors ${
                  chapterDropdownOpen
                    ? "border-primary/40 bg-background shadow-sm"
                    : "border-border/60 bg-background/70 hover:bg-background hover:border-border"
                }`}
                onClick={() => setChapterDropdownOpen(!chapterDropdownOpen)}
                data-testid="dropdown-chapter-selector"
              >
                <span className="text-[11px] text-foreground font-medium truncate">
                  {selectedChapter ? getChapterLabel(selectedChapter.title) : "Select"}
                </span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${chapterDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {chapterDropdownOpen && (
                <div className="absolute right-1.5 top-full mt-1 z-20 min-w-full w-max max-w-[220px] bg-popover border border-border shadow-xl rounded-md overflow-hidden">
                  <div className="max-h-56 overflow-y-auto py-1">
                    {chapters.map(ch => (
                      <button
                        key={ch.number}
                        className={`flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 text-[11px] transition-colors ${
                          selectedChapterNum === ch.number
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground/80 hover:bg-accent"
                        }`}
                        onClick={() => {
                          setSelectedChapterNum(ch.number);
                          setSelectedKhandaNum(ch.khandas?.[0]?.number ?? null);
                          setChapterDropdownOpen(false);
                        }}
                        data-testid={`dropdown-chapter-${ch.number}`}
                      >
                        <span className={`w-4 text-right font-mono text-[10px] ${selectedChapterNum === ch.number ? "text-primary/80" : "text-muted-foreground/60"}`}>{ch.number}</span>
                        <span className="flex-1 whitespace-nowrap">{getChapterLabel(ch.title)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {showLeftPanel && (
            <div className="w-[62%] border-r border-border/40 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {activeTab === "khanda" && (
                  <div className="px-2 py-1.5 border-b border-border/60">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      {labels.khandaLabel}
                    </span>
                  </div>
                )}
                <div className="divide-y divide-border/20">
                  {leftListItems.map((item) => (
                  <button
                    key={`${activeTab}-${item.number}`}
                    className={`flex items-center w-full text-left px-2.5 py-2 text-[11px] transition-colors ${
                      item.isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-accent/60 text-foreground/80"
                    } ${item.isActive ? "border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"}`}
                    onClick={item.onClick}
                    data-testid={`nav-item-${activeTab}-${item.number}`}
                  >
                    <span className={`w-5 text-right shrink-0 font-mono text-[11px] mr-2 ${
                      item.isActive ? "text-primary" : "text-muted-foreground/60"
                    }`}>
                      {item.number}
                    </span>
                    <span className="flex-1 leading-tight break-words pr-1">{item.label}</span>
                    <span className={`text-[10px] font-mono shrink-0 ${
                      item.isActive ? "text-primary font-bold" : "text-muted-foreground/50"
                    }`}>
                      {item.count}
                    </span>
                  </button>
                ))}
                {leftListItems.length === 0 && (
                  <div className="text-[10px] text-muted-foreground text-center py-6">
                    No results found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`${showLeftPanel ? "w-[38%]" : "w-full"} overflow-y-auto`}>
          <div className="px-2 py-1.5 border-b border-border/60">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{labels.mantraLabel}</span>
          </div>
          {mantraNumbers.length > 0 ? (
            <div className="flex flex-col" data-testid="nav-mantra-grid">
              {mantraNumbers.map(vn => {
                const isActive = currentVerseNumber === vn;
                return (
                  <button
                    key={vn}
                    ref={isActive ? activeVerseRef : undefined}
                    className={`flex items-center w-full text-left px-3 py-2 text-[11px] transition-colors border-b border-border/20 ${
                      isActive
                        ? "bg-primary/10 text-primary font-bold border-l-[3px] border-l-primary"
                        : "hover:bg-accent/60 text-foreground/80 border-l-[3px] border-l-transparent"
                    }`}
                    onClick={() => onSelectVerse(bookId, vn)}
                    data-testid={`nav-mantra-${vn}`}
                  >
                    <span className={`flex-1 font-mono ${isActive ? "text-primary" : ""}`}>{labelFor(vn)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground text-center py-6 px-2">
              {activeTab === "mantra" ? "Select a chapter" : `Select a ${tabLabel(activeTab).toLowerCase()}`}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
