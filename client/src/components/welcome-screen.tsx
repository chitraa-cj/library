import { useState } from "react";
import { BookOpen, Clock, Library, FolderOpen, Lock, ArrowLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import { CATALOG_TREE, type CatalogCategory } from "@/components/app-sidebar";
import { MindMapCarousel } from "@/components/mindmap-carousel";
import brahmaImg from "@/assets/images/book-brahma-sutra.jpg";
import vivekImg from "@/assets/images/book-vivekachudamani.jpg";
import upadesaImg from "@/assets/images/book-upadesa-sahasri.jpg";

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

        <MindMapCarousel />

        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <Library className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-serif text-base sm:text-lg font-semibold text-foreground" data-testid="heading-browse-library">
              Browse the Library
            </h2>
            <div className="h-px flex-1 bg-primary/15"></div>
          </div>

          <div className="space-y-1" data-testid="catalog-tree">
            {CATALOG_TREE.map(cat => {
              const isExpanded = expandedCategories.has(cat.id);
              const catBooks = getBooksForCategory(books, cat);
              const hasContent = catBooks.length > 0 || (cat.children && cat.children.length > 0);

              return (
                <div key={cat.id} data-testid={`catalog-category-${cat.id}`}>
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-3 rounded-lg text-left hover-elevate active-elevate-2 transition-colors"
                    onClick={() => toggleCategory(cat.id)}
                    data-testid={`button-category-${cat.id}`}
                  >
                    <ChevronRight className={`h-4 w-4 shrink-0 text-primary/60 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="font-serif text-sm sm:text-base font-medium text-foreground truncate">{cat.label}</span>
                    {catBooks.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                        {catBooks.length}
                      </Badge>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-5 sm:ml-7 pl-3 border-l border-primary/10 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150 pb-2">
                      {cat.children ? (
                        cat.children.map(sub => {
                          const subBooks = getBooksForSubCategory(books, sub.categoryMatch, sub.categoryAltMatch);
                          const isSubExpanded = expandedSubCategories.has(sub.id);
                          const hasSubBooks = subBooks.length > 0;

                          return (
                            <div key={sub.id} data-testid={`catalog-subcat-${sub.id}`}>
                              <button
                                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${hasSubBooks ? "hover-elevate active-elevate-2" : "opacity-50 cursor-default"}`}
                                onClick={() => hasSubBooks && toggleSubCategory(sub.id)}
                                data-testid={`button-subcat-${sub.id}`}
                              >
                                {hasSubBooks ? (
                                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isSubExpanded ? "rotate-90" : ""}`} />
                                ) : (
                                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                                )}
                                <span className={`text-sm ${hasSubBooks ? "text-primary font-medium" : "text-muted-foreground/60"}`}>
                                  {sub.label}
                                </span>
                                {hasSubBooks && (
                                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0 border-primary/20">
                                    {subBooks.length} {subBooks.length === 1 ? "text" : "texts"}
                                  </Badge>
                                )}
                                {!hasSubBooks && (
                                  <span className="text-[10px] text-muted-foreground/40 ml-auto italic">Coming soon</span>
                                )}
                              </button>

                              {isSubExpanded && hasSubBooks && (
                                <div className="ml-4 pl-3 border-l border-border/40 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150 py-1">
                                  {subBooks.map(book => (
                                    <button
                                      key={book.id}
                                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover-elevate active-elevate-2 transition-colors group"
                                      onClick={() => onSelectBook(book.id)}
                                      data-testid={`button-book-${book.slug}`}
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
                              )}
                            </div>
                          );
                        })
                      ) : (
                        catBooks.length > 0 ? (
                          catBooks.map(book => (
                            <button
                              key={book.id}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover-elevate active-elevate-2 transition-colors group"
                              onClick={() => onSelectBook(book.id)}
                              data-testid={`button-book-${book.slug}`}
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                              <span className="text-sm font-serif font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                {book.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                {book.totalVerses ?? 0} verses
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2">
                            <span className="text-xs text-muted-foreground/50 italic">Coming soon...</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
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
