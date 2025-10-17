import { describe, expect, it } from 'vitest';
import { ValidationIssue, validate } from '../validate-atlas-markdown';

// Helper to check if issue exists
function hasError(issues: ValidationIssue[], messageSubstring: string): boolean {
  return issues.some((i) => i.severity === 'error' && i.message.includes(messageSubstring));
}

function hasWarning(issues: ValidationIssue[], messageSubstring: string): boolean {
  return issues.some((i) => i.severity === 'warning' && i.message.includes(messageSubstring));
}

describe('Atlas Markdown Validator', () => {
  describe('Title Line Validation', () => {
    it('accepts valid title formats', () => {
      const md = `# A.1 - Test Scope [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

Content here.`;
      const issues = validate(md);
      expect(issues).toHaveLength(0);
    });

    it('detects missing spaces before UUID', () => {
      const md = `# A.1 - Test [Scope] <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->`;
      const issues = validate(md);
      expect(hasError(issues, 'Invalid title format')).toBe(true);
    });

    it('detects invalid document types', () => {
      const md = `# A.1 - Test [InvalidType]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->`;
      const issues = validate(md);
      expect(hasError(issues, "Invalid document type 'InvalidType'")).toBe(true);
    });

    it('detects malformed title lines', () => {
      const md = `# A.1 Test [Scope]  <!-- UUID: abc -->`;
      const issues = validate(md);
      expect(hasError(issues, 'Invalid title format')).toBe(true);
    });
  });

  describe('Heading Hierarchy Validation', () => {
    it('accepts valid progression', () => {
      const md = `# A.1 - Scope [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

## A.1.1 - Article [Article]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.

### A.1.1.1 - Section [Section]  <!-- UUID: 33333333-3333-3333-3333-333333333333 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'hierarchy')).toBe(false);
    });

    it('detects skipped levels', () => {
      const md = `## A.1.1 - Article [Article]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

#### A.1.1.1.1 - Core [Core]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'skipped from level 2 to level 4')).toBe(true);
    });

    it('accepts valid nesting and unnesting', () => {
      const md = `### A.1.1.1 - Section [Section]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

#### A.1.1.1.1 - Core [Core]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.

##### A.1.1.1.1.1 - Nested Core [Core]  <!-- UUID: 33333333-3333-3333-3333-333333333333 -->

Content.

#### A.1.1.1.2 - Core [Core]  <!-- UUID: 44444444-4444-4444-4444-444444444444 -->

Content.

##### A.1.1.1.2.1 - Nested Core [Core]  <!-- UUID: 55555555-5555-5555-5555-555555555555 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'hierarchy')).toBe(false);
    });
  });

  describe('Blank Line Validation', () => {
    it('detects missing blank after title', () => {
      const md = `# A.1 - Test [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->
Content here.`;
      const issues = validate(md);
      expect(hasError(issues, 'Missing blank line after title')).toBe(true);
    });

    it('accepts blank line after title', () => {
      const md = `# A.1 - Test [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content here.`;
      const issues = validate(md);
      expect(hasError(issues, 'Missing blank line')).toBe(false);
    });
  });

  describe('Extra Fields Validation', () => {
    it('accepts valid Type Specification with all fields', () => {
      const md = `#### A.1.2.2.2.1 - The Type Specification Type [Type Specification]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Main content here.

**Components**:

Component value

**Doc Identifier Rules**:

Rules value

**Additional Logic**:

Logic value

**Type Category**:

Category value

**Type Name**:

Name value

**Type Overview**:

Overview value`;
      const issues = validate(md);
      expect(hasError(issues, 'extra field')).toBe(false);
      expect(hasError(issues, 'Missing required')).toBe(false);
    });

    it('detects missing required fields', () => {
      const md = `#### A.1.2.2.2.1 - Test [Type Specification]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Main content.

**Components**:

Value`;
      const issues = validate(md);
      expect(hasError(issues, 'Missing required extra field')).toBe(true);
    });

    it('detects wrong field order', () => {
      const md = `#### A.1.2.2.2.1 - Test [Type Specification]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

**Type Name**:

Name

**Components**:

Comp

**Doc Identifier Rules**:

Rules

**Additional Logic**:

Logic

**Type Category**:

Cat

**Type Overview**:

Overview`;
      const issues = validate(md);
      expect(hasError(issues, 'wrong order')).toBe(true);
    });

    it('detects missing blank line after label', () => {
      const md = `#### A.1.2.2.2.1 - Test [Type Specification]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

**Components**:
Value here

**Doc Identifier Rules**:

Rules

**Additional Logic**:

Logic

**Type Category**:

Cat

**Type Name**:

Name

**Type Overview**:

Overview`;
      const issues = validate(md);
      expect(hasError(issues, 'missing blank line after label')).toBe(true);
    });

    it('accepts valid Scenario fields', () => {
      const md = `###### A.1.2.1.4.0.4.1.1.1 - Test Scenario [Scenario]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

**Description**:

Desc value

**Finding**:

Finding value

**Additional Guidance**:

Guidance value`;
      const issues = validate(md);
      expect(hasError(issues, 'extra field')).toBe(false);
    });

    it('accepts valid Scenario Variation fields', () => {
      const md = `####### A.1.2.1.4.0.4.1.1.1.var1 - Test Variation [Scenario Variation]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

**Description**:

Desc value

**Finding**:

Finding value

**Additional Guidance**:

Guidance value`;
      const issues = validate(md);
      expect(hasError(issues, 'extra field')).toBe(false);
    });

    it('accepts valid Needed Research field', () => {
      const md = `##### NR-15 - Research Item [Needed Research]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

**Content**:

Research content here`;
      const issues = validate(md);
      expect(hasError(issues, 'extra field')).toBe(false);
    });
  });

  describe('Document Numbering Validation', () => {
    it('accepts valid Scope numbers', () => {
      const md = `# A.0 - Test [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Article numbers', () => {
      const md = `## A.1.2 - Test [Article]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Section numbers', () => {
      const md = `### A.1.1.1 - Test [Section]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Core numbers', () => {
      const md = `#### A.1.1.1.1 - Test [Core]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('detects Core with .0 in number', () => {
      const md = `#### A.1.1.0.4 - Test [Core]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'invalid for document type')).toBe(true);
      expect(hasError(issues, 'Core')).toBe(true);
    });

    it('accepts valid Annotation numbers', () => {
      const md = `##### A.1.12.1.2.0.3.1 - Test [Annotation]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('detects invalid Annotation pattern', () => {
      const md = `##### A.1.1.1 - Test [Annotation]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'Invalid Annotation document number')).toBe(true);
    });

    it('accepts valid Action Tenet numbers', () => {
      const md = `##### A.1.4.5.0.4.1 - Test [Action Tenet]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Scenario numbers', () => {
      const md = `###### A.1.4.5.0.4.1.1.1 - Test [Scenario]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Scenario Variation numbers', () => {
      const md = `####### A.1.4.5.0.4.1.1.1.var1 - Test [Scenario Variation]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('detects invalid Scenario Variation pattern', () => {
      const md = `####### A.1.4.5.0.4.1.1.1 - Test [Scenario Variation]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'Invalid Scenario Variation')).toBe(true);
    });

    it('accepts valid Active Data numbers', () => {
      const md = `##### A.1.1.3.1.0.6.1 - Test [Active Data]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('accepts valid Needed Research numbers', () => {
      const md = `##### NR-15 - Test [Needed Research]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'document number')).toBe(false);
    });

    it('detects invalid Needed Research pattern', () => {
      const md = `##### NR-ABC - Test [Needed Research]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'Invalid Needed Research')).toBe(true);
    });
  });

  describe('Nesting Rules Validation', () => {
    it('accepts valid Scope → Article nesting', () => {
      const md = `# A.1 - Scope [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

## A.1.1 - Article [Article]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });

    it('accepts valid Article → Section nesting', () => {
      const md = `## A.1.1 - Article [Article]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

### A.1.1.1 - Section [Section]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });

    it('accepts valid Section → Core nesting', () => {
      const md = `### A.1.1.1 - Section [Section]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

#### A.1.1.1.1 - Core [Core]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });

    it('accepts valid Core → Core nesting', () => {
      const md = `#### A.1.1.1.1 - Core [Core]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

##### A.1.1.1.1.1 - Nested Core [Core]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });

    it('accepts Needed Research under any document', () => {
      const md = `#### A.1.1.1.1 - Core [Core]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

##### NR-1 - Research [Needed Research]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });

    it('accepts valid Action Tenet → Scenario → Scenario Variation chain', () => {
      const md = `##### A.1.2.1.4.0.4.1 - Tenet [Action Tenet]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

###### A.1.2.1.4.0.4.1.1.1 - Scenario [Scenario]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.

####### A.1.2.1.4.0.4.1.1.1.var1 - Variation [Scenario Variation]  <!-- UUID: 33333333-3333-3333-3333-333333333333 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'nesting')).toBe(false);
    });
  });

  describe('UUID Validation', () => {
    it('accepts valid UUID format', () => {
      const md = `# A.1 - Test [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'UUID')).toBe(false);
    });

    it('detects invalid UUID format', () => {
      const md = `# A.1 - Test [Scope]  <!-- UUID: abc-123-def -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'not a valid UUID format')).toBe(true);
    });

    it('detects duplicate UUIDs', () => {
      const md = `# A.1 - Test1 [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

Content.

## A.1.1 - Test2 [Article]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

Content.`;
      const issues = validate(md);
      expect(hasError(issues, 'Duplicate UUID')).toBe(true);
    });

    it('warns about empty UUIDs', () => {
      const md = `# A.1 - Test [Scope]  <!-- UUID:  -->

Content.`;
      const issues = validate(md);
      expect(hasWarning(issues, 'UUID is empty')).toBe(true);
    });
  });

  describe('Complete Document Validation', () => {
    it('accepts a complete valid Atlas snippet', () => {
      const md = `# A.0 - Atlas Preamble [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

The Atlas is a comprehensive framework.

## A.0.1 - Foundational Concepts [Article]  <!-- UUID: 56b15d7d-cdd4-4594-bd95-4f094564ac04 -->

This article defines foundational concepts.

### A.0.1.1 - Definitions [Section]  <!-- UUID: c7d62f28-1d64-4632-8cd8-4f2b44c51bba -->

This section contains essential definitions.

#### A.0.1.1.1 - Universal Alignment [Core]  <!-- UUID: 9f953b73-566e-4428-a9d2-e179513c3371 -->

Universal Alignment refers to an actor's holistic understanding.`;
      const issues = validate(md);
      expect(issues).toHaveLength(0);
    });

    it('detects multiple errors in invalid document', () => {
      const md = `# A.1 - Test [InvalidType]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->
Content without blank line.
## A.1.1 - Article [Article]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Content.

#### A.1.1.1.1 - Skipped [Core]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Content.`;

      const issues = validate(md);

      // Should have multiple errors
      expect(hasError(issues, 'Invalid document type')).toBe(true);
      expect(hasError(issues, 'Duplicate UUID')).toBe(true);
      expect(hasError(issues, 'Missing blank line')).toBe(true);
      expect(hasError(issues, 'skipped')).toBe(true);
    });
  });
});
