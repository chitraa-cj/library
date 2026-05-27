import { invalidateBookCache, invalidateVerseCache } from "./strapi";

export interface WebhookInvalidationTarget {
  bookId?: string;
  verseId?: string;
}

/** Resolve grantha / manthra ids from Strapi v4/v5 webhook payloads. */
export function resolveCacheInvalidationFromWebhook(body: unknown): WebhookInvalidationTarget {
  if (!body || typeof body !== "object") return {};

  const payload = body as Record<string, unknown>;
  const entry = (payload.entry ?? payload.data ?? payload) as Record<string, unknown>;
  const model = String(payload.model ?? payload.uid ?? payload.contentType ?? "").toLowerCase();

  if (model.includes("grantha")) {
    const bookId = entry.documentId ?? entry.id;
    return bookId ? { bookId: String(bookId) } : {};
  }

  if (model.includes("manthra")) {
    const verseId = entry.documentId ?? entry.id;
    const section = (entry.Section ?? entry.section) as Record<string, unknown> | undefined;
    const grantha = (section?.grantha ?? section?.Grantha) as Record<string, unknown> | undefined;
    const bookId = grantha?.documentId ?? grantha?.id ?? payload.granthaId ?? payload.bookId;
    return {
      verseId: verseId ? String(verseId) : undefined,
      bookId: bookId ? String(bookId) : undefined,
    };
  }

  if (model.includes("section")) {
    const grantha = (entry.grantha ?? entry.Grantha) as Record<string, unknown> | undefined;
    const bookId = grantha?.documentId ?? grantha?.id;
    return bookId ? { bookId: String(bookId) } : {};
  }

  // Manthra-shaped entry without model (some Strapi webhook configs)
  if (entry.documentId && (entry.ShlokaManthraNumber != null || entry.ShlokaManthraEntry)) {
    const section = (entry.Section ?? entry.section) as Record<string, unknown> | undefined;
    const grantha = (section?.grantha ?? section?.Grantha) as Record<string, unknown> | undefined;
    const bookId = grantha?.documentId ?? grantha?.id;
    return {
      verseId: String(entry.documentId),
      bookId: bookId ? String(bookId) : undefined,
    };
  }

  return {};
}

export function applyCacheInvalidation(target: WebhookInvalidationTarget): { invalidated: string[] } {
  const invalidated: string[] = [];

  if (target.bookId) {
    invalidateBookCache(target.bookId);
    invalidated.push(`book:${target.bookId}`);
  } else if (target.verseId) {
    invalidateVerseCache(target.verseId);
    invalidated.push(`verse:${target.verseId}`);
  }

  return { invalidated };
}

export function isWebhookAuthorized(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): boolean {
  const secret = (process.env.STRAPI_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return true;

  const headerSecret = headers["x-strapi-webhook-secret"] ?? headers["x-webhook-secret"];
  const provided =
    (typeof headerSecret === "string" ? headerSecret : headerSecret?.[0]) ??
    (typeof body === "object" && body && "secret" in body ? String((body as { secret?: string }).secret) : "");

  return provided === secret;
}
