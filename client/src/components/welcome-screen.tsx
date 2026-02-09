import { useState } from "react";
import { BookOpen, Clock, Library, FolderOpen, Lock, ArrowLeft, ChevronRight, ScrollText, Feather, Users, Heart, BookMarked, Music } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import { CATALOG_TREE, type CatalogCategory } from "@/components/app-sidebar";
import brahmaImg from "@/assets/images/book-brahma-sutra.jpg";
import vivekImg from "@/assets/images/book-vivekachudamani.jpg";
import upadesaImg from "@/assets/images/book-upadesa-sahasri.jpg";

const categoryIcons: Record<string, typeof ScrollText> = {
  "prasthana-shankaracharya": ScrollText,
  "other-shankara-works": Feather,
  "prasthana-other-acharyas": Users,
  "bhakthi-stotras": Heart,
  "prakarana-granthas": BookMarked,
  "shlokas-stotras": Music,
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
}

interface WelcomeScreenProps {
  books: Book[];
  onSelectBook: (bookId: string) => void;
}

const bookVideoConfig: Record<string, { videoId: string; videoTitle: string }> = {
  "isha-upanishad-bhashya": {
    videoId: "8ELHatzdtAk",
    videoTitle: "Introduction to Isha Upanishad",
  },
};

const comingSoonBooks = [
  {
    title: "ब्रह्मसूत्र भाष्य",
    titleEn: "Brahma Sutra Bhashya",
    category: "Vedanta",
    description: "Shankaracharya's commentary on Badarayana's aphorisms establishing the nature of Brahman",
    image: brahmaImg,
  },
  {
    title: "विवेकचूडामणि",
    titleEn: "Vivekachudamani",
    category: "Prakarana Grantha",
    description: "The Crest-Jewel of Discrimination — guiding the seeker from ignorance to Self-realization",
    image: vivekImg,
  },
  {
    title: "उपदेशसाहस्री",
    titleEn: "Upadesa Sahasri",
    category: "Prakarana Grantha",
    description: "A Thousand Teachings — Shankaracharya's prose and verse work on realizing Brahman",
    image: upadesaImg,
  },
];

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

