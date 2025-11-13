import { parseArgs } from 'node:util';
import { loadAtlasChangeHistory } from '@/app/server/atlas/changelog/load-atlas-change-history';
import { loadEnv } from './utils/load-env';

type Args = {
  help?: boolean;
  verbose?: boolean;
  'max-line-length'?: number;
  since?: string;
};

function truncateLongLines(text: string, maxLen: number): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => (line.length > maxLen ? line.slice(0, maxLen) + '…' : line))
    .join('\n');
}

function formatChangeProperty(key: string, oldValue: string, newValue: string, maxLineLength: number): string[] {
  const maybeTruncate = (k: string, v: string) =>
    k === 'plain_text_content' ? truncateLongLines(v, maxLineLength) : v;

  const oldV = maybeTruncate(key, oldValue ?? '');
  const newV = maybeTruncate(key, newValue ?? '');

  const lines: string[] = [];
  lines.push(`  • ${key}`);
  if (oldV || newV) {
    lines.push(`      - old: ${oldV === '' ? '∅' : oldV}`);
    lines.push(`      - new: ${newV === '' ? '∅' : newV}`);
  }
  return lines;
}

// #!/usr/bin/env node
async function main() {
  const { values: argsRaw } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h', description: 'Show help message' },
      verbose: { type: 'boolean', short: 'v', description: 'Enable verbose logging' },
      'max-line-length': {
        type: 'string',
        short: 'm',
        description: 'Max line length for plain_text_content truncation',
      },
      since: { type: 'string', short: 's', description: "Relative time window (e.g. '1h', '10d', '5m')" },
    },
    strict: true,
  });

  const args: Args = {
    help: argsRaw.help as boolean | undefined,
    verbose: argsRaw.verbose as boolean | undefined,
    'max-line-length': argsRaw['max-line-length'] ? Number(argsRaw['max-line-length']) : undefined,
    since: (argsRaw.since as string | undefined) ?? undefined,
  };

  if (args.help) {
    console.log(`Usage: npx tsx scripts/atlas-changelog [options]

Options:
  -h, --help              Show help message
  -v, --verbose           Enable verbose output
  -m, --max-line-length   Max chars per line for plain_text_content (default: 160)
  -s, --since             Relative time window (e.g. 1h, 10d, 5m). Default: 1d

Examples:
  npx tsx scripts/atlas-changelog
  npx tsx scripts/atlas-changelog --verbose
  npx tsx scripts/atlas-changelog --max-line-length 120
  npx tsx scripts/atlas-changelog --since 1d`);
    process.exit(0);
  }

  if (args.verbose) {
    console.log('Verbose mode enabled');
    process.env.DEBUG_LOGGING = 'true';
  }

  const maxLineLength = Number.isFinite(args['max-line-length'] as number) ? (args['max-line-length'] as number) : 160;

  loadEnv();

  try {
    console.log('Loading Atlas change history...');
    const since = (() => {
      if (!args.since) return new Date(Date.now() - 24 * 60 * 60 * 1000);
      const m = /^\s*(\d+)\s*([dhmDHm])\s*$/.exec(args.since);
      if (!m) {
        console.error(`Invalid --since value: '${args.since}'. Use formats like 1h, 10d, 5m.`);
        process.exit(1);
      }
      const amount = Number(m[1]);
      const unit = m[2].toLowerCase();
      const now = Date.now();
      const multiplier = unit === 'd' ? 24 * 60 * 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : 60 * 1000;
      return new Date(now - amount * multiplier);
    })();
    const changes = await loadAtlasChangeHistory({ since });

    if (!changes.length) {
      console.log('No changes found.');
      process.exit(0);
    }

    console.log(`\n📜 Atlas Change Log (${changes.length} entr${changes.length === 1 ? 'y' : 'ies'})`);
    console.log('='.repeat(80));

    for (const change of changes) {
      const emoji = change.type === 'new' ? '🟢' : change.type === 'deleted' ? '🔴' : '🟡';
      const page = change.newPage ?? change.oldPage;
      const title = page?.canonical_document_title || page?.atlas_document_number || '(unknown)';
      const name = page?.plain_text_name ? ` — ${page.plain_text_name}` : '';
      console.log(`${emoji} ${change.type.toUpperCase()}: ${title}${name}`);

      if (change.type === 'changed') {
        const keys = Object.keys(change.changes.properties || {});
        if (keys.length === 0) {
          console.log('  • (no property deltas computed)');
        } else {
          for (const key of keys) {
            const { oldValue, newValue } = change.changes.properties[key]!;
            const lines = formatChangeProperty(key, oldValue, newValue, maxLineLength);
            for (const line of lines) console.log(line);
          }
        }
      } else if (args.verbose) {
        // For new/deleted, show a brief one-line summary in verbose mode
        const db = page?.atlas_database_name ?? '';
        const type = page?.atlas_document_type ?? '';
        console.log(`  • ${db} / ${type}`);
      }

      console.log('-'.repeat(80));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error generating Atlas change log:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/atlas-changelog
 * npx tsx scripts/atlas-changelog --help
 * npx tsx scripts/atlas-changelog --verbose
 * npx tsx scripts/atlas-changelog --max-line-length 120
 * npx tsx scripts/atlas-changelog --since 1d
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
