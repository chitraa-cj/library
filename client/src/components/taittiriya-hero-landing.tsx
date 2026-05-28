import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Feather, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookTitleTranslations } from "@/lib/content-translations";

const HERO_IMAGE_URL = "/images/taittiriya-upanishad-hero.png";

export interface TaittiriyaLandingBook {
  id: string;
  slug?: string | null;
  title: string;
  author: string | null;
  description: string | null;
  totalVerses: number | null;
  bhashyamName?: string;
  teekasList?: { name: string; author: string }[];
}

export interface TaittiriyaChapterInfo {
  number: number;
  title: string;
  verseCount: number;
}

export interface TaittiriyaLandingMeta {
  iastTitle: string;
  devanagariTitle: string;
  authorIast: string;
  verseCount: string;
  verseLabel: string;
  introText: string;
  sidebarDescription: string;
  structureItems: { title: string; description: string }[];
}

export function isTaittiriyaBook(book: { slug?: string | null; title?: string }): boolean {
  const slug = (book.slug || "").toLowerCase();
  const title = (book.title || "").toLowerCase();
  return slug.startsWith("taittariya") || slug.includes("taittiriya") || title.includes("taittiriya");
}

interface TaittiriyaHeroLandingProps {
  book: TaittiriyaLandingBook;
  meta: TaittiriyaLandingMeta;
  chapters: TaittiriyaChapterInfo[];
  onSelectBook: (bookId: string) => void;
  onSelectChapter?: (bookId: string, adhyayNumber: number) => void;
  onBack?: () => void;
  tc?: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
}

