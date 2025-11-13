/**
 * Generate Atlas Markdown
 *
 * Description:
 * - Builds standardized Atlas trees and exports a hierarchical Markdown file.
 * - Output path: .debug-data/standardized-atlas/atlas.md
 *
 * Usage:
 *   npx tsx scripts/atlas-export/generate-atlas-markdown.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-exporter';
import { loadEnv } from '@/scripts/utils/load-env';

async function main() {
  loadEnv();

  const markdown = await buildAtlasMarkdown();

  const outDir = path.join(process.cwd(), '.debug-data', 'standardized-atlas');
  const outFile = path.join(outDir, 'atlas.md');

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, markdown, 'utf8');

  console.log(`Wrote Markdown to: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
