import { BookOpen, Library, FolderOpen, Lock, ArrowLeft, ChevronRight, ScrollText, Feather, Heart, BookMarked } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import { CATALOG_TREE, type CatalogCategory } from "@/components/app-sidebar";
import { useTranslation } from "@/lib/translations";
import { translateContent, bookTitleTranslations, bookAuthorTranslations, bookCategoryTranslations, bookDescriptionTranslations } from "@/lib/content-translations";

import catImgUpanishad from "@assets/image_1770803826016.png";
import catImgGita from "@assets/image_1770803844485.png";
import catImgBrahmaSutra from "@assets/image_1770803849999.png";

const categoryImages: Record<string, string> = {
  "upanishad": catImgUpanishad,
  "bhagavad-gita": catImgGita,
  "brahma-sutra": catImgBrahmaSutra,
};

const categoryIcons: Record<string, typeof ScrollText> = {
  "upanishad": ScrollText,
  "bhagavad-gita": BookOpen,
  "brahma-sutra": BookMarked,
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
  if (cat.children) {
    const matched: Book[] = [];
    for (const sub of cat.children) {
      matched.push(...getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch));
    }
    if (cat.categoryMatch || (cat as any).categoryAltMatch) {
      matched.push(...books.filter(b => matchesCategory(cat.categoryMatch, (cat as any).categoryAltMatch, b.category) && !matched.some(m => m.id === b.id)));
    }
    return matched;
  }
  return books.filter(b => matchesCategory(cat.categoryMatch, (cat as any).categoryAltMatch, b.category));
}

