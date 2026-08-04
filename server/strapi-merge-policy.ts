/**
 * Strapi vs Postgres listing rules. Update strapiDocId values if you recreate granthas in Strapi.
 */

export function normalizeBookSlugForMerge(slug: string | null | undefined): string {
  return (slug || "").toLowerCase().replace(/-+$/, "").replace(/-bhashya$/, "").trim();
}

/**
 * When Strapi is up, hide the legacy PG book with this slug if the Strapi grantha (by documentId) is present.
 * CMS is canonical for Isha, Gita, and Katha; Postgres copies remain as fallback when Strapi is down.
 */
export const STRAPI_REPLACES_LOCAL: Array<{ strapiDocId: string; localPgSlug: string }> = [
  { strapiDocId: "a7ja5q8qe5w68plzokxh17hz", localPgSlug: "katha-upanishad-bhashya" },
  { strapiDocId: "j7jxq2cec6dcmqtqc3wont6c", localPgSlug: "isha-upanishad-bhashya" },
  { strapiDocId: "s4gkaqmq9udj3oq58jsk92y3", localPgSlug: "bhagavad-gita" },
];

/** Strapi granthas that must still be merged when slug matches PG (otherwise slug de-dup drops them). */
export const STRAPI_IDS_MERGE_DESPITE_SHARED_SLUG = new Set(
  STRAPI_REPLACES_LOCAL.map((p) => p.strapiDocId),
);

/** Legacy Postgres slugs → Strapi slug (from CMS title slugify). Used for URLs and by-slug lookups. */
export const BOOK_SLUG_ALIASES: Record<string, string> = {
  "isha-upanishad-bhashya": "ishavasya-upanishad",
  "bhagavad-gita": "srimad-bhagavad-gita",
};

export function resolveStrapiDocIdForLocalSlug(slug: string): string | undefined {
  return STRAPI_REPLACES_LOCAL.find((p) => p.localPgSlug === slug)?.strapiDocId;
}

export function resolveBookSlugAlias(slug: string): string {
  return BOOK_SLUG_ALIASES[slug] ?? slug;
}
