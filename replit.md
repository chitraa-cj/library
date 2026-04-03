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
    2.  **BookReader**: Main content area for verses and commentary selection. Includes introduction page support for books with `BhashyakaraIntroduction` data from Strapi (rendered as verse 0 with `sectionTitle: "Introduction"`).
    3.  **TranslationPanel**: Displays translations and scholarly explanations.
- **Header**: Breadcrumb navigation showing current book position.

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

### Strapi CMS Integration
-   Acts as an optional hybrid storage layer for read operations (books, verses, translations, explanations).
-   Activates if `STRAPI_URL` and `STRAPI_API_TOKEN` environment variables are set.
-   Read operations prioritize Strapi; falls back to PostgreSQL if Strapi is unreachable.
-   Write operations (notes, word translation cache) always target PostgreSQL.

### Data Model
Supports multi-language sacred texts and user data:
-   `languages`: Definitions (code, name, script).
-   `books`, `bookTitles`: Sacred text metadata and localized titles.
-   `verses`, `verseTranslations`: Verse content and translations.
-   `explanations`: Scholar commentaries.
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
-   **Status**: IAST completed for Aitareya (33), Prashna (68), Kena (35) Upanishads.

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