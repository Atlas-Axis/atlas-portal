import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasDatabaseName } from '@/app/server/services/atlas/constants';
import { compareDocNumbers } from './utils';

/**
 * Document numbering utilities based on Atlas Document Numbering Rules
 *
 * This module implements the hierarchical document numbering system for Atlas documents
 * as defined in ATLAS_DOCUMENT_NUMBERING_RULES.md
 */

export interface DocumentHierarchy {
  [notionPageId: string]: {
    page: NotionDatabasePage;
    children: string[];
    parentId?: string;
  };
}

/**
 * Builds a hierarchy map from a list of Notion database pages
 * Uses child relationship arrays to establish cross-database hierarchy
 */
export function buildDocumentHierarchy(pages: NotionDatabasePage[]): DocumentHierarchy {
  const hierarchy: DocumentHierarchy = {};

  // Initialize all pages
  for (const page of pages) {
    hierarchy[page.notion_page_id] = {
      page,
      children: [],
    };
  }

  // Build parent-child relationships using child relationship arrays ONLY
  for (const page of pages) {
    // Add children from all child relationship arrays
    const childArrays = [
      page.child_scope_ids,
      page.child_article_ids,
      page.child_section_and_primary_doc_ids,
      page.child_annotation_ids,
      page.child_tenet_ids,
      page.child_scenario_ids,
      page.child_scenario_variation_ids,
      page.child_active_data_ids,
      page.child_agent_scope_ids,
      page.child_needed_research_ids,
    ];

    for (const childArray of childArrays) {
      if (Array.isArray(childArray)) {
        for (const childId of childArray) {
          if (typeof childId === 'string' && hierarchy[childId]) {
            hierarchy[page.notion_page_id].children.push(childId);
            hierarchy[childId].parentId = page.notion_page_id;
          } else {
            console.warn(`Invalid child ID: ${childId}`);
          }
        }
      }
    }

    // IMPORTANT: Do not use parent_notion_page_id; only derive hierarchy from child_* arrays
  }

  return hierarchy;
}

/**
 * Logs a visualization of the document hierarchy using generated numbers and types.
 * The output groups by root nodes and prints a tree with numbers and types.
 */
export function logDocumentHierarchy(hierarchy: DocumentHierarchy, generatedNumbers: Map<string, string>): void {
  // Build reverse index from parentId to children for quick traversal
  const childrenByParent = new Map<string | undefined, string[]>();
  for (const [id, item] of Object.entries(hierarchy)) {
    const parentId = item.parentId;
    const arr = childrenByParent.get(parentId) || [];
    arr.push(id);
    childrenByParent.set(parentId, arr);
  }

  function sortByDocNumber(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
      const an = generatedNumbers.get(a) || '';
      const bn = generatedNumbers.get(b) || '';
      return compareDocNumbers(an, bn);
    });
  }

  function printNode(id: string, indent: string) {
    const page = hierarchy[id]?.page;
    const num = generatedNumbers.get(id) || '';
    const type = page?.atlas_document_type || 'Unknown';
    console.log(`${indent}- ${num} [${type}] (${id})`);

    const children = childrenByParent.get(id) || [];
    for (const childId of sortByDocNumber(children)) {
      printNode(childId, indent + '  ');
    }
  }

  // Find roots (items without parentId)
  const rootIds = childrenByParent.get(undefined) || [];
  for (const rootId of sortByDocNumber(rootIds)) {
    printNode(rootId, '');
  }
}

function sortSiblings<T extends { page: NotionDatabasePage }>(items: T[]): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const ao = a.page.sort_order;
    const bo = b.page.sort_order;
    const aHas = ao != null;
    const bHas = bo != null;
    if (aHas && bHas && ao! !== bo!) {
      return ao! - bo!;
    }
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    const an = a.page.atlas_document_number || '';
    const bn = b.page.atlas_document_number || '';
    return compareDocNumbers(an, bn);
  });
  return copy;
}

/**
 * Gets the parent document number for a given page
 * For cross-database relationships, finds the parent by looking for which document has this page in its child arrays
 */
