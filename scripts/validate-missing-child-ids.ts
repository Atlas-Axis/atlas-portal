#!/usr/bin/env node
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { MASTER_STATUS_ID_MAP, MasterStatus } from '@/app/server/services/atlas/constants';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { notion } from '@/app/server/services/notion/notion-client';
import { detectMissingChildren } from './atlas-json/atlas-tree-errors';
import { TreeConstructionOptions, buildAtlasTreeWithValidation } from './atlas-json/atlas-tree-system';
import { loadEnv } from './utils/load-env';

async function main() {
  // Load environment variables
  loadEnv();

  // Check for test flag to limit API calls
  const testMode = process.argv.includes('--test') || process.argv.includes('-t');
  const maxApiCalls = testMode ? 10 : undefined;

  try {
    // Load Atlas data
    const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

    // Detect missing children errors
    const missingChildrenErrors = detectMissingChildren(atlasData);
    console.log(`Detected ${missingChildrenErrors.length} missing child errors in Atlas data`);

    // Extract missing child IDs from the errors
    const ids = missingChildrenErrors
      .map((e) => {
        const ctx = e.context;
        if (
          ctx &&
          typeof ctx === 'object' &&
          'missingChildId' in ctx &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          typeof (ctx as any).missingChildId === 'string'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (ctx as any).missingChildId;
        }
        return null;
      })
      .filter((id): id is string => id !== null);
    console.error('Missing child IDs:', ids);
    console.error('Example errors:', missingChildrenErrors.slice(0, 5));

    // Log all the IDs into `missing_child_ids.log`
    const fs = await import('fs/promises');
    await fs.writeFile('missing_child_ids.log', ids.join('\n'), 'utf-8');
    console.log('Wrote missing child IDs to missing_child_ids.log');

    //
    const logFilePath = resolve(process.cwd(), 'missing_child_ids.log');

    console.log(`Reading missing child IDs from: ${logFilePath}`);
    console.log('---\n');

    // Read the file content
    const fileContent = await readFile(logFilePath, 'utf-8');

    // Parse lines into an array of strings, filtering out empty lines
    const missingChildIds = fileContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Log the count to console
    console.log(`Found ${missingChildIds.length} missing child IDs`);

    // Optional: Show first few IDs as examples
    if (missingChildIds.length > 0) {
      console.log('\nFirst 5 missing child IDs:');
      missingChildIds.slice(0, 5).forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });

      if (missingChildIds.length > 5) {
        console.log(`  ... and ${missingChildIds.length - 5} more`);
      }
    }

    const counters: { [key: MasterStatus | string]: number } = {
      Deferred: 0,
      Archived: 0,
      Approved: 0,
      Provisional: 0,
      Placeholder: 0,
      _MULTIPLE_STATUSES_: 0,
      _NONE_: 0,
      _OTHER_: 0,
    };

    // Create reverse mapping from Master Status ID to status name
    const masterStatusIdToName: { [id: string]: MasterStatus } = {};
    for (const [statusName, statusId] of Object.entries(MASTER_STATUS_ID_MAP)) {
      masterStatusIdToName[statusId] = statusName as MasterStatus;
    }

    console.log('\nAnalyzing Master Status for missing child IDs...');

    if (testMode) {
      console.log(`🧪 Test mode enabled: Processing only first ${maxApiCalls} missing child IDs`);
    }

    // Load each page by ID using the Notion API and check their Master Status property
    const itemsToProcess = maxApiCalls ? Math.min(maxApiCalls, missingChildIds.length) : missingChildIds.length;
    for (let i = 0; i < itemsToProcess; i++) {
      const id = missingChildIds[i];
      try {
        console.log(`Processing ${i + 1}/${itemsToProcess}: ${id}`);

        const page = await notion().pages.retrieve({ page_id: id });
        if (page.object === 'page' && 'properties' in page) {
          const pageResponse = page as PageObjectResponse;
          const masterStatusProperty = pageResponse.properties['Master Status'];

          if (masterStatusProperty && masterStatusProperty.type === 'relation') {
            const relationIds = masterStatusProperty.relation.map((rel: { id: string }) => rel.id);

            if (relationIds.length === 0) {
              counters._NONE_++;
            } else if (relationIds.length > 1) {
              // Multiple statuses - increment only the multiple counter
              counters._MULTIPLE_STATUSES_++;
            } else {
              // Single status - map ID to status name and increment counter
              const statusId = relationIds[0];
              const statusName = masterStatusIdToName[statusId];

              if (statusName) {
                counters[statusName]++;
              } else {
                counters._OTHER_++;
                console.log(`  Unknown Master Status ID: ${statusId}`);
              }
            }
          } else {
            counters._NONE_++;
          }
        } else {
          console.log(`  Page ${id} is not a page object`);
          counters._OTHER_++;
        }
      } catch (error) {
        console.log(`  Error retrieving page ${id}: ${error}`);
        counters._OTHER_++;
      }
    }

    // Display results
    console.log('\n=== Master Status Analysis Results ===');
    console.log(`Processed: ${itemsToProcess}/${missingChildIds.length} missing child IDs`);
    if (testMode) {
      console.log('🧪 Test mode was enabled - only processed first 10 items');
    }
    console.log('');
    for (const [status, count] of Object.entries(counters)) {
      if (count > 0) {
        console.log(`${status}: ${count}`);
      }
    }

    process.exit(1);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error('Error: missing_child_ids.log file not found.');
      console.error('Run "npx tsx scripts/atlas-build.ts" first to generate the file.');
      process.exit(1);
    } else {
      console.error('Error reading missing child IDs:', error);
      process.exit(1);
    }
  }
}

/**
 * Usage:
 * npx tsx scripts/validate-missing-child-ids.ts
 * npx tsx scripts/validate-missing-child-ids.ts --test   # Process only first 10 IDs for testing
 * npx tsx scripts/validate-missing-child-ids.ts -t      # Short form for test mode
 *
 * This script loads missing_child_ids.log, parses the lines into an array of strings,
 * and analyzes their Master Status properties via the Notion API. It counts how many
 * pages have each status type (Deferred, Archived, Approved, Provisional, Placeholder)
 * or multiple statuses.
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
