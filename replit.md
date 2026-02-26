# Ekatma Dham - Abode of Oneness

## Overview

Ekatma Dham is a digital platform for exploring the Isha Upanishad with complete Shankaracharya Bhashya (commentary). The platform provides multi-script support (Devanagari, Kannada, Telugu, Tamil, English), verse-by-verse translations, and scholarly commentaries celebrating Sanatana Dharma and the legacy of Adi Shankaracharya. The branding and logo are from oneness.org.in.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router) with URL-based book/verse navigation
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with path aliases (`@/` for client source, `@shared/` for shared code)

The frontend uses a sidebar-based layout with three main panels:
1. **AppSidebar**: Book navigation and search, grouped by category. Supports hierarchical nested tree: Adhyay > Khanda > Verse with numeric labels (e.g., 1.1.2). Falls back to flat verse list if no hierarchy data.
2. **BookReader**: Main content area displaying verses with commentary selection (author/language dropdowns). Shows numeric position label (e.g., 1.1.2) in verse header and title area.
3. **TranslationPanel**: Shows translations in different scripts and scholarly explanations

The header displays a breadcrumb navigation showing the current position: Book > Adhyay > Khanda > Verse with a numeric badge.

### Backend Architecture
- **Framework**: Express.js 5 (ESM modules)
- **API Pattern**: RESTful JSON API with `/api/` prefix
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Storage Pattern**: Repository pattern via `DatabaseStorage` class implementing `IStorage` interface

Key API endpoints:
- `GET /api/books` - List all books
- `GET /api/books/by-slug/:slug` - Get book by URL slug
- `GET /api/books/:id` - Get book with details and verses
- `GET /api/books/:id/commentary-options` - Get available authors and languages for commentaries
- `GET /api/verses/:id` - Get single verse with translations
- `GET /api/verses/:id/translations` - Get all translations for a verse
- `GET /api/verses/:id/explanations` - Get scholarly explanations
- `POST /api/translate-word` - AI-powered word translation with RAG context (uses OpenAI gpt-4o)
- `GET /api/verses/:id/notes` - Get user's notes for a verse (auth required)
- `POST /api/verses/:id/notes` - Create a note on a verse (auth required)
- `PATCH /api/notes/:id` - Update a note (auth required)
- `DELETE /api/notes/:id` - Delete a note (auth required)
- `PATCH /api/user/preferences` - Save user preferences (language, author, theme; auth required)
- `GET /api/authors` - List all distinct commentary authors
- `GET /api/auth/user` - Get current authenticated user
- `/api/login` - Begin login flow (Replit OIDC)
- `/api/logout` - Begin logout flow

### Data Model
The database schema supports multi-language sacred texts:
- **languages**: Language definitions with code, name, native name, and script
- **books**: Sacred text metadata (title, author, description, category)
- **bookTitles**: Localized book titles for different languages
- **verses**: Individual verses with hierarchical organization (adhyayNumber, adhyayTitle, khandaNumber, khandaTitle for Adhyay > Khanda > Verse structure)
- **verseTranslations**: Verse content in different languages/scripts
- **explanations**: Scholar commentaries on verses
- **wordTranslations**: Cached AI-generated word translations for performance
- **notes**: Personal user notes on verses (userId, verseId, content, timestamps)
- **users**: User accounts (Replit Auth OIDC - id, email, firstName, lastName, profileImageUrl, preferredLanguage, preferredAuthor, preferredTheme)
- **sessions**: Session storage for authentication

### Word-by-Word Meanings (Direct Mapping)
- **Table**: `verse_word_meanings` stores pre-scraped word-meaning pairs per verse (word, meaning, position)
- **Source**: Scraped from bhagavadgita.com for all Bhagavad Gita verses (694/701 covered)
- **API**: `GET /api/verses/:id/word-meanings` returns all word meanings for a verse
- **Seed Scripts**: `server/seed-word-meanings.ts` (individual), `server/seed-word-meanings-grouped.ts` (combined verses)
- **Flow**: Click word → Tooltip shows all word-by-word meanings instantly (no AI call needed)
- **Fallback**: For verses without pre-scraped meanings (e.g., non-Gita texts), falls back to AI analysis

### AI Word Translation (RAG Feature)
- **Component**: `WordTooltip` in `client/src/components/word-tooltip.tsx`
- **Backend**: `server/openai.ts` using OpenAI gpt-4o model
- **Flow**: For non-Gita texts: Click word → AI analysis tooltip appears
- **Features**: Translation, grammatical analysis, etymology, contextual meaning based on Shankaracharya's commentary
- **Caching**: Results cached in `wordTranslations` table to avoid repeated API calls

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: 
  - Client: Vite builds to `dist/public`
  - Server: esbuild bundles to `dist/index.cjs` with selective dependency bundling
- **Database Migrations**: Drizzle Kit with `db:push` command

## External Dependencies

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe SQL query builder and schema management
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI Framework
- **Radix UI**: Full suite of accessible, unstyled primitives (dialog, dropdown, tabs, etc.)
- **shadcn/ui**: Pre-styled components using Radix primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Data Fetching
- **TanStack React Query**: Server state management with caching and automatic refetching

### Fonts
- **Google Fonts**: Noto Sans Devanagari, Noto Serif, Source Serif 4 for multi-script support

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicator

### Authentication
- **Dual auth**: Supports both Replit OIDC (Google, GitHub, etc.) and email/password registration/login
- **Email auth**: bcryptjs password hashing, session-based with connect-pg-simple store
- **Auth page**: `/auth` route with login/register tabs (client/src/pages/auth-page.tsx)
- **Session compatibility**: Passport v0.6+ polyfill for regenerate/save on session store
- **Password field**: Added to users table (nullable, only set for email-registered users)

