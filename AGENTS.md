# Atlas Portal -- AI Agent Guide

## Project Overview

Atlas Portal is a read-only Next.js web application for browsing the [Sky Atlas](https://sky-atlas.io), a hierarchical corpus of governance rules and policies in the Sky ecosystem. The canonical Atlas is stored as a single Markdown file in the GitHub repository `sky-ecosystem/next-gen-atlas`. This portal fetches that Markdown, parses it into a structured tree, and renders it as an interactive web application. There is no database -- the entire data model is derived from Markdown at build/request time.

## Architecture

```
GitHub (sky-ecosystem/next-gen-atlas)
  └─ Sky Atlas.md  (canonical source of truth)
       │
       ▼
  Next.js App (this repo)
  ├── Fetches markdown via GitHub raw URL
  ├── Parses into structured "Export Tree" (JSON)
  ├── Renders interactive hierarchy viewer at /atlas
  ├── Exposes API endpoints: /api/atlas.json, /api/atlas.md, /api/atlas.yaml
  └── Deployed on Vercel with ISR (Incremental Static Regeneration)
```

### Data flow

1. `load-atlas-markdown-from-github.ts` fetches the raw Markdown from GitHub.
2. `atlas-markdown-importer.ts` parses the Markdown into a tree of `ExportTreeNode` objects.
3. The `/atlas` page renders the tree with search, filtering, and document type color-coding.
4. API routes serialize the tree to JSON, Markdown, or YAML on demand.

### Caching strategy

The portal is **fully build-time static**. `/`, `/atlas`, `/api/atlas.json`, and `/api/atlas.yaml` are pre-rendered at `next build` against the upstream Atlas content; runtime requests are pure CDN serves. New Atlas content reaches production via a fresh Vercel deploy triggered by a Deploy Hook fired from a webhook on the upstream content repo's canonical branch.

The `/api/revalidate` endpoint remains available for any future ISR routes but is not on the path of the main Atlas page.

`/api/atlas.md` is the one route still rendered on demand because it accepts a `split-by-scope` query parameter that gates between two response shapes.

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript, Node.js 22
- **UI**: HeroUI (React component library) + Tailwind CSS + Lucide icons
- **Math rendering**: KaTeX (inline and display math in Atlas content)
- **HTML sanitization**: DOMPurify (sanitizes rendered HTML before injection)
- **Testing**: Vitest + React Testing Library + jsdom
- **Linting/Formatting**: ESLint, Prettier, Husky (pre-commit hooks)
- **Deployment**: Vercel

## Directory Structure

```
app/
  atlas/              # Atlas viewer page and components
  api/                # API routes (atlas.json, atlas.md, atlas.yaml, revalidate)
  components/         # Shared UI components
  server/atlas/       # Server-side Atlas logic (fetching, parsing, tree building, export)
  shared/             # Shared utilities and types
docs/                 # Atlas format specifications (markdown syntax, numbering rules)
scripts/              # CLI utilities (validation, export)
exported-atlas/       # Local Atlas files for development/testing
```

## Key Files

| File                                                  | Purpose                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `app/server/atlas/load-atlas-markdown-from-github.ts` | Fetches Atlas Markdown + metadata from GitHub    |
| `app/server/atlas/export/atlas-markdown-importer.ts`  | Parses Atlas Markdown into Export Tree           |
| `app/server/atlas/export/types.ts`                    | Type definitions for Export Tree nodes           |
| `app/server/atlas/constants.ts`                       | GitHub URLs and Atlas constants                  |
| `app/atlas/page.tsx`                                  | Main Atlas viewer page                           |
| `app/components/custom-html.tsx`                      | Renders sanitized HTML (with KaTeX math support) |

## Atlas Document Model

The Atlas is a tree of documents. Each document has:

- **Type**: Scope, Article, Section, Core, Type Specification, Active Data Controller, Action Tenet, Active Data, Annotation, Scenario, Scenario Variation, Needed Research
- **Number**: Hierarchical identifier (e.g., `A.1.2.3`) encoding position in the tree
- **Name**: Human-readable title
- **UUID**: Stable unique identifier
- **Content**: Markdown body rendered as HTML

The hierarchy is: Scope > Article > Section > Primary Documents (Core, ADC, Type Spec) > Supporting Documents (Annotation, Tenet > Scenario > Scenario Variation, Active Data). Needed Research can appear under any document.

Full format specification: `docs/ATLAS_MARKDOWN_SYNTAX.md`
Numbering rules: `docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`

## Testing

```bash
npm test                 # watch mode
npm run test:run         # single run (CI-friendly)
npm run test:coverage    # coverage report
npm run test:ui          # Vitest UI
```

- Default test environment is `jsdom`. For Node-only tests add `// @vitest-environment node`.
- Path alias `@/*` is available in tests.
- Tests live in `__tests__/` directories or as `*.test.ts(x)` alongside source files.

## Environment Variables

| Variable            | Required         | Description                                                |
| ------------------- | ---------------- | ---------------------------------------------------------- |
| `GITHUB_TOKEN`      | No               | GitHub PAT for higher API rate limits                      |
| `REVALIDATE_SECRET` | Yes (production) | Shared secret for the `/api/revalidate` endpoint           |
| `BASE_URL`          | Yes (production) | Base URL of the deployed app (used for internal API calls) |

## Scripts

```bash
npx tsx scripts/validate-atlas-markdown.ts [path]   # Validate Atlas Markdown syntax
npx tsx scripts/validate-atlas-json.ts [path]        # Validate Atlas JSON structure
```
