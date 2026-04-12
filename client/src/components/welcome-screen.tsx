import { BookOpen, Library, FolderOpen, Lock, ArrowLeft, ChevronRight, ScrollText, Feather, Users, Heart, BookMarked, Music } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import { CATALOG_TREE, type CatalogCategory } from "@/components/app-sidebar";
import { useTranslation } from "@/lib/translations";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations } from "@/lib/content-translations";

import catImgPrasthana from "@assets/image_1770803826016.png";
import catImgPrakarana from "@assets/image_1770803849999.png";
import catImgShlokas from "@assets/image_1770803820218.png";

const categoryImages: Record<string, string> = {
  "prasthana-thraya": catImgPrasthana,
  "prakarana-granthas": catImgPrakarana,
  "other-texts": catImgShlokas,
};

const categoryIcons: Record<string, typeof ScrollText> = {
  "prasthana-thraya": ScrollText,
  "prakarana-granthas": BookMarked,
  "other-texts": Library,
};

interface Book {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  coverImage: string | null;
  totalVerses: number | null;
  bhashyamName?: string;
  teekasList?: { name: string; author: string }[];
}

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onBrowseLibrary: () => void;
  languageCode?: string | null;
}

const bookVideoConfig: Record<string, { videoId: string; videoTitle: string }> = {
  "isha-upanishad-bhashya": {
    videoId: "8ELHatzdtAk",
    videoTitle: "Introduction to Isha Upanishad",
  },
};

function getBooksForSubCategory(books: Book[], categoryMatch?: string, categoryAltMatch?: string): Book[] {
  if (!categoryMatch && !categoryAltMatch) return [];
  return books.filter(b => matchesCategory(categoryMatch, categoryAltMatch, b.category));
}

function getBooksForCategory(books: Book[], cat: CatalogCategory): Book[] {
  if (cat.categoryMatch) {
    return books.filter(b => b.category === cat.categoryMatch);
  }
  if (cat.children) {
    const matched: Book[] = [];
    for (const sub of cat.children) {
      matched.push(...getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch));
    }
    return matched;
  }
  return [];
}

export function WelcomeScreen({ books, onSelectBook, onBrowseLibrary, languageCode }: WelcomeScreenProps) {
  const { t } = useTranslation(languageCode ?? null);
  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif rotate-12">ॐ</div>
        <div className="absolute top-1/2 right-1/3 text-[7rem] text-primary/[0.01] dark:text-primary/[0.015] font-serif -rotate-6">श्री</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-primary/5 dark:bg-primary/15 rounded-full blur-xl"></div>
            <img
              src="https://oneness.org.in/assets/img/favicon.png"
              alt="Advaita Vaaridhi"
              className="h-16 sm:h-20 w-16 sm:w-20 object-contain mx-auto relative"
            />
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
            <h1 className="font-serif text-xl sm:text-3xl font-semibold tracking-tight text-primary">
              {t("advaitaVedantaDigitalLibrary")}
            </h1>
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
          </div>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {t("eternalEchoOfNonDuality")}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed mt-2">
            {t("welcomeDescription")}
          </p>
        </div>

        <div className="flex justify-center">
          <Button
            variant="default"
            onClick={onBrowseLibrary}
            className="gap-2 font-serif"
            data-testid="button-browse-library"
          >
            <Library className="h-4 w-4" />
            {t("browseTheLibrary")}
          </Button>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <BookMarked className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("treasuryOfWisdom")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2 pl-8">
              <p>{t("treasuryIntro")}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="text-foreground font-medium">{t("prasthanatriyaBhashyasLabel")}</span> {t("prasthanatriyaBhashyasDesc")}</li>
                <li><span className="text-foreground font-medium">{t("prakaranaGranthasLabel")}</span> {t("prakaranaGranthasDesc")}</li>
                <li><span className="text-foreground font-medium">{t("scholasticTraditionLabel")}</span> {t("scholasticTraditionDesc")}</li>
                <li><span className="text-foreground font-medium">{t("regionalLuminariesLabel")}</span> {t("regionalLuminariesDesc")}</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("ourVisionSanskritikEkta")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-8">
              <p>{t("visionDescription")}</p>
            </div>
            <blockquote className="text-center font-serif text-sm sm:text-base text-primary/70 italic py-2">
              {t("brahmanQuote")}
            </blockquote>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Library className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground">{t("featuresOfDigitalLibrary")}</h2>
              <div className="h-px flex-1 bg-primary/15"></div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-1 pl-8">
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="text-foreground font-medium">{t("authenticTranscriptionsLabel")}</span> {t("authenticTranscriptionsDesc")}</li>
                <li><span className="text-foreground font-medium">{t("manuscriptPreservationLabel")}</span> {t("manuscriptPreservationDesc")}</li>
                <li><span className="text-foreground font-medium">{t("scholarlySearchLabel")}</span> {t("scholarlySearchDesc")}</li>
              </ul>
            </div>
          </div>

          <blockquote className="text-center font-serif text-xs sm:text-sm text-primary/60 italic py-2">
            {t("saVidyaQuote")}
          </blockquote>

          <p className="text-xs text-center text-muted-foreground/70">
            {t("invitationText")}
          </p>
          <p className="text-[10px] text-center text-muted-foreground/50 italic">
            {t("managedByNyas")}
          </p>
        </div>

        {books.some(b => bookVideoConfig[b.slug]) && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-primary/30"></div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid="heading-explanatory-videos">
                {t("watchIntroduction")}
              </h2>
              <div className="h-px w-8 bg-primary/30"></div>
            </div>
            {books.filter(b => bookVideoConfig[b.slug]).map(b => (
              <VideoInline
                key={b.slug}
                videoId={bookVideoConfig[b.slug].videoId}
                title={bookVideoConfig[b.slug].videoTitle}
                className="max-w-xl mx-auto rounded-xl overflow-hidden border border-primary/20"
              />
            ))}
          </div>
        )}

        <div className="text-center pb-4">
          <div className="text-primary/25 text-xs tracking-widest font-serif">
            ॥ सर्वं खल्विदं ब्रह्म ॥
          </div>
        </div>
      </div>
    </div>
  );
}

