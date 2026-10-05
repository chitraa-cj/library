import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions, getQueryFn } from "@/lib/queryClient";

/**
 * Sidebar snippets for a grantha, keyed by verse id.
 *
 * These used to ride along inside the verse index — 124KB of the 861KB
 * Panchadasi payload — which meant nobody could read a word until every
 * snippet had transferred. They are navigation sugar, so they are fetched
 * separately at the lowest priority and merged in when they arrive.
 */
export function useBookPreviews(bookId: string | null | undefined): Record<string, string> {
  const { data } = useQuery<Record<string, string>>({
    queryKey: ["/api/books", bookId, "previews"],
    enabled: !!bookId,
    queryFn: getQueryFn({ on401: "throw", priority: "idle", group: bookId ?? undefined }),
    ...cmsContentQueryOptions,
  });
  return data ?? {};
}
