import { eq, ilike, and } from "drizzle-orm";
import { db } from "./db";
import {
  books,
  verses,
  verseTranslations,
  explanations,
  bookTitles,
  languages,
  type Book,
  type InsertBook,
  type Verse,
  type InsertVerse,
  type VerseTranslation,
  type InsertVerseTranslation,
  type Explanation,
  type InsertExplanation,
  type BookTitle,
  type InsertBookTitle,
  type Language,
  type InsertLanguage,
  type BookWithDetails,
  type VerseWithTranslations,
} from "@shared/schema";

export interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
}

export interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

export interface IStorage {
  getAllBooks(): Promise<Book[]>;
  getBookById(id: string): Promise<BookWithDetails | undefined>;
  getBookBySlug(slug: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined>;

  getVersesByBookId(bookId: string): Promise<VerseWithTranslations[]>;
  getVerseById(id: string): Promise<VerseWithTranslations | undefined>;
  createVerse(verse: InsertVerse): Promise<Verse>;

  getTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]>;
  createTranslation(translation: InsertVerseTranslation): Promise<VerseTranslation>;

  getExplanationsByVerseId(verseId: string): Promise<Explanation[]>;
  createExplanation(explanation: InsertExplanation): Promise<Explanation>;
  getCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions>;

  getAllLanguages(): Promise<Language[]>;
  createLanguage(language: InsertLanguage): Promise<Language>;

  createBookTitle(bookTitle: InsertBookTitle): Promise<BookTitle>;
  getBookTitlesByBookId(bookId: string): Promise<BookTitle[]>;
}

export class DatabaseStorage implements IStorage {
  async getAllBooks(): Promise<Book[]> {
    return await db.select().from(books);
  }

  async getBookById(id: string): Promise<BookWithDetails | undefined> {
    const book = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!book[0]) return undefined;

    const bookVerses = await this.getVersesByBookId(id);
    const titles = await this.getBookTitlesByBookId(id);

    return {
      ...book[0],
      titles,
      verses: bookVerses,
    };
  }

  async getBookBySlug(slug: string): Promise<Book | undefined> {
    const result = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
    return result[0];
  }

  async createBook(book: InsertBook): Promise<Book> {
    const result = await db.insert(books).values(book).returning();
    return result[0];
  }

  async updateBook(id: string, bookUpdate: Partial<InsertBook>): Promise<Book | undefined> {
    const result = await db.update(books).set(bookUpdate).where(eq(books.id, id)).returning();
    return result[0];
  }

  async getVersesByBookId(bookId: string): Promise<VerseWithTranslations[]> {
    const bookVerses = await db
      .select()
      .from(verses)
      .where(eq(verses.bookId, bookId))
      .orderBy(verses.verseNumber);

    const versesWithDetails: VerseWithTranslations[] = [];
    for (const verse of bookVerses) {
      const translations = await this.getTranslationsByVerseId(verse.id);
      const verseExplanations = await this.getExplanationsByVerseId(verse.id);
      versesWithDetails.push({
        ...verse,
        translations,
        explanations: verseExplanations,
      });
    }
    return versesWithDetails;
  }

  async getVerseById(id: string): Promise<VerseWithTranslations | undefined> {
    const result = await db.select().from(verses).where(eq(verses.id, id)).limit(1);
    if (!result[0]) return undefined;

    const translations = await this.getTranslationsByVerseId(id);
    const verseExplanations = await this.getExplanationsByVerseId(id);

    return {
      ...result[0],
      translations,
      explanations: verseExplanations,
    };
  }

  async createVerse(verse: InsertVerse): Promise<Verse> {
    const result = await db.insert(verses).values(verse).returning();
    return result[0];
  }

  async getTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]> {
    return await db
      .select()
      .from(verseTranslations)
      .where(eq(verseTranslations.verseId, verseId));
  }

  async createTranslation(translation: InsertVerseTranslation): Promise<VerseTranslation> {
    const result = await db.insert(verseTranslations).values(translation).returning();
    return result[0];
  }

  async getExplanationsByVerseId(verseId: string): Promise<Explanation[]> {
    return await db
      .select()
      .from(explanations)
      .where(eq(explanations.verseId, verseId));
  }

  async createExplanation(explanation: InsertExplanation): Promise<Explanation> {
    const result = await db.insert(explanations).values(explanation).returning();
    return result[0];
  }

  async getCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions> {
    const allExplanations = await db
      .select({
        authorName: explanations.authorName,
        authorTitle: explanations.authorTitle,
        languageCode: explanations.languageCode,
      })
      .from(explanations)
      .innerJoin(verses, eq(explanations.verseId, verses.id))
      .where(eq(verses.bookId, bookId));
    
    if (allExplanations.length === 0) {
      return { authors: [], languages: [] };
    }

    const authorMap = new Map<string, { authorTitle: string | null; languageCodes: Set<string> }>();
    const languageSet = new Set<string>();

    for (const exp of allExplanations) {
      languageSet.add(exp.languageCode);
      
      if (!authorMap.has(exp.authorName)) {
        authorMap.set(exp.authorName, {
          authorTitle: exp.authorTitle,
          languageCodes: new Set([exp.languageCode])
        });
      } else {
        authorMap.get(exp.authorName)!.languageCodes.add(exp.languageCode);
      }
    }

    const allLanguages = await this.getAllLanguages();
    const languageNameMap = new Map(allLanguages.map(l => [l.code, l.name]));

    const authors: CommentaryOption[] = Array.from(authorMap.entries()).map(([name, data]) => ({
      authorName: name,
      authorTitle: data.authorTitle,
      languageCodes: Array.from(data.languageCodes)
    }));

    const languagesResult = Array.from(languageSet).map(code => ({
      code,
      name: languageNameMap.get(code) || code
    }));

    return { authors, languages: languagesResult };
  }

  async getAllLanguages(): Promise<Language[]> {
    return await db.select().from(languages);
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    const result = await db.insert(languages).values(language).returning();
    return result[0];
  }

  async createBookTitle(bookTitle: InsertBookTitle): Promise<BookTitle> {
    const result = await db.insert(bookTitles).values(bookTitle).returning();
    return result[0];
  }

  async getBookTitlesByBookId(bookId: string): Promise<BookTitle[]> {
    return await db.select().from(bookTitles).where(eq(bookTitles.bookId, bookId));
  }
}

export const storage = new DatabaseStorage();