function matchesCategory(matcher: string | undefined, altMatcher: string | undefined, bookCategory: string): boolean {
  if (matcher && bookCategory === matcher) return true;
  if (altMatcher && bookCategory === altMatcher) return true;
  return false;
}

function getTranslatedLabel(item: { label: string; labelKey?: string }, t: (key: any) => string): string {
  if (item.labelKey) {
    const translated = t(item.labelKey);
    if (translated !== item.labelKey) return translated;
  }
  return item.label;
}

function getTranslatedSubtitle(item: { subtitle?: string; subtitleKey?: string }, t: (key: any) => string): string {
  if (item.subtitleKey) {
    const translated = t(item.subtitleKey);
    if (translated !== item.subtitleKey) return translated;
  }
  return item.subtitle || "";
}

function getTranslatedDescription(item: { description?: string; descriptionKey?: string }, t: (key: any) => string): string {
  if (item.descriptionKey) {
    const translated = t(item.descriptionKey);
    if (translated !== item.descriptionKey) return translated;
  }
  return item.description || "";
}

interface LibraryCatalogProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectCategory?: (categoryId: string) => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onGoBack: () => void;
  languageCode?: string | null;
}

export function LibraryCatalogView({ books, onSelectBook, onSelectCategory, onSelectSubCategory, onGoBack, languageCode }: LibraryCatalogProps) {
  const { t } = useTranslation(languageCode ?? null);
  const welcomeLang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, welcomeLang);

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.015] dark:text-primary/[0.02] font-serif rotate-12">ॐ</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1.5 text-xs text-muted-foreground"
            data-testid="button-library-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("backToHomeWelcome")}
          </Button>
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6 text-primary shrink-0" />
            <h1 className="font-serif text-lg sm:text-2xl font-semibold text-primary" data-testid="heading-browse-library">
              {t("browseTheLibrary")}
            </h1>
            <div className="h-px flex-1 bg-border"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5" data-testid="catalog-tree">
          {CATALOG_TREE.map(cat => {
            const catBooks = getBooksForCategory(books, cat);
            const IconComponent = categoryIcons[cat.id] || Library;

            return (
              <Card
                key={cat.id}
                className="p-0 overflow-hidden border-primary/20 bg-card/90 backdrop-blur-sm flex flex-col hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all rounded-xl"
                data-testid={`card-category-${cat.id}`}
              >
                <div
                  className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 cursor-pointer"
                  onClick={() => onSelectCategory?.(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground leading-tight">
                    {getTranslatedLabel(cat, t)}
                  </h3>

                  {cat.subtitle && (
                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary/70 font-medium mt-1.5">
                      {getTranslatedSubtitle(cat, t)}
                    </p>
                  )}

                  {cat.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-3">
                      {getTranslatedDescription(cat, t)}
                    </p>
                  )}

                  {catBooks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] mt-3">
                      {catBooks.length} {catBooks.length === 1 ? t("textSingular") : t("textPlural")}
                    </Badge>
                  )}
                </div>

                <div className="border-t border-primary/10 flex-1 px-4 sm:px-5 py-3 sm:py-4 space-y-1">
                  {cat.children ? (
                    cat.children.map(sub => {
                      const subBooks = getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch);
                      const hasSubBooks = subBooks.length > 0;
                      return (
                        <button
                          key={sub.id}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${hasSubBooks ? "hover:bg-primary/10 text-primary font-medium" : "text-muted-foreground/50 cursor-default"}`}
                          onClick={() => {
                            if (hasSubBooks) {
                              if (onSelectSubCategory) {
                                onSelectSubCategory(cat.id, sub.id);
                              } else {
                                onSelectCategory?.(cat.id);
                              }
                            }
                          }}
                          data-testid={`button-subcat-${sub.id}`}
                        >
                          {hasSubBooks ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                          )}
                          <span className="truncate">{getTranslatedLabel(sub, t)}</span>
                          {!hasSubBooks && (
                            <span className="text-[10px] text-muted-foreground/30 ml-auto italic shrink-0">{t("soon")}</span>
                          )}
                        </button>
                      );
                    })
                  ) : catBooks.length > 0 ? (
                    catBooks.map(book => (
                      <button
                        key={book.id}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-primary/10 transition-colors group"
                        onClick={() => onSelectBook(book.id)}
                        data-testid={`button-book-${book.slug}`}
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                        <span className="text-sm font-serif text-foreground group-hover:text-primary transition-colors truncate">
                          {tc(book.title, bookTitleTranslations)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-3 text-center">
                      <span className="text-xs text-muted-foreground/40 italic">{t("comingSoon")}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center pb-4">
          <div className="text-primary/25 text-xs tracking-widest font-serif">
            ॥ सर्वं खल्विदं ब्रह्म ॥
          </div>
        </div>
      </div>
    </div>
  );
}

interface CategoryDetailViewProps {
  categoryId: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onGoBack: () => void;
  languageCode?: string | null;
}

export function CategoryDetailView({ categoryId, books, onSelectBook, onSelectSubCategory, onGoBack, languageCode }: CategoryDetailViewProps) {
  const category = CATALOG_TREE.find(c => c.id === categoryId);
  if (!category) return null;
  const { t } = useTranslation(languageCode ?? null);
  const catLang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, catLang);

  const booksBySubCategory: Record<string, Book[]> = {};
  const allCatBooks: Book[] = [];
  for (const book of books) {
    if (category.children) {
      for (const sub of category.children) {
        if (matchesCategory(sub.categoryMatch, sub.categoryAltMatch, book.category)) {
          if (!booksBySubCategory[sub.id]) booksBySubCategory[sub.id] = [];
          booksBySubCategory[sub.id].push(book);
          allCatBooks.push(book);
        }
      }
    }
    if (category.categoryMatch && book.category === category.categoryMatch) {
      if (!booksBySubCategory[category.id]) booksBySubCategory[category.id] = [];
      booksBySubCategory[category.id].push(book);
      allCatBooks.push(book);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="category-detail-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-5 border-border/60 bg-card sticky top-4" data-testid="category-overview-panel">
              <h2 className="font-serif text-lg font-semibold text-foreground" data-testid="text-category-title">
                {getTranslatedLabel(category, t)}
              </h2>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-3" data-testid="label-category-overview">
                {t("categoryOverview")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {getTranslatedDescription(category, t)}
              </p>

              <div className="h-px bg-border my-4"></div>

              <p className="text-xs font-semibold text-foreground uppercase tracking-wider" data-testid="label-texts-chapters">
                {t("textsAndChapters")}
              </p>
              <div className="mt-3 space-y-1" data-testid="scripture-tree">
                {category.children ? (
                  category.children.map(sub => {
                    const subBooks = booksBySubCategory[sub.id] ?? [];
                    const hasBooks = subBooks.length > 0;
                    return (
                      <button
                        key={sub.id}
                        className={`flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm transition-colors ${
                          hasBooks ? "hover:bg-accent cursor-pointer" : "opacity-40 cursor-default"
                        }`}
                        onClick={() => {
                          if (hasBooks && onSelectSubCategory) {
                            onSelectSubCategory(categoryId, sub.id);
                          }
                        }}
                        data-testid={`tree-subcat-${sub.id}`}
                      >
                        <div>
                          <span className="font-medium text-foreground">{getTranslatedLabel(sub, t)}</span>
                          {hasBooks && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <BookOpen className="h-3 w-3" />
                              <span>{subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}</span>
                            </div>
                          )}
                        </div>
                        {hasBooks && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  booksBySubCategory[category.id]?.map(book => (
                    <button
                      key={book.id}
                      className="flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => onSelectBook(book.id)}
                      data-testid={`tree-book-${book.slug}`}
                    >
                      <div>
                        <span className="font-medium text-foreground">{tc(book.title, bookTitleTranslations)}</span>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span>{book.totalVerses ?? 0} {t("verses")}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            {category.children ? (
              <div className="space-y-6" data-testid="subcategory-grid">
                {category.children.map(sub => {
                  const subBooks = booksBySubCategory[sub.id] ?? [];
                  if (subBooks.length === 0) return null;
                  return (
                    <div key={sub.id}>
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/40">
                        <div className="w-1 h-5 rounded-full bg-primary/60"></div>
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-testid={`subcat-heading-${sub.id}`}>
                          {getTranslatedLabel(sub, t)}
                        </h3>
                        <span className="text-[10px] text-muted-foreground ml-auto">{subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {subBooks.map(book => (
                          <Card
                            key={book.id}
                            className="group relative border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden border-l-[3px] border-l-primary/50 hover:border-l-primary"
                            onClick={() => onSelectBook(book.id)}
                            data-testid={`card-book-${book.slug || book.id}`}
                          >
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-serif text-base font-semibold text-foreground leading-snug">
                                    {tc(book.title, bookTitleTranslations)}
                                  </h3>
                                  {book.author && (
                                    <p className="text-xs text-primary/80 mt-1 font-medium">
                                      {tc(book.author, bookAuthorTranslations)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
                                  <BookOpen className="h-3 w-3" />
                                  <span>{t("openText")}</span>
                                </div>
                              </div>
                              {book.description && (
                                <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                                  {tc(book.description, bookDescriptionTranslations)}
                                </p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {booksBySubCategory[category.id]?.map(book => (
                  <Card
                    key={book.id}
                    className="group relative border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden border-l-[3px] border-l-primary/50 hover:border-l-primary"
                    onClick={() => onSelectBook(book.id)}
                    data-testid={`card-book-${book.slug || book.id}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-serif text-base font-semibold text-foreground leading-snug">
                            {tc(book.title, bookTitleTranslations)}
                          </h3>
                          {book.author && (
                            <p className="text-xs text-primary/80 mt-1 font-medium">
                              {tc(book.author, bookAuthorTranslations)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
                          <BookOpen className="h-3 w-3" />
                          <span>{t("openText")}</span>
                        </div>
                      </div>
                      {book.description && (
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                          {tc(book.description, bookDescriptionTranslations)}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

interface BookLandingData {
  iastTitle: string;
  devanagariTitle: string;
  authorIast: string;
  verseCount: string;
  verseLabel: string;
  quote: string;
  introTitle: string;
  introText: string;
  structureTitle: string;
  structureItems: { title: string; description: string }[];
  extraSection?: { title: string; text: string };
  ctaLabel: string;
  sidebarLabel: string;
  sidebarDescription: string;
  sidebarTreeLabel: string;
}

const BOOK_LANDING_DATA: Record<string, BookLandingData> = {
  "pt-gita": {
    iastTitle: "Śrīmad Bhagavad Gītā",
    devanagariTitle: "श्रीमद्भगवद्गीता",
    authorIast: "Veda Vyāsa",
    verseCount: "701",
    verseLabel: "Verses",
    quote: '"The Bhagavad Gita is the essence of the Upanishads. It is a universal scripture applicable to people of all temperaments and for all times."',
    introTitle: "Introduction",
    introText: 'The "Song of the Lord" is a 700-verse dialogue set on the battlefield of Kurukshetra. It represents the spiritual struggle of the human soul, where Arjuna faces a crisis of conscience and Krishna provides the wisdom to transcend duality.',
    structureTitle: "Structural Hexads",
    structureItems: [
      { title: "Karma Shatka (1–6)", description: "Nature of the individual soul (Tvam) and the path of action." },
      { title: "Bhakti Shatka (7–12)", description: "Nature of the Supreme Lord (Tat) and the path of devotion." },
      { title: "Jñāna Shatka (13–18)", description: "Unity of Jīva and Brahman (Asi) and the path of knowledge." },
    ],
    ctaLabel: "Open Text",
    sidebarLabel: "Bhagavad Gita",
    sidebarDescription: "The Smriti Prasthana: The dialogue between Krishna and Arjuna, synthesizing the wisdom of the Upanishads.",
    sidebarTreeLabel: "Texts & Chapters",
  },
  "pt-brahmasutra": {
    iastTitle: "Brahmasūtra",
    devanagariTitle: "ब्रह्मसूत्र",
    authorIast: "Sage Bādarāyaṇa",
    verseCount: "555",
    verseLabel: "Sūtras",
    quote: '"Atha-ato brahma-jijñāsā — Now, therefore, the inquiry into Brahman."',
    introTitle: "Introduction",
    introText: 'The Brahma Sutras, also known as the Vedanta Sutras, are one of the most important texts of Hindu philosophy. They reconcile the seemingly contradictory statements found in the various Upanishads by presenting a logical, unified framework of Vedantic thought.',
    structureTitle: "The Four Adhyāyas",
    structureItems: [
      { title: "Samanvaya (Harmony)", description: "Systematically correlates all Upanishadic passages to point to Brahman." },
      { title: "Avirodha (Non-Conflict)", description: "Refutes the objections and alternative theories of other schools." },
      { title: "Sādhana (The Means)", description: "Discusses the process of spiritual practice and the acquisition of knowledge." },
      { title: "Phala (The Fruit)", description: "Describes the result of Self-knowledge — liberation (Moksha)." },
    ],
    extraSection: {
      title: "Adi Shankara's Role",
      text: "Adi Shankaracharya's commentary (Bhashya) on the Brahma Sutras is the cornerstone of Advaita Vedanta. His interpretation demonstrates that the Sutras teach the absolute identity of Atman and Brahman, and that liberation is attained through knowledge (Jñāna) alone.",
    },
    ctaLabel: "Open Bhashya",
    sidebarLabel: "Brahma Sutra",
    sidebarDescription: "The Nyāya Prasthāna: Logical systematization of Vedantic thought authored by Sage Badarayana.",
    sidebarTreeLabel: "Adhyāyas & Pādas",
  },
};

interface ChapterInfo {
  number: number;
  title: string;
  verseCount: number;
  khandas?: { number: number; title: string; count: number }[];
}

function useBookChapters(bookId: string | undefined) {
  const { data } = useQuery<any>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

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
      });
    }
    const ch = chapterMap.get(adhyay)!;
    ch.verseCount++;

    if (v.khandaNumber != null) {
      if (!ch.khandas) ch.khandas = [];
      const existingKhanda = ch.khandas.find(k => k.number === v.khandaNumber);
      if (existingKhanda) {
        existingKhanda.count++;
      } else {
        ch.khandas.push({
          number: v.khandaNumber,
          title: v.khandaTitle || `Part ${v.khandaNumber}`,
          count: 1,
        });
      }
    }
  }

  return Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
}

function BookLandingPage({ book, landingData, chapters, onSelectBook, t, tc }: {
  book: Book;
  landingData: BookLandingData;
  chapters: ChapterInfo[];
  onSelectBook: (bookId: string) => void;
  t: (key: any) => string;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="book-landing-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-5 border-border/60 bg-card sticky top-4" data-testid="book-landing-sidebar">
              <h2 className="font-serif text-lg font-semibold text-foreground" data-testid="text-landing-title">
                {landingData.sidebarLabel}
              </h2>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-3">
                {t("categoryOverview")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {landingData.sidebarDescription}
              </p>

              <div className="h-px bg-border my-4"></div>

              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {landingData.sidebarTreeLabel}
              </p>
              <div className="mt-3 space-y-0.5 max-h-[60vh] overflow-y-auto" data-testid="landing-chapter-tree">
                <button
                  className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors bg-primary/5 border border-primary/20"
                  onClick={() => onSelectBook(book.id)}
                  data-testid="tree-book-main"
                >
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-primary">{tc(book.title, bookTitleTranslations)}</span>
                </button>
                {chapters.map((ch, idx) => (
                  <div key={ch.number} className="pl-2">
                    {ch.khandas && ch.khandas.length > 0 ? (
                      <>
                        <div className="px-2 pt-3 pb-1">
                          <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider">
                            {ch.title}
                          </span>
                        </div>
                        {ch.khandas.map((kh, ki) => (
                          <button
                            key={kh.number}
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => onSelectBook(book.id)}
                            data-testid={`tree-chapter-${ch.number}-khanda-${kh.number}`}
                          >
                            <span className="text-xs text-muted-foreground/60 w-5 text-right shrink-0">
                              {String(idx + ki + 1).padStart(2, '0')}
                            </span>
                            <span className="text-foreground/80 truncate">{kh.title}</span>
                          </button>
                        ))}
                      </>
                    ) : (
                      <button
                        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => onSelectBook(book.id)}
                        data-testid={`tree-chapter-${ch.number}`}
                      >
                        <span className="text-xs text-muted-foreground/60 w-5 text-right shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-foreground/80 truncate">
                          {ch.title.includes(' - ') ? ch.title.split(' - ').pop()?.trim() : ch.title}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0" data-testid="book-landing-content">
            <div className="border-l-[3px] border-l-primary/60 pl-6 sm:pl-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight tracking-tight">
                    {landingData.iastTitle}
                  </h1>
                  <p className="font-serif text-lg sm:text-xl text-foreground/70 mt-1">
                    {landingData.devanagariTitle}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 gap-2 border-primary/30 text-primary hover:bg-primary/5 font-semibold uppercase text-xs tracking-wider"
                  onClick={() => onSelectBook(book.id)}
                  data-testid="button-open-text-landing"
                >
                  <BookOpen className="h-4 w-4" />
                  {landingData.ctaLabel}
                </Button>
              </div>

              <p className="text-xs font-semibold text-primary/80 uppercase tracking-[0.15em] mt-3">
                {landingData.authorIast} | {landingData.verseCount} {landingData.verseLabel}
              </p>

              <blockquote className="border-l-2 border-primary/30 pl-4 mt-6 text-base sm:text-lg text-foreground/80 font-serif italic leading-relaxed">
                {landingData.quote}
              </blockquote>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div>
                  <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                    {landingData.introTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {landingData.introText}
                  </p>
                </div>

                <div>
                  <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                    {landingData.structureTitle}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {landingData.structureItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="border-l-[3px] border-l-primary/50 bg-primary/[0.03] dark:bg-primary/[0.06] rounded-r-lg p-3"
                        data-testid={`structure-item-${idx}`}
                      >
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">
                          {item.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {landingData.extraSection && (
                <div className="mt-8">
                  <h3 className="font-serif text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                    {landingData.extraSection.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {landingData.extraSection.text}
                  </p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-border/40">
                <div className="text-center">
                  <div className="text-primary/25 text-xs tracking-widest font-serif">
                    ॥ सर्वं खल्विदं ब्रह्म ॥
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function GenericBookLanding({ book, onSelectBook, t, tc }: {
  book: Book;
  onSelectBook: (bookId: string) => void;
  t: (key: any) => string;
  tc: (text: string | null | undefined, map: Record<string, Record<string, string>>) => string;
}) {
  return (
    <div className="flex-1 min-w-0" data-testid={`book-landing-${book.slug}`}>
      <Card
        className="group border-border/60 bg-card border-l-[3px] border-l-primary/50 hover:border-l-primary hover:shadow-lg transition-all cursor-pointer overflow-hidden"
        onClick={() => onSelectBook(book.id)}
        data-testid={`card-book-${book.slug || book.id}`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground leading-snug">
                {tc(book.title, bookTitleTranslations)}
              </h3>
              {book.author && (
                <p className="text-xs text-primary/80 mt-1 font-medium uppercase tracking-wider">
                  {tc(book.author, bookAuthorTranslations)}
                  {book.totalVerses ? ` | ${book.totalVerses} ${t("verses")}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-primary font-semibold uppercase tracking-wider shrink-0 opacity-70 group-hover:opacity-100 transition-opacity pt-0.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{t("openText")}</span>
            </div>
          </div>
          {book.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {tc(book.description, bookDescriptionTranslations)}
            </p>
          )}
          {book.bhashyamName && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {book.bhashyamName}
              </Badge>
              {book.teekasList?.map((teeka, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {teeka.name} — {teeka.author}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface SubCategoryDetailViewProps {
  categoryId: string;
  subCategoryId: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onGoBack: () => void;
  languageCode?: string | null;
}

export function SubCategoryDetailView({ categoryId, subCategoryId, books, onSelectBook, onGoBack, languageCode }: SubCategoryDetailViewProps) {
  const category = CATALOG_TREE.find(c => c.id === categoryId);
  const subCategory = category?.children?.find(s => s.id === subCategoryId);
  if (!category || !subCategory) return null;

  const { t } = useTranslation(languageCode ?? null);
  const lang = languageCode || "en";
  const tc = (text: string | null | undefined, map: Record<string, Record<string, string>>) => translateContent(text, map, lang);

  const subBooks = books.filter(b => matchesCategory(subCategory.categoryMatch, subCategory.categoryAltMatch, b.category));

  const landingData = BOOK_LANDING_DATA[subCategoryId];
  const primaryBook = subBooks.length > 0 ? subBooks[0] : null;
  const chapters = useBookChapters(landingData && primaryBook ? primaryBook.id : undefined);

  if (landingData && primaryBook) {
    return (
      <BookLandingPage
        book={primaryBook}
        landingData={landingData}
        chapters={chapters}
        onSelectBook={onSelectBook}
        t={t}
        tc={tc}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8" data-testid="subcategory-detail-view">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          <div className="lg:w-72 shrink-0">
            <Card className="p-5 border-border/60 bg-card sticky top-4" data-testid="subcat-overview-panel">
              <h2 className="font-serif text-lg font-semibold text-foreground" data-testid="text-subcat-title">
                {getTranslatedLabel(subCategory, t)}
              </h2>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider mt-3" data-testid="label-subcat-overview">
                {t("categoryOverview")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {getTranslatedDescription(category, t)}
              </p>

              <div className="h-px bg-border my-4"></div>

              <p className="text-xs font-semibold text-foreground uppercase tracking-wider" data-testid="label-subcat-texts">
                {t("textsAndChapters")}
              </p>
              <div className="mt-3 space-y-1" data-testid="subcat-scripture-tree">
                {subBooks.map(book => (
                  <button
                    key={book.id}
                    className="flex items-center justify-between w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSelectBook(book.id)}
                    data-testid={`tree-book-${book.slug || book.id}`}
                  >
                    <div>
                      <span className="font-medium text-foreground">{tc(book.title, bookTitleTranslations)}</span>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        <span>{book.totalVerses ?? 0} {t("verses")}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex-1 min-w-0">
            {subBooks.length > 0 ? (
              <div className="space-y-4" data-testid="subcat-books-grid">
                {subBooks.map(book => (
                  <GenericBookLanding
                    key={book.id}
                    book={book}
                    onSelectBook={onSelectBook}
                    t={t}
                    tc={tc}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground/60 italic">{t("comingSoon")}...</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
