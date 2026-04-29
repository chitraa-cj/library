# Ekatma Dham - Abode of Oneness

## Overview

Ekatma Dham is a digital platform dedicated to exploring the Isha Upanishad with comprehensive Shankaracharya Bhashya (commentary). It provides multi-script support (Devanagari, Kannada, Telugu, Tamil, English), verse-by-verse translations, and scholarly commentaries. The project aims to celebrate Sanatana Dharma and the legacy of Adi Shankaracharya by offering a rich, accessible resource for scriptural study.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter for navigation.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with custom CSS variables for theming.
- **Layout**: Features a sidebar for book navigation, a main `BookReader` panel for content display, and a `TranslationPanel`. The `BookReader` includes redesigned verse cards, dedicated sections for meaning and bhashya, and a language selector.
- **Navigation**: Hierarchical drill-down navigation for books and verses, smart breadcrumbs, and a persistent `ReaderNavSidebar` for in-text navigation (hidden on mobile).
- **Content Display**: Multi-language checkbox system for simultaneous content display, introduction page support for books, and rich landing pages for individual Upanishads.
- **Search**: Homepage search bar for books by title, author, category, and description.

### Backend
- **Framework**: Express.js 5 (ESM modules).
- **API Pattern**: RESTful JSON API.
- **Database**: PostgreSQL with Drizzle ORM.
- **Storage**: Repository pattern with `DatabaseStorage` and `HybridStorage` for Strapi fallback.
- **Key Features**: Verse retrieval, translations, AI-powered word translation, user authentication, personal notes, user preference management, and comprehensive commentary data management.
- **Data Deduplication/Filtering**: Server-side logic handles duplicate manthra records and filters empty manthras from Strapi to ensure data integrity and accurate display.
- **Caching**: In-memory TTL cache (24 hours) for Strapi read operations with request deduplication and parallel section fetching for performance. Manual cache invalidation endpoint is provided.
- **Strapi CMS Integration**: Serves as an optional hybrid storage layer, prioritizing Strapi data with PostgreSQL fallback. All Strapi granthas are displayed, with logic to handle duplicates.
- **Data Model**: Supports multi-language sacred texts and user data including `languages`, `books`, `verses`, `explanations`, `wordTranslations`, `notes`, `users`, and `sessions`.
- **Word-by-Word Meanings**: Pre-scraped for Bhagavad Gita and AI-powered (OpenAI GPT-4o) for other texts, with caching.
- **Verse Transliteration**: IAST stored in Strapi, and other Indic scripts computed on-the-fly using `@indic-transliteration/sanscript`. Includes API for queueing, progress tracking, and previewing IAST generation.
- **Per-Manthra Publish**: Solution for bulk-publishing Strapi sections by iterating and publishing manthras individually to avoid timeout issues.

### Build System
- **Development**: Vite dev server.
- **Production**: Vite for client, esbuild for server.
- **Database Migrations**: Drizzle Kit.

## External Dependencies

### Database
- **PostgreSQL**
- **Drizzle ORM**
- **connect-pg-simple**

### UI/UX
- **Radix UI**
- **shadcn/ui**
- **Tailwind CSS**
- **Lucide React**
- **Google Fonts**: Noto Sans Devanagari, Noto Serif, Source Serif 4

### Data Fetching
- **TanStack React Query**

### AI/Language Processing
- **OpenAI GPT-4o**

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`

### Authentication
- **Replit OIDC**
- **bcryptjs**

## Strapi Data Integrity Notes

### Dedup
- Manthras are deduplicated by `(documentId)` and by `(adhyayNumber|khandaNumber|ShlokaManthraNumber)` in `_strapiGetBookByIdUncached`, `_strapiGetBookWithVerseMetaUncached`, and `mapGranthaToBook`. Pagination of `/manthras` and `/sections` uses stable sort `sort[0]=order:asc, sort[1]=id:asc`.

### Empty Manthra Filtering
- A manthra is treated as **empty** (and skipped) when *all* of `ShlokaManthraEntry`, `BhashyamEntry`, and every `Teekas[].TeekaEntry` have no `SanskritTextEntry`, no `EnglishTranslationText`, no `IASTTransliteration`, and no `OtherTranslations`. Single source of truth: `isManthraNonEmpty(m)` in `server/strapi.ts`.
- `_strapiGetBookByIdUncached` calls it directly. `_strapiGetBookWithVerseMetaUncached` calls `fetchNonEmptyManthraDocIds(granthaDocId)` once up-front (sections endpoint only shallow-populates manthras) and filters by docId. Both deep-populate `*.OtherTranslations` so a manthra containing only translated content is still kept.
- Empty manthras are intentionally **not** added to the seen-docId/seen-numberKey sets, so a non-empty duplicate appearing later (mid CMS-cleanup) can still win.
- Skipped manthras are logged via `console.warn`.
- **Caveat**: home-page book-listing card counts (`strapiGetAllBooks`) are raw CMS row counts and may be 1–2 higher than the filtered counts shown inside the reader. The reader paths are always self-consistent.

### Manual Cache Invalidation
- `POST /api/strapi/cache/invalidate { bookId }` clears all in-memory Strapi caches for one grantha (book detail, verse meta, individual verses, explanations, commentary options) so freshly-edited CMS data shows up without waiting for the 24-hour TTL or restarting the server. Use this after publishing/editing manthras in Strapi.

### Strapi-Replaces-Local Promotion (Katha Upanishad)
- The legacy PG Katha (`2df8da41-1198-41ca-b4c7-5579f13e9fcb`) only had 26 verses in 1 adhyaya, starting with `sectionTitle="1.1.4"`. The sidebar's `verseLabelMap` re-labels verses by index, so vn=4 was mislabeled `1.1.1`, causing the user-visible bug "1.1.1 shows the 4th śloka".
- The Strapi Katha (docId `t2d3crlf4ptuadp73lziogy5`, slug `kathopanishad`) is complete: 120 mantras across 2 adhyāyas (Prathama 71 + Dvitiya 49).
- `server/routes.ts` defines `STRAPI_REPLACES_LOCAL = [{ strapiDocId, localPgId }, …]`. In `GET /api/books`, a legacy PG entry is filtered out **only when** its corresponding Strapi grantha is present in the same merged response — preserving DB-fallback behavior if Strapi is unreachable.
- `client/src/App.tsx` defines `SLUG_ALIASES = { "katha-upanishad-bhashya": "kathopanishad" }`. The URL-bootstrap effect rewrites the legacy slug to the canonical one (preserving any tail like `/1`), so old bookmarks keep working.
- Isha and BG remain on PG-canonical via `LOCAL_STRAPI_DUPLICATES` (Strapi versions hidden from listing).