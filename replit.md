# Ekatma Dham - Abode of Oneness

## Overview

Ekatma Dham is a digital platform dedicated to exploring the Isha Upanishad with comprehensive Shankaracharya Bhashya (commentary). The platform offers multi-script support (Devanagari, Kannada, Telugu, Tamil, English), verse-by-verse translations, and scholarly commentaries. It aims to celebrate Sanatana Dharma and the legacy of Adi Shankaracharya.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for URL-based book/verse navigation
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode)
- **Layout**: Sidebar-based with three main panels:
    1.  **AppSidebar**: Book navigation and search, supporting hierarchical structures (Adhyay > Khanda > Verse).
    2.  **BookReader**: Main content area with redesigned verse page layout:
        - **Verse card**: Sanskrit text in bordered card with transliteration below.
        - **Meaning section**: Labeled translation section below the verse.
        - **Bhashya tabs**: Author tabs (Shankar Bhashya, etc.) as clickable tab buttons.
        - **Read Tīkās toggle**: Reveals teeka panel alongside bhashya.
        - **Side-by-side layout**: Bhashya content card (left) + Teeka card with author dropdown (right) on large screens.
        - **Language selector**: Per-page language override at top-right.
        - Introduction page support for books with `BhashyakaraIntroduction` data from Strapi.
    3.  **TranslationPanel**: Displays translations and scholarly explanations.
- **Landing Page Introduction Source**: Each book/Upanishad landing page (`IntroSection` in `welcome-screen.tsx`) renders the introduction from the grantha-level **`IntroductionToText`** field (loaded as `book.description` via `IntroductionToTextEnglish`). The **`BhashyakaraIntroduction`** field is *never* shown on the landing page — it is only used as the verse-0 **"Sambandha Bhashyam"** content inside the reader (mapped by `mapIntroductionVerse` in `server/strapi.ts`).
- **Multi-Language Checkbox System**: Verse pages use a checkbox panel (not a dropdown) for language selection. Devanagari/Sanskrit is always locked on. English + user's preferred language are selected by default. Users can select multiple languages simultaneously; all selected languages' content is shown in the meaning, bhashya, and teeka sections with language labels. Language count badge shown on the selector button.
- **Homepage Search Bar**: Search bar on the homepage below "Browse the Library" button. Searches books by title, slug, author, category, and description. Shows dropdown with matching results; clicking a result navigates directly to that book.
- **Landing Page Drill-Down Navigation**: Book landing pages (Upanishads, Gita, Brahma Sutra, etc.) have a left sidebar with hierarchical drill-down navigation. Clicking a chapter expands to show khandas/vallis; clicking a khanda expands to show a grid of verse numbers. Clicking any verse number navigates directly to that mantra in the reader. The sidebar also shows commentator (Bhashyakara) and sub-commentator (Tikakara) info.
- **Header**: Clean horizontal nav bar with logo left, smart breadcrumb trail center (Home > Category > Subcategory > Book > Chapter > Verse), and icon controls (language, theme, auth) on right.
- **Category/Subcategory Pages**: Two-panel layout — left panel shows category overview + scripture tree, right panel shows book cards with title, author, description, and "OPEN TEXT" action.
- **Individual Upanishad Landing Pages**: Each of the 10 principal Upanishads (Isha, Kena, Katha, Prashna, Mundaka, Mandukya, Taittiriya, Aitareya, Chandogya, Brihadaranyaka) has a rich landing page with IAST title, Devanagari title, quote, introduction, structure breakdown, chapter tree, and "Open Text" CTA. Clicking an Upanishad from the grid shows this landing page first (like Gita/Brahma Sutra), with a back button to return to the grid.
- **Reader Navigation Sidebar**: Persistent left sidebar visible when reading any book. Shows book title, search box, and chapter/khanda/verse drill-down navigation. Current verse is highlighted. Auto-expands to active chapter/khanda. Hidden on mobile. Component: `ReaderNavSidebar` in `reader-nav-sidebar.tsx`.
- **Sidebar**: Left navigation sidebar has been removed. All navigation happens through the header breadcrumb trail and the landing page cards/buttons.

### Backend
- **Framework**: Express.js 5 (ESM modules)
- **API Pattern**: RESTful JSON API
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Repository pattern via `DatabaseStorage` and `HybridStorage` for Strapi fallback.
- **Key Features**:
    -   Verse retrieval, translations, and explanations.
    -   AI-powered word translation with RAG context (using OpenAI gpt-4o).
    -   User authentication (Replit OIDC and email/password).
    -   Personal user notes on verses.
    -   User preference management (language, author, theme).
    -   Comprehensive commentary data management with authoritative data sources and auto-correction.

