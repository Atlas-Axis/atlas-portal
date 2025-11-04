import { AtlasTreeNode } from './atlas-tree-types';

/**
 * Document number generation for Atlas documents. (see rules in `docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`)
 *
 * This module implements the hierarchical document numbering system for Atlas documents
 * using tree traversal instead of the previous sequential approach. The tree-based approach
 * is more efficient and robust for handling complex hierarchies with ~6000 documents.
 */

/**
 * Assigns document numbers to all nodes in the tree using the Atlas Document Numbering Rules.
 *
 * This function performs a pre-order traversal of the tree and assigns hierarchical
 * document numbers based on the document type and position in the hierarchy.
 *
 * The numbering follows these patterns:
 * - Scopes: A.0, A.1, A.2, ...
 * - Articles: A.0.1, A.0.2, ... (under scope A.0)
 * - Sections: A.0.1.1, A.0.1.2, ... (under article A.0.1)
 * - Annotations: A.0.1.0.3.1, A.0.1.0.3.2, ... (targeting section A.0.1)
 * - Tenets: A.0.1.0.4.1, A.0.1.0.4.2, ... (targeting section A.0.1)
 * - Scenarios: A.0.1.0.4.1.1, A.0.1.0.4.1.2, ... (under tenet A.0.1.0.4.1)
 * - Scenario Variations: A.0.1.0.4.1.1.var1, A.0.1.0.4.1.1.var2, ... (under scenario A.0.1.0.4.1.1)
 * - Active Data: A.0.1.0.6.1, A.0.1.0.6.2, ... (targeting Active Data Controller A.0.1)
 * - Needed Research: NR-1, NR-2, ... (global numbering)
 *
 * @param scopeTrees - Array of root scope trees to number
 * @returns Map of page ID to generated document number
 *
 * @example
 * ```typescript
 * const uuidMappings = await loadUuidMappings();
 * const result = buildAtlasTree(atlasData, { uuidMappings });
 * // Document numbers are automatically assigned to all nodes in result.scopeTrees
 *
 * // Access document numbers via atlasUUIDsToGeneratedDocIDs map
 * console.log(result.atlasUUIDsToGeneratedDocIDs.get('some-atlas-uuid')); // "A.1.2.3"
 * ```
 */
export function assignDocumentNumbersToTreesRecursively(scopeTrees: AtlasTreeNode[]): Map<string, string> {
  const docNumbers = new Map<string, string>();

  // Global counter for Needed Research documents
  const neededResearchCounter = { value: 1 };

  for (let scopeIndex = 0; scopeIndex < scopeTrees.length; scopeIndex++) {
    const scopeTree = scopeTrees[scopeIndex];

    // Assign scope number
    const scopeNumber = `A.${scopeIndex}`;
    scopeTree.generatedDocID = scopeNumber;
    docNumbers.set(scopeTree.notion_page_id, scopeNumber);

    // Traverse and number all descendants using recursive approach
    traverseAndNumberNode(scopeTree, scopeNumber, docNumbers, neededResearchCounter);
  }

  return docNumbers;
}

/**
 * Recursively traverses a tree node and assigns Atlas document numbers to all descendants.
 * (see rules in `docs/ATLAS_DOCUMENT_NUMBERING_RULES.md`)
 *
 * @param node - The tree node to traverse
 * @param parentNumber - The parent's document number for hierarchical numbering
 * @param docNumbers - Map to store document numbers
 * @param neededResearchCounter - Global counter for Needed Research documents
 */
