#!/usr/bin/env node
/**
 * CLI: Validate Standardized Atlas JSON
 *
 * Usage:
 *   npx tsx scripts/validate-atlas-json.ts [path/to/file.json]
 *
 * If no file path is provided, defaults to:
 *   .debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json
 */
import fs from 'fs';
import path from 'path';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import validateStandardizedAtlasTree, {
  type ValidationError,
} from '@/scripts/atlas-json/hierarchical/validate-standardized-atlas-tree';

function formatError(validationError: ValidationError): string {
  const nodeSummaryParts: string[] = [];
  if (validationError.node && typeof validationError.node === 'object') {
    const type = (validationError.node as Partial<StandardizedAtlasDocument>).type;
    const docNo = (validationError.node as Partial<StandardizedAtlasDocument>).doc_no;
    const name = (validationError.node as Partial<StandardizedAtlasDocument>).name;
    const uuid = (validationError.node as Partial<StandardizedAtlasDocument>).uuid;
    if (type) nodeSummaryParts.push(`type=${type}`);
    if (docNo) nodeSummaryParts.push(`doc_no=${docNo}`);
    if (name) nodeSummaryParts.push(`name=${name}`);
    if (uuid) nodeSummaryParts.push(`uuid=${uuid}`);
  }
  const nodeSummary = nodeSummaryParts.length ? ` [${nodeSummaryParts.join(', ')}]` : '';
  return `- (${validationError.kind}) ${validationError.path}${nodeSummary}\n  id: ${validationError.nodeId}\n  message: ${validationError.message}\n  action: ${validationError.actionSuggestion}`;
}

function main() {
  const defaultPath = '.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json';
  const argPath = process.argv[2] ? String(process.argv[2]) : defaultPath;
  const absPath = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);

  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  const jsonStr = fs.readFileSync(absPath, 'utf8');
  const { errors, root } = validateStandardizedAtlasTree(jsonStr);

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
    console.log(formatError(err));
    console.log('');
  }

  process.exit(2);
}

main();
