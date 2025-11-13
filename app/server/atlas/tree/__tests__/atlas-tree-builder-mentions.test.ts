import { describe, expect, it } from 'vitest';
import { NotionRichText } from '@/app/server/markdown/notion-types';
import { UuidMappings } from '../../load-uuid-mapping';
import { updateMentionInRichTextArray } from '../atlas-tree-builder';

/**
 * Tests for Rich Text mention updates in Atlas tree builder.
 *
 * These tests verify that the updateMentionInRichTextArray function correctly:
 * - Updates mention plain_text with correct document numbers and names
 * - Handles missing UUID mappings
 * - Handles missing document numbers
 * - Handles missing document names (uses number only)
 * - Skips non-page mentions (user, database, date)
 * - Handles malformed mention structures
 */

// Helper to create mock UUID mappings
function createMockUuidMappings(): UuidMappings {
  return {
    notionPageIDsToAtlasUUIDs: new Map([
      ['notion-page-1', 'atlas-uuid-1'],
      ['notion-page-2', 'atlas-uuid-2'],
      ['notion-page-3', 'atlas-uuid-3'],
      ['notion-page-4', 'atlas-uuid-4'], // Has number but no name
    ]),
    atlasUUIDsToNotionPageIds: new Map([
      ['atlas-uuid-1', 'notion-page-1'],
      ['atlas-uuid-2', 'notion-page-2'],
      ['atlas-uuid-3', 'notion-page-3'],
      ['atlas-uuid-4', 'notion-page-4'],
    ]),
  };
}

// Helper to create mock document number map
function createMockDocNumberMap(): Map<string, string> {
  return new Map([
    ['atlas-uuid-1', 'A.1.2.3'],
    ['atlas-uuid-2', 'A.2.4.5'],
    ['atlas-uuid-4', 'A.3.1.1'], // Has number but no name
    // atlas-uuid-3 intentionally missing to test [Unknown] case
  ]);
}

// Helper to create mock document name map
function createMockDocNameMap(): Map<string, string> {
  return new Map([
    ['atlas-uuid-1', 'General Provisions'],
    ['atlas-uuid-2', 'Facilitators Broad Discretionary Capacity'],
    // atlas-uuid-3 intentionally missing to test [Unknown] case
    // atlas-uuid-4 intentionally missing to test number-only case
  ]);
}