### Seed & Data Integrity Architecture
The commentary data (Shankaracharya bhashya, Anandagiri teeka, etc.) uses a multi-layer protection system:

1. **`seedDatabase()`** (server/seed.ts): Runs ONCE when database is empty. Creates all verses, translations, and commentary entries. Verse 0 (introduction) Anandagiri teeka is created here directly.
2. **`seedAdditionalCommentaries()`** (server/seed.ts): Adds Hiriyanna, Anandagiri (v1-18), Sudarsana, and English Shankaracharya commentaries. Only inserts if the entry doesn't already exist (won't overwrite).
3. **`updateIncompleteShankaraExplanations()`** (server/index.ts): Runs on EVERY restart. Compares DB content length against authoritative data in `server/complete-bhashya-data.ts`. If DB content is shorter (truncated), replaces it with the full version. Covers ALL verses 0-18 in all 5 languages. **Skips entries with isAiTranslated=true**.
4. **`server/complete-bhashya-data.ts`**: Authoritative source for complete Shankaracharya bhashya in devanagari, english, kannada, tamil, telugu for ALL 19 verses (0-18).
5. **`syncAuthoritativeCommentaryData()`** (server/seed.ts): Syncs authoritative commentary data. **Skips entries with isAiTranslated=true** to preserve AI translations.

**Key Points:**
- MANTRAS in seed.ts may have truncated bhashya; the full content is maintained in complete-bhashya-data.ts
- Manual DB fixes to commentary content persist across restarts (since seedDatabase only runs once)
- The auto-update function provides an additional safety net against content truncation
- AI-translated entries (isAiTranslated=true) are never overwritten by seed/sync functions

### AI Translation Coverage
- **Isha Upanishad - Shankaracharya Bhashyam**: Available in devanagari, english, tamil (original) + telugu, kannada, german, french, spanish, hindi, mandarin, arabic (AI-translated)
- **Isha Upanishad - Anandagiri Teeka**: Available in devanagari, kannada, tamil, telugu (original) + spanish, french, german, hindi, mandarin, arabic (AI-translated)
- **Bhagavad Gita - Verse Translations**: Available in english, sanskrit (original) + german, french, spanish, mandarin, arabic (AI-translated, 701 verses each)
- **Bhagavad Gita - Sri Shankaracharya Commentary**: Available in english, hindi (original) + german, french, spanish, mandarin, arabic (AI-translated, 701 verses each)
- **Language code aliasing**: Hindi uses "hi"/"hindi", German uses "de"/"german", French uses "fr"/"french", Spanish uses "es"/"spanish", Mandarin uses "zh"/"mandarin"/"chinese", Arabic uses "ar"/"arabic" in DB vs UI; client-side LANG_ALIASES handles normalization in book-reader.tsx and translation-panel.tsx
- **Global Interface**: UI strings available in 11 languages: en, hi, sa, kn, te, ta, de, fr, es, zh, ar (client/src/lib/translations.ts)
- **Translation scripts**: `server/translate-teeka-and-hindi.ts` for Isha teeka + Hindi, `server/seed-european-translations.ts` for all non-South-Indian language translations (German/French/Spanish/Mandarin/Arabic)

## Notes
- **SIGHUP Handler**: The server registers a SIGHUP handler at the top of `server/index.ts` to prevent the Replit workflow system's SIGHUP signals from killing the process. Without this, the app crashes ~25-30 seconds after startup.
- **Request Logging**: The Express request logger in `server/index.ts` logs method/path/status/duration only (no response body capture) to avoid heavy JSON.stringify operations on large translation responses.
- **Background Translation Tasks**: `seedGitaAllLanguages`, `seedKathaAllLanguages`, and `seedEuropeanTranslations` are NOT run on startup. Run manually when needed via `npx tsx server/seed-gita-all-languages.ts` etc.
- **SendGrid Integration**: User dismissed the Replit SendGrid connector and chose to leave email OTP authentication out for now. Can revisit later if needed.
- **Branding**: Main header uses "Advaita Vaaridhi - Encyclopaedia of Advaita Vedanta". Sidebar still shows "Ekatma Dham - Abode of Oneness" branding with oneness.org.in logo.
- **Book-specific media**: Videos/audio are per-book, configured in `bookMediaConfig` (book-reader.tsx) and `bookVideoConfig` (welcome-screen.tsx). Only books with config show video. Currently only Isha Upanishad has a video.
- **Mobile panel behavior**: On mobile, the translation panel (bottom sheet) auto-opens once when a book first loads, then only opens when manually triggered. Controlled via `mobileInitialPanelShown` state in App.tsx, reset on book change.
- **Language selector in header**: A compact language dropdown is always visible in the top navigation bar (Globe icon + Select). Users can change the translation language at any time without logging in. Changing language here updates the app globally and persists to localStorage (and to the database if logged in).
- **User Preferences (Configure button)**: Header has a gear icon that opens a preferences dialog (requires login). Users can set language, preferred commentator, and light/dark theme. Preferences are saved to the database and applied on app load. The language in the Configure dialog stays in sync with the header language selector. Component: `client/src/components/preferences-dialog.tsx`.
- **Startup cleanup**: `cleanupDuplicateTranslations()` and `fixIncompleteTranslations()` run on every startup. They deduplicate verse_translations and explanations (keeping longest content), and fix known incomplete translations (e.g., Konkani bhashya for Isha verse 9). Safe to run repeatedly — they skip if no issues found.
- **Word tooltip languages**: The AI word translation tooltip supports all 43 languages in its "Translate to:" dropdown. The `LANG_CODE_TO_TOOLTIP` mapping in word-tooltip.tsx maps all language codes to their full names for the dropdown.