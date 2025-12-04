/**
 * Helper functions for Markdown-to-Notion sync operations
 */
import { getDatabaseNameFromDocument } from '@/app/atlas/sync/_lib/atlas-database-mapper';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';

/**
 * Validates if a Notion page exists.
 * Uses cache to avoid redundant API calls.
 *
 * @param pageId Notion page ID to validate
 * @param cache Optional cache map to store validation results
 * @returns True if page exists, false otherwise
 */
export async function validatePageExists(pageId: string, cache?: Map<string, boolean>): Promise<boolean> {
  if (cache?.has(pageId)) {
    return cache.get(pageId)!;
  }

  try {
    const notionClient = notion();
    await notionClient.pages.retrieve({ page_id: pageId });
    cache?.set(pageId, true);
    return true;
  } catch (error) {
    const err = error as Error & { code?: string };
    const exists = err.code !== 'object_not_found';
    cache?.set(pageId, exists);
    return exists ? true : false;
  }
}

/**
 * Checks if a Notion page has any child relationships.
 *
 * @param pageId Notion page ID to check
 * @param pageDocument Atlas document for the page
 * @param originalIdsToDatabase Map of UUID to database name
 * @returns True if page has children, false otherwise (or true on error for safety)
 */
export async function pageHasChildren(
  pageId: string,
  pageDocument: ExportAtlasTreeBaseDocument,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
): Promise<boolean> {
  try {
    // Use the document's UUID (not the Notion page ID) for database lookup
    // pageDocument.uuid is the Atlas UUID which is the key in originalIdsToDatabase
    const atlasUuid = pageDocument.uuid;
    if (!atlasUuid) {
      console.error(`Document has no UUID: ${pageDocument.doc_no} - ${pageDocument.name}`);
      return true; // Assume has children for safety
    }

    const databaseName = getDatabaseNameFromDocument(pageDocument.type, atlasUuid, originalIdsToDatabase);
    const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
    const childRelationshipNames = Object.values(config.childRelationships).filter((name) => name);

    const notionClient = notion();
    const page = await notionClient.pages.retrieve({ page_id: pageId });
    const pageProps = (page as { properties: Record<string, unknown> }).properties;

    for (const propertyName of childRelationshipNames) {
      const property = pageProps[propertyName] as { type?: string; relation?: unknown[] } | undefined;
      if (property?.type === 'relation' && property.relation && property.relation.length > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking children for page ${pageId}:`, error);
    return true; // Assume has children for safety
  }
}

/**
 * Sorts additions in depth-first order (parents before children).
 * Only considers parent-child relationships within the additions array.
 *
 * @param additions Array of addition changes to sort
 * @returns Sorted array with parents before their children
 */
export function sortAdditionsByDepthFirst(additions: AtlasDocumentChange[]): AtlasDocumentChange[] {
  if (additions.length === 0) return [];

  const childrenMap = new Map<string | null, AtlasDocumentChange[]>();
  const addedUuids = new Set(additions.map((c) => c.uuid));

  for (const change of additions) {
    const parentUuid = change.newAncestry?.length ? change.newAncestry[change.newAncestry.length - 1] : null;
    const effectiveParent = parentUuid && addedUuids.has(parentUuid) ? parentUuid : null;

    if (!childrenMap.has(effectiveParent)) {
      childrenMap.set(effectiveParent, []);
    }
    childrenMap.get(effectiveParent)!.push(change);
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => compareDocNumbers(a.newValues?.doc_no ?? '', b.newValues?.doc_no ?? ''));
  }

  const result: AtlasDocumentChange[] = [];

  function traverse(parentUuid: string | null) {
    const children = childrenMap.get(parentUuid) ?? [];
    for (const child of children) {
      result.push(child);
      if (child.uuid) {
        traverse(child.uuid);
      }
    }
  }

  traverse(null);
  return result;
}

/**
 * Formats a document label for logging purposes.
 *
 * @param change Atlas document change
 * @returns Formatted label: "doc_no - name [type]"
 */
export function getDocumentLabel(change: AtlasDocumentChange): string {
  const doc = change.newValues || change.oldValues;
  if (!doc) return 'Unknown document';
  return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
}
