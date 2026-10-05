import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAcharyaRoutes } from "./acharyas";
import { STRAPI_REPLACES_LOCAL } from "./strapi-merge-policy";
import { testStrapiConnection, STRAPI_URL, invalidateBookCache, invalidateAllStrapiCaches, strapiGetVerseById, strapiGetBookVideos, invalidateVideoResourceCache } from "./strapi";
import {
  applyCacheInvalidation,
  isWebhookAuthorized,
  resolveCacheInvalidationFromWebhook,
} from "./strapi-webhook";
import { translateWord } from "./openai";
import { translateWordRequestSchema } from "@shared/schema";
import type { BookWithVerseMeta, VerseMeta } from "@shared/schema";
import { runInteractive } from "./fetch-priority";
import { encodeBookIndex } from "@shared/book-index-codec";
import { incr, observe, renderPrometheus, routeLabel, snapshot, setGauge } from "./observability";
import { rateLimit, concurrencyLimit, RATE_LIMITS, clientKey, rateLimiterStats } from "./resilience";
import { fetchPriorityStats } from "./fetch-priority";
import { cmsCircuitState } from "./strapi";
import { contentCacheStatus } from "./content-cache";
import { sendCached, invalidatePrecompressed, precompressedStats } from "./precompressed";
import { isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { z } from "zod";
import multer from "multer";
import { translateTextChunked, translateImage, translatePdf, transliterateTextChunked, translateBhashyam } from "./gemini";
import { startTranslationJob, getTranslationProgress, getAllTranslationJobs, queueTranslationJob, getQueueStatus, cancelTranslationJob, restoreQueueFromFile, queueAllGranthas, fetchAllGranthaIds, STRAPI_LANGUAGES, SKIP_TRANSLATE } from "./strapi-translate";
import { queueTransliteration, getTransliterationProgress, transliterateSanskrit, ALL_LANGUAGES as TRANSLIT_LANGUAGES } from "./strapi-transliterate";
import { startPublishGrantha, startPublishSection, startPublishManthra, getPublishProgress, getAllPublishJobs, cancelPublishJob } from "./strapi-publish";

function getUserId(req: any): string {
  if (req.session?.emailUserId) {
    return req.session.emailUserId;
  }
  return req.user?.claims?.sub;
}

function isStrapiCacheSecretValid(req: Request): boolean {
  const secret = (process.env.STRAPI_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return true;
  const header = req.headers["x-strapi-webhook-secret"] ?? req.headers["x-webhook-secret"];
  const provided =
    (typeof header === "string" ? header : header?.[0]) ??
    (typeof req.body === "object" && req.body && "secret" in req.body
      ? String((req.body as { secret?: string }).secret)
      : "");
  return provided === secret;
}

function setContentApiCacheHeaders(res: import("express").Response): void {
  // Scripture content (books, verses, bhashya/teeka, commentary options) is
  // public and changes rarely; the CMS webhook clears the server-side cache on
  // edits. Allow the browser/CDN to serve it for a few minutes and revalidate in
  // the background, so repeat reads and back/forward navigation don't re-fetch
  // heavy commentary payloads. Override with CONTENT_CACHE_MAX_AGE (seconds).
  const maxAge = Math.max(0, Number(process.env.CONTENT_CACHE_MAX_AGE || 300));
  res.setHeader(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=86400`,
  );
}

/**
 * Read paths that a reader is actively waiting on. Requests to these are marked
 * interactive so the CMS warm-up (and any stale-while-revalidate refresh) backs
 * off for their duration instead of queueing ahead of them.
 */
const INTERACTIVE_CONTENT_PATH = /^\/(books|verses|acharyas|languages|authors)(\/|$)/;

/**
 * First thing a reader needs when a grantha opens.
 *
 * The hint may be a manthra documentId (`?verse=`) or a position (`?verseNumber=`,
 * which is what the reader's URLs carry). Either way an unrecognised hint falls
 * back to the opening verse rather than failing — a stale bookmark should still
 * open the text.
 */
function pickBootstrapVerse(
  book: BookWithVerseMeta,
  requestedVerseId: string | undefined,
  requestedVerseNumber: number | undefined,
): VerseMeta | null {
  const verses = book.verses || [];
  if (verses.length === 0) return null;
  if (requestedVerseId) {
    const hinted = verses.find((v) => v.id === requestedVerseId);
    if (hinted) return hinted;
  }
  if (requestedVerseNumber !== undefined) {
    const hinted = verses.find((v) => v.verseNumber === requestedVerseNumber);
    if (hinted) return hinted;
  }
  return verses[0];
}

/**
 * Resolves to the promise's value, or to `null` if it takes longer than `ms`.
 * The work keeps running and lands in the server-side cache, so the client's
 * own follow-up request for the same thing is served from memory. Used to keep
 * a slow secondary payload from holding back the content a reader is staring at.
 */
function withBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  if (!(ms > 0)) return promise.catch(() => null);
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Observability: times every API request, labelled by collapsed route. ---
  app.use("/api", (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.once("finish", () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const route = routeLabel(req.method, req.path);
      observe("ssh_http_request_ms", ms, { route });
      incr("ssh_http_requests_total", {
        route,
        status: `${Math.floor(res.statusCode / 100)}xx`,
      });
      if (res.statusCode === 304) incr("ssh_http_not_modified_total", { route });
    });
    next();
  });

  setGauge("ssh_rate_limit_buckets", () => rateLimiterStats().buckets);
  setGauge("ssh_precompress_entries", () => precompressedStats().entries);
  setGauge("ssh_precompress_bytes", () => precompressedStats().bytes);
  setGauge("ssh_interactive_demand", () => fetchPriorityStats().interactiveDemand);
  setGauge("ssh_background_inflight", () => fetchPriorityStats().backgroundInFlight);
  setGauge("ssh_background_waiting", () => fetchPriorityStats().backgroundWaiting);

  /**
   * Metrics. Not public: without a token it is reachable only from the box
   * itself, which is what a local Prometheus/node_exporter sidecar needs.
   */
  app.get("/api/metrics", (req, res) => {
    const token = (process.env.METRICS_TOKEN ?? "").trim();
    const provided = req.headers["x-metrics-token"];
    const fromLocalhost = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress ?? "",
    );
    const authorised = token ? provided === token : fromLocalhost;
    if (!authorised) return res.status(404).end();

    res.setHeader("Cache-Control", "no-store");
    if (req.query.format === "json") return res.json(snapshot());
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(renderPrometheus());
  });

  // --- Rate limiting. Reading is generous; expensive work is tight. ---
  // Applied per path class rather than globally so that a burst of page flips
  // (which is what a fast reader with prefetching looks like) is never limited,
  // while AI translation and CMS publish jobs are.
  const EXPENSIVE_PREFIXES = [
    "/api/translate",
    "/api/translate-word",
    "/api/gemini",
    "/api/transliterate",
    "/api/strapi/publish",
  ];
  const expensiveLimiter = rateLimit(RATE_LIMITS.expensive);
  const expensiveConcurrency = concurrencyLimit({
    name: "expensive",
    max: Number(process.env.EXPENSIVE_MAX_CONCURRENCY || 4),
    retryAfterSeconds: 5,
  });
  app.use((req, res, next) => {
    if (!EXPENSIVE_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();
    expensiveLimiter(req, res, () => expensiveConcurrency(req, res, next));
  });

  const contentLimiter = rateLimit(RATE_LIMITS.content);
  app.use("/api", (req, res, next) => {
    if (req.method !== "GET" || !INTERACTIVE_CONTENT_PATH.test(req.path)) return next();
    contentLimiter(req, res, next);
  });

  // Must be registered before the content routes below so it wraps them.
  app.use("/api", (req, res, next) => {
    if (req.method !== "GET" || !INTERACTIVE_CONTENT_PATH.test(req.path)) return next();
    void runInteractive(
      () =>
        new Promise<void>((resolve) => {
          // Resolve on finish *or* close so an aborted request (reader navigated
          // away) releases the gate instead of pinning it open.
          res.once("finish", resolve);
          res.once("close", resolve);
          next();
        }),
    );
  });

  setTimeout(() => restoreQueueFromFile(), 5000);

  // Liveness: the process is up. Must stay trivial — a load balancer hitting a
  // health check that touches the CMS or DB turns a dependency blip into every
  // instance being marked unhealthy at once.
  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send("OK");
  });

  /**
   * Readiness: can this instance serve content? Reports the CMS circuit state
   * for visibility but stays ready while it is open, because the caches can
   * still answer — an instance that marks itself unready during a CMS blip
   * removes capacity exactly when it is needed most.
   */
  app.get("/api/ready", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ready: true,
      cms: cmsCircuitState(),
      cache: contentCacheStatus(),
    });
  });

  // Read-only acharya (guru-parampara) profiles, sourced from the CMS database.
  registerAcharyaRoutes(app);

  app.get("/api/books", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      await sendCached(req, res, "books:list", async () => {
      const books = await storage.getAllBooks();
      const isLocalDb = (b: any) => typeof b.id === 'string' && b.id.includes('-') && b.id.length > 30;
      const presentIds = new Set(books.map(b => b.id as string));
      const hideLocalIds = new Set<string>();
      for (const { strapiDocId, localPgSlug } of STRAPI_REPLACES_LOCAL) {
        if (!presentIds.has(strapiDocId)) continue;
        for (const b of books) {
          if (isLocalDb(b) && b.slug === localPgSlug) {
            hideLocalIds.add(b.id as string);
          }
        }
      }
      const localBooks = books.filter(b => isLocalDb(b) && !hideLocalIds.has(b.id as string));
      const strapiBooks = books.filter(b => !isLocalDb(b));
      return [...localBooks, ...strapiBooks];
      });
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
      setContentApiCacheHeaders(res);
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

  /**
   * The verse index in the compact wire format (see shared/book-index-codec.ts).
   * This is what the reader actually fetches to open a grantha; `/api/books/:id`
   * keeps returning the verbose shape for any other consumer.
   *
   * Previews are excluded — they are sidebar snippets, not page content, so they
   * must not sit on the critical path. Fetch them from `/previews` instead.
   */
  app.get("/api/books/:id/index", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      const withPreviews = req.query.previews === "1";
      await sendCached(req, res, `index:${req.params.id}:${withPreviews ? "p" : "n"}`, async () => {
        const book = await storage.getBookWithVerseMeta(req.params.id);
        if (!book) return null;
        return encodeBookIndex(book, { includePreviews: withPreviews });
      });
    } catch (error) {
      console.error("Error fetching book index:", error);
      res.status(500).json({ error: "Failed to fetch book index" });
    }
  });

  /** Sidebar snippets, keyed by verse id. Secondary content, fetched at low priority. */
  app.get("/api/books/:id/previews", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      await sendCached(req, res, `previews:${req.params.id}`, async () => {
        const book = await storage.getBookWithVerseMeta(req.params.id);
        if (!book) return null;
        const previews: Record<string, string> = {};
        for (const verse of book.verses) {
          if (verse.preview) previews[verse.id] = verse.preview;
        }
        return previews;
      });
    } catch (error) {
      console.error("Error fetching previews:", error);
      res.json({});
    }
  });

  app.get("/api/verses/:id", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      await sendCached(req, res, `verse:${req.params.id}`, () => storage.getVerseById(req.params.id));
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
      setContentApiCacheHeaders(res);
      const explanations = await storage.getExplanationsByVerseId(req.params.id);
      res.json(explanations);
    } catch (error) {
      console.error("Error fetching explanations:", error);
      res.status(500).json({ error: "Failed to fetch explanations" });
    }
  });

  app.get("/api/books/:id/chapter/:adhyayNumber/verses", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
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

  /**
   * Everything the reader needs to paint a grantha, in one round trip:
   * the verse index, the opening verse's full content, and (when it is ready in
   * time) the commentary options.
   *
   * Previously the client had to fetch the book index, wait for it to learn the
   * first verse's id, and only then fetch the verse — two serial CMS-backed
   * round-trips before a single word appeared. `?verse=` lets the client ask for
   * the position it is actually restoring to (e.g. "resume study") so the first
   * paint is the right verse rather than verse 1.
   */
  app.get("/api/books/:id/bootstrap", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      const bookId = req.params.id;
      const requestedVerseId =
        typeof req.query.verse === "string" && req.query.verse ? req.query.verse : undefined;
      const parsedVerseNumber = Number(req.query.verseNumber);
      const requestedVerseNumber = Number.isFinite(parsedVerseNumber)
        ? parsedVerseNumber
        : undefined;

      // Keyed on the request, not on the resolved verse, so a repeat request is
      // answered from the pre-compressed cache without doing any of the work
      // below. (Keying it on the resolved verse meant the work ran first and the
      // cache could never help: measured 1.5s on every bootstrap.)
      const cacheKey = `bootstrap:${bookId}:${requestedVerseId ?? requestedVerseNumber ?? "first"}`;

      await sendCached(req, res, cacheKey, async () => {
        const book = await storage.getBookWithVerseMeta(bookId);
        if (!book) return null;

        const target = pickBootstrapVerse(book, requestedVerseId, requestedVerseNumber);
        const optionsBudgetMs = Number(process.env.BOOTSTRAP_OPTIONS_BUDGET_MS || 1500);
        // The verse is the content, so it is worth waiting for — but not
        // unboundedly. If the CMS is stalling and this verse isn't cached,
        // return the index now (the TOC and navigation render) and let the
        // client's own verse request supply the text, rather than holding the
        // whole grantha open behind a 120s CMS timeout.
        const verseBudgetMs = Number(process.env.BOOTSTRAP_VERSE_BUDGET_MS || 2500);

        const [verse, commentaryOptions] = await Promise.all([
          target
            ? withBudget(storage.getVerseById(target.id).then((v) => v ?? null), verseBudgetMs)
            : Promise.resolve(null),
          withBudget(storage.getCommentaryOptionsByBookId(bookId), optionsBudgetMs),
        ]);

        return {
          // Compact form, previews excluded: see shared/book-index-codec.ts. On
          // Panchadasi this is 31KB brotli instead of 133KB gzip.
          bookIndex: encodeBookIndex(book, { includePreviews: false }),
          verseId: target?.id ?? null,
          verse,
          // null means "not ready yet, ask separately" — never "none exist".
          commentaryOptions,
        };
      });
    } catch (error) {
      console.error("Error bootstrapping book:", error);
      res.status(500).json({ error: "Failed to bootstrap book" });
    }
  });

  app.get("/api/books/:id/commentary-options", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      await sendCached(req, res, `options:${req.params.id}`, () =>
        storage.getCommentaryOptionsByBookId(req.params.id),
      );
    } catch (error) {
      console.error("Error fetching commentary options:", error);
      res.status(500).json({ error: "Failed to fetch commentary options" });
    }
  });

  /**
   * Teaching videos for a grantha, grouped by verse. One small request per
   * grantha warms every mantra's video, so flipping pages never costs a fetch.
   */
  app.get("/api/books/:id/videos", async (req, res) => {
    try {
      setContentApiCacheHeaders(res);
      await sendCached(req, res, `videos:${req.params.id}`, () => strapiGetBookVideos(req.params.id));
    } catch (error) {
      console.error("Error fetching book videos:", error);
      // Videos are an enhancement — never fail the reader over them.
      res.json({ byVerseId: {}, book: [] });
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

  app.patch("/api/user/preferred-font-scale", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { scale } = req.body;
      const numeric = typeof scale === "number" ? scale : parseFloat(scale);
      if (!Number.isFinite(numeric) || numeric < 0.5 || numeric > 3) {
        return res.status(400).json({ error: "A valid font scale is required" });
      }
      // Snap to one decimal and store as a short string (e.g. "1.1").
      const value = String(Math.round(numeric * 10) / 10);
      await authStorage.updateUserPreferredFontScale(userId, value);
      res.json({ success: true, scale: value });
    } catch (error) {
      console.error("Error updating preferred font scale:", error);
      res.status(500).json({ error: "Failed to update preferred font scale" });
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

  app.get("/api/progress/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const summary = await storage.getProgressSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching progress summary:", error);
      res.status(500).json({ error: "Failed to fetch progress summary" });
    }
  });

  app.get("/api/progress/book/:bookId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const completedVerseIds = await storage.getCompletedVerseIdsForBook(userId, req.params.bookId);
      res.json({ completedVerseIds });
    } catch (error) {
      console.error("Error fetching book progress:", error);
      res.status(500).json({ error: "Failed to fetch book progress" });
    }
  });

  app.post("/api/progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ bookId: z.string().min(1), verseId: z.string().min(1) });
      const { bookId, verseId } = schema.parse(req.body);
      const row = await storage.markVerseComplete(userId, bookId, verseId);
      res.status(201).json(row);
    } catch (error) {
      console.error("Error marking verse complete:", error);
      res.status(500).json({ error: "Failed to mark verse complete" });
    }
  });

  app.delete("/api/progress/:verseId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const ok = await storage.unmarkVerseComplete(userId, req.params.verseId);
      res.json({ success: ok });
    } catch (error) {
      console.error("Error unmarking verse complete:", error);
      res.status(500).json({ error: "Failed to unmark verse complete" });
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

  app.post("/api/translate/queue", async (req, res) => {
    try {
      const { granthaIds } = req.body || {};
      if (!Array.isArray(granthaIds) || granthaIds.length === 0) {
        return res.status(400).json({ error: "granthaIds array required" });
      }
      for (const id of granthaIds) {
        queueTranslationJob(id);
      }
      res.json({ queued: granthaIds, queueStatus: getQueueStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/translate/queue/all", async (_req, res) => {
    try {
      const result = await queueAllGranthas();
      res.json({ message: `Queued ${result.total} granthas for translation`, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/translate/queue/status", async (_req, res) => {
    const status = getQueueStatus();
    const allJobs = getAllTranslationJobs();
    res.json({ ...status, jobs: allJobs });
  });

  app.post("/api/translate/cancel", async (req, res) => {
    try {
      const { granthaId } = req.body || {};
      if (!granthaId) {
        return res.status(400).json({ error: "granthaId required" });
      }
      const cancelled = cancelTranslationJob(granthaId);
      res.json({ cancelled, granthaId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/translate/languages", async (_req, res) => {
    res.json({
      all: STRAPI_LANGUAGES,
      skipped: Array.from(SKIP_TRANSLATE),
      translatable: STRAPI_LANGUAGES.filter(l => !SKIP_TRANSLATE.has(l)),
    });
  });

  // ===== Strapi per-manthra publish =====
  // Avoids the bulk-publish nginx 504 timeout by publishing each manthra
  // individually via Strapi's actions/publish endpoint (which only flips
  // status — never touches field data, so no translations are overridden).

  app.post("/api/strapi/publish/grantha", async (req, res) => {
    try {
      const { granthaId } = req.body || {};
      if (!granthaId) return res.status(400).json({ error: "granthaId required" });
      const progress = await startPublishGrantha(granthaId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strapi/publish/section", async (req, res) => {
    try {
      const { sectionDocId } = req.body || {};
      if (!sectionDocId) return res.status(400).json({ error: "sectionDocId required" });
      const progress = await startPublishSection(sectionDocId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strapi/publish/manthra", async (req, res) => {
    try {
      const { manthraDocId } = req.body || {};
      if (!manthraDocId) return res.status(400).json({ error: "manthraDocId required" });
      const progress = await startPublishManthra(manthraDocId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/strapi/publish/status", async (req, res) => {
    const { jobId } = req.query as { jobId?: string };
    if (jobId) {
      const p = getPublishProgress(jobId);
      if (!p) return res.status(404).json({ error: "Job not found" });
      return res.json(p);
    }
    res.json({ jobs: getAllPublishJobs() });
  });

  // Strapi CMS webhook: call on entry publish/update/delete to refresh site content immediately.
  // In Strapi Admin → Settings → Webhooks, point to POST /api/strapi/webhook and set the same secret as STRAPI_WEBHOOK_SECRET.
  app.post("/api/strapi/webhook", async (req, res) => {
    try {
      if (!isWebhookAuthorized(req.headers, req.body)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const webhookModel = String(
        (req.body as any)?.model ?? (req.body as any)?.uid ?? (req.body as any)?.contentType ?? "",
      ).toLowerCase();
      if (webhookModel.includes("video")) {
        invalidateVideoResourceCache();
        invalidatePrecompressed("videos:");
        return res.json({ ok: true, invalidated: ["video-resources"] });
      }

      let target = resolveCacheInvalidationFromWebhook(req.body);
      if (target.verseId && !target.bookId) {
        const verse = await strapiGetVerseById(target.verseId);
        if (verse?.bookId) {
          target = { ...target, bookId: verse.bookId };
        }
      }

      const { invalidated } = applyCacheInvalidation(target);
      // Compressed bodies are derived from the caches just cleared, so they must
      // go too or the webhook would appear to have had no effect.
      invalidatePrecompressed();
      if (invalidated.length === 0) {
        console.log("[Strapi webhook] No cache target resolved; payload keys:", Object.keys(req.body || {}));
      }

      res.json({ ok: true, invalidated });
    } catch (error: any) {
      console.error("[Strapi webhook] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear the in-memory Strapi cache for a single book/grantha so freshly-edited
  // CMS data shows up on the site without waiting for the cache TTL.
  app.post("/api/strapi/cache/invalidate", async (req, res) => {
    try {
      if (!isStrapiCacheSecretValid(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { bookId, all } = req.body || {};
      if (all) {
        invalidateAllStrapiCaches();
        invalidatePrecompressed();
        return res.json({ invalidated: true, all: true });
      }
      if (!bookId) return res.status(400).json({ error: "bookId required (or all: true)" });
      invalidateBookCache(bookId);
      invalidatePrecompressed();
      res.json({ invalidated: true, bookId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/strapi/publish/cancel", async (req, res) => {
    try {
      const { jobId } = req.body || {};
      if (!jobId) return res.status(400).json({ error: "jobId required" });
      const cancelled = cancelPublishJob(jobId);
      res.json({ cancelled, jobId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transliterate/queue", async (req, res) => {
    try {
      const { granthaIds } = req.body || {};
      if (!Array.isArray(granthaIds) || granthaIds.length === 0) {
        return res.status(400).json({ error: "granthaIds array required" });
      }
      const result = queueTransliteration(granthaIds);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/transliterate/progress", async (_req, res) => {
    res.json(getTransliterationProgress());
  });

  app.post("/api/transliterate/preview", async (req, res) => {
    try {
      const { text, language } = req.body || {};
      if (!text || !language) {
        return res.status(400).json({ error: "text and language required" });
      }
      const result = transliterateSanskrit(text, language);
      res.json({ original: text, language, transliteration: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
