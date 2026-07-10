// Client-side bookmark store (localStorage). No auth required, shared by the
// reader toolbar, the nav sidebar, and the My Library panel's "My Collection".
//
// Historically bookmarks were stored as a bare array of verseId strings. We now
// store richer entries so the collection can show a label and navigate. Reads
// transparently migrate the legacy string[] format.

const KEY = "ssh:bookmarks";
const EVENT = "ssh:bookmarks-changed";

export interface BookmarkEntry {
  verseId: string;
  bookId?: string;
  bookSlug?: string;
  bookTitle?: string;
  /** Human verse/mantra label, e.g. "1.1.1". */
  verseLabel?: string;
  verseNumber?: number;
  addedAt?: number;
}

function read(): BookmarkEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x): BookmarkEntry | null =>
        typeof x === "string" ? { verseId: x } : x && typeof x.verseId === "string" ? x : null
      )
      .filter((x): x is BookmarkEntry => x !== null);
  } catch {
    return [];
  }
}

function write(entries: BookmarkEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function getBookmarks(): BookmarkEntry[] {
  // Newest first.
  return read().sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
}

export function isBookmarked(verseId: string): boolean {
  return read().some((b) => b.verseId === verseId);
}

/** Toggle a bookmark; returns the new marked state (true = now bookmarked). */
export function toggleBookmark(entry: BookmarkEntry): boolean {
  const list = read();
  const idx = list.findIndex((b) => b.verseId === entry.verseId);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.push({ ...entry, addedAt: Date.now() });
  write(list);
  return true;
}

export function removeBookmark(verseId: string) {
  write(read().filter((b) => b.verseId !== verseId));
}

/** Subscribe to bookmark changes (same-tab custom event + cross-tab storage). */
export function subscribeBookmarks(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
