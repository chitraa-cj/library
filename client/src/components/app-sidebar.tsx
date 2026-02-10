import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Loader2, ChevronRight, ChevronDown, Home, Library, FolderOpen, Folder, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Book, Verse } from "@shared/schema";

interface CatalogSubCategory {
  id: string;
  label: string;
  categoryMatch?: string;
  categoryAltMatch?: string;
}

interface CatalogCategory {
  id: string;
  label: string;
  children?: CatalogSubCategory[];
  categoryMatch?: string;
}

const CATALOG_TREE: CatalogCategory[] = [
  {
    id: "prasthana-shankaracharya",
    label: "Prasthana Thraya - Shankaracharya Bhashya",
    children: [
      { id: "pt-shankara-upanishad", label: "Upanishad", categoryMatch: "Upanishad", categoryAltMatch: "Upanishad Bhashya" },
      { id: "pt-shankara-gita", label: "Bhagavad Gita", categoryMatch: "Gita" },
      { id: "pt-shankara-brahmasutra", label: "Brahma Sutra" },
    ],
  },
  {
    id: "other-shankara-works",
    label: "Other Independent Works of Shankaracharya",
  },
  {
    id: "prasthana-other-acharyas",
    label: "Prasthana Thraya - Other Advaita Acharyas",
    children: [
      { id: "pt-other-upanishad", label: "Upanishad" },
      { id: "pt-other-gita", label: "Bhagavad Gita" },
      { id: "pt-other-brahmasutra", label: "Brahma Sutra" },
    ],
  },
  {
    id: "bhakthi-stotras",
    label: "Bhakthi Stotras of Shankaracharya",
  },
  {
    id: "prakarana-granthas",
    label: "Prakarana Granthas",
    children: [
      { id: "pg-independent", label: "Independent Advaita Works" },
      { id: "pg-other-gitas", label: "Other Gitas" },
      { id: "pg-bhakthi", label: "Bhakthi Granthas" },
      { id: "pg-other-languages", label: "Advaita in Other Languages" },
      { id: "pg-modern", label: "Modern Advaita Works" },
    ],
  },
  {
    id: "shlokas-stotras",
    label: "Shlokas, Sthuthis and Stotras based on Advaita",
  },
];

function matchesCategory(matcher: string | undefined, altMatcher: string | undefined, bookCategory: string): boolean {
  if (matcher && bookCategory === matcher) return true;
  if (altMatcher && bookCategory === altMatcher) return true;
  return false;
}

function findBookPath(book: Book): { categoryId: string; subCategoryId: string | null } | null {
  for (const cat of CATALOG_TREE) {
    if (cat.children) {
      for (const sub of cat.children) {
        if (matchesCategory(sub.categoryMatch, sub.categoryAltMatch, book.category)) {
          return { categoryId: cat.id, subCategoryId: sub.id };
        }
      }
    }
    if (cat.categoryMatch && book.category === cat.categoryMatch) {
      return { categoryId: cat.id, subCategoryId: null };
    }
  }
  return null;
}

export function getBookBreadcrumbPath(book: Book): string[] {
  const path = findBookPath(book);
  if (!path) return [book.category, book.title];
  const cat = CATALOG_TREE.find(c => c.id === path.categoryId);
  if (!cat) return [book.title];
  if (path.subCategoryId && cat.children) {
    const sub = cat.children.find(s => s.id === path.subCategoryId);
    return [cat.label, sub?.label ?? "", book.title];
  }
  return [cat.label, book.title];
}

interface AppSidebarProps {
  selectedBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onSelectVerse?: (verseNumber: number) => void;
  onSelectChapter?: (adhyayNumber: number) => void;
  onSelectPart?: (adhyayNumber: number, khandaNumber: number) => void;
  onSelectCategory?: (categoryId: string) => void;
  selectedVerseNumber?: number;
  chapterViewAdhyay?: number | null;
  onGoHome?: () => void;
  onGoBack?: () => void;
}

interface AdhyayGroup {
  adhyayNumber: number;
  adhyayTitle: string;
  verses: Verse[];
  khandas: KhandaGroup[];
}

interface KhandaGroup {
  khandaNumber: number;
  khandaTitle: string;
  verses: Verse[];
}

