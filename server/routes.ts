import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { testStrapiConnection, STRAPI_URL } from "./strapi";
import { translateWord } from "./openai";
import { translateWordRequestSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { z } from "zod";
import multer from "multer";
import { translateTextChunked, translateImage, translatePdf, transliterateTextChunked, translateBhashyam } from "./gemini";
import { startTranslationJob, getTranslationProgress, getAllTranslationJobs, STRAPI_LANGUAGES, SKIP_TRANSLATE } from "./strapi-translate";

function getUserId(req: any): string {
  if (req.session?.emailUserId) {
    return req.session.emailUserId;
  }
  return req.user?.claims?.sub;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const STRAPI_ONLY_IDS = new Set([
    "ilox3o68ykdntxtzuf4q5zqi",
  ]);

  app.get("/api/books", async (req, res) => {
    try {
      const books = await storage.getAllBooks();
      const isLocalDb = (b: any) => typeof b.id === 'string' && b.id.includes('-') && b.id.length > 30;
      const localBooks = books.filter(b => isLocalDb(b));
      const strapiAllowed = books.filter(b => !isLocalDb(b) && STRAPI_ONLY_IDS.has(b.id as string));
      res.json([...localBooks, ...strapiAllowed]);
    } catch (error) {
      console.error("Error fetching books:", error);
      res.status(500).json({ error: "Failed to fetch books" });
    }
  });

  app.get("/api/books/by-slug/:slug", async (req, res) => {
    try {
      const book = await storage.getBookBySlug(req.params.slug);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      console.error("Error fetching book by slug:", error);
      res.status(500).json({ error: "Failed to fetch book" });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const book = await storage.getBookWithVerseMeta(req.params.id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      console.error("Error fetching book:", error);
      res.status(500).json({ error: "Failed to fetch book" });
    }
  });

  app.get("/api/verses/:id", async (req, res) => {
    try {
      const verse = await storage.getVerseById(req.params.id);
      if (!verse) {
        return res.status(404).json({ error: "Verse not found" });
      }
      res.json(verse);
    } catch (error) {
      console.error("Error fetching verse:", error);
      res.status(500).json({ error: "Failed to fetch verse" });
    }
  });

  app.get("/api/verses/:id/translations", async (req, res) => {
    try {
      const translations = await storage.getTranslationsByVerseId(req.params.id);
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ error: "Failed to fetch translations" });
    }
  });

  app.get("/api/verses/:id/explanations", async (req, res) => {
    try {
      const explanations = await storage.getExplanationsByVerseId(req.params.id);
      res.json(explanations);
    } catch (error) {
      console.error("Error fetching explanations:", error);
      res.status(500).json({ error: "Failed to fetch explanations" });
    }
  });

  app.get("/api/books/:id/chapter/:adhyayNumber/verses", async (req, res) => {
    try {
      const adhyayNumber = parseInt(req.params.adhyayNumber, 10);
      if (isNaN(adhyayNumber)) {
        return res.status(400).json({ error: "Invalid chapter number" });
      }
      const chapterVerses = await storage.getChapterVerses(req.params.id, adhyayNumber);
      res.json(chapterVerses);
    } catch (error) {
      console.error("Error fetching chapter verses:", error);
      res.status(500).json({ error: "Failed to fetch chapter verses" });
    }
  });

  app.get("/api/books/:id/commentary-options", async (req, res) => {
    try {
      const options = await storage.getCommentaryOptionsByBookId(req.params.id);
      res.json(options);
    } catch (error) {
      console.error("Error fetching commentary options:", error);
      res.status(500).json({ error: "Failed to fetch commentary options" });
    }
  });

  app.get("/api/languages", async (req, res) => {
    try {
      const languages = await storage.getAllLanguages();
      res.json(languages);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ error: "Failed to fetch languages" });
    }
  });

  app.get("/api/authors", async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
      res.json(authors);
    } catch (error) {
      console.error("Error fetching authors:", error);
      res.status(500).json({ error: "Failed to fetch authors" });
    }
  });

  app.get("/api/strapi/status", async (req, res) => {
    try {
      const status = await testStrapiConnection();
      res.json({
        ...status,
        strapiUrl: STRAPI_URL,
      });
    } catch (error) {
      console.error("Error testing Strapi connection:", error);
      res.status(500).json({ connected: false, message: "Failed to test connection" });
    }
  });

  app.get("/api/verses/:id/word-meanings", async (req, res) => {
    try {
      const meanings = await storage.getWordMeaningsByVerseId(req.params.id);
      res.json(meanings);
    } catch (error) {
      console.error("Error fetching word meanings:", error);
      res.status(500).json({ error: "Failed to fetch word meanings" });
    }
  });

  app.post("/api/translate-word", async (req, res) => {
    try {
      const parseResult = translateWordRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
      }

      const { word, sourceLanguage, targetLanguage, verseContext, commentaryContext } = parseResult.data;

      const cached = await storage.getCachedWordTranslation(word, sourceLanguage, targetLanguage);
      if (cached) {
        return res.json({
          word: cached.word,
          translation: cached.translation,
          grammaticalInfo: cached.grammaticalInfo,
          etymology: cached.etymology,
          contextualMeaning: cached.contextualMeaning,
          cached: true,
        });
      }

      const result = await translateWord(
        word,
        sourceLanguage,
        targetLanguage,
        verseContext || "",
        commentaryContext || ""
      );

      await storage.cacheWordTranslation({
        word: result.word,
        sourceLanguage,
        targetLanguage,
        translation: result.translation,
        grammaticalInfo: result.grammaticalInfo,
        etymology: result.etymology,
        contextualMeaning: result.contextualMeaning,
        verseContext: verseContext || null,
      });

      res.json({
        ...result,
        cached: false,
      });
    } catch (error) {
      console.error("Error translating word:", error);
      res.status(500).json({ error: "Failed to translate word" });
    }
  });

  app.get("/api/verses/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const notes = await storage.getNotesByVerseAndUser(req.params.id, userId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/verses/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ content: z.string().min(1).max(5000), selectedText: z.string().max(2000).optional() });
      const { content, selectedText } = schema.parse(req.body);
      const note = await storage.createNote({
        userId,
        verseId: req.params.id,
        content,
        selectedText: selectedText || null,
      });
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ content: z.string().min(1).max(5000) });
      const { content } = schema.parse(req.body);
      const note = await storage.updateNote(req.params.id, userId, content);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.patch("/api/user/preferred-language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { language } = req.body;
      if (!language || typeof language !== "string") {
        return res.status(400).json({ error: "Language code is required" });
      }
      await authStorage.updateUserPreferredLanguage(userId, language);
      res.json({ success: true, language });
    } catch (error) {
      console.error("Error updating preferred language:", error);
      res.status(500).json({ error: "Failed to update preferred language" });
    }
  });

  app.patch("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { preferredLanguage, preferredAuthor, preferredTheme } = req.body;
      const validThemes = ["light", "dark"];
      if (preferredTheme !== undefined && preferredTheme !== null && !validThemes.includes(preferredTheme)) {
        return res.status(400).json({ error: "Invalid theme value" });
      }
      await authStorage.updateUserPreferences(userId, {
        preferredLanguage: preferredLanguage !== undefined ? (preferredLanguage || null) : undefined,
        preferredAuthor: preferredAuthor !== undefined ? (preferredAuthor || null) : undefined,
        preferredTheme: preferredTheme !== undefined ? (preferredTheme || null) : undefined,
      });
      const updatedUser = await authStorage.getUser(userId);
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const deleted = await storage.deleteNote(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });


  app.post("/api/gemini/translate-text", async (req, res) => {
    try {
      const { content, sourceLanguage, targetLanguage } = req.body;
      if (!content || typeof content !== "string" || !targetLanguage || typeof targetLanguage !== "string") {
        return res.status(400).json({ error: "content and targetLanguage are required" });
      }
      if (sourceLanguage && typeof sourceLanguage !== "string") {
        return res.status(400).json({ error: "sourceLanguage must be a string" });
      }
      if (content.length > 50000) {
        return res.status(400).json({ error: "Content too long. Maximum 50,000 characters." });
      }
      const translated = await translateTextChunked(content, targetLanguage, sourceLanguage || undefined);
      res.json({ translated });
    } catch (error: any) {
      console.error("Gemini text translation error:", error);
      res.status(500).json({ error: error.message || "Translation failed" });
    }
  });

  app.post("/api/gemini/translate-bhashyam", async (req, res) => {
    try {
      const { content, sourceLanguage } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "content is required" });
      }
      if (!sourceLanguage || typeof sourceLanguage !== "string") {
        return res.status(400).json({ error: "sourceLanguage is required" });
      }
      if (content.length > 50000) {
        return res.status(400).json({ error: "Content too long. Maximum 50,000 characters." });
      }
      const translated = await translateBhashyam(content, sourceLanguage);
      res.json({ translated });
    } catch (error: any) {
      console.error("Gemini bhashyam translation error:", error);
      res.status(500).json({ error: error.message || "Bhashyam translation failed" });
    }
  });

  app.post("/api/gemini/transliterate-text", async (req, res) => {
    try {
      const { content, sourceLanguage, targetLanguage } = req.body;
      if (!content || typeof content !== "string" || !targetLanguage || typeof targetLanguage !== "string") {
        return res.status(400).json({ error: "content and targetLanguage are required" });
      }
      if (sourceLanguage && typeof sourceLanguage !== "string") {
        return res.status(400).json({ error: "sourceLanguage must be a string" });
      }
      if (content.length > 50000) {
        return res.status(400).json({ error: "Content too long. Maximum 50,000 characters." });
      }
      const transliterated = await transliterateTextChunked(content, targetLanguage, sourceLanguage || undefined);
      res.json({ transliterated });
    } catch (error: any) {
      console.error("Gemini transliteration error:", error);
      res.status(500).json({ error: error.message || "Transliteration failed" });
    }
  });

  app.post("/api/gemini/translate-image", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const targetLanguage = req.body.targetLanguage;
      if (!file || !targetLanguage) {
        return res.status(400).json({ error: "file and targetLanguage are required" });
      }
      const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Unsupported file type. Use PNG, JPEG, WebP, GIF, or PDF." });
      }

      if (file.mimetype === "application/pdf") {
        const pages = await translatePdf(file.buffer, targetLanguage);
        res.json({ type: "pdf", pages });
      } else {
        const result = await translateImage(file.buffer, file.mimetype, targetLanguage);
        res.json({ type: "image", ...result });
      }
    } catch (error: any) {
      console.error("Gemini image translation error:", error);
      res.status(500).json({ error: error.message || "Image translation failed" });
    }
  });

  app.post("/api/translate/grantha/:granthaId", async (req, res) => {
    try {
      const { granthaId } = req.params;
      const { languages } = req.body || {};
      const targetLangs = Array.isArray(languages) && languages.length > 0
        ? languages.filter((l: string) => !SKIP_TRANSLATE.has(l))
        : undefined;

      const progress = await startTranslationJob(granthaId, targetLangs);
      res.json(progress);
    } catch (error: any) {
      console.error("Translation job start error:", error);
      res.status(500).json({ error: error.message || "Failed to start translation job" });
    }
  });

  app.get("/api/translate/grantha/:granthaId/status", async (req, res) => {
    const progress = getTranslationProgress(req.params.granthaId);
    if (!progress) {
      return res.status(404).json({ error: "No translation job found for this grantha" });
    }
    res.json(progress);
  });

  app.get("/api/translate/jobs", async (_req, res) => {
    res.json(getAllTranslationJobs());
  });

  app.get("/api/translate/languages", async (_req, res) => {
    res.json({
      all: STRAPI_LANGUAGES,
      skipped: Array.from(SKIP_TRANSLATE),
      translatable: STRAPI_LANGUAGES.filter(l => !SKIP_TRANSLATE.has(l)),
    });
  });

  return httpServer;
}
