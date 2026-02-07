import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { testStrapiConnection, STRAPI_URL } from "./strapi";
import { translateWord } from "./openai";
import { translateWordRequestSchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";

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
  
  app.get("/api/books", async (req, res) => {
    try {
      const books = await storage.getAllBooks();
      res.json(books);
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
      const book = await storage.getBookById(req.params.id);
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
      const schema = z.object({ content: z.string().min(1).max(5000) });
      const { content } = schema.parse(req.body);
      const note = await storage.createNote({
        userId,
        verseId: req.params.id,
        content,
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

  return httpServer;
}
