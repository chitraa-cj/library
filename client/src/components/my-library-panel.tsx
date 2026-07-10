import { useEffect, useState } from "react";
import {
  BookOpen,
  Bookmark,
  PenLine,
  DownloadCloud,
  Sparkles,
  GraduationCap,
  Settings,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/lib/translations";
import { useProgressSummary } from "@/hooks/use-progress";
import {
  getBookmarks,
  removeBookmark,
  subscribeBookmarks,
  type BookmarkEntry,
} from "@/lib/bookmarks";
import { getLastRead, subscribeLastRead, type LastReadEntry } from "@/lib/last-read";
import type { Book } from "@shared/schema";

type View = "main" | "collection" | "insights" | "notes" | "offline" | "studyguide";

interface MyLibraryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allBooks?: Book[];
  isAuthenticated: boolean;
  languageCode?: string | null;
  onResume: (entry: LastReadEntry) => void;
  onOpenBookmark: (entry: BookmarkEntry) => void;
  onBrowse: () => void;
  onOpenSettings: () => void;
}

export function MyLibraryPanel({
  open,
  onOpenChange,
  allBooks,
  isAuthenticated,
  languageCode,
  onResume,
  onOpenBookmark,
  onBrowse,
  onOpenSettings,
}: MyLibraryPanelProps) {
  const { t } = useTranslation(languageCode ?? null);
  const [view, setView] = useState<View>("main");
  const [lastRead, setLastRead] = useState<LastReadEntry | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const { data: progressSummary } = useProgressSummary();

  // Reset to the main view each time the panel is opened, and sync local stores.
  useEffect(() => {
    if (open) {
      setView("main");
      setLastRead(getLastRead());
      setBookmarks(getBookmarks());
    }
  }, [open]);

  useEffect(() => subscribeLastRead(() => setLastRead(getLastRead())), []);
  useEffect(() => subscribeBookmarks(() => setBookmarks(getBookmarks())), []);

  const bookById = (id?: string) => (id ? allBooks?.find((b) => b.id === id) : undefined);

  const resumeBook = bookById(lastRead?.bookId);
  const resumeTotal = resumeBook?.totalVerses || 0;
  const resumePos = lastRead?.verseNumber ?? 0;
  const resumePct = resumeTotal > 0 ? Math.min(100, Math.round((resumePos / resumeTotal) * 100)) : 0;

  const versesCompleted = progressSummary
    ? Object.values(progressSummary).reduce((a, b) => a + b, 0)
    : 0;
  const booksStarted = progressSummary ? Object.keys(progressSummary).length : 0;

  const title =
    view === "collection"
      ? t("myCollection")
      : view === "insights"
      ? t("insights")
      : view === "notes"
      ? t("myNotes")
      : view === "offline"
      ? t("availableOffline")
      : view === "studyguide"
      ? t("studyGuide")
      : t("myLibrary");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 py-4 border-b border-border text-left space-y-0">
          <div className="flex items-center gap-2">
            {view !== "main" && (
              <button
                type="button"
                onClick={() => setView("main")}
                className="-ml-1 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors"
                aria-label={t("back")}
                data-testid="button-library-back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <SheetTitle className="font-page-heading text-2xl font-bold">{title}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {view === "main" && (
              <MainView
                t={t}
                lastRead={lastRead}
                resumeBook={resumeBook}
                resumeTotal={resumeTotal}
                resumePos={resumePos}
                resumePct={resumePct}
                bookmarkCount={bookmarks.length}
                onResume={() => {
                  if (lastRead) {
                    onResume(lastRead);
                    onOpenChange(false);
                  }
                }}
                onBrowse={() => {
                  onBrowse();
                  onOpenChange(false);
                }}
                onOpenCollection={() => setView("collection")}
                onOpenNotes={() => setView("notes")}
                onOpenOffline={() => setView("offline")}
                onOpenInsights={() => setView("insights")}
                onOpenStudyGuide={() => setView("studyguide")}
                onOpenSettings={() => {
                  onOpenSettings();
                  onOpenChange(false);
                }}
              />
            )}

            {view === "collection" && (
              <CollectionView
                t={t}
                bookmarks={bookmarks}
                onOpen={(entry) => {
                  onOpenBookmark(entry);
                  onOpenChange(false);
                }}
                onRemove={(verseId) => removeBookmark(verseId)}
              />
            )}

            {view === "insights" && (
              <InsightsView
                t={t}
                isAuthenticated={isAuthenticated}
                versesCompleted={versesCompleted}
                booksStarted={booksStarted}
                savedItems={bookmarks.length}
              />
            )}

            {(view === "notes" || view === "offline" || view === "studyguide") && (
              <ComingSoonView t={t} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

type TFn = (key: any) => string;

function MainView(props: {
  t: TFn;
  lastRead: LastReadEntry | null;
  resumeBook?: Book;
  resumeTotal: number;
  resumePos: number;
  resumePct: number;
  bookmarkCount: number;
  onResume: () => void;
  onBrowse: () => void;
  onOpenCollection: () => void;
  onOpenNotes: () => void;
  onOpenOffline: () => void;
  onOpenInsights: () => void;
  onOpenStudyGuide: () => void;
  onOpenSettings: () => void;
}) {
  const { t, lastRead, resumeBook, resumeTotal, resumePos, resumePct } = props;
  const bookTitle = lastRead?.bookTitle || resumeBook?.title || "";

  return (
    <div className="space-y-3">
      {/* Resume Study */}
      {lastRead ? (
        <button
          type="button"
          onClick={props.onResume}
          className="group w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
          data-testid="button-resume-study"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">{t("resumeStudy")}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-primary font-medium truncate mt-0.5">{bookTitle}</p>
              {lastRead.verseLabel && (
                <p className="text-xs text-muted-foreground">
                  {t("mantra")} {lastRead.verseLabel}
                </p>
              )}
              {resumeTotal > 0 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${resumePct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {resumePos}/{resumeTotal}
                  </span>
                </div>
              )}
            </div>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={props.onBrowse}
          className="w-full text-left rounded-xl border border-dashed border-border bg-card/50 p-4 hover:border-primary/40 transition-colors"
          data-testid="button-resume-study-empty"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{t("resumeStudy")}</p>
              <p className="text-xs text-muted-foreground">{t("resumeStudyEmpty")}</p>
            </div>
          </div>
        </button>
      )}

      {/* Primary cards */}
      <LibraryCard
        icon={<Bookmark className="h-5 w-5 text-primary" />}
        title={t("myCollection")}
        desc={t("myCollectionDesc")}
        badge={props.bookmarkCount > 0 ? String(props.bookmarkCount) : undefined}
        onClick={props.onOpenCollection}
        testId="button-my-collection"
      />
      <LibraryCard
        icon={<PenLine className="h-5 w-5 text-primary" />}
        title={t("myNotes")}
        desc={t("myNotesDesc")}
        onClick={props.onOpenNotes}
        testId="button-my-notes"
      />
      <LibraryCard
        icon={<DownloadCloud className="h-5 w-5 text-primary" />}
        title={t("availableOffline")}
        desc={t("availableOfflineDesc")}
        onClick={props.onOpenOffline}
        testId="button-available-offline"
      />

      <div className="h-px bg-border my-2" />

      {/* Secondary rows */}
      <LibraryRow
        icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
        title={t("insights")}
        desc={t("insightsDesc")}
        onClick={props.onOpenInsights}
        testId="button-insights"
      />
      <LibraryRow
        icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
        title={t("studyGuide")}
        desc={t("studyGuideDesc")}
        onClick={props.onOpenStudyGuide}
        testId="button-study-guide"
      />
      <LibraryRow
        icon={<Settings className="h-4 w-4 text-muted-foreground" />}
        title={t("settings")}
        desc={t("settingsDesc")}
        onClick={props.onOpenSettings}
        testId="button-library-settings"
      />
    </div>
  );
}

function LibraryCard({
  icon,
  title,
  desc,
  badge,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{title}</p>
            {badge && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

function LibraryRow({
  icon,
  title,
  desc,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-lg px-2 py-2.5 hover:bg-accent/50 transition-colors"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

function CollectionView({
  t,
  bookmarks,
  onOpen,
  onRemove,
}: {
  t: TFn;
  bookmarks: BookmarkEntry[];
  onOpen: (entry: BookmarkEntry) => void;
  onRemove: (verseId: string) => void;
}) {
  if (bookmarks.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Bookmark className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t("noBookmarksYet")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {bookmarks.map((b) => {
        const canOpen = !!b.bookId && typeof b.verseNumber === "number";
        return (
          <div
            key={b.verseId}
            className="group relative rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3"
            data-testid={`collection-item-${b.verseId}`}
          >
            <button
              type="button"
              onClick={() => canOpen && onOpen(b)}
              disabled={!canOpen}
              className="flex-1 min-w-0 text-left disabled:cursor-default"
            >
              <p className="font-semibold text-sm text-primary truncate">
                {b.verseLabel ? `${b.bookTitle ? b.bookTitle + " " : ""}${b.verseLabel}` : b.bookTitle || t("savedItems")}
              </p>
              {b.bookTitle && b.verseLabel && (
                <p className="text-xs text-muted-foreground truncate">{b.bookTitle}</p>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(b.verseId)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors shrink-0"
              aria-label={t("remove")}
              data-testid={`collection-remove-${b.verseId}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function InsightsView({
  t,
  isAuthenticated,
  versesCompleted,
  booksStarted,
  savedItems,
}: {
  t: TFn;
  isAuthenticated: boolean;
  versesCompleted: number;
  booksStarted: number;
  savedItems: number;
}) {
  const stats = [
    { label: t("versesCompleted"), value: isAuthenticated ? versesCompleted : 0 },
    { label: t("booksStarted"), value: isAuthenticated ? booksStarted : 0 },
    { label: t("savedItems"), value: savedItems },
  ];
  return (
    <div className="grid grid-cols-1 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
        >
          <span className="text-sm text-muted-foreground">{s.label}</span>
          <span className="font-page-heading text-2xl font-bold text-primary tabular-nums">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function ComingSoonView({ t }: { t: TFn }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <p className="font-semibold text-sm">{t("comingSoon")}</p>
      <p className="text-sm text-muted-foreground">{t("comingSoonDesc")}</p>
    </div>
  );
}