describe('Rich Text Mention Updates', () => {
  describe('updateMentionInRichTextArray', () => {
    it('should update mention plain_text with correct document number and name', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'text',
          plain_text: 'See document ',
          text: { content: 'See document ' },
        },
        {
          type: 'mention',
          plain_text: 'OLD-NUMBER',
          mention: {
            type: 'page',
            page: {
              id: 'notion-page-1',
            },
          },
        },
        {
          type: 'text',
          plain_text: ' for details.',
          text: { content: ' for details.' },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 1 mention
      expect(updatedCount).toBe(1);
      // Mention plain_text should be updated with number and name
      expect(richTextArray[1].plain_text).toBe('A.1.2.3 - General Provisions');
      // Text objects should remain unchanged
      expect(richTextArray[0].plain_text).toBe('See document ');
      expect(richTextArray[2].plain_text).toBe(' for details.');
    });

    it('should replace mention with [Unknown] when UUID mapping not found', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: 'A.2.4',
          mention: {
            type: 'page',
            page: {
              id: 'unknown-notion-page',
            },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 1 mention
      expect(updatedCount).toBe(1);
      // Should be replaced with [Unknown]
      expect(richTextArray[0].plain_text).toBe('[Unknown]');
    });

    it('should replace mention with [Unknown] when document number not found', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: 'A.2.4',
          mention: {
            type: 'page',
            page: {
              id: 'notion-page-3', // Has UUID mapping but no document number
            },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 1 mention
      expect(updatedCount).toBe(1);
      // Should be replaced with [Unknown]
      expect(richTextArray[0].plain_text).toBe('[Unknown]');
    });

    it('should update multiple mentions correctly', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'text',
          plain_text: 'Text before ',
          text: { content: 'Text before ' },
        },
        {
          type: 'mention',
          plain_text: 'OLD-1',
          mention: {
            type: 'page',
            page: { id: 'notion-page-1' },
          },
        },
        {
          type: 'text',
          plain_text: ' and ',
          text: { content: ' and ' },
        },
        {
          type: 'mention',
          plain_text: 'OLD-2',
          mention: {
            type: 'page',
            page: { id: 'notion-page-2' },
          },
        },
        {
          type: 'text',
          plain_text: ' text after.',
          text: { content: ' text after.' },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 2 mentions
      expect(updatedCount).toBe(2);
      // First mention updated with number and name
      expect(richTextArray[1].plain_text).toBe('A.1.2.3 - General Provisions');
      // Second mention updated with number and name
      expect(richTextArray[3].plain_text).toBe('A.2.4.5 - Facilitators Broad Discretionary Capacity');
      // Text objects unchanged
      expect(richTextArray[0].plain_text).toBe('Text before ');
      expect(richTextArray[2].plain_text).toBe(' and ');
      expect(richTextArray[4].plain_text).toBe(' text after.');
    });

    it('should use document number only when name is not available', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: 'OLD-NUMBER',
          mention: {
            type: 'page',
            page: {
              id: 'notion-page-4', // Has number but no name
            },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 1 mention
      expect(updatedCount).toBe(1);
      // Should use document number only since name is not available
      expect(richTextArray[0].plain_text).toBe('A.3.1.1');
    });

    it('should handle empty array', () => {
      const richTextArray: NotionRichText[] = [];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      expect(updatedCount).toBe(0);
      expect(richTextArray).toHaveLength(0);
    });

    it('should not modify non-mention objects', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'text',
          plain_text: 'Plain text',
          text: { content: 'Plain text' },
        },
        {
          type: 'equation',
          plain_text: 'E=mc^2',
          equation: { expression: 'E=mc^2' },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should not update anything
      expect(updatedCount).toBe(0);
      // Text and equation objects should remain unchanged
      expect(richTextArray[0].plain_text).toBe('Plain text');
      expect(richTextArray[1].plain_text).toBe('E=mc^2');
    });

    it('should skip user mentions', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: '@John Doe',
          mention: {
            type: 'user',
            user: { id: 'user-123' },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should not update user mentions
      expect(updatedCount).toBe(0);
      // User mention should remain unchanged
      expect(richTextArray[0].plain_text).toBe('@John Doe');
    });

    it('should skip database mentions', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: 'My Database',
          mention: {
            type: 'database',
            database: { id: 'db-123' },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should not update database mentions
      expect(updatedCount).toBe(0);
      // Database mention should remain unchanged
      expect(richTextArray[0].plain_text).toBe('My Database');
    });

    it('should skip date mentions', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: '2025-01-15',
          mention: {
            type: 'date',
            date: { start: '2025-01-15' },
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should not update date mentions
      expect(updatedCount).toBe(0);
      // Date mention should remain unchanged
      expect(richTextArray[0].plain_text).toBe('2025-01-15');
    });

    it('should handle mention without mention property', () => {
      const richTextArray: NotionRichText[] = [
        {
          type: 'mention',
          plain_text: 'Invalid',
          // mention property is undefined
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should not crash, should skip this mention
      expect(updatedCount).toBe(0);
      expect(richTextArray[0].plain_text).toBe('Invalid');
    });

    it('should handle real-world Notion API example', () => {
      const richTextArray: NotionRichText[] = [
        {
          href: null,
          text: {
            link: null,
            content: 'The documents herein implement the Sky Primitives for ',
          },
          type: 'text',
          plain_text: 'The documents herein implement the Sky Primitives for ',
          annotations: {
            bold: false,
            code: false,
            color: 'default',
            italic: false,
            underline: false,
            strikethrough: false,
          },
        },
        {
          href: null,
          text: {
            link: null,
            content: 'Keel',
          },
          type: 'text',
          plain_text: 'Keel',
          annotations: {
            bold: false,
            code: false,
            color: 'default',
            italic: false,
            underline: false,
            strikethrough: false,
          },
        },
        {
          href: null,
          text: {
            link: null,
            content: '. See ',
          },
          type: 'text',
          plain_text: '. See ',
          annotations: {
            bold: false,
            code: false,
            color: 'default',
            italic: false,
            underline: false,
            strikethrough: false,
          },
        },
        {
          href: 'https://www.notion.so/1b2f2ff08d738095bb8fed052141f936',
          type: 'mention',
          mention: {
            page: {
              id: 'notion-page-1', // Using our mock ID
            },
            type: 'page',
          },
          plain_text: 'A.2.4', // Outdated document number
          annotations: {
            bold: false,
            code: false,
            color: 'default',
            italic: false,
            underline: false,
            strikethrough: false,
          },
        },
        {
          href: null,
          text: {
            link: null,
            content: '.',
          },
          type: 'text',
          plain_text: '.',
          annotations: {
            bold: false,
            code: false,
            color: 'default',
            italic: false,
            underline: false,
            strikethrough: false,
          },
        },
      ];

      const uuidMappings = createMockUuidMappings();
      const docNumberMap = createMockDocNumberMap();
      const docNameMap = createMockDocNameMap();

      const updatedCount = updateMentionInRichTextArray(richTextArray, docNumberMap, docNameMap, uuidMappings);

      // Should update 1 mention
      expect(updatedCount).toBe(1);
      // Verify structure is preserved
      expect(richTextArray).toHaveLength(5);
      expect(richTextArray[3].type).toBe('mention');
      // Document number and name should be updated from A.2.4 to A.1.2.3 - General Provisions
      expect(richTextArray[3].plain_text).toBe('A.1.2.3 - General Provisions');
      // Other fields unchanged
      expect(richTextArray[0].plain_text).toBe('The documents herein implement the Sky Primitives for ');
      expect(richTextArray[4].plain_text).toBe('.');
    });
  });
});
