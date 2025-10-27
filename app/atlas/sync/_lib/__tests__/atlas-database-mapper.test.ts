import { describe, expect, it } from 'vitest';
import { AGENT_ROOT_SECTION_UUIDS_MAPPED } from '@/app/server/atlas/constants';
import { BaseAtlasDocument } from '@/app/server/atlas/json-export/types';
import {
  databaseSupportsInternalNesting,
  getDatabaseNameFromDocument,
  getInternalParentPageIdFromAncestry,
} from '../atlas-database-mapper';

const agentRootSectionUuid1 = Array.from(AGENT_ROOT_SECTION_UUIDS_MAPPED.values())[0];
const agentRootSectionUuid2 = Array.from(AGENT_ROOT_SECTION_UUIDS_MAPPED.values())[1];

describe('atlas-database-mapper', () => {
  describe('getDatabaseNameFromDocument', () => {
    describe('direct mappings (no ancestry needed)', () => {
      it('maps Scope to Scopes', () => {
        expect(getDatabaseNameFromDocument('Scope', undefined)).toBe('Scopes');
        expect(getDatabaseNameFromDocument('Scope', [])).toBe('Scopes');
      });

      it('maps Article to Articles', () => {
        expect(getDatabaseNameFromDocument('Article', undefined)).toBe('Articles');
      });

      it('maps Section to Sections & Primary Docs', () => {
        expect(getDatabaseNameFromDocument('Section', undefined)).toBe('Sections & Primary Docs');
      });

      it('maps Type Specification to Sections & Primary Docs', () => {
        expect(getDatabaseNameFromDocument('Type Specification', undefined)).toBe('Sections & Primary Docs');
      });

      it('maps Annotation to Annotations', () => {
        expect(getDatabaseNameFromDocument('Annotation', undefined)).toBe('Annotations');
      });

      it('maps Action Tenet to Tenets', () => {
        expect(getDatabaseNameFromDocument('Action Tenet', undefined)).toBe('Tenets');
      });

      it('maps Scenario to Scenarios', () => {
        expect(getDatabaseNameFromDocument('Scenario', undefined)).toBe('Scenarios');
      });

      it('maps Scenario Variation to Scenario Variations', () => {
        expect(getDatabaseNameFromDocument('Scenario Variation', undefined)).toBe('Scenario Variations');
      });

      it('maps Active Data to Active Data', () => {
        expect(getDatabaseNameFromDocument('Active Data', undefined)).toBe('Active Data');
      });

      it('maps Needed Research to Needed Research', () => {
        expect(getDatabaseNameFromDocument('Needed Research', undefined)).toBe('Needed Research');
      });
    });

    describe('Core type disambiguation by ancestry', () => {
      it('maps Core to Sections & Primary Docs without agent ancestry', () => {
        const ancestry = ['section-uuid-1', 'article-uuid-2'];
        expect(getDatabaseNameFromDocument('Core', ancestry)).toBe('Sections & Primary Docs');
      });

      it('maps Core to Sections & Primary Docs with empty ancestry', () => {
        expect(getDatabaseNameFromDocument('Core', [])).toBe('Sections & Primary Docs');
        expect(getDatabaseNameFromDocument('Core', undefined)).toBe('Sections & Primary Docs');
      });

      it('maps Core to Agent Scope Database when ancestor is first agent root (Prime Agents)', () => {
        const ancestry = [agentRootSectionUuid1];
        expect(getDatabaseNameFromDocument('Core', ancestry)).toBe('Agent Scope Database');
      });

      it('maps Core to Agent Scope Database when ancestor is second agent root (Executor Agents)', () => {
        const ancestry = [agentRootSectionUuid2];
        expect(getDatabaseNameFromDocument('Core', ancestry)).toBe('Agent Scope Database');
      });

      it('maps Core to Agent Scope Database when agent root is deep in ancestry chain', () => {
        const ancestry = [
          'article-uuid',
          agentRootSectionUuid1, // Agent root in middle
          'core-uuid-1',
          'core-uuid-2',
        ];
        expect(getDatabaseNameFromDocument('Core', ancestry)).toBe('Agent Scope Database');
      });

      it('maps Core to Agent Scope Database when agent root is immediate parent', () => {
        const ancestry = [agentRootSectionUuid1];
        expect(getDatabaseNameFromDocument('Core', ancestry)).toBe('Agent Scope Database');
      });
    });

    describe('Active Data Controller type disambiguation by ancestry', () => {
      it('maps Active Data Controller to Sections & Primary Docs without agent ancestry', () => {
        const ancestry = ['section-uuid-1'];
        expect(getDatabaseNameFromDocument('Active Data Controller', ancestry)).toBe('Sections & Primary Docs');
      });

      it('maps Active Data Controller to Sections & Primary Docs with empty ancestry', () => {
        expect(getDatabaseNameFromDocument('Active Data Controller', [])).toBe('Sections & Primary Docs');
        expect(getDatabaseNameFromDocument('Active Data Controller', undefined)).toBe('Sections & Primary Docs');
      });

      it('maps Active Data Controller to Agent Scope Database when ancestor is agent root', () => {
        const ancestry = [agentRootSectionUuid1];
        expect(getDatabaseNameFromDocument('Active Data Controller', ancestry)).toBe('Agent Scope Database');
      });

      it('maps Active Data Controller to Agent Scope Database when agent root is deep in ancestry', () => {
        const ancestry = [
          'article-uuid',
          agentRootSectionUuid2, // Second agent root
          'core-uuid-1',
        ];
        expect(getDatabaseNameFromDocument('Active Data Controller', ancestry)).toBe('Agent Scope Database');
      });
    });

    describe('error handling', () => {
      it('throws error for unmapped document type', () => {
        // @ts-expect-error Testing invalid type
        expect(() => getDatabaseNameFromDocument('InvalidType', undefined)).toThrow(
          'No database mapping found for document type: InvalidType',
        );
      });
    });
  });

  describe('databaseSupportsInternalNesting', () => {
    it('returns true for Sections & Primary Docs', () => {
      expect(databaseSupportsInternalNesting('Sections & Primary Docs')).toBe(true);
    });

    it('returns true for Agent Scope Database', () => {
      expect(databaseSupportsInternalNesting('Agent Scope Database')).toBe(true);
    });

    it('returns false for Scopes', () => {
      expect(databaseSupportsInternalNesting('Scopes')).toBe(false);
    });

    it('returns false for Articles', () => {
      expect(databaseSupportsInternalNesting('Articles')).toBe(false);
    });

    it('returns false for Annotations', () => {
      expect(databaseSupportsInternalNesting('Annotations')).toBe(false);
    });

    it('returns false for Tenets', () => {
      expect(databaseSupportsInternalNesting('Tenets')).toBe(false);
    });

    it('returns false for Scenarios', () => {
      expect(databaseSupportsInternalNesting('Scenarios')).toBe(false);
    });

    it('returns false for Scenario Variations', () => {
      expect(databaseSupportsInternalNesting('Scenario Variations')).toBe(false);
    });

    it('returns false for Active Data', () => {
      expect(databaseSupportsInternalNesting('Active Data')).toBe(false);
    });

    it('returns false for Needed Research', () => {
      expect(databaseSupportsInternalNesting('Needed Research')).toBe(false);
    });
  });

  describe('getInternalParentPageIdFromAncestry', () => {
    describe('returns null cases', () => {
      it('returns null when ancestry is undefined', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>();
        const result = getInternalParentPageIdFromAncestry(undefined, 'Sections & Primary Docs', uuidToDocumentMap);
        expect(result).toBeNull();
      });

      it('returns null when ancestry is empty array', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>();
        const result = getInternalParentPageIdFromAncestry([], 'Sections & Primary Docs', uuidToDocumentMap);
        expect(result).toBeNull();
      });

      it('returns null when parent document not found in map', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>();
        const result = getInternalParentPageIdFromAncestry(
          ['parent-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBeNull();
      });

      it('returns null when parent is in different database (cross-database relationship)', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'article-uuid',
            {
              type: 'Article',
              doc_no: 'A.1',
              name: 'Test Article',
              uuid: 'article-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Section whose parent is an Article (cross-database)
        const result = getInternalParentPageIdFromAncestry(
          ['article-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBeNull();
      });
    });

    describe('same-database parent cases', () => {
      it('returns parent ID when Section parent of Core in Sections & Primary Docs', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'section-uuid',
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Test Section',
              uuid: 'section-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        const result = getInternalParentPageIdFromAncestry(
          ['section-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBe('section-uuid');
      });

      it('returns parent ID when Core parent of nested Core in Sections & Primary Docs', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'article-uuid',
            {
              type: 'Article',
              doc_no: 'A.1',
              name: 'Test Article',
              uuid: 'article-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'section-uuid',
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Test Section',
              uuid: 'section-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'core-parent-uuid',
            {
              type: 'Core',
              doc_no: 'A.1.1.1',
              name: 'Parent Core',
              uuid: 'core-parent-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Core → Core → Core (nested within same database)
        const result = getInternalParentPageIdFromAncestry(
          ['article-uuid', 'section-uuid', 'core-parent-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBe('core-parent-uuid');
      });

      it('returns parent ID when Core parent of Active Data Controller in Sections & Primary Docs', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'section-uuid',
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Test Section',
              uuid: 'section-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'core-uuid',
            {
              type: 'Core',
              doc_no: 'A.1.1.1',
              name: 'Parent Core',
              uuid: 'core-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        const result = getInternalParentPageIdFromAncestry(
          ['section-uuid', 'core-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBe('core-uuid');
      });

      it('returns parent ID when Core parent of Core in Agent Scope Database', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            agentRootSectionUuid1,
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Agent Root Section',
              uuid: agentRootSectionUuid1,
              content: '',
              last_modified: '',
            },
          ],
          [
            'agent-core-uuid',
            {
              type: 'Core',
              doc_no: 'A.1.1.1',
              name: 'Agent Core',
              uuid: 'agent-core-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Core with agent ancestry - should be in Agent Scope Database
        const result = getInternalParentPageIdFromAncestry(
          [agentRootSectionUuid1, 'agent-core-uuid'],
          'Agent Scope Database',
          uuidToDocumentMap,
        );
        expect(result).toBe('agent-core-uuid');
      });

      it('returns parent ID when Active Data Controller parent of Core in Agent Scope Database', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            agentRootSectionUuid1,
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Agent Root Section',
              uuid: agentRootSectionUuid1,
              content: '',
              last_modified: '',
            },
          ],
          [
            'adc-uuid',
            {
              type: 'Active Data Controller',
              doc_no: 'A.1.1.1',
              name: 'Agent ADC',
              uuid: 'adc-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        const result = getInternalParentPageIdFromAncestry(
          [agentRootSectionUuid1, 'adc-uuid'],
          'Agent Scope Database',
          uuidToDocumentMap,
        );
        expect(result).toBe('adc-uuid');
      });
    });

    describe('filters cross-database parents correctly', () => {
      it('filters out Article parent when checking Section', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'article-uuid',
            {
              type: 'Article',
              doc_no: 'A.1',
              name: 'Test Article',
              uuid: 'article-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Section under Article - Article is in different database
        const result = getInternalParentPageIdFromAncestry(
          ['article-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBeNull();
      });

      it('filters out Section parent when checking Annotation', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'section-uuid',
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Test Section',
              uuid: 'section-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Annotation under Section - Section is in different database
        const result = getInternalParentPageIdFromAncestry(['section-uuid'], 'Annotations', uuidToDocumentMap);
        expect(result).toBeNull();
      });

      it('filters out Core (Agent) parent when checking Core (non-Agent)', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            agentRootSectionUuid1,
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Agent Root Section',
              uuid: agentRootSectionUuid1,
              content: '',
              last_modified: '',
            },
          ],
          [
            'agent-core-uuid',
            {
              type: 'Core',
              doc_no: 'A.1.1.1',
              name: 'Agent Core',
              uuid: 'agent-core-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Trying to create non-agent Core under agent Core - different databases
        const result = getInternalParentPageIdFromAncestry(
          [agentRootSectionUuid1, 'agent-core-uuid'],
          'Sections & Primary Docs', // Child is non-agent
          uuidToDocumentMap,
        );
        expect(result).toBeNull();
      });
    });

    describe('handles deep ancestry chains', () => {
      it('correctly identifies same-database parent in deep chain', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'scope-uuid',
            {
              type: 'Scope',
              doc_no: 'A.1',
              name: 'Test Scope',
              uuid: 'scope-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'article-uuid',
            {
              type: 'Article',
              doc_no: 'A.1.1',
              name: 'Test Article',
              uuid: 'article-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'section-uuid',
            {
              type: 'Section',
              doc_no: 'A.1.1.1',
              name: 'Test Section',
              uuid: 'section-uuid',
              content: '',
              last_modified: '',
            },
          ],
          [
            'core-uuid',
            {
              type: 'Core',
              doc_no: 'A.1.1.1.1',
              name: 'Parent Core',
              uuid: 'core-uuid',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Deep chain: Scope → Article → Section → Core → Core (nested)
        // Only the last Core is the same-database parent
        const result = getInternalParentPageIdFromAncestry(
          ['scope-uuid', 'article-uuid', 'section-uuid', 'core-uuid'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBe('core-uuid');
      });

      it('ignores distant same-type ancestors and only checks immediate parent', () => {
        const uuidToDocumentMap = new Map<string, BaseAtlasDocument>([
          [
            'section-uuid-1',
            {
              type: 'Section',
              doc_no: 'A.1.1',
              name: 'Grandparent Section',
              uuid: 'section-uuid-1',
              content: '',
              last_modified: '',
            },
          ],
          [
            'core-uuid-1',
            {
              type: 'Core',
              doc_no: 'A.1.1.1',
              name: 'Parent Core',
              uuid: 'core-uuid-1',
              content: '',
              last_modified: '',
            },
          ],
        ]);

        // Ancestry includes Section, but immediate parent is Core
        // Should return Core as the same-database parent
        const result = getInternalParentPageIdFromAncestry(
          ['section-uuid-1', 'core-uuid-1'],
          'Sections & Primary Docs',
          uuidToDocumentMap,
        );
        expect(result).toBe('core-uuid-1');
      });
    });
  });
});
