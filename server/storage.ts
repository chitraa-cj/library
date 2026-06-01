import { eq, ilike, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  books,
  verses,
  verseTranslations,
  explanations,
  bookTitles,
  languages,
  wordTranslations,
  notes,
  verseProgress,
  verseWordMeanings,
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
  type BookWithVerseMeta,
  type VerseMeta,
  type VerseWithTranslations,
  type WordTranslation,
  type InsertWordTranslation,
  type Note,
  type InsertNote,
  type VerseProgress,
  type VerseWordMeaning,
} from "@shared/schema";
import {
  isStrapiConfigured,
  isStrapiReachable,
  strapiGetAllBooks,
  strapiGetBookById,
  strapiGetBookBySlug,
  strapiGetBookWithVerseMeta,
  strapiGetVerseById,
  strapiGetTranslationsByVerseId,
  strapiGetExplanationsByVerseId,
  strapiGetCommentaryOptionsByBookId,
  strapiGetAllAuthors,
  strapiGetAllLanguages,
  strapiGetBookTitlesByBookId,
  strapiGetWordMeaningsByVerseId,
  strapiGetChapterVerses,
} from "./strapi";
import {
  normalizeBookSlugForMerge,
  resolveBookSlugAlias,
  resolveStrapiDocIdForLocalSlug,
  STRAPI_IDS_MERGE_DESPITE_SHARED_SLUG,
} from "./strapi-merge-policy";

export interface CommentaryOption {
  authorName: string;
  authorTitle: string | null;
  languageCodes: string[];
  commentaryType?: "bhashya" | "teeka";
}

export interface CommentaryOptions {
  authors: CommentaryOption[];
  languages: { code: string; name: string }[];
}

export interface IStorage {
  getAllBooks(): Promise<Book[]>;
  getBookById(id: string): Promise<BookWithDetails | undefined>;
  getBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined>;
  getBookBySlug(slug: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined>;

  getVersesByBookId(bookId: string): Promise<VerseWithTranslations[]>;
  getVerseById(id: string): Promise<VerseWithTranslations | undefined>;
  getChapterVerses(bookId: string, adhyayNumber: number): Promise<VerseWithTranslations[]>;
  createVerse(verse: InsertVerse): Promise<Verse>;

  getTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]>;
  createTranslation(translation: InsertVerseTranslation): Promise<VerseTranslation>;

  getExplanationsByVerseId(verseId: string): Promise<Explanation[]>;
  createExplanation(explanation: InsertExplanation): Promise<Explanation>;
  getCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions>;
  getAllAuthors(): Promise<string[]>;

  getAllLanguages(): Promise<Language[]>;
  createLanguage(language: InsertLanguage): Promise<Language>;

  createBookTitle(bookTitle: InsertBookTitle): Promise<BookTitle>;
  getBookTitlesByBookId(bookId: string): Promise<BookTitle[]>;

  getCachedWordTranslation(word: string, sourceLanguage: string, targetLanguage: string): Promise<WordTranslation | undefined>;
  cacheWordTranslation(translation: InsertWordTranslation): Promise<WordTranslation>;

  getWordMeaningsByVerseId(verseId: string): Promise<VerseWordMeaning[]>;

  getNotesByVerseAndUser(verseId: string, userId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, userId: string, content: string): Promise<Note | undefined>;
  deleteNote(id: string, userId: string): Promise<boolean>;

  markVerseComplete(userId: string, bookId: string, verseId: string): Promise<VerseProgress>;
  unmarkVerseComplete(userId: string, verseId: string): Promise<boolean>;
  getCompletedVerseIdsForBook(userId: string, bookId: string): Promise<string[]>;
  getProgressSummary(userId: string): Promise<Record<string, number>>;
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

