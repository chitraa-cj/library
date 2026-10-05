import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { schedule, type Priority } from "./fetch-scheduler";
import { decodeBookIndex, type CompactBookIndex } from "@shared/book-index-codec";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Which verse the reader is about to land on, per grantha. Lets the combined
 * bootstrap request return the verse actually being restored to (resume study,
 * a deep link) instead of verse 1, so the first paint is the right content.
 */
const bootstrapVerseHints = new Map<string, string>();

export function setBootstrapVerseHint(bookId: string, verseId: string | null | undefined): void {
  if (!bookId) return;
  if (verseId) bootstrapVerseHints.set(bookId, verseId);
  else bootstrapVerseHints.delete(bookId);
}

/** `["/api/books", "<id>"]` — the book-index query, which we serve via bootstrap. */
function bookIndexKey(queryKey: readonly unknown[]): string | null {
  if (queryKey.length !== 2) return null;
  if (queryKey[0] !== "/api/books") return null;
  const id = queryKey[1];
  return typeof id === "string" && id.length > 0 ? id : null;
}

interface BootstrapResponse {
  bookIndex: CompactBookIndex;
  verseId: string | null;
  verse: unknown | null;
  commentaryOptions: unknown | null;
}

/**
 * Opening a grantha used to cost two serial round-trips: fetch the verse index,
 * then — only once it arrived and the first verse's id was known — fetch that
 * verse's content. On a connection with ~250ms of latency that is half a second
 * before any text can appear, on top of the index transfer itself.
 *
 * The bootstrap endpoint returns the index, the opening verse's full content and
 * the commentary options together. We hand the index back to the caller and seed
 * the sibling queries, so the components that ask for them next find them
 * already cached instead of issuing their own requests.
 */
/**
 * Reader URLs are `/{slug}/{verseNumber}`, so the address bar already says which
 * verse is being opened — including on a cold load of a shared link or a
 * "resume study" jump. Reading it here means the bootstrap returns the right
 * verse without every navigation site having to remember to announce itself.
 */
function verseNumberFromLocation(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return undefined;
  const n = Number(segments[1]);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

async function fetchBookViaBootstrap(bookId: string, signal: AbortSignal): Promise<unknown> {
  const params = new URLSearchParams();
  const hintedVerseId = bootstrapVerseHints.get(bookId);
  if (hintedVerseId) params.set("verse", hintedVerseId);
  const hintedVerseNumber = verseNumberFromLocation();
  if (hintedVerseNumber !== undefined) params.set("verseNumber", String(hintedVerseNumber));

  const query = params.toString();
  const url = `/api/books/${encodeURIComponent(bookId)}/bootstrap${query ? `?${query}` : ""}`;

  const res = await fetch(url, { credentials: "include", signal });
  await throwIfResNotOk(res);
  const payload = (await res.json()) as BootstrapResponse;

  if (payload.verse && payload.verseId) {
    queryClient.setQueryData(["/api/verses", payload.verseId], payload.verse);
  }
  if (payload.commentaryOptions) {
    queryClient.setQueryData(
      ["/api/books", bookId, "commentary-options"],
      payload.commentaryOptions,
    );
  }
  // Expanded back to the exact shape every reader component already expects, so
  // the wire format is an implementation detail of this function.
  return decodeBookIndex(payload.bookIndex);
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  priority?: Priority;
  group?: string;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, priority = "critical", group }) =>
  async ({ queryKey, signal }) => {
    const url = queryKey.join("/") as string;
    const bookId = bookIndexKey(queryKey);

    return schedule({
      key: bookId ? `bootstrap:${bookId}` : url,
      group: group ?? bookId ?? "content",
      priority,
      run: async (schedulerSignal) => {
        // Honour whichever of the two cancels first: react-query unmounting the
        // query, or the scheduler preempting a speculative fetch.
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort);
        schedulerSignal.addEventListener("abort", onAbort);
        try {
          if (bookId) return await fetchBookViaBootstrap(bookId, controller.signal);

          const res = await fetch(url, { credentials: "include", signal: controller.signal });
          if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
          await throwIfResNotOk(res);
          return await res.json();
        } finally {
          signal?.removeEventListener("abort", onAbort);
          schedulerSignal.removeEventListener("abort", onAbort);
        }
      },
    });
  };

/**
 * Books, verses, and commentary from Strapi. This content changes rarely and is
 * invalidated server-side via the CMS webhook, so we keep it fresh for several
 * minutes and hold it in the query cache far longer. This makes back/forward
 * navigation and re-opening a verse instant instead of re-fetching heavy
 * bhashya/teeka payloads on every focus change.
 */
export const cmsContentQueryOptions = {
  staleTime: 5 * 60_000,
  gcTime: 60 * 60_000,
  refetchOnWindowFocus: false,
} as const;

/**
 * localStorage-backed cache for slow, rarely-changing list endpoints (e.g. the
 * book catalogue). Seeding react-query's `initialData` from here lets the home
 * screen paint real book names instantly on repeat visits instead of flashing
 * empty sections for several seconds while the network round-trip completes.
 */
export function readCachedList<T>(key: string): T[] | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T[]) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedList<T>(key: string, data: T[] | undefined): void {
  try {
    if (!data || data.length === 0) return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota / private-mode — cache is best-effort */
  }
}

export const BOOKS_CACHE_KEY = "cachedBooks:v1";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Warms a verse without competing with whatever the reader is currently waiting
 * on. `priority` should fall off with distance from the open page: the adjacent
 * verse is "high", anything further is "idle" and will be dropped or cut short
 * the moment something critical needs the connection.
 */
export function prefetchVerse(
  verseId: string,
  options: { priority?: Priority; group?: string } = {},
): void {
  const { priority = "high", group } = options;
  void queryClient
    .prefetchQuery({
      queryKey: ["/api/verses", verseId],
      queryFn: getQueryFn({ on401: "throw", priority, group }),
      ...cmsContentQueryOptions,
    })
    .catch(() => {
      /* speculative — a dropped or preempted prefetch is not an error */
    });
}

/** Key the scheduler uses for a verse prefetch, for retainOnly/demote calls. */
export function verseFetchKey(verseId: string): string {
  return ["/api/verses", verseId].join("/");
}
