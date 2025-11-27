import { parseArgs } from 'node:util';
import { type AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { IMPORT_DATABASES } from '@/app/server/atlas/constants';
import { revalidatePage } from '@/app/server/revalidate-page';
import { importDatabasesFromNotionToSupabase } from '@/app/server/services/notion/import-database-to-supabase';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { isTestEnv } from '@/app/shared/utils/is-test-env';
import { isUsingDevNotionIds } from '@/app/shared/utils/is-using-dev-notion-ids';
import { loadEnv } from './utils/load-env';

// #!/usr/bin/env node
async function main() {
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
      'disable-existing-locks': {
        type: 'boolean',
        description: 'Delete all existing sync locks from notion_sync_status table before importing',
      },
      database: {
        type: 'string',
        description: 'Import only a specific database (e.g., "Scopes", "Articles", "Sections & Primary Docs")',
      },
    },
    strict: true,
  });

  if (args.help) {
    console.log(`Usage: npx tsx scripts/import-notion-databases [options]

Options:
  -h, --help                   Show help message
  -v, --verbose                Enable verbose output
      --local-cache            Enable local caching of Notion API responses to .notion-cache folder
      --disable-existing-locks Delete all existing sync locks from notion_sync_status table before importing
      --database <name>        Import only a specific database (e.g., "Scopes", "Articles", "Sections & Primary Docs")

Available databases:
${IMPORT_DATABASES.map((db) => `  - ${db}`).join('\n')}`);

    process.exit(0);
  }

  if (args.verbose) {
    console.log(`Verbose mode enabled`);
    process.env.DEBUG_LOGGING = 'true';
  }

  if (args['local-cache']) {
    console.log(`Local cache enabled - will use .notion-cache folder instead of making Notion API calls`);
  }

  loadEnv();

  if (isTestEnv()) {
    console.error('❌ Importing Notion databases is not allowed in test environment');
    process.exit(1);
  }

  if (isUsingDevNotionIds()) {
    console.log('🔑 Using dev Notion IDs');
  } else {
    console.log('🔐 Using production Notion IDs');
  }

  // Validate database argument if provided
  const targetDatabase = args.database as AtlasDatabaseName | undefined;
  if (targetDatabase && !IMPORT_DATABASES.includes(targetDatabase)) {
    console.error(`❌ Error: Unknown database "${targetDatabase}"`);
    console.error(`\nAvailable databases:`);
    IMPORT_DATABASES.forEach((db) => console.error(`  - ${db}`));
    process.exit(1);
  }

  // Delete existing sync locks if requested
  if (args['disable-existing-locks']) {
    console.log('Deleting all existing sync locks from notion_sync_status table...');
    const { error } = await supabase().from('notion_sync_status').delete().not('id', 'is', null);
    if (error) {
      console.error('Error deleting sync locks:', error);
      process.exit(1);
    }
    console.log('✅ All sync locks deleted successfully');
  }

  const databasesToImport = targetDatabase ? [targetDatabase] : IMPORT_DATABASES;

  try {
    // Import all Atlas databases using the unified function
    await importDatabasesFromNotionToSupabase({
      databasesToImport,
      useLocalCache: args['local-cache'] ?? false,
      importType: targetDatabase ? 'partial' : 'full_sync',
    });

    // Revalidate atlas page to reflect the newly imported data
    await revalidatePage('/');
    await revalidatePage('/atlas');

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
 * npx tsx scripts/import-notion-databases --disable-existing-locks
 * npx tsx scripts/import-notion-databases --disable-existing-locks --verbose
 * npx tsx scripts/import-notion-databases --database "Scopes"
 * npx tsx scripts/import-notion-databases --database "Sections & Primary Docs" --local-cache
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
