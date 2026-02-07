import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, Play, User, Globe, Sparkles, MessageSquareText, StickyNote, Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { VideoPopup } from "@/components/video-popup";
import { WordTooltip } from "@/components/word-tooltip";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookWithDetails, VerseTranslation, Explanation, Note } from "@shared/schema";

interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
}

interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

interface VerseBreadcrumb {
  bookTitle: string;
  adhyayNumber: number | null;
  adhyayTitle: string | null;
  khandaNumber: number | null;
  khandaTitle: string | null;
  verseLabel: string;
  numericLabel: string;
}

interface BookReaderProps {
  bookId: string;
  onVerseSelect: (verseId: string, content: string) => void;
  selectedVerseId: string | null;
  selectedAuthor: string | null;
  selectedCommentaryLanguage: string | null;
  onAuthorChange: (author: string | null) => void;
  onLanguageChange: (lang: string | null) => void;
  navigateToVerse?: number | null;
  onVerseChange?: (verseNumber: number) => void;
  onBreadcrumbChange?: (breadcrumb: VerseBreadcrumb) => void;
}

function VerseExplanation({ 
  verseId, 
  languageCode, 
  authorName,
  showAll 
}: { 
  verseId: string; 
  languageCode: string;
  authorName: string | null;
  showAll: boolean;
}) {
  const { data: explanations, isLoading } = useQuery<Explanation[]>({
    queryKey: ["/api/verses", verseId, "explanations"],
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-3" />;
  }

  const filteredExplanations = explanations?.filter(e => {
    const langMatch = e.languageCode === languageCode;
    if (showAll) return langMatch;
    const authorMatch = !authorName || e.authorName === authorName;
    return langMatch && authorMatch;
  });
  
  if (!filteredExplanations || filteredExplanations.length === 0) {
    return null;
  }

  const grouped = filteredExplanations.reduce((acc, exp) => {
    const key = exp.authorName;
    if (!acc[key]) acc[key] = { authorName: exp.authorName, authorTitle: exp.authorTitle, items: [] };
    acc[key].items.push(exp);
    return acc;
  }, {} as Record<string, { authorName: string; authorTitle: string | null; items: Explanation[] }>);

  return (
    <div className="mt-6 space-y-6" data-testid={`explanation-${verseId}`}>
      {Object.values(grouped).map((group, gIdx) => (
        <div 
          key={group.authorName} 
          className={`${gIdx > 0 ? "pt-5 border-t border-border/40" : ""}`}
          data-testid={`commentary-group-${group.authorName.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary/70 shrink-0" />
            <h4 className="text-sm font-semibold text-foreground">{group.authorName}</h4>
            {group.authorTitle && (
              <span className="text-xs text-muted-foreground">- {group.authorTitle}</span>
            )}
          </div>
          {group.items.map((explanation, idx) => (
            <div key={idx} className={idx > 0 ? "mt-3 pt-3 border-t border-border/20" : ""}>
              <div className="font-serif text-base leading-relaxed whitespace-pre-wrap break-words text-foreground/90 pl-6">
                <WordTooltip
                  content={explanation.content}
                  sourceLanguage={languageCode}
                  className="inline"
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function VerseNotes({ verseId }: { verseId: string }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: verseNotes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/verses", verseId, "notes"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/verses/${verseId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      setNewNote("");
      setAddingNote(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      setEditingId(null);
      setEditContent("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="mt-4 pt-4 border-t border-border/40">
        <button
          onClick={() => { window.location.href = "/auth"; }}
          className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-full border border-border/50 hover:border-primary/30 bg-background/60 backdrop-blur-sm"
          data-testid="button-login-for-notes"
        >
          <StickyNote className="h-4 w-4" />
          <span>Log in to add notes</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/40" data-testid="notes-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <StickyNote className="h-4 w-4" />
          <span>My Notes</span>
          {verseNotes.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{verseNotes.length}</Badge>
          )}
        </div>
        {!addingNote && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddingNote(true)}
            className="h-7 text-xs gap-1"
            data-testid="button-add-note"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {addingNote && (
        <div className="mb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150" data-testid="new-note-form">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write your note..."
            className="text-sm min-h-[80px] bg-background/80 border-primary/20 resize-none"
            data-testid="input-new-note"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAddingNote(false); setNewNote(""); }}
              className="h-7 text-xs"
              data-testid="button-cancel-note"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate(newNote)}
              disabled={!newNote.trim() || createMutation.isPending}
              className="h-7 text-xs"
              data-testid="button-save-note"
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading && <Skeleton className="h-16 w-full" />}

      {verseNotes.length > 0 && (
        <div className="space-y-2">
          {verseNotes.map((note) => (
            <div
              key={note.id}
              className="group relative rounded-md border border-border/40 bg-background/60 backdrop-blur-sm p-3"
              data-testid={`note-${note.id}`}
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="text-sm min-h-[60px] bg-background/80 border-primary/20 resize-none"
                    data-testid="input-edit-note"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      className="h-7 text-xs"
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: note.id, content: editContent })}
                      disabled={!editContent.trim() || updateMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="button-save-edit"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap pr-14">{note.content}</p>
                  <div className="absolute top-2 right-2 flex items-center gap-1 invisible group-hover:visible">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => deleteMutation.mutate(note.id)}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ""}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BookReader({ 
  bookId, 
  onVerseSelect,
  selectedVerseId,
  selectedAuthor,
  selectedCommentaryLanguage,
  onAuthorChange,
  onLanguageChange,
  navigateToVerse,
  onVerseChange,
  onBreadcrumbChange
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [commentaryExpanded, setCommentaryExpanded] = useState(false);

  const { data: book, isLoading, error } = useQuery<BookWithDetails>({
    queryKey: ["/api/books", bookId],
  });

  const { data: commentaryOptions } = useQuery<CommentaryOptions>({
    queryKey: ["/api/books", bookId, "commentary-options"],
  });

  useEffect(() => {
    setInitialized(false);
    onAuthorChange("__all__");
  }, [bookId, onAuthorChange]);

  useEffect(() => {
    if (commentaryOptions && !initialized) {
      onAuthorChange("__all__");
      if (commentaryOptions.languages.length > 0) {
        onLanguageChange(commentaryOptions.languages[0].code);
      }
      setInitialized(true);
    }
  }, [commentaryOptions, initialized, onAuthorChange, onLanguageChange]);

  const isShowingAll = selectedAuthor === "__all__";

  const availableLanguagesForAuthor = useMemo(() => {
    if (!commentaryOptions) return [];
    if (isShowingAll) {
      return commentaryOptions.languages;
    }
    const author = commentaryOptions.authors.find(a => a.authorName === selectedAuthor);
    if (!author) return [];
    return commentaryOptions.languages.filter(l => author.languageCodes.includes(l.code));
  }, [selectedAuthor, commentaryOptions, isShowingAll]);

  const availableAuthors = useMemo(() => {
    return commentaryOptions?.authors || [];
  }, [commentaryOptions]);

  const handleAuthorChange = (authorName: string) => {
    onAuthorChange(authorName);
    if (authorName === "__all__") {
      if (commentaryOptions && commentaryOptions.languages.length > 0) {
        if (!selectedCommentaryLanguage) {
          onLanguageChange(commentaryOptions.languages[0].code);
        }
      }
    } else {
      const author = commentaryOptions?.authors.find(a => a.authorName === authorName);
      if (author && author.languageCodes.length > 0) {
        if (!selectedCommentaryLanguage || !author.languageCodes.includes(selectedCommentaryLanguage)) {
          onLanguageChange(author.languageCodes[0]);
        }
      }
    }
  };

  const handleLanguageChange = (langCode: string) => {
    onLanguageChange(langCode);
  };

  const hasCommentaryOptions = commentaryOptions && 
    (commentaryOptions.authors.length > 0 || commentaryOptions.languages.length > 0);

  const verses = book?.verses || [];
  const currentVerse = verses[currentPage] || null;

  const currentNumericLabel = useMemo(() => {
    if (!currentVerse || currentVerse.adhyayNumber == null || currentVerse.khandaNumber == null) {
      return null;
    }
    const khandaVerses = verses
      .filter((v) => v.adhyayNumber === currentVerse.adhyayNumber && v.khandaNumber === currentVerse.khandaNumber)
      .sort((a, b) => a.verseNumber - b.verseNumber);
    const idx = khandaVerses.findIndex((v) => v.id === currentVerse.id);
    return `${currentVerse.adhyayNumber}.${currentVerse.khandaNumber}.${idx >= 0 ? idx + 1 : 1}`;
  }, [currentVerse, verses]);

  useEffect(() => {
    setCurrentPage(0);
  }, [bookId]);

  useEffect(() => {
    if (navigateToVerse !== null && navigateToVerse !== undefined && book?.verses) {
      const pageIndex = book.verses.findIndex(v => v.verseNumber === navigateToVerse);
      if (pageIndex >= 0 && pageIndex !== currentPage) {
        setCurrentPage(pageIndex);
      }
    }
  }, [navigateToVerse, book?.verses]);

  useEffect(() => {
    if (onVerseChange && book?.verses && book.verses[currentPage]) {
      onVerseChange(book.verses[currentPage].verseNumber);
    }
  }, [currentPage, book?.verses, onVerseChange]);

  useEffect(() => {
    if (onBreadcrumbChange && book?.verses && book.verses[currentPage]) {
      const verse = book.verses[currentPage];
      const adhyayNum = verse.adhyayNumber;
      const khandaNum = verse.khandaNumber;

      let numericLabel: string;
      if (adhyayNum != null && khandaNum != null) {
        const khandaVerses = book.verses
          .filter((v) => v.adhyayNumber === adhyayNum && v.khandaNumber === khandaNum)
          .sort((a, b) => a.verseNumber - b.verseNumber);
        const idx = khandaVerses.findIndex((v) => v.id === verse.id);
        numericLabel = `${adhyayNum}.${khandaNum}.${idx >= 0 ? idx + 1 : 1}`;
      } else {
        numericLabel = `${verse.verseNumber}`;
      }

      onBreadcrumbChange({
        bookTitle: book.title,
        adhyayNumber: adhyayNum ?? null,
        adhyayTitle: verse.adhyayTitle || null,
        khandaNumber: khandaNum ?? null,
        khandaTitle: verse.khandaTitle || null,
        verseLabel: verse.sectionTitle || `Mantra ${verse.verseNumber}`,
        numericLabel,
      });
    }
  }, [currentPage, book, onBreadcrumbChange]);

  useEffect(() => {
    if (book && book.verses && book.verses.length > 0) {
      const verse = book.verses[currentPage];
      if (verse) {
        const langCode = selectedCommentaryLanguage || "devanagari";
        const content = getTranslationFromVerse(verse, langCode);
        onVerseSelect(verse.id, content);
      }
    }
  }, [currentPage, book, selectedCommentaryLanguage]);

  const getTranslationFromVerse = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 sm:h-12 w-3/4" />
          <Skeleton className="h-5 sm:h-6 w-1/2" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Unable to load this text</p>
        </div>
      </div>
    );
  }

  const totalPages = verses.length;

  const getTranslation = (verse: any, langCode: string): string => {
    const translation = verse.translations?.find(
      (t: VerseTranslation) => t.languageCode === langCode
    );
    return translation?.content || "";
  };

  const getOriginalDevanagari = (verse: any): string => {
    return getTranslation(verse, "devanagari");
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goToNextPage();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPrevPage();
    }
  };

  if (!currentVerse) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center space-y-4">
          <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No verses available</p>
        </div>
      </div>
    );
  }

  const verseText = selectedCommentaryLanguage 
    ? getTranslation(currentVerse, selectedCommentaryLanguage) || getOriginalDevanagari(currentVerse)
    : getOriginalDevanagari(currentVerse);

  const getCommentaryContent = (verse: any): string => {
    if (!selectedAuthor || !selectedCommentaryLanguage) return "";
    const explanation = verse.explanations?.find(
      (e: Explanation) => e.authorName === selectedAuthor && e.languageCode === selectedCommentaryLanguage
    );
    return explanation?.content || "";
  };

  const commentaryContext = getCommentaryContent(currentVerse);

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 focus:outline-none" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="border-b border-border px-4 sm:px-8 py-4 sm:py-5 bg-card/50 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="font-serif text-lg sm:text-xl font-semibold tracking-tight">
                  {book.title}
                </h1>
                <Badge variant="secondary" className="shrink-0">
                  {book.category}
                </Badge>
              </div>
              {book.author && (
                <p className="text-xs sm:text-sm text-muted-foreground">{book.author}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              {currentNumericLabel && (
                <Badge variant="outline" className="font-mono text-[11px] px-2 h-5 border-muted-foreground/30" data-testid="text-header-numeric">
                  {currentNumericLabel}
                </Badge>
              )}
              <span>{currentPage + 1} / {totalPages}</span>
            </div>
          </div>
          {book.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2 sm:line-clamp-3">
              {book.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Dharmic background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 text-[12rem] text-primary/[0.03] font-serif select-none">ॐ</div>
          <div className="absolute bottom-20 right-10 text-[10rem] text-primary/[0.03] font-serif select-none rotate-12">ॐ</div>
          <div className="absolute top-1/2 left-1/4 text-[8rem] text-primary/[0.02] font-serif select-none -rotate-6">श्री</div>
          <div className="absolute top-1/3 right-1/4 text-6xl text-primary/[0.03] font-serif select-none">॥</div>
          <div className="absolute bottom-1/3 left-1/3 text-5xl text-primary/[0.03] font-serif select-none">॥</div>
        </div>
        
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto relative z-10">
          <div className="max-w-3xl w-full mx-auto">
            <div 
              className="backdrop-blur-md bg-gradient-to-br from-white/70 via-orange-50/50 to-amber-50/40 dark:from-card/80 dark:via-card/70 dark:to-orange-950/30 border border-primary/20 rounded-2xl p-6 sm:p-10 shadow-lg shadow-primary/5 relative overflow-hidden"
              data-testid={`verse-${currentVerse.verseNumber}`}
            >
              {/* Decorative corner elements */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-primary/20 rounded-tl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-primary/20 rounded-br-2xl"></div>
              
              {/* Large Om watermark */}
              <div className="absolute top-4 right-4 text-6xl text-primary/[0.08] font-serif select-none pointer-events-none">ॐ</div>
              <div className="absolute bottom-4 left-4 text-4xl text-primary/[0.06] font-serif select-none pointer-events-none">ॐ</div>
              
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className="text-primary/40">॥</span>
                <span className="text-sm font-medium text-primary bg-gradient-to-r from-primary/15 to-primary/10 px-4 py-1.5 rounded-full border border-primary/20 flex items-center gap-2">
                  {currentNumericLabel && (
                    <span className="font-mono text-xs opacity-70" data-testid="text-verse-numeric">{currentNumericLabel}</span>
                  )}
                  {currentVerse.sectionTitle || `Verse ${currentVerse.verseNumber}`}
                </span>
                <span className="text-primary/40">॥</span>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -left-2 top-0 text-2xl text-primary/20 font-serif">❝</div>
                  <div 
                    className="font-serif text-xl sm:text-2xl leading-relaxed text-center px-4"
                    data-testid={`text-original-${currentVerse.verseNumber}`}
                  >
                    <WordTooltip
                      content={verseText}
                      commentaryContent={commentaryContext}
                      sourceLanguage={selectedCommentaryLanguage || "devanagari"}
                    />
                  </div>
                  <div className="absolute -right-2 bottom-0 text-2xl text-primary/20 font-serif rotate-180">❝</div>
                </div>
                
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 bg-muted/30 px-3 py-1.5 rounded-full">
                    <Sparkles className="h-3 w-3" />
                    <span>Click any word for AI translation</span>
                  </div>
                </div>

                {hasCommentaryOptions && (
                  <div className="mt-2">
                    <button
                      onClick={() => setCommentaryExpanded(!commentaryExpanded)}
                      className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-full border border-border/50 hover:border-primary/30 bg-background/60 backdrop-blur-sm"
                      data-testid="button-toggle-commentary"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      <span>{commentaryExpanded ? "Hide Commentary" : "Show Commentary"}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${commentaryExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {commentaryExpanded && (
                      <div className="mt-4 pt-4 border-t border-border/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                              value={selectedAuthor || "__all__"}
                              onValueChange={handleAuthorChange}
                            >
                              <SelectTrigger 
                                className="w-[180px] h-8 text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
                                data-testid="select-author"
                              >
                                <SelectValue placeholder="Select Author" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem 
                                  value="__all__"
                                  data-testid="option-author-all"
                                >
                                  All Commentators
                                </SelectItem>
                                {availableAuthors.map((author) => (
                                  <SelectItem 
                                    key={author.authorName} 
                                    value={author.authorName}
                                    data-testid={`option-author-${author.authorName.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    {author.authorName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                              value={selectedCommentaryLanguage || ""}
                              onValueChange={handleLanguageChange}
                              disabled={availableLanguagesForAuthor.length === 0}
                            >
                              <SelectTrigger 
                                className="w-[140px] h-8 text-xs bg-background/80 backdrop-blur-sm border-primary/20" 
                                data-testid="select-commentary-language"
                              >
                                <SelectValue placeholder="Language" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableLanguagesForAuthor.map((lang) => (
                                  <SelectItem 
                                    key={lang.code} 
                                    value={lang.code}
                                    data-testid={`option-lang-${lang.code}`}
                                  >
                                    {lang.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {selectedCommentaryLanguage && (
                          <VerseExplanation 
                            verseId={currentVerse.id} 
                            languageCode={selectedCommentaryLanguage}
                            authorName={isShowingAll ? null : selectedAuthor}
                            showAll={isShowingAll}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <VerseNotes verseId={currentVerse.id} />
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className="gap-2"
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>

                <div className="flex items-center gap-1">
                  {totalPages <= 10 ? (
                    Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === currentPage 
                            ? "bg-primary" 
                            : "bg-muted hover:bg-muted-foreground/30"
                        }`}
                        data-testid={`page-dot-${i + 1}`}
                      />
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {currentPage + 1} / {totalPages}
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages - 1}
                  className="gap-2"
                  data-testid="button-next-page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-center">
            <VideoPopup 
              videoId="8ELHatzdtAk"
              title="Introduction to Isha Upanishad"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
