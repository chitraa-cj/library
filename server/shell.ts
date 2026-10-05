/**
 * Server-rendered critical content for grantha URLs.
 *
 * Measured on the SPA as it stood (real Chrome, 4x CPU throttle, cache cold),
 * opening the deep link `/panchadasi/1`:
 *
 *   broadband  scripture visible   258 ms
 *   fast 3G    scripture visible  8400 ms   (FCP 2500 ms)
 *   slow 3G    scripture visible  never, inside 30 s
 *
 * TTFB was 153 ms and the server produces that verse in ~0.3 ms. The remaining
 * ~8.2 s was: download 374 KB of JS, execute it, render the *home* page (deep
 * links were gated on the 83 KB catalogue loading first), fetch the catalogue,
 * mount the reader, fetch the bootstrap, paint.
 *
 * So the critical content is injected into the HTML instead. Deliberately NOT
 * React SSR: the reader is a ~2,700-line client component wired to
 * localStorage, window and selection APIs, and server-rendering it would be a
 * large change with a real regression surface. A small, static, escaped
 * rendering of the one thing the reader came for — plus the JSON needed to stop
 * the client re-fetching it — buys nearly all of the first-paint win at a
 * fraction of the risk.
 *
 * What is inlined is P0 only (the verse, and the book header). The verse index
 * is navigation metadata (P2) and stays a separate request: inlining its 31 KB
 * would delay the very paint this exists to accelerate.
 *
 * The result is public, identical for every reader, and carries the same cache
 * headers as the JSON API — so a CDN can serve it without touching the origin.
 */
import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { sendCached } from "./precompressed";
import { incr } from "./observability";
import type { VerseWithTranslations } from "@shared/schema";

