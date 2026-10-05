import { useQuery } from "@tanstack/react-query";
import { cmsContentQueryOptions } from "@/lib/queryClient";
import { EMPTY_BOOK_VIDEOS, type BookVideos } from "@shared/video-resource";

/**
 * Every teaching video for a grantha, grouped by verse, in one request.
 *
 * Fetched per grantha rather than per verse so that moving between mantras
 * never costs a round-trip — the whole map is already in the query cache by the
 * time the reader starts turning pages.
 */
export function useBookVideos(bookId: string | null | undefined): BookVideos {
  const { data } = useQuery<BookVideos>({
    queryKey: ["/api/books", bookId, "videos"],
    enabled: !!bookId,
    ...cmsContentQueryOptions,
  });
  return data ?? EMPTY_BOOK_VIDEOS;
}
