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

1. At build time (or on request), the app fetches the Atlas markdown file from a GitHub repository.
2. A markdown parser (`atlas-markdown-importer.ts`) converts the markdown into a structured JSON tree (the "Export Tree").
3. The Next.js app renders the tree as a searchable, filterable, hierarchical viewer.

The Atlas markdown follows a strict format documented in [`docs/ATLAS_MARKDOWN_SYNTAX.md`](./docs/ATLAS_MARKDOWN_SYNTAX.md). Each document has a type, number, name, UUID, and content. The hierarchy is encoded in document numbers (e.g., `A.1.2.3`) and described in [`docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md).

## API Endpoints

The portal exposes the Atlas in multiple formats:

| Endpoint | Format | Description |
|---|---|---|
| `/api/atlas.json` | JSON | Structured tree of all Atlas documents |
| `/api/atlas.md` | Markdown | Complete Atlas as a single markdown file |
| `/api/atlas.yaml` | YAML | Same structure as JSON, in YAML format |

## Scripts

```bash
# Validate an Atlas markdown file
npx tsx scripts/validate-atlas-markdown.ts [path/to/atlas.md]

# Validate an Atlas JSON file
npx tsx scripts/validate-atlas-json.ts [path/to/atlas.json]
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | No | GitHub personal access token for higher API rate limits |

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

MIT
