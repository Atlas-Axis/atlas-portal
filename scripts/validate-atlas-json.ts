#!/usr/bin/env node
/**
 * CLI: Validate Standardized Atlas JSON
 *
 * Usage:
 *   npx tsx scripts/validate-atlas-json.ts [path/to/file.json]
 *
 * If no file path is provided, defaults to:
 *   .debug-data/standardized-atlas/atlas.json
 */
import fs from 'fs';
import path from 'path';
import validateExportAtlasTree, {
  type ValidationError,
} from '@/app/server/atlas/export/validate-standardized-atlas-tree';

function formatError(validationError: ValidationError): string {
  return `⚠️  ${validationError.message}\n    id: ${validationError.nodeId}\n    name: ${validationError.node.name}\n    type: ${validationError.node.type}\n    action: ${validationError.actionSuggestion}`;
}

function main() {
  const defaultPath = '.debug-data/standardized-atlas/atlas.json';
  const argPath = process.argv[2] ? String(process.argv[2]) : defaultPath;
  const absPath = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);

  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  const jsonStr = fs.readFileSync(absPath, 'utf8');
  const { errors, root } = validateExportAtlasTree(jsonStr);

  console.log(`Validating: ${absPath}`);
  if (!root) {
    console.log('Root could not be parsed or is invalid.');
  } else {
    console.log(`Root parsed with ${root.length} item(s).`);
  }

  if (errors.length === 0) {
    console.log('✅ No validation errors found.');
    process.exit(0);
  }

  console.log(`\nFound ${errors.length} validation error(s):\n`);
  for (const err of errors) {
    console.warn(formatError(err));
    console.log('\n\n');
  }

  process.exit();
}

main();
