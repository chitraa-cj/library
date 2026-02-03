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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
