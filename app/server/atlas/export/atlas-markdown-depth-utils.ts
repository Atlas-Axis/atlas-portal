/**
 * Utility functions for calculating semantic depth and finding parent documents
 * in Atlas Markdown format.
 *
 * These utilities are shared across the exporter, importer, and validator to ensure
 * consistent handling of document hierarchy when heading levels are capped at 6.
 */
import { type AtlasDocumentType } from '../atlas-types';

/**
 * Calculate the semantic depth of a document based on its document number and type.
 *
 * The semantic depth represents the true hierarchical level of the document,
 * regardless of the heading level used in the markdown (which is capped at 6).
 *
 * Algorithm:
 * - For supporting documents (Annotations, Tenets, Scenarios, etc.), calculate the
 *   depth of their target/parent document recursively, then add 1
 * - For regular documents, count the segments in the document number
 * - For Needed Research, return null (context-dependent, must use parent from stack)
 *
 * @param docNo - Document number (e.g., 'A.1.2.3', 'A.1.1.1.0.3.1', 'NR-5')
 * @param type - Atlas document type
 * @returns Semantic depth (1 for Scope, 2 for Article, etc.) or null for Needed Research
 */
export function calculateSemanticDepth(docNo: string, type: AtlasDocumentType): number | null {
  // Needed Research doesn't encode hierarchy in its number
  if (type === 'Needed Research') {
    return null; // Caller must determine from context
  }

  // Special handling for supporting documents with directory numbers
  // Only these types should use recursive depth calculation
  if (['Annotation', 'Action Tenet', 'Scenario', 'Scenario Variation', 'Active Data'].includes(type)) {
    const parentDocNo = findParentDocNumber(docNo, type);
    if (parentDocNo && parentDocNo !== docNo) {
      // Recursively calculate parent depth and add 1
      const parentType = inferDocumentType(parentDocNo);
      const parentDepth = calculateSemanticDepth(parentDocNo, parentType);
      return parentDepth !== null ? parentDepth + 1 : null;
    }
  }

  // For regular documents (Scope, Article, Section, Core, Type Spec, ADC), count segments
  // A.1 = 2 segments = depth 1 (Scope)
  // A.1.2 = 3 segments = depth 2 (Article)
  // A.1.2.3 = 4 segments = depth 3 (Section)
  // A.1.2.3.4 = 5 segments = depth 4 (Core)
  const segments = docNo.split('.');
  return segments.length - 1; // Subtract 1 because 'A' is prefix, not a depth level
}

/**
 * Find the parent document number for a given document.
 *
 * Handles special patterns:
 * - Annotations (.0.3.X): Parent is the target document before .0.3.X
 * - Tenets (.0.4.X): Parent is the target document before .0.4.X
 * - Scenarios (.1.X): Parent is the tenet before .1.X
 * - Scenario Variations (.varX): Parent is the scenario before .varX
 * - Active Data (.0.6.X): Parent is the controller before .0.6.X
 * - Regular documents: Remove last segment
 *
 * @param docNo - Document number
 * @param type - Atlas document type
 * @returns Parent document number, or null if no parent (root Scope)
 */