export function WelcomeScreen({ books, onSelectBook, onBrowseLibrary, languageCode }: WelcomeScreenProps) {
  const { t } = useTranslation(languageCode ?? null);
  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/10 relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.02] font-serif rotate-12">ॐ</div>
        <div className="absolute top-1/2 right-1/3 text-[7rem] text-primary/[0.015] font-serif -rotate-6">श्री</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-xl"></div>
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
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/10 relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.02] font-serif rotate-12">ॐ</div>
        <div className="absolute top-1/2 right-1/3 text-[7rem] text-primary/[0.015] font-serif -rotate-6">श्री</div>
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
            <div className="h-px flex-1 bg-primary/15"></div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" data-testid="catalog-tree">
          {CATALOG_TREE.map(cat => {
            const catBooks = getBooksForCategory(books, cat);
            const catImage = categoryImages[cat.id];
            const IconComponent = categoryIcons[cat.id] || Library;

            return (
              <Card
                key={cat.id}
                className="p-0 overflow-visible border-border/50 bg-card/80 flex flex-col hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 hover:scale-[1.02] transition-all"
                data-testid={`card-category-${cat.id}`}
              >
                <div
                  className="flex flex-col items-center justify-center py-4 sm:py-5 px-3 border-b border-border/30 bg-gradient-to-b from-primary/[0.06] to-transparent rounded-t-md cursor-pointer hover-elevate active-elevate-2 transition-all"
                  onClick={() => onSelectCategory?.(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  {catImage ? (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-3 border-2 border-primary/20 shadow-sm">
                      <img src={catImage} alt={getTranslatedLabel(cat, t)} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="p-3 rounded-full bg-primary/10 mb-3">
                      <IconComponent className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                    </div>
                  )}
                  <h3 className="font-serif text-xs sm:text-sm font-semibold text-foreground text-center leading-tight px-1">
                    {getTranslatedLabel(cat, t)}
                  </h3>
                  {catBooks.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] mt-2">
                      {catBooks.length} {catBooks.length === 1 ? t("textSingular") : t("textPlural")}
                    </Badge>
                  )}
                </div>

                <div className="flex-1 px-2.5 py-2.5 space-y-0.5">
                  {cat.children ? (
                    cat.children.map(sub => {
                      const subBooks = getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch);
                      const hasSubBooks = subBooks.length > 0;
                      return (
                        <button
                          key={sub.id}
                          className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${hasSubBooks ? "hover-elevate active-elevate-2 text-primary font-medium" : "text-muted-foreground/50 cursor-default"}`}
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
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          ) : (
                            <Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30" />
                          )}
                          <span className="truncate">{getTranslatedLabel(sub, t)}</span>
                          {!hasSubBooks && (
                            <span className="text-[9px] text-muted-foreground/30 ml-auto italic shrink-0">{t("soon")}</span>
                          )}
                        </button>
                      );
                    })
                  ) : catBooks.length > 0 ? (
                    catBooks.map(book => (
                      <button
                        key={book.id}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover-elevate active-elevate-2 transition-colors group"
                        onClick={() => onSelectBook(book.id)}
                        data-testid={`button-book-${book.slug}`}
                      >
                        <BookOpen className="h-3 w-3 shrink-0 text-primary/50" />
                        <span className="text-xs font-serif text-foreground group-hover:text-primary transition-colors truncate">
                          {tc(book.title, bookTitleTranslations)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-2 text-center">
                      <span className="text-[10px] text-muted-foreground/40 italic">{t("comingSoon")}</span>
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
  for (const book of books) {
    if (category.children) {
      for (const sub of category.children) {
        if (matchesCategory(sub.categoryMatch, sub.categoryAltMatch, book.category)) {
          if (!booksBySubCategory[sub.id]) booksBySubCategory[sub.id] = [];
          booksBySubCategory[sub.id].push(book);
        }
      }
    }
    if (matchesCategory(category.categoryMatch, (category as any).categoryAltMatch, book.category)) {
      if (!booksBySubCategory[category.id]) booksBySubCategory[category.id] = [];
      booksBySubCategory[category.id].push(book);
    }
  }

  const subCategoryIcons: Record<string, typeof ScrollText> = {
    "upanishad": ScrollText,
    "bhagavad-gita": BookOpen,
    "brahma-sutra": BookMarked,
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/10 relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.02] font-serif rotate-12">ॐ</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1.5 text-xs text-muted-foreground"
            data-testid="button-category-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {(t as any)("backToHome") || "Back to Library"}
          </Button>
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6 text-primary shrink-0" />
            <h1 className="font-serif text-lg sm:text-2xl font-semibold text-primary" data-testid="text-category-title">
              {getTranslatedLabel(category, t)}
            </h1>
          </div>
          <div className="h-px bg-primary/15"></div>
        </div>

        {category.children ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="subcategory-grid">
            {category.children.map(sub => {
              const subBooks = booksBySubCategory[sub.id] ?? [];
              const hasBooks = subBooks.length > 0;
              const IconComp = subCategoryIcons[sub.id] || FolderOpen;

              return (
                <Card
                  key={sub.id}
                  className={`p-0 overflow-hidden border-border/50 flex flex-col transition-all ${
                    hasBooks ? "bg-card/80 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 hover:scale-[1.02]" : "bg-muted/30 opacity-60"
                  }`}
                  data-testid={`card-subcat-${sub.id}`}
                  onClick={() => {
                    if (hasBooks && onSelectSubCategory) {
                      onSelectSubCategory(categoryId, sub.id);
                    }
                  }}
                >
                  <div className={`flex flex-col items-center justify-center py-5 px-4 border-b border-border/30 ${
                    hasBooks ? "bg-gradient-to-b from-primary/[0.08] to-transparent" : "bg-muted/20"
                  }`}>
                    <div className={`p-3 rounded-full mb-3 ${hasBooks ? "bg-primary/10" : "bg-muted/30"}`}>
                      {hasBooks ? (
                        <IconComp className="h-7 w-7 text-primary" />
                      ) : (
                        <Lock className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <h3 className={`font-serif text-sm font-semibold text-center leading-tight ${
                      hasBooks ? "text-foreground" : "text-muted-foreground/50"
                    }`}>
                      {getTranslatedLabel(sub, t)}
                    </h3>
                    {hasBooks && (
                      <Badge variant="secondary" className="text-[9px] mt-2">
                        {subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}
                      </Badge>
                    )}
                    {!hasBooks && (
                      <span className="text-[10px] text-muted-foreground/40 italic mt-2">{t("comingSoon")}</span>
                    )}
                  </div>

                  {hasBooks && (
                    <div className="px-3 py-2.5 space-y-0.5">
                      {subBooks.map(book => (
                        <div
                          key={book.id}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs"
                        >
                          <BookOpen className="h-3 w-3 shrink-0 text-primary/50" />
                          <span className="font-serif text-[11px] text-foreground/80 truncate">{tc(book.title, bookTitleTranslations)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div>
            {booksBySubCategory[category.id]?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {booksBySubCategory[category.id].map(book => (
                  <Card
                    key={book.id}
                    className="p-0 overflow-hidden border-border/50 bg-card/80 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 hover:scale-[1.02] transition-all"
                    onClick={() => onSelectBook(book.id)}
                    data-testid={`card-book-${book.slug}`}
                  >
                    <div className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-b from-primary/[0.08] to-transparent">
                      <div className="p-3 rounded-full bg-primary/10 mb-3">
                        <BookOpen className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-serif text-sm font-semibold text-foreground text-center leading-tight">
                        {tc(book.title, bookTitleTranslations)}
                      </h3>
                      {book.author && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {tc(book.author, bookAuthorTranslations)}
                        </p>
                      )}
                      <Badge variant="secondary" className="text-[9px] mt-2">
                        {book.totalVerses ?? 0} {t("verses")}
                      </Badge>
                    </div>
                    {(book.bhashyamName || (book.teekasList && book.teekasList.length > 0)) && (
                      <div className="px-4 py-3 border-t border-border/30 space-y-1.5" data-testid={`book-commentary-info-${book.slug || book.id}`}>
                        {book.bhashyamName && (
                          <div className="flex items-start gap-1.5">
                            <Feather className="h-3 w-3 shrink-0 text-primary/50 mt-0.5" />
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {book.bhashyamName}
                            </span>
                          </div>
                        )}
                        {book.teekasList && book.teekasList.length > 0 && (
                          <div className="flex items-start gap-1.5">
                            <ScrollText className="h-3 w-3 shrink-0 text-primary/50 mt-0.5" />
                            <div className="flex flex-wrap gap-1">
                              {book.teekasList.map((teeka, i) => (
                                <span key={i} className="text-[10px] text-muted-foreground leading-tight">
                                  {teeka.name}{teeka.author ? ` — ${teeka.author}` : ""}{i < book.teekasList!.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground/60 italic">{t("comingSoon")}...</p>
              </div>
            )}
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

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/10 relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.02] font-serif rotate-12">ॐ</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="gap-1.5 text-xs text-muted-foreground"
            data-testid="button-subcat-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {getTranslatedLabel(category, t)}
          </Button>
          <div className="flex items-center gap-3">
            <ScrollText className="h-6 w-6 text-primary shrink-0" />
            <h1 className="font-serif text-lg sm:text-2xl font-semibold text-primary" data-testid="text-subcat-title">
              {getTranslatedLabel(subCategory, t)}
            </h1>
            <Badge variant="secondary" className="text-xs">
              {subBooks.length} {subBooks.length === 1 ? t("textSingular") : t("textPlural")}
            </Badge>
          </div>
          <div className="h-px bg-primary/15"></div>
        </div>

        {subBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="subcat-books-grid">
            {subBooks.map(book => (
              <Card
                key={book.id}
                className="p-0 overflow-hidden border-border/50 bg-card/80 cursor-pointer hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 hover:scale-[1.02] transition-all group"
                onClick={() => onSelectBook(book.id)}
                data-testid={`card-book-${book.slug || book.id}`}
              >
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 bg-gradient-to-b from-primary/[0.08] to-transparent">
                  <div className="p-4 rounded-full bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-serif text-sm sm:text-base font-semibold text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                    {tc(book.title, bookTitleTranslations)}
                  </h3>
                  {book.author && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 text-center">
                      {tc(book.author, bookAuthorTranslations)}
                    </p>
                  )}
                  <Badge variant="secondary" className="text-[9px] mt-3">
                    {book.totalVerses ?? 0} {t("verses")}
                  </Badge>
                </div>
                {(book.bhashyamName || (book.teekasList && book.teekasList.length > 0)) && (
                  <div className="px-4 py-3 border-t border-border/30 space-y-1.5" data-testid={`book-commentary-info-${book.slug || book.id}`}>
                    {book.bhashyamName && (
                      <div className="flex items-start gap-1.5">
                        <Feather className="h-3 w-3 shrink-0 text-primary/50 mt-0.5" />
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {book.bhashyamName}
                        </span>
                      </div>
                    )}
                    {book.teekasList && book.teekasList.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <ScrollText className="h-3 w-3 shrink-0 text-primary/50 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {book.teekasList.map((teeka, i) => (
                            <span key={i} className="text-[10px] text-muted-foreground leading-tight">
                              {teeka.name}{teeka.author ? ` — ${teeka.author}` : ""}{i < book.teekasList!.length - 1 ? "," : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground/60 italic">{t("comingSoon")}...</p>
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
