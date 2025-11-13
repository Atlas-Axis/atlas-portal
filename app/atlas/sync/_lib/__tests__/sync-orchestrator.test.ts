// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { BaseAtlasDocument } from '@/app/server/atlas/export/types';
import { sortAdditionsByHierarchy } from '../sync-orchestrator';

describe('sync-orchestrator', () => {
  describe('sortAdditionsByHierarchy', () => {
    it('sorts additions by database hierarchy level', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
        {
          uuid: 'article-1',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.1',
            name: 'Article',
            uuid: 'article-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['scope-1'],
        },
        {
          uuid: 'scope-1',
          changeType: 'added',
          newValues: {
            type: 'Scope',
            doc_no: 'A',
            name: 'Scope',
            uuid: 'scope-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
      ];

      const docMap = new Map<string, BaseAtlasDocument>([
        ['scope-1', changes[2].newValues!],
        ['article-1', changes[1].newValues!],
        ['section-1', changes[0].newValues!],
      ]);

      const sorted = sortAdditionsByHierarchy(changes, docMap);

      // Should be sorted: Scope (level 0), Article (level 1), Section (level 2)
      expect(sorted[0].uuid).toBe('scope-1');
      expect(sorted[1].uuid).toBe('article-1');
      expect(sorted[2].uuid).toBe('section-1');
    });

    it('sorts additions by depth within same database', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'nested-core',
          changeType: 'added',
          newValues: {
            type: 'Core',
            doc_no: 'A.1.1.1.1',
            name: 'Nested Core',
            uuid: 'nested-core',
            content: '',
            last_modified: '',
          },
          newAncestry: ['parent-core', 'section-1'],
        },
        {
          uuid: 'parent-core',
          changeType: 'added',
          newValues: {
            type: 'Core',
            doc_no: 'A.1.1.1',
            name: 'Parent Core',
            uuid: 'parent-core',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
      ];

      const docMap = new Map<string, BaseAtlasDocument>([
        ['section-1', changes[2].newValues!],
        ['nested-core', changes[0].newValues!],
        ['parent-core', changes[1].newValues!],
      ]);

      const sorted = sortAdditionsByHierarchy(changes, docMap);

      // Should be sorted by depth: Section (depth 0), Parent Core (depth 1), Nested Core (depth 2)
      expect(sorted[0].uuid).toBe('section-1');
      expect(sorted[1].uuid).toBe('parent-core');
      expect(sorted[2].uuid).toBe('nested-core');
    });

    it('maintains original order for same database and same depth', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'section-3',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.3',
            name: 'Section 3',
            uuid: 'section-3',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.1',
            name: 'Section 1',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
        {
          uuid: 'section-2',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.2',
            name: 'Section 2',
            uuid: 'section-2',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
      ];

      const docMap = new Map<string, BaseAtlasDocument>([
        [
          'article-1',
          {
            type: 'Article',
            doc_no: 'A.1',
            name: 'Article',
            uuid: 'article-1',
            content: '',
            last_modified: '',
          },
        ],
        ['section-3', changes[0].newValues!],
        ['section-1', changes[1].newValues!],
        ['section-2', changes[2].newValues!],
      ]);

      const sorted = sortAdditionsByHierarchy(changes, docMap);

      // Should maintain original order: section-3, section-1, section-2
      expect(sorted[0].uuid).toBe('section-3');
      expect(sorted[1].uuid).toBe('section-1');
      expect(sorted[2].uuid).toBe('section-2');
    });

    it('handles complex multi-database multi-depth sorting', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'annotation-1',
          changeType: 'added',
          newValues: {
            type: 'Annotation',
            doc_no: 'A.1.1.0.3.1',
            name: 'Annotation',
            uuid: 'annotation-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1', 'article-1'],
        },
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
        {
          uuid: 'scenario-1',
          changeType: 'added',
          newValues: {
            type: 'Scenario',
            doc_no: 'A.1.1.0.4.1.1',
            name: 'Scenario',
            uuid: 'scenario-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['tenet-1', 'section-1', 'article-1'],
        },
        {
          uuid: 'article-1',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.1',
            name: 'Article',
            uuid: 'article-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        {
          uuid: 'tenet-1',
          changeType: 'added',
          newValues: {
            type: 'Action Tenet',
            doc_no: 'A.1.1.0.4.1',
            name: 'Tenet',
            uuid: 'tenet-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1', 'article-1'],
        },
      ];

      const docMap = new Map<string, BaseAtlasDocument>([
        ['article-1', changes[3].newValues!],
        ['section-1', changes[1].newValues!],
        ['annotation-1', changes[0].newValues!],
        ['tenet-1', changes[4].newValues!],
        ['scenario-1', changes[2].newValues!],
      ]);

      const sorted = sortAdditionsByHierarchy(changes, docMap);

      // Expected order by hierarchy and depth:
      // 1. Article (level 1, depth 0)
      // 2. Section (level 2, depth 1)
      // 3. Annotation (level 3, depth 2)
      // 4. Tenet (level 3, depth 2) - after Annotation by original order
      // 5. Scenario (level 4, depth 3)
      expect(sorted[0].uuid).toBe('article-1');
      expect(sorted[1].uuid).toBe('section-1');
      expect(sorted[2].uuid).toBe('annotation-1');
      expect(sorted[3].uuid).toBe('tenet-1');
      expect(sorted[4].uuid).toBe('scenario-1');
    });

    it('handles Needed Research with correct parent-based hierarchy level', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'nr-on-annotation',
          changeType: 'added',
          newValues: {
            type: 'Needed Research',
            doc_no: 'NR-2',
            name: 'Research on Annotation',
            uuid: 'nr-on-annotation',
            content: '',
            last_modified: '',
          },
          newAncestry: ['annotation-1', 'section-1'],
        },
        {
          uuid: 'annotation-1',
          changeType: 'added',
          newValues: {
            type: 'Annotation',
            doc_no: 'A.1.1.0.3.1',
            name: 'Annotation',
            uuid: 'annotation-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'nr-on-section',
          changeType: 'added',
          newValues: {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research on Section',
            uuid: 'nr-on-section',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
      ];

      const docMap = new Map<string, BaseAtlasDocument>([
        ['section-1', changes[3].newValues!],
        ['annotation-1', changes[1].newValues!],
        ['nr-on-section', changes[2].newValues!],
        ['nr-on-annotation', changes[0].newValues!],
      ]);

      const sorted = sortAdditionsByHierarchy(changes, docMap);

      // Expected order:
      // 1. Section (level 2, depth 0)
      // 2. Annotation (level 3, depth 1)
      // 3. NR on Section (level 3, depth 1) - parent is Section (level 2), so NR is level 3
      // 4. NR on Annotation (level 4, depth 2) - parent is Annotation (level 3), so NR is level 4
      expect(sorted[0].uuid).toBe('section-1');
      expect(sorted[1].uuid).toBe('annotation-1');
      expect(sorted[2].uuid).toBe('nr-on-section');
      expect(sorted[3].uuid).toBe('nr-on-annotation');
    });
  });
});
