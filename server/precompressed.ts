/**
 * Pre-compressed response cache for immutable-ish content payloads.
 *
 * Measured on this codebase: serving the Panchadasi verse index with the
 * generic `compression()` middleware caps one Node process at ~1,500 req/s
 * (57 MB/s) with occasional 12-second event-loop stalls, while the same payload
 * served uncompressed reaches ~2,030 req/s. Every one of those requests gzips
 * byte-for-byte identical JSON.
 *
 * So each payload is serialised and compressed once, then the resulting buffers
 * are served directly. On a hit a request does no JSON.stringify, no gzip and no
 * hashing — just a negotiated buffer write and an ETag comparison. Brotli is
 * built too (at a quality gzip-on-the-fly could never afford) because it is
 * ~15% smaller again, which matters most on the slow mobile links this content
 * is read on.
 *
 * Invalidated by the same CMS webhook paths that clear the content caches, so a
 * stale compressed body can't outlive its source.
 */
import crypto from "crypto";
import zlib from "zlib";
import type { Request, Response } from "express";
import { incr, observe } from "./observability";

interface Entry {
  contentType: string;
  etag: string;
  identity: Buffer;
  gzip: Buffer;
  brotli: Buffer | null;
  bytes: number;
  builtAt: number;
}

/**
 * Compressed bodies are derived from the content caches, which refresh
 * themselves on a TTL. A webhook clears both immediately, but a TTL-driven
 * refresh would otherwise leave these bytes stale forever — so they expire on
 * the same window the content cache already treats as fresh.
 */
const TTL_MS = Math.max(
  1000,
  Number(process.env.PRECOMPRESS_TTL_MS || process.env.CONTENT_CACHE_TTL_MS || 30 * 60 * 1000),
);

/** Total cap across all entries; LRU-evicted. ~36MB holds every grantha index. */
const MAX_BYTES = Math.max(4 * 1024 * 1024, Number(process.env.PRECOMPRESS_MAX_BYTES || 96 * 1024 * 1024));
/** Below this, compression saves less than the bookkeeping costs. */
const MIN_COMPRESS_BYTES = 1024;

const cache = new Map<string, Entry>();
let totalBytes = 0;

function evictIfNeeded(): void {
  while (totalBytes > MAX_BYTES && cache.size > 0) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const entry = cache.get(oldest.value);
    cache.delete(oldest.value);
    if (entry) totalBytes -= entry.bytes;
    incr("ssh_precompress_evicted_total");
  }
}

function build(payload: unknown, asHtml: boolean): Entry {
  const startedAt = Date.now();
  const identity = asHtml
    ? Buffer.from(String((payload as { html?: string }).html ?? ""))
    : Buffer.from(JSON.stringify(payload));
  const compressible = identity.length >= MIN_COMPRESS_BYTES;
  const gzip = compressible
    ? zlib.gzipSync(identity, { level: zlib.constants.Z_BEST_COMPRESSION })
    : identity;
  const brotli = compressible
    ? zlib.brotliCompressSync(identity, {
        params: {
          // Quality 10 is affordable exactly because this runs once per payload.
          [zlib.constants.BROTLI_PARAM_QUALITY]: 10,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: identity.length,
        },
      })
    : null;
  const etag = `"${crypto.createHash("sha1").update(identity).digest("base64url")}"`;
  observe("ssh_precompress_build_ms", Date.now() - startedAt);
  return {
    contentType: asHtml ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
    etag,
    identity,
    gzip,
    brotli,
    bytes: identity.length + gzip.length + (brotli?.length ?? 0),
    builtAt: Date.now(),
  };
}

function pickEncoding(req: Request, entry: Entry): { body: Buffer; encoding: string | null } {
  const accept = String(req.headers["accept-encoding"] || "").toLowerCase();
  if (entry.brotli && accept.includes("br")) return { body: entry.brotli, encoding: "br" };
  if (entry.gzip !== entry.identity && accept.includes("gzip")) return { body: entry.gzip, encoding: "gzip" };
  return { body: entry.identity, encoding: null };
}

/**
 * Sends `payload` from the pre-compressed cache, building the entry on a miss.
 * `build` is only invoked on a miss, so callers may pass a thunk that is itself
 * expensive to evaluate.
 */
export async function sendCached(
  req: Request,
  res: Response,
  key: string,
  produce: () => Promise<unknown> | unknown,
  options: { asHtml?: boolean } = {},
): Promise<void> {
  let entry = cache.get(key);
  if (entry && Date.now() - entry.builtAt >= TTL_MS) {
    cache.delete(key);
    totalBytes -= entry.bytes;
    entry = undefined;
    incr("ssh_precompress_total", { result: "expired" });
  }
  if (entry) {
    // Refresh LRU position.
    cache.delete(key);
    cache.set(key, entry);
    incr("ssh_precompress_total", { result: "hit" });
  } else {
    const payload = await produce();
    if (payload === undefined || payload === null) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    entry = build(payload, options.asHtml === true);
    cache.set(key, entry);
    totalBytes += entry.bytes;
    evictIfNeeded();
    incr("ssh_precompress_total", { result: "miss" });
  }

  res.setHeader("ETag", entry.etag);
  res.setHeader("Vary", "Accept-Encoding");

  // A strong ETag match means the client already has these exact bytes.
  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch && ifNoneMatch.split(",").some((t) => t.trim() === entry!.etag)) {
    incr("ssh_precompress_total", { result: "not_modified" });
    res.status(304).end();
    return;
  }

  const { body, encoding } = pickEncoding(req, entry);
  res.setHeader("Content-Type", entry.contentType);
  // Setting Content-Encoding also makes the generic compression() middleware
  // skip this response, which is the point.
  if (encoding) res.setHeader("Content-Encoding", encoding);
  res.setHeader("Content-Length", String(body.length));
  res.status(200).end(body);
}

/** Drops cached bodies whose key starts with `prefix` (all of them if omitted). */
export function invalidatePrecompressed(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    totalBytes = 0;
    return;
  }
  const doomed: string[] = [];
  cache.forEach((_entry, key) => {
    if (key.startsWith(prefix)) doomed.push(key);
  });
  for (const key of doomed) {
    const entry = cache.get(key);
    cache.delete(key);
    if (entry) totalBytes -= entry.bytes;
  }
}

export function precompressedStats(): { entries: number; bytes: number } {
  return { entries: cache.size, bytes: totalBytes };
}