type HierarchyType = "three-level" | "two-level" | "flat";

function detectHierarchyType(verses: Verse[]): HierarchyType {
  const hasThreeLevel = verses.some((v) => v.adhyayNumber != null && v.khandaNumber != null);
  if (hasThreeLevel) return "three-level";
  const hasTwoLevel = verses.some((v) => v.adhyayNumber != null);
  if (hasTwoLevel) return "two-level";
  return "flat";
}

function buildHierarchy(verses: Verse[]): AdhyayGroup[] {
  const type = detectHierarchyType(verses);
  if (type === "flat") return [];

  const hierarchyVerses = verses.filter((v) => v.adhyayNumber != null);
  if (hierarchyVerses.length === 0) return [];

  const adhyayMap = new Map<number, AdhyayGroup>();

  for (const verse of hierarchyVerses) {
    const adhyayNum = verse.adhyayNumber!;
    const adhyayTitle = verse.adhyayTitle ?? `Chapter ${adhyayNum}`;

    if (!adhyayMap.has(adhyayNum)) {
      adhyayMap.set(adhyayNum, {
        adhyayNumber: adhyayNum,
        adhyayTitle,
        verses: [],
        khandas: [],
      });
    }

    const adhyay = adhyayMap.get(adhyayNum)!;

    if (type === "three-level" && verse.khandaNumber != null) {
      const khandaNum = verse.khandaNumber;
      const khandaTitle = verse.khandaTitle ?? `Khanda ${khandaNum}`;
      let khanda = adhyay.khandas.find((k) => k.khandaNumber === khandaNum);
      if (!khanda) {
        khanda = { khandaNumber: khandaNum, khandaTitle, verses: [] };
        adhyay.khandas.push(khanda);
      }
      khanda.verses.push(verse);
    } else {
      adhyay.verses.push(verse);
    }
  }

  const sorted = Array.from(adhyayMap.values()).sort(
    (a, b) => a.adhyayNumber - b.adhyayNumber
  );
  for (const adhyay of sorted) {
    adhyay.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    adhyay.khandas.sort((a, b) => a.khandaNumber - b.khandaNumber);
    for (const khanda of adhyay.khandas) {
      khanda.verses.sort((a, b) => a.verseNumber - b.verseNumber);
    }
  }
  return sorted;
}

export { CATALOG_TREE, type CatalogCategory, type CatalogSubCategory };

