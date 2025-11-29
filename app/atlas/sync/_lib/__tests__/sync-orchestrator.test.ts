// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { sortAdditionsByDepthFirst } from '../sync-orchestrator';

describe('sync-orchestrator', () => {
  describe('sortAdditionsByDepthFirst', () => {
    it('returns empty array for empty input', () => {
      const sorted = sortAdditionsByDepthFirst([]);
      expect(sorted).toEqual([]);
    });

    it('sorts parent before children in depth-first order', () => {
      // Input order: child, grandchild, parent (wrong order)
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
          newAncestry: ['article-1', 'scope-1'],
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
            doc_no: 'A.0',
            name: 'Scope',
            uuid: 'scope-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Should be depth-first: Scope -> Article -> Section
      expect(sorted.map((c) => c.uuid)).toEqual(['scope-1', 'article-1', 'section-1']);
    });

    it('processes entire subtree before moving to next sibling (depth-first)', () => {
      // This is the key test: depth-first means we process A.0's entire subtree
      // before moving to A.1
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'scope-a1',
          changeType: 'added',
          newValues: {
            type: 'Scope',
            doc_no: 'A.1',
            name: 'Scope A.1',
            uuid: 'scope-a1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        {
          uuid: 'scope-a0',
          changeType: 'added',
          newValues: {
            type: 'Scope',
            doc_no: 'A.0',
            name: 'Scope A.0',
            uuid: 'scope-a0',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        {
          uuid: 'article-a0-1',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.0.1',
            name: 'Article A.0.1',
            uuid: 'article-a0-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['scope-a0'],
        },
        {
          uuid: 'article-a1-1',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.1.1',
            name: 'Article A.1.1',
            uuid: 'article-a1-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['scope-a1'],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Depth-first order: A.0 -> A.0.1 -> A.1 -> A.1.1
      // NOT breadth-first: A.0 -> A.1 -> A.0.1 -> A.1.1
      expect(sorted.map((c) => c.uuid)).toEqual(['scope-a0', 'article-a0-1', 'scope-a1', 'article-a1-1']);
    });

    it('sorts siblings by document number using natural ordering', () => {
      // Test that A.0.1.2 comes before A.0.1.10 (not lexicographic order)
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'section-10',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1.10',
            name: 'Section 10',
            uuid: 'section-10',
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
            doc_no: 'A.0.1.2',
            name: 'Section 2',
            uuid: 'section-2',
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
            doc_no: 'A.0.1.1',
            name: 'Section 1',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-1'],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Should be sorted by natural doc_no order: 1, 2, 10 (not 1, 10, 2)
      expect(sorted.map((c) => c.uuid)).toEqual(['section-1', 'section-2', 'section-10']);
    });

    it('handles complex tree with multiple levels and siblings', () => {
      const changes: AtlasDocumentChange[] = [
        // Scope A.1
        {
          uuid: 'scope-a1',
          changeType: 'added',
          newValues: {
            type: 'Scope',
            doc_no: 'A.1',
            name: 'Scope A.1',
            uuid: 'scope-a1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        // Scope A.0
        {
          uuid: 'scope-a0',
          changeType: 'added',
          newValues: {
            type: 'Scope',
            doc_no: 'A.0',
            name: 'Scope A.0',
            uuid: 'scope-a0',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        // Article A.0.1
        {
          uuid: 'article-a0-1',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.0.1',
            name: 'Article A.0.1',
            uuid: 'article-a0-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['scope-a0'],
        },
        // Section A.0.1.1
        {
          uuid: 'section-a0-1-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1.1',
            name: 'Section A.0.1.1',
            uuid: 'section-a0-1-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-a0-1', 'scope-a0'],
        },
        // Core A.0.1.1.1
        {
          uuid: 'core-a0-1-1-1',
          changeType: 'added',
          newValues: {
            type: 'Core',
            doc_no: 'A.0.1.1.1',
            name: 'Core A.0.1.1.1',
            uuid: 'core-a0-1-1-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-a0-1-1', 'article-a0-1', 'scope-a0'],
        },
        // Core A.0.1.1.2
        {
          uuid: 'core-a0-1-1-2',
          changeType: 'added',
          newValues: {
            type: 'Core',
            doc_no: 'A.0.1.1.2',
            name: 'Core A.0.1.1.2',
            uuid: 'core-a0-1-1-2',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-a0-1-1', 'article-a0-1', 'scope-a0'],
        },
        // Section A.0.1.2
        {
          uuid: 'section-a0-1-2',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1.2',
            name: 'Section A.0.1.2',
            uuid: 'section-a0-1-2',
            content: '',
            last_modified: '',
          },
          newAncestry: ['article-a0-1', 'scope-a0'],
        },
        // Article A.0.2
        {
          uuid: 'article-a0-2',
          changeType: 'added',
          newValues: {
            type: 'Article',
            doc_no: 'A.0.2',
            name: 'Article A.0.2',
            uuid: 'article-a0-2',
            content: '',
            last_modified: '',
          },
          newAncestry: ['scope-a0'],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Expected depth-first order:
      // A.0 -> A.0.1 -> A.0.1.1 -> A.0.1.1.1 -> A.0.1.1.2 -> A.0.1.2 -> A.0.2 -> A.1
      expect(sorted.map((c) => c.newValues?.doc_no)).toEqual([
        'A.0',
        'A.0.1',
        'A.0.1.1',
        'A.0.1.1.1',
        'A.0.1.1.2',
        'A.0.1.2',
        'A.0.2',
        'A.1',
      ]);
    });

    it('handles documents whose parents already exist (not being added)', () => {
      // When parent already exists in Notion, children should still be ordered correctly
      // relative to each other
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'section-2',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1.2',
            name: 'Section 2',
            uuid: 'section-2',
            content: '',
            last_modified: '',
          },
          // Parent 'existing-article' is NOT in the additions list
          newAncestry: ['existing-article'],
        },
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1.1',
            name: 'Section 1',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['existing-article'],
        },
        {
          uuid: 'core-under-section-1',
          changeType: 'added',
          newValues: {
            type: 'Core',
            doc_no: 'A.0.1.1.1',
            name: 'Core under Section 1',
            uuid: 'core-under-section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1', 'existing-article'],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // section-1 and section-2 are both "roots" for this sync (parent not being added)
      // But section-1 has a child, so depth-first: section-1 -> core -> section-2
      expect(sorted.map((c) => c.uuid)).toEqual(['section-1', 'core-under-section-1', 'section-2']);
    });

    it('handles Needed Research documents with NR-X numbering', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'nr-10',
          changeType: 'added',
          newValues: {
            type: 'Needed Research',
            doc_no: 'NR-10',
            name: 'Research 10',
            uuid: 'nr-10',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'nr-2',
          changeType: 'added',
          newValues: {
            type: 'Needed Research',
            doc_no: 'NR-2',
            name: 'Research 2',
            uuid: 'nr-2',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'nr-1',
          changeType: 'added',
          newValues: {
            type: 'Needed Research',
            doc_no: 'NR-1',
            name: 'Research 1',
            uuid: 'nr-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Should sort NR documents by natural number order: NR-1, NR-2, NR-10
      expect(sorted.map((c) => c.uuid)).toEqual(['nr-1', 'nr-2', 'nr-10']);
    });

    it('handles mixed document types with annotations and tenets', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'scenario-1',
          changeType: 'added',
          newValues: {
            type: 'Scenario',
            doc_no: 'A.0.1.0.4.1.1',
            name: 'Scenario',
            uuid: 'scenario-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['tenet-1', 'section-1'],
        },
        {
          uuid: 'tenet-1',
          changeType: 'added',
          newValues: {
            type: 'Action Tenet',
            doc_no: 'A.0.1.0.4.1',
            name: 'Tenet',
            uuid: 'tenet-1',
            content: '',
            last_modified: '',
          },
          newAncestry: ['section-1'],
        },
        {
          uuid: 'annotation-1',
          changeType: 'added',
          newValues: {
            type: 'Annotation',
            doc_no: 'A.0.1.0.3.1',
            name: 'Annotation',
            uuid: 'annotation-1',
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
            doc_no: 'A.0.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Depth-first: Section -> Annotation (0.3.1) -> Tenet (0.4.1) -> Scenario (0.4.1.1)
      // Note: Annotation comes before Tenet due to doc_no ordering (0.3 < 0.4)
      expect(sorted.map((c) => c.uuid)).toEqual(['section-1', 'annotation-1', 'tenet-1', 'scenario-1']);
    });

    it('handles documents with missing newValues gracefully', () => {
      const changes: AtlasDocumentChange[] = [
        {
          uuid: 'section-1',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.0.1',
            name: 'Section',
            uuid: 'section-1',
            content: '',
            last_modified: '',
          },
          newAncestry: [],
        },
        {
          uuid: 'section-2',
          changeType: 'added',
          newValues: undefined, // Missing newValues
          newAncestry: [],
        },
      ];

      const sorted = sortAdditionsByDepthFirst(changes);

      // Documents with missing doc_no should sort last (empty string comparison)
      expect(sorted.map((c) => c.uuid)).toEqual(['section-1', 'section-2']);
    });
  });
});
