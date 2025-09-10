import { loadEnvConfig } from '@next/env';
import { parseArgs } from 'node:util';
import { getDatabasePageCount } from '@/app/server/services/notion/get-database-page-count';

const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`isDevelopment: ${isDevelopment}`);

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();
  const { values, positionals: args } = parseArgs({
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
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(`Usage: npx tsx scripts/get-notion-database-page-count [options] <id>

Options:
  -h, --help     Show help message
  -v, --verbose  Enable verbose output

Arguments:
  <id>           The ID to process`);
    process.exit(0);
  }

  const [notionDatabaseId] = args;
  if (!notionDatabaseId) {
    console.error('Error: Missing required argument <id>');
    console.error('Usage: npx tsx scripts/get-notion-database-page-count [options] <id>');
    console.error('Use --help for more information');
    process.exit(1);
  }

  if (values.verbose) {
    console.log(`Verbose mode enabled`);
    console.log(`Processing ID: ${notionDatabaseId}`);
    process.env.DEBUG_LOGGING = 'true';
  } else {
    console.log(`Id: ${notionDatabaseId}`);
  }

  // Load environment variables
  const projectDir = process.cwd();
  console.log(`Loading environment variables from ${projectDir}/.env`);
  loadEnvConfig(projectDir, isDevelopment, { info: () => {}, error: console.error });

  try {
    const pageCount = await getDatabasePageCount(notionDatabaseId);
    console.log(`Total pages in Notion database ${notionDatabaseId}: ${pageCount}`);
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error(`Error counting pages in Notion database ${notionDatabaseId}:`, error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/get-notion-database-page-count <id>
 * npx tsx scripts/get-notion-database-page-count --help
 * npx tsx scripts/get-notion-database-page-count --verbose <id>
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
