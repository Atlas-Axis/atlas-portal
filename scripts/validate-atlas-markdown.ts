#!/usr/bin/env -S npx tsx
/**
 * Atlas Markdown Validator
 *
 * Standalone validator for Atlas Markdown files.
 *
 * Validations performed:
 * 1. Title Line Format - Validates exact pattern: `# {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->`
 * 2. Document Types - Ensures document type is one of the 12 valid Atlas document types
 * 3. Heading Hierarchy - Checks sequential heading levels (no skipping from # to ###)
 * 4. Blank Lines - Validates required blank lines after titles and around extra fields
 * 5. Extra Fields - Validates format, order, and presence of required fields for:
 *    - Type Specification (6 fields)
 *    - Scenario (3 fields)
 *    - Scenario Variation (3 fields)
 *    - Needed Research (1 field)
 * 6. Document Numbering - Validates patterns for all 12 document types (e.g., A.1, NR-1, .0.3.1)
 * 7. Nesting Rules - Ensures valid parent-child type combinations (e.g., Core under Section)
 * 8. UUID Validation - Checks format (UUID v4), uniqueness, and warns about empty UUIDs
 *
 * Usage:
 *   npx tsx scripts/validate-atlas-markdown.ts path/to/atlas.md
 *   or
 *   ./scripts/validate-atlas-markdown.ts path/to/atlas.md (after chmod +x)
 *
 * Exit codes:
 *   0 - No errors (warnings OK)
 *   1 - Errors found
 */
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ValidationIssue {
  line: number;
  severity: 'error' | 'warning';
  message: string;
  found?: string;
  expected?: string;
  reason?: string;
  example?: string;
  action: string;
}

interface Document {
  line: number;
  level: number;
  docNo: string;
  name: string;
  type: AtlasDocumentType;
  uuid: string;
  rawLine: string;
}

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_TYPES = [
  'Scope',
  'Article',
  'Section',
  'Core',
  'Type Specification',
  'Active Data Controller',
  'Annotation',
  'Action Tenet',
  'Scenario',
  'Scenario Variation',
  'Active Data',
  'Needed Research',
] as const;

type AtlasDocumentType = (typeof DOCUMENT_TYPES)[number];

const EXTRA_FIELDS: Partial<Record<AtlasDocumentType, string[]>> = {
  'Type Specification': [
    'Components',
    'Doc Identifier Rules',
    'Additional Logic',
    'Type Category',
    'Type Name',
    'Type Overview',
  ],
  Scenario: ['Description', 'Finding', 'Additional Guidance'],
  'Scenario Variation': ['Description', 'Finding', 'Additional Guidance'],
  'Needed Research': ['Content'],
};

