import { parseArgs } from 'node:util';
import { ATLAS_DATABASES } from '@/app/server/services/atlas/constants';
import { _delete_importDatabasePagesFromNotionToSupabase } from '@/app/server/services/notion/to_delete/_old.import-database-to-supabase';
import { loadEnv } from './utils/load-env';

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help message',
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        description: 'Enable verbose output',
      },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`Usage: npx tsx scripts/import-notion-databases [options]

Options:
  -h, --help     Show help message
  -v, --verbose  Enable verbose output`);
    process.exit(0);
  }

  if (values.verbose) {
    console.log(`Verbose mode enabled`);
    process.env.DEBUG_LOGGING = 'true';
  } else {
    //
  }

  loadEnv();

  console.log(`Starting Notion database import...`);

  try {
    await _delete_importDatabasePagesFromNotionToSupabase({
      // TODO: Import other databases too
      atlasDatabaseName: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
    });
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error(`Error importing Notion databases:`, error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/import-notion-databases
 * npx tsx scripts/import-notion-databases --help
 * npx tsx scripts/import-notion-databases --verbose
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
