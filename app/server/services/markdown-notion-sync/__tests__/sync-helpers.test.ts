/**
 * Unit tests for sync-helpers.ts
 */
import { describe, expect, it } from 'vitest';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { getDocumentLabel, sortAdditionsByDepthFirst } from '../sync-helpers';

describe('sync-helpers', () => {
  describe('getDocumentLabel', () => {
    it('returns formatted label with doc_no, name, and type', () => {
      const change: AtlasDocumentChange = {
        changeType: 'changed',
        uuid: 'test-uuid',
        newValues: {
          uuid: 'test-uuid',
          doc_no: 'A.1.2',
          name: 'Test Document',
          type: 'Section',
          last_modified: '2024-01-01T00:00:00Z',
          content: '',
        },
        oldValues: undefined,
        newAncestry: [],
        oldAncestry: [],
      };

      expect(getDocumentLabel(change)).toBe('A.1.2 - Test Document [Section]');
    });

    it('uses oldValues when newValues is null', () => {
      const change: AtlasDocumentChange = {
        changeType: 'deleted',
        uuid: 'test-uuid',
        newValues: undefined,
        oldValues: {
          uuid: 'test-uuid',
          doc_no: 'A.1.3',
          name: 'Deleted Document',
          type: 'Core',
          last_modified: '2024-01-01T00:00:00Z',
          content: '',
        },
        newAncestry: [],
        oldAncestry: ['parent-uuid'],
      };

      expect(getDocumentLabel(change)).toBe('A.1.3 - Deleted Document [Core]');
    });

    it('returns "Unknown document" when both values are null', () => {
      const change: AtlasDocumentChange = {
        changeType: 'changed',
        uuid: 'test-uuid',
        newValues: undefined,
        oldValues: undefined,
        newAncestry: [],
        oldAncestry: [],
      };

      expect(getDocumentLabel(change)).toBe('Unknown document');
    });
  });

  describe('sortAdditionsByDepthFirst', () => {
    it('returns empty array for empty input', () => {
      expect(sortAdditionsByDepthFirst([])).toEqual([]);
    });

    it('sorts single-level documents by doc_no', () => {
      const changes: AtlasDocumentChange[] = [
        {
          changeType: 'added',
          uuid: 'uuid-3',
          newValues: {
            uuid: 'uuid-3',
            doc_no: 'A.1.3',
            name: 'Third',
            type: 'Section',
            last_modified: '2024-01-01T00:00:00Z',
            content: '',
          },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'uuid-1',
          newValues: {
            uuid: 'uuid-1',
            doc_no: 'A.1.1',
            name: 'First',
            type: 'Section',
            last_modified: '2024-01-01T00:00:00Z',
            content: '',
          },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'uuid-2',
          newValues: {
            uuid: 'uuid-2',
            doc_no: 'A.1.2',
            name: 'Second',
            type: 'Section',
            last_modified: '2024-01-01T00:00:00Z',
            content: '',
          },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);
      expect(sorted.map((c) => c.newValues?.doc_no)).toEqual(['A.1.1', 'A.1.2', 'A.1.3']);
    });

    it('sorts parent before children (depth-first)', () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const changes: AtlasDocumentChange[] = [
        {
          changeType: 'added',
          uuid: 'child-2',
          newValues: { uuid: 'child-2', doc_no: 'A.1.2.2', name: 'Child 2', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['parent'],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'parent',
          newValues: { uuid: 'parent', doc_no: 'A.1.2', name: 'Parent', type: 'Section', ...baseDoc },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'child-1',
          newValues: { uuid: 'child-1', doc_no: 'A.1.2.1', name: 'Child 1', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['parent'],
          oldAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);
      expect(sorted.map((c) => c.uuid)).toEqual(['parent', 'child-1', 'child-2']);
    });

    it('handles multi-level nesting', () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const changes: AtlasDocumentChange[] = [
        {
          changeType: 'added',
          uuid: 'grandchild',
          newValues: { uuid: 'grandchild', doc_no: 'A.1.2.1.1', name: 'Grandchild', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['parent', 'child'],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'child',
          newValues: { uuid: 'child', doc_no: 'A.1.2.1', name: 'Child', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['parent'],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'parent',
          newValues: { uuid: 'parent', doc_no: 'A.1.2', name: 'Parent', type: 'Section', ...baseDoc },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);
      expect(sorted.map((c) => c.uuid)).toEqual(['parent', 'child', 'grandchild']);
    });

    it('ignores parent references outside the additions array', () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const changes: AtlasDocumentChange[] = [
        {
          changeType: 'added',
          uuid: 'child-1',
          newValues: { uuid: 'child-1', doc_no: 'A.1.2.1', name: 'Child 1', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['external-parent'], // Parent not in additions
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'child-2',
          newValues: { uuid: 'child-2', doc_no: 'A.1.2.2', name: 'Child 2', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['external-parent'], // Parent not in additions
          oldAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);
      // Both should be treated as top-level and sorted by doc_no
      expect(sorted.map((c) => c.uuid)).toEqual(['child-1', 'child-2']);
    });

    it('handles mixed parent-child and standalone documents', () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const changes: AtlasDocumentChange[] = [
        {
          changeType: 'added',
          uuid: 'standalone-2',
          newValues: { uuid: 'standalone-2', doc_no: 'A.1.4', name: 'Standalone 2', type: 'Section', ...baseDoc },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'child',
          newValues: { uuid: 'child', doc_no: 'A.1.2.1', name: 'Child', type: 'Core', ...baseDoc },
          oldValues: undefined,
          newAncestry: ['parent'],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'standalone-1',
          newValues: { uuid: 'standalone-1', doc_no: 'A.1.1', name: 'Standalone 1', type: 'Section', ...baseDoc },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
        {
          changeType: 'added',
          uuid: 'parent',
          newValues: { uuid: 'parent', doc_no: 'A.1.2', name: 'Parent', type: 'Section', ...baseDoc },
          oldValues: undefined,
          newAncestry: [],
          oldAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);
      // Top-level sorted by doc_no, with children immediately after their parents
      expect(sorted.map((c) => c.uuid)).toEqual(['standalone-1', 'parent', 'child', 'standalone-2']);
    });
  });
});
