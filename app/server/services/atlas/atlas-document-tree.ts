import { NotionDatabasePage } from '../../database/notion-database-page';
import { ATLAS_DATABASES } from './constants';

const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

export function getAtlasPageIdMap(
  atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>,
): Map<string, NotionDatabasePage> {
  // Map over all Atlas databases and create a combined map of page ID to NotionDatabasePage
  const pageIdMap: Map<string, NotionDatabasePage> = new Map(
    Object.values(atlasPagesPerDatabase)
      .flat()
      .map((page) => [page.notion_page_id, page]),
  );
  return pageIdMap;
}

// Atlas document hierarchy: Scopes are roots
export function getAtlasRootPages(
  atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>,
): NotionDatabasePage[] | undefined {
  // Only Scopes documents are roots, and they must not have a parent
  const scopePages = (atlasPagesPerDatabase[ATLAS_DATABASES.SCOPES] || []).filter(
    (page) => page.parent_notion_page_id === null,
  );

  if (scopePages.length > 0) {
    return scopePages;
  }

  throw new Error('No root pages found in Atlas databases (Scopes)');
}

/**
 * Given a NotionDatabasePage, returns its child pages categorized into "immutable and primary documents" and "supporting documents" based on the Atlas document hierarchy.
 */
export function getAtlasDocumentChildPages(
  page: NotionDatabasePage,
  pageIdMap: Map<string, NotionDatabasePage>,
): { immutableAndPrimaryDocumentPages: NotionDatabasePage[]; supportingDocumentPages: NotionDatabasePage[] } {
  const parentAtlasDatabaseName = page.atlas_database_name;

  const immutableAndPrimaryDocumentIds = [
    ...(page.child_scope_ids as string[]),
    ...(page.child_article_ids as string[]),
    ...(page.child_section_and_primary_doc_ids as string[]),
    ...(page.child_agent_scope_ids as string[]),
  ];

  const supportingDocumentIds = [
    ...(page.child_annotation_ids as string[]),
    ...(page.child_tenet_ids as string[]),
    ...(page.child_scenario_ids as string[]),
    ...(page.child_scenario_variation_ids as string[]),
    ...(page.child_active_data_ids as string[]),
    ...(page.child_needed_research_ids as string[]),
  ];

  const immutableAndPrimaryDocumentPages: NotionDatabasePage[] = immutableAndPrimaryDocumentIds
    .map((id) => pageIdMap.get(id))
    .filter((child): child is NotionDatabasePage => child !== undefined)
    .filter((child) => {
      // Filter out non-root documents for when a child is not in the same database as the parent (e.g. Articles' child_section_and_primary_doc_ids include ALL Sections and Primary Docs, but we only want root ones here)
      // This is caused by weird Notion relationship mappings in some cases, where the parent document defines all its descendants' IDs in the relationship list, not just its direct children
      if (child.atlas_database_name !== parentAtlasDatabaseName) {
        const isRootInItsOwnDatabase = !child.parent_notion_page_id;
        if (!isRootInItsOwnDatabase && DEBUG_LOGGING) {
          console.log(
            'Skipping non-root child document to avoid duplicated entries showing up on the wrong level:',
            child.notion_page_id,
            child.plain_text_name,
          );
        }
        return isRootInItsOwnDatabase;
      }
      return true;
    });

  const supportingDocumentPages: NotionDatabasePage[] = supportingDocumentIds
    .map((id) => pageIdMap.get(id))
    .filter((child): child is NotionDatabasePage => child !== undefined)
    .filter((child) => {
      // Filter out non-root documents for when a child is not in the same database as the parent (e.g. Articles' child_section_and_primary_doc_ids include ALL Sections and Primary Docs, but we only want root ones here)
      // This is caused by weird Notion relationship mappings in some cases, where the parent document defines all its descendants' IDs in the relationship list, not just its direct children
      if (child.atlas_database_name !== parentAtlasDatabaseName) {
        const isRootInItsOwnDatabase = !child.parent_notion_page_id;
        if (!isRootInItsOwnDatabase && DEBUG_LOGGING) {
          console.log(
            'Skipping non-root child document to avoid duplicated entries showing up on the wrong level:',
            child.notion_page_id,
            child.plain_text_name,
          );
        }
        return isRootInItsOwnDatabase;
      }
      return true;
    });

  return { immutableAndPrimaryDocumentPages, supportingDocumentPages };
}

