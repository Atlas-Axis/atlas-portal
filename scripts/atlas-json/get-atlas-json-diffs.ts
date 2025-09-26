/*
Purpose: Compare Atlas JSON exports and report UUID diffs and duplicates, grouped by Atlas database (category).

Inputs:
- --file1 PATH (default: .debug-data/atlas-json-generated/atlas-blue.json)
- --file2 PATH (default: .debug-data/atlas-json-generated/atlas-supabase-without-agents.json)
- --include-inactives (optional): include documents where inactive === 1 (default: excluded)

What it does:
- Loads two Atlas JSON files (arrays of AtlasCategoryJson)
- For each category (Atlas database name), collects document UUIDs and their document types from AtlasDocumentJson.type
- Skips any documents with inactive === 1 unless --include-inactives is provided
- Prints:
  - IDs present in file2 but missing from file1 (per category)
  - IDs present in file1 but missing from file2 (per category)
  - Duplicate IDs within each file (per category)
- Long lists are truncated to 30 items with a trailing line like "...and N more"

Usage (from repo root):
  npx tsx scripts/atlas-json/get-atlas-json-diffs.ts
  npx tsx scripts/atlas-json/get-atlas-json-diffs.ts --file1 .debug-data/atlas-json-generated/atlas-blue.json --file2 .debug-data/atlas-json-generated/atlas-supabase-without-agents.json

Notes:
- UUIDs are normalized to lowercase before comparison
- Categories are taken from AtlasCategoryJson.type
*/
import fs from 'node:fs';
import path from 'node:path';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';

type JsonValue = unknown;

const DEFAULT_FILE1 = '.debug-data/atlas-json-generated/atlas-blue.json';
const DEFAULT_FILE2 = '.debug-data/atlas-json-generated/atlas-supabase-without-agents.json';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [key, value] = token.includes('=') ? token.slice(2).split('=') : [token.slice(2), undefined];
      if (value === undefined) {
        // lookahead for separate value (unless boolean flag)
        if (key === 'include-inactives' || key === 'help') {
          args[key] = true;
        } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          args[key] = argv[++i];
        } else {
          args[key] = true;
        }
      } else {
        args[key] = value;
      }
    }
  }
  return args as { file1?: string; file2?: string; 'include-inactives'?: boolean; help?: boolean };
}

function readJsonFile(filePath: string): JsonValue {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    const readablePath = path.relative(process.cwd(), filePath) || filePath;
    console.error(`Failed to read or parse JSON file: ${readablePath}`);
    if (error instanceof Error) console.error(error.message);
    process.exit(1);
  }
}

const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

type CategoryCollectors = {
  set: Set<string>;
  counts: Map<string, number>;
  typesByUuid: Map<string, Set<string>>; // document types
  namesByUuid: Map<string, Set<string>>; // document names
};

function addUuid(
  uuid: string,
  docType: string | undefined,
  docName: string | undefined,
  collectors: CategoryCollectors,
): void {
  const normalized = uuid.toLowerCase();
  collectors.set.add(normalized);
  collectors.counts.set(normalized, (collectors.counts.get(normalized) ?? 0) + 1);
  if (docType && docType.length > 0) {
    const set = collectors.typesByUuid.get(normalized) ?? new Set<string>();
    set.add(docType);
    collectors.typesByUuid.set(normalized, set);
  }
  if (docName && docName.length > 0) {
    const set = collectors.namesByUuid.get(normalized) ?? new Set<string>();
    set.add(docName);
    collectors.namesByUuid.set(normalized, set);
  }
}

function isAtlasDocumentJson(value: unknown): value is AtlasDocumentJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const typeOk = typeof v.type === 'string';
  const uuidOk = typeof v.uuid === 'string' || v.uuid === null || v.uuid === undefined;
  const inactiveOk = typeof v.inactive === 'boolean';
  return typeOk && uuidOk && inactiveOk;
}

function isAtlasCategoryJson(value: unknown): value is AtlasCategoryJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const typeOk = typeof v.type === 'string';
  const docs = v.documents;
  const docsOk = Array.isArray(docs);
  return typeOk && docsOk;
}

