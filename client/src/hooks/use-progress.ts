import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export function useProgressSummary() {
  const { isAuthenticated } = useAuth();
  return useQuery<Record<string, number>>({
    queryKey: ["/api/progress/summary"],
    enabled: isAuthenticated,
    staleTime: 1000 * 30,
  });
}

export function useBookProgress(bookId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery<{ completedVerseIds: string[] }>({
    queryKey: ["/api/progress/book", bookId],
    enabled: isAuthenticated && !!bookId,
    staleTime: 1000 * 30,
  });
}

export function useMarkVerseComplete() {
  return useMutation({
    mutationFn: async ({ bookId, verseId }: { bookId: string; verseId: string }) => {
      return apiRequest("POST", "/api/progress", { bookId, verseId });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/book", vars.bookId] });
    },
  });
}

export function useUnmarkVerseComplete() {
  return useMutation({
    mutationFn: async ({ verseId }: { bookId: string; verseId: string }) => {
      return apiRequest("DELETE", `/api/progress/${encodeURIComponent(verseId)}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress/book", vars.bookId] });
    },
  });
}
