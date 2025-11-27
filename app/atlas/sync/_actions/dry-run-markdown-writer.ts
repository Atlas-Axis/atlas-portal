/**
 * Writes dry-run results to a markdown file showing the Notion API calls that would be made.
 * This must run on the server to access the filesystem.
 */
'use server';

import { promises as fs } from 'fs';
import { join } from 'path';
import type { AtlasDiffResult } from '@/app/server/atlas/diff/atlas-diff';
import { UuidMappings, loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { getDatabaseNameFromDocument, getNotionDatabaseIdForDatabaseName } from '../_lib/atlas-database-mapper';
import { buildNotionProperties } from '../_lib/notion-property-builder';
import type { ProcessedChange, SyncResult } from '../_lib/sync-orchestrator';

/**
 * Writes dry-run results to a markdown file showing the Notion API calls that would be made.
 * This must run on the server to access the filesystem.
 */

/**
 * Writes dry-run results to a markdown file showing the Notion API calls that would be made.
 * This must run on the server to access the filesystem.
 */

interface ApiCall {
  operation: string;
  pageId: string;
  documentLabel: string;
  parameters: Record<string, unknown>;
}

/**
 * Writes dry-run results to markdown file.
 * Formats results as a list of Notion API calls that would have been made.
 */
export async function writeDryRunMarkdown(syncResult: SyncResult, diffResult: AtlasDiffResult): Promise<void> {
  const apiCalls: ApiCall[] = [];

  // Load UUID mappings for building properties
  const uuidMappings: UuidMappings = await loadUuidMappings();

  // Helper to get document label
  const getDocumentLabel = (change: ProcessedChange): string => {
    const doc = change.change.newValues || change.change.oldValues;
    if (!doc) return 'Unknown document';
    return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
  };

  // Process succeeded operations
  for (const processed of syncResult.succeeded) {
    const { change, phase } = processed;
    const docLabel = getDocumentLabel(processed);

    if (phase === 'additions') {
      // pages.create
      if (!change.newValues?.uuid) {
        console.warn('Skipping addition without newValues or uuid:', change);
        continue;
      }
      const databaseName = getDatabaseNameFromDocument(
        change.newValues.type,
        change.newValues.uuid,
        diffResult.newIdsToDatabase,
      );
      const databaseId = getNotionDatabaseIdForDatabaseName(databaseName);
      const properties = buildNotionProperties(change.newValues, databaseName, uuidMappings);
      apiCalls.push({
        operation: 'pages.create',
        pageId: 'new page',
        documentLabel: docLabel,
        parameters: {
          parent: { database_id: databaseId },
          properties,
        },
      });
    } else if (phase === 'deletions') {
      // pages.update with archived: true
      apiCalls.push({
        operation: 'pages.update',
        pageId: change.uuid || 'unknown',
        documentLabel: docLabel,
        parameters: {
          page_id: change.uuid,
          archived: true,
        },
      });
    } else {
      // pages.update (content, parent, or sibling order changes)
      const doc = change.newValues || change.oldValues;
      if (doc) {
        const databaseName = change.oldValues
          ? getDatabaseNameFromDocument(change.oldValues.type, change.uuid!, diffResult.originalIdsToDatabase)
          : getDatabaseNameFromDocument(change.newValues!.type, change.uuid!, diffResult.newIdsToDatabase);
        const properties = buildNotionProperties(doc, databaseName, uuidMappings);
        apiCalls.push({
          operation: 'pages.update',
          pageId: change.uuid || 'unknown',
          documentLabel: docLabel,
          parameters: {
            page_id: change.uuid,
            properties,
          },
        });
      }
    }
  }

  // Process skipped operations (show what would be skipped)
  for (const processed of syncResult.skipped) {
    const { change, result } = processed;
    const docLabel = getDocumentLabel(processed);
    const skipReason = result.reason || result.error || 'Unknown reason';

    if (processed.phase === 'additions') {
      if (!change.newValues?.uuid) {
        console.warn('Skipping addition without newValues or uuid:', change);
        continue;
      }
      const databaseName = getDatabaseNameFromDocument(
        change.newValues.type,
        change.newValues.uuid,
        diffResult.newIdsToDatabase,
      );
      const databaseId = getNotionDatabaseIdForDatabaseName(databaseName);
      apiCalls.push({
        operation: 'pages.create (SKIPPED)',
        pageId: 'new page',
        documentLabel: docLabel,
        parameters: {
          parent: { database_id: databaseId },
          skip_reason: skipReason,
        },
      });
    } else if (processed.phase === 'deletions') {
      apiCalls.push({
        operation: 'pages.update (SKIPPED)',
        pageId: change.uuid || 'unknown',
        documentLabel: docLabel,
        parameters: {
          page_id: change.uuid,
          archived: true,
          skip_reason: skipReason,
        },
      });
    } else {
      apiCalls.push({
        operation: 'pages.update (SKIPPED)',
        pageId: change.uuid || 'unknown',
        documentLabel: docLabel,
        parameters: {
          page_id: change.uuid,
          skip_reason: skipReason,
        },
      });
    }
  }

  // Build markdown content
  const timestamp = new Date().toISOString();
  const lines: string[] = [
    `# Dry-Run Results`,
    ``,
    `Generated: ${timestamp}`,
    ``,
    `## Summary`,
    ``,
    `- Total operations: ${apiCalls.length}`,
    `- Would execute: ${syncResult.succeeded.length}`,
    `- Would skip: ${syncResult.skipped.length}`,
    `- Would fail: ${syncResult.failed.length}`,
    ``,
    `## API Calls`,
    ``,
  ];

  // Add each API call with formatted JSON parameters
  for (const call of apiCalls) {
    lines.push(`### ${call.operation}`);
    lines.push(``);
    lines.push(`- **Page ID:** ${call.pageId}`);
    lines.push(`- **Document:** ${call.documentLabel}`);
    lines.push(`- **Parameters:**`);
    lines.push(``);
    lines.push('```json');
    lines.push(JSON.stringify(call.parameters, null, 2));
    lines.push('```');
    lines.push(``);
  }

  // Write to file
  const outputDir = join(process.cwd(), 'app', 'atlas', 'sync');
  const outputPath = join(outputDir, 'dry-run-output.md');

  // Ensure directory exists
  try {
    await fs.access(outputDir);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(outputDir, { recursive: true });
  }

  await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
}