function collectFromAtlasJson(data: JsonValue, includeInactives: boolean): CategoryCollectors {
  const result: CategoryCollectors = {
    set: new Set(),
    counts: new Map(),
    typesByUuid: new Map(),
    namesByUuid: new Map(),
  };
  if (!Array.isArray(data)) return result;
  for (const cat of data) {
    if (!isAtlasCategoryJson(cat)) continue;
    const docs: unknown[] = Array.isArray(cat.documents) ? cat.documents : [];
    for (const d of docs) {
      if (!isAtlasDocumentJson(d)) continue;
      if (!includeInactives && !!d.inactive) continue;
      const uuid = d.uuid;
      if (typeof uuid === 'string' && UUID_REGEX.test(uuid)) {
        const docType: string | undefined = typeof d.type === 'string' ? d.type : undefined;
        const docName: string | undefined = typeof d.name === 'string' ? d.name : undefined;
        addUuid(uuid, docType, docName, result);
      }
    }
  }
  return result;
}

function difference(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const id of a) if (!b.has(id)) out.push(id);
  out.sort();
  return out;
}

function formatList(
  title: string,
  ids: string[],
  typesByUuid: Map<string, Set<string>>,
  namesByUuid: Map<string, Set<string>>,
): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${ids.length}`);
  if (ids.length > 0) {
    const max = 30;
    const display = ids.slice(0, max);
    for (const id of display) {
      const types = Array.from(typesByUuid.get(id) ?? []);
      const names = Array.from(namesByUuid.get(id) ?? []);
      const typeSuffix = types.length > 0 ? ` [${types.join(', ')}]` : '';
      const nameSuffix = names.length > 0 ? ` "${names.join('", "')}"` : '';
      lines.push(`${id}${typeSuffix}${nameSuffix}`);
    }
    if (ids.length > max) lines.push(`...and ${ids.length - max} more`);
  }
  return lines.join('\n');
}

function formatDuplicates(
  title: string,
  counts: Map<string, number>,
  typesByUuid: Map<string, Set<string>>,
  namesByUuid: Map<string, Set<string>>,
): string {
  const entries = Array.from(counts.entries()).filter(([, n]) => n > 1);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${entries.length}`);
  const max = 30;
  const display = entries.slice(0, max);
  for (const [id, n] of display) {
    const types = Array.from(typesByUuid.get(id) ?? []);
    const names = Array.from(namesByUuid.get(id) ?? []);
    const typeSuffix = types.length > 0 ? ` [${types.join(', ')}]` : '';
    const nameSuffix = names.length > 0 ? ` "${names.join('", "')}"` : '';
    lines.push(`${id} (${n} times)${typeSuffix}${nameSuffix}`);
  }
  if (entries.length > max) lines.push(`...and ${entries.length - max} more`);
  return lines.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv);
  if (args.help) {
    const usage = [
      'Usage:',
      '  npx tsx scripts/atlas-json/get-atlas-json-diffs.ts [--file1 PATH] [--file2 PATH] [--include-inactives]',
      '',
      'Defaults:',
      `  --file1 ${DEFAULT_FILE1}`,
      `  --file2 ${DEFAULT_FILE2}`,
      '',
      'Flags:',
      '  --include-inactives   Include documents where inactive === 1',
    ].join('\n');
    console.log(usage);
    return;
  }
  const file1 = path.resolve(process.cwd(), args.file1 || DEFAULT_FILE1);
  const file2 = path.resolve(process.cwd(), args.file2 || DEFAULT_FILE2);
  const includeInactives = Boolean(args['include-inactives']);

  const firstName = path.basename(file1);
  const secondName = path.basename(file2);

  const json1 = readJsonFile(file1);
  const json2 = readJsonFile(file2);

  const col1 = collectFromAtlasJson(json1, includeInactives);
  const col2 = collectFromAtlasJson(json2, includeInactives);

  const onlyIn2 = difference(col2.set, col1.set);
  const onlyIn1 = difference(col1.set, col2.set);

  const sections: string[] = [
    formatList(
      `IDs present in ${secondName} but missing from ${firstName}`,
      onlyIn2,
      col2.typesByUuid,
      col2.namesByUuid,
    ),
    '',
    formatList(
      `IDs present in ${firstName} but missing from ${secondName}`,
      onlyIn1,
      col1.typesByUuid,
      col1.namesByUuid,
    ),
    '',
    formatDuplicates(`Duplicate IDs within ${firstName}`, col1.counts, col1.typesByUuid, col1.namesByUuid),
    '',
    formatDuplicates(`Duplicate IDs within ${secondName}`, col2.counts, col2.typesByUuid, col2.namesByUuid),
  ];

  console.log(sections.join('\n'));
}

main();
