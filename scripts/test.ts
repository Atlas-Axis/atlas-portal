// #!/usr/bin/env node
async function main() {
  const [id] = process.argv.slice(2);
  if (!id) {
    console.error('Usage: npx tsx scripts/generate-report.ts <id>');
    process.exit(1);
  }

  console.log(`Id: ${id}`);
}

/**
 * Usage:
 * npx tsx scripts/test.ts <id>
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
