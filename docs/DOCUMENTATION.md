# Advaita Vaaridhi — Sacred Script Hub

**Full technical and user documentation**

This document describes the **Advaita Vaaridhi Digital Library** application (repository: *Sacred-Script-Hub*): what it does, how to use it, how it is structured, how to set it up locally or in production, and every public HTTP API exposed by the server.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Features](#2-features)
3. [Usage guide](#3-usage-guide)
4. [Application architecture](#4-application-architecture)
5. [Project structure](#5-project-structure)
6. [Data model](#6-data-model)
7. [Content sources: Strapi and PostgreSQL](#7-content-sources-strapi-and-postgresql)
8. [Environment variables](#8-environment-variables)
9. [Local development setup](#9-local-development-setup)
10. [Production build and deployment](#10-production-build-and-deployment)
11. [REST API reference](#11-rest-api-reference)
12. [Authentication and sessions](#12-authentication-and-sessions)
13. [Strapi CMS integration](#13-strapi-cms-integration)
14. [Admin and pipeline APIs](#14-admin-and-pipeline-apis)
15. [Cover images and static assets](#15-cover-images-and-static-assets)
16. [Scripts and maintenance](#16-scripts-and-maintenance)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Introduction

**Advaita Vaaridhi** is a digital library for **Advaita Vedanta** texts. It presents canonical scriptures and commentaries—especially Śrī Śaṅkarācārya’s bhāṣyas—with:

- Multi-language **verse translations** and **commentary** (bhāṣya / ṭīkā)
- A structured **catalog** (Prasthāna Traya, Prakaraṇa granthas, and more)
- **Per-verse reading** with navigation by chapter (adhyāya), section (khaṇḍa/valli), and mantra number
- **Sambandha Bhāṣyam / Introduction** pages where the CMS defines them
- Optional **user accounts** for notes, reading progress, and preferences
- **Guru-paramparā (Acharya)** profiles from a linked CMS database

The app is a **single-page React application** served by an **Express** server. In development, **Vite** provides hot module replacement. In production, the client is built to static files and served by the same Node process.

**Primary audiences**

| Audience | What they use |
|----------|----------------|
| Readers | Home → catalog → book landing → reader |
| Developers | This repo, `/api/*`, Strapi CMS, PostgreSQL |
| Content editors | Strapi admin + webhooks to invalidate cache |
| Operators | `.env`, deploy scripts, translation/publish APIs |

---

## 2. Features

### 2.1 Library catalog

- **Home screen** with Prasthāna Traya entry points, Prakaraṇa list, search, and “Browse the Library”
- **Three top-level categories** (see `CATALOG_TREE` in `client/src/components/app-sidebar.tsx`):
  - **Prasthāna Thraya** — Upanishads, Bhagavad Gītā, Brahma Sūtra
  - **Prakaraṇa Granthas** — Independent Advaita works, other Gītās, bhakti texts, etc.
  - **Other Texts** — Stotras, other ācārya commentaries, etc.
- **Upanishad hub** with **Principal** (10 classical) vs **Other** Upanishads, cover art, and landing pages
- **Acharyas page** — lineage profiles from `/api/acharyas`

### 2.2 Book reader

- **Cover / table of contents** before reading
- **Introduction / Sambandha Bhāṣyam** when verse `0` exists with section title `introduction` or `sambandha bhashyam`
- **Single-verse view** with Devanagari, transliteration, translations, and commentary panels
- **Chapter view** — all mantras in an adhyāya (or khaṇḍa) in one scrollable page
- **Multi-language commentary** — select multiple languages; bhāṣya and ṭīkā panels scroll independently when side-by-side
- **Word tooltips** — click words for AI-assisted glosses (cached in PostgreSQL)
- **Keyboard navigation** — arrow keys between verses
- **URL routing** — `/{book-slug}/{verseNumber}` deep links
- **Reader nav sidebar** — hierarchical chapter / mantra tree with previews

### 2.3 User features (authenticated)

- **Email/password registration and login**
- **Replit OIDC** (optional, when `REPL_ID` is set)
- **Personal notes** on verses (highlight text → add note)
- **Reading progress** — mark verses complete; progress bars on catalog cards
- **Preferences** — default commentary language, preferred author, light/dark theme
- **My Library** panel — continue reading, progress summary

### 2.4 Content pipeline (operator)

- **Strapi → app** with in-memory cache, pre-warm on startup, webhooks for invalidation
- **Bulk translation jobs** (Gemini) for Strapi granthas
- **Transliteration queue** for Sanskrit content
- **Per-manthra publish** to Strapi (avoids gateway timeouts on bulk publish)
- **Local PostgreSQL seed** and fallback when Strapi is unavailable

### 2.5 Internationalization

- UI strings in `client/src/lib/translations.ts` (many Indic and European languages)
- Content-level translations in `client/src/lib/content-translations.ts`
- Header language picker applies globally to commentary language

---

## 3. Usage guide

### 3.1 Finding a text

1. Open the app (default route `/`).
2. Use **Browse the Library** or the **Prasthāna Traya** cards.
3. Navigate **Category → Subcategory → Book** (e.g. Prakaraṇa Granthas → Independent Advaita Works → Vivekachudamani).
4. For Upanishads: **Upanishad → Principal or Other → pick a text**.

Alternatively, use the **home search bar** or open a direct link: `https://your-host/{slug}/{verseNumber}`.

### 3.2 Reading flow

1. **Landing page** (when configured) — cover image, introduction snippet, structure, **Open Text**.
2. **Cover / TOC** inside the reader — start reading or open **Sambandha Bhāṣyam / Introduction**.
3. **Verse view** — change language(s) via the Languages control; use sidebar or arrows to move between mantras.
4. **Chapter view** — open a chapter from TOC or sidebar to read all mantras in that section together.

### 3.3 Accounts

1. Go to **Log in** (header) → register or sign in.
2. Open **Preferences** (gear) to set default language, author, theme.
3. Select text in the reader → **Add Note**.
4. Progress is tracked automatically when verses are marked complete (where enabled).

### 3.4 Sidebar navigation

On catalog pages with long book lists (e.g. Independent Advaita Works), the **left Texts & Chapters panel scrolls independently** so you can reach all entries. In the reader, the **Reader Nav Sidebar** shows the full hierarchy for the open book.

---

## 4. Application architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                       │
│  App.tsx → WelcomeScreen | BookReader | AcharyasPage | Auth     │
│  TanStack Query → fetch /api/*                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (same origin)
┌────────────────────────────▼────────────────────────────────────┐
│                    Express 5 (server/index.ts)                   │
│  • Session (connect-pg-simple)                                   │
│  • Auth routes (email + optional Replit OIDC)                    │
│  • REST API (server/routes.ts)                                   │
│  • Acharya routes (server/acharyas.ts)                           │
│  • Vite dev middleware OR static dist (production)               │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
    ┌────────▼────────┐            ┌───────▼────────┐
    │   PostgreSQL    │            │  Strapi CMS    │
    │ sacred_script_  │            │  (optional)    │
    │ hub             │            │  granthas,     │
    │ users, notes,   │            │  manthras,     │
    │ progress, cache │            │  bhashyas      │
    └────────┬────────┘            └────────────────┘
             │
    ┌────────▼────────┐
    │  ekatmadham DB  │  (optional, acharya_profiles)
    └─────────────────┘
```

**Hybrid storage** (`server/storage.ts` — `HybridStorage`):

- If Strapi is configured **and reachable**, content reads prefer Strapi.
- On failure, operations **fall back** to PostgreSQL (`DatabaseStorage`).
- Book list merges Strapi granthas with local books; legacy PG duplicates are hidden when Strapi canonical IDs are present (`server/strapi-merge-policy.ts`).

---

## 5. Project structure

```
Sacred-Script-Hub/
├── client/                    # React frontend (Vite)
│   ├── public/
│   │   └── images/upanishads/ # Local cover PNGs
│   └── src/
│       ├── App.tsx            # Root layout, routing, global state
│       ├── components/
│       │   ├── welcome-screen.tsx   # Home, catalog, Upanishad hub, landings
│       │   ├── book-reader.tsx      # Reader, intro, chapter view
│       │   ├── reader-nav-sidebar.tsx
│       │   ├── app-sidebar.tsx      # CATALOG_TREE, main sidebar
│       │   ├── book-landing-cover-hero.tsx
│       │   ├── acharyas-page.tsx
│       │   └── ui/                  # shadcn/Radix components
│       ├── lib/
│       │   ├── translations.ts      # UI i18n
│       │   ├── content-translations.ts
│       │   ├── upanishad-cover-images.ts
│       │   ├── queryClient.ts
│       │   └── last-read.ts
│       └── pages/
│           ├── auth-page.tsx
│           └── translate-page.tsx
├── server/
│   ├── index.ts               # Express bootstrap, seed on startup
│   ├── routes.ts              # Main REST API
│   ├── storage.ts             # HybridStorage
│   ├── strapi.ts              # Strapi client + cache
│   ├── strapi-merge-policy.ts
│   ├── strapi-webhook.ts
│   ├── db.ts                  # Drizzle + pg pool
│   ├── seed*.ts               # Data seeding
│   └── replit_integrations/auth/
├── shared/
│   └── schema.ts              # Drizzle tables + TS types
├── scripts/
│   └── generate-upanishad-cover-manifest.mjs
├── script/
│   └── build.ts               # Production build
├── docs/
│   └── DOCUMENTATION.md       # This file
├── .env.example
├── drizzle.config.ts
└── package.json
```

### 5.1 Frontend routing (wouter)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `HomePageContent` | Library home, catalog, reader |
| `/auth` | `AuthPage` | Login / register |
| `/translate` | `TranslatePage` | Translation utilities (if enabled) |
| `/{slug}` | Book by slug | Opens reader for book |
| `/{slug}/{n}` | Verse deep link | Opens specific mantra |
| `/acharyas`, `/acharyas/:slug` | Acharyas | Guru-paramparā |

Internal navigation uses React state (`selectedBookId`, `selectedCategoryId`, etc.) as well as URL updates for books and verses.

### 5.2 Key frontend modules

| Module | Responsibility |
|--------|----------------|
| `welcome-screen.tsx` | Catalog UI, `BookLandingPage`, Upanishad principal/other logic, `CategoryDetailView`, `SubCategoryDetailView` |
| `book-reader.tsx` | Verse fetching, commentary layout, intro/cover/chapter modes |
| `app-sidebar.tsx` | `CATALOG_TREE`, book hierarchy builder, sidebar search |
| `upanishad-cover-images.ts` | Maps book slug/title → `/images/upanishads/{stem}.png` |

---

## 6. Data model

Defined in `shared/schema.ts` (PostgreSQL via Drizzle).

### 6.1 Content tables (local fallback / cache)

| Table | Purpose |
|-------|---------|
| `books` | Title, slug, author, category, cover, totalVerses |
| `verses` | verseNumber, sectionTitle, adhyay/khanda hierarchy |
| `verse_translations` | Per-verse text by language |
| `explanations` | Commentary by author + language |
| `book_titles` | Localized book titles |
| `languages` | Language catalog |
| `verse_word_meanings` | Precomputed word glosses |
| `word_translations` | AI word tooltip cache |

### 6.2 User tables

| Table | Purpose |
|-------|---------|
| `users` | Profile, email, password hash, preferences |
| `sessions` | Express session store (required for auth) |
| `notes` | User notes (`verseId` is opaque — may be Strapi doc id) |
| `verse_progress` | Completed verses per user per book |

### 6.3 API types (TypeScript)

- `Book`, `Verse`, `VerseWithTranslations`
- `BookWithVerseMeta` — book + lightweight verse list (id, numbers, titles, preview snippet)
- `BookWithDetails` — full book with all verse bodies (heavy)

Strapi uses **document IDs** (short alphanumeric strings) as book/verse ids in API responses when CMS is active.

---

## 7. Content sources: Strapi and PostgreSQL

### 7.1 When Strapi is used

Set `STRAPI_URL` and `STRAPI_API_TOKEN`. On startup the server:

1. Tests Strapi connectivity.
2. **Pre-warms** cached granthas (configurable concurrency).
3. Serves list/detail/verse endpoints from Strapi through `HybridStorage`.

### 7.2 Merge policy

`server/strapi-merge-policy.ts`:

- **`STRAPI_REPLACES_LOCAL`** — hide PG book when Strapi grantha exists (Isha, Gita, Katha).
- **`BOOK_SLUG_ALIASES`** — map legacy slugs to CMS slugs (e.g. `isha-upanishad-bhashya` → `ishavasya-upanishad`).

### 7.3 Caching

- In-memory Strapi cache with TTL (`STRAPI_CACHE_TTL_MS`, default 5 minutes).
- Webhook `POST /api/strapi/webhook` invalidates on publish/update/delete.
- Manual invalidation: `POST /api/strapi/cache/invalidate`.

### 7.4 PostgreSQL role

- User data (always local).
- Seed data and offline fallback.
- Word translation cache.
- Optional canonical copies of select texts.

---

## 8. Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

### 8.1 Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`postgres://user:pass@host:5432/sacred_script_hub`) |
| `SESSION_SECRET` | Random string for signing session cookies (`openssl rand -hex 32`) |

### 8.2 Strongly recommended

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Word tooltip translations (`POST /api/translate-word`) |

### 8.3 Strapi (content CMS)

| Variable | Description |
|----------|-------------|
| `STRAPI_URL` | Base URL of Strapi instance |
| `STRAPI_API_TOKEN` | API token with read (and publish if using publish APIs) access |
| `STRAPI_WEBHOOK_SECRET` | Shared secret for webhook + cache invalidate |
| `STRAPI_CACHE_TTL_MS` | Cache TTL (default `300000`) |
| `STRAPI_TIMEOUT_MS` | HTTP timeout (default `60000`) |
| `STRAPI_HEAVY_TIMEOUT_MS` | Large book fetches (default `120000`) |
| `STRAPI_SECTION_FETCH_CONCURRENCY` | Parallel section fetches (default `4`) |
| `STRAPI_PREWARM_CONCURRENCY` | Startup pre-warm (default `1`) |
| `STRAPI_TLS_SKIP_VERIFY` | `1` for local dev only if TLS fails |

### 8.4 Auth (optional)

| Variable | Description |
|----------|-------------|
| `REPL_ID` | Enables Replit OIDC (`/api/login`, `/api/callback`) |
| `ISSUER_URL` | OIDC issuer override |

Email/password auth works **without** Replit variables.

### 8.5 Server

| Variable | Description |
|----------|-------------|
| `PORT` | Listen port (dev default **5050** if unset; prod default **8080**) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_SSL` | `verify` \| `no-verify` \| `false` for RDS/local |

### 8.6 Acharya database (optional)

| Variable | Description |
|----------|-------------|
| `ACHARYA_DATABASE_URL` | Defaults to `DATABASE_URL` with DB name `ekatmadham` |

### 8.7 Pipeline scripts only

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini translation/transliteration/publish helpers |

---

## 9. Local development setup

### 9.1 Prerequisites

- **Node.js** 20+ (project uses ES modules)
- **PostgreSQL** 14+ with database `sacred_script_hub` created
- Optional: running **Strapi** instance with granthas populated

### 9.2 Steps

```bash
# 1. Clone and install
git clone <repository-url>
cd Sacred-Script-Hub
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL, SESSION_SECRET, optionally STRAPI_* and OPENAI_API_KEY

# 3. Push schema to database
npm run db:push

# 4. Start dev server (Express + Vite HMR)
npm run dev
```

Open **http://localhost:5050** (or the port logged in the terminal).

> **macOS note:** Port 5000 is often used by AirPlay. Dev defaults to **5050** unless `PORT` is set.

### 9.3 Type checking

```bash
npm run check
```

### 9.4 Database connectivity test

```bash
npm run db:test
```

### 9.5 Upanishad cover manifest

After adding PNGs under `client/public/images/upanishads/`:

```bash
npm run generate:upanishad-covers
```

---

## 10. Production build and deployment

### 10.1 Build

```bash
npm run build
```

This:

1. Builds the Vite client to `dist/public/`
2. Bundles the server to `dist/index.cjs` (esbuild)

Schema push is **skipped** during production build (see `script/build.ts`).

### 10.2 Run

```bash
NODE_ENV=production npm start
```

Ensure `DATABASE_URL`, `SESSION_SECRET`, and Strapi variables are set in the deployment environment. Platform `PORT` is usually injected (e.g. 8080 on AWS).

### 10.3 Static assets

Production serves the built SPA from `dist/public`. API routes remain under `/api/*`. All non-API GET requests fall through to `index.html` for client routing.

### 10.4 Startup seed operations

On listen, `server/index.ts` runs idempotent seed/repair jobs (commentary sync, Gita seed, Katha seed, etc.). Failures are logged but do not stop the server.

---

## 11. REST API reference

Base URL: same origin as the app (e.g. `http://localhost:5050`).

**Common headers**

- `Content-Type: application/json` for POST/PATCH bodies
- Session cookie `connect.sid` for authenticated routes (set by login/register)

**Cache headers**

- Content endpoints use `Cache-Control: private, no-cache, must-revalidate` where noted in code.

### 11.1 Health

#### `GET /api/health`

Returns `200` with body `OK`.

---

### 11.2 Books and catalog

#### `GET /api/books`

List all books. Merges Strapi granthas with local PG books; hides superseded local copies per merge policy.

**Response:** `Book[]`

```json
[
  {
    "id": "bdmo8krmbcc8rrpireu47mvt",
    "slug": "ishavasya-upanishad",
    "title": "Ishavasya upanishad",
    "author": "Sri Shankaracharya",
    "description": "...",
    "category": "Upanishad Bhashya",
    "coverImage": null,
    "totalVerses": 19
  }
]
```

#### `GET /api/books/by-slug/:slug`

Single book metadata by slug (aliases resolved).

**Response:** `Book` or `404`

#### `GET /api/books/:id`

Book with **verse metadata only** (no full mantra text). Used for navigation and TOC.

**Response:** `BookWithVerseMeta`

```json
{
  "id": "...",
  "slug": "mundaka-upanishad-",
  "title": "Mundaka Upanishad",
  "verses": [
    {
      "id": "...",
      "verseNumber": 1,
      "sectionTitle": null,
      "adhyayNumber": 1,
      "adhyayTitle": "Mundaka I",
      "khandaNumber": 1,
      "khandaTitle": "...",
      "preview": "..."
    }
  ]
}
```

#### `GET /api/books/:id/chapter/:adhyayNumber/verses`

All verses (with translations/explanations) for one adhyāya.

**Response:** `VerseWithTranslations[]`

#### `GET /api/books/:id/commentary-options`

Available commentary authors and languages for a book.

**Response:**

```json
{
  "authors": [
    {
      "authorName": "Sri Shankaracharya",
      "authorTitle": null,
      "languageCodes": ["english", "hindi", "devanagari"],
      "commentaryType": "bhashya"
    }
  ],
  "languages": [
    { "code": "english", "name": "English" }
  ]
}
```

---

### 11.3 Verses

#### `GET /api/verses/:id`

Full verse with translations and explanations.

**Response:** `VerseWithTranslations`

#### `GET /api/verses/:id/translations`

Translation rows only.

**Response:** `VerseTranslation[]`

#### `GET /api/verses/:id/explanations`

Commentary/explanation rows.

**Response:** `Explanation[]`

#### `GET /api/verses/:id/word-meanings`

Precomputed word meanings for tooltips.

**Response:** `VerseWordMeaning[]`

---

### 11.4 Languages and authors

#### `GET /api/languages`

**Response:** `Language[]`

#### `GET /api/authors`

Distinct author names across catalog.

**Response:** `string[]`

---

### 11.5 Word translation (AI)

#### `POST /api/translate-word`

Translate/gloss a single word with context. Results cached in PostgreSQL.

**Body:**

```json
{
  "word": "ब्रह्म",
  "sourceLanguage": "devanagari",
  "targetLanguage": "english",
  "verseContext": "...",
  "commentaryContext": "..."
}
```

**Response:**

```json
{
  "word": "ब्रह्म",
  "translation": "Brahman",
  "grammaticalInfo": "...",
  "etymology": "...",
  "contextualMeaning": "...",
  "cached": false
}
```

Requires `OPENAI_API_KEY`.

---

### 11.6 Notes (authenticated)

#### `GET /api/verses/:id/notes`

**Auth:** required

**Response:** `Note[]`

#### `POST /api/verses/:id/notes`

**Auth:** required

**Body:**

```json
{
  "content": "My note text",
  "selectedText": "optional highlighted passage"
}
```

**Response:** `201` + `Note`

#### `PATCH /api/notes/:id`

**Auth:** required — **Body:** `{ "content": "..." }`

#### `DELETE /api/notes/:id`

**Auth:** required

---

### 11.7 Reading progress (authenticated)

#### `GET /api/progress/summary`

**Auth:** required — `{ [bookId]: completedCount }`

#### `GET /api/progress/book/:bookId`

**Auth:** required — `{ "completedVerseIds": ["...", "..."] }`

#### `POST /api/progress`

**Auth:** required

**Body:** `{ "bookId": "...", "verseId": "..." }`

#### `DELETE /api/progress/:verseId`

**Auth:** required — unmark verse complete

---

### 11.8 User preferences (authenticated)

#### `PATCH /api/user/preferred-language`

**Body:** `{ "language": "english" }`

#### `PATCH /api/user/preferences`

**Body:**

```json
{
  "preferredLanguage": "hindi",
  "preferredAuthor": "Sri Shankaracharya",
  "preferredTheme": "dark"
}
```

---

### 11.9 Authentication

#### `GET /api/auth/user`

Current user or `401`.

#### `POST /api/auth/register`

**Body:** `{ "email", "password", "firstName", "lastName?" }`

#### `POST /api/auth/login`

**Body:** `{ "email", "password" }`

#### `POST /api/auth/logout`

Clears session.

#### Replit OIDC (optional)

- `GET /api/login` — redirect to IdP
- `GET /api/callback` — OAuth callback
- `GET /api/logout` — OIDC logout

---

### 11.10 Acharyas (guru-paramparā)

Read-only; sourced from `ekatmadham.acharya_profiles`.

#### `GET /api/acharyas`

List profiles (summary fields).

#### `GET /api/acharyas/:slug`

Full profile including biography and works list.

---

### 11.11 Strapi status and cache

#### `GET /api/strapi/status`

```json
{
  "connected": true,
  "message": "...",
  "strapiUrl": "https://..."
}
```

#### `POST /api/strapi/webhook`

Strapi CMS webhook target. Requires `STRAPI_WEBHOOK_SECRET` header when configured.

**Invalidates** in-memory caches for affected books/verses.

#### `POST /api/strapi/cache/invalidate`

**Body:** `{ "bookId": "..." }` or `{ "all": true }`

Header: `x-strapi-webhook-secret` (if secret configured)

---

### 11.12 Gemini utilities (admin)

#### `POST /api/gemini/translate-text`

**Body:** `{ "content", "targetLanguage", "sourceLanguage?" }`

#### `POST /api/gemini/translate-bhashyam`

**Body:** `{ "content", "sourceLanguage" }`

#### `POST /api/gemini/transliterate-text`

**Body:** `{ "content", "targetLanguage", "sourceLanguage?" }`

#### `POST /api/gemini/translate-image`

**Multipart:** `file` + `targetLanguage` (image or PDF)

---

### 11.13 Translation jobs (Strapi granthas)

#### `POST /api/translate/grantha/:granthaId`

Start translation job. **Body:** `{ "languages": ["tamil", ...] }` optional.

#### `GET /api/translate/grantha/:granthaId/status`

#### `GET /api/translate/jobs`

#### `POST /api/translate/queue`

**Body:** `{ "granthaIds": ["...", "..."] }`

#### `POST /api/translate/queue/all`

Queue all granthas from Strapi.

#### `GET /api/translate/queue/status`

#### `POST /api/translate/cancel`

**Body:** `{ "granthaId": "..." }`

#### `GET /api/translate/languages`

Supported Strapi translation language codes.

---

### 11.14 Transliteration queue

#### `POST /api/transliterate/queue`

**Body:** `{ "granthaIds": ["..."] }`

#### `GET /api/transliterate/progress`

#### `POST /api/transliterate/preview`

**Body:** `{ "text", "language" }`

---

### 11.15 Strapi publish (per manthra)

Avoids bulk publish timeouts.

#### `POST /api/strapi/publish/grantha`

**Body:** `{ "granthaId": "..." }`

#### `POST /api/strapi/publish/section`

**Body:** `{ "sectionDocId": "..." }`

#### `POST /api/strapi/publish/manthra`

**Body:** `{ "manthraDocId": "..." }`

#### `GET /api/strapi/publish/status?jobId=...`

#### `POST /api/strapi/publish/cancel`

**Body:** `{ "jobId": "..." }`

---

## 12. Authentication and sessions

- **express-session** with **connect-pg-simple** → PostgreSQL `sessions` table
- Cookie name: `connect.sid`
- Email users: `req.session.emailUserId`
- Replit users: Passport session + `req.user.claims.sub`
- Protected routes use `isAuthenticated` middleware (`server/replit_integrations/auth/replitAuth.ts`)

Passwords hashed with **bcrypt** (10 rounds).

---

## 13. Strapi CMS integration

### 13.1 Content model (conceptual)

Strapi organizes each **Grantha** (book) with nested **Sections** (adhyāya / valli / etc.) and **Manthras** (verses). Each manthra may have:

- Original text (Devanagari)
- Translations per language
- Bhāṣya / ṭīkā explanations per author and language

The server maps this to the app’s `Book`, `Verse`, `VerseTranslation`, and `Explanation` types.

### 13.2 Webhook setup

1. In Strapi Admin → **Settings → Webhooks**
2. URL: `https://your-app-host/api/strapi/webhook`
3. Events: Entry publish, update, delete (grantha, section, manthra as needed)
4. Header: `x-strapi-webhook-secret: <STRAPI_WEBHOOK_SECRET>`

### 13.3 Pre-warm

On startup, the server loads granthas sequentially (configurable) so first reader visits are fast. Watch logs for `[Pre-warm]` lines.

---

## 14. Admin and pipeline APIs

These endpoints support content operations and are **not** intended for public browser use. Protect them at the network layer (VPN, admin-only ingress, or future auth hardening).

Typical workflow:

1. Edit content in Strapi.
2. Webhook fires → cache invalidated.
3. Optionally run translation: `POST /api/translate/grantha/:id`.
4. Publish manthras: `POST /api/strapi/publish/grantha`.
5. Verify in app: `GET /api/books/:id`.

---

## 15. Cover images and static assets

### 15.1 Upanishad covers

- Directory: `client/public/images/upanishads/`
- Naming: `{stem}.png` (e.g. `isha.png`, `mundaka.png`, `taittiriya.png`)
- Mapping logic: `client/src/lib/upanishad-cover-images.ts`
- Manifest: `client/src/lib/upanishad-cover-manifest.ts` (auto-generated)

After adding images:

```bash
npm run generate:upanishad-covers
```

Local bundled art **takes precedence** over Strapi `coverImage`.

### 15.2 Category card images

Imported from `client/src/assets/` (e.g. `cat-prasthana-thraya.png`) in `welcome-screen.tsx`.

---

## 16. Scripts and maintenance

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run check` | TypeScript check |
| `npm run db:push` | Drizzle schema push |
| `npm run db:test` | DB connection test |
| `npm run generate:upanishad-covers` | Regenerate cover manifest |

**Server-side seed/repair modules** (run automatically on startup):

- `seed.ts`, `seed-gita.ts`, `seed-katha-upanishad.ts`
- `ensure-canonical-books.ts`, `import-translation-data.ts`
- `sync-south-indian-bhashya.ts`, etc.

---

## 17. Troubleshooting

### “Unable to load this text” / empty mantras

- Check Strapi: `GET /api/strapi/status`
- Increase `STRAPI_HEAVY_TIMEOUT_MS` for large granthas
- Restart dev server after `server/strapi.ts` changes
- Verify `GET /api/books/:id` returns verses array

### Port already in use

- Set `PORT=5051` in `.env` or disable macOS AirPlay Receiver on port 5000

### Session / login issues

- Ensure `SESSION_SECRET` is set and stable across restarts
- Ensure `sessions` table exists (`npm run db:push`)

### Sidebar not scrolling

- Catalog sidebars use `max-h-[calc(100dvh-5.5rem)]` with internal `overflow-y-auto` on the tree section
- Reader intro/cover views require `min-h-0` on flex parents (see `book-reader.tsx`)

### Acharya pages empty

- Configure `ACHARYA_DATABASE_URL` or ensure `ekatmadham` database exists on same RDS host

---

## Appendix A — Principal Upanishads (catalog logic)

The ten classical Upanishads are defined in `PRINCIPAL_UPANISHADS` inside `welcome-screen.tsx`. Books are matched by slug/title patterns; companion texts (e.g. Kenopanishad Pādabhashyam) appear under Principal but are excluded from the “Other” count.

---

## Appendix B — Technology stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Tailwind CSS, Radix UI |
| Routing | wouter |
| Data fetching | TanStack Query v5 |
| Server | Express 5, Node ESM |
| ORM | Drizzle ORM + PostgreSQL |
| CMS | Strapi (headless) |
| Build | Vite 7 (client), esbuild (server) |
| AI | OpenAI (word tooltips), Google Gemini (batch translation) |

---

*Document version: 1.0 — generated for Sacred-Script-Hub / Advaita Vaaridhi. Update this file when adding routes, env vars, or major UI flows.*
