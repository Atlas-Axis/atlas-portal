import { loadEnv } from './utils/load-env';

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    // TODO: Add your script logic here

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/test.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
