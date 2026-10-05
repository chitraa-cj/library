import "./bootstrap-env";

process.on("SIGHUP", () => {
  console.log("Received SIGHUP, ignoring (keeping server alive)");
});

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
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
import { ensureCanonicalLocalBooks } from "./ensure-canonical-books";
import { repairUserTableForeignKeys, ensureAuthSchema } from "./repair-schema";
import { rateLimit, RATE_LIMITS } from "./resilience";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Gzip every text-based response (the ~1.3MB JS bundle, CSS, and JSON API
// payloads). Bundles and translation JSON compress ~4-8x, which is the single
// biggest transfer-size win for both first load and API responses. Runs first
// so it wraps every downstream handler, including express.static.
app.use(compression());

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
  // Must run before the auth routes are reachable: a deployed DB missing a
  // column declared in shared/models/auth.ts fails every user query with 42703.
  await ensureAuthSchema();
  await setupAuth(app);
  // Credential endpoints are the classic brute-force target, and they are the
  // one part of the API that cannot be absorbed by a cache.
  const authLimiter = rateLimit(RATE_LIMITS.auth);
  app.use((req, res, next) => {
    const p = req.path;
    const isAuthAttempt =
      req.method === "POST" &&
      (p.startsWith("/api/login") || p.startsWith("/api/register") ||
       p.startsWith("/api/auth") || p.includes("/password"));
    if (!isAuthAttempt) return next();
    authLimiter(req, res, next);
  });
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
      installGracefulShutdown();
      // Seeding hits Postgres and the warm-up hits the CMS, so they don't
      // contend. Previously the warm-up waited for every seed step to finish,
      // which left the reader on cold caches for the first several minutes
      // after a deploy — exactly when the content caches matter most.
      runSeedOperations();
      prewarmAllBookCaches().catch(err => console.error("Pre-warm error:", err));
    });
  };

  bind(basePort);
})();

/**
 * Rolling deploys need the old process to drain rather than drop connections,
 * and a health check must not go green before the server can actually serve.
 */
function installGracefulShutdown(): void {
  let shuttingDown = false;
  const drainMs = Math.max(0, Number(process.env.SHUTDOWN_DRAIN_MS || 10000));

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received — draining connections (max ${drainMs}ms)`);
    // Stop accepting new connections; in-flight requests finish normally.
    httpServer.close(() => {
      log("drained cleanly, exiting");
      process.exit(0);
    });
    const timer = setTimeout(() => {
      log("drain timeout — exiting anyway");
      process.exit(0);
    }, drainMs);
    timer.unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

let seedOperationsStarted = false;

async function runSeedOperations() {
  // Seeding is idempotent but slow, and it is pure setup work — not needed to
  // serve a single read. Skipping it lets a replacement instance come up in
  // seconds (and makes load testing measure the serving path, not seeding).
  if (process.env.SKIP_SEED_OPERATIONS === "1") {
    log("[express] SKIP_SEED_OPERATIONS=1 — skipping seed/migration pass");
    return;
  }
  if (seedOperationsStarted) {
    console.warn("[express] runSeedOperations() already invoked in this process — skipping duplicate call.");
    return;
  }
  seedOperationsStarted = true;
  try {
    await repairUserTableForeignKeys().catch(console.error);
    await seedDatabase().catch(console.error);
    await seedAdditionalCommentaries().catch(console.error);
    await updateIncompleteShankaraExplanations().catch(console.error);
    await syncAuthoritativeCommentaryData().catch(console.error);
    await seedEnglishVerseTranslations().catch(console.error);
    await seedSouthIndianVerseTranslations().catch(console.error);
    await updateVerseSectionTitles().catch(console.error);
    await updateIshaUpanishadHierarchy().catch(console.error);
    await seedBhagavadGita().catch(console.error);
    await ensureCanonicalLocalBooks().catch(console.error);
    await repairGitaSectionTitles().catch(console.error);
    await seedWordMeaningsFromFile().catch(console.error);
    await seedKathaUpanishad().catch(console.error);
    await cleanupDuplicateTranslations().catch(console.error);
    await fixIncompleteTranslations().catch(console.error);
    log("All seed operations completed");
    await importTranslationDataFromFiles().catch(err => console.error("Translation data import error:", err));
    await syncSouthIndianBhashya().catch(err => console.error("South Indian bhashya sync error:", err));
  } catch (err) {
    console.error("Seed operations failed:", err);
  }
}

/**
 * Warms the CMS-derived content caches, newest-first across two phases.
 *
 * Phase 1 warms exactly what opening a grantha needs — the verse index, the
 * commentary options and the opening verse — for every grantha, so the slowest
 * thing a reader can do (open a text nobody has opened since the last deploy)
 * is fast across the whole library quickly. Phase 2 then fills in the full
 * hydration that chapter view and the commentary-options fallback rely on.
 *
 * All of it runs at background priority: every outbound CMS fetch yields while
 * a reader has a request outstanding (see server/fetch-priority.ts), so warming
 * can never be the reason a page is slow.
 */
async function prewarmAllBookCaches() {
  if (!process.env.STRAPI_URL || !process.env.STRAPI_API_TOKEN) return;
  // Worth disabling on extra instances behind a warm shared cache, and in load
  // tests where it would otherwise compete with the traffic being measured.
  if (process.env.SKIP_PREWARM === "1") {
    log("[Pre-warm] SKIP_PREWARM=1 — not warming caches in this instance");
    return;
  }
  try {
    const { strapiGetAllBooks, strapiGetBookById, strapiGetBookWithVerseMeta, strapiGetCommentaryOptionsByBookId, strapiGetVerseById } =
      await import("./strapi");
    const { runBackground } = await import("./fetch-priority");
    const { contentCacheStatus } = await import("./content-cache");

    const cache = contentCacheStatus();
    log(`[Pre-warm] content cache dir=${cache.dir} disk=${cache.disk ? "on" : "off"}`);

    await runBackground(async () => {
      const books = await strapiGetAllBooks();
      const CONCURRENCY = Math.max(
        1,
        Math.min(4, Number(process.env.STRAPI_PREWARM_CONCURRENCY || 2)),
      );

      const runPhase = async (
        label: string,
        warmOne: (book: { id: string; title: string }) => Promise<void>,
      ) => {
        let done = 0;
        let nextIdx = 0;
        const worker = async () => {
          while (true) {
            const i = nextIdx++;
            if (i >= books.length) return;
            const book = books[i] as { id: string; title: string };
            try {
              await warmOne(book);
              done++;
            } catch (e: any) {
              log(`[Pre-warm ${label}] failed ${book.title}: ${e?.message || e}`);
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, books.length) }, () => worker()));
        log(`[Pre-warm ${label}] ${done}/${books.length} granthas ready.`);
      };

      log(`[Pre-warm] ${books.length} granthas — phase 1 (open-a-grantha payloads)...`);
      await runPhase("open", async (book) => {
        const meta = await strapiGetBookWithVerseMeta(book.id);
        const firstVerseId = meta?.verses?.[0]?.id;
        await Promise.all([
          strapiGetCommentaryOptionsByBookId(book.id),
          firstVerseId ? strapiGetVerseById(firstVerseId) : Promise.resolve(undefined),
        ]);
      });

      log("[Pre-warm] phase 2 (full hydration)...");
      await runPhase("full", async (book) => {
        await strapiGetBookById(book.id);
      });
    });
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error };
    const detail = err?.cause?.message || err?.message || String(e);
    log(`[Pre-warm] Skipped: ${detail}`);
  }
}