export function getParentDocumentNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  // Find which document has this page as a child using child_* relationships only
  for (const [parentId, parentItem] of Object.entries(hierarchy)) {
    if (parentItem.children.includes(page.notion_page_id)) {
      const parentNumber = generatedDocNumbers.get(parentId);
      if (parentNumber) return parentNumber;
    }
  }

  return '';
}

// Find all parent ids (via child_* only)
function findParentIds(pageId: string, hierarchy: DocumentHierarchy): string[] {
  const parents: string[] = [];
  for (const [parentId, parentItem] of Object.entries(hierarchy)) {
    if (parentItem.children.includes(pageId)) parents.push(parentId);
  }
  return parents;
}

// Choose the primary parent id by matching the generated parent number (if available)
function selectPrimaryParentId(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string | undefined {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  const parentIds = findParentIds(page.notion_page_id, hierarchy).filter((id) => generatedDocNumbers.has(id));
  if (parentNumber) {
    const match = parentIds.find((id) => generatedDocNumbers.get(id) === parentNumber);
    if (match) return match;
  }
  return parentIds[0];
}

/**
 * Generates document number for Scope documents
 * Pattern: A.[Scope Number]
 */
export function generateScopeNumber(page: NotionDatabasePage, hierarchy: DocumentHierarchy): string {
  // Find all scope siblings and sort by sort_order
  const scopeSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => item.page.atlas_database_name === 'Scopes' && !item.parentId),
  );

  const scopeIndex = scopeSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (scopeIndex === -1) return '';
  return `A.${scopeIndex}`;
}

/**
 * Generates document number for Article documents
 * Pattern: [Parent Scope Number].[Article Number]
 */
export function generateArticleNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find parent scope via child_* relationships only
  const parentScopeId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentScopeId) return '';
  const parentScope = hierarchy[parentScopeId];
  if (!parentScope || parentScope.page.atlas_database_name !== 'Scopes') return '';

  // Find all articles that are children of the same parent scope
  const articleSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) => item.page.atlas_database_name === 'Articles' && parentScope.children.includes(item.page.notion_page_id),
    ),
  );

  const articleIndex = articleSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (articleIndex === -1) return '';
  return `${parentNumber}.${articleIndex + 1}`;
}

/**
 * Generates document number for Section documents
 * Pattern: [Parent Article Number].[Section Number]
 */
export function generateSectionNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all section siblings under the same parent using child_* only
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const sectionSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => {
      if (item.page.atlas_database_name !== 'Sections & Primary Docs' || item.page.atlas_document_type !== 'Section') {
        return false;
      }
      // Same parent via child_* relationships
      return hierarchy[parentId].children.includes(item.page.notion_page_id);
    }),
  );

  const sectionIndex = sectionSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (sectionIndex === -1) return '';
  return `${parentNumber}.${sectionIndex + 1}`;
}

/**
 * Generates document number for Core documents
 * Pattern: [Parent Section Number].[Core Number]
 */
export function generateCoreNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all core siblings under the same parent via child_* only
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const coreSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => {
      if (item.page.atlas_database_name !== 'Sections & Primary Docs' || item.page.atlas_document_type !== 'Core') {
        return false;
      }
      // Same parent via child_* relationships
      return hierarchy[parentId].children.includes(item.page.notion_page_id);
    }),
  );

  const coreIndex = coreSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (coreIndex === -1) return '';
  return `${parentNumber}.${coreIndex + 1}`;
}

/**
 * Generates document number for Active Data Controller documents
 * Pattern: [Parent Section Number].[Active Data Controller Number]
 */
export function generateActiveDataControllerNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all controller siblings under the same parent via child_* only
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const controllerSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => {
      if (
        item.page.atlas_database_name !== 'Sections & Primary Docs' ||
        item.page.atlas_document_type !== 'Active Data Controller'
      ) {
        return false;
      }
      // Same parent via child_* relationships
      return hierarchy[parentId].children.includes(item.page.notion_page_id);
    }),
  );

  const controllerIndex = controllerSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (controllerIndex === -1) return '';
  return `${parentNumber}.${controllerIndex + 1}`;
}