### Strapi Manthra Deduplication (Vivekachudamani fix)
-   The CMS may contain accidental duplicate manthra records (different `documentId`s with the same `ShlokaManthraNumber` under the same section). For example, Vivekachudamani had 746 manthra rows in Strapi but only 543 unique `ShlokaManthraNumber`s (≈250 duplicates).
-   `_strapiGetBookByIdUncached`, `_strapiGetBookWithVerseMetaUncached`, and `mapGranthaToBook` all dedupe by **(a)** `documentId` and **(b)** `(adhyayNumber|khandaNumber|ShlokaManthraNumber)` while collecting verses, so the reader, nav sidebar, and library card counts all match.
-   Pagination of `/manthras` and `/sections` uses **stable sort** `sort[0]=order:asc, sort[1]=id:asc` to avoid page-boundary overlap when records share an `order` value.
-   Dropped duplicates are logged via `console.warn` so the data team can clean up the CMS.

### Server-Side Caching (Strapi)
-   **In-memory TTL cache** (24 hours) for all Strapi read operations in `server/strapi.ts`.
-   Cached: `strapiGetBookById` (full book with all verses), `strapiGetBookWithVerseMeta`, `strapiGetAllBooks`, individual verses, explanations, commentary options.
-   **Request deduplication**: Concurrent requests for the same resource share a single in-flight fetch via `dedup()`.
-   **Verse pre-population**: When a full book is loaded, all its verses are individually cached, so subsequent single-verse lookups are instant.
-   **Parallel section fetching**: `_strapiGetBookByIdUncached` collects all leaf sections (khandas) into a flat task list, then fetches their manthras with concurrency=8 using a worker pool. Critical for large books like Chandogya (~160 leaf sections).
-   **Cache invalidation**: `invalidateBookCache(bookId)` clears all caches for a specific book. TTL auto-expires after 24 hours.
-   Performance: Chandogya cold load ~2.3s (was 30-60s sequentially), cached ~40ms. Smaller books cold ~1-2s, cached ~8ms.

### Strapi CMS Integration
-   Acts as an optional hybrid storage layer for read operations (books, verses, translations, explanations).
-   Activates if `STRAPI_URL` and `STRAPI_API_TOKEN` environment variables are set.
-   Read operations prioritize Strapi; falls back to PostgreSQL if Strapi is unreachable.
-   Write operations (notes, word translation cache) always target PostgreSQL.
-   **All Strapi granthas are now shown** — no whitelist. Duplicates (Isha, Katha, Gita that exist in both local DB and Strapi) are handled by excluding Strapi duplicates via `LOCAL_STRAPI_DUPLICATES` in `routes.ts`.
-   Categories auto-mapped from `GranthaType`: `"Upanishad"` → Upanishad subcategory, `"Bhagavad Gita"/"Gita"` → Bhagavad Gita, `"Brahma Sutra"` → Brahma Sutra, `"Prakarana Grantha"` → Independent Advaita Works.

### Book Listing Enhancements
-   Book cards on the library catalog page show **Bhashyam name** (commentary title, e.g. "Shankara Bhashyam") and **Teeka names** (sub-commentary titles with authors, e.g. "Anandagiri Teeka — Anandagiri") fetched from Strapi's grantha-level `teekas` relation.
-   Data flows: `strapiGetAllBooks` → `mapGranthaToBook` adds `bhashyamName` and `teekasList` → API returns them → `welcome-screen.tsx` renders in `SubCategoryDetailView` and `CategoryDetailView`.

### Data Model
Supports multi-language sacred texts and user data:
-   `languages`: Definitions (code, name, script).
-   `books`, `bookTitles`: Sacred text metadata and localized titles.
-   `verses`, `verseTranslations`: Verse content and translations.
-   `explanations`: Scholar commentaries. Strapi-sourced explanations include a virtual `commentaryType` field (`"bhashya"` or `"teeka"`) for proper classification; DB-sourced explanations fall back to author name matching.
-   `wordTranslations`: Cached AI-generated word translations.
-   `notes`: User-specific notes.
-   `users`: User accounts with authentication details and preferences.
-   `sessions`: Session storage for authentication.