/** Client routes that are not grantha slugs. */
const RESERVED_SEGMENTS = new Set(["auth", "translate", "acharyas", "api", "assets", "images", "fonts"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * CMS section titles often double a unit word ("Mantra Mantra 1.1", because the
 * title is built as `Mantra ${ShlokaManthraNumber}` and the number already
 * carries the unit). The reader collapses these client-side; the pre-rendered
 * title and <title> tag must match, or the two disagree on screen.
 */
function tidyLabel(label: string): string {
  return label
    .trim()
    .replace(/\b(Mantra|Shloka|Sloka|Sutra|Verse|Khanda|Adhyaya)\s+\1\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Safe to embed inside a <script type="application/json"> block. */
function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function pickTranslation(verse: VerseWithTranslations, codes: string[]): string | null {
  for (const code of codes) {
    const hit = verse.translations?.find((t) => t.languageCode === code);
    if (hit?.content) return hit.content;
  }
  return null;
}

/**
 * Styles for the pre-rendered block, inlined in <head> so it needs neither the
 * CSS bundle nor any JavaScript. It covers the viewport, because the alternative
 * is showing it stacked above a half-mounted app.
 *
 * Theme can't be known server-side (the app reads it from localStorage in JS),
 * so both colour schemes are declared and the browser picks.
 */
const PRERENDER_STYLE = `<style>
#ssh-prerender{position:fixed;inset:0;z-index:40;overflow-y:auto;background:#fdfcfa;color:#1c1917;
 -webkit-font-smoothing:antialiased;font-family:'Libre Franklin',system-ui,-apple-system,sans-serif}
#ssh-prerender .w{max-width:52rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
#ssh-prerender .bk{font-size:.75rem;letter-spacing:.09em;text-transform:uppercase;opacity:.55;margin-bottom:.6rem}
#ssh-prerender h1{font-size:1.5rem;font-weight:600;margin:0 0 1.75rem;line-height:1.3}
#ssh-prerender .sa{font-family:'Tiro Devanagari Hindi','Noto Serif Devanagari',serif;font-size:1.375rem;
 line-height:2.1;white-space:pre-wrap;margin-bottom:1.75rem}
#ssh-prerender .tr{font-size:1.0625rem;line-height:1.8;opacity:.88;white-space:pre-wrap}
@media (prefers-color-scheme:dark){#ssh-prerender{background:#12100e;color:#f5f3f0}}
html.dark #ssh-prerender{background:#12100e;color:#f5f3f0}
</style>`;

/** Minimal, static markup for the verse — no JavaScript required to paint it. */
function renderVerseHtml(opts: {
  bookTitle: string;
  verseLabel: string;
  sanskrit: string | null;
  translation: string | null;
}): string {
  const { bookTitle, verseLabel, sanskrit, translation } = opts;
  const parts: string[] = [`<div id="ssh-prerender"><div class="w">`];
  parts.push(`<div class="bk">${escapeHtml(bookTitle)}</div>`);
  parts.push(`<h1>${escapeHtml(verseLabel)}</h1>`);
  if (sanskrit) parts.push(`<div class="sa" lang="sa">${escapeHtml(sanskrit)}</div>`);
  if (translation) parts.push(`<div class="tr">${escapeHtml(translation)}</div>`);
  parts.push(`</div></div>`);
  return parts.join("");
}

interface ShellTemplate {
  head: string;
  tail: string;
}

/**
 * Splits index.html at the mount point once, so each request is two string
 * concatenations rather than a parse.
 */
function loadTemplate(distPath: string): ShellTemplate | null {
  try {
    const html = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    const marker = '<div id="root"></div>';
    const at = html.indexOf(marker);
    if (at === -1) return null;
    return { head: html.slice(0, at), tail: html.slice(at) };
  } catch {
    return null;
  }
}

function applyMeta(head: string, opts: { title: string; description: string; canonical: string }): string {
  let out = head.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(opts.title)}</title>`,
  );
  out = out.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(opts.description)}" />`,
  );
  const extra = [
    PRERENDER_STYLE,
    `<link rel="canonical" href="${escapeHtml(opts.canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(opts.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(opts.description)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${escapeHtml(opts.canonical)}" />`,
  ].join("\n    ");
  return out.replace("</head>", `  ${extra}\n  </head>`);
}

/**
 * Registers the pre-rendering handler. Must be mounted BEFORE the SPA
 * catch-all, and falls through to it for anything that is not a grantha URL.
 */
export function registerShellRoutes(app: Express, distPath: string): void {
  // Kill-switch: lets the exact same build serve the plain SPA shell, both for
  // A/B measurement and as an instant rollback if pre-rendering misbehaves.
  if (process.env.SHELL_PRERENDER === "0") {
    console.log("[shell] SHELL_PRERENDER=0 — serving the plain SPA shell");
    return;
  }
  const template = loadTemplate(distPath);
  if (!template) {
    console.warn("[shell] index.html has no '<div id=\"root\"></div>' mount point — pre-rendering disabled");
    return;
  }

  console.log("[shell] grantha pre-rendering enabled");

  /** slug -> bookId, rebuilt from the (cached) catalogue. */
  let slugMap: Map<string, string> = new Map();
  let slugMapAt = 0;
  const SLUG_TTL_MS = Math.max(10_000, Number(process.env.SHELL_SLUG_TTL_MS || 5 * 60 * 1000));

  async function resolveSlug(slug: string): Promise<string | undefined> {
    if (Date.now() - slugMapAt > SLUG_TTL_MS || slugMap.size === 0) {
      try {
        const books = await storage.getAllBooks();
        const next = new Map<string, string>();
        for (const b of books) if (b.slug) next.set(b.slug, b.id as string);
        if (next.size > 0) {
          slugMap = next;
          slugMapAt = Date.now();
        }
      } catch {
        // Keep the previous map; a stale slug table beats failing the page.
      }
    }
    return slugMap.get(slug);
  }

  const handler = async (req: Request, res: Response, next: NextFunction) => {
    // Only plain document GETs for `/slug` or `/slug/<verseNumber>`.
    if (req.method !== "GET") return next();
    // Treat a missing or wildcard Accept as a document request; only skip when
    // the client has explicitly asked for something that isn't HTML.
    const accept = String(req.headers.accept || "");
    if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return next();

    const segments = req.path.split("/").filter(Boolean);
    if (segments.length === 0 || segments.length > 2) return next();
    const [slug, second] = segments;
    if (RESERVED_SEGMENTS.has(slug) || slug.includes(".")) return next();
    if (second !== undefined && !/^\d+$/.test(second)) return next();

    const bookId = await resolveSlug(slug);
    if (!bookId) return next();

    // This HTML is public and byte-identical for every reader (it embeds only
    // grantha content — never user state), which is exactly what makes it
    // CDN-cacheable. A shorter browser max-age keeps a reader reasonably fresh
    // while a longer s-maxage lets the edge absorb the traffic; the CMS webhook
    // clears the origin copy, and the strong ETag makes revalidation free.
    const browserMaxAge = Math.max(0, Number(process.env.SHELL_MAX_AGE || 60));
    const edgeMaxAge = Math.max(0, Number(process.env.SHELL_S_MAXAGE || 300));
    res.setHeader(
      "Cache-Control",
      `public, max-age=${browserMaxAge}, s-maxage=${edgeMaxAge}, stale-while-revalidate=86400`,
    );

    const verseNumber = second === undefined ? undefined : Number(second);

    try {
      await sendCached(
        req,
        res,
        `shell:${slug}:${verseNumber ?? "first"}`,
        async () => {
          const book = await storage.getBookWithVerseMeta(bookId);
          if (!book) return null;

          const verses = book.verses || [];
          const target =
            (verseNumber !== undefined ? verses.find((v) => v.verseNumber === verseNumber) : undefined) ??
            verses[0];
          const verse = target
            ? await storage.getVerseById(target.id).catch(() => undefined)
            : undefined;

          const bookTitle = (book.title || slug).trim();
          const verseLabel = tidyLabel(target?.sectionTitle || `Mantra ${verseNumber ?? 1}`);
          const sanskrit = verse ? pickTranslation(verse, ["devanagari", "sa", "sanskrit"]) : null;
          const translation = verse ? pickTranslation(verse, ["english", "en"]) : null;

          const descriptionSource = translation || sanskrit || "";
          const description = descriptionSource
            ? `${bookTitle} — ${verseLabel}. ${descriptionSource.replace(/\s+/g, " ").slice(0, 180)}`
            : `${bookTitle} — ${verseLabel}. Read the original text with classical commentary.`;

          const proto = (process.env.PUBLIC_SCHEME || "https").replace(/[^a-z]/g, "");
          const host = process.env.PUBLIC_HOST || req.headers.host || "";
          const canonical = `${proto}://${host}/${slug}${verseNumber !== undefined ? `/${verseNumber}` : ""}`;

          const head = applyMeta(template.head, {
            title: `${bookTitle} — ${verseLabel}`,
            description,
            canonical,
          });

          // P0 only. The verse index is navigation metadata and is fetched
          // separately so it cannot delay this paint.
          const payload = {
            v: 1,
            bookId,
            slug,
            bookTitle,
            verseId: target?.id ?? null,
            verseNumber: target?.verseNumber ?? null,
            verse: verse ?? null,
          };

          const prerender = renderVerseHtml({ bookTitle, verseLabel, sanskrit, translation });
          const inlineData = `<script id="__SSH_BOOTSTRAP__" type="application/json">${escapeJsonForScript(payload)}</script>`;

          incr("ssh_shell_rendered_total");
          return { html: `${head}${prerender}${inlineData}${template.tail}` };
        },
        { asHtml: true },
      );
    } catch (error) {
      console.error("[shell] pre-render failed, falling back to the SPA shell:", error);
      next();
    }
  };

  app.get(/^\/[^/]+(?:\/\d+)?\/?$/, (req, res, next) => {
    void handler(req, res, next);
  });
}
