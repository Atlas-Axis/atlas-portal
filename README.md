# Sky Atlas Portal

A read-only viewer for the [Sky Atlas](https://sky-atlas.io) governance document.

The portal fetches the canonical Atlas markdown from GitHub, parses it into a navigable tree, and renders it as an interactive web application. No database required.

## Quick Start

```bash
npm install
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000). The Atlas viewer is at `/atlas`.

## How It Works

1. At **build time**, the app fetches the canonical Atlas content from GitHub, composes the per-document folder tree back into a markdown monolith, parses it into a structured JSON tree (the "Export Tree"), and validates that no documents were dropped.
2. The Next.js app pre-renders `/`, `/atlas`, `/api/atlas.json`, and `/api/atlas.yaml` against that tree as static HTML/JSON. Runtime requests are served from the CDN with no GitHub round-trips, no tarball extract, and no parse work on the hot path.
3. New Atlas content ships via a fresh Vercel deploy. A webhook on `sky-ecosystem/next-gen-atlas`'s `main` branch fires a Vercel Deploy Hook, which rebuilds the portal against the latest commit. New atoms appear within a couple of minutes of merge.

The Atlas markdown follows a strict format documented in [`docs/ATLAS_MARKDOWN_SYNTAX.md`](./docs/ATLAS_MARKDOWN_SYNTAX.md). Each document has a type, number, name, UUID, and content. The hierarchy is encoded in document numbers (e.g., `A.1.2.3`) and described in [`docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md).

### Deploy hook (operational note)

For new upstream Atlas content to reach production, the upstream content repository's `main` branch must trigger a Vercel Deploy Hook. The hook URL is created in the Vercel dashboard (Project → Settings → Git → Deploy Hooks) and registered as a GitHub webhook on the content repo with the `push` event filtered to the canonical branch. Without the hook, deploys are manual.

## API Endpoints

The portal exposes the Atlas in multiple formats:

| Endpoint          | Format   | Description                              |
| ----------------- | -------- | ---------------------------------------- |
| `/api/atlas.json` | JSON     | Structured tree of all Atlas documents   |
| `/api/atlas.md`   | Markdown | Complete Atlas as a single markdown file |
| `/api/atlas.yaml` | YAML     | Same structure as JSON, in YAML format   |

## Scripts

```bash
# Validate an Atlas markdown file
npx tsx scripts/validate-atlas-markdown.ts [path/to/atlas.md]

# Validate an Atlas JSON file
npx tsx scripts/validate-atlas-json.ts [path/to/atlas.json]
```

## Environment Variables

| Variable       | Required | Description                                             |
| -------------- | -------- | ------------------------------------------------------- |
| `GITHUB_TOKEN` | No       | GitHub personal access token for higher API rate limits |

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- TypeScript
- [HeroUI](https://heroui.com/) + Tailwind CSS
- [Vitest](https://vitest.dev/) for testing

## Testing

```bash
npm test              # watch mode
npm run test:run      # single run
npm run test:coverage # coverage report
```

## Documentation

Docs relevant to the Atlas format and parsing:

- [`docs/ATLAS_MARKDOWN_SYNTAX.md`](./docs/ATLAS_MARKDOWN_SYNTAX.md) -- Complete syntax specification for the Atlas markdown format
- [`docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md`](./docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md) -- How the import/export pipeline works
- [`docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md) -- Hierarchical document numbering system
- [`docs/NEEDED_RESEARCH.md`](./docs/NEEDED_RESEARCH.md) -- Positioning rules for Needed Research documents in markdown

## License

Apache-2.0 -- see [LICENSE](./LICENSE).
