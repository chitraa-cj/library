/**
 * Strapi vs Postgres listing rules. Update strapiDocId values if you recreate granthas in Strapi.
 */

export function normalizeBookSlugForMerge(slug: string | null | undefined): string {
  return (slug || "").toLowerCase().replace(/-+$/, "").replace(/-bhashya$/, "").trim();
}

/** Strapi grantha documentIds whose Strapi row is hidden — Postgres book is canonical in the API list. */
export const LOCAL_STRAPI_DUPLICATES: Record<string, string> = {
  ngjdm2fcgp0ogp16jcey3vo1: "isha-upanishad-bhashya",
  b7zir6h4z5v2ng6uofnvhmp3: "bhagavad-gita",
};

/**
 * When Strapi is up, hide the legacy PG book with this slug if the Strapi grantha (by documentId) is present.
 * Katha: Strapi has full content; local seed is partial without attached_assets JSON.
 */
export const STRAPI_REPLACES_LOCAL: Array<{ strapiDocId: string; localPgSlug: string }> = [
  { strapiDocId: "t2d3crlf4ptuadp73lziogy5", localPgSlug: "katha-upanishad-bhashya" },
];

/** Strapi granthas that must still be merged when slug matches PG (otherwise slug de-dup drops them). */
export const STRAPI_IDS_MERGE_DESPITE_SHARED_SLUG = new Set(
  STRAPI_REPLACES_LOCAL.map((p) => p.strapiDocId),
);