export function WelcomeScreen({ books, onSelectBook }: WelcomeScreenProps) {
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());

  const toggleSubCategory = (id: string) => {
    setExpandedSubCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/10 relative overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-16 left-12 text-[14rem] text-primary/[0.02] font-serif">ॐ</div>
        <div className="absolute bottom-24 right-16 text-[10rem] text-primary/[0.02] font-serif rotate-12">ॐ</div>
        <div className="absolute top-1/2 right-1/3 text-[7rem] text-primary/[0.015] font-serif -rotate-6">श्री</div>
      </div>

      <div className="max-w-4xl w-full relative z-10 py-4 sm:py-8 space-y-8 sm:space-y-12">
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-xl"></div>
            <img
              src="https://oneness.org.in/assets/img/favicon.png"
              alt="Advaita Sharada"
              className="h-16 sm:h-20 w-16 sm:w-20 object-contain mx-auto relative"
            />
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
            <h1 className="font-serif text-xl sm:text-3xl font-semibold tracking-tight text-primary">
              Advaita Sharada
            </h1>
            <span className="text-xl sm:text-2xl text-primary/50 font-serif">ॐ</span>
          </div>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Encyclopaedia of Advaita Vedanta
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <Library className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground" data-testid="heading-browse-library">
              Browse the Library
            </h2>
            <div className="h-px flex-1 bg-primary/15"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" data-testid="catalog-tree">
            {CATALOG_TREE.map(cat => {
              const catBooks = getBooksForCategory(books, cat);
              const hasContent = catBooks.length > 0;
              const IconComponent = categoryIcons[cat.id] || Library;

              return (
                <Card
                  key={cat.id}
                  className="p-0 overflow-visible border-border/50 bg-card/80 flex flex-col"
                  data-testid={`card-category-${cat.id}`}
                >
                  <div className="flex flex-col items-center justify-center py-5 sm:py-6 px-3 border-b border-border/30 bg-gradient-to-b from-primary/[0.06] to-transparent rounded-t-md">
                    <div className="p-3 rounded-full bg-primary/10 mb-3">
                      <IconComponent className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                    </div>
                    <h3 className="font-serif text-xs sm:text-sm font-semibold text-foreground text-center leading-tight px-1">
                      {cat.label}
                    </h3>
                    {hasContent && (
                      <Badge variant="secondary" className="text-[9px] mt-2">
                        {catBooks.length} {catBooks.length === 1 ? 'text' : 'texts'}
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 px-2.5 py-2.5 space-y-0.5">
                    {cat.children ? (
                      cat.children.map(sub => {
                        const subBooks = getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch);
                        const hasSubBooks = subBooks.length > 0;
                        const isSubExpanded = expandedSubCategories.has(sub.id);

                        return (
                          <div key={sub.id}>
                            <button
                              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${hasSubBooks ? "hover-elevate active-elevate-2 text-primary font-medium" : "text-muted-foreground/50 cursor-default"}`}
                              onClick={() => hasSubBooks && toggleSubCategory(sub.id)}
                              data-testid={`button-subcat-${sub.id}`}
                            >
                              {hasSubBooks ? (
                                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isSubExpanded ? "rotate-90" : ""}`} />
                              ) : (
                                <Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground/30" />
                              )}
                              <span className="truncate">{sub.label}</span>
                              {!hasSubBooks && (
                                <span className="text-[9px] text-muted-foreground/30 ml-auto italic shrink-0">Soon</span>
                              )}
                            </button>

                            {isSubExpanded && hasSubBooks && (
                              <div className="ml-3 pl-2 border-l border-primary/15 space-y-0.5 py-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                {subBooks.map(book => (
                                  <button
                                    key={book.id}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover-elevate active-elevate-2 transition-colors group"
                                    onClick={() => onSelectBook(book.id)}
                                    data-testid={`button-book-${book.slug}`}
                                  >
                                    <BookOpen className="h-3 w-3 shrink-0 text-primary/50" />
                                    <span className="text-xs font-serif text-foreground group-hover:text-primary transition-colors truncate">
                                      {book.title}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : hasContent ? (
                      catBooks.map(book => (
                        <button
                          key={book.id}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover-elevate active-elevate-2 transition-colors group"
                          onClick={() => onSelectBook(book.id)}
                          data-testid={`button-book-${book.slug}`}
                        >
                          <BookOpen className="h-3 w-3 shrink-0 text-primary/50" />
                          <span className="text-xs font-serif text-foreground group-hover:text-primary transition-colors truncate">
                            {book.title}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="py-2 text-center">
                        <span className="text-[10px] text-muted-foreground/40 italic">Coming Soon</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground" data-testid="heading-coming-soon">
              Coming Soon
            </h2>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {comingSoonBooks.map((book) => (
              <Card
                key={book.titleEn}
                className="p-0 overflow-hidden border-border/60 bg-muted/30 backdrop-blur-sm opacity-80"
                data-testid={`card-coming-soon-${book.titleEn.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <img
                    src={book.image}
                    alt={book.titleEn}
                    className="w-full h-full object-cover grayscale-[40%] opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-[9px] bg-black/40 text-white/80 border-white/20 backdrop-blur-sm">
                      Coming Soon
                    </Badge>
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3">
                    <h3 className="font-serif text-sm font-semibold text-white/90 leading-tight drop-shadow-md">
                      {book.title}
                    </h3>
                    <p className="text-[11px] text-white/70">
                      {book.titleEn}
                    </p>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2">
                    {book.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {books.some(b => bookVideoConfig[b.slug]) && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-primary/30"></div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid="heading-explanatory-videos">
                Watch Introduction
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

interface CategoryDetailViewProps {
  categoryId: string;
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onGoBack: () => void;
}

export function CategoryDetailView({ categoryId, books, onSelectBook, onGoBack }: CategoryDetailViewProps) {
  const category = CATALOG_TREE.find(c => c.id === categoryId);
  if (!category) return null;

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
    if (category.categoryMatch && book.category === category.categoryMatch) {
      if (!booksBySubCategory[category.id]) booksBySubCategory[category.id] = [];
      booksBySubCategory[category.id].push(book);
    }
  }

  const renderBookList = (bookList: Book[]) => (
    <div className="space-y-0.5 pl-2">
      {bookList.map(book => (
        <button
          key={book.id}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover-elevate active-elevate-2 transition-colors group"
          onClick={() => onSelectBook(book.id)}
          data-testid={`button-catbook-${book.slug}`}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/60" />
          <span className="text-sm font-serif font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {book.title}
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {book.totalVerses ?? 0} verses
          </span>
        </button>
      ))}
    </div>
  );

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
            Back to Home
          </Button>
          <div className="flex items-center gap-3">
            <Library className="h-6 w-6 text-primary shrink-0" />
            <h1 className="font-serif text-lg sm:text-2xl font-semibold text-primary" data-testid="text-category-title">
              {category.label}
            </h1>
          </div>
          <div className="h-px bg-primary/15"></div>
        </div>

        {category.children ? (
          <div className="space-y-6">
            {category.children.map(sub => {
              const subBooks = booksBySubCategory[sub.id] ?? [];
              const hasBooks = subBooks.length > 0;

              return (
                <div key={sub.id} className="space-y-2" data-testid={`section-subcat-${sub.id}`}>
                  <div className="flex items-center gap-2">
                    {hasBooks ? (
                      <FolderOpen className="h-4 w-4 text-primary/70 shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <h2 className={`font-serif text-sm sm:text-base font-semibold ${hasBooks ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {sub.label}
                    </h2>
                    {hasBooks && (
                      <Badge variant="secondary" className="text-[10px]">
                        {subBooks.length} {subBooks.length === 1 ? 'text' : 'texts'}
                      </Badge>
                    )}
                    <div className="h-px flex-1 bg-border/50"></div>
                  </div>

                  {hasBooks ? renderBookList(subBooks) : (
                    <div className="py-3 px-4 text-center">
                      <p className="text-xs text-muted-foreground/50 italic">Coming soon...</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {booksBySubCategory[category.id]?.length > 0 ? (
              renderBookList(booksBySubCategory[category.id])
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground/60 italic">Coming soon...</p>
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
