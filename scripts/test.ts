import { parseArgs } from 'node:util';

// #!/usr/bin/env node
async function main() {
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
    console.log(`Usage: npx tsx scripts/test.ts [options] <id>

Options:
  -h, --help     Show help message
  -v, --verbose  Enable verbose output

Arguments:
  <id>           The ID to process`);
    process.exit(0);
  }

  const [id] = args;
  if (!id) {
    console.error('Error: Missing required argument <id>');
    console.error('Usage: npx tsx scripts/test.ts [options] <id>');
    console.error('Use --help for more information');
    process.exit(1);
  }

  if (values.verbose) {
    console.log(`Verbose mode enabled`);
    console.log(`Processing ID: ${id}`);
  } else {
    console.log(`Id: ${id}`);
  }
}

/**
 * Usage:
 * npx tsx scripts/test.ts <id>
 * npx tsx scripts/test.ts --help
 * npx tsx scripts/test.ts --verbose <id>
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
