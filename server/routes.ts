import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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

  app.get("/api/languages", async (req, res) => {
    try {
      const languages = await storage.getAllLanguages();
      res.json(languages);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ error: "Failed to fetch languages" });
    }
  });

  return httpServer;
}
