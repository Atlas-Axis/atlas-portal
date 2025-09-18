import { parseArgs } from 'node:util';
import { revalidatePage } from '@/app/server/revalidate-page';
import { IMPORT_DATABASES } from '@/app/server/services/atlas/constants';
import { importDatabasePagesFromNotionToSupabase } from '@/app/server/services/notion/import-database-to-supabase';
import { loadEnv } from './utils/load-env';

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();
  const { values: args } = parseArgs({
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
      'local-cache': {
        type: 'boolean',
        description: 'Enable local caching of Notion API responses to .notion-cache folder',
      },
    },
    strict: true,
  });

  if (args.help) {
    console.log(`Usage: npx tsx scripts/import-notion-databases [options]

Options:
  -h, --help        Show help message
  -v, --verbose     Enable verbose output
      --local-cache Enable local caching of Notion API responses to .notion-cache folder`);
    process.exit(0);
  }

  if (args.verbose) {
    console.log(`Verbose mode enabled`);
    process.env.DEBUG_LOGGING = 'true';
  }

  if (args['local-cache']) {
    console.log(`Local cache enabled - will use/create .notion-cache folder`);
  }

  loadEnv();

  console.log(`Starting Notion database import...`);

  try {
    // Import all Atlas databases
    for (const atlasDatabaseName of IMPORT_DATABASES) {
      console.log(`----------------------------------------`);
      console.log(`\n📋 Importing database: ${atlasDatabaseName}`);
      await importDatabasePagesFromNotionToSupabase({
        atlasDatabaseName,
        useLocalCache: args['local-cache'] ?? false,
      });
      console.log(`✅ Completed importing: ${atlasDatabaseName}`);
      console.log(`----------------------------------------`);
    }

    // Revalidate /atlas page to reflect the newly imported data
    await revalidatePage('/atlas');

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 All databases imported successfully!`);
    console.log(`⏰ Total processing time: ${durationSeconds} seconds`);

    // The command hangs after completion, so we explicitly exit. TODO: Investigate why and fix.
    process.exit(0);
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
 * npx tsx scripts/import-notion-databases --local-cache
 * npx tsx scripts/import-notion-databases --verbose --local-cache
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