### Word-by-Word Meanings
-   **Pre-scraped**: Stored in `verse_word_meanings` for Bhagavad Gita verses, providing instant meanings via tooltips.
-   **AI-powered (RAG)**: For non-Gita texts, uses OpenAI gpt-4o to provide translation, grammatical analysis, and contextual meaning, with results cached.

### Verse Transliteration
-   **IAST**: Stored in Strapi's `ShlokaManthraEntry.IASTTransliteration` field via `server/strapi-transliterate.ts`.
-   **Indic scripts**: Computed on-the-fly from Devanagari using `@indic-transliteration/sanscript` (Kannada, Telugu, Tamil, Malayalam, Bengali, Gujarati, Odia, Punjabi, Assamese, Sinhala, Burmese, Thai, Tibetan, Cyrillic).
-   **API**: `POST /api/transliterate/queue` (queue IAST generation), `GET /api/transliterate/progress`, `POST /api/transliterate/preview` (on-the-fly preview).
-   **Status**: IAST completed for Aitareya (33), Prashna (68), Kena (35), Mandukya (234) Upanishads.
-   **Mundaka Upanishad**: Added (docId `qcbxoj6pwo01pgnr0hxloiun`, 65 manthras, 3 Mundakas × 2 Khandas each, has introduction, 1 teeka). Translation in progress for mantra/bhashyam/teeka in 43 languages.
-   **Safe Strapi saves**: Both `strapi-translate.ts` and `strapi-transliterate.ts` use a "re-fetch before write" pattern — every PUT to `/manthras` includes ALL fields (ShlokaManthraEntry, BhashyamEntry, Teekas) to prevent Strapi from wiping omitted inline components. Translation saves handle nginx 413 errors with a 3-tier fallback: full save → component-only save → chunked incremental save (10 at a time, then single). When at nginx capacity, remaining languages are gracefully skipped.
-   **Taittiriya Upanishad**: (docId `bdmo8krmbcc8rrpireu47mvt`, 57 manthras, 3 Adhyays, has introduction). Translation in progress. Some large bhashyam entries (e.g., Mantra 3.6.1) hit nginx size limit at ~33 translations.

### Per-Manthra Publish (server/strapi-publish.ts)
-   **Purpose**: Bulk-publishing a Strapi section/pada (e.g., Brahma Sutra 2.3) in the Strapi admin UI returns `504 upstream request timeout` because all manthras + 45-language translations are serialized into one request larger than nginx's upstream timeout.
-   **Solution**: Iterate manthras one-by-one and call Strapi v5's `POST /api/manthras/{documentId}/actions/publish` per manthra. This endpoint only flips `publishedAt` to push the current draft state — it does NOT write field data, so existing translations/bhashyam/teekas can never be overridden.
-   **Endpoints**:
    -   `POST /api/strapi/publish/grantha { granthaId }` — publish all manthras under a grantha
    -   `POST /api/strapi/publish/section { sectionDocId }` — publish all leaf manthras under a section/pada
    -   `POST /api/strapi/publish/manthra { manthraDocId }` — publish a single manthra
    -   `GET  /api/strapi/publish/status?jobId=<jobId>` — progress (jobs identified as `grantha:<id>`, `section:<id>`, `manthra:<id>`)
    -   `POST /api/strapi/publish/cancel { jobId }` — cancel a running job
-   Retries on 5xx/429 with exponential backoff (3 attempts), 300ms throttle between manthras, in-memory progress tracking.

### Build System
-   **Development**: Vite dev server.
-   **Production**: Vite for client, esbuild for server.
-   **Database Migrations**: Drizzle Kit.

## External Dependencies

### Database
-   **PostgreSQL**: Primary data store.
-   **Drizzle ORM**: Type-safe ORM.
-   **connect-pg-simple**: PostgreSQL session store.

### UI/UX
-   **Radix UI**: Accessible UI primitives.
-   **shadcn/ui**: Pre-styled components.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Lucide React**: Icon library.
-   **Google Fonts**: Noto Sans Devanagari, Noto Serif, Source Serif 4.

### Data Fetching
-   **TanStack React Query**: Server state management.

### AI/Language Processing
-   **OpenAI GPT-4o**: For AI word translations.

### Replit-Specific
-   `@replit/vite-plugin-runtime-error-modal`
-   `@replit/vite-plugin-cartographer`
-   `@replit/vite-plugin-dev-banner`

### Authentication
-   **Replit OIDC**: For external authentication.
-   **bcryptjs**: Password hashing for email/password authentication.