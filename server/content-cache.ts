/**
 * Two-tier cache (process memory + local disk) with stale-while-revalidate, for
 * the CMS-derived payloads that gate the reader's first paint.
 *
 * Why disk: the Strapi-derived book/verse payloads cost many seconds and dozens
 * of round-trips to rebuild. Holding them only in `Map`s means every deploy,
 * restart or TTL expiry puts that cost back on a reader's critical path. A disk
 * tier makes the cache survive restarts, and `swr()` means an expired entry is
 * served immediately while it refreshes in the background — so a reader never
 * waits on Strapi for content we have already seen once.
 *
 * Deliberately dependency-free (plain JSON files, atomic rename) so it needs no
 * Redis/sidecar to run on a single EC2 box, and no build-allowlist changes.
 */
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { runBackground } from "./fetch-priority";
import { incr } from "./observability";

/** Entries newer than this are served without revalidating. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;
/**
 * How long a stale entry may still be served while it refreshes. Beyond this we
 * treat the entry as absent and block on a fresh load, so a grantha deleted or
 * rewritten in the CMS can never be served indefinitely if a webhook is missed.
 */
const DEFAULT_MAX_STALE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Resolved on first use, not at module load: this module is imported
 * transitively (index → routes → strapi → here), so reading the environment
 * eagerly would silently depend on import order relative to dotenv loading.
 */
let cacheRoot: string | null = null;
function cacheRootDir(): string {
  if (cacheRoot === null) {
    const configured = process.env.CONTENT_CACHE_DIR?.trim();
    cacheRoot = configured || path.join(os.tmpdir(), "sacred-script-content-cache");
  }
  return cacheRoot;
}

function diskEnabled(): boolean {
  return process.env.CONTENT_CACHE_DISK !== "0";
}

interface DiskRecord<T> {
  key: string;
  savedAt: number;
  value: T;
}

interface MemoryEntry<T> {
  value: T;
  savedAt: number;
}

export interface ContentStore<T> {
  /** Fresh value only — no disk read, no loader. Cheap enough for hot paths. */
  peekFresh(key: string): T | undefined;
  /**
   * Best available value from memory or disk, fresh or stale, without ever
   * calling the loader. Used to keep serving readers when the upstream CMS is
   * unreachable: out-of-date scripture is enormously better than a 404.
   */
  peekAny(key: string): Promise<T | undefined>;
  /**
   * Fresh hit → return it. Stale hit (memory or disk) → return the stale value
   * now and refresh in the background. Miss → await `loader`.
   *
   * `loader` returning `undefined` is treated as "nothing to cache" and is not
   * stored, so a transient Strapi failure never poisons the cache.
   */
  swr(key: string, loader: () => Promise<T | undefined>): Promise<T | undefined>;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}

