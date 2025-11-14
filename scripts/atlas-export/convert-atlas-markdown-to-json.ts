/**
 * Convert Atlas Markdown to JSON
 *
 * Description:
 * - Reads the Markdown export at `exported-atlas/atlas.md`
 * - Parses it with `parseAtlasMarkdown`
 * - Writes the resulting JSON to `exported-atlas/markdown-to-json.json`
 *
 * Usage:
 *   npx tsx scripts/atlas-export/convert-atlas-markdown-to-json.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import { loadEnv } from '@/scripts/utils/load-env';

async function main() {
  loadEnv();

  const dir = path.join(process.cwd(), 'exported-atlas');
  const inFile = path.join(dir, 'atlas.md');
  const outFile = path.join(dir, 'markdown-to-json.json');

  const markdown = await fs.readFile(inFile, 'utf8');
  const trees = parseAtlasMarkdown(markdown);

  const json = JSON.stringify(trees, null, 2);
  await fs.writeFile(outFile, json, 'utf8');

  console.log(`Wrote JSON to: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