export function TaittiriyaHeroLanding({
  book,
  meta,
  chapters,
  onSelectBook,
  onSelectChapter,
  onBack,
  tc = (text) => text || "",
}: TaittiriyaHeroLandingProps) {
  const [introExpanded, setIntroExpanded] = useState(false);

  const introPreview =
    "The Taittiriya Upanishad is one of the older, \"primary\" Upanishads, part of the Yajur Veda. It says that the highest goal is to know the Brahman, for that is truth. It is divided into three sections,";
  const fullIntro = [book.description, meta.introText].filter(Boolean).join("\n\n") || meta.introText;
  const showIntroToggle = fullIntro.length > introPreview.length + 20;
  const introDisplay =
    introExpanded || !showIntroToggle
      ? fullIntro
      : fullIntro.substring(0, introPreview.length).replace(/\s+\S*$/, "") + "...";

  const valliCards = meta.structureItems.map((item, idx) => {
    const ch = chapters[idx];
    return {
      ...item,
      chapterNumber: ch?.number ?? idx + 1,
      mantraCount: ch?.verseCount,
    };
  });

  const chapterRows =
    chapters.length > 0
      ? chapters
      : valliCards.map((v, i) => ({
          number: v.chapterNumber,
          title: v.title,
          verseCount: v.mantraCount ?? [23, 15, 16][i] ?? 0,
        }));

  return (
    <div
      className="relative min-h-[min(100dvh,920px)] w-full overflow-hidden bg-background"
      data-testid="taittiriya-hero-landing"
    >
      <img
        src={HERO_IMAGE_URL}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
      />
      {/* Light: soft scrim only — text lives on solid cards. Dark: stronger cinematic overlay. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/55 via-background/15 to-transparent dark:from-black/85 dark:via-black/55 dark:to-black/35"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-background/65 via-transparent to-background/25 dark:from-black/90 dark:via-black/20 dark:to-black/50"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[min(100dvh,920px)] flex-col p-4 sm:p-6 lg:p-8">
        {onBack && (
          <div className="mb-4 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              data-testid="button-back-to-upanishads"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All Upanishads
            </Button>
          </div>
        )}

        <div className="-mt-2 mb-4 flex justify-end sm:mt-0 lg:absolute lg:right-8 lg:top-20 lg:mb-0">
          <Button
            size="lg"
            className="gap-2 shadow-lg backdrop-blur-sm"
            onClick={() => onSelectBook(book.id)}
            data-testid="button-open-text-landing"
          >
            <BookOpen className="h-4 w-4" />
            Open Text
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:gap-8">
          <aside
            className="w-full shrink-0 rounded-xl border border-border bg-card p-4 shadow-xl dark:bg-card/75 dark:shadow-2xl lg:w-72 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto"
            data-testid="book-landing-sidebar"
          >
            <h2 className="font-serif text-base font-semibold text-foreground">{meta.iastTitle}</h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              Category Overview
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.sidebarDescription}</p>

            <div className="my-3 h-px bg-border" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">
              Structure
            </p>
            <div className="mt-2 space-y-1" data-testid="landing-chapter-tree">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary/15"
                onClick={() => onSelectBook(book.id)}
                data-testid="tree-book-main"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{tc(book.title, bookTitleTranslations)}</span>
              </button>

              {chapterRows.map((ch, idx) => (
                <button
                  key={ch.number}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-accent"
                  onClick={() => {
                    if (onSelectChapter) {
                      onSelectChapter(book.id, ch.number);
                    } else {
                      onSelectBook(book.id);
                    }
                  }}
                  data-testid={`tree-chapter-${ch.number}`}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{ch.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ch.verseCount}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                </button>
              ))}
            </div>

            {book.author && (
              <>
                <div className="my-3 h-px bg-border" />
                <div data-testid="landing-bhashyakara">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                    Bhāṣyakāra (Commentator)
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{book.author}</span>
                  </div>
                  {book.bhashyamName && (
                    <p className="ml-8 mt-1 text-xs italic text-muted-foreground">{book.bhashyamName}</p>
                  )}
                </div>
              </>
            )}

            {book.teekasList && book.teekasList.length > 0 && (
              <div className="mt-3" data-testid="landing-teekakaras">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  Ṭīkākāras (Sub-commentators)
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {book.teekasList.map((teeka, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Feather className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {teeka.author || teeka.name}
                        </span>
                        {teeka.author && teeka.name && (
                          <p className="truncate text-xs italic text-primary/80">{teeka.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col justify-between gap-8 lg:pt-6">
            <div
              className="max-w-2xl rounded-xl border border-border bg-card p-5 shadow-lg sm:p-6 dark:border-transparent dark:bg-transparent dark:p-0 dark:shadow-none"
              data-testid="book-landing-content"
            >
              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {meta.iastTitle}
              </h1>
              <p className="mt-1 font-serif text-xl text-foreground sm:text-2xl">{meta.devanagariTitle}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {meta.authorIast} | {meta.verseCount} {meta.verseLabel}
              </p>

              <div className="mt-8 max-w-lg">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Introduction</h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/80 dark:text-muted-foreground">
                  {introDisplay}
                </p>
                {showIntroToggle && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto gap-1 px-0 text-xs font-semibold uppercase tracking-wider text-primary hover:text-primary/80"
                    onClick={() => setIntroExpanded(!introExpanded)}
                    data-testid="button-read-introduction"
                  >
                    {introExpanded ? "Show Less" : "Read Introduction"}
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${introExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>
            </div>

            <div
              className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-3"
              data-testid="taittiriya-valli-cards"
            >
              {valliCards.map((item, idx) => (
                <button
                  key={item.title}
                  type="button"
                  className="rounded-xl border border-border bg-card p-4 text-left shadow-lg transition-colors hover:border-primary/40 hover:bg-card/95 dark:bg-card/80"
                  onClick={() => {
                    if (onSelectChapter) {
                      onSelectChapter(book.id, item.chapterNumber);
                    } else {
                      onSelectBook(book.id);
                    }
                  }}
                  data-testid={`structure-item-${idx}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75 dark:text-muted-foreground">
                    {item.description}
                  </p>
                  {item.mantraCount != null && item.mantraCount > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground/80">{item.mantraCount} mantras</p>
                  )}
                </button>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