  async getBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
    const book = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!book[0]) return undefined;

    const titles = await this.getBookTitlesByBookId(id);
    const bookVerses = await db
      .select({
        id: verses.id,
        bookId: verses.bookId,
        verseNumber: verses.verseNumber,
        sectionTitle: verses.sectionTitle,
        adhyayNumber: verses.adhyayNumber,
        adhyayTitle: verses.adhyayTitle,
        khandaNumber: verses.khandaNumber,
        khandaTitle: verses.khandaTitle,
      })
      .from(verses)
      .where(eq(verses.bookId, id))
      .orderBy(verses.verseNumber);

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

  async getChapterVerses(bookId: string, adhyayNumber: number): Promise<VerseWithTranslations[]> {
    const chapterVerses = await db
      .select()
      .from(verses)
      .where(and(eq(verses.bookId, bookId), eq(verses.adhyayNumber, adhyayNumber)))
      .orderBy(verses.verseNumber);

    const result: VerseWithTranslations[] = [];
    for (const verse of chapterVerses) {
      const translations = await this.getTranslationsByVerseId(verse.id);
      result.push({
        ...verse,
        translations,
        explanations: [],
      });
    }
    return result;
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

  async getAllAuthors(): Promise<string[]> {
    const result = await db
      .selectDistinct({ authorName: explanations.authorName })
      .from(explanations)
      .orderBy(explanations.authorName);
    return result.map(r => r.authorName);
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

  async getCachedWordTranslation(word: string, sourceLanguage: string, targetLanguage: string): Promise<WordTranslation | undefined> {
    const result = await db
      .select()
      .from(wordTranslations)
      .where(
        and(
          eq(wordTranslations.word, word),
          eq(wordTranslations.sourceLanguage, sourceLanguage),
          eq(wordTranslations.targetLanguage, targetLanguage)
        )
      )
      .limit(1);
    return result[0];
  }

  async cacheWordTranslation(translation: InsertWordTranslation): Promise<WordTranslation> {
    const result = await db.insert(wordTranslations).values(translation).returning();
    return result[0];
  }

  async getWordMeaningsByVerseId(verseId: string): Promise<VerseWordMeaning[]> {
    return await db
      .select()
      .from(verseWordMeanings)
      .where(eq(verseWordMeanings.verseId, verseId))
      .orderBy(verseWordMeanings.position);
  }

  async getNotesByVerseAndUser(verseId: string, userId: string): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(and(eq(notes.verseId, verseId), eq(notes.userId, userId)));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(note).returning();
    return result[0];
  }

  async updateNote(id: string, userId: string, content: string): Promise<Note | undefined> {
    const result = await db
      .update(notes)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteNote(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async markVerseComplete(userId: string, bookId: string, verseId: string): Promise<VerseProgress> {
    const result = await db
      .insert(verseProgress)
      .values({ userId, bookId, verseId })
      .onConflictDoUpdate({
        target: [verseProgress.userId, verseProgress.verseId],
        set: { bookId, completedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  async unmarkVerseComplete(userId: string, verseId: string): Promise<boolean> {
    const result = await db
      .delete(verseProgress)
      .where(and(eq(verseProgress.userId, userId), eq(verseProgress.verseId, verseId)))
      .returning();
    return result.length > 0;
  }

  async getCompletedVerseIdsForBook(userId: string, bookId: string): Promise<string[]> {
    const rows = await db
      .select({ verseId: verseProgress.verseId })
      .from(verseProgress)
      .where(and(eq(verseProgress.userId, userId), eq(verseProgress.bookId, bookId)));
    return rows.map(r => r.verseId);
  }

  async getProgressSummary(userId: string): Promise<Record<string, number>> {
    const rows = await db
      .select({ bookId: verseProgress.bookId, count: sql<number>`count(*)::int` })
      .from(verseProgress)
      .where(eq(verseProgress.userId, userId))
      .groupBy(verseProgress.bookId);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.bookId] = Number(r.count);
    return out;
  }
}

export class HybridStorage implements IStorage {
  private db = new DatabaseStorage();
  private _strapiAvailable: boolean | null = null;
  private _lastStrapiCheck = 0;
  private readonly STRAPI_CHECK_INTERVAL = 60000;
  private _strapiToDbVerseIds = new Map<string, string>();

  private cacheVerseIdMapping(strapiId: string, dbId: string) {
    if (strapiId !== dbId) {
      this._strapiToDbVerseIds.set(strapiId, dbId);
    }
  }

  private resolveDbVerseId(id: string): string {
    return this._strapiToDbVerseIds.get(id) || id;
  }

  private async useStrapiFor<T>(
    strapiCall: () => Promise<T | null | undefined>,
    dbFallback: () => Promise<T>,
    label: string
  ): Promise<T> {
    if (await this.isStrapiAvailable()) {
      try {
        const result = await strapiCall();
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (err: any) {
        console.warn(`[Strapi] ${label} failed, falling back to DB:`, err.message || err);
      }
    }
    return dbFallback();
  }

  private async useStrapiForArray<T>(
    strapiCall: () => Promise<T[]>,
    dbFallback: () => Promise<T[]>,
    label: string
  ): Promise<T[]> {
    if (await this.isStrapiAvailable()) {
      try {
        const result = await strapiCall();
        if (result.length > 0) return result;
      } catch (err: any) {
        console.warn(`[Strapi] ${label} failed, falling back to DB:`, err.message || err);
      }
    }
    return dbFallback();
  }

  private async isStrapiAvailable(): Promise<boolean> {
    if (!isStrapiConfigured()) return false;
    const now = Date.now();
    if (this._strapiAvailable !== null && now - this._lastStrapiCheck < this.STRAPI_CHECK_INTERVAL) {
      return this._strapiAvailable;
    }
    this._strapiAvailable = await isStrapiReachable();
    this._lastStrapiCheck = now;
    if (this._strapiAvailable) {
      console.log("[Strapi] Connection active — using Strapi as primary source");
    }
    return this._strapiAvailable;
  }

  async getAllBooks(): Promise<Book[]> {
    let dbBooks: Book[] = [];
    try {
      dbBooks = await this.db.getAllBooks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[HybridStorage] getAllBooks DB query failed; continuing with Strapi if available:", msg);
    }
    if (!(await this.isStrapiAvailable())) return dbBooks;
    try {
      const strapiBooks = await strapiGetAllBooks();
      const dbSlugSet = new Set(dbBooks.map((b) => normalizeBookSlugForMerge(b.slug)));
      const merged = [...dbBooks];
      for (const b of strapiBooks) {
        const sSlug = normalizeBookSlugForMerge(b.slug);
        const forceMerge = STRAPI_IDS_MERGE_DESPITE_SHARED_SLUG.has(b.id);
        if (!dbSlugSet.has(sSlug) || forceMerge) {
          merged.push(b);
        }
      }
      return merged;
    } catch (err: any) {
      console.warn(`[Strapi] getAllBooks failed, falling back to DB:`, err.message || err);
      return dbBooks;
    }
  }

  async getBookById(id: string): Promise<BookWithDetails | undefined> {
    return this.useStrapiFor(
      () => strapiGetBookById(id),
      () => this.db.getBookById(id),
      "getBookById"
    );
  }

  private strapiBookDetailsToVerseMeta(book: BookWithDetails): BookWithVerseMeta {
    return {
      ...book,
      titles: book.titles ?? [],
      verses: book.verses.map((v) => ({
        id: v.id,
        bookId: v.bookId,
        verseNumber: v.verseNumber,
        sectionTitle: v.sectionTitle,
        adhyayNumber: v.adhyayNumber ?? null,
        adhyayTitle: v.adhyayTitle ?? null,
        khandaNumber: v.khandaNumber ?? null,
        khandaTitle: v.khandaTitle ?? null,
      })),
      totalVerses: book.totalVerses ?? book.verses.length,
    };
  }

  async getBookWithVerseMeta(id: string): Promise<BookWithVerseMeta | undefined> {
    if (await this.isStrapiAvailable()) {
      try {
        const meta = await strapiGetBookWithVerseMeta(id);
        if (meta) return meta;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Strapi] getBookWithVerseMeta failed, trying full book load:", msg);
      }
      try {
        const full = await strapiGetBookById(id);
        if (full?.verses?.length) {
          return this.strapiBookDetailsToVerseMeta(full);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Strapi] getBookById fallback for verse meta failed:", msg);
      }
    }
    return this.db.getBookWithVerseMeta(id);
  }

  async getBookBySlug(slug: string): Promise<Book | undefined> {
    const canonicalSlug = resolveBookSlugAlias(slug);
    return this.useStrapiFor(
      async () => {
        const strapiDocId = resolveStrapiDocIdForLocalSlug(slug);
        if (strapiDocId) {
          const byDoc = await strapiGetBookById(strapiDocId);
          if (byDoc) return byDoc;
        }
        return (
          (await strapiGetBookBySlug(canonicalSlug)) ??
          (canonicalSlug !== slug ? strapiGetBookBySlug(slug) : undefined)
        );
      },
      async () =>
        (await this.db.getBookBySlug(slug)) ??
        (canonicalSlug !== slug ? this.db.getBookBySlug(canonicalSlug) : undefined),
      "getBookBySlug"
    );
  }

  async createBook(book: InsertBook): Promise<Book> {
    return this.db.createBook(book);
  }

  async updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined> {
    return this.db.updateBook(id, book);
  }

  async getVersesByBookId(bookId: string): Promise<VerseWithTranslations[]> {
    return this.useStrapiForArray(
      async () => {
        const book = await strapiGetBookById(bookId);
        return book?.verses ?? [];
      },
      () => this.db.getVersesByBookId(bookId),
      "getVersesByBookId"
    );
  }

  async getVerseById(id: string): Promise<VerseWithTranslations | undefined> {
    return this.useStrapiFor(
      () => strapiGetVerseById(id),
      () => this.db.getVerseById(id),
      "getVerseById"
    );
  }

  async getChapterVerses(bookId: string, adhyayNumber: number): Promise<VerseWithTranslations[]> {
    return this.useStrapiForArray(
      () => strapiGetChapterVerses(bookId, adhyayNumber),
      () => this.db.getChapterVerses(bookId, adhyayNumber),
      "getChapterVerses"
    );
  }

  async createVerse(verse: InsertVerse): Promise<Verse> {
    return this.db.createVerse(verse);
  }

  async getTranslationsByVerseId(verseId: string): Promise<VerseTranslation[]> {
    return this.useStrapiForArray(
      () => strapiGetTranslationsByVerseId(verseId),
      () => this.db.getTranslationsByVerseId(verseId),
      "getTranslationsByVerseId"
    );
  }

  async createTranslation(translation: InsertVerseTranslation): Promise<VerseTranslation> {
    return this.db.createTranslation(translation);
  }

  async getExplanationsByVerseId(verseId: string): Promise<Explanation[]> {
    return this.useStrapiForArray(
      () => strapiGetExplanationsByVerseId(verseId),
      () => this.db.getExplanationsByVerseId(verseId),
      "getExplanationsByVerseId"
    );
  }

  async createExplanation(explanation: InsertExplanation): Promise<Explanation> {
    return this.db.createExplanation(explanation);
  }

  async getCommentaryOptionsByBookId(bookId: string): Promise<CommentaryOptions> {
    return this.useStrapiFor(
      () => strapiGetCommentaryOptionsByBookId(bookId),
      () => this.db.getCommentaryOptionsByBookId(bookId),
      "getCommentaryOptionsByBookId"
    );
  }

  async getAllAuthors(): Promise<string[]> {
    return this.useStrapiForArray(
      () => strapiGetAllAuthors(),
      () => this.db.getAllAuthors(),
      "getAllAuthors"
    );
  }

  async getAllLanguages(): Promise<Language[]> {
    return this.useStrapiForArray(
      () => strapiGetAllLanguages(),
      () => this.db.getAllLanguages(),
      "getAllLanguages"
    );
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    return this.db.createLanguage(language);
  }

  async createBookTitle(bookTitle: InsertBookTitle): Promise<BookTitle> {
    return this.db.createBookTitle(bookTitle);
  }

  async getBookTitlesByBookId(bookId: string): Promise<BookTitle[]> {
    return this.useStrapiForArray(
      () => strapiGetBookTitlesByBookId(bookId),
      () => this.db.getBookTitlesByBookId(bookId),
      "getBookTitlesByBookId"
    );
  }

  async getCachedWordTranslation(word: string, sourceLanguage: string, targetLanguage: string): Promise<WordTranslation | undefined> {
    return this.db.getCachedWordTranslation(word, sourceLanguage, targetLanguage);
  }

  async cacheWordTranslation(translation: InsertWordTranslation): Promise<WordTranslation> {
    return this.db.cacheWordTranslation({
      ...translation,
      verseId: translation.verseId ? this.resolveDbVerseId(translation.verseId) : translation.verseId,
    });
  }

  async getWordMeaningsByVerseId(verseId: string): Promise<VerseWordMeaning[]> {
    return this.useStrapiForArray(
      () => strapiGetWordMeaningsByVerseId(verseId),
      () => this.db.getWordMeaningsByVerseId(verseId),
      "getWordMeaningsByVerseId"
    );
  }

  async getNotesByVerseAndUser(verseId: string, userId: string): Promise<Note[]> {
    return this.db.getNotesByVerseAndUser(this.resolveDbVerseId(verseId), userId);
  }

  async createNote(note: InsertNote): Promise<Note> {
    return this.db.createNote({ ...note, verseId: this.resolveDbVerseId(note.verseId) });
  }

  async updateNote(id: string, userId: string, content: string): Promise<Note | undefined> {
    return this.db.updateNote(id, userId, content);
  }

  async deleteNote(id: string, userId: string): Promise<boolean> {
    return this.db.deleteNote(id, userId);
  }

  async markVerseComplete(userId: string, bookId: string, verseId: string): Promise<VerseProgress> {
    return this.db.markVerseComplete(userId, bookId, this.resolveDbVerseId(verseId));
  }

  async unmarkVerseComplete(userId: string, verseId: string): Promise<boolean> {
    return this.db.unmarkVerseComplete(userId, this.resolveDbVerseId(verseId));
  }

  async getCompletedVerseIdsForBook(userId: string, bookId: string): Promise<string[]> {
    return this.db.getCompletedVerseIdsForBook(userId, bookId);
  }

  async getProgressSummary(userId: string): Promise<Record<string, number>> {
    return this.db.getProgressSummary(userId);
  }
}

export const storage = isStrapiConfigured() ? new HybridStorage() : new DatabaseStorage();
