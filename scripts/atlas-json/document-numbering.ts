import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasDatabaseName } from '@/app/server/services/atlas/constants';

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
    parent?: string;
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

  // Build parent-child relationships using child relationship arrays
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
            hierarchy[childId].parent = page.notion_page_id;
          }
        }
      }
    }

    // Also handle internal parent-child relationships within the same database
    if (page.parent_notion_page_id && hierarchy[page.parent_notion_page_id]) {
      hierarchy[page.parent_notion_page_id].children.push(page.notion_page_id);
      hierarchy[page.notion_page_id].parent = page.parent_notion_page_id;
    }
  }

  return hierarchy;
}

/**
 * Gets the parent document number for a given page
 * For cross-database relationships, finds the parent by looking for which document has this page in its child arrays
 */
export function getParentDocumentNumber(
  page: NotionDatabasePage,
  hierarchy: DocumentHierarchy,
  generatedNumbers: Map<string, string>,
): string {
  // First try the direct parent relationship
  if (page.parent_notion_page_id) {
    const parentNumber = generatedNumbers.get(page.parent_notion_page_id);
    if (parentNumber) return parentNumber;
  }

  // For cross-database relationships, find which document has this page as a child
  for (const [parentId, parentItem] of Object.entries(hierarchy)) {
    if (parentItem.children.includes(page.notion_page_id)) {
      const parentNumber = generatedNumbers.get(parentId);
      if (parentNumber) return parentNumber;
    }
  }

  return '';
}

/**
 * Generates document number for Scope documents
 * Pattern: A.[Scope Number]
 */
export function generateScopeNumber(page: NotionDatabasePage, hierarchy: DocumentHierarchy): string {
  // Find all scope siblings and sort by sort_order
  const scopeSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Scopes' && !item.parent)
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all article siblings under the same parent scope
  // We need to find which scope is the parent of this article
  let parentScopeId = '';
  for (const [parentId, parentItem] of Object.entries(hierarchy)) {
    if (parentItem.children.includes(page.notion_page_id) && parentItem.page.atlas_database_name === 'Scopes') {
      parentScopeId = parentId;
      break;
    }
  }

  if (!parentScopeId) return '';

  // Find all articles that are children of the same parent scope
  const articleSiblings = Object.values(hierarchy)
    .filter(
      (item) =>
        item.page.atlas_database_name === 'Articles' &&
        hierarchy[parentScopeId].children.includes(item.page.notion_page_id),
    )
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all section siblings under the same parent (supports internal nesting)
  // For sections, we need to find all sections that have the same parent document
  const sectionSiblings = Object.values(hierarchy)
    .filter((item) => {
      if (item.page.atlas_database_name !== 'Sections & Primary Docs' || item.page.atlas_document_type !== 'Section') {
        return false;
      }

      // Check if this section has the same parent as the current section
      // This supports internal nesting where sections can be children of other sections
      return item.parent === page.parent_notion_page_id;
    })
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all core siblings under the same parent (supports internal nesting)
  // Core documents can be nested under sections or other core documents
  const coreSiblings = Object.values(hierarchy)
    .filter((item) => {
      if (item.page.atlas_database_name !== 'Sections & Primary Docs' || item.page.atlas_document_type !== 'Core') {
        return false;
      }

      // Check if this core document has the same parent as the current core document
      // This supports internal nesting where core documents can be children of other core documents
      return item.parent === page.parent_notion_page_id;
    })
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all active data controller siblings under the same parent (supports internal nesting)
  // Active Data Controllers can be nested under sections or other controllers
  const controllerSiblings = Object.values(hierarchy)
    .filter((item) => {
      if (
        item.page.atlas_database_name !== 'Sections & Primary Docs' ||
        item.page.atlas_document_type !== 'Active Data Controller'
      ) {
        return false;
      }

      // Check if this controller has the same parent as the current controller
      // This supports internal nesting where controllers can be children of other controllers
      return item.parent === page.parent_notion_page_id;
    })
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all type specification siblings under the same parent (supports internal nesting)
  // Type Specifications can be nested under sections or other specifications
  const specSiblings = Object.values(hierarchy)
    .filter((item) => {
      if (
        item.page.atlas_database_name !== 'Sections & Primary Docs' ||
        item.page.atlas_document_type !== 'Type Specification'
      ) {
        return false;
      }

      // Check if this specification has the same parent as the current specification
      // This supports internal nesting where specifications can be children of other specifications
      return item.parent === page.parent_notion_page_id;
    })
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  // Annotations target specific documents - we need to find the target
  // For now, we'll use the parent document as the target
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all annotation siblings targeting the same document
  const annotationSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Annotations' && item.parent === page.parent_notion_page_id)
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all tenet siblings targeting the same document
  const tenetSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Tenets' && item.parent === page.parent_notion_page_id)
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all scenario siblings under the same parent
  const scenarioSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Scenarios' && item.parent === page.parent_notion_page_id)
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all scenario variation siblings under the same parent
  const variationSiblings = Object.values(hierarchy)
    .filter(
      (item) => item.page.atlas_database_name === 'Scenario Variations' && item.parent === page.parent_notion_page_id,
    )
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all active data siblings under the same parent
  const activeDataSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Active Data' && item.parent === page.parent_notion_page_id)
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  const neededResearchSiblings = Object.values(hierarchy)
    .filter((item) => item.page.atlas_database_name === 'Needed Research')
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

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
  generatedNumbers: Map<string, string>,
): string {
  const parentNumber = getParentDocumentNumber(page, hierarchy, generatedNumbers);
  if (!parentNumber) return '';

  // Find all agent siblings under the same parent (supports internal nesting)
  // Agent documents can be nested under sections or other agent documents
  const agentSiblings = Object.values(hierarchy)
    .filter((item) => {
      if (item.page.atlas_database_name !== 'Agent Scope Database') {
        return false;
      }

      // Check if this agent document has the same parent as the current agent document
      // This supports internal nesting where agent documents can be children of other agent documents
      return item.parent === page.parent_notion_page_id;
    })
    .sort((a, b) => (a.page.sort_order || 0) - (b.page.sort_order || 0));

  const agentIndex = agentSiblings.findIndex((item) => item.page.notion_page_id === page.notion_page_id);
  if (agentIndex === -1) return '';
  return `${parentNumber}.${agentIndex + 1}`;
}