export function findParentDocNumber(docNo: string, type: AtlasDocumentType): string | null {
  // Handle Needed Research specially - no encoded parent
  if (type === 'Needed Research') {
    return null; // Context-dependent
  }

  // Handle Scenario Variation (.varX)
  if (type === 'Scenario Variation') {
    const match = docNo.match(/^(.+)\.var\d+$/);
    return match ? match[1] : null;
  }

  // Handle supporting documents with directory numbers
  if (type === 'Annotation') {
    // Pattern: A.1.1.1.0.3.1 → parent is A.1.1.1
    const match = docNo.match(/^(.+)\.0\.3\.\d+$/);
    return match ? match[1] : null;
  }

  if (type === 'Action Tenet') {
    // Pattern: A.1.4.5.0.4.1 → parent is A.1.4.5
    const match = docNo.match(/^(.+)\.0\.4\.\d+$/);
    return match ? match[1] : null;
  }

  if (type === 'Scenario') {
    // Pattern: A.1.4.5.0.4.1.1.1 → parent is A.1.4.5.0.4.1
    const match = docNo.match(/^(.+)\.1\.\d+$/);
    return match ? match[1] : null;
  }

  if (type === 'Active Data') {
    // Pattern: A.1.1.3.1.0.6.1 → parent is A.1.1.3.1
    const match = docNo.match(/^(.+)\.0\.6\.\d+$/);
    return match ? match[1] : null;
  }

  // Regular documents: remove last segment
  const segments = docNo.split('.');
  if (segments.length <= 2) {
    // This is a root Scope (A.0, A.1, etc.)
    return null;
  }

  // Remove last segment to get parent
  return segments.slice(0, -1).join('.');
}

/**
 * Infer the document type from a document number.
 *
 * This is a heuristic for determining parent types during depth calculation.
 * Not perfectly accurate but sufficient for depth calculation purposes.
 *
 * @param docNo - Document number
 * @returns Most likely Atlas document type
 */
function inferDocumentType(docNo: string): AtlasDocumentType {
  // Needed Research
  if (docNo.startsWith('NR-')) {
    return 'Needed Research';
  }

  // Check for special patterns (order matters!)
  // Scenario Variations end with .varX
  if (docNo.match(/\.var\d+$/)) {
    return 'Scenario Variation';
  }

  // Annotations end with .0.3.X
  if (docNo.match(/\.0\.3\.\d+$/)) {
    return 'Annotation';
  }

  // Active Data ends with .0.6.X
  if (docNo.match(/\.0\.6\.\d+$/)) {
    return 'Active Data';
  }

  // Scenarios: <target>.0.4.<tenet-num>.1.<scenario-num>
  // Must check for .0.4. before .1. to avoid false positives with Core documents like A.0.1.2.1.1
  if (docNo.match(/\.0\.4\.\d+\.1\.\d+$/)) {
    return 'Scenario';
  }

  // Tenets: <target>.0.4.<tenet-num> (but NOT followed by .1.X which would be Scenario)
  if (docNo.match(/\.0\.4\.\d+$/)) {
    return 'Action Tenet';
  }

  // Count segments to infer type for regular documents
  const segments = docNo.split('.');
  const depth = segments.length - 1;

  // These are heuristics - may not be 100% accurate for mixed-type documents
  switch (depth) {
    case 1:
      return 'Scope';
    case 2:
      return 'Article';
    case 3:
      return 'Section';
    default:
      // 4+ could be Section (nested), Core, Type Specification, or Active Data Controller
      // Default to Core as it's most common
      return 'Core';
  }
}

/**
 * Calculate the heading level (number of #'s) for a document in Atlas Markdown.
 *
 * Heading levels are capped at 6 to comply with markdown viewer limitations.
 *
 * @param docNo - Document number
 * @param type - Atlas document type
 * @returns Heading level (1-6)
 */
export function calculateHeadingLevel(docNo: string, type: AtlasDocumentType): number {
  const semanticDepth = calculateSemanticDepth(docNo, type);

  // If depth cannot be determined (Needed Research), default to 6
  if (semanticDepth === null) {
    return 6;
  }

  // Cap at 6, minimum 1
  return Math.min(6, Math.max(1, semanticDepth));
}

/**
 * Validate that a document's heading level matches its semantic depth (capped at 6).
 *
 * @param actualLevel - The actual heading level in the markdown
 * @param docNo - Document number
 * @param type - Atlas document type
 * @returns True if the heading level is correct, false otherwise
 */
export function validateHeadingLevel(actualLevel: number, docNo: string, type: AtlasDocumentType): boolean {
  const expectedLevel = calculateHeadingLevel(docNo, type);
  return actualLevel === expectedLevel;
}
