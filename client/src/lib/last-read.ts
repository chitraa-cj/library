// Tracks the reader's most recent position so "My Library → Resume Study" can
// send them back where they left off. Persisted in localStorage (per device).

const KEY = "ssh:lastRead";
const EVENT = "ssh:lastRead-changed";

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

export function setLastRead(entry: Omit<LastReadEntry, "updatedAt">) {
  try {
    const prev = getLastRead();
    // Avoid redundant writes (and event churn) when nothing changed.
    if (prev && prev.bookId === entry.bookId && prev.verseNumber === entry.verseNumber) return;
    localStorage.setItem(KEY, JSON.stringify({ ...entry, updatedAt: Date.now() }));
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