/**
 * Generates document number for Type Specification documents
 * Pattern: [Parent Section Number].[Type Specification Number]
 */
export function generateTypeSpecificationNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all type specification siblings under the same parent via child_* only
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const specSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => {
      if (
        item.page.atlas_database_name !== 'Sections & Primary Docs' ||
        item.page.atlas_document_type !== 'Type Specification'
      ) {
        return false;
      }
      // Same parent via child_* relationships
      return hierarchy[parentId].children.includes(item.page.notion_page_id);
    }),
  );

  const specIndex = specSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (specIndex === -1) return '';
  return `${parentNumber}.${specIndex + 1}`;
}

/**
 * Generates document number for Annotation documents
 * Pattern: [Target Document Number].0.3.[Annotation Number]
 */
export function generateAnnotationNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  // Annotations target specific documents - we need to find the target
  // For now, we'll use the parent document as the target
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all annotation siblings targeting the same document
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const annotationSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) =>
        item.page.atlas_database_name === 'Annotations' &&
        hierarchy[parentId].children.includes(item.page.notion_page_id),
    ),
  );

  const annotationIndex = annotationSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (annotationIndex === -1) return '';
  return `${parentNumber}.0.3.${annotationIndex + 1}`;
}

/**
 * Generates document number for Tenet documents
 * Pattern: [Target Document Number].0.4.[Tenet Number]
 */
export function generateTenetNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all tenet siblings targeting the same document
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const tenetSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) =>
        item.page.atlas_database_name === 'Tenets' && hierarchy[parentId].children.includes(item.page.notion_page_id),
    ),
  );

  const tenetIndex = tenetSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (tenetIndex === -1) return '';
  return `${parentNumber}.0.4.${tenetIndex + 1}`;
}

/**
 * Generates document number for Scenario documents
 * Pattern: [Parent Tenet Number].1.[Scenario Number]
 */
export function generateScenarioNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all scenario siblings under the same parent
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const scenarioSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) =>
        item.page.atlas_database_name === 'Scenarios' &&
        hierarchy[parentId].children.includes(item.page.notion_page_id),
    ),
  );

  const scenarioIndex = scenarioSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (scenarioIndex === -1) return '';
  return `${parentNumber}.1.${scenarioIndex + 1}`;
}

/**
 * Generates document number for Scenario Variation documents
 * Pattern: [Parent Scenario Number].var[Variation Number]
 */
export function generateScenarioVariationNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all scenario variation siblings under the same parent
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const variationSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) =>
        item.page.atlas_database_name === 'Scenario Variations' &&
        hierarchy[parentId].children.includes(item.page.notion_page_id),
    ),
  );

  const variationIndex = variationSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (variationIndex === -1) return '';
  return `${parentNumber}.var${variationIndex + 1}`;
}

/**
 * Generates document number for Active Data documents
 * Pattern: [Parent Active Data Controller Number].0.6.[Active Data Number]
 */
export function generateActiveDataNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all active data siblings under the same parent
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const activeDataSiblings = sortSiblings(
    Object.values(hierarchy).filter(
      (item) =>
        item.page.atlas_database_name === 'Active Data' &&
        hierarchy[parentId].children.includes(item.page.notion_page_id),
    ),
  );

  const activeDataIndex = activeDataSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (activeDataIndex === -1) return '';
  return `${parentNumber}.0.6.${activeDataIndex + 1}`;
}

/**
 * Generates document number for Needed Research documents
 * Pattern: NR-[Needed Research Number]
 */
export function generateNeededResearchNumber(page: NotionDatabasePage, hierarchy: DocumentHierarchy): string {
  // Needed Research uses global numbering
  const neededResearchSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => item.page.atlas_database_name === 'Needed Research'),
  );

  const researchIndex = neededResearchSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (researchIndex === -1) return '';
  return `NR-${researchIndex + 1}`;
}

/**
 * Generates document number for Agent Scope Database documents
 * Pattern: [Parent Section Number].[Agent Number] (for Core/Active Data Controller)
 */
