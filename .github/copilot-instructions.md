# Project overview

This Next.js application synchronizes Notion pages with a Supabase database, and tracks changes using tree diffing algorithms.

# Core Architecture & Tech Stack

## Framework & Runtime

- Next.js 15 with App Router, server side rendering
- TypeScript with strict type-safety
- Node.js (v20.19)

## Styling & UI Components

- HeroUI (formerly called NextUI) - UI component library for React
- Tailwind CSS
- Lucide React (Icon library)
- tailwind-merge (cn helper) - Conditional CSS class name utilities

## Database & ORM

- Supabase (PostgreSQL database with client-side interactions and image storage)
- PostgreSQL - Primary database with schemas: public

## Authentication & Authorization

- No authentication or authorization mechanisms are implemented.

## Infrastructure & Deployment

- Vercel (Hosting and deployment platform)
- Sentry (Error tracking)
- GitHub Actions (CI/CD pipeline)

## Additional Services and Tools

- Trigger.dev (Background tasks and workflow automation)
- Zod (TypeScript-first schema validation library) - Used for form validation and data validation

## Development Tools

- ESLint (Code linting)
- Prettier (Code formatting)
- Husky (Git hooks)
- Vitest (Testing framework)

# Project Structure

## App Directory Structure (`/app`)

- **Server-Side Code**: The `/app/server` folder contains server-side logic, e.g. Notion API, and Supabase related code
  - **Notion API**: The `/app/server/services/notion` folder contains code related to the Notion API integration.
  - **Supabase**: The `/app/server/services/supabase` folder contains code related to the Supabase integration.
  - **Trigger**: The `/app/server/services/trigger` folder contains code related to the Trigger.dev integration.
  - **Atlas**: The `/app/server/services/atlas` folder contains custom business code, internal logic, and utilities.
  - **Database**: The `/app/server/database` folder contains database-related code, including schema definitions and type definitions.
- **Pages**: The `/app`, folder contains the main application pages
  - **Notion-Embeddable UI Widgets**: The `/app/embed` folder contains UI components that can be embedded in Notion pages as iframes.
  - **Import**: The `/app/import/page.tsx` file exports the import page component.
