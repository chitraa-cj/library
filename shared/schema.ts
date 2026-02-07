import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const languages = pgTable("languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  script: text("script").notNull(),
});

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: text("title").notNull(),
  author: text("author"),
  description: text("description"),
  category: text("category").notNull(),
  coverImage: text("cover_image"),
  totalVerses: integer("total_verses").default(0),
});

export const verses = pgTable("verses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id),
  verseNumber: integer("verse_number").notNull(),
  sectionTitle: text("section_title"),
  adhyayNumber: integer("adhyay_number"),
  adhyayTitle: text("adhyay_title"),
  khandaNumber: integer("khanda_number"),
  khandaTitle: text("khanda_title"),
});

export const verseTranslations = pgTable("verse_translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verseId: varchar("verse_id").notNull().references(() => verses.id),
  languageCode: varchar("language_code", { length: 20 }).notNull(),
  content: text("content").notNull(),
});

export const explanations = pgTable("explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verseId: varchar("verse_id").notNull().references(() => verses.id),
  authorName: text("author_name").notNull(),
  authorTitle: text("author_title"),
  languageCode: varchar("language_code", { length: 20 }).notNull(),
  content: text("content").notNull(),
});

export const bookTitles = pgTable("book_titles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: varchar("book_id").notNull().references(() => books.id),
  languageCode: varchar("language_code", { length: 20 }).notNull(),
  title: text("title").notNull(),
});

export const insertLanguageSchema = createInsertSchema(languages).omit({ id: true });
export const insertBookSchema = createInsertSchema(books).omit({ id: true });
export const insertVerseSchema = createInsertSchema(verses).omit({ id: true });
export const insertVerseTranslationSchema = createInsertSchema(verseTranslations).omit({ id: true });
export const insertExplanationSchema = createInsertSchema(explanations).omit({ id: true });
export const insertBookTitleSchema = createInsertSchema(bookTitles).omit({ id: true });

export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type Language = typeof languages.$inferSelect;

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export type InsertVerse = z.infer<typeof insertVerseSchema>;
export type Verse = typeof verses.$inferSelect;

export type InsertVerseTranslation = z.infer<typeof insertVerseTranslationSchema>;
export type VerseTranslation = typeof verseTranslations.$inferSelect;

export type InsertExplanation = z.infer<typeof insertExplanationSchema>;
export type Explanation = typeof explanations.$inferSelect;

export type InsertBookTitle = z.infer<typeof insertBookTitleSchema>;
export type BookTitle = typeof bookTitles.$inferSelect;

export interface VerseWithTranslations extends Verse {
  translations: VerseTranslation[];
  explanations: Explanation[];
}

export interface BookWithDetails extends Book {
  titles: BookTitle[];
  verses: VerseWithTranslations[];
}


export const wordTranslations = pgTable("word_translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: text("word").notNull(),
  sourceLanguage: varchar("source_language", { length: 20 }).notNull(),
  targetLanguage: varchar("target_language", { length: 20 }).notNull(),
  translation: text("translation").notNull(),
  grammaticalInfo: text("grammatical_info"),
  etymology: text("etymology"),
  contextualMeaning: text("contextual_meaning"),
  verseContext: text("verse_context"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const translateWordRequestSchema = z.object({
  word: z.string().min(1).max(100).transform(s => s.trim()),
  sourceLanguage: z.string().min(1).max(20),
  targetLanguage: z.string().min(1).max(20),
  verseContext: z.string().optional().default(""),
  commentaryContext: z.string().optional().default(""),
});

export const insertWordTranslationSchema = createInsertSchema(wordTranslations).omit({ id: true, createdAt: true });

export type InsertWordTranslation = z.infer<typeof insertWordTranslationSchema>;
export type WordTranslation = typeof wordTranslations.$inferSelect;

export const verseWordMeanings = pgTable("verse_word_meanings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verseId: varchar("verse_id").notNull().references(() => verses.id),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  position: integer("position").notNull(),
});

export const insertVerseWordMeaningSchema = createInsertSchema(verseWordMeanings).omit({ id: true });
export type InsertVerseWordMeaning = z.infer<typeof insertVerseWordMeaningSchema>;
export type VerseWordMeaning = typeof verseWordMeanings.$inferSelect;

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  verseId: varchar("verse_id").notNull().references(() => verses.id),
  content: text("content").notNull(),
  selectedText: text("selected_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export * from "./models/auth";
