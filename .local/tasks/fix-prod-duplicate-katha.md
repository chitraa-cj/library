# Fix Duplicate Katha in Production

## What & Why
The production Library catalog shows two Kathopanishad cards side-by-side: the legacy 26-mantra Postgres entry (`Kaṭhopaniṣad`, slug `katha-upanishad-bhashya`) and the new 120-mantra Strapi entry (`Kathopanishad`, slug `kathopanishad`). The existing filter that is supposed to hide the legacy entry when the Strapi entry is present matches by hard-coded UUID (`2df8da41-1198-41ca-b4c7-5579f13e9fcb`), but production was seeded with a freshly generated UUID, so the filter never matches in production. Switching the filter to match by stable slug fixes the duplicate everywhere without breaking dev or the Strapi-down fallback path.

## Done looks like
- The Library catalog (Prasthana Thraya → Upanishad section) shows exactly one Katha card on the published site, the 120-mantra `Kathopanishad`.
- Visiting `/katha-upanishad-bhashya` (or `/katha-upanishad-bhashya/<n>`) on the published site still works — it redirects to the canonical `/kathopanishad` slug, preserving any existing bookmarks.
- If Strapi is unreachable, the legacy 26-mantra Katha still appears as a fallback (so users are never left without any Katha at all).
- Dev preview behaviour is unchanged — still shows exactly one Katha as it does today.

## Out of scope
- Removing or migrating the legacy 26-mantra rows from Postgres (kept as the offline fallback).
- Any change to other duplicate handling (Isha and Bhagavad Gita stay on `LOCAL_STRAPI_DUPLICATES`; only the Katha rule moves to slug-based matching).
- Cleanup of any other production-only data drift that isn't related to Katha.

## Steps
1. **Switch the legacy-hide rule from UUID to slug.** Change the `STRAPI_REPLACES_LOCAL` entry shape so each rule identifies the legacy local book by `localPgSlug` instead of `localPgId`. Update the `/api/books` filter to look up the local row by slug across the merged response and add that row's id to the hide-set when (and only when) the matching Strapi grantha is also present. Keep the conditional behaviour intact so the PG row still shows when Strapi is unreachable.
2. **Verify on the running dev server.** After the change, hit `/api/books` and confirm exactly one Katha entry (the Strapi `kathopanishad`) is returned. Confirm `/api/books/by-slug/katha-upanishad-bhashya` still resolves to the legacy PG row directly (so the slug-alias redirect in the client keeps working).
3. **Republish and visually confirm.** Restart the workflow, then publish; open the live Prasthana Thraya → Upanishad catalog and confirm only one Katha card shows.
4. **Update `replit.md`.** Update the "Strapi-Replaces-Local Promotion (Katha Upanishad)" section to note that matching is now slug-based and explain why (UUID isn't stable across DB re-seeds).

## Relevant files
- `server/routes.ts:30-68`
- `server/seed-katha-upanishad.ts:60-90`
- `client/src/App.tsx:50-70`
- `replit.md`
