import express, { type Express, type Response } from "express";
import fs from "fs";
import path from "path";

// One year, in seconds — the standard "cache forever" window for immutable assets.
const ONE_YEAR = 60 * 60 * 24 * 365;
// One week — used for public files whose path is stable but whose contents can change.
const ONE_WEEK = 60 * 60 * 24 * 7;

const IMAGE_FONT_RE = /\.(png|jpe?g|webp|gif|svg|avif|ico|woff2?|ttf|otf|eot)$/i;

function setAssetHeaders(res: Response, filePath: string) {
  // Vite emits content-hashed filenames under /assets (e.g. cover-CSCJoCUU.png).
  // The hash changes whenever the content changes, so these can be cached forever.
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader("Cache-Control", `public, max-age=${ONE_YEAR}, immutable`);
    return;
  }

  // index.html must always be revalidated so new deploys are picked up.
  if (filePath.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-cache");
    return;
  }

  // Public images/fonts (/images/**, /fonts/**, favicon) have stable paths that
  // are NOT content-hashed. Cache them for a week but keep ETag/Last-Modified so
  // the browser can cheaply revalidate (304) once the window expires.
  if (IMAGE_FONT_RE.test(filePath)) {
    res.setHeader("Cache-Control", `public, max-age=${ONE_WEEK}`);
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { setHeaders: setAssetHeaders }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
