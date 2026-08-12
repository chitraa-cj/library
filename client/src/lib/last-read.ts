// Tracks the reader's most recent position so "My Library → Resume Study" can
// send them back where they left off. Persisted in localStorage (per device).
//
// In addition to the single most-recent entry (KEY), we keep a short list of
// recently-read books (RECENT_KEY) — one entry per book, most recent first — so
// the home "Resume Study" control can offer a dropdown of what the reader has
// been studying.

const KEY = "ssh:lastRead";
const RECENT_KEY = "ssh:recentReads";
const EVENT = "ssh:lastRead-changed";
const MAX_RECENT = 6;

export interface LastReadEntry {
  bookId: string;
  bookSlug?: string;
  bookTitle?: string;
  verseNumber: number;
  /** Human verse/mantra label, e.g. "1.1.2". */
  verseLabel?: string;
  updatedAt: number;
}

export function getLastRead(): LastReadEntry | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw.bookId === "string" && typeof raw.verseNumber === "number") {
      return raw as LastReadEntry;
    }
    return null;
  } catch {
    return null;
  }
}

/** Recently-read books, one entry per book, most recent first. */
export function getRecentReads(): LastReadEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "null");
    if (Array.isArray(raw)) {
      return raw.filter(
        (r): r is LastReadEntry =>
          r && typeof r.bookId === "string" && typeof r.verseNumber === "number",
      );
    }
    // Fall back to the single most-recent entry if the list hasn't been seeded yet.
    const single = getLastRead();
    return single ? [single] : [];
  } catch {
    return [];
  }
}

export function setLastRead(entry: Omit<LastReadEntry, "updatedAt">) {
  try {
    const prev = getLastRead();
    // Avoid redundant writes (and event churn) when nothing changed.
    if (prev && prev.bookId === entry.bookId && prev.verseNumber === entry.verseNumber) return;
    const full: LastReadEntry = { ...entry, updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(full));

    // Update the recents list: drop any prior entry for this book, prepend, cap.
    const recents = getRecentReads().filter((r) => r.bookId !== entry.bookId);
    recents.unshift(full);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, MAX_RECENT)));

    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeLastRead(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