/**
 * Recursively collects all node IDs that would be rendered in the Atlas tree
 * starting from the given page and following all child relationships.
 */
function collectRenderedNodeIds(
  page: NotionDatabasePage,
  pageIdMap: Map<string, NotionDatabasePage>,
  renderedIds: Set<string> = new Set(),
  depth: number = 0,
): Set<string> {
  if (depth > 50) {
    throw new Error('Maximum tree depth exceeded, possible circular reference');
  }

  renderedIds.add(page.notion_page_id);
  const { immutableAndPrimaryDocumentPages, supportingDocumentPages } = getAtlasDocumentChildPages(page, pageIdMap);

  // Recursively collect IDs from children
  [...immutableAndPrimaryDocumentPages, ...supportingDocumentPages].forEach((child) => {
    collectRenderedNodeIds(child, pageIdMap, renderedIds, depth + 1);
  });

  return renderedIds;
}

/**
 * Finds all orphaned nodes in the Atlas - nodes that exist in the database
 * but are not connected to the tree hierarchy and therefore won't be rendered.
 *
 * @param atlasPagesPerDatabase - Record of database ID to pages
 * @returns Array of orphaned page objects with detailed information
 */
export function getAtlasOrphanedNodes(atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>): Array<{
  pageId: string;
  page: NotionDatabasePage;
  canonical_document_title?: string;
  atlas_document_type?: string;
  plain_text_name?: string;
  plain_text_content_preview?: string;
}> {
  const pageIdMap = getAtlasPageIdMap(atlasPagesPerDatabase);
  const rootPages = getAtlasRootPages(atlasPagesPerDatabase);

  if (!rootPages) {
    // If no root pages, all pages are orphaned
    return Array.from(pageIdMap.entries()).map(([pageId, page]) => ({
      pageId,
      page,
      canonical_document_title: page.canonical_document_title || undefined,
      atlas_document_type: page.atlas_document_type || undefined,
      plain_text_name: page.plain_text_name || undefined,
      plain_text_content_preview: page.plain_text_content?.substring(0, 100) || undefined,
    }));
  }

  // Collect all node IDs that would be rendered
  const renderedNodeIds = new Set<string>();
  rootPages.forEach((rootPage) => {
    collectRenderedNodeIds(rootPage, pageIdMap, renderedNodeIds);
  });

  // Find orphaned nodes
  const allNodeIds = new Set(pageIdMap.keys());
  const orphanedNodeIds = Array.from(allNodeIds).filter((nodeId) => !renderedNodeIds.has(nodeId));

  return orphanedNodeIds.map((pageId) => {
    const page = pageIdMap.get(pageId)!;
    return {
      pageId,
      page,
      canonical_document_title: page.canonical_document_title || undefined,
      atlas_document_type: page.atlas_document_type || undefined,
      plain_text_name: page.plain_text_name || undefined,
      plain_text_content_preview: page.plain_text_content?.substring(0, 100) || undefined,
    };
  });
}

/**
 * Logs orphaned nodes to the console with detailed information.
 * Useful for debugging and identifying data integrity issues.
 */
export function logAtlasOrphanedNodes(atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>): void {
  const orphanedNodes = getAtlasOrphanedNodes(atlasPagesPerDatabase);

  if (orphanedNodes.length > 0) {
    console.log('🔍 Found orphaned nodes (not rendered in tree):', orphanedNodes.length);
    orphanedNodes.forEach(
      ({ pageId, canonical_document_title, atlas_document_type, plain_text_name, plain_text_content_preview }) => {
        console.log(`📍 Orphaned node: ${pageId}`, {
          canonical_document_title,
          atlas_document_type,
          plain_text_name,
          plain_text_content_preview: plain_text_content_preview ? plain_text_content_preview + '...' : undefined,
        });
      },
    );
  } else {
    console.log('✅ No orphaned nodes found - all nodes in pageIdMap have been rendered');
  }
}