export function generateAgentNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedDocNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedDocNumbers);
  if (!parentNumber) return '';

  // Find all agent siblings under the same parent (supports internal nesting)
  // Agent documents can be nested under sections or other agent documents
  const parentId = selectPrimaryParentId(page, hierarchy, generatedDocNumbers);
  if (!parentId) return '';
  const agentSiblings = sortSiblings(
    Object.values(hierarchy).filter((item) => {
      if (item.page.atlas_database_name !== 'Agent Scope Database') {
        return false;
      }
      return hierarchy[parentId].children.includes(item.page.notion_page_id);
    }),
  );

  const agentIndex = agentSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (agentIndex === -1) return '';
  return `${parentNumber}.${agentIndex + 1}`;
}

/**
 * Main function to generate document numbers for all pages.
 * Returns a map of page ID to document number.
 */
export function generateDocumentNumbers(
  pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>,
): Map<string, string> {
  const generatedDocNumbers = new Map<string, string>();

  // Collect all pages from all databases into a single array
  const allPages: NotionDatabasePage[] = [];
  for (const pages of Object.values(pagesByDatabase)) {
    allPages.push(...pages);
  }

  // Build global hierarchy that includes all pages across all databases
  const globalHierarchy = buildDocumentHierarchy(allPages);

  // Process pages in hierarchical order (parents before children)
  // This ensures that parent document numbers are generated before child documents
  const processingOrder: AtlasDatabaseName[] = [
    'Scopes', // Top-level documents
    'Articles', // Children of Scopes
    'Sections & Primary Docs', // Children of Articles
    'Annotations', // Target specific documents
    'Tenets', // Target specific documents
    'Scenarios', // Children of Tenets
    'Scenario Variations', // Children of Scenarios
    'Active Data', // Children of Active Data Controllers
    'Agent Scope Database', // Children of Sections
    'Needed Research', // Global numbering (independent of hierarchy)
  ];

  for (const databaseName of processingOrder) {
    const pages = pagesByDatabase[databaseName] || [];
    if (pages.length === 0) continue;

    // Process pages in dependency order (parents before children)
    const processedPages = new Set<string>();

    function processPage(pageId: string) {
      if (processedPages.has(pageId)) return;

      const item = globalHierarchy[pageId];
      if (!item) return;

      // Process parent first
      if (item.parentId && !processedPages.has(item.parentId)) {
        processPage(item.parentId);
      }

      const page = item.page;
      let docNumber = '';

      // Generate number based on document type and database
      switch (databaseName) {
        case 'Scopes':
          docNumber = generateScopeNumber(page, globalHierarchy);
          break;
        case 'Articles':
          docNumber = generateArticleNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Sections & Primary Docs':
          switch (page.atlas_document_type) {
            case 'Section':
              docNumber = generateSectionNumber(page, globalHierarchy, generatedDocNumbers);
              break;
            case 'Core':
              docNumber = generateCoreNumber(page, globalHierarchy, generatedDocNumbers);
              break;
            case 'Active Data Controller':
              docNumber = generateActiveDataControllerNumber(page, globalHierarchy, generatedDocNumbers);
              break;
            case 'Type Specification':
              docNumber = generateTypeSpecificationNumber(page, globalHierarchy, generatedDocNumbers);
              break;
          }
          break;
        case 'Annotations':
          docNumber = generateAnnotationNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Tenets':
          docNumber = generateTenetNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Scenarios':
          docNumber = generateScenarioNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Scenario Variations':
          docNumber = generateScenarioVariationNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Active Data':
          docNumber = generateActiveDataNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Agent Scope Database':
          docNumber = generateAgentNumber(page, globalHierarchy, generatedDocNumbers);
          break;
        case 'Needed Research':
          docNumber = generateNeededResearchNumber(page, globalHierarchy);
          break;
      }

      if (docNumber) {
        generatedDocNumbers.set(pageId, docNumber);
      }

      processedPages.add(pageId);
    }

    // Process all pages in this database
    for (const page of pages) {
      processPage(page.notion_page_id);
    }
  }

  return generatedDocNumbers;
}