const TITLE_REGEX = /^(#+)\s+([^\s]+)\s+-\s+(.+?)\s+\[(.+?)\]\s{2}<!--\s*UUID:\s*([a-f0-9-]*)\s*-->$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTRA_FIELD_LABEL_REGEX = /^\*\*(.+?)\*\*:\s*$/;

// Allowed parent-child type combinations
const ALLOWED_NESTING: Record<AtlasDocumentType, AtlasDocumentType[]> = {
  Scope: ['Article', 'Needed Research'],
  Article: ['Section', 'Annotation', 'Needed Research'],
  Section: [
    'Section',
    'Core',
    'Type Specification',
    'Active Data Controller',
    'Annotation',
    'Action Tenet',
    'Needed Research',
  ],
  Core: ['Core', 'Type Specification', 'Active Data Controller', 'Annotation', 'Action Tenet', 'Needed Research'],
  'Type Specification': ['Annotation', 'Action Tenet', 'Needed Research'],
  'Active Data Controller': ['Active Data', 'Annotation', 'Action Tenet', 'Needed Research'],
  Annotation: ['Needed Research'],
  'Action Tenet': ['Scenario', 'Needed Research'],
  Scenario: ['Scenario Variation', 'Needed Research'],
  'Scenario Variation': ['Needed Research'],
  'Active Data': ['Needed Research'],
  'Needed Research': [],
};

// ============================================================================
// Validation Functions
// ============================================================================

function parseTitleLine(line: string, lineNum: number): { doc: Document | null; issue: ValidationIssue | null } {
  const match = line.match(TITLE_REGEX);

  if (!match) {
    // Check if it looks like a title but is malformed
    if (line.match(/^#+\s+.+\[.+\]/)) {
      return {
        doc: null,
        issue: {
          line: lineNum,
          severity: 'error',
          message: '📝 Invalid title format',
          found: line,
          expected: '# {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->',
          action: 'Ensure exactly 2 spaces before <!-- and proper formatting',
        },
      };
    }
    return {
      doc: null,
      issue: {
        line: lineNum,
        severity: 'error',
        message: '📝 Invalid title format',
        action: 'Use format: # {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->',
      },
    };
  }

  const [, hashes, docNo, name, type, uuid] = match;
  const level = hashes.length;

  const doc: Document = {
    line: lineNum,
    level,
    docNo,
    name,
    type: type as AtlasDocumentType,
    uuid,
    rawLine: line,
  };

  // Validate document type
  if (!(DOCUMENT_TYPES as readonly string[]).includes(type as AtlasDocumentType)) {
    return {
      doc, // Still return doc for UUID validation
      issue: {
        line: lineNum,
        severity: 'error',
        message: `🏷️  Invalid document type '${type}'`,
        found: type,
        expected: `One of: ${DOCUMENT_TYPES.join(', ')}`,
        action: 'Use a valid document type',
      },
    };
  }

  return { doc, issue: null };
}

function validateHierarchy(docs: Document[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 1; i < docs.length; i++) {
    const prev = docs[i - 1];
    const curr = docs[i];
    const levelDiff = curr.level - prev.level;

    // Can go deeper by 1, or same level, or shallower by any amount
    if (levelDiff > 1) {
      const prevHashes = '#'.repeat(prev.level);
      const currHashes = '#'.repeat(curr.level);
      const expectedHashes = '#'.repeat(prev.level + 1);

      issues.push({
        line: curr.line,
        severity: 'error',
        message: `🪜 Heading hierarchy error - skipped from level ${prev.level} to level ${curr.level}`,
        found: `Previous: ${prevHashes} ${prev.docNo} (level ${prev.level})\nCurrent:  ${currHashes} ${curr.docNo} (level ${curr.level})`,
        expected: `Insert a level ${prev.level + 1} heading (${expectedHashes}) between these documents`,
        action: `Add missing level ${prev.level + 1} heading`,
      });
    }
  }

  return issues;
}

function validateBlankLines(lines: string[], docs: Document[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const doc of docs) {
    const idx = doc.line - 1; // Convert to 0-based

    // Check blank line after title (always required, even before next document)
    if (idx + 1 < lines.length && lines[idx + 1].trim() !== '') {
      issues.push({
        line: doc.line + 1,
        severity: 'error',
        message: '📄 Missing blank line after title',
        action: 'Add a blank line after the title line',
      });
    }
  }

  return issues;
}

function validateExtraFields(lines: string[], docs: Document[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Pre-compute document boundaries for performance
  const docBoundaries = new Map<number, number>();
  for (let i = 0; i < docs.length; i++) {
    const startIdx = docs[i].line - 1;
    const nextDocIdx = i + 1 < docs.length ? docs[i + 1].line - 1 : lines.length;
    docBoundaries.set(startIdx, nextDocIdx);
  }

  for (const doc of docs) {
    const requiredFields = EXTRA_FIELDS[doc.type];
    if (!requiredFields) continue;

    const docStartIdx = doc.line - 1;
    const nextDocIdx = docBoundaries.get(docStartIdx) || lines.length;

    const docLines = lines.slice(docStartIdx + 1, nextDocIdx);
    const foundFields: string[] = [];

    for (let i = 0; i < docLines.length; i++) {
      const line = docLines[i];
      const match = line.match(EXTRA_FIELD_LABEL_REGEX);

      if (match) {
        const fieldName = match[1];
        foundFields.push(fieldName);

        // Check if field is in required list
        if (!requiredFields.includes(fieldName)) {
          issues.push({
            line: docStartIdx + i + 2,
            severity: 'error',
            message: `➕ Unexpected extra field '${fieldName}' for document type '${doc.type}'`,
            expected: `Valid fields: ${requiredFields.join(', ')}`,
            action: `Remove this field or check if document type is correct`,
          });
        }

        // Check blank line after label
        if (i + 1 < docLines.length && docLines[i + 1].trim() !== '') {
          issues.push({
            line: docStartIdx + i + 3,
            severity: 'error',
            message: `📄 Extra field '${fieldName}' missing blank line after label`,
            found: `**${fieldName}**:\n${docLines[i + 1]}`,
            expected: `**${fieldName}**:\n\n${docLines[i + 1]}`,
            action: 'Add a blank line after the label line',
          });
        }
      }
    }

    // Check field order
    const expectedOrder = requiredFields.filter((f) => foundFields.includes(f));
    const actualOrder = foundFields.filter((f) => requiredFields.includes(f));

    if (JSON.stringify(expectedOrder) !== JSON.stringify(actualOrder)) {
      issues.push({
        line: doc.line,
        severity: 'error',
        message: `🔢 Extra fields in wrong order for '${doc.type}'`,
        found: `Found: ${actualOrder.join(', ')}`,
        expected: `Expected: ${requiredFields.join(', ')}`,
        action: 'Reorder extra fields to match the required order',
      });
    }

    // Check all required fields present
    for (const field of requiredFields) {
      if (!foundFields.includes(field)) {
        issues.push({
          line: doc.line,
          severity: 'error',
          message: `❌ Missing required extra field '${field}' for document type '${doc.type}'`,
          expected: `All fields: ${requiredFields.join(', ')}`,
          action: `Add the missing '${field}' field`,
        });
      }
    }
  }

  return issues;
}

function validateDocumentNumber(doc: Document): ValidationIssue | null {
  const { docNo, type } = doc;

  // Needed Research has special format
  if (type === 'Needed Research') {
    if (!docNo.match(/^NR-\d+$/)) {
      return {
        line: doc.line,
        severity: 'error',
        message: `🔢 Invalid Needed Research document number '${docNo}'`,
        expected: 'NR-{N} where N is a positive integer',
        example: 'NR-1, NR-5, NR-10',
        action: 'Use format NR-{N} for Needed Research documents',
      };
    }
    return null;
  }

  // All others should start with A.
  if (!docNo.startsWith('A.')) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Document number '${docNo}' must start with 'A.'`,
      example: 'A.1, A.1.1, A.1.1.1',
      action: 'Ensure document number starts with A.',
    };
  }

  // Core, Type Specification, Active Data Controller cannot have .0. in number (except A.0 at start)
  if (['Core', 'Type Specification', 'Active Data Controller'].includes(type)) {
    // Match .0. but not at position after A (A.0 is valid for Scope inheritance)
    if (docNo.match(/(?<!^A)\.0\./)) {
      return {
        line: doc.line,
        severity: 'error',
        message: `🔢 Document number '${docNo}' invalid for document type '${type}'`,
        reason: `${type} documents cannot contain '.0.' in their document numbers (except inherited A.0)`,
        example: 'A.1.1.1, A.1.1.2.1, A.1.1.2.1.1, A.0.1.1.1',
        action: "Remove the '.0' segment or change document type to appropriate supporting document",
      };
    }
  }

  // Supporting documents should have special patterns
  if (type === 'Annotation' && !docNo.match(/\.0\.3\.\d+$/)) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Invalid Annotation document number '${docNo}'`,
      expected: '{Target}.0.3.{N}',
      example: 'A.1.12.1.2.0.3.1',
      action: 'Use pattern {Target}.0.3.{N} for Annotations',
    };
  }

  if (type === 'Action Tenet' && !docNo.match(/\.0\.4\.\d+$/)) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Invalid Action Tenet document number '${docNo}'`,
      expected: '{Target}.0.4.{N}',
      example: 'A.1.4.5.0.4.1',
      action: 'Use pattern {Target}.0.4.{N} for Action Tenets',
    };
  }

  if (type === 'Scenario' && !docNo.match(/\.1\.\d+$/)) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Invalid Scenario document number '${docNo}'`,
      expected: '{Tenet}.1.{N}',
      example: 'A.1.4.5.0.4.1.1.1',
      action: 'Use pattern {Tenet}.1.{N} for Scenarios',
    };
  }

  if (type === 'Scenario Variation' && !docNo.match(/\.var\d+$/)) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Invalid Scenario Variation document number '${docNo}'`,
      expected: '{Scenario}.var{N}',
      example: 'A.1.4.5.0.4.1.1.1.var1',
      action: 'Use pattern {Scenario}.var{N} for Scenario Variations',
    };
  }

  if (type === 'Active Data' && !docNo.match(/\.0\.6\.\d+$/)) {
    return {
      line: doc.line,
      severity: 'error',
      message: `🔢 Invalid Active Data document number '${docNo}'`,
      expected: '{Controller}.0.6.{N}',
      example: 'A.1.1.3.1.0.6.1',
      action: 'Use pattern {Controller}.0.6.{N} for Active Data',
    };
  }

  return null;
}

function validateNesting(docs: Document[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 1; i < docs.length; i++) {
    const child = docs[i];

    // Find parent (nearest previous document with lower level)
    let parent: Document | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (docs[j].level < child.level) {
        parent = docs[j];
        break;
      }
    }

    if (!parent) continue;

    // Needed Research can nest anywhere
    if (child.type === 'Needed Research') continue;

    // Check if parent-child combination is allowed
    const allowedChildren = ALLOWED_NESTING[parent.type as AtlasDocumentType] || [];
    if (!allowedChildren.includes(child.type)) {
      issues.push({
        line: child.line,
        severity: 'error',
        message: `🌳 Invalid nesting: '${child.type}' cannot be nested under '${parent.type}'`,
        found: `Parent: ${parent.docNo} - ${parent.name} [${parent.type}] (line ${parent.line})\nChild:  ${child.docNo} - ${child.name} [${child.type}] (line ${child.line})`,
        expected: `${parent.type} can only contain: ${allowedChildren.join(', ') || 'no children'}`,
        action: `Move this document or change its type`,
      });
    }
  }

  return issues;
}

function validateUUIDs(docs: Document[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const uuidMap = new Map<string, Document>();

  for (const doc of docs) {
    const { uuid } = doc;

    // Check if empty
    if (!uuid || uuid.trim() === '') {
      issues.push({
        line: doc.line,
        severity: 'warning',
        message: '🆔 UUID is empty',
        action: 'Generate a new UUID for this document at https://www.uuidgenerator.net/',
      });
      continue;
    }

    // Check format
    if (!UUID_REGEX.test(uuid)) {
      issues.push({
        line: doc.line,
        severity: 'error',
        message: `🆔 UUID '${uuid}' is not a valid UUID format`,
        expected: '8 hex digits - 4 hex digits - 4 hex digits - 4 hex digits - 12 hex digits',
        example: '8650a584-01f8-45d6-882b-c14eab9879c4',
        action: 'Generate a new UUID at https://www.uuidgenerator.net/',
      });
      continue;
    }

    // Check uniqueness
    const existing = uuidMap.get(uuid);
    if (existing) {
      issues.push({
        line: doc.line,
        severity: 'error',
        message: `🆔 Duplicate UUID found: ${uuid}`,
        found: `First occurrence: line ${existing.line} (${existing.docNo} - ${existing.name} [${existing.type}])\nDuplicate at: line ${doc.line} (${doc.docNo} - ${doc.name} [${doc.type}])`,
        action: `Generate a new unique UUID for line ${doc.line}`,
      });
    } else {
      uuidMap.set(uuid, doc);
    }
  }

  return issues;
}

// ============================================================================
// Main Validator
// ============================================================================

function validate(content: string): ValidationIssue[] {
  const lines = content.split(/\r?\n/);
  const issues: ValidationIssue[] = [];
  const docs: Document[] = [];

  // Parse all documents
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only process lines that look like Atlas document titles (contain [...] and UUID comment)
    if (!line.match(/^#+\s/) || !line.includes('[') || !line.includes('UUID')) continue;

    const result = parseTitleLine(line, i + 1);
    if (result.issue) {
      issues.push(result.issue);
    }
    if (result.doc) {
      docs.push(result.doc);
    }
  }

  // Run validations
  issues.push(...validateHierarchy(docs));
  issues.push(...validateBlankLines(lines, docs));
  issues.push(...validateExtraFields(lines, docs));

  for (const doc of docs) {
    const issue = validateDocumentNumber(doc);
    if (issue) issues.push(issue);
  }

  issues.push(...validateNesting(docs));
  issues.push(...validateUUIDs(docs));

  // Sort by line number
  return issues.sort((a, b) => a.line - b.line);
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatIssue(issue: ValidationIssue): string {
  const lines: string[] = [];
  const isError = issue.severity === 'error';
  const icon = isError ? '❌' : '⚠️';
  const prefix = isError ? 'ERROR' : 'WARNING';

  lines.push(`─────────────────────────────────────────`);
  lines.push(`${icon} ${prefix} at line ${issue.line}`);
  lines.push(`─────────────────────────────────────────`);
  lines.push(`  ${issue.message}`);

  if (issue.found) {
    lines.push('');
    lines.push('  🔍 Found:');
    issue.found.split('\n').forEach((l) => lines.push(`    ${l}`));
  }

  if (issue.expected) {
    lines.push('');
    lines.push('  ✨ Expected:');
    issue.expected.split('\n').forEach((l) => lines.push(`    ${l}`));
  }

  if (issue.reason) {
    lines.push('');
    lines.push(`  💡 Reason:`);
    lines.push(`    ${issue.reason}`);
  }

  if (issue.example) {
    lines.push('');
    lines.push(`  📋 Example:`);
    lines.push(`    ${issue.example}`);
  }

  lines.push('');
  lines.push(`  🔧 Action: ${issue.action}`);

  return lines.join('\n');
}

function printResults(issues: ValidationIssue[]): void {
  if (issues.length === 0) {
    console.log('');
    console.log('═════════════════════════════════════════');
    console.log('  ✅ Validation passed - no issues found');
    console.log('═════════════════════════════════════════');
    return;
  }

  console.log('');

  // Print each issue
  issues.forEach((issue, index) => {
    console.log(formatIssue(issue));
    if (index < issues.length - 1) {
      console.log('');
      console.log('');
    }
  });

  // Summary
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  console.log('');
  console.log('═════════════════════════════════════════');
  console.log('  📊 VALIDATION SUMMARY');
  console.log('═════════════════════════════════════════');
  console.log(`  ❌ Errors:   ${errors}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log('─────────────────────────────────────────');
  if (errors > 0) {
    console.log('  Status: ❌ FAILED');
  } else {
    console.log('  Status: ✅ PASSED (warnings only)');
  }
  console.log('═════════════════════════════════════════');
}

// ============================================================================
// CLI
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/validate-atlas-markdown.ts <path-to-atlas.md>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = validate(content);

  printResults(issues);

  const hasErrors = issues.some((i) => i.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
export { validate };
export type { ValidationIssue, Document };
