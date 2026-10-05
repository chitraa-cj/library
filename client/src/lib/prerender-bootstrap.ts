import type { QueryClient } from "@tanstack/react-query";
import { setBootstrapVerseHint } from "@/lib/queryClient";

/**
 * Critical content the server already rendered into the HTML.
 *
 * Opening a grantha deep link on the SPA alone took 8.4s on fast 3G and never
 * finished inside 30s on slow 3G, because the page could not resolve which book
 * the URL meant until 374KB of JS and the 83KB catalogue had both arrived. The
 * server knows both at request time, so it inlines the verse (for paint) and
 * this payload (so the client neither re-fetches it nor waits for the
 * catalogue).
 *
 * See server/shell.ts.
 */
export interface PrerenderBootstrap {
  v: 1;
  bookId: string;
  slug: string;
  bookTitle: string;
  verseId: string | null;
  verseNumber: number | null;
  verse: unknown | null;
}

let parsed: PrerenderBootstrap | null | undefined;

export function readPrerenderBootstrap(): PrerenderBootstrap | null {
  if (parsed !== undefined) return parsed;
  parsed = null;
  try {
    const el = document.getElementById("__SSH_BOOTSTRAP__");
    if (el?.textContent) {
      const value = JSON.parse(el.textContent) as PrerenderBootstrap;
      if (value && value.v === 1 && value.bookId) parsed = value;
    }
  } catch {
    /* a malformed payload must never break the app — fall back to fetching */
  }
  return parsed;
}

/**
 * Seeds the query cache with what the server already sent, so hydration does
 * not re-request the verse that is already on screen.
 */
export function hydrateFromPrerender(queryClient: QueryClient): void {
  const pre = readPrerenderBootstrap();
  if (!pre) return;
  if (pre.verse && pre.verseId) {
    queryClient.setQueryData(["/api/verses", pre.verseId], pre.verse);
    // Makes the index request return this same verse as its opening page.
    setBootstrapVerseHint(pre.bookId, pre.verseId);
  }
}

/**
 * Removes the pre-rendered block. Called once React has painted the real verse,
 * so there is never a gap between the two.
 */
export function dismissPrerender(): void {
  const el = document.getElementById("ssh-prerender");
  if (!el) return;
  el.remove();
}
