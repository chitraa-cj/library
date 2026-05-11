import "./bootstrap-env";

process.on("SIGHUP", () => {
  console.log("Received SIGHUP, ignoring (keeping server alive)");
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase, seedAdditionalCommentaries, updateIncompleteShankaraExplanations, seedEnglishVerseTranslations, seedSouthIndianVerseTranslations, updateVerseSectionTitles, updateIshaUpanishadHierarchy, syncAuthoritativeCommentaryData, cleanupDuplicateTranslations, fixIncompleteTranslations } from "./seed";
import { seedBhagavadGita, repairGitaSectionTitles } from "./seed-gita";
import { seedWordMeaningsFromFile } from "./seed-word-meanings-local";
import { seedKathaUpanishad } from "./seed-katha-upanishad";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { importTranslationDataFromFiles } from "./import-translation-data";
import { syncSouthIndianBhashya } from "./sync-south-indian-bhashya";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await setupAuth(app);
  registerAuthRoutes(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const explicitPort = process.env.PORT?.trim();
  const basePort = parseInt(
    explicitPort || (process.env.NODE_ENV === "development" ? "5050" : "8080"),
    10,
  );
  const pinPort = Boolean(explicitPort);
  const maxDevPortSkips = 40;

  const bind = (port: number): void => {
    const onError = (err: NodeJS.ErrnoException) => {
      httpServer.removeListener("error", onError);
      if (
        err.code === "EADDRINUSE" &&
        !pinPort &&
        process.env.NODE_ENV === "development" &&
        port - basePort < maxDevPortSkips
      ) {
        log(`port ${port} in use, trying ${port + 1}…`);
        bind(port + 1);
        return;
      }
      if (err.code === "EADDRINUSE") {
        console.error(
          `[express] Port ${port} is already in use.${pinPort ? " Change PORT in .env." : " Set PORT in .env to pin a free port."} On macOS, AirPlay Receiver may use 5000 (System Settings → AirDrop & Handoff).`,
        );
      } else {
        console.error("[express] HTTP server error:", err);
      }
      process.exit(1);
    };
    httpServer.once("error", onError);
    httpServer.listen(port, "0.0.0.0", () => {
      httpServer.removeListener("error", onError);
      log(`serving on port ${port}`);
      runSeedOperations();
    });
  };

  bind(basePort);
})();

let seedOperationsStarted = false;

async function runSeedOperations() {
  if (seedOperationsStarted) {
    console.warn("[express] runSeedOperations() already invoked in this process — skipping duplicate call.");
    return;
  }
  seedOperationsStarted = true;
  try {
    await seedDatabase().catch(console.error);
    await seedAdditionalCommentaries().catch(console.error);
    await updateIncompleteShankaraExplanations().catch(console.error);
    await syncAuthoritativeCommentaryData().catch(console.error);
    await seedEnglishVerseTranslations().catch(console.error);
    await seedSouthIndianVerseTranslations().catch(console.error);
    await updateVerseSectionTitles().catch(console.error);
    await updateIshaUpanishadHierarchy().catch(console.error);
    await seedBhagavadGita().catch(console.error);
    await repairGitaSectionTitles().catch(console.error);
    await seedWordMeaningsFromFile().catch(console.error);
    await seedKathaUpanishad().catch(console.error);
    await cleanupDuplicateTranslations().catch(console.error);
    await fixIncompleteTranslations().catch(console.error);
    log("All seed operations completed");
    await importTranslationDataFromFiles().catch(err => console.error("Translation data import error:", err));
    await syncSouthIndianBhashya().catch(err => console.error("South Indian bhashya sync error:", err));
    prewarmAllBookCaches().catch(err => console.error("Pre-warm error:", err));
  } catch (err) {
    console.error("Seed operations failed:", err);
  }
}

async function prewarmAllBookCaches() {
  if (!process.env.STRAPI_URL || !process.env.STRAPI_API_TOKEN) return;
  try {
    const { strapiGetAllBooks, strapiGetBookById } = await import("./strapi");
    const books = await strapiGetAllBooks();
    log(`[Pre-warm] Loading ${books.length} granthas into cache...`);
    let done = 0;
    const CONCURRENCY = 3;
    let nextIdx = 0;
    async function worker() {
      while (true) {
        const i = nextIdx++;
        if (i >= books.length) return;
        const book = books[i];
        try {
          await strapiGetBookById(book.id);
          done++;
          log(`[Pre-warm] (${done}/${books.length}) ${book.title}`);
        } catch (e: any) {
          log(`[Pre-warm] failed ${book.title}: ${e.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    log(`[Pre-warm] All ${done} granthas cached and ready.`);
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error };
    const detail = err?.cause?.message || err?.message || String(e);
    log(`[Pre-warm] Skipped: ${detail}`);
  }
}