function traverseAndNumberNode(
  node: AtlasTreeNode,
  parentNumber: string,
  docNumbers: Map<string, string>,
  neededResearchCounter: { value: number },
): void {
  // Number articles
  node.articles.forEach((article, index) => {
    const articleNumber = `${parentNumber}.${index + 1}`;
    article.generatedDocID = articleNumber;
    docNumbers.set(article.notion_page_id, articleNumber);
    traverseAndNumberNode(article, articleNumber, docNumbers, neededResearchCounter);
  });

  // Number documents in Sections & Primary Docs database
  node.sectionsAndPrimaryDocs.forEach((section, index) => {
    const sectionsAndPrimaryDocsDocumentNumber = `${parentNumber}.${index + 1}`;
    section.generatedDocID = sectionsAndPrimaryDocsDocumentNumber;
    docNumbers.set(section.notion_page_id, sectionsAndPrimaryDocsDocumentNumber);
    traverseAndNumberNode(section, sectionsAndPrimaryDocsDocumentNumber, docNumbers, neededResearchCounter);
  });

  // Number annotations
  node.annotations.forEach((annotation, index) => {
    const annotationNumber = `${parentNumber}.0.3.${index + 1}`;
    annotation.generatedDocID = annotationNumber;
    docNumbers.set(annotation.notion_page_id, annotationNumber);
    traverseAndNumberNode(annotation, annotationNumber, docNumbers, neededResearchCounter);
  });

  // Number tenets
  node.tenets.forEach((tenet, index) => {
    const tenetNumber = `${parentNumber}.0.4.${index + 1}`;
    tenet.generatedDocID = tenetNumber;
    docNumbers.set(tenet.notion_page_id, tenetNumber);
    traverseAndNumberNode(tenet, tenetNumber, docNumbers, neededResearchCounter);
  });

  // Number scenarios
  node.scenarios.forEach((scenario, index) => {
    const scenarioNumber = `${parentNumber}.1.${index + 1}`;
    scenario.generatedDocID = scenarioNumber;
    docNumbers.set(scenario.notion_page_id, scenarioNumber);
    traverseAndNumberNode(scenario, scenarioNumber, docNumbers, neededResearchCounter);
  });

  // Number scenario variations
  node.scenarioVariations.forEach((variation, index) => {
    const variationNumber = `${parentNumber}.var${index + 1}`;
    variation.generatedDocID = variationNumber;
    docNumbers.set(variation.notion_page_id, variationNumber);
    traverseAndNumberNode(variation, variationNumber, docNumbers, neededResearchCounter);
  });

  // Number active data
  node.activeData.forEach((activeData, index) => {
    const activeDataNumber = `${parentNumber}.0.6.${index + 1}`;
    activeData.generatedDocID = activeDataNumber;
    docNumbers.set(activeData.notion_page_id, activeDataNumber);
    traverseAndNumberNode(activeData, activeDataNumber, docNumbers, neededResearchCounter);
  });

  // Number agent scope documents
  node.agentScopeDocs.forEach((agentScopeDoc, index) => {
    const agentDocNumber = `${parentNumber}.${index + 1}`;
    agentScopeDoc.generatedDocID = agentDocNumber;
    docNumbers.set(agentScopeDoc.notion_page_id, agentDocNumber);
    traverseAndNumberNode(agentScopeDoc, agentDocNumber, docNumbers, neededResearchCounter);
  });

  // Number needed research (global numbering)
  node.neededResearch.forEach((neededResearch) => {
    const researchNumber = `NR-${neededResearchCounter.value}`;
    neededResearch.generatedDocID = researchNumber;
    docNumbers.set(neededResearch.notion_page_id, researchNumber);
    neededResearchCounter.value++;
    traverseAndNumberNode(neededResearch, researchNumber, docNumbers, neededResearchCounter);
  });
}

/**
 * Validates that all document numbers are unique and follow the correct patterns.
 *
 * @param docNumbers - Map of page ID to document number
 * @returns Array of validation errors, empty if all numbers are valid
 */
export function validateDocumentNumbers(docNumbers: Map<string, string>): string[] {
  const errors: string[] = [];
  const numberSet = new Set<string>();

  for (const [pageId, docNumber] of docNumbers.entries()) {
    // Check for duplicate numbers
    if (numberSet.has(docNumber)) {
      errors.push(`Duplicate document number: ${docNumber} for page ${pageId}`);
    }
    numberSet.add(docNumber);

    // Check for valid number format
    if (!isValidDocumentNumber(docNumber)) {
      errors.push(`Invalid document number format: ${docNumber} for page ${pageId}`);
    }
  }

  return errors;
}

/**
 * Checks if a document number follows the correct format.
 *
 * @param docNumber - The document number to validate
 * @returns True if the number format is valid
 */
function isValidDocumentNumber(docNumber: string): boolean {
  // Valid patterns:
  // - A.0, A.1, A.2, ... (Scopes)
  // - A.0.1, A.0.2, ... (Articles)
  // - A.0.1.1, A.0.1.2, ... (Sections)
  // - A.0.1.0.3.1, A.0.1.0.3.2, ... (Annotations)
  // - A.0.1.0.4.1, A.0.1.0.4.2, ... (Tenets)
  // - A.0.1.0.4.1.1, A.0.1.0.4.1.2, ... (Scenarios)
  // - A.0.1.0.4.1.1.var1, A.0.1.0.4.1.1.var2, ... (Scenario Variations)
  // - A.0.1.0.6.1, A.0.1.0.6.2, ... (Active Data)
  // - NR-1, NR-2, ... (Needed Research)

  const scopePattern = /^A\.\d+$/;
  const articlePattern = /^A\.\d+\.\d+$/;
  const sectionPattern = /^A\.\d+\.\d+\.\d+$/;
  const annotationPattern = /^A\.\d+\.\d+\.0\.3\.\d+$/;
  const tenetPattern = /^A\.\d+\.\d+\.0\.4\.\d+$/;
  const scenarioPattern = /^A\.\d+\.\d+\.0\.4\.\d+\.1\.\d+$/;
  const variationPattern = /^A\.\d+\.\d+\.0\.4\.\d+\.1\.\d+\.var\d+$/;
  const activeDataPattern = /^A\.\d+\.\d+\.0\.6\.\d+$/;
  const neededResearchPattern = /^NR-\d+$/;

  return (
    scopePattern.test(docNumber) ||
    articlePattern.test(docNumber) ||
    sectionPattern.test(docNumber) ||
    annotationPattern.test(docNumber) ||
    tenetPattern.test(docNumber) ||
    scenarioPattern.test(docNumber) ||
    variationPattern.test(docNumber) ||
    activeDataPattern.test(docNumber) ||
    neededResearchPattern.test(docNumber)
  );
}