function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function createContentStore<T>(
  namespace: string,
  options: { ttlMs?: number; maxStaleMs?: number } = {},
): ContentStore<T> {
  const ttlMs = options.ttlMs ?? envMs("CONTENT_CACHE_TTL_MS", DEFAULT_TTL_MS);
  const maxStaleMs = options.maxStaleMs ?? envMs("CONTENT_CACHE_MAX_STALE_MS", DEFAULT_MAX_STALE_MS);
  let dirPath: string | null = null;
  const dir = () => (dirPath ??= path.join(cacheRootDir(), namespace));

  const memory = new Map<string, MemoryEntry<T>>();
  /** In-flight loads, so N concurrent readers trigger exactly one rebuild. */
  const loading = new Map<string, Promise<T | undefined>>();
  /** Keys whose background refresh is already running. */
  const refreshing = new Set<string>();
  /** Keys known to be absent from disk, so repeated misses skip the stat(2). */
  const diskMissing = new Set<string>();

  let dirReady: Promise<void> | null = null;
  function ensureDir(): Promise<void> {
    if (!dirReady) {
      dirReady = fsp.mkdir(dir(), { recursive: true }).then(
        () => undefined,
        (err) => warnDiskOnce(`mkdir ${dir()} failed`, err),
      );
    }
    return dirReady;
  }

  function fileFor(key: string): string {
    // Keys are CMS documentIds (safe) but may be composites like "<id>-intro";
    // hash so no key shape can escape the cache directory.
    return path.join(dir(), `${crypto.createHash("sha1").update(key).digest("hex")}.json`);
  }

  async function readDisk(key: string): Promise<MemoryEntry<T> | undefined> {
    if (!diskEnabled() || diskMissing.has(key)) return undefined;
    try {
      const raw = await fsp.readFile(fileFor(key), "utf8");
      const record = JSON.parse(raw) as DiskRecord<T>;
      if (!record || typeof record.savedAt !== "number") return undefined;
      return { value: record.value, savedAt: record.savedAt };
    } catch {
      diskMissing.add(key);
      return undefined;
    }
  }

  function writeDisk(key: string, entry: MemoryEntry<T>): void {
    if (!diskEnabled()) return;
    const record: DiskRecord<T> = { key, savedAt: entry.savedAt, value: entry.value };
    const target = fileFor(key);
    const tmp = `${target}.${process.pid}.tmp`;
    // Fire-and-forget: the memory tier already has the value, so a failed write
    // only costs us the restart-survival benefit for this one key.
    void ensureDir()
      .then(() => fsp.writeFile(tmp, JSON.stringify(record), "utf8"))
      .then(() => fsp.rename(tmp, target))
      .then(() => {
        diskMissing.delete(key);
      })
      .catch((err) => {
        // Surfaced once per process: a dead disk tier is survivable (the memory
        // tier still works) but it quietly removes the restart-survival benefit,
        // which is otherwise impossible to notice.
        warnDiskOnce(`write ${target} failed`, err);
        void fsp.unlink(tmp).catch(() => undefined);
      });
  }

  function store(key: string, value: T): void {
    const entry: MemoryEntry<T> = { value, savedAt: Date.now() };
    memory.set(key, entry);
    writeDisk(key, entry);
  }

  function load(key: string, loader: () => Promise<T | undefined>): Promise<T | undefined> {
    const existing = loading.get(key);
    if (existing) return existing;
    const promise = (async () => {
      const value = await loader();
      if (value !== undefined) store(key, value);
      return value;
    })().finally(() => loading.delete(key));
    loading.set(key, promise);
    return promise;
  }

  function refreshInBackground(key: string, loader: () => Promise<T | undefined>): void {
    if (refreshing.has(key) || loading.has(key)) return;
    refreshing.add(key);
    // A revalidation exists to help the *next* reader; it must never compete
    // with the one being served stale data right now.
    void runBackground(() => load(key, loader))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[content-cache] background refresh failed for ${namespace}/${key}: ${msg}`);
      })
      .finally(() => refreshing.delete(key));
  }

  return {
    peekFresh(key) {
      const entry = memory.get(key);
      if (entry && Date.now() - entry.savedAt < ttlMs) return entry.value;
      return undefined;
    },

    async peekAny(key) {
      const mem = memory.get(key);
      if (mem && Date.now() - mem.savedAt < maxStaleMs) return mem.value;
      const disk = await readDisk(key);
      if (disk && Date.now() - disk.savedAt < maxStaleMs) {
        memory.set(key, disk);
        return disk.value;
      }
      return undefined;
    },

    async swr(key, loader) {
      const mem = memory.get(key);
      if (mem) {
        const age = Date.now() - mem.savedAt;
        if (age < ttlMs) {
          incr("ssh_cache_total", { store: namespace, result: "memory_hit" });
          return mem.value;
        }
        if (age < maxStaleMs) {
          incr("ssh_cache_total", { store: namespace, result: "memory_stale" });
          refreshInBackground(key, loader);
          return mem.value;
        }
        memory.delete(key);
      }

      const disk = await readDisk(key);
      if (disk) {
        const age = Date.now() - disk.savedAt;
        if (age < maxStaleMs) {
          // Promote into memory so later reads skip the file read + JSON parse.
          memory.set(key, disk);
          incr("ssh_cache_total", { store: namespace, result: age >= ttlMs ? "disk_stale" : "disk_hit" });
          if (age >= ttlMs) refreshInBackground(key, loader);
          return disk.value;
        }
      }

      incr("ssh_cache_total", { store: namespace, result: "miss" });
      return load(key, loader);
    },

    set(key, value) {
      store(key, value);
    },

    delete(key) {
      memory.delete(key);
      if (!diskEnabled()) return;
      diskMissing.add(key);
      void fsp.unlink(fileFor(key)).catch(() => undefined);
    },

    clear() {
      memory.clear();
      diskMissing.clear();
      if (!diskEnabled()) return;
      void fsp.rm(dir(), { recursive: true, force: true }).then(
        () => {
          dirReady = null;
        },
        () => undefined,
      );
    },
  };
}

let diskWarned = false;
function warnDiskOnce(what: string, err: unknown): void {
  if (diskWarned) return;
  diskWarned = true;
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(
    `[content-cache] disk tier unavailable (${what}: ${msg}). Caching still works in memory, but will not survive a restart. Set CONTENT_CACHE_DIR to a writable path, or CONTENT_CACHE_DISK=0 to silence this.`,
  );
}

/** True when the disk tier is usable — logged once at boot for diagnosis. */
export function contentCacheStatus(): { dir: string; disk: boolean } {
  const root = cacheRootDir();
  if (diskEnabled()) {
    try {
      fs.mkdirSync(root, { recursive: true });
    } catch (err) {
      warnDiskOnce(`mkdir ${root} failed`, err);
      return { dir: root, disk: false };
    }
  }
  return { dir: root, disk: diskEnabled() };
}