export function AppSidebar({ selectedBookId, onSelectBook, onSelectVerse, onSelectChapter, onSelectPart, onSelectCategory, selectedVerseNumber, chapterViewAdhyay, onGoHome, onGoBack }: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  const [drillSubCategoryId, setDrillSubCategoryId] = useState<string | null>(null);
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [expandedAdhyays, setExpandedAdhyays] = useState<Set<string>>(new Set());
  const [expandedKhandas, setExpandedKhandas] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { data: books = [], isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: selectedBookData } = useQuery<{ book: Book; verses: Verse[] }>({
    queryKey: ["/api/books", selectedBookId],
    enabled: !!selectedBookId,
  });

  const hierarchy = useMemo(() => {
    if (!selectedBookData?.verses) return [];
    return buildHierarchy(selectedBookData.verses);
  }, [selectedBookData?.verses]);

  const hierarchyType = useMemo(() => detectHierarchyType(selectedBookData?.verses ?? []), [selectedBookData?.verses]);
  const hasHierarchy = hierarchy.length > 0 && hierarchyType !== "flat";

  const booksBySubCategory = useMemo(() => {
    const map: Record<string, Book[]> = {};
    for (const book of books) {
      const path = findBookPath(book);
      if (path?.subCategoryId) {
        if (!map[path.subCategoryId]) map[path.subCategoryId] = [];
        map[path.subCategoryId].push(book);
      } else if (path) {
        if (!map[path.categoryId]) map[path.categoryId] = [];
        map[path.categoryId].push(book);
      }
    }
    return map;
  }, [books]);

  const selectedBookObj = useMemo(() => {
    if (!selectedBookId) return null;
    return books.find(b => b.id === selectedBookId) ?? selectedBookData?.book ?? null;
  }, [selectedBookId, books, selectedBookData]);

  const selectedBookPath = useMemo(() => {
    if (!selectedBookObj) return null;
    return findBookPath(selectedBookObj);
  }, [selectedBookObj]);

  useEffect(() => {
    if (selectedBookPath) {
      setDrillCategoryId(selectedBookPath.categoryId);
      if (selectedBookPath.subCategoryId) {
        setDrillSubCategoryId(selectedBookPath.subCategoryId);
      }
      if (selectedBookId) {
        setExpandedBooks(new Set([selectedBookId]));
      }
    }
  }, [selectedBookPath, selectedBookId]);

  useEffect(() => {
    if (selectedVerseNumber != null && hierarchy.length > 0 && selectedBookId) {
      for (const adhyay of hierarchy) {
        const adhyayKey = `${selectedBookId}-a${adhyay.adhyayNumber}`;
        const inDirectVerses = adhyay.verses.some(v => v.verseNumber === selectedVerseNumber);
        const inKhandaVerses = adhyay.khandas.some(k => k.verses.some(v => v.verseNumber === selectedVerseNumber));
        if (inDirectVerses || inKhandaVerses) {
          setExpandedAdhyays(prev => {
            if (prev.has(adhyayKey)) return prev;
            return new Set([...prev, adhyayKey]);
          });
          if (inKhandaVerses) {
            for (const khanda of adhyay.khandas) {
              if (khanda.verses.some(v => v.verseNumber === selectedVerseNumber)) {
                const khandaKey = `${adhyayKey}-k${khanda.khandaNumber}`;
                setExpandedKhandas(prev => {
                  if (prev.has(khandaKey)) return prev;
                  return new Set([...prev, khandaKey]);
                });
              }
            }
          }
          break;
        }
      }
    }
  }, [selectedVerseNumber, hierarchy, selectedBookId]);

  useEffect(() => {
    if (chapterViewAdhyay != null && hierarchy.length > 0 && selectedBookId) {
      const adhyayKey = `${selectedBookId}-a${chapterViewAdhyay}`;
      setExpandedAdhyays(prev => {
        if (prev.has(adhyayKey)) return prev;
        return new Set([...prev, adhyayKey]);
      });
    }
  }, [chapterViewAdhyay, hierarchy, selectedBookId]);

  const drillCategory = useMemo(() => {
    if (!drillCategoryId) return null;
    return CATALOG_TREE.find(c => c.id === drillCategoryId) ?? null;
  }, [drillCategoryId]);

  const drillSubCategory = useMemo(() => {
    if (!drillSubCategoryId || !drillCategory?.children) return null;
    return drillCategory.children.find(s => s.id === drillSubCategoryId) ?? null;
  }, [drillSubCategoryId, drillCategory]);

  const drillBreadcrumb = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = [];
    crumbs.push({
      label: "All Categories",
      onClick: () => { setDrillCategoryId(null); setDrillSubCategoryId(null); setSearchQuery(""); },
    });
    if (drillCategory) {
      crumbs.push({
        label: drillCategory.label,
        onClick: () => { setDrillSubCategoryId(null); setSearchQuery(""); },
      });
    }
    if (drillSubCategory) {
      crumbs.push({
        label: drillSubCategory.label,
        onClick: () => {},
      });
    }
    return crumbs;
  }, [drillCategory, drillSubCategory]);

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

  const handleDrillCategory = (catId: string) => {
    setDrillCategoryId(catId);
    setDrillSubCategoryId(null);
    setSearchQuery("");
  };

  const handleDrillSubCategory = (subId: string) => {
    setDrillSubCategoryId(subId);
    setSearchQuery("");
  };

  const toggleBookExpand = (bookId: string) => {
    const next = new Set(expandedBooks);
    if (next.has(bookId)) next.delete(bookId);
    else next.add(bookId);
    setExpandedBooks(next);
  };

  const toggleAdhyay = (key: string) => {
    const next = new Set(expandedAdhyays);
    if (next.has(key)) {
      next.delete(key);
      const khandaKeysToRemove = Array.from(expandedKhandas).filter(k => k.startsWith(key + "-k"));
      if (khandaKeysToRemove.length > 0) {
        const nextK = new Set(expandedKhandas);
        khandaKeysToRemove.forEach(k => nextK.delete(k));
        setExpandedKhandas(nextK);
      }
    } else {
      next.add(key);
      const adhyay = hierarchy.find(a => key.endsWith(`-a${a.adhyayNumber}`));
      if (adhyay && adhyay.khandas.length > 0) {
        const nextK = new Set(expandedKhandas);
        adhyay.khandas.forEach(k => nextK.add(`${key}-k${k.khandaNumber}`));
        setExpandedKhandas(nextK);
      }
    }
    setExpandedAdhyays(next);
  };

  const toggleKhanda = (key: string) => {
    const next = new Set(expandedKhandas);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKhandas(next);
  };

  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    if (t.includes(q)) return true;
    const words = t.split(/[\s\-–—,.]+/);
    return words.some(w => w.startsWith(q) || q.startsWith(w));
  }, []);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return CATALOG_TREE;
    const q = searchQuery.trim();
    return CATALOG_TREE.filter(cat => {
      if (fuzzyMatch(cat.label, q)) return true;
      if (cat.children?.some(sub => fuzzyMatch(sub.label, q))) return true;
      const booksInCat = cat.children
        ? cat.children.some(sub => booksBySubCategory[sub.id]?.some(b => fuzzyMatch(b.title, q)))
        : booksBySubCategory[cat.id]?.some(b => fuzzyMatch(b.title, q));
      return booksInCat;
    });
  }, [searchQuery, booksBySubCategory, fuzzyMatch]);

  const filteredSubCategories = useMemo(() => {
    if (!searchQuery.trim() || !drillCategory?.children) return drillCategory?.children ?? [];
    const q = searchQuery.trim();
    return drillCategory.children.filter(sub => {
      if (fuzzyMatch(sub.label, q)) return true;
      const subBooks = booksBySubCategory[sub.id] ?? [];
      return subBooks.some(b => fuzzyMatch(b.title, q));
    });
  }, [searchQuery, drillCategory, booksBySubCategory, fuzzyMatch]);

  const filteredBooks = useMemo(() => {
    if (!drillSubCategoryId) return [];
    const subBooks = booksBySubCategory[drillSubCategoryId] ?? [];
    if (!searchQuery.trim()) return subBooks;
    const q = searchQuery.trim();
    return subBooks.filter(b => {
      if (fuzzyMatch(b.title, q)) return true;
      if (b.id === selectedBookId && hierarchy.length > 0) {
        return hierarchy.some(adhyay =>
          (adhyay.adhyayTitle && fuzzyMatch(adhyay.adhyayTitle, q)) ||
          adhyay.khandas.some(k => k.khandaTitle && fuzzyMatch(k.khandaTitle, q))
        );
      }
      return false;
    });
  }, [searchQuery, drillSubCategoryId, booksBySubCategory, selectedBookId, hierarchy, fuzzyMatch]);

  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim() || hierarchy.length === 0) return hierarchy;
    const q = searchQuery.trim();
    return hierarchy.filter(adhyay => {
      if (adhyay.adhyayTitle && fuzzyMatch(adhyay.adhyayTitle, q)) return true;
      if (adhyay.verses.some(v => v.sectionTitle && fuzzyMatch(v.sectionTitle, q))) return true;
      if (adhyay.khandas.some(k => {
        if (k.khandaTitle && fuzzyMatch(k.khandaTitle, q)) return true;
        if (k.verses.some(v => v.sectionTitle && fuzzyMatch(v.sectionTitle, q))) return true;
        return false;
      })) return true;
      return false;
    });
  }, [searchQuery, hierarchy]);

  const renderVerseTree = (book: Book, verses: Verse[]) => {
    if (verses.length === 0) return null;

    if (hasHierarchy) {
      const isTwoLevel = hierarchyType === "two-level";

      const displayHierarchy = searchQuery.trim() ? filteredHierarchy : hierarchy;

      return (
        <div className="pl-3 mt-1 space-y-0.5">
          {displayHierarchy.map((adhyay) => {
            const adhyayKey = `${book.id}-a${adhyay.adhyayNumber}`;
            const isAdhyayOpen = expandedAdhyays.has(adhyayKey) || !!searchQuery.trim();
            const isCurrentAdhyay = (chapterViewAdhyay != null && adhyay.adhyayNumber === chapterViewAdhyay)
              || (chapterViewAdhyay == null && (isTwoLevel
                ? adhyay.verses.some(v => v.verseNumber === selectedVerseNumber)
                : adhyay.khandas.some(k => k.verses.some(v => v.verseNumber === selectedVerseNumber))));

            return (
              <div key={adhyayKey}>
                <div
                  className={`flex items-center gap-1.5 w-full text-left text-xs py-2 px-2 rounded-md transition-colors ${
                    isCurrentAdhyay && !isAdhyayOpen
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                  }`}
                  data-testid={`button-adhyay-${adhyay.adhyayNumber}`}
                >
                  <button
                    onClick={() => toggleAdhyay(adhyayKey)}
                    className="shrink-0 p-0.5 rounded hover:bg-sidebar-accent/40"
                    data-testid={`button-toggle-adhyay-${adhyay.adhyayNumber}`}
                  >
                    {isAdhyayOpen ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!isAdhyayOpen) {
                        toggleAdhyay(adhyayKey);
                      }
                      if (onSelectChapter) {
                        onSelectChapter(adhyay.adhyayNumber);
                      }
                      if (isMobile) {
                        setOpenMobile(false);
                      }
                    }}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    data-testid={`button-chapter-view-${adhyay.adhyayNumber}`}
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-4 shrink-0 font-mono">
                      Ch. {adhyay.adhyayNumber}
                    </Badge>
                    <span className="text-xs font-medium truncate">
                      {adhyay.adhyayTitle}
                    </span>
                  </button>
                  {isTwoLevel && (
                    <Badge variant="outline" className="text-[9px] px-1 h-4 shrink-0 font-mono border-muted-foreground/30 ml-auto">
                      {adhyay.verses.length}
                    </Badge>
                  )}
                </div>

                {isAdhyayOpen && isTwoLevel && (
                  <div className="ml-3 pl-2 border-l border-border/40 mt-0.5 space-y-0.5">
                    {adhyay.verses.map((verse, idx) => {
                      const verseInChapter = idx + 1;
                      const verseLabel = `${adhyay.adhyayNumber}.${verseInChapter}`;
                      return (
                        <button
                          key={verse.id}
                          onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
                          className={`flex items-center gap-2 w-full text-left text-xs py-2 px-2 rounded-md transition-colors ${
                            selectedVerseNumber === verse.verseNumber
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                          }`}
                          data-testid={`button-verse-nav-${verse.verseNumber}`}
                        >
                          <span className="font-mono text-[10px] text-primary/70 shrink-0 min-w-[2.5rem]">
                            Sl. {verseLabel}
                          </span>
                          <span className="whitespace-normal leading-snug text-wrap break-words">
                            Sloka {verseInChapter}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {isAdhyayOpen && !isTwoLevel && (
                  <div className="ml-3 pl-2 border-l border-border/40 mt-0.5 space-y-0.5">
                    {adhyay.khandas.map((khanda) => {
                      const khandaKey = `${adhyayKey}-k${khanda.khandaNumber}`;
                      const isKhandaOpen = expandedKhandas.has(khandaKey);
                      const isCurrentKhanda = khanda.verses.some(
                        (v) => v.verseNumber === selectedVerseNumber
                      );

                      return (
                        <div key={khandaKey}>
                          <div className={`flex items-center w-full text-xs rounded-md transition-colors ${
                              isCurrentKhanda && !isKhandaOpen
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                            }`}>
                            <button
                              onClick={() => toggleKhanda(khandaKey)}
                              className="shrink-0 py-2 pl-2 pr-1"
                              data-testid={`button-toggle-khanda-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                            >
                              {isKhandaOpen ? (
                                <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (!isKhandaOpen) {
                                  toggleKhanda(khandaKey);
                                }
                                onSelectPart?.(adhyay.adhyayNumber, khanda.khandaNumber);
                                if (isMobile) {
                                  setOpenMobile(false);
                                }
                              }}
                              className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-2 pr-2"
                              data-testid={`button-part-view-${adhyay.adhyayNumber}-${khanda.khandaNumber}`}
                            >
                              <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0 font-mono border-muted-foreground/30">
                                Part {adhyay.adhyayNumber}.{khanda.khandaNumber}
                              </Badge>
                              <span className="truncate">{khanda.khandaTitle}</span>
                            </button>
                          </div>

                          {isKhandaOpen && (
                            <div className="ml-3 pl-2 border-l border-border/30 mt-0.5 space-y-0.5">
                              {khanda.verses.map((verse, idx) => {
                                const verseLabel = `${adhyay.adhyayNumber}.${khanda.khandaNumber}.${idx + 1}`;
                                return (
                                  <button
                                    key={verse.id}
                                    onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
                                    className={`flex items-center gap-2 w-full text-left text-xs py-2 px-2 rounded-md transition-colors ${
                                      selectedVerseNumber === verse.verseNumber
                                        ? "bg-primary/15 text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                                    }`}
                                    data-testid={`button-verse-nav-${verse.verseNumber}`}
                                  >
                                    <span className="font-mono text-[10px] text-primary/70 shrink-0 min-w-[2.5rem]">
                                      Sl. {verseLabel}
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
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="pl-3 mt-1 space-y-0.5">
        {verses.map((verse) => (
          <button
            key={verse.id}
            onClick={() => handleVerseSelect(book.id, verse.verseNumber)}
            className={`flex items-center gap-2 w-full text-left text-xs py-2 px-2 rounded-md transition-colors ${
              selectedVerseNumber === verse.verseNumber
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
            }`}
            data-testid={`button-verse-nav-${verse.verseNumber}`}
          >
            <span className="whitespace-normal leading-snug text-wrap break-words">
              {verse.sectionTitle || `Verse ${verse.verseNumber}`}
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderBookItem = (book: Book) => {
    const isSelected = selectedBookId === book.id;
    const isExpanded = expandedBooks.has(book.id) || isSelected;
    const verses = isSelected && selectedBookData?.verses ? selectedBookData.verses : [];

    return (
      <div key={book.id}>
        <button
          onClick={() => {
            handleBookSelect(book.id);
            if (isSelected) toggleBookExpand(book.id);
          }}
          className={`flex items-center gap-2 w-full text-left text-xs py-2.5 px-2 rounded-md transition-colors ${
            isSelected
              ? "bg-primary/15 text-primary font-semibold"
              : "text-foreground/80 hover:text-foreground hover:bg-sidebar-accent/30"
          }`}
          data-testid={`button-book-${book.id}`}
        >
          {isExpanded && verses.length > 0 ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
          ) : (
            <BookOpen className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
          )}
          <span className="font-serif text-xs leading-snug flex-1 min-w-0">{book.title}</span>
          {book.totalVerses && book.totalVerses > 0 && (
            <Badge variant={isSelected ? "default" : "secondary"} className="text-[9px] font-medium px-1 h-4 shrink-0">
              {book.totalVerses}
            </Badge>
          )}
        </button>
        {isExpanded && isSelected && renderVerseTree(book, verses)}
      </div>
    );
  };

  const renderDrillBreadcrumb = () => {
    if (drillBreadcrumb.length <= 1) return null;
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-1.5 flex-wrap border-b border-border/30 mb-1" data-testid="sidebar-breadcrumb">
        {drillBreadcrumb.map((crumb, idx) => {
          const isLast = idx === drillBreadcrumb.length - 1;
          return (
            <span key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />}
              <span
                className={`${isLast ? 'text-primary font-medium' : 'hover:text-foreground cursor-pointer underline-offset-2 hover:underline'} truncate max-w-[140px]`}
                onClick={() => { if (!isLast) crumb.onClick(); }}
                title={crumb.label}
              >
                {crumb.label}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const toggleCategory = (catId: string) => {
    const next = new Set(expandedCategories);
    if (next.has(catId)) next.delete(catId);
    else next.add(catId);
    setExpandedCategories(next);
  };

  const renderCategoryTree = () => {
    const items = searchQuery.trim() ? filteredTree : CATALOG_TREE;
    return (
      <div className="space-y-0.5">
        {items.map((cat) => {
          const directBooks = booksBySubCategory[cat.id] ?? [];
          const hasChildren = !!cat.children && cat.children.length > 0;
          const hasAnyContent = hasChildren || directBooks.length > 0;
          const isExpanded = expandedCategories.has(cat.id);

          return (
            <div key={cat.id}>
              <div className={`flex items-center w-full text-[11px] rounded-md transition-colors font-medium ${
                !hasAnyContent
                  ? "text-muted-foreground/50 cursor-default"
                  : "text-foreground/80 hover:text-foreground hover:bg-sidebar-accent/30"
              }`}>
                {hasAnyContent ? (
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="shrink-0 py-2.5 pl-2 pr-1"
                    data-testid={`button-toggle-category-${cat.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                  </button>
                ) : (
                  <span className="shrink-0 py-2.5 pl-2 pr-1">
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                  </span>
                )}
                <button
                  onClick={() => {
                    if (hasAnyContent) {
                      onSelectCategory?.(cat.id);
                    }
                  }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left py-2.5 pr-2"
                  data-testid={`button-category-${cat.id}`}
                  disabled={!hasAnyContent}
                >
                  <Library className={`h-3.5 w-3.5 shrink-0 ${hasAnyContent ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`} />
                  <span className="flex-1 min-w-0 leading-snug">{cat.label}</span>
                </button>
              </div>

              {isExpanded && hasChildren && (
                <div className="ml-3 pl-2 border-l border-border/40 mt-0.5 space-y-0.5">
                  {cat.children!.map(sub => {
                    const subBooks = booksBySubCategory[sub.id] ?? [];
                    const hasBooks = subBooks.length > 0;
                    return (
                      <div key={sub.id}>
                        <button
                          onClick={() => {
                            if (hasBooks && subBooks.length === 1) {
                              handleBookSelect(subBooks[0].id);
                            } else if (hasBooks) {
                              onSelectCategory?.(cat.id);
                            }
                          }}
                          className={`flex items-center gap-2 w-full text-left text-xs py-2 px-2 rounded-md transition-colors ${
                            !hasBooks
                              ? "text-muted-foreground/50 cursor-default"
                              : "text-foreground/80 hover:text-foreground hover:bg-sidebar-accent/30"
                          }`}
                          data-testid={`button-subcat-${sub.id}`}
                          disabled={!hasBooks}
                        >
                          {hasBooks ? (
                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                          ) : (
                            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                          )}
                          <span className="flex-1 min-w-0 truncate">{sub.label}</span>
                          {hasBooks && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-4 shrink-0">
                              {subBooks.length}
                            </Badge>
                          )}
                          {!hasBooks && (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                          )}
                        </button>
                        {hasBooks && subBooks.length > 1 && (
                          <div className="ml-3 pl-2 border-l border-border/30 mt-0.5 space-y-0.5">
                            {subBooks.map(book => (
                              <button
                                key={book.id}
                                onClick={() => handleBookSelect(book.id)}
                                className={`flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors ${
                                  selectedBookId === book.id
                                    ? "bg-primary/15 text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                                }`}
                                data-testid={`button-book-tree-${book.id}`}
                              >
                                <BookOpen className="h-3 w-3 shrink-0" />
                                <span className="font-serif text-[11px] leading-snug flex-1 min-w-0 truncate">{book.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && !hasChildren && directBooks.length > 0 && (
                <div className="ml-3 pl-2 border-l border-border/40 mt-0.5 space-y-0.5">
                  {directBooks.map(book => (
                    <button
                      key={book.id}
                      onClick={() => handleBookSelect(book.id)}
                      className={`flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors ${
                        selectedBookId === book.id
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30"
                      }`}
                      data-testid={`button-book-tree-${book.id}`}
                    >
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="font-serif text-[11px] leading-snug flex-1 min-w-0 truncate">{book.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {isExpanded && !hasChildren && directBooks.length === 0 && (
                <div className="ml-3 pl-2 border-l border-border/40 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/50 italic px-2 py-1 block">Coming soon...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCategoryList = () => {
    const items = searchQuery.trim() ? filteredTree : CATALOG_TREE;
    return (
      <div className="space-y-0.5">
        {items.map((cat) => {
          const directBooks = booksBySubCategory[cat.id] ?? [];
          const hasChildren = !!cat.children && cat.children.length > 0;
          const hasAnyContent = hasChildren || directBooks.length > 0;

          return (
            <button
              key={cat.id}
              onClick={() => hasAnyContent ? handleDrillCategory(cat.id) : undefined}
              className={`flex items-center gap-2 w-full text-left text-[11px] py-2.5 px-2 rounded-md transition-colors font-medium ${
                !hasAnyContent
                  ? "text-muted-foreground/50 cursor-default"
                  : "text-foreground/80 hover:text-foreground hover:bg-sidebar-accent/30"
              }`}
              data-testid={`button-category-drill-${cat.id}`}
              disabled={!hasAnyContent}
            >
              <Library className={`h-3.5 w-3.5 shrink-0 ${hasAnyContent ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`} />
              <span className="flex-1 min-w-0 leading-snug">{cat.label}</span>
              {hasAnyContent ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              ) : (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSubCategoryList = () => {
    if (!drillCategory?.children) {
      const directBooks = booksBySubCategory[drillCategory?.id ?? ""] ?? [];
      if (directBooks.length > 0) {
        return <div className="space-y-0.5">{directBooks.map(book => renderBookItem(book))}</div>;
      }
      return (
        <div className="py-4 px-2 text-xs text-muted-foreground/60 italic text-center">
          Coming soon...
        </div>
      );
    }

    const displaySubs = searchQuery.trim() ? filteredSubCategories : drillCategory.children;

    return (
      <div className="space-y-0.5">
        {displaySubs.map((sub) => {
          const subBooks = booksBySubCategory[sub.id] ?? [];
          const hasBooks = subBooks.length > 0;

          return (
            <button
              key={sub.id}
              onClick={() => hasBooks ? handleDrillSubCategory(sub.id) : undefined}
              className={`flex items-center gap-2 w-full text-left text-xs py-2.5 px-2 rounded-md transition-colors ${
                !hasBooks
                  ? "text-muted-foreground/50 cursor-default"
                  : "text-foreground/80 hover:text-foreground hover:bg-sidebar-accent/30"
              }`}
              data-testid={`button-subcat-${sub.id}`}
              disabled={!hasBooks}
            >
              {hasBooks ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/60" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              )}
              <span className="flex-1 min-w-0 truncate">{sub.label}</span>
              {hasBooks ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              ) : (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderBookList = () => {
    if (!drillSubCategoryId) return null;
    const displayBooks = searchQuery.trim() ? filteredBooks : (booksBySubCategory[drillSubCategoryId] ?? []);
    if (displayBooks.length === 0) {
      return (
        <div className="py-4 px-2 text-xs text-muted-foreground/60 italic text-center">
          {searchQuery.trim() ? "No matches found" : "Coming soon..."}
        </div>
      );
    }
    return <div className="space-y-0.5">{displayBooks.map(book => renderBookItem(book))}</div>;
  };

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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSidebar}
                  data-testid="button-expand-sidebar"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  title="Collapse sidebar"
                  data-testid="button-collapse-sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  selectedBookId && selectedBookData?.verses
                    ? "Search chapters..."
                    : drillSubCategoryId
                      ? "Search books..."
                      : drillCategoryId
                        ? "Search subcategories..."
                        : "Search categories..."
                }
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
          ) : isCollapsed ? (
            <div className="flex flex-col items-center gap-1 py-2">
              {books.map(book => (
                <Tooltip key={book.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={selectedBookId === book.id ? "default" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleBookSelect(book.id)}
                      data-testid={`button-book-${book.id}`}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{book.title}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {selectedBookId ? (
                <>
                  {renderDrillBreadcrumb()}
                  {!drillCategoryId && renderCategoryList()}
                  {drillCategoryId && !drillSubCategoryId && renderSubCategoryList()}
                  {drillCategoryId && drillSubCategoryId && renderBookList()}
                </>
              ) : (
                renderCategoryTree()
              )}
            </div>
          )}
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