/**
 * Main function to generate document numbers for all pages
 */
export function generateDocumentNumbers(
  pagesByDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]>,
): Map<string, string> {
  const generatedNumbers = new Map<string, string>();

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
      if (item.parent && !processedPages.has(item.parent)) {
        processPage(item.parent);
      }

      const page = item.page;
      let docNumber = '';

      // Generate number based on document type and database
      switch (databaseName) {
        case 'Scopes':
          docNumber = generateScopeNumber(page, globalHierarchy);
          break;
        case 'Articles':
          docNumber = generateArticleNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Sections & Primary Docs':
          switch (page.atlas_document_type) {
            case 'Section':
              docNumber = generateSectionNumber(page, globalHierarchy, generatedNumbers);
              break;
            case 'Core':
              docNumber = generateCoreNumber(page, globalHierarchy, generatedNumbers);
              break;
            case 'Active Data Controller':
              docNumber = generateActiveDataControllerNumber(page, globalHierarchy, generatedNumbers);
              break;
            case 'Type Specification':
              docNumber = generateTypeSpecificationNumber(page, globalHierarchy, generatedNumbers);
              break;
          }
          break;
        case 'Annotations':
          docNumber = generateAnnotationNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Tenets':
          docNumber = generateTenetNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Scenarios':
          docNumber = generateScenarioNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Scenario Variations':
          docNumber = generateScenarioVariationNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Active Data':
          docNumber = generateActiveDataNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Agent Scope Database':
          docNumber = generateAgentNumber(page, globalHierarchy, generatedNumbers);
          break;
        case 'Needed Research':
          docNumber = generateNeededResearchNumber(page, globalHierarchy);
          break;
      }

      if (docNumber) {
        generatedNumbers.set(pageId, docNumber);
      }

      processedPages.add(pageId);
    }

    // Process all pages in this database
    for (const page of pages) {
      processPage(page.notion_page_id);
    }
  }

  return generatedNumbers;
}
