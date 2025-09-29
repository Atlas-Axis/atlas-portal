#!/usr/bin/env node
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { MASTER_STATUS_ID_MAP, MasterStatus } from '@/app/server/services/atlas/constants';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { notion } from '@/app/server/services/notion/notion-client';
import { detectMissingChildren } from './atlas-json/atlas-tree-errors';
import { loadEnv } from './utils/load-env';

/**
 * Main function to validate missing child IDs from Supabase by checking their Master Status in Notion
 */
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

    // Log all the IDs into `.debug-data/missing_child_ids.log`
    const fs = await import('fs/promises');
    await fs.writeFile('.debug-data/missing_child_ids.log', ids.join('\n'), 'utf-8');
    console.log('Wrote missing child IDs to .debug-data/missing_child_ids.log');

    //
    const logFilePath = resolve(process.cwd(), '.debug-data/missing_child_ids.log');

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

    const pageIdsByStatus: {
      [key in MasterStatus]: string[];
    } & {
      _MULTIPLE_STATUSES_: { pageId: string; statuses: string[] }[];
      _NONE_: { pageId: string; docType?: string }[];
      _OTHER_: { pageId: string; error?: string; unknownStatusIds?: string[]; docType?: string }[];
    } = {
      Deferred: [],
      Archived: [],
      Approved: [],
      Provisional: [],
      Placeholder: [],
      _MULTIPLE_STATUSES_: [],
      _NONE_: [],
      _OTHER_: [],
    };

    // Create reverse mapping from Master Status ID to status name
    const masterStatusIdToName: { [id: string]: MasterStatus } = {};
    for (const [statusName, statusId] of Object.entries(MASTER_STATUS_ID_MAP)) {
      masterStatusIdToName[statusId] = statusName as MasterStatus;
    }

    // Helper function to extract document type from page properties
    function extractDocumentType(pageResponse: PageObjectResponse): string | undefined {
      // Try 'Doc Type' property first
      const docTypeProperty = pageResponse.properties['Doc Type'];
      if (docTypeProperty && docTypeProperty.type === 'select' && docTypeProperty.select) {
        return docTypeProperty.select.name;
      }

      // Try 'Type' property as fallback
      const typeProperty = pageResponse.properties['Type'];
      if (typeProperty && typeProperty.type === 'select' && typeProperty.select) {
        return typeProperty.select.name;
      }

      return undefined;
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
          const docType = extractDocumentType(pageResponse);
          const masterStatusProperty = pageResponse.properties['Master Status'];

          if (masterStatusProperty && masterStatusProperty.type === 'relation') {
            const relationIds = masterStatusProperty.relation.map((rel: { id: string }) => rel.id);

            if (relationIds.length === 0) {
              pageIdsByStatus._NONE_.push({ pageId: id, docType });
            } else if (relationIds.length > 1) {
              // Multiple statuses - store page ID with all status names
              const statusNames = relationIds
                .map((relId) => masterStatusIdToName[relId])
                .filter((name) => name !== undefined);
              const unknownIds = relationIds.filter((relId) => !masterStatusIdToName[relId]);

              const allStatuses = [...statusNames];
              if (unknownIds.length > 0) {
                allStatuses.push(...unknownIds.map((id) => `Unknown:${id}`));
              }

              pageIdsByStatus._MULTIPLE_STATUSES_.push({
                pageId: id,
                statuses: allStatuses,
              });
            } else {
              // Single status - map ID to status name and add to appropriate array
              const statusId = relationIds[0];
              const statusName = masterStatusIdToName[statusId];

              if (statusName) {
                pageIdsByStatus[statusName].push(id);
              } else {
                pageIdsByStatus._OTHER_.push({
                  pageId: id,
                  unknownStatusIds: [statusId],
                  docType,
                });
                console.log(`  Unknown Master Status ID: ${statusId}`);
              }
            }
          } else {
            pageIdsByStatus._NONE_.push({ pageId: id, docType });
          }
        } else {
          console.log(`  Page ${id} is not a page object`);
          pageIdsByStatus._OTHER_.push({
            pageId: id,
            error: 'Not a page object',
          });
        }
      } catch (error) {
        console.log(`  Error retrieving page ${id}: ${error}`);
        pageIdsByStatus._OTHER_.push({
          pageId: id,
          error: String(error),
          // docType is unavailable due to error retrieving page
        });
      }
    }

    // Display results
    console.log('\n=== Master Status Analysis Results ===');
    console.log(`Processed: ${itemsToProcess}/${missingChildIds.length} missing child IDs`);
    if (testMode) {
      console.log('🧪 Test mode was enabled - only processed first 10 items');
    }
    console.log('');
    for (const [status, data] of Object.entries(pageIdsByStatus)) {
      if (Array.isArray(data) && data.length > 0) {
        if (status === '_MULTIPLE_STATUSES_') {
          const multipleStatusData = data as { pageId: string; statuses: string[] }[];
          console.log(`${status}: ${multipleStatusData.length} pages`);
          multipleStatusData.forEach((item, index) => {
            console.log(`  ${index + 1}. Page ID: ${item.pageId}`);
            console.log(`     Statuses: ${item.statuses.join(', ')}`);
          });
          console.log('');
        } else if (status === '_NONE_') {
          const noneData = data as { pageId: string; docType?: string }[];
          console.log(`${status}: ${noneData.length} pages`);
          noneData.forEach((item, index) => {
            console.log(`  ${index + 1}. Page ID: ${item.pageId}`);
            if (item.docType) {
              console.log(`     Document Type: ${item.docType}`);
            }
          });
          console.log('');
        } else if (status === '_OTHER_') {
          const otherData = data as { pageId: string; error?: string; unknownStatusIds?: string[]; docType?: string }[];
          console.log(`${status}: ${otherData.length} pages`);
          otherData.forEach((item, index) => {
            console.log(`  ${index + 1}. Page ID: ${item.pageId}`);
            if (item.docType) {
              console.log(`     Document Type: ${item.docType}`);
            }
            if (item.error) {
              console.log(`     Error: ${item.error}`);
            }
            if (item.unknownStatusIds) {
              console.log(`     Unknown Status IDs: ${item.unknownStatusIds.join(', ')}`);
            }
          });
          console.log('');
        } else {
          // Regular status categories (arrays of strings)
          const stringData = data as string[];
          console.log(`${status}: ${stringData.length} pages`);
          console.log(`  Page IDs: ${stringData.join(', ')}`);
          console.log('');
        }
      }
    }

    // Write results to JSON file
    const outputPath = resolve(process.cwd(), '.debug-data/missing_child_ids_by_master_status.json');
    const outputData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalMissingChildIds: missingChildIds.length,
        processedIds: itemsToProcess,
        testMode: testMode,
      },
      pageIdsByStatus,
    };

    await (await import('fs/promises')).writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`\n📄 Results written to: ${outputPath}`);

    process.exit(0);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error('Error: .debug-data/missing_child_ids.log file not found.');
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
 * This script loads .debug-data/missing_child_ids.log, parses the lines into an array of strings,
 * and analyzes their Master Status properties via the Notion API. It stores and displays
 * the page IDs for each status type (Deferred, Archived, Approved, Provisional, Placeholder)
 * or multiple statuses, providing detailed lists for further investigation.
 *
 * Outputs:
 * - Console: Summary of results with page counts and IDs, enhanced details for special categories
 * - .debug-data/missing_child_ids_by_master_status.json: Detailed JSON file with metadata and page IDs by status
 *   - Regular statuses: arrays of page ID strings
 *   - _MULTIPLE_STATUSES_: array of objects with pageId and statuses array
 *   - _OTHER_: array of objects with pageId, error messages, and unknown status IDs
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
