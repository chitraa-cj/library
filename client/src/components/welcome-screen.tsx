import { BookOpen, Clock, Library, Scroll, BookMarked, Feather } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoInline } from "@/components/video-popup";
import ishaImg from "@/assets/images/book-isha-upanishad.jpg";
import gitaImg from "@/assets/images/book-bhagavad-gita.jpg";
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

const bookImages: Record<string, string> = {
  "isha-upanishad-bhashya": ishaImg,
  "bhagavad-gita": gitaImg,
};

const comingSoonBooks = [
  {
    title: "ब्रह्मसूत्र भाष्य",
    titleEn: "Brahma Sutra Bhashya",
    author: "Sri Shankaracharya",
    category: "Vedanta",
    description: "The foundational text of Advaita Vedanta — Shankaracharya's commentary on Badarayana's aphorisms establishing the nature of Brahman",
    image: brahmaImg,
  },
  {
    title: "विवेकचूडामणि",
    titleEn: "Vivekachudamani",
    author: "Sri Shankaracharya",
    category: "Prakarana Grantha",
    description: "The Crest-Jewel of Discrimination — a 580-verse poem guiding the seeker from ignorance to Self-realization through Advaita wisdom",
    image: vivekImg,
  },
  {
    title: "उपदेशसाहस्री",
    titleEn: "Upadesa Sahasri",
    author: "Sri Shankaracharya",
    category: "Prakarana Grantha",
    description: "A Thousand Teachings — Shankaracharya's independent prose and verse work on the method of realizing Brahman",
    image: upadesaImg,
  },
];

const categoryIcon: Record<string, typeof BookOpen> = {
  "Upanishad": Scroll,
  "Gita": BookMarked,
  "Vedanta": Library,
  "Prakarana Grantha": Feather,
};

export function WelcomeScreen({ books, onSelectBook }: WelcomeScreenProps) {
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {books.map((book) => {
              const coverImg = bookImages[book.slug];
              return (
                <Card
                  key={book.id}
                  className="group p-0 overflow-visible border-primary/15 bg-card/90 backdrop-blur-sm hover-elevate active-elevate-2 cursor-pointer transition-all"
                  onClick={() => onSelectBook(book.id)}
                  data-testid={`card-book-${book.slug}`}
                >
                  {coverImg && (
                    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-md">
                      <img
                        src={coverImg}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <Badge variant="secondary" className="text-[10px] mb-1.5" data-testid={`badge-category-${book.slug}`}>
                          {book.category}
                        </Badge>
                        <h3 className="font-serif text-lg sm:text-xl font-semibold text-white leading-tight drop-shadow-md" data-testid={`text-title-${book.slug}`}>
                          {book.title}
                        </h3>
                      </div>
                    </div>
                  )}
                  <div className="p-4 sm:p-5 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {book.author}
                    </p>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
                      {book.description}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {book.totalVerses ?? 0} verses
                      </span>
                      <Button variant="ghost" size="sm" className="text-xs text-primary h-auto py-1 px-2" data-testid={`button-read-${book.slug}`}>
                        Start Reading
                      </Button>
                    </div>
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
            {comingSoonBooks.map((book) => {
              const Icon = categoryIcon[book.category] || BookOpen;
              return (
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
                    <p className="text-[10px] text-muted-foreground/50 italic">
                      {book.author}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-primary/30"></div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid="heading-explanatory-videos">
              Watch Introduction
            </h2>
            <div className="h-px w-8 bg-primary/30"></div>
          </div>
          <VideoInline
            videoId="8ELHatzdtAk"
            title="Introduction to Isha Upanishad"
            className="max-w-xl mx-auto rounded-xl overflow-hidden border border-primary/20"
          />
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
