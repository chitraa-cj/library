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
  { strapiDocId: "t2d3crlf4ptuadp73lziogy5", localPgSlug: "katha-upanishad-bhashya" },
  { strapiDocId: "ngjdm2fcgp0ogp16jcey3vo1", localPgSlug: "isha-upanishad-bhashya" },
  { strapiDocId: "b7zir6h4z5v2ng6uofnvhmp3", localPgSlug: "bhagavad-gita" },
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
