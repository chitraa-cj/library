# Sacred Texts Library

## Overview

A digital library application for exploring ancient sacred texts from Advaita, Jain, Hindu, Sanskrit, Telugu, and Tamil traditions. The platform provides multi-script support (Devanagari, Kannada, Telugu, Tamil), verse-by-verse translations, and scholarly commentaries/explanations from renowned scholars.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with path aliases (`@/` for client source, `@shared/` for shared code)

The frontend uses a sidebar-based layout with three main panels:
1. **AppSidebar**: Book navigation and search, grouped by category
2. **BookReader**: Main content area displaying verses with continuous scrolling and commentary selection (author/language dropdowns with mutual filtering)
3. **TranslationPanel**: Shows translations in different scripts and scholarly explanations

### Backend Architecture
- **Framework**: Express.js 5 (ESM modules)
- **API Pattern**: RESTful JSON API with `/api/` prefix
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Storage Pattern**: Repository pattern via `DatabaseStorage` class implementing `IStorage` interface

Key API endpoints:
- `GET /api/books` - List all books
- `GET /api/books/:id` - Get book with details and verses
- `GET /api/books/:id/commentary-options` - Get available authors and languages for commentaries
- `GET /api/verses/:id` - Get single verse with translations
- `GET /api/verses/:id/translations` - Get all translations for a verse
- `GET /api/verses/:id/explanations` - Get scholarly explanations

### Data Model
The database schema supports multi-language sacred texts:
- **languages**: Language definitions with code, name, native name, and script
- **books**: Sacred text metadata (title, author, description, category)
- **bookTitles**: Localized book titles for different languages
- **verses**: Individual verses with section organization
- **verseTranslations**: Verse content in different languages/scripts
- **explanations**: Scholar commentaries on verses

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